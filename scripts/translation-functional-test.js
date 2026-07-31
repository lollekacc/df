#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const {
  CdpPage,
  CHROME,
  delay,
  getFreePort,
  waitForJson,
} = require('./checkout-visual-test');

const HOST = '127.0.0.1';
const BASE_URL = process.env.TRANSLATION_BASE_URL || 'https://lollekacc.github.io/df';
const useLiveTranslation = process.env.TRANSLATION_USE_LIVE === '1';
const auditLivePages = process.env.TRANSLATION_AUDIT_LIVE === '1';
const screenshotDirectory = process.env.TRANSLATION_SCREENSHOT_DIR || '';
const allSitePages = [
  'index.html',
  'mobilabonnemang.html',
  'familjabonnemang.html',
  '5g-bredband.html',
  'paket.html',
  'jamfor-tackning.html',
  'foretag.html',
  'om-oss.html',
  'kontakt.html',
  'varukorg.html',
  'bestallning.html',
  'login.html',
  'account.html',
  'villkor.html',
  'integritetspolicy.html',
  'angerratt.html',
];
const sitePages = process.env.TRANSLATION_AUDIT_PAGES
  ? process.env.TRANSLATION_AUDIT_PAGES.split(',').map((page) => page.trim()).filter(Boolean)
  : allSitePages;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const waitFor = async (page, expression, timeoutMs = 12_000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if (await page.evaluate(expression)) return;
    } catch {
      // A language selection intentionally reloads the page and replaces the execution context.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
};

