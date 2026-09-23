#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const HOST = '127.0.0.1';
const BASE_URL = process.env.SUBSCRIPTION_BASE_URL || 'http://127.0.0.1:3000';
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

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


const waitFor = async (page, expression) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await page.evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${expression}`);
};

const run = async () => {
  const port = await getFreePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dealett-subscriptions-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, 'about:blank',
  ], { stdio: 'ignore' });
  let page;
  try {
    const tabs = await waitForJson(`http://${HOST}:${port}/json/list`);
    page = new CdpPage(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    for (const width of [1440, 1024, 390]) {
      await page.send('Emulation.setDeviceMetricsOverride', {
        width, height: 1000, deviceScaleFactor: 1, mobile: false,
      });
      let reference;
      let rewardReference;
      let modalReference;
      for (const route of ['5g-bredband', 'mobilabonnemang', 'familjabonnemang']) {
        await page.send('Page.navigate', { url: `${BASE_URL}/${route}.html` });
        await waitFor(page, `document.querySelectorAll('.subscription-offer-card, .bredband-offer-card').length > 0`);
        await page.evaluate('document.fonts.ready.then(() => true)');
        const actual = await page.evaluate(`(() => {
          const styles = (selector, properties) => {
            const style = getComputedStyle(document.querySelector(selector));
            return Object.fromEntries(properties.map((property) => [property, style[property]]));
          };
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            design: {
              heading: styles('h1', ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight']),
              section: styles('#offersSection', ['padding', 'backgroundColor']),
              shell: styles('.bredband-results-shell, .result-shell', ['width']),
              grid: styles('.bredband-offers-grid, .offers-container', ['gridTemplateColumns', 'gap']),
              card: styles('.bredband-offer-card, .subscription-offer-card', ['width', 'padding', 'display', 'gap', 'backgroundColor', 'borderRadius', 'boxShadow']),
              brand: styles('.bredband-offer-brand', ['display', 'gridTemplateColumns', 'gap']),
              gift: styles('.bredband-reward-btn', ['padding', 'borderRadius', 'fontSize', 'fontWeight', 'backgroundColor']),
              price: styles('.bredband-price', ['fontSize', 'fontWeight', 'lineHeight']),
              features: styles('.bredband-feature-list', ['gap', 'fontSize']),
              footer: styles('.bredband-offer-footer', ['display', 'gridTemplateColumns', 'gap']),
              filter: styles('.bredband-filter-group, .range-filter', ['padding', 'backgroundColor', 'borderRadius', 'boxShadow']),
              action: styles('.bredband-choose-btn, .offer-card-action', ['backgroundColor', 'color', 'borderRadius', 'fontSize', 'fontWeight']),
            },
          };
        })()`);
        assert.equal(actual.overflow, false, `${route} overflows at ${width}px`);
        if (!reference) reference = actual.design;
        else assert.deepEqual(actual.design, reference, `${route} diverges from broadband at ${width}px`);

        if (route === '5g-bredband') {
          modalReference = await page.evaluate(`(() => {
            const modal = getComputedStyle(document.querySelector('.bredband-modal-card'));
            const head = getComputedStyle(document.querySelector('.bredband-modal-head'));
            const title = getComputedStyle(document.querySelector('#channelsTitle'));
            return [modal.borderRadius, modal.boxShadow, modal.backgroundColor, head.padding, head.backgroundColor, title.fontSize, title.fontWeight];
          })()`);
          await page.evaluate(`document.querySelector('#speedFilter').value = '500'; document.querySelector('#speedFilter').dispatchEvent(new Event('change'))`);
          assert(await page.evaluate(`[...document.querySelectorAll('.bredband-speed-chip')].every((el) => Number(el.textContent.replace(/[^0-9]/g, '')) >= 500)`));
          await page.evaluate(`document.querySelector('.bredband-choose-btn').click()`);
          assert(await page.evaluate(`!document.querySelector('#continueBtn').disabled`));
          await page.evaluate(`document.querySelector('#openCoverageModal').click()`);
          assert(await page.evaluate(`!document.querySelector('#coverageModal').classList.contains('hidden')`));
          await page.evaluate(`document.querySelector('#closeCoverageModal').click()`);
          continue;
        }
        const originalCards = await page.evaluate(`[...document.querySelectorAll('.subscription-offer-card')].map((el) => el.textContent)`);
        await page.evaluate(`document.querySelector('#operatorFilter').value = 'Telia'; document.querySelector('#operatorFilter').dispatchEvent(new Event('change'))`);
        await waitFor(page, `document.querySelectorAll('.subscription-offer-card').length > 0 && [...document.querySelectorAll('.subscription-offer-card')].every((el) => el.dataset.operator === 'Telia')`);
        await page.evaluate(`document.querySelector('#operatorFilter').value = 'Alla'; document.querySelector('#operatorFilter').dispatchEvent(new Event('change'))`);
        await waitFor(page, `document.querySelectorAll('.subscription-offer-card').length === ${originalCards.length}`);
        assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.subscription-offer-card')].map((el) => el.textContent)`), originalCards);
        if (route === 'familjabonnemang') {
          await page.evaluate(`document.querySelector('#familySize').value = '4'; document.querySelector('#familySize').dispatchEvent(new Event('input')); document.querySelector('#familySize').dispatchEvent(new Event('change'))`);
          await waitFor(page, `document.querySelector('#familySize').value === '4' && document.querySelector('.plan-description')?.textContent.startsWith('4 abonnemang')`);
        } else {
          await page.evaluate(`document.querySelector('[data-surf-calculator]').click()`);
          assert(await page.evaluate(`document.querySelector('.surf-calculator').open`));
          await page.evaluate(`document.querySelector('#surf-video').value = '60'; document.querySelector('#surf-video').dispatchEvent(new Event('input'))`);
          assert.equal(await page.evaluate(`document.querySelector('#surf-gb').textContent`), '21');
          assert.equal(await page.evaluate(`document.querySelector('#surf-buffer').textContent`), '26 GB');
          await page.evaluate(`document.querySelector('.surf-apply').click()`);
          assert(await page.evaluate(`!document.querySelector('.surf-calculator').open && document.querySelector('#dataFilter').value !== 'all'`));
          await page.evaluate(`document.querySelector('#dataFilter').value = 'all'; document.querySelector('#dataFilter').dispatchEvent(new Event('change'))`);
          await waitFor(page, `document.querySelectorAll('.subscription-offer-card').length === ${originalCards.length}`);
        }
        await page.evaluate(`document.querySelector('.offer-compare-button').click()`);
        assert(await page.evaluate(`document.querySelector('.offer-compare-button').getAttribute('aria-pressed') === 'true'`));
        assert(await page.evaluate(`(() => {
          const rect = document.querySelector('.compare-tray').getBoundingClientRect();
          return rect.left >= 0 && rect.right <= innerWidth;
        })()`), 'Comparison tray is clipped');
        await page.evaluate(`document.querySelector('.compare-open-button').click()`);
        assert(await page.evaluate(`!document.querySelector('.compare-modal').hidden`));
        await page.evaluate(`document.querySelector('.compare-modal-close').click(); document.querySelector('.offer-card-action').click()`);
        assert(await page.evaluate(`!document.querySelector('#subscriptionSelection').hidden && !document.querySelector('#rewardSection').open`));
        await page.evaluate(`document.querySelector('#subscriptionContinue').click()`);
        assert(await page.evaluate(`document.querySelector('#rewardSection').open`));
        assert(await page.evaluate(`document.querySelectorAll('#rewardGrid input').length === 8`));
        assert(await page.evaluate(`document.querySelector('#rewardSection').scrollWidth <= document.querySelector('#rewardSection').clientWidth`));
        const modalDesign = await page.evaluate(`(() => {
          const modal = getComputedStyle(document.querySelector('#rewardSection'));
          const head = getComputedStyle(document.querySelector('#rewardSection .section-head'));
          const title = getComputedStyle(document.querySelector('#rewardTitle'));
          return [modal.borderRadius, modal.boxShadow, modal.backgroundColor, head.padding, head.backgroundColor, title.fontSize, title.fontWeight];
        })()`);
        assert.deepEqual(modalDesign, modalReference, 'Reward modal should follow broadband dialog styling');
        const rewardDesign = await page.evaluate(`['.subscription-reward-dialog', '.reward-panel', '.reward-choice', '.reward-summary-bar', '.reward-progress', '.compare-tray'].map((selector) => {
          const s = getComputedStyle(document.querySelector(selector));
          return [s.padding, s.borderRadius, s.backgroundColor, s.boxShadow];
        })`);
        if (!rewardReference) rewardReference = rewardDesign;
        else assert.deepEqual(rewardDesign, rewardReference, 'Mobile and family reward/comparison styles diverge');
        await page.evaluate(`document.querySelector('[data-reward-close]').click(); document.querySelector('.bredband-reward-btn').click()`);
        assert(await page.evaluate(`document.querySelector('#rewardSection').open`));
        await page.evaluate(`document.querySelector('[data-reward-close]').click()`);
        const hiddenCount = await page.evaluate(`document.querySelectorAll('.subscription-offer-card.is-hidden').length`);
        if (hiddenCount) {
          await page.evaluate(`document.querySelector('.offer-extra-toggle-button').click()`);
          assert.equal(await page.evaluate(`document.querySelectorAll('.subscription-offer-card.is-hidden').length`), 0);
        }
        await waitFor(page, `[...document.querySelectorAll('.bredband-operator-logo-wrap img')].every(img => img.complete && img.naturalWidth > 0)`);
        assert.equal(page.exceptions.length, 0, page.exceptions.join('\n'));
      }
      console.log(`Subscription design and interactions passed at ${width}px.`);
    }
  } finally {
    page?.close();
    chrome.kill();
    await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), delay(1500)]);
    fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
