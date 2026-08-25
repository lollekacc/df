(() => {
const offersContainer = document.querySelector('#offers-container');
const rewardSection = document.querySelector('#rewardSection');
const rewardGrid = document.querySelector('#rewardGrid');
const totalReward = document.querySelector('#totalReward');
const remainingSum = document.querySelector('#remainingSum');
const rewardProgressFill = document.querySelector('#rewardProgressFill');
const rewardContinueBtn = document.querySelector('#rewardContinueBtn');
const operatorFilter = document.querySelector('#operatorFilter');
const dataFilter = document.querySelector('#dataFilter');
const dataFilterValue = document.querySelector('#dataFilterValue');
const dataFilterAll = document.querySelector('#dataFilterAll');
const dataFilterTicks = document.querySelector('#dataFilterTicks');

const currency = new Intl.NumberFormat('sv-SE');
const giftCardPlaceholder = 'Presentkort: XXX kr';

const offers = [
  {
    provider: 'Telia',
    logo: 'images/telia.png',
    accent: '#6E2380',
    reward: 0,
  },
  {
    provider: 'Telenor',
    logo: 'images/telenor.jpg',
    accent: '#00437E',
    reward: 0,
  },
  {
    provider: 'Tre',
    logo: 'images/tre.jpg',
    accent: '#E65C00',
    reward: 0,
  },
  {
    provider: 'Tele2',
    logo: 'images/tele2.png',
    accent: '#003A6E',
    reward: 0,
  },
];

const giftCards = ['Apollo', 'H&M', 'Hotel', 'ICA Maxi', 'Mio', 'Zalando', 'Ticketmaster'];

let selectedOffer = null;
let plansCache = null;
let activeOperator = 'Alla';
let activeData = 'all';
let dataSteps = [];

const formatCurrency = (value) => currency.format(Math.max(Number(value) || 0, 0));

const apiFetchJson = async (resource, options = {}) => window.DealettNetwork.fetchJson(resource, {
  timeoutMs: 7000,
  ...options,
});

const createElement = (tag, className, text) => {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text) {
    element.textContent = text;
  }

  return element;
};

const createGiftCardHeader = () => {
  const header = createElement('div', 'offer-card-gift-header');
  header.setAttribute('aria-label', 'Presentkort');

  ['Ny kund', 'Redan kund'].forEach((customerType) => {
    const column = createElement('div', 'offer-card-gift-column');
    column.append(
      createElement('span', '', customerType),
      createElement('strong', '', 'XXX kr')
    );
    header.append(column);
  });

  return header;
};

const openCartDrawer = (cart) => {
  window.DealettCart?.openDrawer(cart);
};

const getOperatorOffer = (operator) => offers.find((offer) => offer.provider === operator) || {};

const getPlanDataLabel = (plan) => {
  if (plan.data) return plan.data;
  if (Number(plan.dataAmount) >= 999) return 'Obegr\u00e4nsad';
  if (Number(plan.dataAmount) > 0) return `${plan.dataAmount} GB`;
  return plan.title || 'Mobilabonnemang';
};

const loadPlans = async () => {
  if (plansCache) return plansCache;

  const data = await apiFetchJson('https://db-qtmd.onrender.com/api/mobile/plans', {
    label: 'Mobilabonnemang data',
  });

  if (!Array.isArray(data)) {
    throw new Error('Mobilabonnemang data must be an array.');
  }

  plansCache = data;
  return plansCache;
};

const loadOperatorOffers = async (operator) => apiFetchJson(
  `https://db-qtmd.onrender.com/api/mobile/operator-offers?operator=${encodeURIComponent(operator)}`,
  { label: 'Mobilabonnemang erbjudanden' }
);

const buildSelectedPlanOffer = (plan, answers) => {
  const operatorOffer = getOperatorOffer(plan.operator);

  return {
    planId: plan.id,
    provider: plan.operator,
    operator: plan.operator,
    title: plan.title,
    data: getPlanDataLabel(plan),
    price: plan.price,
    monthlyPrice: plan.monthlyPrice,
    regularMonthlyPrice: plan.monthlyPrice || plan.price,
    bindingMonths: plan.bindingMonths,
    noticePeriodMonths: plan.noticePeriodMonths,
    startFee: plan.startFee,
    invoiceFee: plan.invoiceFee,
    invoiceFeeOptional: plan.invoiceFeeOptional !== false,
    logo: plan.logo,
    reward: Number(operatorOffer.reward) || 0,
    accent: operatorOffer.accent || 'var(--accent)',
    answers,
  };
};

const formatDateLabel = (dateValue) => {
  if (!dateValue) return 'datum saknas';
  try {
    return new Intl.DateTimeFormat('sv-SE').format(new Date(`${dateValue}T00:00:00`));
  } catch {
    return dateValue;
  }
};

const getMobileAnswerSummary = (offer, answers) => [
  {
    label: 'Nuvarande operat\u00f6r',
    value: answers.currentOperator === 'yes' ? offer.provider : `Inte ${offer.provider}`,
  },
  {
    label: 'Bindningstid',
    value: answers.binding === 'yes'
      ? `Ja, till ${formatDateLabel(answers.bindingEndDate)}`
      : answers.binding === 'no'
        ? 'Nej'
        : 'Vet ej',
  },
];

const getMobileAnswerFacts = (offer, answers = {}) => getMobileAnswerSummary(offer, answers)
  .filter((item) => item.value && item.value !== 'Vet ej')
  .map((item) => ({ label: item.label, value: item.value }));

const createCompareButton = (item, options = {}) => {
  const button = createElement(
    'button',
    ['offer-compare-button', options.compact === false ? '' : 'offer-compare-button--icon'].filter(Boolean).join(' ')
  );
  button.type = 'button';
  button.setAttribute('aria-label', 'J\u00e4mf\u00f6r');
  if (window.DealettOfferCompare) {
    window.DealettOfferCompare.bindButton(button, item);
  } else {
    button.innerHTML = '<i class="fa-solid fa-code-compare" aria-hidden="true"></i><span data-compare-label>Jämför</span>';
  }
  return button;
};

const buildBaseCompareItem = (offer) => ({
  id: `mobile-operator-${offer.provider}`,
  title: `${offer.provider} mobilabonnemang`,
  operator: offer.provider,
  type: 'Operat\u00f6r',
  logo: offer.logo,
  accent: offer.accent,
  facts: [
    { label: 'Typ', value: 'Mobilabonnemang' },
    { label: 'Surf', value: 'Obegr\u00e4nsad surf' },
    { label: 'Samtal & SMS', value: 'Fria samtal och SMS' },
    { label: '5G/eSIM', value: '5G & eSIM' },
    { label: 'Presentkort', value: 'XXX kr' },
  ],
});

const buildPlanCompareItem = (selectedPlan, plan, answers) => ({
  id: `mobile-plan-${selectedPlan.planId || selectedPlan.operator}-${selectedPlan.title}`,
  title: selectedPlan.title,
  operator: selectedPlan.operator,
  type: 'Mobilabonnemang',
  logo: selectedPlan.logo,
  accent: selectedPlan.accent,
  facts: [
    { label: 'Typ', value: 'Mobilabonnemang' },
    { label: 'Surf', value: `${getPlanDataLabel(plan)} surf` },
    { label: 'Pris', value: `${formatCurrency(plan.price)} kr/m\u00e5n` },
    { label: 'Presentkort', value: 'XXX kr' },
    { label: 'Samtal & SMS', value: 'Fria samtal och SMS' },
    ...getMobileAnswerFacts({ provider: selectedPlan.operator }, answers),
  ],
});

const buildAddonCompareItem = (addonPlan, offer) => ({
  id: `mobile-addon-${addonPlan.id || offer.provider}`,
  title: addonPlan.title,
  operator: addonPlan.operator || offer.provider,
  type: 'Till\u00e4gg',
  logo: addonPlan.logo || offer.logo,
  accent: offer.accent,
  facts: [
    { label: 'Typ', value: 'Extra familjemedlem' },
    { label: 'Pris', value: `${formatCurrency(addonPlan.addonPrice ?? addonPlan.price)} kr/m\u00e5n` },
    { label: 'Beskrivning', value: addonPlan.text || 'Extra abonnemang till valt mobilabonnemang' },
  ],
});

const renderAnswerSummary = (offer, panel, answers, sourceCard) => {
  let questionBox = panel.querySelector('.offer-card-questions');

  if (!questionBox) {
    questionBox = createElement('div', 'offer-card-questions');
    panel.append(questionBox);
  }

  const kicker = createElement('p', 'offer-question-kicker', 'Dina svar');
  const heading = createElement('h4', '', `${offer.provider} matchas med svaren nedan`);
  const list = createElement('dl', 'offer-answer-list');
  const editButton = createElement('button', 'offer-answer-edit', '\u00c4ndra svar');

  getMobileAnswerSummary(offer, answers).forEach((item) => {
    list.append(
      createElement('dt', '', item.label),
      createElement('dd', '', item.value)
    );
  });

  editButton.type = 'button';
  editButton.addEventListener('click', () => startOfferQuestions(offer, sourceCard));

  questionBox.replaceChildren(kicker, heading, list, editButton);
};

const getExpandedOfferPanel = (card) => {
  offersContainer?.querySelectorAll('.offer-card-expanded-panel').forEach((panel) => {
    panel.remove();
  });

  const panel = createElement('div', 'offer-card-expanded-panel');
  panel.style.setProperty('--offer-accent', card.style.getPropertyValue('--offer-accent') || 'var(--accent)');
  card.after(panel);
  return panel;
};

const getPlanResultsBox = (panel) => {
  let resultsBox = panel.querySelector('.offer-card-results');

  if (!resultsBox) {
    resultsBox = createElement('div', 'offer-card-results');
    panel.append(resultsBox);
  }

  return resultsBox;
};

const syncAddonButtons = () => {
  offersContainer?.querySelectorAll('[data-addon-button]').forEach((button) => {
    button.disabled = !selectedOffer;
    button.textContent = selectedOffer ? 'Lägg till' : 'Välj abonnemang först';
  });
};

const updateRewardState = () => {
  if (!selectedOffer || !rewardGrid || !remainingSum || !rewardProgressFill || !rewardContinueBtn) {
    return;
  }

  const inputs = [...rewardGrid.querySelectorAll('input')];
  const allocated = inputs.reduce((sum, input) => sum + Math.max(Number(input.value) || 0, 0), 0);
  const remaining = Math.max(selectedOffer.reward - allocated, 0);
  const progress = selectedOffer.reward ? Math.min((allocated / selectedOffer.reward) * 100, 100) : 0;

  remainingSum.textContent = 'XXX';
  rewardProgressFill.style.width = `${progress}%`;
  rewardContinueBtn.disabled = allocated !== selectedOffer.reward;
};

const renderRewards = (offer) => {
  if (!rewardGrid || !totalReward || !remainingSum || !rewardProgressFill || !rewardContinueBtn) {
    return;
  }

  rewardGrid.replaceChildren();
  totalReward.textContent = 'XXX';
  remainingSum.textContent = 'XXX';
  rewardProgressFill.style.width = '0%';
  rewardContinueBtn.disabled = true;

  giftCards.forEach((name) => {
    const choice = createElement('label', 'reward-choice');
    const label = createElement('strong', '', name);
    const input = document.createElement('input');

    input.type = 'number';
    input.min = '0';
    input.step = '100';
    input.value = '0';
    input.inputMode = 'numeric';
    input.setAttribute('aria-label', name);
    input.addEventListener('input', updateRewardState);

    choice.append(label, input);
    rewardGrid.append(choice);
  });

  updateRewardState();
};

const selectOffer = (offer, card) => {
  selectedOffer = { ...offer, addon: null };
  const selectedCard = card.closest?.('.offer-card') || card;

  offersContainer?.querySelectorAll('.offer-card, .operator-plan-row').forEach((item) => {
    item.classList.remove('is-selected');
  });

  selectedCard.classList.add('is-selected');
  card.classList.add('is-selected');
  rewardSection?.classList.remove('is-hidden');
  renderRewards(offer);
  syncAddonButtons();
  rewardSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const selectAddon = (addon, card) => {
  if (!selectedOffer) return;

  selectedOffer.addon = {
    id: addon.id,
    title: addon.title,
    price: addon.price,
    addonPrice: addon.addonPrice,
    text: addon.text,
  };

  offersContainer?.querySelectorAll('.offer-card--addon').forEach((item) => {
    item.classList.remove('is-selected');
  });

  card.classList.add('is-selected');
  const button = card.querySelector('[data-addon-button]');
  if (button) button.textContent = 'Tillagd';
};

const resetOfferQuestions = () => {
  offersContainer?.querySelectorAll('.offer-card-expanded-panel').forEach((panel) => {
    panel.remove();
  });

  offersContainer?.querySelectorAll('.offer-card').forEach((card) => {
    card.classList.remove('is-answering', 'is-selected');
    card.querySelector('.offer-card-questions')?.remove();
    card.querySelector('.offer-card-details')?.classList.remove('is-hidden');
  });
};

const renderPlanOffers = async (offer, answers, card) => {
  if (!offersContainer || !card) return;

  card.classList.remove('is-answering');
  card.classList.add('is-selected');
  card.querySelector('.offer-card-details')?.classList.remove('is-hidden');
  card.querySelector('.offer-card-questions')?.remove();

  const panel = getExpandedOfferPanel(card);
  renderAnswerSummary(offer, panel, answers, card);

  const resultsBox = getPlanResultsBox(panel);
  resultsBox.innerHTML = '<div class="offers-loading">H\u00e4mtar abonnemang...</div>';

  try {
    let operatorPlans = [];
    let addonPlan = null;

    try {
      const data = await loadOperatorOffers(offer.provider);
      operatorPlans = data.plans || [];
      addonPlan = data.addonPlan || null;
    } catch {
      const plans = await loadPlans();
      operatorPlans = plans
        .filter((plan) => plan.category === 'mobil' && !plan.isFamilyPlan && plan.operator === offer.provider)
        .sort((left, right) => (left.dataAmount || 0) - (right.dataAmount || 0));
      addonPlan = plans.find((plan) =>
        plan.category === 'mobil' &&
        plan.isFamilyPlan &&
        plan.familyPriceType === 'addon' &&
        plan.operator === offer.provider
      );
    }

    const fragment = document.createDocumentFragment();

    operatorPlans.forEach((plan) => {
      const selectedPlan = buildSelectedPlanOffer(plan, answers);
      const row = createElement('div', 'operator-plan-row offer-card--plan');
      row.style.setProperty('--offer-accent', selectedPlan.accent);

      const copy = createElement('div', 'operator-plan-copy');
      copy.append(
        createElement('h3', '', plan.title),
        createElement('p', '', plan.text || 'Fria samtal och sms')
      );

      const meta = createElement('ul', 'offer-card-meta operator-plan-meta');
      [
        `${getPlanDataLabel(plan)} surf`,
        `${formatCurrency(plan.price)} kr/m\u00e5n`,
      ].forEach((item) => {
        meta.append(createElement('li', '', item));
      });

      const button = createElement('button', 'offer-card-action', 'V\u00e4lj abonnemang');
      button.type = 'button';
      button.addEventListener('click', () => selectOffer(selectedPlan, row));

      const compareButton = createCompareButton(buildPlanCompareItem(selectedPlan, plan, answers), { compact: false });

      const actions = createElement('div', 'offer-card-actions');
      actions.append(compareButton, button);

      row.append(createGiftCardHeader(), copy, meta, actions);
      fragment.append(row);
    });

    if (addonPlan) {
      const row = createElement('div', 'operator-plan-row operator-plan-row--addon offer-card--addon');
      row.style.setProperty('--offer-accent', offer.accent);

      const copy = createElement('div', 'operator-plan-copy');
      copy.append(
        createElement('h3', '', addonPlan.title),
        createElement('p', '', addonPlan.text || `Extra familjemedlem för ${formatCurrency(addonPlan.price)} kr/mån`)
      );

      const meta = createElement('ul', 'offer-card-meta operator-plan-meta');
      [
        `${formatCurrency(addonPlan.addonPrice ?? addonPlan.price)} kr/mån`,
        'Extra familjemedlem',
      ].forEach((item) => {
        meta.append(createElement('li', '', item));
      });

      const button = createElement('button', 'offer-card-action', 'Välj abonnemang först');
      button.type = 'button';
      button.disabled = true;
      button.dataset.addonButton = 'true';
      button.addEventListener('click', () => selectAddon(addonPlan, row));

      const compareButton = createCompareButton(buildAddonCompareItem(addonPlan, offer), { compact: false });

      const actions = createElement('div', 'offer-card-actions');
      actions.append(compareButton, button);

      row.append(copy, meta, actions);
      fragment.append(row);
    }

    if (!fragment.childNodes.length) {
      resultsBox.innerHTML = '<div class="offers-loading">Inga abonnemang hittades f\u00f6r den h\u00e4r operat\u00f6ren just nu.</div>';
    } else {
      resultsBox.replaceChildren(fragment);
    }
    syncAddonButtons();
  } catch {
    resultsBox.innerHTML = '<div class="offers-loading">Kunde inte h\u00e4mta abonnemang just nu.</div>';
  }
};

const finishOfferQuestions = (offer, answers, card) => {
  offer.answers = answers;
  renderPlanOffers(offer, answers, card);
};

const renderBindingQuestion = (offer, card, answers) => {
  const questionBox = card.querySelector('.offer-card-questions');
  if (!questionBox) return;

  questionBox.innerHTML = [
    '<p class="offer-question-kicker">Fr&aring;ga 2 av 2</p>',
    '<h4>Har du bindningstid?</h4>',
    '<div class="offer-question-actions">',
    '  <button type="button" data-binding="yes">Ja</button>',
    '  <button type="button" data-binding="no">Nej</button>',
    '  <button type="button" data-binding="unknown">Vet ej</button>',
    '</div>',
    '<div class="offer-binding-date is-hidden">',
    '  <label for="bindingEndDate">N&auml;r upph&ouml;r den?</label>',
    '  <input id="bindingEndDate" type="date" />',
    '  <button class="offer-card-action" type="button" data-finish-date>Forts&auml;tt</button>',
    '</div>',
  ].join('');

  questionBox.querySelectorAll('[data-binding]').forEach((button) => {
    button.addEventListener('click', () => {
      answers.binding = button.dataset.binding;

      if (answers.binding === 'yes') {
        questionBox.querySelector('.offer-binding-date')?.classList.remove('is-hidden');
        questionBox.querySelector('#bindingEndDate')?.focus();
        return;
      }

      answers.bindingEndDate = null;
      finishOfferQuestions(offer, answers, card);
    });
  });

  questionBox.querySelector('[data-finish-date]')?.addEventListener('click', () => {
    const dateInput = questionBox.querySelector('#bindingEndDate');
    answers.bindingEndDate = dateInput?.value || null;

    if (!answers.bindingEndDate) {
      dateInput?.focus();
      return;
    }

    finishOfferQuestions(offer, answers, card);
  });
};

const startOfferQuestions = (offer, card) => {
  resetOfferQuestions();
  selectedOffer = null;
  rewardSection?.classList.add('is-hidden');

  const answers = {};
  const questionBox = createElement('div', 'offer-card-questions');
  questionBox.innerHTML = [
    '<p class="offer-question-kicker">Fr&aring;ga 1 av 2</p>',
    `<h4>Har du ${offer.provider} idag?</h4>`,
    '<div class="offer-question-actions">',
    '  <button type="button" data-current-operator="yes">Ja</button>',
    '  <button type="button" data-current-operator="no">Nej</button>',
    '</div>',
  ].join('');

  card.classList.add('is-answering');
  card.querySelector('.offer-card-details')?.classList.add('is-hidden');
  card.append(questionBox);

  questionBox.querySelectorAll('[data-current-operator]').forEach((button) => {
    button.addEventListener('click', () => {
      answers.currentOperator = button.dataset.currentOperator;
      renderBindingQuestion(offer, card, answers);
    });
  });
};

const renderOperatorFilter = () => {
  if (!operatorFilter) return;

  const fragment = document.createDocumentFragment();
  ['Alla', ...offers.map((offer) => offer.provider)].forEach((operator) => {
    const button = createElement('button', 'operator-filter-button', operator);
    const isActive = operator === activeOperator;
    button.type = 'button';
    button.dataset.operator = operator;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
    button.addEventListener('click', () => {
      activeOperator = operator;
      renderOperatorFilter();
      renderOffers();
    });
    fragment.append(button);
  });
  operatorFilter.replaceChildren(fragment);
};

const getPlanDataValue = (plan) => (
  Number(plan.dataAmount) >= 999 ? 'unlimited' : String(Number(plan.dataAmount) || 0)
);

const updateRangeProgress = (input) => {
  if (!input) return;
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 1;
  const progress = ((Number(input.value) - min) / Math.max(max - min, 1)) * 100;
  input.style.setProperty('--range-progress', `${progress}%`);
};

const renderDataFilter = (plans) => {
  if (!dataFilter || dataFilter.dataset.ready === 'true') return;

  const values = [...new Set(
    plans
      .filter((plan) => ['mobil', 'mobile_subscription'].includes(plan.category))
      .filter((plan) => !plan.isFamilyPlan && plan.runtimeSellable !== false)
      .map((plan) => Number(plan.dataAmount) || 0)
      .filter((value) => value > 0 && value < 999)
  )].sort((left, right) => left - right);

  dataSteps = values.map(String);
  if (plans.some((plan) => !plan.isFamilyPlan && Number(plan.dataAmount) >= 999)) {
    dataSteps.push('unlimited');
  }

  dataFilter.min = '0';
  dataFilter.max = String(Math.max(dataSteps.length - 1, 0));
  dataFilter.value = String(Math.min(1, Math.max(dataSteps.length - 1, 0)));
  dataFilter.dataset.values = dataSteps.join(',');
  dataFilter.dataset.ready = 'true';
  if (dataFilterTicks) {
    dataFilterTicks.replaceChildren(...dataSteps.map((value) => {
      const tick = document.createElement('span');
      tick.dataset.label = value === 'unlimited' ? '∞' : value;
      return tick;
    }));
  }
  updateRangeProgress(dataFilter);
  activeData = 'all';
  if (dataFilterValue) dataFilterValue.textContent = 'Alla';
  dataFilterAll?.classList.add('is-active');
  dataFilterAll?.setAttribute('aria-pressed', 'true');
};

const updateDataFilterValue = () => {
  activeData = dataSteps[Number(dataFilter?.value) || 0] || null;
  updateRangeProgress(dataFilter);
  if (!dataFilterValue) return;
  dataFilterValue.textContent = activeData === 'unlimited'
      ? '∞ Obegränsad'
      : activeData
        ? `${activeData} GB`
        : '—';
  dataFilterAll?.classList.remove('is-active');
  dataFilterAll?.setAttribute('aria-pressed', 'false');
};

const createPlanCard = (plan) => {
  const operatorOffer = getOperatorOffer(plan.operator);
  const selectedPlan = buildSelectedPlanOffer(plan, {});
  const card = createElement('article', 'offer-card plan-card');
  card.dataset.operator = plan.operator;
  card.style.setProperty('--offer-accent', operatorOffer.accent || 'var(--accent)');

  const logoBackground = createElement('div', 'offer-card-logo-background');
  const logoStage = createElement('div', 'offer-card-logo-stage');
  const logoSource = plan.logo || operatorOffer.logo;
  logoBackground.style.backgroundImage = `url("${String(logoSource).replace(/"/g, '\\"')}")`;
  logoBackground.setAttribute('aria-hidden', 'true');
  logoStage.append(logoBackground);

  const details = createElement('div', 'offer-card-details');
  const heading = createElement('div', 'offer-card-copy');
  heading.append(
    createElement('span', 'plan-operator-name', plan.operator),
    createElement('h3', '', getPlanDataLabel(plan))
  );

  const price = createElement('p', 'plan-price');
  price.innerHTML = `<strong>${formatCurrency(plan.price)} kr</strong><span>/mån</span>`;

  const meta = createElement('ul', 'offer-card-meta');
  ['Fria samtal och sms'].forEach((item) => {
    meta.append(createElement('li', '', item));
  });

  const button = createElement('button', 'offer-card-action', 'Välj abonnemang');
  button.type = 'button';
  button.addEventListener('click', () => selectOffer(selectedPlan, card));

  const actions = createElement('div', 'offer-card-actions');
  actions.append(
    createCompareButton(buildPlanCompareItem(selectedPlan, plan, {}), { compact: false }),
    button
  );

  details.append(heading, price, meta, actions);
  card.append(createGiftCardHeader(), logoStage, details);
  return card;
};

const renderOffers = async () => {
  if (!offersContainer) {
    return;
  }

  offersContainer.innerHTML = '<div class="offers-loading">Hämtar abonnemang...</div>';

  try {
    const plans = await loadPlans();
    renderDataFilter(plans);
    const visiblePlans = plans
      .filter((plan) => ['mobil', 'mobile_subscription'].includes(plan.category))
      .filter((plan) => !plan.isFamilyPlan)
      .filter((plan) => plan.runtimeSellable !== false)
      .filter((plan) => activeOperator === 'Alla' || plan.operator === activeOperator)
      .filter((plan) => activeData === 'all' || getPlanDataValue(plan) === activeData)
      .sort((left, right) => (
        (Number(left.price) || Number.POSITIVE_INFINITY) -
        (Number(right.price) || Number.POSITIVE_INFINITY) ||
        (left.dataAmount || 0) - (right.dataAmount || 0) ||
        String(left.operator).localeCompare(String(right.operator), 'sv')
      ));

    const fragment = document.createDocumentFragment();
    visiblePlans.forEach((plan) => fragment.append(createPlanCard(plan)));
    offersContainer.replaceChildren(fragment);
  } catch {
    offersContainer.innerHTML = '<div class="offers-loading">Kunde inte hämta abonnemang just nu.</div>';
  }
};

const buildFallbackMobileCart = (rewards) => {
  if (!selectedOffer || !rewardGrid) {
    return null;
  }

  const addonPrice = Number(selectedOffer.addon?.addonPrice ?? selectedOffer.addon?.price) || 0;
  const persons = selectedOffer.addon ? 2 : 1;
  const monthlyPrice = (Number(selectedOffer.price) || 0) + addonPrice;
  const cartItem = {
    cartItemId: `${selectedOffer.operator || selectedOffer.provider}-${Date.now()}`,
    offerId: selectedOffer.title,
    operator: selectedOffer.operator || selectedOffer.provider,
    title: selectedOffer.title || selectedOffer.data || 'Mobilabonnemang',
    logo: selectedOffer.logo,
    data: selectedOffer.data,
    price: monthlyPrice,
    monthlyPrice: Number(selectedOffer.monthlyPrice ?? selectedOffer.price) + addonPrice,
    regularMonthlyPrice: Number(
      selectedOffer.monthlyPrice ?? selectedOffer.price
    ) + addonPrice,
    bindingMonths: Number(selectedOffer.bindingMonths) || 0,
    noticePeriodMonths: Number(selectedOffer.noticePeriodMonths) || 0,
    startFee: Number(selectedOffer.startFee) || 0,
    invoiceFee: Number(selectedOffer.invoiceFee) || 0,
    invoiceFeeOptional: selectedOffer.invoiceFeeOptional !== false,
    pricePerPerson: persons > 1 ? Math.round(monthlyPrice / persons) : 0,
    persons,
    phoneLines: persons,
    productType: 'mobile',
    unitLabel: 'abonnemang',
    rewardTotal: selectedOffer.reward,
    rewardMixLabel: giftCardPlaceholder,
    rewards,
    addon: selectedOffer.addon || null,
    answers: selectedOffer.answers || {},
    features: [
      'Fria samtal och sms',
      '5G & eSIM',
      selectedOffer.addon ? `${selectedOffer.addon.title} ${formatCurrency(addonPrice)} kr/mån` : '',
    ].filter(Boolean),
  };

  return {
    cartItem,
    state: {
      persons,
      operator: cartItem.operator,
      wishes: ['Mobilabonnemang'],
      answers: cartItem.answers,
    },
  };
};

const createMobileCartItem = async (rewards) => {
  try {
    return await apiFetchJson('https://db-qtmd.onrender.com/api/mobile/cart-item', {
      label: 'Mobilabonnemang varukorg',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: selectedOffer.planId || selectedOffer.offerId || selectedOffer.title,
        addonPlanId: selectedOffer.addon?.id || null,
        rewards,
        answers: selectedOffer.answers || {},
      }),
    });
  } catch {
    return buildFallbackMobileCart(rewards);
  }
};