const installTranslationMock = async (page) => {
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, options = {}) => {
        const url = typeof input === 'string' ? input : input?.url || '';
        if (!url.endsWith('/api/translate')) return originalFetch(input, options);

        const request = JSON.parse(options.body || '{}');
        const prefix = String(request.language || '').toUpperCase();
        return new Response(JSON.stringify({
          language: request.language,
          translations: request.texts.map((source) => ({
            source,
            translated: prefix + ': ' + source,
          })),
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };
    })()`,
  });
};

const capture = async (page, fileName) => {
  if (!screenshotDirectory) return;
  fs.mkdirSync(screenshotDirectory, { recursive: true });
  const result = await page.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  fs.writeFileSync(path.join(screenshotDirectory, fileName), Buffer.from(result.data, 'base64'));
};

const navigate = async (page, pathName) => {
  const loaded = page.waitForEvent('Page.loadEventFired');
  await page.send('Page.navigate', { url: `${BASE_URL}/${pathName}` });
  try {
    await loaded;
  } catch (error) {
    const readyState = await page.evaluate(`document.readyState`).catch(() => '');
    if (!['interactive', 'complete'].includes(readyState)) {
      throw new Error(`${pathName}: ${error.message}`);
    }
  }
  try {
    await waitFor(page, `Boolean(window.DEALETT_I18N && document.querySelector('[data-language-switcher]'))`);
  } catch (error) {
    const state = await page.evaluate(`({
      href: window.location.href,
      hasI18n: Boolean(window.DEALETT_I18N),
      hasHeader: Boolean(document.querySelector('[data-include="header"]')),
      bodyClass: document.body?.className || '',
    })`).catch(() => ({}));
    throw new Error(
      `${pathName}: ${error.message}; state=${JSON.stringify(state)}; exceptions=${page.exceptions.slice(-3).join(' | ')}`
    );
  }
};

const auditAllPages = async (page) => {
  const results = [];

  for (const pathName of sitePages) {
    await page.evaluate(`localStorage.setItem('dealettLanguage', 'sv')`);
    await navigate(page, pathName);
    await page.evaluate(`window.DEALETT_I18N.setLanguage('de')`);
    await delay(600);
    await waitFor(
      page,
      `document.documentElement.dataset.translationState === 'ready' && window.DEALETT_I18N.audit().length === 0`,
      useLiveTranslation ? 60_000 : 20_000
    );
    await delay(150);

    const result = await page.evaluate(`({
      language: document.documentElement.lang,
      state: document.documentElement.dataset.translationState,
      issues: window.DEALETT_I18N.audit(),
    })`);
    assert(result.language === 'de', `${pathName} did not activate German.`);
    assert(result.state === 'ready', `${pathName} did not finish translating.`);
    assert(
      result.issues.length === 0,
      `${pathName} left untranslated content: ${JSON.stringify(result.issues.slice(0, 8))}`
    );
    results.push(pathName);
  }

  await navigate(page, 'index.html');
  const preservedBrands = await page.evaluate(`({
    dealett: document.querySelector('.footer-brand-link')?.textContent.trim(),
    giftLogos: [...document.querySelectorAll('.gift-logo')].map((item) => item.textContent.trim()),
  })`);
  assert(preservedBrands.dealett === 'Dealett', 'The Dealett company name was translated.');
  assert(preservedBrands.giftLogos.includes('H&M'), 'Gift-card logo text was translated.');

  return results;
};

const main = async () => {
  if (!fs.existsSync(CHROME)) throw new Error(`Chrome was not found at ${CHROME}`);

  const debugPort = await getFreePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dealett-translation-chrome-'));
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
    const target = await fetch(`${debugBase}/json/new?about:blank`, { method: 'PUT' })
      .then((response) => response.json());
    const page = new CdpPage(target.webSocketDebuggerUrl);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    if (!useLiveTranslation) await installTranslationMock(page);

    await navigate(page, 'bestallning.html');

    const languageCount = await page.evaluate(
      `document.querySelector('[data-language-switcher]').options.length`
    );
    assert(languageCount >= 30, `Expected at least 30 language options, got ${languageCount}.`);
    const languageGroups = await page.evaluate(`[...document.querySelector('[data-language-switcher]').children]
      .map((group) => ({
        label: group.label,
        languages: [...group.querySelectorAll('option')].map((option) => option.value),
      }))`);
    assert(languageGroups.length === 2, 'The language selector should contain two language groups.');
    assert(
      languageGroups[0].languages.join(',') === 'sv,en,ar,so,fa',
      `The primary languages are not first: ${JSON.stringify(languageGroups[0])}`
    );

    await page.evaluate(`(() => {
      window.__dealettLanguageReloadSentinel = true;
      const select = document.querySelector('[data-language-switcher]');
      select.value = 'de';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await waitFor(
      page,
      `!window.__dealettLanguageReloadSentinel && document.documentElement.lang === 'de'`
    );
    await waitFor(
      page,
      `document.documentElement.dataset.translationState === 'ready'`,
      useLiveTranslation ? 60_000 : 12_000
    );
    await waitFor(
      page,
      useLiveTranslation
        ? `document.querySelector('#agreementTitle')?.textContent.trim() !== 'Avtal'`
        : `document.body.innerText.includes('DE: Avtal')`
    );
    const germanAgreementHeading = await page.evaluate(
      `document.querySelector('#agreementTitle').textContent.trim()`
    );
    await page.evaluate(`window.scrollTo(0, 0)`);
    await capture(page, 'desktop-german.png');

    await page.evaluate(`(() => {
      const dynamic = document.createElement('p');
      dynamic.id = 'translationDynamicFixture';
      dynamic.textContent = 'Ny dynamisk text';
      document.querySelector('#mainContent').append(dynamic);
    })()`);
    await waitFor(
      page,
      useLiveTranslation
        ? `document.querySelector('#translationDynamicFixture')?.textContent !== 'Ny dynamisk text'`
        : `document.querySelector('#translationDynamicFixture')?.textContent === 'DE: Ny dynamisk text'`
    );
    const germanDynamicText = await page.evaluate(
      `document.querySelector('#translationDynamicFixture').textContent`
    );

    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await page.evaluate(`window.DEALETT_I18N.setLanguage('ar')`);
    await waitFor(page, `document.documentElement.lang === 'ar' && document.documentElement.dir === 'rtl'`);
    await waitFor(
      page,
      `document.documentElement.dataset.translationState === 'ready'`,
      useLiveTranslation ? 60_000 : 25_000
    );
    await waitFor(
      page,
      useLiveTranslation
        ? `(() => {
            const heading = document.querySelector('#agreementTitle')?.textContent.trim();
            return heading && heading !== 'Avtal' && heading !== ${JSON.stringify(germanAgreementHeading)};
          })()`
        : `document.querySelector('#agreementTitle')?.textContent === 'AR: Avtal'`
    );
    await waitFor(
      page,
      useLiveTranslation
        ? `document.querySelector('#translationDynamicFixture')?.textContent !== ${JSON.stringify(germanDynamicText)}`
        : `document.querySelector('#translationDynamicFixture')?.textContent === 'AR: Ny dynamisk text'`
    );
    const hasHorizontalOverflow = await page.evaluate(
      `document.documentElement.scrollWidth > window.innerWidth`
    );
    assert(!hasHorizontalOverflow, 'Arabic mobile translation caused horizontal overflow.');
    const mobileLayout = await page.evaluate(`(() => {
      window.scrollTo(0, 0);
      const main = document.querySelector('#mainContent');
      const rect = main?.getBoundingClientRect();
      return {
        display: main ? getComputedStyle(main).display : '',
        height: rect?.height || 0,
        top: rect?.top || 0,
      };
    })()`);
    assert(
      mobileLayout.display !== 'none' && mobileLayout.height > 300 && mobileLayout.top < 200,
      `Arabic mobile checkout is not visibly laid out: ${JSON.stringify(mobileLayout)}`
    );
    await capture(page, 'mobile-arabic.png');

    await page.evaluate(`window.DEALETT_I18N.setLanguage('sv')`);
    await waitFor(page, `document.documentElement.lang === 'sv' && document.documentElement.dir === 'ltr'`);
    const restored = await page.evaluate(`({
      heading: document.querySelector('#agreementTitle').textContent.trim(),
      dynamic: document.querySelector('#translationDynamicFixture').textContent,
      selectedLanguage: document.querySelector('[data-language-switcher]').value,
      exceptions: ${JSON.stringify(page.exceptions)},
    })`);
    assert(restored.heading === 'Avtal', 'The original Swedish heading was not restored.');
    assert(restored.dynamic === 'Ny dynamisk text', 'Dynamic content was not restored to Swedish.');
    assert(restored.selectedLanguage === 'sv', 'The language switcher did not return to Swedish.');
    assert(page.exceptions.length === 0, `Browser exceptions: ${page.exceptions.join(' | ')}`);

    const auditedPages = (!useLiveTranslation || auditLivePages) ? await auditAllPages(page) : [];

    page.close();
    console.log(JSON.stringify({
      languages: languageCount,
      provider: useLiveTranslation ? 'live' : 'mock',
      auditedPages: auditedPages.length,
      german: 'passed',
      arabicRtl: 'passed',
      dynamicContent: 'passed',
      swedishRestore: 'passed',
    }, null, 2));
  } finally {
    chrome.kill();
    await delay(250);
    fs.rmSync(userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
};

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
