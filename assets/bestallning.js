(() => {
  const params = new URLSearchParams(window.location.search);
  document.body.classList.toggle('bestallning-embedded', params.get('embedded') === '1');
  const currency = new Intl.NumberFormat('sv-SE');
  const nowIso = () => new Date().toISOString();

  const els = {
    form: document.querySelector('#checkoutForm'),
    email: document.querySelector('#checkoutEmail'),
    phone: document.querySelector('#checkoutPhone'),
    emailError: document.querySelector('#emailError'),
    phoneError: document.querySelector('#phoneError'),
    orderSummary: document.querySelector('#orderSummary'),
    mobileSummaryPrice: document.querySelector('#mobileSummaryPrice'),
    summaryToggle: document.querySelector('.checkout-summary-toggle'),
    deliveryDetails: document.querySelector('#deliveryDetails'),
    paymentDetails: document.querySelector('#paymentDetails'),
    giftCardSection: document.querySelector('#giftCardSection'),
    giftCardDetails: document.querySelector('#giftCardDetails'),
    operatorAgreementLabel: document.querySelector('#operatorAgreementLabel'),
    dealettTermsLabel: document.querySelector('#dealettTermsLabel'),
    withdrawalLabel: document.querySelector('#withdrawalLabel'),
    privacyPolicyLabel: document.querySelector('#privacyPolicyLabel'),
    documentStatus: document.querySelector('#documentStatus'),
    paymentObligation: document.querySelector('#paymentObligation'),
    submitButton: document.querySelector('#submitOrderButton'),
    submitLabel: document.querySelector('[data-submit-label]'),
    message: document.querySelector('#checkoutMessage'),
    result: document.querySelector('#checkoutResult'),
    resultKicker: document.querySelector('#checkoutResultKicker'),
    resultTitle: document.querySelector('#checkoutResultTitle'),
    resultText: document.querySelector('#checkoutResultText'),
    documentDialog: document.querySelector('#documentDialog'),
    documentDialogTitle: document.querySelector('#documentDialogTitle'),
    documentFrame: document.querySelector('[data-document-frame]'),
    documentDownload: document.querySelector('[data-document-download]'),
  };

  const operatorDocumentDefaults = {
    telenor: {
      generalTermsUrl: 'https://www.telenor.se/support/priser-villkor-och-blanketter/villkor-och-blanketter',
      specialTermsUrl: 'https://www.telenor.se/support/priser-villkor-och-blanketter/villkor-och-blanketter',
      priceListUrl: 'https://www.telenor.se/support/priser-villkor-och-blanketter/prislistor',
      withdrawalInformationUrl: 'https://www.telenor.se/support/priser-villkor-och-blanketter/reklamation-angerratt-och-oppet-kop',
    },
    telia: {
      generalTermsUrl: 'https://www.telia.se/om/villkor',
      specialTermsUrl: 'https://www.telia.se/om/villkor',
      priceListUrl: 'https://www.telia.se/support/kopinformation',
      withdrawalInformationUrl: 'https://www.telia.se/support/kopinformation',
    },
    tre: {
      generalTermsUrl: 'https://www.tre.se/support/kopinformation/avtal-angerratt',
      specialTermsUrl: 'https://www.tre.se/support/kopinformation/avtal-angerratt',
      priceListUrl: 'https://www.tre.se/support/kopinformation',
      withdrawalInformationUrl: 'https://www.tre.se/support/kopinformation/avtal-angerratt',
    },
    tele2: {
      generalTermsUrl: 'https://www.tele2.se/support/betalning/avtalsvillkor-blanketter',
      specialTermsUrl: 'https://www.tele2.se/support/betalning/avtalsvillkor-blanketter',
      priceListUrl: 'https://www.tele2.se/support/betalning/avtalsvillkor-blanketter',
      withdrawalInformationUrl: 'https://www.tele2.se/support/betalning/angerratt',
    },
  };

  const dealettDocuments = {
    mediationAndGiftCardTermsUrl: 'villkor.html',
    privacyPolicyUrl: 'integritetspolicy.html',
    withdrawalInformationUrl: 'angerratt.html',
    termsVersion: '2026-07-28',
    privacyVersion: '2026-07-28',
    withdrawalVersion: '2026-07-28',
  };

  const developmentFixture = {
    cartItemId: 'telenor-reference-order',
    offerId: 'telenor-obegansat-plus-reference',
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
    deliveryType: 'SIM-kort',
    rewards: { 'ICA Maxi': 4000 },
    rewardTotal: 4000,
  };

  const readJson = (storage, key, fallback) => {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeSessionJson = (key, value) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // The checkout remains usable even when browser storage is unavailable.
    }
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const slugify = (value) => String(value || '')
    .toLowerCase()
    .replace(/\u00e5/g, 'a')
    .replace(/\u00e4/g, 'a')
    .replace(/\u00f6/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const formatCurrency = (value) => currency.format(Math.max(Number(value) || 0, 0));

  const createId = (prefix) => {
    if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  const rawCart = readJson(localStorage, 'dealettCart', []);
  const storedCart = Array.isArray(rawCart)
    ? (window.DealettCart?.normalizeCart?.(rawCart) || rawCart)
    : [];
  const checkout = readJson(sessionStorage, 'dealettCheckout',
    readJson(localStorage, 'dealettCheckout', {}));
  const usesDevelopmentFixture = storedCart.length === 0;
  const cart = usesDevelopmentFixture ? [developmentFixture] : storedCart;
  const primaryItem = cart[cart.length - 1] || developmentFixture;

  const numericValue = (...values) => {
    const match = values.find((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
    return match === undefined ? 0 : Number(match);
  };

  const getGiftCards = (item) => {
    const rewards = item.rewards && typeof item.rewards === 'object' ? item.rewards : {};
    const entries = Object.entries(rewards)
      .map(([provider, value]) => ({ provider, value: Math.max(Number(value) || 0, 0) }))
      .filter((entry) => entry.value > 0);

    if (entries.length) return entries;

    const rewardTotal = Math.max(Number(item.rewardTotal) || 0, 0);
    return rewardTotal ? [{ provider: 'Valt presentkort', value: rewardTotal }] : [];
  };

  const buildOrder = (item) => {
    const operator = params.get('test') === 'missing-operator' ? '' : String(item.operator || item.provider || '').trim();
    const subscription = params.get('test') === 'missing-subscription'
      ? ''
      : String(item.title || item.name || item.data || '').trim();
    const itemPrice = numericValue(item.price, item.monthlyPrice, item.finalPrice);
    const currentMonthlyPrice = itemPrice;
    const regularMonthlyPrice = currentMonthlyPrice;
    const bindingMonths = Math.max(numericValue(item.bindingMonths, item.binding), 0);
    const startFee = Math.max(numericValue(item.startFee, item.setupFee), 0);
    const invoiceFee = Math.max(numericValue(item.invoiceFee), 0);
    const commitmentMonths = bindingMonths > 0 ? bindingMonths : 1;
    const calculatedMinimumTotal = (currentMonthlyPrice * commitmentMonths) + startFee;
    const phoneNumbers = Array.isArray(checkout.phoneNumbers) ? checkout.phoneNumbers.filter(Boolean) : [];
    const numberHandling = checkout.numberHandling || (
      phoneNumbers.length ? 'number_transfer' : 'new_number'
    );

    return {
      operator,
      operatorSlug: slugify(operator),
      subscription,
      logo: item.logo || '',
      data: item.data || item.surf || (Number(item.dataAmount) >= 999 ? 'Obegränsad surf' : ''),
      productType: item.productType || 'mobile',
      currentMonthlyPrice,
      regularMonthlyPrice: regularMonthlyPrice || currentMonthlyPrice,
      bindingMonths,
      noticePeriodMonths: Math.max(numericValue(item.noticePeriodMonths), 0),
      startFee,
      invoiceFee,
      invoiceFeeOptional: item.invoiceFeeOptional !== false,
      minimumTotalCost: Math.max(
        numericValue(item.minimumTotalCost, item.totalCostFirst24Months),
        calculatedMinimumTotal
      ),
      giftCards: getGiftCards(item),
      giftCardValue: getGiftCards(item).reduce((total, gift) => total + gift.value, 0),
      deliveryType: item.deliveryType || (item.esim ? 'eSIM' : 'SIM-kort'),
      startDate: checkout.startDate || (usesDevelopmentFixture ? 'snarast' : ''),
      numberHandling,
      transferredNumberCount: phoneNumbers.length,
      persons: Math.max(numericValue(item.persons), 1),
      offerId: item.offerId || item.id || '',
      item,
    };
  };

  const order = buildOrder(primaryItem);
  const orderId = checkout.orderId || createId('DEALETT');
  const sessionId = checkout.sessionId || createId('session');
  const confirmationTimestamps = {
    operatorAgreement: null,
    dealettTerms: null,
    withdrawalInformation: null,
    privacyPolicy: null,
    marketingConsent: null,
  };

  let documentsReady = false;
  let submissionInProgress = false;
  let orderSubmitted = Boolean(checkout.finalSubmissionTimestamp);
  let contactTouched = false;

  const isReferenceOrder = usesDevelopmentFixture &&
    order.operatorSlug === 'telenor' &&
    order.subscription.toLowerCase().includes('obegränsat plus');

  const buildOperatorDocuments = () => {
    const configured = operatorDocumentDefaults[order.operatorSlug] || {};
    const supplied = order.item.operatorDocuments || {};
    const referenceDocuments = isReferenceOrder ? {
      agreementSummaryUrl: 'documents/telenor/avtalssammanfattning-test.pdf',
      fullAgreementUrl: 'documents/telenor/avtalssammanfattning-test.pdf',
      version: '2026-07-28-test',
      documentId: 'telenor-reference-summary-2026-07-28',
    } : {};

    const documents = {
      ...configured,
      ...referenceDocuments,
      ...supplied,
      agreementSummaryUrl: supplied.agreementSummaryUrl || supplied.summaryUrl ||
        referenceDocuments.agreementSummaryUrl || '',
      fullAgreementUrl: supplied.fullAgreementUrl ||
        referenceDocuments.fullAgreementUrl || '',
      version: supplied.version || referenceDocuments.version || '',
      documentId: supplied.documentId || referenceDocuments.documentId || '',
    };

    if (params.get('test') === 'missing-pdf') {
      documents.agreementSummaryUrl = '';
    }

    if (params.get('test') === 'failed-pdf') {
      documents.agreementSummaryUrl = 'documents/telenor/dokument-saknas.pdf';
    }

    return documents;
  };

  const operatorDocuments = buildOperatorDocuments();

  if (params.get('test') === 'missing-dealett-terms') {
    dealettDocuments.mediationAndGiftCardTermsUrl = '';
  }

  const getNumberHandlingLabel = () => {
    if (order.numberHandling === 'number_transfer') {
      const count = order.transferredNumberCount || order.persons;
      return count === 1 ? 'Behåll befintligt nummer' : `Flytta ${count} befintliga nummer`;
    }

    return order.persons > 1 ? `${order.persons} nya nummer` : 'Nytt nummer';
  };

  const getBindingLabel = () => (
    order.bindingMonths > 0 ? `${order.bindingMonths} månaders bindningstid` : 'Ingen bindningstid'
  );

  const getNoticeLabel = () => {
    if (!order.noticePeriodMonths) return 'Enligt operatörens villkor';
    if (order.noticePeriodMonths === 1) return '30 dagar';
    return `${order.noticePeriodMonths} månader`;
  };

  const getPricePeriods = () => {
    return [{
      label: order.bindingMonths > 0 ? `Under ${order.bindingMonths} månader` : 'Månadspris',
      monthlyPrice: order.currentMonthlyPrice,
    }];
  };

  const renderSummary = () => {
    const pricePeriods = getPricePeriods();
    const logo = order.logo
      ? `<img src="${escapeHtml(order.logo)}" alt="${escapeHtml(order.operator)}" />`
      : `<span class="summary-operator-fallback">${escapeHtml(order.operator.slice(0, 2).toUpperCase())}</span>`;
    const giftMarkup = order.giftCards.length
      ? [
        '<div class="summary-gift">',
        '  <p class="summary-gift-kicker">Ditt presentkort</p>',
        '  <div class="summary-gift-list">',
        ...order.giftCards.map((gift) => [
          '    <div class="summary-gift-row">',
          `      <span>${escapeHtml(gift.provider)}</span>`,
          '      <strong>XXX kr</strong>',
          '    </div>',
        ].join('')),
        '  </div>',
        '  <p class="summary-gift-note">Tillhandahålls och skickas av Dealett när villkoren är uppfyllda.</p>',
        '</div>',
      ].join('')
      : [
        '<div class="summary-gift">',
        '  <p class="summary-gift-kicker">Ditt presentkort</p>',
        '  <div class="summary-gift-list">',
        '    <div class="summary-gift-row">',
        '      <span>Presentkort</span>',
        '      <strong>XXX kr</strong>',
        '    </div>',
        '  </div>',
        '  <p class="summary-gift-note">Tillhandahålls och skickas av Dealett när villkoren är uppfyllda.</p>',
        '</div>',
      ].join('');
    const calculationText = order.bindingMonths > 0
      ? `Vi räknar månadspriset under hela bindningstiden och lägger till obligatoriska startavgifter. En valbar fakturaavgift ingår inte.`
      : 'Vi räknar en månadsavgift och lägger till obligatoriska startavgifter. Löpande och valbara avgifter ingår inte.';

    els.orderSummary.innerHTML = [
      '<div class="summary-product">',
      `  <div class="summary-operator-logo">${logo}</div>`,
      '  <div>',
      '    <p class="summary-product-type">Mobilabonnemang</p>',
      `    <h3>${escapeHtml(order.operator)} ${escapeHtml(order.subscription)}</h3>`,
      order.data ? `    <p>${escapeHtml(order.data)}</p>` : '',
      `    <p>${escapeHtml(getBindingLabel())}</p>`,
      `    <p>${escapeHtml(getNumberHandlingLabel())}</p>`,
      '  </div>',
      '</div>',
      '<hr class="summary-divider" />',
      '<div class="summary-price-heading">',
      '  <span>Månadskostnad</span>',
      `  <strong>${formatCurrency(order.currentMonthlyPrice)} kr/mån</strong>`,
      '</div>',
      '<div class="summary-price-periods">',
      ...pricePeriods.map((period) => [
        '  <div class="summary-price-period">',
        `    <span>${escapeHtml(period.label)}</span>`,
        `    <strong>${formatCurrency(period.monthlyPrice)} kr/mån</strong>`,
        '  </div>',
      ].join('')),
      '</div>',
      '<details class="summary-details">',
      '  <summary>Visa detaljer</summary>',
      '  <div class="summary-details-body">',
      `    <div class="summary-details-row"><span>Månadspris</span><strong>${formatCurrency(order.regularMonthlyPrice)} kr/mån</strong></div>`,
      `    <div class="summary-details-row"><span>Startavgift</span><strong>${order.startFee ? `${formatCurrency(order.startFee)} kr` : '0 kr'}</strong></div>`,
      `    <div class="summary-details-row"><span>Fakturaavgift</span><strong>${order.invoiceFee ? `${formatCurrency(order.invoiceFee)} kr${order.invoiceFeeOptional ? ', kan undvikas' : ''}` : 'Ingen angiven'}</strong></div>`,
      `    <div class="summary-details-row"><span>Bindningstid</span><strong>${escapeHtml(getBindingLabel())}</strong></div>`,
      `    <div class="summary-details-row"><span>Uppsägningstid</span><strong>${escapeHtml(getNoticeLabel())}</strong></div>`,
      '  </div>',
      '</details>',
      '<hr class="summary-divider" />',
      '<div class="summary-total-line">',
      '  <span>Minsta totalkostnad</span>',
      `  <strong>${formatCurrency(order.minimumTotalCost)} kr</strong>`,
      '</div>',
      '<details class="summary-calculation">',
      '  <summary>Så har vi räknat</summary>',
      `  <p>${escapeHtml(calculationText)}</p>`,
      '</details>',
      '<hr class="summary-divider" />',
      giftMarkup,
    ].join('');

    els.mobileSummaryPrice.textContent = `${formatCurrency(order.currentMonthlyPrice)} kr/mån`;
  };

  const renderDeliveryAndPayment = () => {
    const deliveryCopy = order.deliveryType.toLowerCase() === 'esim'
      ? 'Aktiveringsinformationen skickas digitalt efter operatörens godkännande.'
      : 'Skickas till din folkbokföringsadress efter operatörens godkännande.';
    const invoiceCopy = order.invoiceFee > 0
      ? `En fakturaavgift på ${formatCurrency(order.invoiceFee)} kr kan tillkomma. Digital faktura eller autogiro kan ge andra villkor.`
      : 'Fakturan skickas digitalt när detta är möjligt. Eventuell fakturaavgift framgår av operatörens prislista.';

    els.deliveryDetails.innerHTML = [
      '<div class="delivery-row">',
      `  <strong>${escapeHtml(order.deliveryType)}</strong>`,
      `  <p>${escapeHtml(deliveryCopy)}</p>`,
      '</div>',
    ].join('');

    els.paymentDetails.innerHTML = [
      '<div class="payment-copy">',
      `  <p>Betalning sker till ${escapeHtml(order.operator || 'operatören')} via faktura.</p>`,
      `  <p>${escapeHtml(invoiceCopy)}</p>`,
      `  <p class="responsibility-copy">Dealett tar inte betalt för abonnemanget. Månadsavgiften faktureras av ${escapeHtml(order.operator || 'operatören')}.</p>`,
      '</div>',
    ].join('');
  };

  const renderGiftCard = () => {
    if (!order.giftCards.length) {
      els.giftCardDetails.innerHTML = [
        '<div class="gift-card-heading">',
        '  <span>Ditt presentkort tillhandahålls av Dealett.</span>',
        '  <strong>XXX kr</strong>',
        '</div>',
        '<p>Slutligt presentkortsbelopp bekräftas när Dealett har fastställt presentkortsreglerna.</p>',
      ].join('');
      return;
    }

    const email = els.email?.value.trim();
    const destination = email
      ? `Det skickas digitalt till ${escapeHtml(email)}.`
      : 'Det skickas digitalt till mejladressen i beställningen.';

    els.giftCardDetails.innerHTML = [
      '<div class="gift-card-heading">',
      '  <span>Ditt valda presentkort tillhandahålls av Dealett.</span>',
      '  <strong>XXX kr</strong>',
      '</div>',
      '<div class="gift-card-list">',
      ...order.giftCards.map((gift) => [
        `  <div class="gift-card-item${order.giftCards.length === 1 ? ' gift-card-item--single' : ''}">`,
        `    <span>${order.giftCards.length === 1 ? 'Presentkort: ' : ''}${escapeHtml(gift.provider)}</span>`,
        order.giftCards.length > 1 ? '    <strong>XXX kr</strong>' : '',
        '  </div>',
      ].join('')),
      '</div>',
      `<p>${destination}</p>`,
      '<p>Presentkortet skickas när operatören har godkänt och slutligt bekräftat abonnemanget, ångerfristen har löpt ut och beställningen inte har ångrats, avslagits eller annullerats.</p>',
      '<p>När samtliga villkor är uppfyllda skickar Dealett presentkortet inom 10 arbetsdagar.</p>',
    ].join('');
  };

  const inlineDocumentLink = ({ title, label = title, url }) => {
    if (!url) {
      return `<span class="agreement-inline-missing">${escapeHtml(label)} saknas</span>`;
    }

    return [
      `<a class="agreement-inline-link" href="${escapeHtml(url)}"`,
      ` data-document-view data-document-title="${escapeHtml(title)}">`,
      `${escapeHtml(label)}</a>`,
    ].join('');
  };

  const renderLegalSections = () => {
    const operatorName = order.operator || 'operatören';

    els.operatorAgreementLabel.innerHTML = [
      'Jag har tagit del av ',
      inlineDocumentLink({
        title: `${operatorName}s avtalssammanfattning`,
        label: `${operatorName}s avtalssammanfattning`,
        url: operatorDocuments.agreementSummaryUrl,
      }),
      ' samt ',
      inlineDocumentLink({
        title: `${operatorName}s allmänna villkor`,
        label: 'allmänna villkor',
        url: operatorDocuments.generalTermsUrl,
      }),
      ', ',
      inlineDocumentLink({
        title: `${operatorName}s särskilda villkor`,
        label: 'särskilda villkor',
        url: operatorDocuments.specialTermsUrl,
      }),
      ' och ',
      inlineDocumentLink({
        title: `${operatorName}s prislista`,
        label: 'prislista',
        url: operatorDocuments.priceListUrl,
      }),
      ` och vill ingå abonnemangsavtalet med ${escapeHtml(operatorName)}.`,
    ].join('');

    els.dealettTermsLabel.innerHTML = [
      'Jag accepterar ',
      inlineDocumentLink({
        title: 'Dealetts förmedlings- och presentkortsvillkor',
        url: dealettDocuments.mediationAndGiftCardTermsUrl,
      }),
      '.',
    ].join('');

    els.withdrawalLabel.innerHTML = [
      'Jag har tagit del av ',
      inlineDocumentLink({
        title: 'Information om ångerrätt',
        label: 'informationen om ångerrätt',
        url: dealettDocuments.withdrawalInformationUrl,
      }),
      ` och förstår att ångerrätten för abonnemanget utövas gentemot ${escapeHtml(operatorName)}.`,
    ].join('');

    els.privacyPolicyLabel.innerHTML = [
      'Jag har tagit del av ',
      inlineDocumentLink({
        title: 'Dealetts integritetspolicy',
        url: dealettDocuments.privacyPolicyUrl,
      }),
      '.',
    ].join('');

    els.paymentObligation.textContent =
      `Beställningen innebär betalningsskyldighet gentemot ${operatorName}.`;
  };

  const setFieldState = (field, valid, errorText, showError) => {
    const input = field === 'email' ? els.email : els.phone;
    const error = field === 'email' ? els.emailError : els.phoneError;
    const wrapper = document.querySelector(`[data-field-wrap="${field}"]`);

    input.setAttribute('aria-invalid', showError && !valid ? 'true' : 'false');
    wrapper?.classList.toggle('is-valid', valid);
    error.textContent = showError && !valid ? errorText : '';
  };

  const isEmailValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

  const isSwedishMobileValid = (value) => {
    const compact = String(value || '').replace(/[\s()-]/g, '');
    return /^07\d{8}$/.test(compact) || /^\+467\d{8}$/.test(compact) || /^00467\d{8}$/.test(compact);
  };

  const validateContact = ({ showErrors = false } = {}) => {
    const email = els.email.value.trim();
    const phone = els.phone.value.trim();
    const emailValid = isEmailValid(email);
    const phoneValid = isSwedishMobileValid(phone);

    setFieldState(
      'email',
      emailValid,
      email ? 'Kontrollera att mejladressen är rätt skriven.' : 'Fyll i din mejladress.',
      showErrors
    );
    setFieldState(
      'phone',
      phoneValid,
      phone ? 'Ange ett svenskt mobilnummer, till exempel 070 123 45 67.' : 'Fyll i ditt mobilnummer.',
      showErrors
    );

    return emailValid && phoneValid;
  };

  const getRequiredConfirmations = () => (
    [...document.querySelectorAll('[data-required-confirmation]')]
  );

  const allRequiredConfirmationsAccepted = () => (
    getRequiredConfirmations().every((input) => input.checked)
  );

  const getOrderValidation = () => ({
    operator: Boolean(order.operator),
    subscription: Boolean(order.subscription),
    price: order.currentMonthlyPrice > 0,
    startDate: Boolean(order.startDate),
  });

  const isOrderValid = () => Object.values(getOrderValidation()).every(Boolean);

  const setMessage = (text, { focus = false, type = 'error' } = {}) => {
    els.message.textContent = text;
    els.message.classList.toggle('is-info', Boolean(text) && type === 'info');
    if (focus && text) els.message.focus();
  };

  const updateSubmitState = () => {
    const canSubmit = (
      validateContact({ showErrors: contactTouched }) &&
      isOrderValid() &&
      documentsReady &&
      allRequiredConfirmationsAccepted() &&
      !submissionInProgress &&
      !orderSubmitted
    );

    els.submitButton.disabled = !canSubmit;
  };

  const isLocalDocument = (url) => {
    try {
      return new URL(url, window.location.href).origin === window.location.origin;
    } catch {
      return false;
    }
  };

  const checkDocument = async (url) => {
    if (!url) return false;
    if (!isLocalDocument(url)) return true;

    try {
      if (window.DealettNetwork?.fetchWithTimeout) {
        await window.DealettNetwork.fetchWithTimeout(url, {
          method: 'HEAD',
          timeoutMs: 5000,
          label: 'Avtalsdokument',
        });
      } else {
        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  const verifyDocuments = async () => {
    els.documentStatus.className = 'document-status';
    els.documentStatus.textContent = 'Kontrollerar att avtalsdokumenten går att öppna...';

    const requiredDocuments = [
      operatorDocuments.agreementSummaryUrl,
      operatorDocuments.generalTermsUrl,
      operatorDocuments.specialTermsUrl,
      operatorDocuments.priceListUrl,
      dealettDocuments.mediationAndGiftCardTermsUrl,
      dealettDocuments.privacyPolicyUrl,
      dealettDocuments.withdrawalInformationUrl,
    ];
    const results = await Promise.all(requiredDocuments.map(checkDocument));
    const documentMetadataReady = Boolean(
      operatorDocuments.documentId &&
      operatorDocuments.version &&
      dealettDocuments.termsVersion
    );
    documentsReady = results.every(Boolean) && documentMetadataReady;

    if (documentsReady) {
      els.documentStatus.className = 'document-status is-ready';
      els.documentStatus.textContent = 'Alla dokument är tillgängliga.';
    } else {
      els.documentStatus.className = 'document-status is-error';
      els.documentStatus.textContent =
        'Avtalsdokumentet kunde inte hämtas. Försök igen innan du slutför beställningen.';
    }

    updateSubmitState();
  };

  const saveCheckoutDraft = (extra = {}) => {
    writeSessionJson('dealettCheckout', {
      ...checkout,
      cart: storedCart.length ? storedCart : cart,
      contact: {
        email: els.email.value.trim(),
        phone: els.phone.value.trim(),
      },
      orderId,
      sessionId,
      startDate: order.startDate,
      numberHandling: order.numberHandling,
      updatedAt: nowIso(),
      developmentFixture: usesDevelopmentFixture,
      ...extra,
    });
  };

  const buildAgreementPayload = (submittedAt) => {
    const pricePeriods = getPricePeriods().map((period) => ({
      fromMonth: 1,
      toMonth: null,
      monthlyPrice: period.monthlyPrice,
      label: period.label,
    }));
    const marketingInput = document.querySelector('input[name="marketingConsent"]');

    return {
      orderId,
      sessionId,
      operator: {
        name: order.operator,
        slug: order.operatorSlug,
      },
      subscription: {
        offerId: order.offerId || null,
        name: order.subscription,
        data: order.data || null,
      },
      pricing: {
        currentMonthlyPrice: order.currentMonthlyPrice,
        laterMonthlyPrice: order.currentMonthlyPrice,
        pricePeriods,
        bindingMonths: order.bindingMonths,
        noticePeriodMonths: order.noticePeriodMonths,
        startFee: order.startFee,
        invoiceFee: order.invoiceFee,
        invoiceFeeOptional: order.invoiceFeeOptional,
        minimumTotalCost: order.minimumTotalCost,
      },
      startDate: order.startDate,
      numberHandling: {
        type: order.numberHandling,
        lineCount: order.persons,
        transferredNumberCount: order.transferredNumberCount,
      },
      giftCards: order.giftCards.map((gift) => ({
        provider: gift.provider,
        value: gift.value,
        suppliedBy: 'Dealett',
      })),
      operatorDocuments: {
        agreementSummaryUrl: operatorDocuments.agreementSummaryUrl,
        fullAgreementUrl: operatorDocuments.fullAgreementUrl || null,
        generalTermsUrl: operatorDocuments.generalTermsUrl,
        specialTermsUrl: operatorDocuments.specialTermsUrl,
        priceListUrl: operatorDocuments.priceListUrl,
        withdrawalInformationUrl: operatorDocuments.withdrawalInformationUrl,
        version: operatorDocuments.version || null,
        documentId: operatorDocuments.documentId || null,
      },
      dealettDocuments: { ...dealettDocuments },
      confirmations: {
        operatorAgreement: {
          accepted: true,
          acceptedAt: confirmationTimestamps.operatorAgreement,
        },
        dealettTerms: {
          accepted: true,
          acceptedAt: confirmationTimestamps.dealettTerms,
        },
        withdrawalInformation: {
          accepted: true,
          acceptedAt: confirmationTimestamps.withdrawalInformation,
        },
        privacyPolicy: {
          acknowledged: true,
          acknowledgedAt: confirmationTimestamps.privacyPolicy,
        },
      },
      marketingConsent: {
        accepted: Boolean(marketingInput?.checked),
        recordedAt: confirmationTimestamps.marketingConsent,
      },
      finalSubmissionTimestamp: submittedAt,
      testMode: usesDevelopmentFixture,
    };
  };

  const startBankIdOrder = (orderPayload) => new Promise((resolve, reject) => {
    if (!window.DealettBankId?.open) {
      const error = new Error('BankID-integrationen är inte tillgänglig.');
      error.code = 'bankid_unavailable';
      reject(error);
      return;
    }

    window.DealettBankId.open({
      intent: 'sign',
      title: 'Signera beställningen',
      description: `Kontrollera uppgifterna och signera avtalet med ${order.operator}.`,
      userVisibleData: `${order.operator} ${order.subscription}, ${formatCurrency(order.currentMonthlyPrice)} kr per månad. Betalningsskyldighet uppstår gentemot ${order.operator}.`,
      payload: {
        agreement: orderPayload,
        customerContact: {
          email: els.email.value.trim(),
          phone: els.phone.value.trim(),
        },
      },
      onComplete: resolve,
      onCancel() {
        const error = new Error('Du avbröt BankID. Ingen beställning har skickats.');
        error.code = 'bankid_cancelled';
        reject(error);
      },
      onError(error) {
        const bankIdError = error || new Error('BankID kunde inte slutföras.');
        bankIdError.code = bankIdError.code || 'bankid_failed';
        reject(bankIdError);
      },
    });
  });

  const postOrder = async (payload) => {
    if (!window.DealettNetwork?.fetchJson) {
      throw new Error('Ordertjänsten är inte tillgänglig.');
    }

    return window.DealettNetwork.fetchJson('https://db-qtmd.onrender.com/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeoutMs: 8000,
      label: 'Beställningen',
    });
  };

  const showResult = ({ simulated, reference }) => {
    els.form.hidden = true;
    els.result.hidden = false;

    if (simulated) {
      els.resultKicker.textContent = 'Lokalt testläge';
      els.resultTitle.textContent = 'Testsigneringen är klar';
      els.resultText.textContent =
        `Avtalsunderlaget sparades som en utvecklingsorder med referens ${reference}. Ingen riktig beställning har skickats till ${order.operator}.`;
    } else {
      els.resultKicker.textContent = 'Beställningen är mottagen';
      els.resultTitle.textContent = 'Tack, vi har tagit emot din beställning';
      els.resultText.textContent =
        `Din referens är ${reference}. ${order.operator} behandlar nu abonnemanget och Dealett följer upp presentkortet när villkoren är uppfyllda.`;
    }

    els.result.focus?.();
    window.scrollTo({ top: els.result.offsetTop - 120, behavior: 'smooth' });
  };

  const setSubmitting = (isSubmitting) => {
    submissionInProgress = isSubmitting;
    els.submitButton.classList.toggle('is-loading', isSubmitting);
    els.submitLabel.textContent = isSubmitting
      ? 'Startar BankID...'
      : 'Godkänn och beställ med BankID';
    updateSubmitState();
  };

  const focusFirstProblem = () => {
    if (!validateContact({ showErrors: true })) {
      const target = !isEmailValid(els.email.value.trim()) ? els.email : els.phone;
      target.focus();
      return;
    }

    const missingConfirmation = getRequiredConfirmations().find((input) => !input.checked);
    if (missingConfirmation) {
      missingConfirmation.focus();
      return;
    }

    els.message.focus();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submissionInProgress || orderSubmitted) return;

    contactTouched = true;
    updateSubmitState();

    if (!isOrderValid()) {
      const validation = getOrderValidation();
      const missing = Object.entries(validation).find(([, valid]) => !valid)?.[0] || 'order';
      const missingLabels = {
        operator: 'operatör',
        subscription: 'abonnemang',
        price: 'ett giltigt pris',
        startDate: 'startdatum',
        order: 'orderuppgifter',
      };
      setMessage(`Beställningen saknar ${missingLabels[missing]}. Kontrollera varukorgen innan du fortsätter.`, { focus: true });
      return;
    }

    if (!documentsReady) {
      setMessage('Avtalsdokumenten måste vara tillgängliga innan du kan beställa.', { focus: true });
      return;
    }

    if (!validateContact({ showErrors: true }) || !allRequiredConfirmationsAccepted()) {
      setMessage('Kontrollera kontaktuppgifterna och bekräfta alla obligatoriska delar.');
      focusFirstProblem();
      return;
    }

    setMessage('');
    setSubmitting(true);
    const submittedAt = nowIso();
    const agreementPayload = buildAgreementPayload(submittedAt);

    try {
      const bankIdResult = await startBankIdOrder(agreementPayload);
      const simulated = Boolean(bankIdResult?.simulated);
      const storedOrder = await postOrder({
        status: simulated ? 'development_signed' : 'submitted',
        testMode: simulated || usesDevelopmentFixture,
        agreement: agreementPayload,
        bankId: {
          simulated,
          orderRef: bankIdResult?.orderRef || null,
          signatureId: bankIdResult?.signature?.id || null,
          signedAt: bankIdResult?.signature?.signedAt || submittedAt,
        },
      });

      orderSubmitted = true;
      saveCheckoutDraft({
        agreement: agreementPayload,
        finalSubmissionTimestamp: submittedAt,
        orderReference: storedOrder.orderReference,
        bankId: {
          simulated,
          signedAt: bankIdResult?.signature?.signedAt || submittedAt,
        },
      });
      showResult({
        simulated,
        reference: storedOrder.orderReference || orderId,
      });
    } catch (error) {
      if (error.code === 'bankid_cancelled') {
        setMessage(error.message);
      } else {
        setMessage(
          error.message || 'Beställningen kunde inte slutföras. Försök igen om en stund.',
          { focus: true }
        );
      }
    } finally {
      if (!orderSubmitted) setSubmitting(false);
    }
  };

  const openDocument = (link) => {
    const url = link.getAttribute('href');
    if (!url || url === '#') return;

    els.documentDialogTitle.textContent = link.dataset.documentTitle || 'Avtalsdokument';
    els.documentFrame.src = url;
    els.documentDownload.href = url;
    els.documentDownload.hidden = !isLocalDocument(url);

    if (typeof els.documentDialog.showModal === 'function') {
      els.documentDialog.showModal();
    } else {
      window.open(url, '_blank', 'noopener');
    }
  };

  const closeDocument = () => {
    els.documentFrame.src = 'about:blank';
    els.documentDialog.close();
  };

  const bindEvents = () => {
    els.summaryToggle?.addEventListener('click', () => {
      const expanded = els.summaryToggle.getAttribute('aria-expanded') === 'true';
      els.summaryToggle.setAttribute('aria-expanded', String(!expanded));
    });

    [els.email, els.phone].forEach((input) => {
      input.addEventListener('input', () => {
        contactTouched = true;
        validateContact({ showErrors: true });
        if (input === els.email) renderGiftCard();
        saveCheckoutDraft();
        updateSubmitState();
      });
      input.addEventListener('blur', () => {
        contactTouched = true;
        validateContact({ showErrors: true });
        updateSubmitState();
      });
    });

    const checkAllAgreements = document.querySelector('[data-check-all-agreements]');
    let syncingAllAgreements = false;
    checkAllAgreements?.addEventListener('change', () => {
      const shouldCheckAll = checkAllAgreements.checked;
      syncingAllAgreements = true;
      document.querySelectorAll('#checkoutForm input[type="checkbox"]:not([data-check-all-agreements])').forEach((input) => {
        if (input.checked === shouldCheckAll) return;
        input.checked = shouldCheckAll;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      syncingAllAgreements = false;
      checkAllAgreements.checked = shouldCheckAll;
    });

    document.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.addEventListener('change', () => {
        confirmationTimestamps[input.name] = input.checked ? nowIso() : null;
        if (!syncingAllAgreements && input !== checkAllAgreements && checkAllAgreements) {
          checkAllAgreements.checked = [...document.querySelectorAll('#checkoutForm input[type="checkbox"]:not([data-check-all-agreements])')]
            .every((agreementInput) => agreementInput.checked);
        }
        saveCheckoutDraft();
        setMessage('');
        updateSubmitState();
      });
    });

    document.addEventListener('click', (event) => {
      const documentLink = event.target.closest('[data-document-view]');
      if (documentLink) {
        event.preventDefault();
        openDocument(documentLink);
        return;
      }

      if (event.target.closest('[data-close-document]')) {
        closeDocument();
      }
    });

    els.documentDialog?.addEventListener('click', (event) => {
      if (event.target === els.documentDialog) closeDocument();
    });

    els.documentDialog?.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDocument();
    });

    els.form?.addEventListener('submit', handleSubmit);
  };

  const initialize = () => {
    const contact = checkout.contact || {};
    els.email.value = contact.email || '';
    els.phone.value = contact.phone || '';

    renderSummary();
    renderDeliveryAndPayment();
    renderGiftCard();
    renderLegalSections();
    validateContact();
    bindEvents();
    if (params.get('summary') === 'expanded') {
      els.summaryToggle?.setAttribute('aria-expanded', 'true');
    }
    saveCheckoutDraft();
    updateSubmitState();
    verifyDocuments();

    if (usesDevelopmentFixture) {
      setMessage(
        'Utvecklingsorder: fyll i testuppgifter för att prova flödet. Ingen riktig operatörsbeställning skickas.',
        { type: 'info' }
      );
    }
  };

  initialize();
})();
