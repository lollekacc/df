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
  logo: 'images/telenor.svg',
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

const makeStorageScript = ({ item, items, checkout, conversation, attribution, environmentDemoMode = false } = {}) => `(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (url.endsWith('/api/public/v1/environment')) {
      return new Response(JSON.stringify({ demoMode: ${environmentDemoMode} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return originalFetch(input, options);
  };
  if (sessionStorage.getItem('__dealettFunctionalInitialized') === 'true') return;
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem('__dealettFunctionalInitialized', 'true');
  ${Array.isArray(items)
    ? `localStorage.setItem('dealettCart', JSON.stringify(${JSON.stringify(items)}));`
    : item
      ? `localStorage.setItem('dealettCart', JSON.stringify([${JSON.stringify(item)}]));`
      : ''}
  ${checkout ? `sessionStorage.setItem('dealettCheckout', JSON.stringify(${JSON.stringify(checkout)}));` : ''}
  ${conversation ? `sessionStorage.setItem('dealettChatConversationV3', JSON.stringify(${JSON.stringify(conversation)})); sessionStorage.setItem('dealettChatSessionId', ${JSON.stringify(conversation.conversationId)});` : ''}
  ${attribution ? `sessionStorage.setItem('dealettAttributionV1', JSON.stringify(${JSON.stringify(attribution)}));` : ''}
})()`;

