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
const BASE_URL = process.env.CHECKOUT_BASE_URL || 'https://lollekacc.github.io/df';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const operatorDocuments = {
  agreementSummaryUrl: 'documents/telenor/avtalssammanfattning-test.pdf',
  fullAgreementUrl: 'documents/telenor/avtalssammanfattning-test.pdf',
  generalTermsUrl: 'https://www.telenor.se/support/priser-villkor-och-blanketter/villkor-och-blanketter',
  specialTermsUrl: 'https://www.telenor.se/support/priser-villkor-och-blanketter/villkor-och-blanketter',
  priceListUrl: 'https://www.telenor.se/support/priser-villkor-och-blanketter/prislistor',
  withdrawalInformationUrl: 'https://www.telenor.se/support/priser-villkor-och-blanketter/reklamation-angerratt-och-oppet-kop',
  version: 'test-2026-07-28',
  documentId: 'functional-test-document',
};

const makeItem = (overrides = {}) => ({
  cartItemId: 'functional-item',
  offerId: 'functional-offer',
  operator: 'Telenor',
  title: 'Obegränsat Plus',
  logo: 'images/telenor.jpg',
  data: 'Obegränsad surf',
  price: 629,
  monthlyPrice: 629,
  regularMonthlyPrice: 629,
  bindingMonths: 24,
  noticePeriodMonths: 1,
  startFee: 0,
  invoiceFee: 59,
  invoiceFeeOptional: true,
  minimumTotalCost: 15096,
  productType: 'mobile',
  persons: 1,
  phoneLines: 1,
  rewards: { 'ICA Maxi': 4000 },
  rewardTotal: 4000,
  operatorDocuments,
  ...overrides,
});

const makeStorageScript = ({ item, checkout } = {}) => `(() => {
  if (sessionStorage.getItem('__dealettFunctionalInitialized') === 'true') return;
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem('__dealettFunctionalInitialized', 'true');
  ${item ? `localStorage.setItem('dealettCart', JSON.stringify([${JSON.stringify(item)}]));` : ''}
  ${checkout ? `sessionStorage.setItem('dealettCheckout', JSON.stringify(${JSON.stringify(checkout)}));` : ''}
})()`;

const createPage = async (debugBase, {
  pathName = 'bestallning.html',
  query = '',
  item = makeItem(),
  checkout = { startDate: 'snarast', phoneNumbers: [] },
  width = 1280,
  height = 800,
} = {}) => {
  const target = await fetch(`${debugBase}/json/new?about:blank`, { method: 'PUT' }).then((response) => response.json());
  const page = new CdpPage(target.webSocketDebuggerUrl);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 768,
  });
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: makeStorageScript({ item, checkout }),
  });

  const loaded = page.waitForEvent('Page.loadEventFired');
  await page.send('Page.navigate', {
    url: `${BASE_URL}/${pathName}${query}`,
  });
  await loaded;
  await delay(900);
  return page;
};

