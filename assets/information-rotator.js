(() => {
  const recommendations = [
    {
      id: 'vardagssurf',
      question: 'Jag använder mest sociala medier, musik och vanlig surf. Vilket prisvärt abonnemang passar mig?',
      planId: 'tre-25gb',
      reason: '25 GB ger gott om utrymme för vardagssurf, sociala medier och musik utan att du betalar för obegränsad surf.',
    },
    {
      id: 'lag-surfanvandning',
      question: 'Jag använder mest mobilen för meddelanden och lätt surf. Vilket abonnemang håller nere månadskostnaden?',
      planId: 'tre-6gb',
      reason: '6 GB passar för meddelanden, kartor och lätt vardagssurf och håller månadskostnaden nere.',
    },
    {
      id: 'obegransad-surf',
      question: 'Jag streamar video och delar internet ofta. Vilket abonnemang låter mig slippa hålla koll på surfen?',
      planId: 'tele2-unlimited',
      reason: 'Obegränsad surf passar när mobilen används för mycket video, hotspot och annan datatung användning.',
    },
    {
      id: 'resor-utanfor-eu',
      question: 'Jag reser ofta utanför EU och vill kunna surfa utan höga extrakostnader. Vilket abonnemang passar?',
      planId: 'tele2-unlimited-plus',
      reason: 'Obegränsad Max inkluderar 60 GB surf i 170 länder och är därför ett starkt val för resor utanför EU.',
    },
    {
      id: 'streamingpaket',
      question: 'Jag betalar för Netflix, HBO Max och Disney+. Finns det ett mobilabonnemang där de ingår?',
      planId: 'telia-unlimited-plus-streaming-bundle',
      reason: 'Netflix Standard, HBO Max Basic och Disney+ Standard ingår tillsammans med obegränsad surf.',
    },
    {
      id: 'surf-och-samtal-utomlands',
      question: 'Jag behöver både surf och lokala samtal när jag reser utanför EU. Vilket abonnemang passar?',
      planId: 'tre-unlimited',
      reason: 'Tre Obegränsad inkluderar 3Världen för både surf och lokala samtal när du reser utanför EU.',
    },
  ];

  const rotator = document.querySelector('[data-information-rotator]');
  const dialog = document.querySelector('[data-information-dialog]');
  if (!rotator || !dialog) return;

  const slots = Array.from(rotator.querySelectorAll('[data-information-slot]'));
  const pages = Array.from(
    { length: Math.ceil(recommendations.length / slots.length) },
    (_, page) => recommendations
      .map((_, index) => index)
      .slice(page * slots.length, (page + 1) * slots.length)
  );
  const position = rotator.querySelector('[data-information-position]');
  const toggleButton = rotator.querySelector('[data-information-toggle]');
  const toggleIcon = rotator.querySelector('[data-information-toggle-icon]');
  const pageButtons = Array.from(rotator.querySelectorAll('[data-information-page]'));
  const dialogAnswer = dialog.querySelector('[data-information-dialog-answer]');
  const dialogQuestion = dialog.querySelector('[data-information-dialog-question]');
  const dialogLoading = dialog.querySelector('[data-information-loading]');
  const dialogError = dialog.querySelector('[data-information-error]');
  const planCard = dialog.querySelector('[data-information-plan]');
  const planLogo = dialog.querySelector('[data-information-plan-logo]');
  const planTitle = dialog.querySelector('[data-information-plan-title]');
  const planReason = dialog.querySelector('[data-information-plan-reason]');
  const planFacts = dialog.querySelector('[data-information-plan-facts]');
  const planPrice = dialog.querySelector('[data-information-plan-price]');
  const planPriceNote = dialog.querySelector('[data-information-plan-price-note]');
  const addToCartButton = dialog.querySelector('[data-information-add-to-cart]');
  const cartStatus = dialog.querySelector('[data-information-cart-status]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const currency = new Intl.NumberFormat('sv-SE');
  let plansPromise = null;
  let pageIndex = 0;
  let cycleTimer = 0;
  let visible = true;
  let manuallyPaused = false;
  let interactionPaused = false;
  let lastTrigger = null;
  let swapTimers = [];
  let touchStartX = 0;
  let touchStartY = 0;
  let activeSelection = null;
  let recommendationRequest = 0;
  let cartRequest = 0;

  const formatCurrency = (value) => currency.format(Math.max(Number(value) || 0, 0));

  const visibleIndexes = () => pages[pageIndex];

  const updatePosition = () => {
    if (!position) return;
    position.textContent = `${visibleIndexes().map((index) => index + 1).join(', ')} / ${recommendations.length}`;
  };

  const updateControls = () => {
    pageButtons.forEach((button, index) => {
      const active = index === pageIndex;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });

    if (!toggleButton) return;
    toggleButton.setAttribute('aria-pressed', String(manuallyPaused));
    toggleButton.setAttribute('aria-label', manuallyPaused ? 'Starta automatisk växling' : 'Pausa automatisk växling');
    toggleButton.title = manuallyPaused ? 'Spela' : 'Pausa';
    if (toggleIcon) {
      toggleIcon.classList.toggle('fa-pause', !manuallyPaused);
      toggleIcon.classList.toggle('fa-play', manuallyPaused);
    }
  };

  const setManualPaused = (value) => {
    manuallyPaused = value;
    updateControls();
  };

  const applyQuestion = (slot, questionIndex) => {
    const recommendation = recommendations[questionIndex];
    slot.dataset.informationIndex = String(questionIndex);
    slot.setAttribute('aria-label', `${recommendation.question} Visa rekommenderat abonnemang.`);
    const number = slot.querySelector('[data-information-number]');
    if (number) number.textContent = String(questionIndex + 1);
    const text = slot.querySelector('[data-information-text]');
    if (text) text.textContent = recommendation.question;
  };

  const clearSwapTimers = () => {
    swapTimers.forEach((timer) => window.clearTimeout(timer));
    swapTimers = [];
  };

  const render = ({ animate = true } = {}) => {
    clearSwapTimers();
    const indexes = visibleIndexes();
    slots.forEach((slot, slotIndex) => {
      const questionIndex = indexes[slotIndex];
      const update = () => {
        if (!animate || reduceMotion.matches) {
          slot.hidden = questionIndex === undefined;
          if (questionIndex !== undefined) applyQuestion(slot, questionIndex);
          slot.classList.remove('is-leaving', 'is-next');
          return;
        }

        slot.classList.add('is-leaving');
        const replaceTimer = window.setTimeout(() => {
          if (questionIndex === undefined) {
            slot.hidden = true;
            slot.classList.remove('is-leaving', 'is-next');
            return;
          }

          slot.hidden = false;
          applyQuestion(slot, questionIndex);
          slot.classList.remove('is-leaving');
          slot.classList.add('is-next');
          void slot.offsetHeight;
          slot.classList.remove('is-next');
        }, 380);
        swapTimers.push(replaceTimer);
      };

      const staggerTimer = window.setTimeout(update, animate ? slotIndex * 120 : 0);
      swapTimers.push(staggerTimer);
    });
    updatePosition();
    updateControls();
  };

  const move = (direction) => {
    pageIndex = (pageIndex + direction + pages.length) % pages.length;
    render();
  };

  const runCycle = () => {
    if (!visible || manuallyPaused || interactionPaused || document.hidden || reduceMotion.matches || dialog.open) return;
    move(1);
  };

  const startCycle = () => {
    window.clearInterval(cycleTimer);
    cycleTimer = window.setInterval(runCycle, 8500);
  };

  const loadPlans = () => {
    if (plansPromise) return plansPromise;
    if (!window.DealettNetwork?.fetchJson) return Promise.reject(new Error('Abonnemangskatalogen är inte tillgänglig'));

    plansPromise = window.DealettNetwork.fetchJson('/api/mobile/plans', {
      label: 'Snabbval abonnemang',
      timeoutMs: 5000,
    }).then((plans) => {
      if (!Array.isArray(plans)) throw new Error('Ogiltigt abonnemangssvar');
      return plans;
    }).catch((error) => {
      plansPromise = null;
      throw error;
    });

    return plansPromise;
  };

  const getPrice = (plan) => Math.max(Number(plan?.price ?? plan?.monthlyPrice) || 0, 0);

  const resolveSelection = (recommendation, plans) => {
    const plan = plans.find((item) => (
      item.id === recommendation.planId &&
      item.runtimeSellable !== false &&
      !item.isFamilyPlan
    ));

    if (!plan) throw new Error('Abonnemanget saknas');

    return { recommendation, plan, persons: 1, totalPrice: getPrice(plan) };
  };

  const setAnswerState = (state) => {
    if (dialogAnswer) dialogAnswer.dataset.state = state;
    if (dialogLoading) dialogLoading.hidden = state !== 'loading';
    if (dialogError) dialogError.hidden = state !== 'error';
    if (planCard) planCard.hidden = state !== 'ready';
  };

  const appendFact = (fragment, label, value) => {
    if (!value) return;
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    fragment.append(term, description);
  };

  const getDataLabel = (plan) => {
    if (plan.data) return plan.data;
    if (Number(plan.dataAmount) >= 999) return 'Obegränsad';
    if (Number(plan.dataAmount) > 0) return `${plan.dataAmount} GB`;
    return plan.title || 'Mobilabonnemang';
  };

  const getRoamingLabel = (plan) => {
    if (!plan.roaming?.outsideEuDataIncluded) return '';
    const serviceName = String(plan.roaming.serviceName || '').trim();
    const dataGb = Number(plan.roaming.internationalDataGb) || 0;
    const countries = Number(plan.roaming.internationalDataCountries) || 0;
    if (dataGb > 0 && countries > 0) {
      return `${serviceName ? `${serviceName}: ` : ''}${dataGb} GB i ${countries} länder`;
    }
    if (plan.roaming.localCallsIncludedAbroad) {
      return `${serviceName ? `${serviceName}: ` : ''}surf och lokala samtal utanför EU`;
    }
    return `${serviceName ? `${serviceName}: ` : ''}surf utanför EU ingår`;
  };

  const getPlanFeatures = ({ plan }) => {
    const features = ['Fria samtal och sms', '5G & eSIM'];
    if (Array.isArray(plan.includedStreaming) && plan.includedStreaming.length) {
      features.push(`Streaming: ${plan.includedStreaming.join(', ')}`);
    }
    const roamingLabel = getRoamingLabel(plan);
    if (roamingLabel) features.push(roamingLabel);
    if (plan.extraSim?.included) features.push(`Extra SIM med ${plan.extraSim.dataGb || ''} GB ingår`.trim());
    if (plan.internationalCalls?.freeCallsWithinFamilyWorldwide) {
      features.push('Fria samtal inom familjen världen över');
    }
    return features;
  };

  const renderSelection = (selection) => {
    const { recommendation, plan, persons, totalPrice } = selection;
    const factFragment = document.createDocumentFragment();
    const includedStreaming = Array.isArray(plan.includedStreaming) ? plan.includedStreaming : [];

    if (planLogo) {
      planLogo.src = plan.logo || '';
      planLogo.alt = plan.logo ? `${plan.operator} logotyp` : '';
      planLogo.closest('.information-plan__logo-wrap')?.classList.toggle('is-empty', !plan.logo);
    }
    if (planTitle) planTitle.textContent = `${plan.operator} ${plan.title}`;
    if (planReason) planReason.textContent = recommendation.reason;
    appendFact(factFragment, 'Surf', getDataLabel(plan));
    if (persons > 1) appendFact(factFragment, 'Antal', `${persons} abonnemang`);
    if (includedStreaming.length) appendFact(factFragment, 'Ingår', includedStreaming.join(', '));
    const roamingLabel = getRoamingLabel(plan);
    if (roamingLabel) appendFact(factFragment, 'Utomlands', roamingLabel);
    if (plan.internationalCalls?.freeCallsWithinFamilyWorldwide) {
      appendFact(factFragment, 'Samtal', 'Inom familjen världen över');
    }
    appendFact(factFragment, 'Bindningstid', `${Number(plan.bindingMonths) || 0} månader`);
    planFacts?.replaceChildren(factFragment);

    if (planPrice) planPrice.textContent = `${formatCurrency(totalPrice)} kr/mån`;
    if (planPriceNote) {
      planPriceNote.textContent = persons > 1
        ? `${formatCurrency(Math.round(totalPrice / persons))} kr per person · ${persons} abonnemang`
        : 'Totalt per månad';
    }
    if (addToCartButton) {
      addToCartButton.disabled = false;
      addToCartButton.textContent = persons > 1
        ? `Lägg ${persons} abonnemang i varukorgen`
        : 'Lägg i varukorgen';
      addToCartButton.dataset.defaultLabel = addToCartButton.textContent;
      addToCartButton.removeAttribute('aria-busy');
    }
    if (cartStatus) cartStatus.textContent = '';
    setAnswerState('ready');
  };

  const showRecommendation = async (recommendation) => {
    const request = ++recommendationRequest;
    activeSelection = null;
    setAnswerState('loading');
    if (addToCartButton) addToCartButton.disabled = true;
    if (cartStatus) cartStatus.textContent = '';

    try {
      const plans = await loadPlans();
      if (request !== recommendationRequest) return;
      const selection = resolveSelection(recommendation, plans);
      activeSelection = selection;
      renderSelection(selection);
    } catch {
      if (request !== recommendationRequest) return;
      setAnswerState('error');
    }
  };

  const openDialog = (slot) => {
    const questionIndex = Number(slot.dataset.informationIndex);
    const recommendation = recommendations[questionIndex];
    if (!Number.isInteger(questionIndex) || !recommendation) return;
    lastTrigger = slot;
    if (dialogQuestion) dialogQuestion.textContent = recommendation.question;
    dialog.showModal();
    void showRecommendation(recommendation);
  };

  const createCartPayload = async (selection) => {
    const { recommendation, plan, persons } = selection;
    const answers = {
      source: 'snabbval',
      recommendationId: recommendation.id,
      question: recommendation.question,
      persons,
    };

    if (!window.DealettNetwork?.fetchJson) throw new Error('Varukorgstjänsten är inte tillgänglig');

    const payload = await window.DealettNetwork.fetchJson('/api/mobile/cart-item', {
      label: 'Snabbval till varukorg',
      method: 'POST',
      timeoutMs: 10000,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: plan.id,
        rewards: {},
        answers,
      }),
    });

    if (!payload?.cartItem || !payload?.state || payload.cartItem.offerId !== plan.id) {
      throw new Error('Ogiltigt varukorgssvar');
    }
    payload.cartItem.features = [...new Set([
      ...(Array.isArray(payload.cartItem.features) ? payload.cartItem.features : []),
      ...getPlanFeatures(selection),
    ])];
    return payload;
  };

  const addSelectionToCart = async () => {
    if (!activeSelection || !addToCartButton) return;
    const selection = activeSelection;
    const request = ++cartRequest;
    const defaultLabel = addToCartButton.dataset.defaultLabel || 'Lägg i varukorgen';
    addToCartButton.disabled = true;
    addToCartButton.setAttribute('aria-busy', 'true');
    addToCartButton.textContent = 'Lägger till…';
    if (cartStatus) cartStatus.textContent = '';

    try {
      if (!window.DealettCart?.appendItem || !window.DealettCart?.openDrawer) {
        throw new Error('Varukorgen är inte tillgänglig');
      }

      const payload = await createCartPayload(selection);
      if (request !== cartRequest || !dialog.open || activeSelection !== selection) return;
      const cart = window.DealettCart.appendItem(payload.cartItem, { state: payload.state });
      lastTrigger = null;
      dialog.close();
      window.DealettCart.openDrawer(cart);
    } catch {
      if (request !== cartRequest || !dialog.open || activeSelection !== selection) return;
      addToCartButton.disabled = false;
      addToCartButton.removeAttribute('aria-busy');
      addToCartButton.textContent = defaultLabel;
      if (cartStatus) cartStatus.textContent = 'Kunde inte lägga abonnemanget i varukorgen. Försök igen.';
    }
  };

  rotator.addEventListener('click', (event) => {
    const previous = event.target.closest('[data-information-previous]');
    if (previous) {
      setManualPaused(true);
      move(-1);
      return;
    }

    const next = event.target.closest('[data-information-next]');
    if (next) {
      setManualPaused(true);
      move(1);
      return;
    }

    const toggle = event.target.closest('[data-information-toggle]');
    if (toggle) {
      setManualPaused(!manuallyPaused);
      return;
    }

    const page = event.target.closest('[data-information-page]');
    if (page) {
      const requestedPage = Number(page.dataset.informationPage);
      if (!Number.isInteger(requestedPage) || !pages[requestedPage]) return;
      setManualPaused(true);
      if (requestedPage !== pageIndex) {
        pageIndex = requestedPage;
        render();
      }
      return;
    }

    const slot = event.target.closest('[data-information-slot]');
    if (slot) openDialog(slot);
  });

  addToCartButton?.addEventListener('click', () => {
    void addSelectionToCart();
  });

  rotator.addEventListener('mouseenter', () => { interactionPaused = true; });
  rotator.addEventListener('mouseleave', () => { interactionPaused = false; });
  rotator.addEventListener('focusin', () => { interactionPaused = true; });
  rotator.addEventListener('focusout', (event) => {
    if (!rotator.contains(event.relatedTarget)) interactionPaused = false;
  });

  rotator.addEventListener('touchstart', (event) => {
    const touch = event.changedTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });

  rotator.addEventListener('touchend', (event) => {
    const touch = event.changedTouches[0];
    const distanceX = touch.clientX - touchStartX;
    const distanceY = touch.clientY - touchStartY;
    if (Math.abs(distanceX) < 48 || Math.abs(distanceX) <= Math.abs(distanceY) * 1.2) return;
    event.preventDefault();
    setManualPaused(true);
    move(distanceX > 0 ? -1 : 1);
  }, { passive: false });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    recommendationRequest += 1;
    cartRequest += 1;
    activeSelection = null;
    lastTrigger?.focus();
    lastTrigger = null;
  });

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }, { threshold: 0.15 });
  observer.observe(rotator);
  reduceMotion.addEventListener('change', startCycle);
  render({ animate: false });
  startCycle();
})();