rewardContinueBtn?.addEventListener('click', async () => {
  if (!selectedOffer || !rewardGrid) {
    return;
  }

  const allocations = [...rewardGrid.querySelectorAll('.reward-choice')]
    .map((choice) => {
      const name = choice.querySelector('strong')?.textContent || '';
      const value = Math.max(Number(choice.querySelector('input')?.value) || 0, 0);
      return { name, value };
    })
    .filter((item) => item.value > 0);
  const rewards = allocations.reduce((result, item) => {
    result[item.name] = item.value;
    return result;
  }, {});
  const result = await createMobileCartItem(rewards);

  if (!result?.cartItem || !result?.state) {
    return;
  }

  const cart = window.DealettCart.appendItem(result.cartItem, {
    state: result.state,
  });
  openCartDrawer(cart);
});

window.DealettCart?.bindDrawerEvents();
dataFilter?.addEventListener('change', () => {
  updateDataFilterValue();
  renderOffers();
});
dataFilter?.addEventListener('input', updateDataFilterValue);
dataFilterAll?.addEventListener('click', () => {
  activeData = 'all';
  if (dataFilterValue) dataFilterValue.textContent = 'Alla';
  dataFilterAll.classList.add('is-active');
  dataFilterAll.setAttribute('aria-pressed', 'true');
  renderOffers();
});
renderOperatorFilter();
renderOffers();
})();
