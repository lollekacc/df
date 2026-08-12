(() => {
  const currency = new Intl.NumberFormat('sv-SE');
  const CART_KEY = 'dealettCart';
  const SELECTED_OFFER_KEY = 'selectedOffer';
  const REWARD_KEY = 'rewardDistribution';
  const STATE_KEY = 'dealettState';
  const CHECKOUT_KEY = 'dealettCheckout';

  const providerAccents = {
    telia: '#6E2380',
    telenor: '#00437E',
    tre: '#E65C00',
    tele2: '#003A6E',
  };

  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Keep the shopping flow usable even if storage is unavailable.
    }
  };

  const removeStorage = (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Keep the shopping flow usable even if storage is unavailable.
    }
  };

  const removeSessionStorage = (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Keep the shopping flow usable even if storage is unavailable.
    }
  };

  const clearCheckoutStorage = () => {
    removeStorage(CHECKOUT_KEY);
    removeSessionStorage(CHECKOUT_KEY);
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const formatCurrency = (value) => currency.format(Math.max(Number(value) || 0, 0));

  const slugProvider = (operator) => String(operator || '')
    .toLowerCase()
    .replace(/\u00e5/g, 'a')
    .replace(/\u00e4/g, 'a')
    .replace(/\u00f6/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const getAccent = (operator) => providerAccents[slugProvider(operator)] || '#da392b';

  const sumRewards = (rewards) => {
    if (!rewards || typeof rewards !== 'object') return 0;
    return Object.values(rewards).reduce((sum, value) => sum + Math.max(Number(value) || 0, 0), 0);
  };

  const getProductType = (item = {}) => {
    const explicit = String(item.productType || item.type || '').toLowerCase();
    if (['broadband', 'bredband'].includes(explicit)) return 'broadband';
    if (['family', 'familj'].includes(explicit)) return 'family';
    if (['mobile', 'mobil'].includes(explicit)) return 'mobile';

    const searchable = `${item.offerId || ''} ${item.title || ''} ${item.data || ''} ${item.speed || ''}`.toLowerCase();
    if (searchable.includes('bredband') || searchable.includes('fiber') || searchable.includes('mbit')) {
      return 'broadband';
    }

    return Number(item.persons) > 1 ? 'family' : 'mobile';
  };

  const getUnitLabel = (item = {}) => {
    if (item.unitLabel) return item.unitLabel;
    return getProductType(item) === 'broadband' ? 'bredband' : 'abonnemang';
  };

  const getDataLabel = (item = {}) => {
    const productType = getProductType(item);
    if (item.data) return item.data;
    if (item.surf) return item.surf;
    if (productType === 'broadband' && item.speed) return item.speed;

    const dataAmount = Number(item.dataAmount);
    if (Number.isFinite(dataAmount) && dataAmount >= 999) return 'Obegränsad surf';
    if (Number.isFinite(dataAmount) && dataAmount > 0) return `${dataAmount} GB surf`;

    return productType === 'broadband' ? (item.title || 'Bredband') : (item.title || 'Mobilabonnemang');
  };

  const getPersons = (item = {}, state = {}) => {
    const productType = getProductType(item);
    if (productType === 'broadband') return 1;

    if (Number.isFinite(Number(item.persons)) && Number(item.persons) > 0) {
      return Number(item.persons);
    }

    if (Number.isFinite(Number(state.persons)) && Number(state.persons) > 0) {
      return Number(state.persons);
    }

    const titleMatch = String(item.title || item.members || '').match(/\d+/);
    return titleMatch ? Number(titleMatch[0]) : 1;
  };

  const getPhoneLines = (item = {}) => {
    if (Number.isFinite(Number(item.phoneLines))) {
      return Math.max(Number(item.phoneLines), 0);
    }

    return getProductType(item) === 'broadband' ? 0 : getPersons(item);
  };

  const normalizeFeatures = (item = {}) => {
    const productType = getProductType(item);
    const features = Array.isArray(item.features) ? item.features : [];
    const giftCardFeature = 'Presentkort: XXX kr';
    const fallback = productType === 'broadband'
      ? ['Stabil uppkoppling', 'Support ingår']
      : ['Fria samtal och sms', '5G & eSIM'];

    return [giftCardFeature, ...features, ...fallback]
      .map((feature) => String(feature || '').trim())
      .filter(Boolean)
      .filter((feature, index, list) => list.indexOf(feature) === index)
      .slice(0, 6);
  };

  const createCartItemId = (item = {}) => {
    const base = item.offerId || item.id || item.planId || item.title || item.operator || 'cart-item';
    return `${String(base).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  const normalizeItem = (item = {}, options = {}) => {
    const state = options.state || item.state || readJson(STATE_KEY, {});
    const productType = getProductType(item);
    const persons = getPersons(item, state);
    const price = Math.max(Number(item.price ?? item.monthlyPrice ?? item.finalPrice) || 0, 0);
    const rewards = item.rewards && typeof item.rewards === 'object'
      ? item.rewards
      : options.rewards && typeof options.rewards === 'object'
        ? options.rewards
        : readJson(REWARD_KEY, {});
    const rewardTotal = Math.max(Number(item.rewardTotal ?? item.reward) || sumRewards(rewards), 0);
    const title = item.title || item.name || item.members || (productType === 'broadband' ? 'Bredband' : 'Abonnemang');

    return {
      ...item,
      cartItemId: item.cartItemId || createCartItemId(item),
      offerId: item.offerId || item.id || item.planId || title,
      operator: item.operator || item.provider || 'Dealett',
      title,
      logo: item.logo || '',
      data: getDataLabel(item),
      dataAmount: Number(item.dataAmount) || 0,
      speed: item.speed || null,
      speedMbps: Number(item.speedMbps) || 0,
      price,
      monthlyPrice: Math.max(Number(item.monthlyPrice ?? price) || 0, 0),
      regularMonthlyPrice: Math.max(Number(
        item.monthlyPrice ?? price
      ) || 0, 0),
      bindingMonths: Math.max(Number(item.bindingMonths) || 0, 0),
      noticePeriodMonths: Math.max(Number(item.noticePeriodMonths) || 0, 0),
      startFee: Math.max(Number(item.startFee) || 0, 0),
      invoiceFee: Math.max(Number(item.invoiceFee) || 0, 0),
      invoiceFeeOptional: item.invoiceFeeOptional !== false,
      minimumTotalCost: Math.max(Number(item.minimumTotalCost) || 0, 0),
      deliveryType: item.deliveryType || null,
      operatorDocuments: item.operatorDocuments || null,
      pricePerPerson: Number(item.pricePerPerson) || (persons > 1 ? Math.round(price / persons) : 0),
      persons,
      phoneLines: getPhoneLines({ ...item, productType, persons }),
      productType,
      unitLabel: getUnitLabel({ ...item, productType }),
      rewardTotal,
      rewardMixLabel: item.rewardMixLabel || (rewardTotal ? 'Presentkort: XXX kr' : ''),
      rewards: rewards || {},
      features: normalizeFeatures({ ...item, productType }),
      answers: item.answers || {},
      state: item.state || options.state || undefined,
    };
  };

  const normalizeCart = (cart, options = {}) => (
    Array.isArray(cart) ? cart.map((item) => normalizeItem(item, options)) : []
  );

  const readCart = () => normalizeCart(readJson(CART_KEY, []));

  const getTotals = (cart) => normalizeCart(cart).reduce((totals, item) => ({
    price: totals.price + Math.max(Number(item.price) || 0, 0),
    reward: totals.reward + Math.max(Number(item.rewardTotal) || 0, 0),
    phoneLines: totals.phoneLines + getPhoneLines(item),
    items: totals.items + 1,
  }), { price: 0, reward: 0, phoneLines: 0, items: 0 });

  const buildSelectedOffer = (item) => ({
    id: item.offerId,
    operator: item.operator,
    title: item.title,
    logo: item.logo,
    dataAmount: item.dataAmount,
    speedMbps: item.speedMbps,
    finalPrice: item.price,
    pricePerPerson: item.pricePerPerson,
    rewardTotal: item.rewardTotal,
    rewardMixLabel: item.rewardMixLabel,
  });

  const buildStateFromItem = (item = {}) => {
    const productType = getProductType(item);
    const wish = productType === 'broadband'
      ? '5G-bredband'
      : productType === 'family'
        ? 'Familjabonnemang'
        : 'Mobilabonnemang';

    return {
      persons: getPersons(item, item.state || {}),
      data: productType === 'broadband' ? null : (item.dataTier || item.tier || item.data || null),
      speed: productType === 'broadband' ? (item.speed || item.data || null) : null,
      operator: item.operator || null,
      binding: item.binding ?? item.bindingLabel ?? null,
      bindingEndDate: item.bindingEndDate ?? null,
      wishes: Array.isArray(item.wishes) && item.wishes.length ? item.wishes : [wish],
      answers: item.answers || {},
      operatorsByPerson: item.operatorsByPerson || undefined,
      bindingsByPerson: item.bindingsByPerson || undefined,
      bindingEndDatesByPerson: item.bindingEndDatesByPerson || undefined,
    };
  };

  const notifyCartChanged = (cart) => {
    window.DEALETT_updateCartCount?.();
    window.dispatchEvent(new CustomEvent('dealett:cart-updated', {
      detail: {
        cart,
        totals: getTotals(cart),
      },
    }));
    window.dispatchEvent(new Event('cartUpdated'));
  };

  const syncSelectionFromCart = (cart) => {
    if (!cart.length) {
      removeStorage(SELECTED_OFFER_KEY);
      removeStorage(REWARD_KEY);
      removeStorage(STATE_KEY);
      clearCheckoutStorage();
      return;
    }

    const latestItem = cart[cart.length - 1];
    writeJson(SELECTED_OFFER_KEY, buildSelectedOffer(latestItem));
    writeJson(REWARD_KEY, latestItem.rewards || {});
    writeJson(STATE_KEY, latestItem.state || buildStateFromItem(latestItem));
    clearCheckoutStorage();
  };

  const setCart = (cart, options = {}) => {
    const normalizedCart = normalizeCart(cart, options);
    writeJson(CART_KEY, normalizedCart);

    if (options.syncSelection !== false) {
      syncSelectionFromCart(normalizedCart);
    }

    notifyCartChanged(normalizedCart);
    return normalizedCart;
  };

  const appendItem = (cartItem, options = {}) => {
    const item = normalizeItem(cartItem, options);
    const cart = [...readCart(), item];

    writeJson(CART_KEY, cart);
    writeJson(SELECTED_OFFER_KEY, options.selectedOffer || buildSelectedOffer(item));
    writeJson(STATE_KEY, options.state || item.state || buildStateFromItem(item));

    if (item.rewards) {
      writeJson(REWARD_KEY, item.rewards);
    }

    removeStorage('rewardChoice');
    clearCheckoutStorage();
    notifyCartChanged(cart);
    return cart;
  };

  const removeItem = (identifier) => {
    const cart = readCart();
    const nextCart = typeof identifier === 'number'
      ? cart.filter((_, index) => index !== identifier)
      : cart.filter((item) => item.cartItemId !== identifier);

    return setCart(nextCart);
  };

  const clearCart = () => setCart([]);

  const getDrawerElements = () => {
    const cartDrawer = document.querySelector('#cartDrawer');

    return {
      cartDrawer,
      closeCart: cartDrawer?.querySelector('#closeCart') || null,
      content: cartDrawer?.querySelector('.cart-checkout-drawer-content') || null,
    };
  };

  let checkoutAssetsPromise = null;

  const ensureCheckoutAssets = () => {
    if (!document.querySelector('#dealettCartCheckoutStyles')) {
      const stylesheet = document.createElement('link');
      stylesheet.id = 'dealettCartCheckoutStyles';
      stylesheet.rel = 'stylesheet';
      stylesheet.href = new URL('assets/varukorg.css', document.baseURI).href;
      document.head.append(stylesheet);
    }

    if (window.DEALETT_CART_CHECKOUT_READY) return Promise.resolve();
    if (checkoutAssetsPromise) return checkoutAssetsPromise;

    checkoutAssetsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('assets/varukorg.js', document.baseURI).href;
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.body.append(script);
    });

    return checkoutAssetsPromise;
  };

  const ensureDrawer = () => {
    if (document.querySelector('#cartDrawer')) return getDrawerElements();

    const drawer = document.createElement('div');
    drawer.id = 'cartDrawer';
    drawer.className = 'cart-drawer hidden';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = [
      '<div id="cartOverlay" class="cart-drawer-overlay"></div>',
      '<aside class="cart-drawer-panel varukorg-page" role="dialog" aria-modal="true" aria-labelledby="cartDrawerTitle">',
      '  <div class="cart-drawer-head">',
      '    <div><h2 id="cartDrawerTitle">Din varukorg</h2><div class="cart-drawer-steps" aria-label="Kassasteg"><span data-cart-step-indicator="offers">1. Erbjudanden</span><span data-cart-step-indicator="checkout">2. Kassa</span></div></div>',
      '    <button id="closeCart" class="cart-drawer-close" type="button" aria-label="Stäng varukorg">&times;</button>',
      '  </div>',
      '  <div class="cart-checkout-drawer-content abon-main cart-main" data-cart-checkout-root>',
      '   <div id="cartOffersStep" data-cart-step="offers">',
      '    <section id="cartSummarySection" class="result-section cart-summary-section">',
      '      <div class="result-shell result-medium">',
      '        <div class="section-head left-tight">',
      '          <span class="section-kicker">Varukorg</span>',
      '          <h2>Din beställning</h2>',
      '          <p>Kontrollera abonnemang och presentkort innan du fortsätter.</p>',
      '        </div>',
      '        <div id="cartSummaryContainer" aria-live="polite"></div>',
      '        <button id="cartCheckoutBtn" class="primary-btn full-btn cart-step-primary" type="button">Gå till kassan</button>',
      '      </div>',
      '    </section>',
      '   </div>',
      '   <div id="cartCheckoutStep" class="is-hidden" data-cart-step="checkout">',
      '    <div class="cart-step-toolbar"><button id="cartOffersBackBtn" class="cart-step-back" type="button"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Tillbaka till erbjudanden</button></div>',
      '    <section id="contactSection" class="result-section">',
      '      <div class="result-shell result-medium">',
      '        <div class="pro-card contact-card">',
      '          <div class="section-head left-tight">',
      '            <span class="section-kicker">Leverans</span>',
      '            <h2>Leverans och bekräftelse</h2>',
      '            <p>Mejl används för orderbekräftelse och mobilnummer för sms-avisering.</p>',
      '          </div>',
      '          <div class="form-grid">',
      '            <div class="form-field"><label for="contactEmail">Mejladress</label><input type="email" id="contactEmail" placeholder="din@email.se" autocomplete="email" /></div>',
      '            <div class="form-field"><label for="contactPhone">Mobilnummer</label><input type="tel" id="contactPhone" placeholder="07XXXXXXXX" autocomplete="tel" /></div>',
      '          </div>',
      '          <p id="contactMessage" class="form-message" aria-live="polite"></p>',
      '          <button id="contactContinueBtn" class="primary-btn full-btn" type="button">Gå vidare</button>',
      '        </div>',
      '      </div>',
      '    </section>',
      '    <section id="numberSection" class="result-section is-hidden">',
      '      <div class="result-shell result-medium">',
      '        <div class="pro-card checkout-card">',
      '          <div class="section-head left-tight"><span class="section-kicker">Nummerflytt</span><h2>Fyll i numren som ska flyttas</h2><p>Vi går igenom en person i taget.</p></div>',
      '          <div id="phoneInputsContainer" class="phone-inputs"></div>',
      '          <p id="numberMessage" class="form-message" aria-live="polite"></p>',
      '          <button id="confirmNumbersBtn" class="primary-btn full-btn is-hidden" type="button">Bekräfta</button>',
      '        </div>',
      '      </div>',
      '    </section>',
      '    <section id="startDateSection" class="result-section is-hidden">',
      '      <div class="result-shell result-medium">',
      '        <div class="pro-card checkout-card">',
      '          <div class="section-head left-tight"><span class="section-kicker">Startdatum</span><h2>När vill du börja abonnemanget?</h2><p>Välj när abonnemanget ska aktiveras.</p></div>',
      '          <div id="startDateOptions" class="start-date-options"></div>',
      '          <p id="startDateText" class="start-date-text is-hidden">Startdatum: <strong id="startDateValue"></strong></p>',
      '          <p id="startDateWarning" class="start-date-warning is-hidden">Med återköp: Tänk på att ångerrätten hinner löpa ut innan abonnemanget startas.</p>',
      '          <button id="goToSignBtn" class="primary-btn full-btn" type="button">Fortsätt till avtal och signering</button>',
      '          <p id="signMessage" class="form-message success-message" aria-live="polite"></p>',
      '        </div>',
      '      </div>',
      '    </section>',
      '    <section id="embeddedCheckoutSection" class="result-section is-hidden" aria-labelledby="embeddedCheckoutTitle">',
      '      <div class="result-shell result-medium">',
      '        <div class="section-head left-tight"><span class="section-kicker">Avtal och signering</span><h2 id="embeddedCheckoutTitle">Granska och signera</h2><p>Kontrollera avtalen och slutför beställningen med BankID.</p></div>',
      '        <iframe id="embeddedCheckoutFrame" class="embedded-checkout-frame" title="Avtal och signering"></iframe>',
      '      </div>',
      '    </section>',
      '   </div>',
      '  </div>',
      '</aside>',
    ].join('');

    document.body.append(drawer);
    return getDrawerElements();
  };

  const closeDrawer = () => {
    const { cartDrawer } = getDrawerElements();
    cartDrawer?.classList.add('hidden');
    cartDrawer?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cart-drawer-open');
    document.body.style.removeProperty('--cart-scrollbar-width');
  };

  const setDrawerStep = (step) => {
    const { cartDrawer } = ensureDrawer();
    const showCheckout = step === 'checkout';

    cartDrawer?.querySelector('[data-cart-step="offers"]')?.classList.toggle('is-hidden', showCheckout);
    cartDrawer?.querySelector('[data-cart-step="checkout"]')?.classList.toggle('is-hidden', !showCheckout);
    cartDrawer?.querySelectorAll('[data-cart-step-indicator]').forEach((indicator) => {
      indicator.classList.toggle('is-active', indicator.dataset.cartStepIndicator === step);
    });
    cartDrawer?.querySelector('.cart-checkout-drawer-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showCheckoutAgreement = () => {
    const { cartDrawer } = ensureDrawer();
    const section = cartDrawer?.querySelector('#embeddedCheckoutSection');
    const frame = cartDrawer?.querySelector('#embeddedCheckoutFrame');
    if (!section || !frame) return;

    section.classList.remove('is-hidden');
    if (frame.dataset.autoResizeBound !== 'true') {
      frame.dataset.autoResizeBound = 'true';
      frame.addEventListener('load', () => {
        frame._dealettResizeObserver?.disconnect();

        const frameDocument = frame.contentDocument;
        if (!frameDocument) return;

        const resizeFrame = () => {
          frame.style.height = '0px';
          frame.style.height = `${Math.max(frameDocument.body?.scrollHeight || 0, frameDocument.documentElement?.scrollHeight || 0)}px`;
        };

        const resizeObserver = new ResizeObserver(resizeFrame);
        if (frameDocument.body) resizeObserver.observe(frameDocument.body);
        resizeObserver.observe(frameDocument.documentElement);
        frame._dealettResizeObserver = resizeObserver;
        resizeFrame();
      });
    }
    if (!frame.getAttribute('src')) {
      frame.setAttribute('src', new URL('bestallning.html?embedded=1', document.baseURI).href);
    }
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openDrawer = (cart = readCart()) => {
    const elements = ensureDrawer();
    bindDrawerEvents(elements);
    void elements.cartDrawer?.offsetWidth;
    elements.cartDrawer?.classList.remove('hidden');
    elements.cartDrawer?.setAttribute('aria-hidden', 'false');
    document.body.style.setProperty('--cart-scrollbar-width', `${window.innerWidth - document.documentElement.clientWidth}px`);
    document.body.classList.add('cart-drawer-open');
    setDrawerStep('offers');
    elements.closeCart?.focus();

    ensureCheckoutAssets()
      .then(() => window.dispatchEvent(new CustomEvent('dealett:cart-drawer-opened', {
        detail: { cart: normalizeCart(cart) },
      })))
      .catch(() => {
        if (elements.content) {
          elements.content.innerHTML = '<div class="empty-cart-card"><h3>Varukorgen kunde inte laddas</h3><p>Stäng varukorgen och försök igen.</p></div>';
        }
      });
  };

  const bindDrawerEvents = (drawerElements = null) => {
    const elements = drawerElements || ensureDrawer();
    const { cartDrawer } = elements;

    if (!cartDrawer || cartDrawer.dataset.cartDrawerBound === 'true') return;

    cartDrawer.dataset.cartDrawerBound = 'true';
    cartDrawer.addEventListener('click', (event) => {
      const target = event.target.closest('#closeCart, #cartOverlay');
      if (target && cartDrawer.contains(target)) {
        closeDrawer();
        return;
      }

      if (event.target.closest('#cartCheckoutBtn') && readCart().length) {
        setDrawerStep('checkout');
        cartDrawer.querySelector('#contactEmail')?.focus();
        return;
      }

      if (event.target.closest('#cartOffersBackBtn')) {
        setDrawerStep('offers');
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeDrawer();
      }
    });
  };

  window.DealettCart = {
    appendItem,
    bindDrawerEvents,
    buildStateFromItem,
    buildSelectedOffer,
    clearCart,
    clearCheckoutStorage,
    closeDrawer,
    escapeHtml,
    formatCurrency,
    getAccent,
    getDataLabel,
    getDrawerElements,
    getPhoneLines,
    getProductType,
    getTotals,
    getUnitLabel,
    normalizeCart,
    normalizeItem,
    openDrawer,
    readCart,
    removeItem,
    setCart,
    setDrawerStep,
    showCheckoutAgreement,
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;

    const targetUrl = new URL(link.href, window.location.href);
    if (!targetUrl.pathname.endsWith('/varukorg.html')) return;

    event.preventDefault();
    openDrawer();
  });

  if (new URLSearchParams(window.location.search).get('openCart') === '1') {
    window.setTimeout(() => openDrawer(), 0);
  }
})();