const fillValidForm = async (page, { marketing = false } = {}) => {
  await page.evaluate(`(() => {
    const setValue = (selector, value) => {
      const input = document.querySelector(selector);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    };
    setValue('#checkoutEmail', 'kund@example.se');
    setValue('#checkoutPhone', '070 123 45 67');
    document.querySelectorAll('[data-required-confirmation]').forEach((input) => {
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const marketing = document.querySelector('input[name="marketingConsent"]');
    marketing.checked = ${marketing};
    marketing.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await delay(50);
};

const bodyText = (page) => page.evaluate('document.body.innerText');
const normalizeSpaces = (value) => String(value || '').replace(/\s+/g, ' ');

const main = async () => {
  if (!fs.existsSync(CHROME)) throw new Error(`Chrome was not found at ${CHROME}`);
  const debugPort = await getFreePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dealett-checkout-functional-'));
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
  const results = [];

  const test = async (name, callback) => {
    let page;
    try {
      page = await callback();
      if (page instanceof CdpPage) {
        assert(page.exceptions.length === 0, `Browser exception: ${page.exceptions.join(', ')}`);
      }
      results.push({ name, status: 'passed' });
    } catch (error) {
      results.push({ name, status: 'failed', error: error.message });
    } finally {
      if (page instanceof CdpPage) page.close();
    }
  };

  try {
    await waitForJson(`${debugBase}/json/version`);

    await test('empty checkout returns to the empty cart', async () => {
      const page = await createPage(debugBase, { item: null });
      const state = await page.evaluate(`({
        path: window.location.pathname,
        openCart: new URLSearchParams(window.location.search).get('openCart'),
        cart: JSON.parse(localStorage.getItem('dealettCart') || '[]'),
      })`);
      assert(state.path.endsWith('/index.html'), 'Empty checkout did not return to the storefront.');
      assert(state.openCart === '1', 'Empty checkout did not open the cart.');
      assert(state.cart.length === 0, 'Empty checkout unexpectedly created a cart item.');
      return page;
    });

    await test('cart preparation reveals agreement and signing inside the drawer', async () => {
      const page = await createPage(debugBase, {
        pathName: 'index.html',
        query: '?openCart=1',
        item: makeItem(),
      });
      await page.evaluate(`(() => {
        const email = document.querySelector('#contactEmail');
        const phone = document.querySelector('#contactPhone');
        email.value = 'kund@example.se';
        phone.value = '0701234567';
        document.querySelector('#contactContinueBtn').click();
        const transfer = document.querySelector('#phoneInputsContainer input');
        transfer.value = '0707654321';
        document.querySelector('#confirmNumbersBtn').click();
        document.querySelector('#goToSignBtn').click();
      })()`);
      await delay(250);
      const state = await page.evaluate(`({
        path: window.location.pathname,
        embeddedCheckout: document.querySelector('#embeddedCheckoutFrame')?.getAttribute('src') || '',
        checkout: JSON.parse(sessionStorage.getItem('dealettCheckout') || '{}'),
      })`);
      assert(state.path.endsWith('/index.html'), 'The drawer flow unexpectedly navigated away from the current page.');
      assert(state.embeddedCheckout.includes('bestallning.html?embedded=1'), 'Agreement and signing did not open inside the drawer.');
      assert(
        state.checkout.readyForReview,
        `The checkout was not marked ready for review: ${JSON.stringify(state.checkout)}`
      );
      assert(state.checkout.contact?.email === 'kund@example.se', 'Contact details were not handed over.');
      assert(state.checkout.phoneNumbers?.length === 1, 'Number transfer data was not handed over.');
      return page;
    });

    await test('valid customer data enables ordering without marketing consent', async () => {
      const page = await createPage(debugBase);
      await fillValidForm(page);
      const state = await page.evaluate(`({
        disabled: document.querySelector('#submitOrderButton').disabled,
        marketing: document.querySelector('input[name="marketingConsent"]').checked,
      })`);
      assert(!state.disabled, 'The final button should be enabled.');
      assert(!state.marketing, 'Marketing consent must remain unchecked.');
      return page;
    });

    await test('invalid email is rejected', async () => {
      const page = await createPage(debugBase);
      await page.evaluate(`(() => {
        const email = document.querySelector('#checkoutEmail');
        email.value = 'fel-adress';
        email.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      const state = await page.evaluate(`({
        invalid: document.querySelector('#checkoutEmail').getAttribute('aria-invalid'),
        disabled: document.querySelector('#submitOrderButton').disabled,
      })`);
      assert(state.invalid === 'true' && state.disabled, 'Invalid email was not blocked.');
      return page;
    });

    await test('invalid Swedish mobile number is rejected', async () => {
      const page = await createPage(debugBase);
      await page.evaluate(`(() => {
        const phone = document.querySelector('#checkoutPhone');
        phone.value = '123';
        phone.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      const state = await page.evaluate(`({
        invalid: document.querySelector('#checkoutPhone').getAttribute('aria-invalid'),
        disabled: document.querySelector('#submitOrderButton').disabled,
      })`);
      assert(state.invalid === 'true' && state.disabled, 'Invalid phone number was not blocked.');
      return page;
    });

    for (const [name, query, expected] of [
      ['missing operator blocks submission', '?test=missing-operator', 'operatör'],
      ['missing subscription blocks submission', '?test=missing-subscription', 'abonnemang'],
    ]) {
      await test(name, async () => {
        const page = await createPage(debugBase, { query });
        await fillValidForm(page);
        await page.evaluate(`document.querySelector('#checkoutForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))`);
        const message = await page.evaluate(`document.querySelector('#checkoutMessage').textContent`);
        assert(message.toLowerCase().includes(expected), `Expected the message to mention ${expected}.`);
        return page;
      });
    }

    for (const [name, query] of [
      ['missing operator agreement PDF blocks submission', '?test=missing-pdf'],
      ['failed operator agreement PDF blocks submission', '?test=failed-pdf'],
      ['missing Dealett terms blocks submission', '?test=missing-dealett-terms'],
    ]) {
      await test(name, async () => {
        const page = await createPage(debugBase, { query });
        const status = await page.evaluate(`document.querySelector('#documentStatus').textContent`);
        const disabled = await page.evaluate(`document.querySelector('#submitOrderButton').disabled`);
        assert(status.includes('kunde inte hämtas') && disabled, 'Missing documents did not block the order.');
        return page;
      });
    }

    await test('legal documents are linked directly in the agreement confirmations', async () => {
      const page = await createPage(debugBase);
      const state = await page.evaluate(`(() => {
        const links = [...document.querySelectorAll('.agreement-confirmations .agreement-inline-link')];
        const linkColor = links[0] ? getComputedStyle(links[0]).color : '';
        const copyColor = getComputedStyle(document.querySelector('#operatorAgreementLabel')).color;
        return {
          hasDuplicateConditionsSection: Boolean(document.querySelector('#conditionsTitle')),
          hasDuplicateAgreementActions: Boolean(document.querySelector('#agreementActions')),
          linkCount: links.length,
          linkText: links.map((link) => link.textContent.trim()),
          popupLinkCount: links.filter((link) => link.hasAttribute('data-document-view')).length,
          newTabLinkCount: links.filter((link) => link.hasAttribute('target')).length,
          linkColor,
          copyColor,
        };
      })()`);
      assert(!state.hasDuplicateConditionsSection, 'The duplicate conditions section still exists.');
      assert(!state.hasDuplicateAgreementActions, 'The duplicate agreement action links still exist.');
      assert(state.linkCount === 7, `Expected 7 inline legal links, got ${state.linkCount}.`);
      assert(
        state.linkText.includes('Dealetts förmedlings- och presentkortsvillkor') &&
        state.linkText.includes('Dealetts integritetspolicy') &&
        state.linkText.includes('informationen om ångerrätt'),
        'One or more legal documents are not linked from their confirmation text.'
      );
      assert(state.popupLinkCount === state.linkCount, 'One or more legal links do not use the same-page popup.');
      assert(state.newTabLinkCount === 0, 'A legal link still opens directly in a new tab.');
      assert(state.linkColor !== state.copyColor, 'Legal links are not visually distinguished from the surrounding text.');
      return page;
    });

    await test('operator PDF opens in the accessible viewer', async () => {
      const page = await createPage(debugBase);
      const state = await page.evaluate(`(() => {
        document.querySelector('[data-document-view]').click();
        const dialog = document.querySelector('#documentDialog');
        return {
          open: dialog.open,
          frame: dialog.querySelector('iframe').getAttribute('src'),
          download: dialog.querySelector('[data-document-download]').getAttribute('href'),
          hasNewTabAction: Boolean(dialog.querySelector('[data-document-new-tab]')),
          confirmationChecked: document.querySelector('input[name="operatorAgreement"]').checked,
        };
      })()`);
      assert(state.open, 'The document dialog did not open.');
      assert(state.frame.endsWith('.pdf'), 'The PDF was not loaded in the viewer.');
      assert(state.download === state.frame, 'The download action does not point to the original PDF.');
      assert(!state.hasNewTabAction, 'The popup still offers a new-tab action.');
      assert(!state.confirmationChecked, 'Opening a document incorrectly accepted the agreement.');
      return page;
    });

    await test('Dealett terms open in the same-page document popup', async () => {
      const page = await createPage(debugBase);
      const state = await page.evaluate(`(() => {
        const link = document.querySelector('#dealettTermsLabel .agreement-inline-link');
        link.click();
        const dialog = document.querySelector('#documentDialog');
        return {
          open: dialog.open,
          frame: dialog.querySelector('iframe').getAttribute('src'),
          title: document.querySelector('#documentDialogTitle').textContent,
          confirmationChecked: document.querySelector('input[name="dealettTerms"]').checked,
        };
      })()`);
      assert(state.open, 'The same-page document popup did not open.');
      assert(state.frame.endsWith('villkor.html'), 'The popup did not load Dealett terms.');
      assert(state.title.includes('Dealetts förmedlings- och presentkortsvillkor'), 'The popup title is wrong.');
      assert(!state.confirmationChecked, 'Opening Dealett terms incorrectly accepted the agreement.');
      return page;
    });

    await test('selected gift card renders placeholder value', async () => {
      const page = await createPage(debugBase, {
        item: makeItem({ rewards: { Apollo: 99999 }, rewardTotal: 99999 }),
        checkout: { startDate: 'snarast', phoneNumbers: [] },
      });
      const text = await bodyText(page);
      assert(
        text.includes('Apollo') && normalizeSpaces(text).includes('XXX kr') && !normalizeSpaces(text).includes('99 999'),
        'Gift-card information is missing.'
      );
      return page;
    });

    await test('order without a gift card shows placeholder value', async () => {
      const page = await createPage(debugBase, {
        item: makeItem({ rewards: {}, rewardTotal: 0 }),
        checkout: { startDate: 'snarast', phoneNumbers: [] },
      });
      const text = await bodyText(page);
      assert(text.includes('Presentkort') && normalizeSpaces(text).includes('XXX kr'), 'Missing gift card placeholder rendered unclearly.');
      return page;
    });

    await test('summary uses one real monthly price', async () => {
      const page = await createPage(debugBase, { item: makeItem() });
      const text = await page.evaluate(`document.querySelector('#orderSummary').innerText`);
      assert(text.includes('Under 24 månader') && text.includes('629 kr/mån'), 'Monthly price period is wrong.');
      assert(!/kampanj|därefter|Månad 1/i.test(text), 'Temporary campaign copy should not be shown.');
      return page;
    });

    await test('subscription without binding time is supported', async () => {
      const page = await createPage(debugBase, {
        item: makeItem({
          price: 299,
          monthlyPrice: 299,
          regularMonthlyPrice: 299,
          bindingMonths: 0,
          minimumTotalCost: 299,
        }),
        checkout: { startDate: 'snarast', phoneNumbers: [] },
      });
      const text = await page.evaluate(`document.querySelector('#orderSummary').innerText`);
      assert(text.includes('Ingen bindningstid'), 'No-binding subscription is not described.');
      return page;
    });

    await test('24-month binding and optional invoice fee calculate correctly', async () => {
      const page = await createPage(debugBase);
      const text = await page.evaluate(`document.querySelector('#orderSummary').innerText`);
      assert(text.includes('24 månaders bindningstid'), 'Binding period is missing.');
      assert(normalizeSpaces(text).includes('15 096 kr'), 'Minimum total is wrong.');
      assert(!text.includes('14 112'), 'Optional invoice fees were included in the minimum total.');
      return page;
    });

    await test('new number and number transfer are distinguished', async () => {
      const newNumberPage = await createPage(debugBase, {
        item: makeItem(),
        checkout: { startDate: 'snarast', phoneNumbers: [] },
      });
      const newNumberText = await newNumberPage.evaluate(`document.querySelector('#orderSummary').innerText`);
      newNumberPage.close();

      const transferPage = await createPage(debugBase, {
        item: makeItem(),
        checkout: { startDate: 'snarast', phoneNumbers: ['0701111111'] },
      });
      const transferText = await transferPage.evaluate(`document.querySelector('#orderSummary').innerText`);
      assert(newNumberText.includes('Nytt nummer'), 'New number is not shown.');
      assert(transferText.includes('Behåll befintligt nummer'), 'Number transfer is not shown.');
      return transferPage;
    });

    await test('double submission starts only one BankID flow', async () => {
      const page = await createPage(debugBase);
      await fillValidForm(page);
      const starts = await page.evaluate(`(async () => {
        window.__bankIdStarts = 0;
        window.DealettBankId.open = () => { window.__bankIdStarts += 1; };
        const form = document.querySelector('#checkoutForm');
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 30));
        return window.__bankIdStarts;
      })()`);
      assert(starts === 1, `BankID started ${starts} times.`);
      return page;
    });

    await test('BankID cancellation allows a safe retry', async () => {
      const page = await createPage(debugBase);
      await fillValidForm(page);
      const state = await page.evaluate(`(async () => {
        window.DealettBankId.open = ({ onCancel }) => onCancel();
        document.querySelector('#checkoutForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 30));
        return {
          message: document.querySelector('#checkoutMessage').textContent,
          disabled: document.querySelector('#submitOrderButton').disabled,
        };
      })()`);
      assert(state.message.includes('avbröt') && !state.disabled, 'Cancellation did not restore a safe retry.');
      return page;
    });

    await test('backend failure is shown without a fake success', async () => {
      const page = await createPage(debugBase);
      await fillValidForm(page);
      const state = await page.evaluate(`(async () => {
        window.DealettBankId.open = ({ onComplete }) => onComplete({
          simulated: false,
          orderRef: 'test-order',
          signature: { id: 'test-signature', signedAt: new Date().toISOString() },
        });
        window.DealettNetwork.fetchJson = async () => { throw new Error('Backend nere'); };
        document.querySelector('#checkoutForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 30));
        return {
          message: document.querySelector('#checkoutMessage').textContent,
          resultHidden: document.querySelector('#checkoutResult').hidden,
        };
      })()`);
      assert(state.message.includes('Backend nere') && state.resultHidden, 'A backend failure looked like success.');
      return page;
    });

    await test('agreement payload contains versions, timestamps and optional consent state', async () => {
      const page = await createPage(debugBase);
      await fillValidForm(page);
      const payload = await page.evaluate(`(async () => {
        window.DealettBankId.open = ({ onComplete }) => onComplete({
          simulated: true,
          orderRef: 'test-order',
          signature: { id: 'test-signature', signedAt: new Date().toISOString() },
        });
        window.DealettNetwork.fetchJson = async (_url, options) => {
          window.__storedPayload = JSON.parse(options.body);
          return { orderReference: 'TEST-REFERENCE' };
        };
        document.querySelector('#checkoutForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 40));
        return window.__storedPayload;
      })()`);
      const agreement = payload.agreement;
      assert(agreement.operatorDocuments.version, 'Operator document version is missing.');
      assert(agreement.dealettDocuments.termsVersion, 'Dealett terms version is missing.');
      assert(agreement.confirmations.operatorAgreement.acceptedAt, 'Confirmation timestamp is missing.');
      assert(agreement.marketingConsent.accepted === false, 'Optional consent state is wrong.');
      assert(agreement.finalSubmissionTimestamp, 'Submission timestamp is missing.');
      return page;
    });

    await test('keyboard controls are semantic and reachable', async () => {
      const page = await createPage(debugBase);
      const state = await page.evaluate(`(() => {
        const controls = [...document.querySelectorAll('a[href], button, input')];
        return {
          count: controls.length,
          nonSemanticClickTargets: [...document.querySelectorAll('[onclick]')]
            .filter((node) => !['A', 'BUTTON', 'INPUT'].includes(node.tagName)).length,
          unlabeledInputs: [...document.querySelectorAll('#checkoutForm input')]
            .filter((input) => !input.labels?.length).length,
        };
      })()`);
      assert(state.count > 10, 'Expected interactive controls were not found.');
      assert(state.nonSemanticClickTargets === 0, 'Non-semantic click targets were found.');
      assert(state.unlabeledInputs === 0, 'An input is missing a label.');
      return page;
    });

    await test('mobile layout has no horizontal overflow', async () => {
      const page = await createPage(debugBase, { width: 390, height: 844 });
      const state = await page.evaluate(`({
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        fullWidthButton: Math.round(document.querySelector('#submitOrderButton').getBoundingClientRect().width),
      })`);
      assert(state.scrollWidth === state.width, 'The mobile page scrolls horizontally.');
      assert(state.fullWidthButton >= 340, 'The mobile primary button is not full width.');
      return page;
    });

    await test('long names and missing optional values remain stable', async () => {
      const page = await createPage(debugBase, {
        width: 390,
        height: 844,
        item: makeItem({
          operator: 'Operatören med ett ovanligt långt namn',
          title: 'Obegränsat familjeabonnemang med extra lång benämning',
          invoiceFee: null,
          noticePeriodMonths: null,
          startFee: null,
          rewards: { 'Presentkortsleverantören med långt namn': 75000 },
          rewardTotal: 75000,
        }),
        checkout: { startDate: 'snarast', phoneNumbers: [] },
      });
      const state = await page.evaluate(`({
        text: document.body.innerText,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      })`);
      assert(!state.overflow, 'Long names caused horizontal overflow.');
      assert(!/\b(?:undefined|null|NaN)\b/.test(state.text), 'A missing optional value leaked into the UI.');
      return page;
    });

    const failures = results.filter((result) => result.status === 'failed');
    console.log(JSON.stringify({
      passed: results.length - failures.length,
      failed: failures.length,
      results,
    }, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally {
    chrome.kill();
    fs.rmSync(userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 8,
      retryDelay: 150,
    });
  }
};

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