const createPage = async (debugBase, {
  pathName = 'bestallning.html',
  query = '',
  item = makeItem(),
  items = null,
  checkout = { startDate: 'snarast', phoneNumbers: [] },
  conversation = null,
  attribution = null,
  environmentDemoMode = false,
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
    source: makeStorageScript({ item, items, checkout, conversation, attribution, environmentDemoMode }),
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

    await test('ordinary live catalog item remains blocked without approved operator documents', async () => {
      const page = await createPage(debugBase, {
        item: makeItem({ operatorDocuments: null }),
        environmentDemoMode: false,
      });
      await fillValidForm(page);
      const state = await page.evaluate(`({
        disabled: document.querySelector('#submitOrderButton').disabled,
        status: document.querySelector('#documentStatus').textContent,
        operatorCopy: document.querySelector('#operatorAgreementLabel').textContent,
      })`);
      assert(state.disabled, 'Live checkout accepted a catalog item without approved operator documents.');
      assert(state.status.includes('kunde inte hämtas'), 'Live checkout did not explain the missing document block.');
      assert(!/fiktiv demo/i.test(state.operatorCopy), 'Live checkout used a demo document without a server demo signal.');
      return page;
    });

    await test('server-confirmed demo mode uses only clearly fictional operator documents', async () => {
      const page = await createPage(debugBase, {
        item: makeItem({ operatorDocuments: null }),
        environmentDemoMode: true,
      });
      await fillValidForm(page);
      const state = await page.evaluate(`(async () => {
        const beforeSubmit = {
          disabled: document.querySelector('#submitOrderButton').disabled,
          status: document.querySelector('#documentStatus').textContent,
          operatorCopy: document.querySelector('#operatorAgreementLabel').textContent,
          paymentCopy: document.querySelector('#paymentObligation').textContent,
          documentUrl: document.querySelector('#operatorAgreementLabel [data-document-view]')?.getAttribute('href'),
        };
        window.DealettBankId.open = ({ onComplete }) => onComplete({
          simulated: false,
          orderRef: 'demo-environment-order',
          signature: { id: 'demo-environment-signature', signedAt: new Date().toISOString() },
        });
        window.DealettNetwork.fetchJson = async (url, options) => {
          if (url !== '/api/public/v1/orders') throw new Error('Unexpected request: ' + url);
          window.__demoOrderPayload = JSON.parse(options.body);
          return { orderReference: 'DEMO-ENVIRONMENT-REFERENCE' };
        };
        document.querySelector('#checkoutForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 60));
        return {
          beforeSubmit,
          payload: window.__demoOrderPayload,
          result: document.querySelector('#checkoutResult').innerText,
        };
      })()`);
      assert(!state.beforeSubmit.disabled, 'Server-confirmed demo mode did not enable the fictional checkout.');
      assert(/fiktivt demoläge/i.test(state.beforeSubmit.status), 'Demo document status was not explicit.');
      assert(/fiktiva demoöversikten/i.test(state.beforeSubmit.operatorCopy), 'Demo consent copy was not explicit.');
      assert(/ingen riktig beställning eller betalningsskyldighet/i.test(state.beforeSubmit.paymentCopy), 'Demo payment warning was missing.');
      assert(state.beforeSubmit.documentUrl === 'demo-avtalssammanfattning.html', 'Demo checkout did not use the fictional document.');
      assert(state.payload.testMode && state.payload.agreement.testMode, 'Server demo mode was not retained in the order evidence.');
      assert(state.payload.bankId.simulated, 'Server demo mode was incorrectly downgraded by BankID result data.');
      assert(state.payload.agreement.operatorDocuments.demoOnly, 'Demo document evidence was not marked demo-only.');
      assert(
        state.payload.agreement.operatorDocuments.documentId === 'fictional-demo-telenor-summary' &&
        state.payload.agreement.operatorDocuments.version === 'fictional-demo-v1',
        'Demo document ID/version were not explicit.'
      );
      assert(/lokalt testläge/i.test(state.result), 'Accepted demo order was not visibly labelled as a test.');
      return page;
    });

    await test('distinct offers are blocked before signing or order submission', async () => {
      const page = await createPage(debugBase, {
        items: [
          makeItem({ cartItemId: 'multi-offer-one', offerId: 'functional-offer-one' }),
          makeItem({
            cartItemId: 'multi-offer-two',
            offerId: 'functional-offer-two',
            operator: 'Tele2',
            title: 'Obegränsat Extra',
          }),
        ],
      });
      await fillValidForm(page);
      const state = await page.evaluate(`(async () => {
        window.__blockedBankIdStarts = 0;
        window.__blockedOrderRequests = 0;
        window.DealettBankId.open = () => { window.__blockedBankIdStarts += 1; };
        window.DealettNetwork.fetchJson = async () => {
          window.__blockedOrderRequests += 1;
          return { orderReference: 'SHOULD-NOT-EXIST' };
        };
        document.querySelector('#checkoutForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 30));
        return {
          disabled: document.querySelector('#submitOrderButton').disabled,
          status: document.querySelector('#documentStatus').textContent,
          message: document.querySelector('#checkoutMessage').textContent,
          bankIdStarts: window.__blockedBankIdStarts,
          orderRequests: window.__blockedOrderRequests,
        };
      })()`);
      assert(state.disabled, 'Distinct offers unexpectedly enabled checkout.');
      assert(/ett erbjudande i taget/i.test(state.status), 'The multi-offer document blocker is not truthful.');
      assert(/flera olika erbjudanden eller operatörer/i.test(state.message), 'Programmatic submission did not explain the multi-offer block.');
      assert(state.bankIdStarts === 0 && state.orderRequests === 0, 'A blocked multi-offer cart reached BankID or the order API.');
      return page;
    });

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
      assert(payload.conversationId === null, 'No-chat checkout sent an unowned client conversation ID.');
      assert(payload.conversationToken === null, 'No-chat checkout sent a conversation token.');
      assert(payload.conversationSnapshot === null, 'No-chat checkout sent an empty archive snapshot.');
      assert(agreement.conversationId === null, 'Legacy agreement compatibility leaked an unowned conversation ID.');
      return page;
    });

    await test('public order capture links transcript, attribution and every subscription', async () => {
      const conversation = {
        version: 3,
        conversationId: 'dealett-conversation-11111111-1111-4111-8111-111111111111',
        sessionId: 'dealett-conversation-11111111-1111-4111-8111-111111111111',
        conversationToken: 'opaque-conversation-token',
        createdAt: new Date().toISOString(),
        updatedAt: Date.now(),
        messageCount: 2,
        droppedMessageCount: 0,
        transcriptTruncated: false,
        messages: [
          {
            messageId: 'dealett-message-11111111-1111-4111-8111-111111111111',
            sequence: 1,
            role: 'user',
            content: 'Jag behöver två abonnemang.',
            createdAt: new Date().toISOString(),
            language: 'sv',
          },
          {
            messageId: 'dealett-message-22222222-2222-4222-8222-222222222222',
            sequence: 2,
            role: 'assistant',
            content: 'Här är rekommendationen.',
            createdAt: new Date().toISOString(),
            language: 'sv',
            structuredContent: { offerCards: [{ planId: 'functional-offer' }] },
            metadata: { model: 'test-model' },
          },
        ],
      };
      const attribution = {
        version: 1,
        capturedAt: new Date().toISOString(),
        landingPage: '/index.html',
        referrer: 'https://example.test/start',
        utm: { source: 'functional-test' },
        clickIds: {},
      };
      const items = [
        makeItem({
          cartItemId: 'functional-item-one',
          offerId: 'functional-offer',
          source: 'homepage-quiz',
          answers: { currentOperator: 'Telia', usage: 'high' },
          qualification: { peopleCount: 1, readyForOffer: true },
          offerCalculation: { planId: 'functional-offer', options: [{ planId: 'alternative-one' }] },
        }),
        makeItem({
          cartItemId: 'functional-item-two',
          offerId: 'functional-offer',
          source: 'chat-recommendation',
          answers: { currentOperator: 'Tre', usage: 'medium' },
          qualification: { peopleCount: 1, readyForOffer: true },
          offerCalculation: { planId: 'functional-offer', options: [{ planId: 'alternative-two' }] },
        }),
      ];
      const page = await createPage(debugBase, {
        items,
        checkout: {
          startDate: 'snarast',
          phoneNumbers: ['0701111111', '0702222222'],
          sourcePage: { title: 'Startsida', path: '/index.html' },
        },
        conversation,
        attribution,
      });
      await fillValidForm(page, { marketing: true });
      const capture = await page.evaluate(`(async () => {
        window.DealettBankId.open = ({ onComplete }) => onComplete({
          simulated: false,
          orderRef: 'bankid-order-reference',
          signature: { id: 'signature-id', signedAt: new Date().toISOString() },
          user: { name: 'Test Kund', personalNumberMasked: '19******-****' },
        });
        window.DealettNetwork.fetchJson = async (url, options) => {
          window.__publicOrderRequest = { url, options, payload: JSON.parse(options.body) };
          return {
            order: {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              orderNumber: 'DEALETT-2026-000001',
              createdAt: new Date().toISOString(),
              testMode: false,
            },
          };
        };
        document.querySelector('#checkoutForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 80));
        return {
          request: window.__publicOrderRequest,
          resultHidden: document.querySelector('#checkoutResult').hidden,
        };
      })()`);
      const { request } = capture;
      const payload = request.payload;
      assert(request.url === '/api/public/v1/orders', `Wrong order endpoint: ${request.url}`);
      assert(request.options.headers['Idempotency-Key'] === payload.clientOrderId, 'Idempotency header and client order ID differ.');
      assert(payload.orderId === payload.clientOrderId, 'Backend-compatible order ID alias is missing.');
      assert(payload.contact.email === 'kund@example.se', 'Customer email is missing from the order capture.');
      assert(payload.contact.phone === '070 123 45 67', 'Customer phone is missing from the order capture.');
      assert(payload.customer.email === payload.contact.email && payload.customer.phone === payload.contact.phone, 'Customer fields do not match the public API contract.');
      assert(payload.selectedOfferId === 'functional-offer', 'The authoritative selected offer ID is missing.');
      assert(payload.cartItems.length === 2 && payload.subscriptions.length === 2, 'Not every cart item became a subscription snapshot.');
      assert(payload.participants.length === 2, 'Participant snapshots are incomplete.');
      assert(
        payload.participants[0].numberHandling === 'number_transfer' && payload.participants[0].requestedActivationDate,
        'Participant number handling or activation date is not compatible with the public API.'
      );
      assert(payload.portedNumbers.join(',') === '0701111111,0702222222', 'Ported numbers are incomplete.');
      assert(payload.phoneNumbers.join(',') === payload.portedNumbers.join(','), 'Backend-compatible phone number alias is missing.');
      assert(payload.questionnaire.answersBySubscription['functional-item-one'].answers.usage === 'high', 'Questionnaire answers are missing.');
      assert(payload.questionnaire.peopleCount === 1 && payload.qualification.peopleCount === 1, 'Primary qualification is not exposed to authoritative quote calculation.');
      assert(payload.recommendation.selections[1].calculation.planId === 'functional-offer', 'Recommendation calculation is missing.');
      assert(payload.calculation.planId === 'functional-offer', 'Primary calculation is not exposed to the public API.');
      assert(payload.calculation.outputs.planId === 'functional-offer', 'Calculation is not retained through the backend evidence allowlist.');
      assert(payload.cartItems.every((item) => item.source && typeof item.source === 'object'), 'Per-line source metadata is not backend-compatible.');
      assert(payload.consentEvidence.confirmations.operatorAgreement.acceptedAt, 'Consent evidence is incomplete.');
      assert(payload.consentEvidence.evidenceId && payload.consentEvidence.confirmationMethod, 'Consent capture metadata is incomplete.');
      assert(payload.agreement.operatorDocuments.planId === payload.selectedOfferId, 'Operator documents are not linked to the selected plan.');
      assert(payload.attribution.utm.source === 'functional-test', 'Attribution is missing.');
      assert(payload.source.checkoutPage === '/bestallning.html' && payload.source.originatingPage === '/index.html', 'Attribution source paths are not normalized strings.');
      assert(payload.conversationId === conversation.conversationId, 'Conversation ID was not linked.');
      assert(payload.conversationToken === conversation.conversationToken, 'Conversation token was not linked.');
      assert(payload.conversationSnapshot.messages.length === 2, 'Recovery transcript was not captured.');
      assert(payload.conversationSnapshot.messages[1].structuredContent.offerCards[0].planId === 'functional-offer', 'Structured assistant content was not retained.');
      assert(payload.conversationSnapshot.messages[1].model === 'test-model', 'Assistant model metadata is not compatible with conversation archival.');
      assert(payload.conversationSnapshot.totalMessageCount === 2, 'Conversation total message count alias is missing.');
      assert(payload.agreement.orderId === payload.clientOrderId, 'Legacy agreement compatibility was lost.');
      assert(!capture.resultHidden, 'Success was not shown after durable acceptance.');
      return page;
    });

    await test('signed submission retries the same payload and idempotency key without another BankID flow', async () => {
      const page = await createPage(debugBase);
      await fillValidForm(page);
      const state = await page.evaluate(`(async () => {
        window.__bankIdStarts = 0;
        window.__orderRequests = [];
        window.DealettBankId.open = ({ onComplete }) => {
          window.__bankIdStarts += 1;
          onComplete({
            simulated: true,
            orderRef: 'retry-bankid-order',
            signature: { id: 'retry-signature', signedAt: new Date().toISOString() },
          });
        };
        window.DealettNetwork.fetchJson = async (url, options) => {
          window.__orderRequests.push({
            url,
            key: options.headers['Idempotency-Key'],
            body: options.body,
          });
          if (window.__orderRequests.length === 1) throw new Error('Svar saknas efter signering');
          return { orderReference: 'RETRY-REFERENCE', testMode: true };
        };
        const form = document.querySelector('#checkoutForm');
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 70));
        const pendingAfterFailure = JSON.parse(sessionStorage.getItem('dealettCheckout') || '{}').pendingOrderSubmission;
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 70));
        const checkout = JSON.parse(sessionStorage.getItem('dealettCheckout') || '{}');
        return {
          bankIdStarts: window.__bankIdStarts,
          requests: window.__orderRequests,
          pendingAfterFailure,
          pendingAfterSuccess: checkout.pendingOrderSubmission,
          resultHidden: document.querySelector('#checkoutResult').hidden,
          resultText: document.querySelector('#checkoutResult').innerText,
        };
      })()`);
      assert(state.bankIdStarts === 1, `BankID started ${state.bankIdStarts} times.`);
      assert(state.requests.length === 2, `Expected two order attempts, got ${state.requests.length}.`);
      assert(state.requests[0].key === state.requests[1].key, 'Retry changed the idempotency key.');
      assert(state.requests[0].body === state.requests[1].body, 'Retry changed the signed payload.');
      assert(state.pendingAfterFailure?.payload, 'Signed payload was not persisted after an unknown response.');
      assert(state.pendingAfterSuccess === null, 'Pending signed payload was not cleared after acceptance.');
      assert(!state.resultHidden && /lokalt testläge/i.test(state.resultText), 'Simulated retry was not labelled truthfully.');
      return page;
    });

    await test('chat recovery keeps stable message records while model context stays at ten', async () => {
      const page = await createPage(debugBase);
      const chatState = await page.evaluate(`(async () => {
        window.__chatRequests = [];
        window.DealettNetwork.fetchJson = async (url, options) => {
          if (url !== '/api/chat') throw new Error('Unexpected request: ' + url);
          const request = JSON.parse(options.body);
          window.__chatRequests.push(request);
          const turn = window.__chatRequests.length;
          const simulated = turn === 12;
          return {
            source: simulated ? 'demo-simulated' : 'openai',
            simulated,
            reply: 'Assistent svar ' + turn,
            conversationToken: 'opaque-chat-token',
            messageMetadata: {
              id: '00000000-0000-4000-8000-' + String(turn).padStart(12, '0'),
              sequence: request.clientMessage.sequence + 1,
              createdAt: new Date().toISOString(),
              model: 'test-chat-model',
            },
            qualification: { peopleCount: 1, readyForOffer: false },
            offerCalculation: { planId: 'plan-' + turn },
            flowState: { version: 1, inProgress: true },
            quickReplies: [{ label: 'Fortsätt', message: 'Fortsätt' }],
            offerCards: [],
          };
        };
        window.DealettChat.open();
        const form = document.querySelector('.dealett-chat-form');
        const input = document.querySelector('.dealett-chat-input');
        for (let index = 1; index <= 12; index += 1) {
          input.value = 'Kundmeddelande ' + index;
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
        const startedAt = Date.now();
        while (window.__chatRequests.length < 12 && Date.now() - startedAt < 3000) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
        const conversation = JSON.parse(sessionStorage.getItem('dealettChatConversationV3') || 'null');
        return {
          requests: window.__chatRequests,
          conversation,
          demoLabels: [...document.querySelectorAll('.dealett-chat-simulation-label')]
            .map((item) => item.textContent.trim()),
          status: document.querySelector('[data-chat-status]')?.textContent.trim(),
          recoveryHasToken: Object.prototype.hasOwnProperty.call(
            window.DealettChat.getRecoverySnapshot(),
            'conversationToken'
          ),
        };
      })()`);
      const { conversation, requests } = chatState;
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      assert(uuidPattern.test(conversation.conversationId), 'Conversation ID is not a stable UUID.');
      assert(conversation.conversationToken === 'opaque-chat-token', 'Conversation token was not persisted.');
      assert(conversation.messages.length === 25, `Expected 25 recovery messages, got ${conversation.messages.length}.`);
      assert(new Set(conversation.messages.map((message) => message.messageId)).size === 25, 'Message IDs are not unique.');
      assert(conversation.messages.every((message) => uuidPattern.test(message.messageId)), 'Client message IDs are not UUIDs.');
      assert(
        conversation.messages.every((message, index) => message.sequence === index + 1 && message.createdAt),
        'Message sequence or timestamps are not stable.'
      );
      assert(requests[0].conversationToken === null, 'The initial chat request unexpectedly sent a token.');
      assert(requests[1].conversationToken === 'opaque-chat-token', 'A subsequent chat request omitted its token.');
      assert(requests.every((request) => request.messages.length <= 10), 'More than ten messages were sent as model context.');
      assert(requests.at(-1).messages.length === 10, 'The final model context did not retain the latest ten messages.');
      const lastAssistant = conversation.messages.at(-1);
      assert(lastAssistant.metadata.model === 'test-chat-model', 'Assistant model metadata was not retained.');
      assert(
        lastAssistant.metadata.source === 'demo-simulated' && lastAssistant.metadata.simulated === true,
        'Explicit demo metadata was not retained.'
      );
      assert(lastAssistant.structuredContent.offerCalculation.planId === 'plan-12', 'Structured assistant data was not retained.');
      assert(chatState.demoLabels.length === 1 && /simulerat/i.test(chatState.demoLabels[0]), 'Demo response was not visibly labelled.');
      assert(/demoläge/i.test(chatState.status), 'Chat status did not disclose demo mode.');
      assert(!chatState.recoveryHasToken, 'Recovery snapshot exposed the conversation token.');

      const loaded = page.waitForEvent('Page.loadEventFired');
      await page.send('Page.reload');
      await loaded;
      await delay(900);
      const recovered = await page.evaluate(`({
        storedCount: JSON.parse(sessionStorage.getItem('dealettChatConversationV3') || '{}').messages?.length || 0,
        renderedCount: document.querySelectorAll('.dealett-chat-message').length,
        demoLabelCount: document.querySelectorAll('.dealett-chat-simulation-label').length,
      })`);
      assert(recovered.storedCount === 25, 'Reload discarded recovery messages.');
      assert(recovered.renderedCount === 25, 'Reload did not hydrate the recovery transcript.');
      assert(recovered.demoLabelCount === 1, 'Reload lost the simulated-response label.');
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
