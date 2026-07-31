#!/usr/bin/env node

const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const HOST = '127.0.0.1';
const BASE_URL = process.env.CHECKOUT_BASE_URL || 'https://lollekacc.github.io/df';
const OUTPUT_DIR = process.env.CHECKOUT_SCREENSHOT_DIR ||
  fs.mkdtempSync(path.join(os.tmpdir(), 'dealett-checkout-visual-'));
const CHROME = process.env.CHROME_BIN ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getFreePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, HOST, () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

const waitForJson = async (url, timeoutMs = 10000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      // Chrome may still be starting.
    }
    await delay(100);
  }
  throw new Error(`Timed out while waiting for ${url}`);
};

class CdpPage {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.pending = new Map();
    this.events = new Map();
    this.nextId = 1;
    this.exceptions = [];
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result || {});
        return;
      }

      if (message.method === 'Runtime.exceptionThrown') {
        this.exceptions.push(
          message.params.exceptionDetails?.exception?.description ||
          message.params.exceptionDetails?.text ||
          'Unknown browser exception'
        );
      }

      const listeners = this.events.get(message.method) || [];
      listeners.forEach((listener) => listener(message.params));
      this.events.delete(message.method);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  waitForEvent(method, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeoutMs);
      this.events.set(method, [
        ...(this.events.get(method) || []),
        (params) => {
          clearTimeout(timeout);
          resolve(params);
        },
      ]);
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'Browser evaluation failed');
    }
    return result.result?.value;
  }

  close() {
    this.socket.close();
  }
}

const capture = async (page, fileName) => {
  const result = await page.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), Buffer.from(result.data, 'base64'));
};

const scrollTo = async (page, selector) => {
  await page.evaluate(`(() => {
    const target = document.querySelector(${JSON.stringify(selector)});
    if (!target) return false;
    target.scrollIntoView({ block: 'start' });
    return true;
  })()`);
  await delay(250);
};

const runViewport = async (debugBase, viewport) => {
  const target = await fetch(`${debugBase}/json/new?about:blank`, { method: 'PUT' }).then((response) => response.json());
  const page = new CdpPage(target.webSocketDebuggerUrl);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width <= 768,
  });

  const loaded = page.waitForEvent('Page.loadEventFired');
  await page.send('Page.navigate', { url: `${BASE_URL}/bestallning.html` });
  await loaded;
  await delay(1800);

  await capture(page, `${viewport.name}-top.png`);

  if (viewport.width === 1536) {
    await scrollTo(page, '#deliveryTitle');
    await capture(page, `${viewport.name}-middle.png`);
    await scrollTo(page, '#agreementTitle');
    await capture(page, `${viewport.name}-agreement.png`);
    await page.evaluate(`document.querySelector('#dealettTermsLabel .agreement-inline-link')?.click()`);
    await delay(200);
    await capture(page, `${viewport.name}-document-popup.png`);
    await page.evaluate(`document.querySelector('[data-close-document]')?.click()`);
  }

  if (viewport.width === 390) {
    await page.evaluate(`document.querySelector('.checkout-summary-toggle')?.click()`);
    await delay(200);
    await capture(page, `${viewport.name}-summary-expanded.png`);
    await page.evaluate(`document.querySelector('.checkout-summary-toggle')?.click()`);
    await scrollTo(page, '#agreementTitle');
    await capture(page, `${viewport.name}-agreement.png`);
    await page.evaluate(`document.querySelector('#dealettTermsLabel .agreement-inline-link')?.click()`);
    await delay(200);
    await capture(page, `${viewport.name}-document-popup.png`);
    await page.evaluate(`document.querySelector('[data-close-document]')?.click()`);
    await scrollTo(page, '#paymentObligation');
    await capture(page, `${viewport.name}-final-action.png`);
  }

  const metrics = await page.evaluate(`(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    documentStatus: document.querySelector('#documentStatus')?.textContent.trim(),
    summaryExpanded: document.querySelector('.checkout-summary-toggle')?.getAttribute('aria-expanded'),
    submitDisabled: document.querySelector('#submitOrderButton')?.disabled,
    headingRect: document.querySelector('#checkoutTitle')?.getBoundingClientRect().toJSON(),
  }))()`);

  const result = {
    viewport,
    metrics,
    exceptions: page.exceptions,
  };
  page.close();
  return result;
};

const main = async () => {
  if (!fs.existsSync(CHROME)) throw new Error(`Chrome was not found at ${CHROME}`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const debugPort = await getFreePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dealett-checkout-chrome-'));
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: 'ignore' });
  const debugBase = `http://${HOST}:${debugPort}`;

  try {
    await waitForJson(`${debugBase}/json/version`);
    const viewports = [
      { name: 'desktop-1536x1024', width: 1536, height: 1024 },
      { name: 'desktop-1280x800', width: 1280, height: 800 },
      { name: 'tablet-768x1024', width: 768, height: 1024 },
      { name: 'mobile-390x844', width: 390, height: 844 },
    ];
    const results = [];
    for (const viewport of viewports) {
      results.push(await runViewport(debugBase, viewport));
    }

    console.log(JSON.stringify({ outputDirectory: OUTPUT_DIR, results }, null, 2));
  } finally {
    chrome.kill();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
};

module.exports = {
  CdpPage,
  CHROME,
  delay,
  getFreePort,
  waitForJson,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
