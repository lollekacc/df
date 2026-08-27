(() => {
  const els = {
    cartSummaryContainer: document.querySelector('#cartSummaryContainer'),
    cartCheckoutBtn: document.querySelector('#cartCheckoutBtn'),
    contactSection: document.querySelector('#contactSection'),
    contactEmail: document.querySelector('#contactEmail'),
    contactPhone: document.querySelector('#contactPhone'),
    contactContinueBtn: document.querySelector('#contactContinueBtn'),
    contactMessage: document.querySelector('#contactMessage'),
    numberSection: document.querySelector('#numberSection'),
    phoneInputsContainer: document.querySelector('#phoneInputsContainer'),
    confirmNumbersBtn: document.querySelector('#confirmNumbersBtn'),
    numberMessage: document.querySelector('#numberMessage'),
    startDateSection: document.querySelector('#startDateSection'),
    startDateOptions: document.querySelector('#startDateOptions'),
    startDateText: document.querySelector('#startDateText'),
    startDateValue: document.querySelector('#startDateValue'),
    startDateWarning: document.querySelector('#startDateWarning'),
    termsReviewContainer: document.querySelector('#termsReviewContainer'),
    goToSignBtn: document.querySelector('#goToSignBtn'),
    signMessage: document.querySelector('#signMessage')
  };

  const currency = new Intl.NumberFormat('sv-SE');
  const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const providerAccents = {
    telia: '#6E2380',
    telenor: '#00437E',
    tre: '#E65C00',
    tele2: '#003A6E'
  };

  const homepageOffers = {
    'telia-home-unlimited-4': {
      offerId: 'telia-home-unlimited-4',
      operator: 'Telia',
      logo: 'images/telia.png'
    },
    'telenor-home-unlimited-4': {
      offerId: 'telenor-home-unlimited-4',
      operator: 'Telenor',
      logo: 'images/telenor.jpg'
    },
    'tre-home-unlimited-4': {
      offerId: 'tre-home-unlimited-4',
      operator: 'Tre',
      logo: 'images/tre.jpg'
    },
    'tele2-home-unlimited-4': {
      offerId: 'tele2-home-unlimited-4',
      operator: 'Tele2',
      logo: 'images/tele2.png'
    }
  };

  const combinedLegalConsentKey = 'checkoutTerms';

  const operatorDocumentLinks = {
    telia: {
      summaryUrl: '',
      termsUrl: '',
    },
    telenor: {
      summaryUrl: '',
      termsUrl: '',
    },
    tre: {
      summaryUrl: '',
      termsUrl: '',
    },
    tele2: {
      summaryUrl: '',
      termsUrl: '',
    },
  };

  const dealettLegalDocument = {
    id: 'dealett-forformedling-presentkort-2026-07',
    title: 'Dealetts f\u00f6rmedlings- och presentkortsvillkor',
    version: '2026-07',
  };

  let cart = [];
  let selectedStartDate = '';
  let signingComplete = false;

  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const readSessionJson = (key, fallback) => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage failures so the checkout UI remains usable.
    }
  };

  const writeSessionJson = (key, value) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
      localStorage.removeItem(key);
    } catch {
      // Ignore storage failures so the checkout UI remains usable.
    }
  };

  const removeStorage = (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage failures so the checkout UI remains usable.
    }
  };

  const removeSessionStorage = (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore storage failures so the checkout UI remains usable.
    }
  };

  const removeCheckoutStorage = () => {
    removeStorage('dealettCheckout');
    removeSessionStorage('dealettCheckout');
  };

  const readCheckout = () => {
    const checkout = readSessionJson('dealettCheckout', null);
    if (checkout) return checkout;

    const legacyCheckout = readJson('dealettCheckout', null);
    if (legacyCheckout) {
      removeStorage('dealettCheckout');
      return legacyCheckout;
    }

    return {};
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const getSelectedOperators = () => [...new Set(
    cart
      .map((item) => String(item.operator || '').trim())
      .filter((operator) => operator && operator.toLowerCase() !== 'dealett')
  )];

  const createOperatorDocumentSnapshot = () => getSelectedOperators().map((operator) => {
    const slug = slugProvider(operator);
    const documents = operatorDocumentLinks[slug] || {};

    return {
      operator,
      summaryUrl: documents.summaryUrl || null,
      termsUrl: documents.termsUrl || null,
    };
  });

  const getLegalAcceptance = (acceptedAt = null) => {
    const allAccepted = Boolean(
      els.termsReviewContainer?.querySelector(`[data-legal-consent="${combinedLegalConsentKey}"]`)?.checked
    );

    return {
      operatorAgreement: false,
      operatorAgreementHandledSeparately: true,
      dealettTerms: allAccepted,
      privacyPolicy: allAccepted,
      withdrawalInfo: allAccepted,
      allAccepted,
      acceptedAt: allAccepted ? acceptedAt : null,
      documents: {
        operatorDocuments: createOperatorDocumentSnapshot(),
        dealettDocument: dealettLegalDocument,
        withdrawalInfoVersion: 'checkout-2026-07',
      },
    };
  };

  const areLegalConsentsAccepted = () => getLegalAcceptance().allAccepted;

  const formatCurrency = (value) => (
    window.DealettCart?.formatCurrency(value) || currency.format(Math.max(Number(value) || 0, 0))
  );

  const slugProvider = (operator) => String(operator || '')
    .toLowerCase()
    .replace(/\u00e5/g, 'a')
    .replace(/\u00e4/g, 'a')
    .replace(/\u00f6/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const getAccent = (operator) => window.DealettCart?.getAccent(operator) || providerAccents[slugProvider(operator)] || '#da392b';

  const sumRewards = (rewards) => {
    if (!rewards || typeof rewards !== 'object') return 0;
    return Object.values(rewards).reduce((sum, value) => sum + Math.max(Number(value) || 0, 0), 0);
  };

  const getHomepageOfferFromQuery = () => {
    const offerId = new URLSearchParams(window.location.search).get('offer');
    const offer = homepageOffers[offerId];

    if (!offer) return null;

    return {
      ...offer,
      cartItemId: `${offer.offerId}-${Date.now()}`,
      title: '4 abonnemang',
      data: 'Obegr\u00e4nsad surf',
      dataAmount: 9999,
      persons: 4,
      rewardTotal: 4000,
      rewardMixLabel: 'Presentkort: XXX kr',
      rewards: { Presentkort: 4000 },
      features: ['Obegr\u00e4nsad surf', 'Samtal & SMS ing\u00e5r', '5G & eSIM']
    };
  };

  const getDataLabel = (item) => {
    if (item.data) return item.data;
    if (item.surf) return item.surf;

    const dataAmount = Number(item.dataAmount) || 0;
    if (dataAmount >= 999) return 'Obegr\u00e4nsad surf';
    if (dataAmount > 0) return `${dataAmount} GB surf`;

    return 'Mobilabonnemang';
  };

  const getPersons = (item, state) => {
    if (Number.isFinite(Number(item.persons)) && Number(item.persons) > 0) return Number(item.persons);
    if (Number(state?.persons)) return Number(state.persons);

    const titleMatch = String(item.title || item.members || '').match(/\d+/);
    return titleMatch ? Number(titleMatch[0]) : 1;
  };

  const normalizeItem = (item, state, rewardDistribution) => (
    window.DealettCart?.normalizeItem(item, { state, rewards: rewardDistribution }) || {
      ...item,
      cartItemId: item.cartItemId || `${item.offerId || item.id || 'offer'}-${Date.now()}`,
      offerId: item.offerId || item.id || '',
      operator: item.operator || item.provider || 'Dealett',
      title: item.title || item.members || 'Abonnemang',
      logo: item.logo || '',
      data: getDataLabel(item),
      dataAmount: Number(item.dataAmount) || 0,
      price: Number(item.price ?? item.finalPrice) || 0,
      pricePerPerson: Number(item.pricePerPerson) || 0,
      persons: getPersons(item, state),
      phoneLines: item.productType === 'broadband' ? 0 : getPersons(item, state),
      productType: item.productType || 'mobile',
      unitLabel: item.unitLabel || 'abonnemang',
      rewardTotal: Number(item.rewardTotal ?? item.reward) || sumRewards(rewardDistribution),
      rewardMixLabel: item.rewardMixLabel || '',
      rewards: item.rewards || rewardDistribution || {},
      features: Array.isArray(item.features) && item.features.length ? item.features : ['Fria samtal och sms', '5G & eSIM']
    }
  );

  const toSelectedOffer = (item) => ({
    id: item.offerId,
    operator: item.operator,
    title: item.title,
    logo: item.logo,
    dataAmount: item.dataAmount,
    finalPrice: item.price,
    pricePerPerson: item.pricePerPerson,
    rewardTotal: item.rewardTotal,
    rewardMixLabel: item.rewardMixLabel
  });

  const loadCart = () => {
    const state = readJson('dealettState', {});
    const rewardDistribution = readJson('rewardDistribution', {});
    const queryOffer = getHomepageOfferFromQuery();

    if (queryOffer) {
      const normalizedOffer = normalizeItem(queryOffer, state, queryOffer.rewards);
      window.DealettCart?.setCart([normalizedOffer]) || writeJson('dealettCart', [normalizedOffer]);
      return [normalizedOffer];
    }

    const storedCart = readJson('dealettCart', []);

    if (Array.isArray(storedCart) && storedCart.length) {
      return window.DealettCart?.normalizeCart(storedCart, { state, rewards: rewardDistribution })
        || storedCart.map((item) => normalizeItem(item, state, rewardDistribution));
    }

    const selectedOffer = readJson('selectedOffer', null);
    if (selectedOffer) {
      return [normalizeItem({
        offerId: selectedOffer.id,
        operator: selectedOffer.operator,
        title: selectedOffer.title,
        logo: selectedOffer.logo,
        dataAmount: selectedOffer.dataAmount,
        price: selectedOffer.finalPrice,
        pricePerPerson: selectedOffer.pricePerPerson,
        rewardTotal: selectedOffer.rewardTotal,
        rewardMixLabel: selectedOffer.rewardMixLabel,
        rewards: rewardDistribution
      }, state, rewardDistribution)];
    }

    return [];
  };

  const renderEmptyCart = () => {
    if (!els.cartSummaryContainer) return;

    els.cartSummaryContainer.innerHTML = [
      '<div class="empty-cart-card">',
      '  <h3>Varukorgen \u00e4r tom</h3>',
      '  <p>V\u00e4lj ett abonnemangspaket p\u00e5 startsidan f\u00f6r att forts\u00e4tta h\u00e4r.</p>',
      '  <a class="primary-btn" href="index.html">Till startsidan</a>',
      '</div>'
    ].join('');

    els.contactSection?.classList.add('is-hidden');
  };

  const renderSummaryCard = (item, index) => {
    const accent = getAccent(item.operator);
    const accentSoft = `${accent}14`;
    const rewardLabel = 'Presentkort: XXX kr';
    const priceLabel = item.price > 0 ? `${formatCurrency(item.price)} kr/m\u00e5n` : rewardLabel;
    const totalLabel = item.price > 0 ? 'M\u00e5nadspris' : 'Presentkort';
    const priceNote = item.price > 0
      ? 'Presentkort: XXX kr'
      : 'M\u00e5nadspris bekr\u00e4ftas vid signering.';
    const countIcon = item.productType === 'broadband' ? 'fa-wifi' : 'fa-users';

    return [
      `<article class="cart-summary-card" style="--cart-accent:${accent}; --cart-accent-soft:${accentSoft};">`,
      `  <button class="cart-remove-icon" type="button" data-remove-cart-item="${index}" aria-label="Ta bort ${escapeHtml(item.operator)} ${escapeHtml(item.title)}" title="Ta bort">`,
      '    <i class="fa-solid fa-xmark" aria-hidden="true"></i>',
      '  </button>',
      '  <div class="cart-summary-top">',
      '    <div class="cart-summary-logo">',
      item.logo ? `      <img src="${escapeHtml(item.logo)}" alt="${escapeHtml(item.operator)}" loading="lazy" decoding="async" />` : '',
      '    </div>',
      '    <div class="cart-summary-main">',
      `      <h3>${escapeHtml(item.operator)} ${escapeHtml(item.title)}</h3>`,
      `      <p>${escapeHtml(item.data)}</p>`,
      '      <div class="cart-summary-meta">',
      `        <span class="cart-summary-pill"><i class="fa-solid ${countIcon}"></i>${item.persons} ${escapeHtml(item.unitLabel || 'abonnemang')}</span>`,
      `        <span class="cart-summary-pill"><i class="fa-solid fa-gift"></i>${escapeHtml(rewardLabel)}</span>`,
      item.pricePerPerson ? `        <span class="cart-summary-pill"><i class="fa-solid fa-tag"></i>${formatCurrency(item.pricePerPerson)} kr/person</span>` : '',
      '      </div>',
      '    </div>',
      '  </div>',
      '  <div class="cart-summary-bottom">',
      '    <ul class="cart-feature-list">',
      ...item.features.map((feature) => `      <li><i class="fa-solid fa-check"></i>${escapeHtml(feature)}</li>`),
      '    </ul>',
      '    <div class="cart-total-box">',
      `      <span>${totalLabel}</span>`,
      `      <strong>${escapeHtml(priceLabel)}</strong>`,
      `      <p class="cart-price-note">${escapeHtml(priceNote)}</p>`,
      '    </div>',
      '  </div>',
      '</article>'
    ].join('');
  };

  const renderCheckoutTotals = () => {
    const totals = window.DealettCart?.getTotals(cart) || {
      price: cart.reduce((sum, item) => sum + Math.max(Number(item.price) || 0, 0), 0),
      reward: cart.reduce((sum, item) => sum + Math.max(Number(item.rewardTotal) || 0, 0), 0),
      phoneLines: getPhoneLineCount(),
    };

    return [
      '<article class="cart-checkout-total-card">',
      '  <div>',
      '    <span>Total månadspris</span>',
      `    <strong>${formatCurrency(totals.price)} kr/mån</strong>`,
      '  </div>',
      '  <div>',
      '    <span>Presentkort totalt</span>',
      '    <strong>XXX kr</strong>',
      '  </div>',
      '  <div>',
      '    <span>Telefonlinjer</span>',
      `    <strong>${totals.phoneLines}</strong>`,
      '  </div>',
      '</article>'
    ].join('');
  };

  const renderCartSummary = () => {
    if (!els.cartSummaryContainer) return;

    if (els.cartCheckoutBtn) els.cartCheckoutBtn.disabled = !cart.length;

    if (!cart.length) {
      renderEmptyCart();
      return;
    }

    els.cartSummaryContainer.innerHTML = [
      ...cart.map(renderSummaryCard),
      ...(cart.length > 1 ? [renderCheckoutTotals()] : [])
    ].join('');
  };

  const isEmailValid = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isPhoneValid = (value) => /^\+?\d[\d\s-]{6,}$/.test(value);

  const showMessage = (element, message) => {
    if (element) element.textContent = message;
  };

  const scrollToSection = (section) => {
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getPhoneLineCount = () => cart.reduce((sum, item) => sum + Math.max(Number(item.phoneLines) || 0, 0), 0);

  const syncStoredCart = () => {
    if (window.DealettCart?.setCart) {
      cart = window.DealettCart.setCart(cart);
      return;
    }

    writeJson('dealettCart', cart);

    if (!cart.length) {
      removeStorage('selectedOffer');
      removeStorage('rewardDistribution');
      removeStorage('dealettState');
      removeCheckoutStorage();
      window.DEALETT_updateCartCount?.();
      return;
    }

    const latestItem = cart[cart.length - 1];
    writeJson('selectedOffer', toSelectedOffer(latestItem));
    writeJson('rewardDistribution', latestItem.rewards || {});
    window.DEALETT_updateCartCount?.();
  };

  const refreshCheckoutAfterCartChange = () => {
    const embeddedSection = document.querySelector('#embeddedCheckoutSection');
    const embeddedFrame = document.querySelector('#embeddedCheckoutFrame');
    embeddedSection?.classList.add('is-hidden');
    embeddedFrame?.removeAttribute('src');

    if (!cart.length) {
      els.contactSection?.classList.add('is-hidden');
      els.numberSection?.classList.add('is-hidden');
      els.startDateSection?.classList.add('is-hidden');
      els.phoneInputsContainer?.replaceChildren();
      els.confirmNumbersBtn?.classList.add('is-hidden');
      showMessage(els.contactMessage, '');
      showMessage(els.numberMessage, '');
      showMessage(els.signMessage, '');
      return;
    }

    els.contactSection?.classList.remove('is-hidden');
    els.numberSection?.classList.add('is-hidden');
    els.startDateSection?.classList.add('is-hidden');
    els.phoneInputsContainer?.replaceChildren();
    els.confirmNumbersBtn?.classList.add('is-hidden');
    showMessage(els.numberMessage, '');
    showMessage(els.signMessage, '');

    removeCheckoutStorage();
  };

  const removeCartItem = (index) => {
    if (index < 0 || index >= cart.length) return;

    cart.splice(index, 1);
    syncStoredCart();
    renderCartSummary();
    updateSignButtonState();
    refreshCheckoutAfterCartChange();
  };

  const renderPhoneInputs = () => {
    if (!els.phoneInputsContainer || !els.confirmNumbersBtn) return;

    const count = getPhoneLineCount();
    if (count <= 0) {
      els.phoneInputsContainer.replaceChildren();
      els.confirmNumbersBtn.classList.add('is-hidden');
      return;
    }

    const fragment = document.createDocumentFragment();

    for (let index = 1; index <= count; index += 1) {
      const field = document.createElement('div');
      field.className = 'phone-input-field';

      const label = document.createElement('label');
      label.setAttribute('for', `transferPhone${index}`);
      label.textContent = index === 1 ? 'Huvudabonnemangets nummer' : `Nummer ${index}`;

      const input = document.createElement('input');
      input.id = `transferPhone${index}`;
      input.type = 'tel';
      input.placeholder = '07XXXXXXXX';
      input.autocomplete = 'tel';
      input.inputMode = 'tel';
      if (index === 1) input.value = getContact().phone;

      field.append(label, input);
      fragment.append(field);
    }

    els.phoneInputsContainer.replaceChildren(fragment);
    els.confirmNumbersBtn.classList.remove('is-hidden');
  };

  const addDays = (days) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return date;
  };

  const addMonths = (months) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setMonth(date.getMonth() + months);
    return date;
  };

  const addBusinessDays = (days) => {
    const date = addDays(0);
    let remaining = Math.max(Number(days) || 0, 0);

    while (remaining > 0) {
      date.setDate(date.getDate() + 1);
      const weekday = date.getDay();
      if (weekday !== 0 && weekday !== 6) remaining -= 1;
    }

    return date;
  };

  const toIsoDate = (date) => date.toISOString().slice(0, 10);

  const formatDateRange = (start, end) => (
    typeof dateFormatter.formatRange === 'function'
      ? dateFormatter.formatRange(start, end)
      : `${dateFormatter.format(start)}–${dateFormatter.format(end)}`
  );

  const updateStartDate = (value) => {
    const customDateInput = document.querySelector('[data-custom-start-date]');
    const isCustom = value === 'custom';
    const customDate = customDateInput?.value || '';

    selectedStartDate = isCustom ? customDate : value;

    document.querySelectorAll('.start-date-choice').forEach((choice) => {
      const input = choice.querySelector('input');
      choice.classList.toggle('is-selected', input?.value === value);
    });

    const selected = [...document.querySelectorAll('input[name="startDate"]')]
      .find((input) => input.value === value);
    const label = isCustom && customDate
      ? dateFormatter.format(new Date(`${customDate}T12:00:00`))
      : selected?.dataset.label || value;

    if (els.startDateValue && els.startDateText) {
      els.startDateValue.textContent = label;
      els.startDateText.classList.remove('is-hidden');
    }

    const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedStartDate)
      ? new Date(`${selectedStartDate}T12:00:00`)
      : null;
    els.startDateWarning?.classList.toggle(
      'is-hidden',
      !selectedDate || selectedDate < addDays(14)
    );
  };

  const renderStartDates = () => {
    if (!els.startDateOptions) return;

    const earliestStartDate = addBusinessDays(3);
    const latestStartDate = addBusinessDays(5);
    const oneMonthAhead = addMonths(1);
    const options = [
      {
        value: 'snarast',
        title: 'Snarast m\u00f6jligt',
        dateLabel: formatDateRange(earliestStartDate, latestStartDate),
        text: 'Ber\u00e4knad start 3\u20135 arbetsdagar efter signering.'
      },
      {
        value: toIsoDate(oneMonthAhead),
        title: 'En m\u00e5nad fram',
        dateLabel: dateFormatter.format(oneMonthAhead),
        text: 'Passar ofta vid en m\u00e5nads upps\u00e4gningstid hos nuvarande operat\u00f6r.'
      },
      {
        value: 'custom',
        title: 'V\u00e4lj datum',
        text: 'V\u00e4lj \u00f6nskat startdatum i kalendern.',
        minDate: toIsoDate(earliestStartDate),
        custom: true
      }
    ];

    els.startDateOptions.innerHTML = options.map((option, index) => [
      `<label class="start-date-choice${index === 0 ? ' is-selected' : ''}">`,
      `  <input type="radio" name="startDate" value="${escapeHtml(option.value)}" data-label="${escapeHtml(option.dateLabel ? `${option.title} - ${option.dateLabel}` : option.title)}"${index === 0 ? ' checked' : ''} />`,
      '  <span>',
      `    <strong>${escapeHtml(option.title)}</strong>`,
      option.dateLabel ? `    <span class="start-date-choice__date">${escapeHtml(option.dateLabel)}</span>` : '',
      `    <span>${escapeHtml(option.text)}</span>`,
      option.custom ? `    <input class="start-date-calendar" type="date" min="${escapeHtml(option.minDate)}" data-custom-start-date aria-label="V\u00e4lj startdatum" />` : '',
      '  </span>',
      '</label>'
    ].join('')).join('');

    updateStartDate(options[0].value);
  };

  const renderTermsReview = () => {
    if (!els.termsReviewContainer) return;

    els.termsReviewContainer.innerHTML = [
      '<section class="terms-review" aria-labelledby="termsReviewTitle">',
      '  <div class="terms-review-compact">',
      '    <img src="./images/Dealett2.png" alt="Dealett" loading="lazy" decoding="async" />',
      '    <div class="terms-review-copy">',
      '      <h3 id="termsReviewTitle">Avtal och villkor</h3>',
      '      <p>L\u00e4s och godk\u00e4nn Dealetts villkor f\u00f6r f\u00f6rmedling och presentkort innan BankID.</p>',
      '    </div>',
      '  </div>',
      '',
      '  <label class="terms-consent-row terms-consent-row--compact">',
      `    <input type="checkbox" data-legal-consent="${escapeHtml(combinedLegalConsentKey)}" />`,
      '    <span>Jag har l\u00e4st och accepterar Dealetts <strong>allm\u00e4nna villkor</strong>, <strong>villkor f\u00f6r presentkort</strong> och <strong>integritetspolicy</strong>, samt tagit del av informationen om \u00e5ngerr\u00e4tt.</span>',
      '  </label>',
      '',
      '  <details class="terms-full-version">',
      '    <summary>L\u00e4s fullst\u00e4ndig version</summary>',
      '    <div class="terms-document-grid">',
      '      <article class="terms-document-card">',
      '        <p class="terms-meta">Dealetts allm\u00e4nna villkor · Version 2026-07 · G\u00e4ller fr\u00e5n 27 juli 2026</p>',
      '        <nav class="terms-toc" aria-label="Villkorsavsnitt">',
      '          <a href="#dealett-term-1">1. Vad Dealett g\u00f6r</a>',
      '          <a href="#dealett-term-2">2. Avtal och best\u00e4llning</a>',
      '          <a href="#dealett-term-3">3. Priser och betalning</a>',
      '          <a href="#dealett-term-4">4. Leverans av presentkort</a>',
      '          <a href="#dealett-term-5">5. \u00c5ngerr\u00e4tt</a>',
      '          <a href="#dealett-term-6">6. Personuppgifter</a>',
      '          <a href="#dealett-term-7">7. Ansvar och ansvarsbegr\u00e4nsning</a>',
      '          <a href="#dealett-term-8">8. Force majeure</a>',
      '          <a href="#dealett-term-9">9. \u00c4ndringar</a>',
      '          <a href="#dealett-term-10">10. Tvist och lag</a>',
      '          <a href="#dealett-term-11">11. Kontakt</a>',
      '        </nav>',
      '      </article>',
      '',
      '      <article class="terms-document-card terms-block" id="dealett-term-1">',
      '        <h4>1. Vad Dealett g\u00f6r</h4>',
      '        <p>Dealett f\u00f6rmedlar erbjudanden om abonnemang och tj\u00e4nster fr\u00e5n olika operat\u00f6rer och leverant\u00f6rer. Dealett hj\u00e4lper kunden att j\u00e4mf\u00f6ra erbjudanden, skicka in best\u00e4llningen till vald leverant\u00f6r och hantera eventuellt presentkort som ing\u00e5r i erbjudandet.</p>',
      '        <p>Dealett \u00e4r inte part i det abonnemangsavtal som tecknas mellan kunden och leverant\u00f6ren. Det avtalet regleras av leverant\u00f6rens egna villkor, som kunden ocks\u00e5 ska ta del av innan best\u00e4llning.</p>',
      '      </article>',
      '',
      '      <article class="terms-document-card terms-block" id="dealett-term-2">',
      '        <h4>2. Avtal och best\u00e4llning</h4>',
      '        <h5>Dealett \u00e5tar sig att</h5>',
      '        <ul>',
      '          <li>tydligt visa den best\u00e4llning kunden valt, inklusive pris, bindningstid och eventuellt presentkortsv\u00e4rde, innan den skickas in,</li>',
      '          <li>ta emot och behandla kundens kontaktuppgifter i syfte att genomf\u00f6ra best\u00e4llningen,</li>',
      '          <li>skicka en orderbekr\u00e4ftelse till den e-postadress kunden angett s\u00e5 snart best\u00e4llningen \u00e4r registrerad.</li>',
      '        </ul>',
      '        <h5>Kunden \u00e5tar sig att</h5>',
      '        <ul>',
      '          <li>l\u00e4mna korrekta och fullst\u00e4ndiga uppgifter vid best\u00e4llning,</li>',
      '          <li>ha r\u00e4tt att ing\u00e5 avtalet, till exempel genom att vara myndig eller ha m\u00e5lsmans godk\u00e4nnande,</li>',
      '          <li>sj\u00e4lv kontrollera villkoren hos den leverant\u00f6r som best\u00e4llningen avser.</li>',
      '        </ul>',
      '        <p>Avtal om abonnemang anses ing\u00e5nget n\u00e4r leverant\u00f6ren bekr\u00e4ftat best\u00e4llningen, inte n\u00e4r Dealett tar emot den. BankID-signering utg\u00f6r kundens bekr\u00e4ftelse av identitet och godk\u00e4nnande av dessa villkor.</p>',
      '      </article>',
      '',
      '      <article class="terms-document-card terms-block" id="dealett-term-3">',
      '        <h4>3. Priser och betalning</h4>',
      '        <p>Alla priser anges i svenska kronor och inklusive moms d\u00e4r annat inte anges. Priser, kampanjer och eventuella rabatter g\u00e4ller enligt vad som visas vid best\u00e4llningstillf\u00e4llet och kan komma att \u00e4ndras eller upph\u00f6ra utan f\u00f6reg\u00e5ende meddelande.</p>',
      '        <p>Betalning f\u00f6r abonnemanget sker till leverant\u00f6ren enligt dennes betalningsvillkor. Dealett tar inte emot betalning f\u00f6r sj\u00e4lva abonnemanget, om inte annat uttryckligen anges i det specifika erbjudandet.</p>',
      '      </article>',
      '',
      '      <article class="terms-document-card terms-block" id="dealett-term-4">',
      '        <h4>4. Leverans av presentkort</h4>',
      '        <p>Om erbjudandet inkluderar ett presentkort hanteras detta av Dealett enligt uppgifterna i orderbekr\u00e4ftelsen och de s\u00e4rskilda villkor som g\u00e4ller f\u00f6r det aktuella presentkortet.</p>',
      '        <ul>',
      '          <li>Presentkortet skickas normalt efter att bindningstiden hos leverant\u00f6ren inletts och eventuell \u00e5ngerfrist l\u00f6pt ut, om inte annat anges.</li>',
      '          <li>Presentkortet kan \u00e5terkallas om abonnemanget s\u00e4gs upp, avbryts eller inte fullf\u00f6ljs under den period som anges i erbjudandet.</li>',
      '          <li>Presentkort som utf\u00e4rdas av tredje part omfattas \u00e4ven av utf\u00e4rdarens egna villkor f\u00f6r giltighetstid och anv\u00e4ndning.</li>',
      '        </ul>',
      '      </article>',
      '',
      '      <article class="terms-document-card terms-block" id="dealett-term-5">',
      '        <h4>5. \u00c5ngerr\u00e4tt</h4>',
      '        <p>Vid distansavtal har kunden enligt distansavtalslagen normalt 14 dagars \u00e5ngerr\u00e4tt fr\u00e5n det att avtalet ingicks. Under \u00e5ngerfristen kan kunden \u00e5ngra best\u00e4llningen utan att ange sk\u00e4l.</p>',
      '        <p>Vill kunden \u00e5ngra eller \u00e4ndra en best\u00e4llning ska Dealett kontaktas s\u00e5 snart som m\u00f6jligt, och senast innan \u00e5ngerfristen l\u00f6per ut. Observera att sj\u00e4lva abonnemangsavtalet ing\u00e5s med leverant\u00f6ren, vars egna \u00e5ngerr\u00e4ttsvillkor ocks\u00e5 g\u00e4ller och ska l\u00e4sas innan best\u00e4llning.</p>',
      '        <p class="terms-legal-note">Dessa villkor g\u00e4ller Dealetts f\u00f6rmedling och presentkortet. Eventuella separata abonnemangsvillkor, inklusive bindningstid och upps\u00e4gning, l\u00e4mnas i leverant\u00f6rens egen information och ska l\u00e4sas separat.</p>',
      '      </article>',
      '',
      '      <article class="terms-document-card terms-block" id="dealett-term-6">',
      '        <h4>6. Personuppgifter</h4>',
      '        <p>Dealett behandlar personuppgifter i enlighet med g\u00e4llande dataskyddslagstiftning (GDPR). Uppgifter som samlas in vid best\u00e4llning anv\u00e4nds f\u00f6r att genomf\u00f6ra best\u00e4llningen, skicka orderbekr\u00e4ftelse, hantera presentkort samt fullg\u00f6ra r\u00e4ttsliga skyldigheter.</p>',
      '        <p>Uppgifter kan delas med den leverant\u00f6r som best\u00e4llningen avser i den utstr\u00e4ckning det kr\u00e4vs f\u00f6r att teckna abonnemanget. Kunden har r\u00e4tt att beg\u00e4ra utdrag, r\u00e4ttelse eller radering av sina uppgifter i enlighet med g\u00e4llande lag. Fullst\u00e4ndig information finns i Dealetts integritetspolicy.</p>',
      '      </article>',
      '',
      '      <article class="terms-document-card terms-block" id="dealett-term-7">',
      '        <h4>7. Ansvar och ansvarsbegr\u00e4nsning</h4>',
      '        <p>Dealett ansvarar f\u00f6r att best\u00e4llningen f\u00f6rmedlas korrekt till vald leverant\u00f6r och att uppgivna kontaktuppgifter hanteras enligt dessa villkor. Dealett ansvarar d\u00e4remot inte f\u00f6r leverant\u00f6rens fullg\u00f6rande av abonnemangsavtalet, exempelvis leverans av mobiltj\u00e4nst, n\u00e4tverkst\u00e4ckning, fakturering eller kundservice kopplad till sj\u00e4lva abonnemanget.</p>',
      '        <p>Dealetts ansvar f\u00f6r eventuell skada \u00e4r begr\u00e4nsat till direkt skada som orsakats av grov v\u00e5rdsl\u00f6shet eller upps\u00e5t fr\u00e5n Dealetts sida, och omfattar inte indirekta skador eller f\u00f6ljdskador.</p>',
      '      </article>',
      '',
      '      <article class="terms-document-card terms-block" id="dealett-term-8">',
      '        <h4>8. Force majeure</h4>',
      '        <p>Dealett \u00e4r befriat fr\u00e5n ansvar f\u00f6r underl\u00e5tenhet att fullg\u00f6ra sina \u00e5taganden om detta beror p\u00e5 omst\u00e4ndigheter utanf\u00f6r Dealetts kontroll, s\u00e5som myndighets\u00e5tg\u00e4rd, driftsst\u00f6rning hos tredje part, arbetsmarknadskonflikt, naturh\u00e4ndelse eller liknande.</p>',
      '      </article>',
      '',
      '      <article class="terms-document-card terms-block" id="dealett-term-9">',
      '        <h4>9. \u00c4ndringar av villkoren</h4>',
      '        <p>Dealett f\u00f6rbeh\u00e5ller sig r\u00e4tten att \u00e4ndra dessa villkor. V\u00e4sentliga \u00e4ndringar meddelas p\u00e5 l\u00e4mpligt s\u00e4tt, exempelvis via webbplatsen eller e-post. Den version av villkoren som g\u00e4llde vid tidpunkten f\u00f6r best\u00e4llningen \u00e4r den som till\u00e4mpas p\u00e5 den best\u00e4llningen.</p>',
      '      </article>',
      '',
      '      <article class="terms-document-card terms-block" id="dealett-term-10">',
      '        <h4>10. Tvist och till\u00e4mplig lag</h4>',
      '        <p>Svensk lag ska till\u00e4mpas p\u00e5 dessa villkor. Tvist ska i f\u00f6rsta hand l\u00f6sas genom \u00f6verenskommelse mellan parterna. Kan parterna inte enas kan kunden v\u00e4nda sig till Allm\u00e4nna reklamationsn\u00e4mnden (ARN) eller till allm\u00e4n domstol.</p>',
      '      </article>',
      '',
      '      <article class="terms-document-card terms-block" id="dealett-term-11">',
      '        <h4>11. Kontakt</h4>',
      '        <p>Fr\u00e5gor om dessa villkor, en best\u00e4llning eller ett presentkort kan skickas till Dealetts kundtj\u00e4nst via kontaktuppgifterna p\u00e5 webbplatsen.</p>',
      '      </article>',
      '    </div>',
      '  </details>',
      '</section>'
    ].join('');
  };

  const updateSignButtonState = () => {
    if (!els.goToSignBtn) return;

    els.goToSignBtn.disabled = !selectedStartDate;
    els.goToSignBtn.textContent = selectedStartDate
      ? 'Forts\u00e4tt till avtal och signering'
      : 'V\u00e4lj startdatum f\u00f6rst';
  };

  const getContact = () => ({
    email: els.contactEmail?.value.trim() || '',
    phone: els.contactPhone?.value.trim() || ''
  });

  const saveCheckout = (extra = {}) => {
    const existing = readCheckout();
    writeSessionJson('dealettCheckout', {
      ...existing,
      cart,
      contact: getContact(),
      startDate: selectedStartDate,
      updatedAt: new Date().toISOString(),
      ...extra
    });
  };

  const getPrimaryPlanForAccount = () => {
    const firstItem = cart[0];
    if (!firstItem) return null;

    return {
      name: firstItem.title || firstItem.data || 'Abonnemang',
      operator: firstItem.operator || 'Dealett',
      price: firstItem.price || 0,
      data: firstItem.data || firstItem.title || 'Ej angivet',
      startDate: selectedStartDate || 'Ej angivet',
      persons: firstItem.persons || 1,
      signedAt: new Date().toISOString(),
    };
  };

  const saveSignedPurchase = (bankIdResult) => {
    const signedAt = new Date().toISOString();
    const signature = bankIdResult.signature || {
      id: `local-${Date.now()}`,
      signedAt,
      text: 'Dealett beställning signerad med BankID.',
    };

    saveCheckout({
      readyForSigning: true,
      signed: true,
      signedAt,
      signature,
      legalAcceptance: getLegalAcceptance(signedAt),
      bankIdUser: bankIdResult.user || null,
    });

    const accountPlan = getPrimaryPlanForAccount();
    if (accountPlan) writeJson('dealett_plan', accountPlan);

    if (bankIdResult.user) {
      try {
        sessionStorage.setItem('dealett_user', JSON.stringify({
          authMode: 'bankid',
          name: bankIdResult.user.name || 'BankID Kund',
          personalNumberMasked: bankIdResult.user.personalNumberMasked || '',
          authenticatedAt: signedAt,
        }));
        localStorage.removeItem('dealett_user');
      } catch {
        // Signing should still complete even if browser storage is unavailable.
      }
    }
  };

  const handleContactContinue = () => {
    const contact = getContact();

    if (!isEmailValid(contact.email)) {
      showMessage(els.contactMessage, 'Ange en giltig mejladress.');
      els.contactEmail?.focus();
      return;
    }

    if (!isPhoneValid(contact.phone)) {
      showMessage(els.contactMessage, 'Ange ett giltigt mobilnummer.');
      els.contactPhone?.focus();
      return;
    }

    showMessage(els.contactMessage, '');
    saveCheckout();

    if (getPhoneLineCount() > 0) {
      renderPhoneInputs();
      els.numberSection?.classList.remove('is-hidden');
      scrollToSection(els.numberSection);
      return;
    }

    saveCheckout({ phoneNumbers: [] });
    els.startDateSection?.classList.remove('is-hidden');
    scrollToSection(els.startDateSection);
  };

  const handleConfirmNumbers = () => {
    const inputs = [...(els.phoneInputsContainer?.querySelectorAll('input') || [])];
    const phoneNumbers = inputs.map((input) => input.value.trim());
    const invalidInput = inputs.find((input) => !isPhoneValid(input.value.trim()));

    if (invalidInput) {
      showMessage(els.numberMessage, 'Fyll i alla nummer som ska flyttas.');
      invalidInput.focus();
      return;
    }

    showMessage(els.numberMessage, '');
    saveCheckout({ phoneNumbers });
    els.startDateSection?.classList.remove('is-hidden');
    scrollToSection(els.startDateSection);
  };

  const handleSignContinue = () => {
    if (!selectedStartDate) {
      showMessage(els.signMessage, 'V\u00e4lj startdatum innan du forts\u00e4tter.');
      if (els.startDateOptions?.querySelector('input[name="startDate"][value="custom"]')?.checked) {
        els.startDateOptions.querySelector('[data-custom-start-date]')?.focus();
      }
      return;
    }

    saveCheckout({
      readyForReview: true,
      readyForSigning: false,
      legalAcceptance: null,
    });
    window.DealettCart?.showCheckoutAgreement();
  };

  const bindEvents = () => {
    els.cartSummaryContainer?.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-remove-cart-item]');
      if (!removeButton) return;

      removeCartItem(Number(removeButton.dataset.removeCartItem));
    });

    els.contactContinueBtn?.addEventListener('click', handleContactContinue);
    els.confirmNumbersBtn?.addEventListener('click', handleConfirmNumbers);
    els.goToSignBtn?.addEventListener('click', handleSignContinue);

    els.startDateOptions?.addEventListener('change', (event) => {
      if (event.target.name === 'startDate') {
        updateStartDate(event.target.value);
        saveCheckout();
        updateSignButtonState();
      }
    });

    els.startDateOptions?.addEventListener('input', (event) => {
      if (event.target.matches('[data-custom-start-date]')) {
        const customRadio = els.startDateOptions.querySelector('input[name="startDate"][value="custom"]');
        if (customRadio) customRadio.checked = true;
        updateStartDate('custom');
        saveCheckout();
        updateSignButtonState();
      }
    });
  };

  const init = () => {
    cart = loadCart();
    window.DEALETT_updateCartCount?.();
    renderCartSummary();
    renderStartDates();
    updateSignButtonState();
    bindEvents();
  };

  window.addEventListener('dealett:cart-updated', (event) => {
    cart = window.DealettCart?.normalizeCart(event.detail?.cart || []) || event.detail?.cart || [];
    renderCartSummary();
    updateSignButtonState();
    refreshCheckoutAfterCartChange();
  });

  window.addEventListener('dealett:cart-drawer-opened', (event) => {
    cart = window.DealettCart?.normalizeCart(event.detail?.cart || loadCart()) || event.detail?.cart || loadCart();
    renderCartSummary();
    updateSignButtonState();
  });

  init();
  window.DEALETT_CART_CHECKOUT_READY = true;
})();
