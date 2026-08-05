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
      cartItems: cartDrawer?.querySelector('#cartItems') || document.querySelector('#cartItems'),
      summaryArea: cartDrawer?.querySelector('#summaryArea') || document.querySelector('#summaryArea'),
      totalPrice: cartDrawer?.querySelector('#totalPrice') || document.querySelector('#totalPrice'),
      cartOverlay: cartDrawer?.querySelector('#cartOverlay') || document.querySelector('#cartOverlay'),
      closeCart: cartDrawer?.querySelector('#closeCart') || document.querySelector('#closeCart'),
      continueButton:
        cartDrawer?.querySelector('#cartContinueBtn, #cartBankIdButton') ||
        document.querySelector('#cartContinueBtn, #cartBankIdButton'),
    };
  };

  const ensureDrawer = () => {
    if (document.querySelector('#cartDrawer')) return getDrawerElements();

    const drawer = document.createElement('div');
    drawer.id = 'cartDrawer';
    drawer.className = 'cart-drawer hidden';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = [
      '<div id="cartOverlay" class="cart-drawer-overlay"></div>',
      '<aside class="cart-drawer-panel" aria-label="Din varukorg">',
      '  <div class="cart-drawer-head">',
      '    <h2>Din varukorg</h2>',
      '    <button id="closeCart" class="cart-drawer-close" type="button" aria-label="Stäng varukorg">&times;</button>',
      '  </div>',
      '  <div id="cartItems" class="cart-drawer-items"></div>',
      '  <div class="cart-drawer-footer">',
      '    <div id="summaryArea" class="cart-drawer-summary"></div>',
      '    <div class="cart-drawer-total-row">',
      '      <span>Totalt</span>',
      '      <strong id="totalPrice">0 kr/mån</strong>',
      '    </div>',
      '    <button id="cartContinueBtn" class="adeala-btn full-btn" type="button">Fortsätt till varukorg</button>',
      '  </div>',
      '</aside>',
    ].join('');

    document.body.append(drawer);
    return getDrawerElements();
  };

  const renderDrawerLine = (item, index) => {
    const dataLabel = item.productType === 'broadband'
      ? item.speed || item.data || item.title
      : item.data || item.title;
    const rewardLabel = 'Presentkort: XXX kr';
    const countLabel = `${item.persons} ${getUnitLabel(item)}`;
    const priceLabel = `${formatCurrency(item.price)} kr/mån`;
    const features = (item.features || []).slice(0, 3);

    return `
      <div class="cart-line" style="--cart-accent: ${getAccent(item.operator)}">
        <div class="cart-line-top">
          ${item.logo ? `<span class="cart-line-logo"><img src="${escapeHtml(item.logo)}" alt="${escapeHtml(item.operator)}" loading="lazy" decoding="async" /></span>` : ''}
          <div class="cart-line-main">
            <strong>${index + 1}. ${escapeHtml(item.operator)} ${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(dataLabel)}</span>
          </div>
        </div>
        <div class="cart-line-meta">
          <span>${escapeHtml(countLabel)}</span>
          <span>${escapeHtml(priceLabel)}</span>
          ${rewardLabel ? `<span>${escapeHtml(rewardLabel)}</span>` : ''}
        </div>
        ${features.length ? `<ul class="cart-line-features">${features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}</ul>` : ''}
      </div>
    `;
  };

  const renderDrawer = (elementsOrCart, maybeCart) => {
    const elements = Array.isArray(elementsOrCart) || !elementsOrCart
      ? getDrawerElements()
      : elementsOrCart;
    const cart = normalizeCart(Array.isArray(elementsOrCart) ? elementsOrCart : maybeCart || readCart());
    const { cartItems, summaryArea, totalPrice } = elements;

    if (!cartItems || !summaryArea || !totalPrice) return;

    const totals = getTotals(cart);

    if (!cart.length) {
      cartItems.innerHTML = '<div class="cart-line cart-line-empty"><strong>Varukorgen är tom</strong><span>Välj ett erbjudande för att fortsätta.</span></div>';
    } else {
      cartItems.innerHTML = cart.map(renderDrawerLine).join('');
    }

    summaryArea.innerHTML = [
      `<div><span>Varor</span><strong>${cart.length}</strong></div>`,
      `<div><span>Telefonlinjer</span><strong>${totals.phoneLines}</strong></div>`,
      '<div><span>Presentkort</span><strong>XXX kr</strong></div>',
    ].join('');
    totalPrice.textContent = `${formatCurrency(totals.price)} kr/mån`;
  };

  const closeDrawer = () => {
    const { cartDrawer } = getDrawerElements();
    cartDrawer?.classList.add('hidden');
    cartDrawer?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cart-drawer-open');
  };

  const openDrawer = (cart = readCart()) => {
    const elements = ensureDrawer();
    renderDrawer(elements, cart);
    elements.cartDrawer?.classList.remove('hidden');
    elements.cartDrawer?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cart-drawer-open');
    elements.continueButton?.focus();
  };

  const bindDrawerEvents = () => {
    const elements = ensureDrawer();
    const { cartDrawer, cartOverlay, closeCart, continueButton } = elements;

    if (!cartDrawer || cartDrawer.dataset.cartDrawerBound === 'true') return;

    cartDrawer.dataset.cartDrawerBound = 'true';
    cartOverlay?.addEventListener('click', closeDrawer);
    closeCart?.addEventListener('click', closeDrawer);
    continueButton?.addEventListener('click', () => {
      window.location.href = 'varukorg.html';
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeDrawer();
      }
    });

    window.addEventListener('dealett:cart-updated', (event) => {
      if (!cartDrawer.classList.contains('hidden')) {
        renderDrawer(elements, event.detail?.cart || readCart());
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
    renderDrawer,
    setCart,
  };
})();
