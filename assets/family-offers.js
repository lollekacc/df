(() => {
const offersContainer = document.querySelector('#offers-container');
const rewardSection = document.querySelector('#rewardSection');
const rewardGrid = document.querySelector('#rewardGrid');
const totalReward = document.querySelector('#totalReward');
const remainingSum = document.querySelector('#remainingSum');
const rewardProgressFill = document.querySelector('#rewardProgressFill');
const rewardContinueBtn = document.querySelector('#rewardContinueBtn');
const operatorFilter = document.querySelector('#operatorFilter');
const familySize = document.querySelector('#familySize');
const familySizeValue = document.querySelector('#familySizeValue');
const dataFilter = document.querySelector('#dataFilter');
const dataFilterValue = document.querySelector('#dataFilterValue');
const dataFilterAll = document.querySelector('#dataFilterAll');
const dataFilterTicks = document.querySelector('#dataFilterTicks');

const currency = new Intl.NumberFormat('sv-SE');
const giftCardPlaceholder = 'Presentkort: XXX kr';

const offers = [
  {
    provider: 'Telia',
    label: 'Telia Familj',
    logo: 'images/telia.png',
    accent: '#6E2380',
    members: '4 abonnemang',
    surf: 'Obegr\u00e4nsad surf',
    reward: 0,
  },
  {
    provider: 'Telenor',
    label: 'Telenor Familj',
    logo: 'images/telenor.jpg',
    accent: '#00437E',
    members: '4 abonnemang',
    surf: 'Obegr\u00e4nsad surf',
    reward: 0,
  },
  {
    provider: 'Tre',
    label: 'Tre Familj',
    logo: 'images/tre.jpg',
    accent: '#E65C00',
    members: '5 abonnemang',
    surf: 'Obegr\u00e4nsad surf',
    reward: 0,
  },
  {
    provider: 'Tele2',
    label: 'Tele2 Familj',
    logo: 'images/tele2.png',
    accent: '#003A6E',
    members: '4 abonnemang',
    surf: 'Obegr\u00e4nsad surf',
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

const getStreamingServiceName = (service) => {
  if (typeof service === 'string') return service;
  if (!service || typeof service !== 'object') return '';
  return service.name || service.service || service.title || '';
};

const getStreamingServiceShortName = (service) => getStreamingServiceName(service)
  .replace(/\s+Standard med reklam/gi, '')
  .replace(/\s+Basic med reklam/gi, '')
  .replace(/\s+Standard/gi, '')
  .replace(/\s+med reklam/gi, '')
  .trim();

const getStreamingServicePrice = (service) => {
  if (typeof service === 'number') return Math.max(service, 0);
  if (!service || typeof service !== 'object') return 0;
  const price = Number(service.price ?? service.monthlyPrice ?? service.monthlyValue ?? service.value);
  return Number.isFinite(price) ? Math.max(price, 0) : 0;
};

const getStreamingServiceValue = (streamingOffer) => (streamingOffer?.services || [])
  .reduce((sum, service) => sum + getStreamingServicePrice(service), 0);

const getPlanStreamingOffer = (plan = {}) => {
  const services = Array.isArray(plan.includedStreaming) ? plan.includedStreaming : [];
  if (!services.length) return null;

  return {
    label: services.map(getStreamingServiceShortName).filter(Boolean).join(', '),
    detail: services.map(getStreamingServiceName).filter(Boolean).join(', '),
    monthlyPrice: Number(plan.price) || 0,
    services,
  };
};

const getStreamingPackageSummaryLabel = (answers = {}) => {
  if (answers.streamingPackage === 'all') return 'Visa alla Telia-varianter';
  if (answers.streamingPackage === 'none') return 'Ingen Telia-streaming';
  return 'Streamingval från mobilplansdatan';
};

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

const getPlanDataLabel = (plan) => {
  if (plan.data) return plan.data;
  if (Number(plan.dataAmount) >= 999) return 'Obegr\u00e4nsad';
  if (Number(plan.dataAmount) > 0) return `${plan.dataAmount} GB`;
  return plan.title || 'Mobilabonnemang';
};

const isMobilePlan = (plan = {}) => ['mobil', 'mobile_subscription'].includes(plan.category);

const loadPlans = async () => {
  if (plansCache) return plansCache;

  const data = await window.DealettNetwork.fetchJson('https://db-qtmd.onrender.com/api/mobile/plans', {
    label: 'Familjabonnemang data',
  });

  if (!Array.isArray(data)) {
    throw new Error('Familjabonnemang data must be an array.');
  }

  plansCache = data;
  return plansCache;
};

const buildFamilyPlanOffer = (basePlan, addonPlan, offer, answers) => {
  const persons = Number(answers.persons) || 1;
  const addonPrice = Number(addonPlan?.addonPrice ?? addonPlan?.price) || 0;
  const extraCount = Math.max(persons - 1, 0);
  const streamingOffer = getPlanStreamingOffer(basePlan);
  const listedBasePrice = Number(basePlan.price) || 0;
  const includedServiceValue = streamingOffer && answers.streamingCalculation === 'include'
    ? getStreamingServiceValue(streamingOffer)
    : 0;
  const effectiveBasePrice = Math.max(listedBasePrice - includedServiceValue, 0);
  const totalMonthlyPrice = effectiveBasePrice + extraCount * addonPrice;
  const listedMonthlyPrice = listedBasePrice + extraCount * addonPrice;

  return {
    provider: offer.label,
    operator: offer.provider,
    title: basePlan.title,
    data: getPlanDataLabel(basePlan),
    members: `${persons} abonnemang`,
    surf: `${getPlanDataLabel(basePlan)} surf`,
    price: totalMonthlyPrice,
    listedMonthlyPrice,
    effectiveBasePrice,
    includedServiceValue,
    streamingOffer,
    streamingCalculation: answers.streamingCalculation || 'unknown',
    internationalTravel: answers.internationalTravel || 'none',
    pricePerPerson: Math.round(totalMonthlyPrice / persons),
    addonPrice,
    logo: basePlan.logo,
    reward: offer.reward,
    accent: offer.accent,
    answers,
  };
};

const getFamilyMonthlyPrice = (basePlan, addonPlan, persons) => {
  const basePrice = Number(basePlan?.price);
  if (!Number.isFinite(basePrice)) return Number.POSITIVE_INFINITY;

  const addonPrice = Number(addonPlan?.addonPrice ?? addonPlan?.price) || 0;
  return basePrice + Math.max(Number(persons) - 1, 0) * addonPrice;
};

const getFamilyCustomerStatusLabel = (answers) => {
  if (answers.customerStatus === 'none') return 'Alla blir nya kunder';
  if (answers.customerStatus === 'all') return 'Alla har redan abonnemang';
  return `${Number(answers.newCustomers) || 0} blir nya kunder`;
};

const getStreamingCalculationLabel = (value) => {
  if (value === 'include') return 'Räkna av tjänstevärde';
  if (value === 'none') return 'Räkna totalpris';
  return 'Vet inte';
};

const getTravelLabel = (value) => {
  if (value === 'eu') return 'Reser inom EU';
  if (value === 'outside_eu') return 'Reser utanför EU';
  return 'Reser inte mycket';
};

const getFamilyPlanReason = (selectedPlan) => {
  const answers = selectedPlan.answers || {};
  const reasons = [
    `${Number(answers.persons) || 1} abonnemang`,
    getFamilyCustomerStatusLabel(answers).toLowerCase(),
    getTravelLabel(answers.internationalTravel).toLowerCase(),
  ];

  if (selectedPlan.streamingOffer) {
    reasons.push(`${selectedPlan.streamingOffer.label} ingår`);
  }

  if (selectedPlan.includedServiceValue > 0) {
    reasons.push(`streamingvärde ${formatCurrency(selectedPlan.includedServiceValue)} kr/mån är avräknat`);
  }

  return `Visas eftersom ni valde ${reasons.join(', ')}.`;
};

const getFamilyAnswerSummary = (answers) => [
  {
    label: 'Antal abonnemang',
    value: `${Number(answers.persons) || 1} abonnemang`,
  },
  {
    label: 'Kundstatus',
    value: getFamilyCustomerStatusLabel(answers),
  },
  answers.streamingPackage
    ? {
      label: 'Streaming',
      value: getStreamingPackageSummaryLabel(answers),
    }
    : null,
  {
    label: 'Streamingkalkyl',
    value: getStreamingCalculationLabel(answers.streamingCalculation),
  },
  {
    label: 'Utlandsresor',
    value: getTravelLabel(answers.internationalTravel),
  },
].filter(Boolean);

const getFamilyAnswerFacts = (answers = {}) => getFamilyAnswerSummary(answers)
  .filter((item) => item.value)
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
  id: `family-operator-${offer.provider}`,
  title: offer.label,
  operator: offer.provider,
  type: 'Familjepaket',
  logo: offer.logo,
  accent: offer.accent,
  facts: [
    { label: 'Typ', value: 'Familjabonnemang' },
    { label: 'Antal abonnemang', value: offer.members },
    { label: 'Surf', value: offer.surf },
    { label: 'Samtal & SMS', value: 'Fria samtal och SMS' },
    { label: 'Presentkort', value: 'XXX kr' },
  ],
});

const buildFamilyCompareItem = (selectedPlan, plan, answers) => ({
  id: `family-plan-${selectedPlan.operator}-${plan.id || selectedPlan.title}-${Number(answers.persons) || 1}`,
  title: selectedPlan.title,
  operator: selectedPlan.operator,
  type: 'Familjepaket',
  logo: selectedPlan.logo,
  accent: selectedPlan.accent,
  facts: [
    { label: 'Typ', value: 'Familjabonnemang' },
    { label: 'Antal abonnemang', value: selectedPlan.members },
    { label: 'Surf', value: selectedPlan.surf },
    { label: 'Pris', value: `${formatCurrency(selectedPlan.price)} kr/m\u00e5n totalt` },
    selectedPlan.listedMonthlyPrice && selectedPlan.listedMonthlyPrice !== selectedPlan.price
      ? { label: 'Listpris', value: `${formatCurrency(selectedPlan.listedMonthlyPrice)} kr/mån totalt` }
      : null,
    { label: 'Pris per person', value: `${formatCurrency(selectedPlan.pricePerPerson)} kr/person` },
    { label: 'Extra abonnemang', value: selectedPlan.addonPrice ? `${formatCurrency(selectedPlan.addonPrice)} kr/st` : '-' },
    selectedPlan.streamingOffer ? { label: 'Streamingpaket', value: selectedPlan.streamingOffer.label } : null,
    selectedPlan.includedServiceValue > 0
      ? { label: 'Avräknat streamingvärde', value: `${formatCurrency(selectedPlan.includedServiceValue)} kr/mån` }
      : null,
    selectedPlan.internationalTravel ? { label: 'Utlandsresor', value: getTravelLabel(selectedPlan.internationalTravel) } : null,
    { label: 'Presentkort', value: 'XXX kr' },
    ...getFamilyAnswerFacts(answers),
  ].filter(Boolean),
});

const renderAnswerSummary = (offer, panel, answers, sourceCard) => {
  let questionBox = panel.querySelector('.offer-card-questions');

  if (!questionBox) {
    questionBox = createElement('div', 'offer-card-questions');
    panel.append(questionBox);
  }

  const kicker = createElement('p', 'offer-question-kicker', 'Dina svar');
  const heading = createElement('h4', '', `${offer.label} matchas med svaren nedan`);
  const list = createElement('dl', 'offer-answer-list');
  const editButton = createElement('button', 'offer-answer-edit', '\u00c4ndra svar');

  getFamilyAnswerSummary(answers).forEach((item) => {
    list.append(
      createElement('dt', '', item.label),
      createElement('dd', '', item.value)
    );
  });

  editButton.type = 'button';
  editButton.addEventListener('click', () => renderPersonQuestion(offer, sourceCard));

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
  selectedOffer = offer;
  const selectedCard = card.closest?.('.offer-card') || card;

  offersContainer?.querySelectorAll('.offer-card, .operator-plan-row').forEach((item) => {
    item.classList.remove('is-selected');
  });

  selectedCard.classList.add('is-selected');
  card.classList.add('is-selected');
  rewardSection?.classList.remove('is-hidden');
  renderRewards(offer);
  rewardSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  resultsBox.innerHTML = '<div class="offers-loading">H\u00e4mtar familjepaket...</div>';

  try {
    const plans = await loadPlans();
    const basePlans = plans
      .filter((plan) => isMobilePlan(plan) && !plan.isFamilyPlan && plan.operator === offer.provider)
      .sort((left, right) => (
        (left.dataAmount || 0) - (right.dataAmount || 0) ||
        (left.price || 0) - (right.price || 0)
      ));
    const addonPlan = plans.find((plan) =>
      isMobilePlan(plan) &&
      plan.isFamilyPlan &&
      plan.familyPriceType === 'addon' &&
      plan.operator === offer.provider
    );
    const fragment = document.createDocumentFragment();

    basePlans.forEach((plan) => {
      const selectedPlan = buildFamilyPlanOffer(plan, addonPlan, offer, answers);
      const row = createElement('div', 'operator-plan-row offer-card--plan');
      row.style.setProperty('--offer-accent', selectedPlan.accent);

      const copy = createElement('div', 'operator-plan-copy');
      copy.append(
        createElement('h3', '', plan.title),
        createElement('p', '', `${selectedPlan.members} | ${selectedPlan.surf}`)
      );

      const meta = createElement('ul', 'offer-card-meta operator-plan-meta');
      [
        `${formatCurrency(selectedPlan.price)} kr/m\u00e5n totalt`,
        selectedPlan.listedMonthlyPrice !== selectedPlan.price
          ? `Listpris: ${formatCurrency(selectedPlan.listedMonthlyPrice)} kr/mån`
          : '',
        `${formatCurrency(selectedPlan.pricePerPerson)} kr/person`,
        selectedPlan.streamingOffer ? `Streaming: ${selectedPlan.streamingOffer.label}` : '',
        selectedPlan.includedServiceValue > 0
          ? `Avräknat tjänstevärde: ${formatCurrency(selectedPlan.includedServiceValue)} kr/mån`
          : '',
        selectedPlan.internationalTravel ? getTravelLabel(selectedPlan.internationalTravel) : '',
        addonPlan ? `Extra: ${formatCurrency(selectedPlan.addonPrice)} kr/st` : '',
      ].filter(Boolean).forEach((item) => {
        meta.append(createElement('li', '', item));
      });

      const reason = createElement('p', 'family-result-reason', getFamilyPlanReason(selectedPlan));
      const button = createElement('button', 'offer-card-action', 'V\u00e4lj familjepaket');
      button.type = 'button';
      button.addEventListener('click', () => selectOffer(selectedPlan, row));

      const compareButton = createCompareButton(buildFamilyCompareItem(selectedPlan, plan, answers), { compact: false });

      const actions = createElement('div', 'offer-card-actions');
      actions.append(compareButton, button);

      row.append(createGiftCardHeader(), copy, meta, reason, actions);
      fragment.append(row);
    });

    if (!fragment.childNodes.length) {
      resultsBox.innerHTML = '<div class="offers-loading">Inga familjepaket hittades f\u00f6r den h\u00e4r operat\u00f6ren just nu.</div>';
    } else {
      resultsBox.replaceChildren(fragment);
    }
  } catch {
    resultsBox.innerHTML = '<div class="offers-loading">Kunde inte h\u00e4mta familjepaket just nu.</div>';
  }
};

const finishOfferQuestions = (offer, answers, card) => {
  offer.answers = answers;
  renderPlanOffers(offer, answers, card);
};

const renderTravelQuestion = (offer, card, answers) => {
  const questionBox = card.querySelector('.offer-card-questions');
  if (!questionBox) return;

  questionBox.innerHTML = [
    '<p class="offer-question-kicker">Fr&aring;ga 4 av 4</p>',
    '<h4>Reser ni mycket utomlands?</h4>',
    '<div class="family-status-options">',
    '  <button type="button" data-travel="none">Nej</button>',
    '  <button type="button" data-travel="eu">Inom EU</button>',
    '  <button type="button" data-travel="outside_eu">Utanf&ouml;r EU</button>',
    '</div>',
  ].join('');

  questionBox.querySelectorAll('[data-travel]').forEach((button) => {
    button.addEventListener('click', () => {
      answers.internationalTravel = button.dataset.travel || 'none';
      finishOfferQuestions(offer, answers, card);
    });
  });
};

const renderStreamingQuestion = (offer, card, answers) => {
  const questionBox = card.querySelector('.offer-card-questions');
  if (!questionBox) return;

  const isTelia = offer.provider === 'Telia';
  const streamingSummary = isTelia
    ? [
      '<p class="family-streaming-note">Vi visar Telias obegr&auml;nsade val i resultatet, s&aring; ni slipper v&auml;lja streamingpaket h&auml;r.</p>',
      '<div class="family-streaming-summary" aria-label="Telia-varianter som visas">',
      '<span>Aktuella varianter hämtas från mobilplansdatan</span>',
      '</div>',
    ].join('')
    : '<p class="family-streaming-note">Den här operatören har inga separata streamingval i vår familjekalkyl just nu.</p>';

  questionBox.innerHTML = [
    '<p class="offer-question-kicker">Fr&aring;ga 3 av 4</p>',
    '<h4>Ska streaming r&auml;knas in?</h4>',
    streamingSummary,
    '<div class="family-calc-options">',
    '  <button type="button" data-streaming-calc="none">Visa totalpris</button>',
    '  <button type="button" data-streaming-calc="include">R&auml;kna av streamingv&auml;rde</button>',
    '  <button type="button" data-streaming-calc="unknown">Vet inte</button>',
    '</div>',
    '<button class="offer-card-action family-question-next" type="button" data-next-streaming>Forts&auml;tt</button>',
  ].join('');

  answers.streamingPackage = isTelia ? 'all' : 'none';

  questionBox.querySelectorAll('[data-streaming-calc]').forEach((button) => {
    button.addEventListener('click', () => {
      answers.streamingCalculation = button.dataset.streamingCalc || 'unknown';
      questionBox.querySelectorAll('[data-streaming-calc]').forEach((item) => item.classList.remove('is-selected'));
      button.classList.add('is-selected');
    });
  });

  questionBox.querySelector('[data-next-streaming]')?.addEventListener('click', () => {
    if (!answers.streamingCalculation) {
      questionBox.querySelector('[data-streaming-calc]')?.focus();
      return;
    }

    renderTravelQuestion(offer, card, answers);
  });
};

const renderCustomerQuestion = (offer, card, answers) => {
  const questionBox = card.querySelector('.offer-card-questions');
  if (!questionBox) return;

  questionBox.innerHTML = [
    '<p class="offer-question-kicker">Fr&aring;ga 2 av 4</p>',
    '<h4>Har n&aring;gon av er redan abonnemang hos denna operat&ouml;r idag?</h4>',
    '<div class="family-status-options">',
    '  <button type="button" data-customer-status="none">Nej, alla blir nya kunder</button>',
    '  <button type="button" data-customer-status="partial">Ja, vissa har redan abonnemang</button>',
    '  <button type="button" data-customer-status="all">Ja, alla har redan abonnemang</button>',
    '</div>',
    '<div class="family-new-customers is-hidden">',
    '  <label for="newCustomersSelect">Hur m&aring;nga blir nya kunder?</label>',
    '  <select id="newCustomersSelect"></select>',
    '  <button class="offer-card-action" type="button" data-finish-customers>Forts&auml;tt</button>',
    '</div>',
  ].join('');

  const newCustomersBox = questionBox.querySelector('.family-new-customers');
  const select = questionBox.querySelector('#newCustomersSelect');
  const maxNewCustomers = Math.max((Number(answers.persons) || 1) - 1, 1);

  if (select) {
    select.innerHTML = '<option value="">V\u00e4lj antal</option>';

    for (let count = 1; count <= maxNewCustomers; count += 1) {
      select.append(new Option(String(count), String(count)));
    }
  }

  questionBox.querySelectorAll('[data-customer-status]').forEach((button) => {
    button.addEventListener('click', () => {
      answers.customerStatus = button.dataset.customerStatus;

      if (answers.customerStatus === 'partial') {
        newCustomersBox?.classList.remove('is-hidden');
        select?.focus();
        return;
      }

      answers.newCustomers = answers.customerStatus === 'none' ? answers.persons : 0;
      renderStreamingQuestion(offer, card, answers);
    });
  });

  questionBox.querySelector('[data-finish-customers]')?.addEventListener('click', () => {
    const value = Number(select?.value) || 0;

    if (!value) {
      select?.focus();
      return;
    }

    answers.newCustomers = value;
    renderStreamingQuestion(offer, card, answers);
  });
};

const renderPersonQuestion = (offer, card) => {
  resetOfferQuestions();
  selectedOffer = null;
  rewardSection?.classList.add('is-hidden');

  const answers = {};
  const questionBox = createElement('div', 'offer-card-questions');
  questionBox.innerHTML = [
    '<p class="offer-question-kicker">Fr&aring;ga 1 av 4</p>',
    '<h4>Hur m&aring;nga abonnemang vill ni ha?</h4>',
    '<div class="family-person-grid">',
    [1, 2, 3, 4, 5].map((count) => `<button type="button" data-persons="${count}">${count}</button>`).join(''),
    '  <button class="family-more-toggle" type="button" data-more-persons aria-expanded="false">Fler</button>',
    '</div>',
    '<div class="family-person-grid family-person-grid--more is-hidden">',
    [6, 7, 8, 9, 10].map((count) => `<button type="button" data-persons="${count}">${count}</button>`).join(''),
    '</div>',
  ].join('');

  card.classList.add('is-answering');
  card.querySelector('.offer-card-details')?.classList.add('is-hidden');
  card.append(questionBox);

  questionBox.querySelector('[data-more-persons]')?.addEventListener('click', (event) => {
    const moreGrid = questionBox.querySelector('.family-person-grid--more');
    const isOpening = moreGrid?.classList.contains('is-hidden');

    moreGrid?.classList.toggle('is-hidden', !isOpening);
    event.currentTarget.classList.toggle('is-active', isOpening);
    event.currentTarget.setAttribute('aria-expanded', String(isOpening));
  });

  questionBox.querySelectorAll('[data-persons]').forEach((button) => {
    button.addEventListener('click', () => {
      answers.persons = Number(button.dataset.persons) || 1;
      renderCustomerQuestion(offer, card, answers);
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
      .filter((plan) => isMobilePlan(plan))
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

const updateFamilySizeValue = () => {
  updateRangeProgress(familySize);
  if (familySizeValue) familySizeValue.textContent = familySize?.value || '2';
};

const createFamilyPlanCard = (plan, addonPlan, offer, persons) => {
  const answers = {
    persons,
    customerStatus: 'none',
    streamingPackage: 'all',
    streamingCalculation: 'none',
    internationalTravel: 'none',
  };
  const selectedPlan = buildFamilyPlanOffer(plan, addonPlan, offer, answers);
  const dataLabel = getPlanDataLabel(plan);
  const surfLabel = dataLabel === 'Obegränsad' ? 'obegränsad' : dataLabel;
  const card = createElement('article', 'offer-card plan-card family-plan-card');
  card.dataset.operator = plan.operator;
  card.style.setProperty('--offer-accent', offer.accent);

  const logoBackground = createElement('div', 'offer-card-logo-background');
  const logoStage = createElement('div', 'offer-card-logo-stage');
  const logoSource = plan.logo || offer.logo;
  logoBackground.style.backgroundImage = `url("${String(logoSource).replace(/"/g, '\\"')}")`;
  logoBackground.setAttribute('aria-hidden', 'true');
  logoStage.append(logoBackground);

  const details = createElement('div', 'offer-card-details');
  const heading = createElement('div', 'offer-card-copy');
  heading.append(
    createElement('span', 'plan-operator-name', plan.operator),
    createElement('h3', '', dataLabel),
    createElement('p', 'plan-description', `${persons} abonnemang med ${surfLabel} surf per abonnemang.`)
  );

  const price = createElement('p', 'plan-price');
  price.innerHTML = `<strong>${formatCurrency(selectedPlan.price)} kr</strong><span>/mån totalt</span>`;
  const perPerson = createElement('p', 'plan-price-detail', `${formatCurrency(selectedPlan.pricePerPerson)} kr per person`);

  const meta = createElement('ul', 'offer-card-meta');
  [
    `${formatCurrency(selectedPlan.addonPrice)} kr per extra abonnemang`,
  ].forEach((item) => meta.append(createElement('li', '', item)));

  const button = createElement('button', 'offer-card-action', 'Välj familjeabonnemang');
  button.type = 'button';
  button.addEventListener('click', () => selectOffer(selectedPlan, card));

  const actions = createElement('div', 'offer-card-actions');
  actions.append(
    createCompareButton(buildFamilyCompareItem(selectedPlan, plan, answers), { compact: false }),
    button
  );

  details.append(heading, price, perPerson, meta, actions);
  card.append(createGiftCardHeader(), logoStage, details);
  return card;
};

const renderOffers = async () => {
  if (!offersContainer) {
    return;
  }

  offersContainer.innerHTML = '<div class="offers-loading">Hämtar familjeabonnemang...</div>';

  try {
    const persons = Number(familySize?.value) || 2;
    const plans = await loadPlans();
    renderDataFilter(plans);
    const addons = new Map(
      plans
        .filter((plan) => isMobilePlan(plan) && plan.isFamilyPlan && plan.familyPriceType === 'addon')
        .filter((plan) => plan.runtimeSellable !== false)
        .map((plan) => [plan.operator, plan])
    );
    const visiblePlans = plans
      .filter((plan) => isMobilePlan(plan) && !plan.isFamilyPlan)
      .filter((plan) => plan.runtimeSellable !== false)
      .filter((plan) => addons.has(plan.operator))
      .filter((plan) => activeOperator === 'Alla' || plan.operator === activeOperator)
      .filter((plan) => activeData === 'all' || getPlanDataValue(plan) === activeData)
      .sort((left, right) => (
        getFamilyMonthlyPrice(left, addons.get(left.operator), persons) -
        getFamilyMonthlyPrice(right, addons.get(right.operator), persons) ||
        (left.dataAmount || 0) - (right.dataAmount || 0) ||
        String(left.operator).localeCompare(String(right.operator), 'sv')
      ));
    const fragment = document.createDocumentFragment();
    visiblePlans.forEach((plan) => {
      const offer = offers.find((item) => item.provider === plan.operator);
      if (offer && addons.has(plan.operator)) {
        fragment.append(createFamilyPlanCard(plan, addons.get(plan.operator), offer, persons));
      }
    });
    offersContainer.replaceChildren(fragment);
  } catch {
    offersContainer.innerHTML = '<div class="offers-loading">Kunde inte hämta familjeabonnemang just nu.</div>';
  }
};

rewardContinueBtn?.addEventListener('click', () => {
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
  const persons = Number(selectedOffer.answers?.persons) || Number.parseInt(selectedOffer.members, 10) || 1;
  const cartItem = {
    cartItemId: `${selectedOffer.operator || selectedOffer.provider}-${Date.now()}`,
    offerId: selectedOffer.title,
    operator: selectedOffer.operator || selectedOffer.provider,
    title: selectedOffer.title || 'Familjepaket',
    logo: selectedOffer.logo,
    data: selectedOffer.surf || selectedOffer.data,
    price: selectedOffer.price || 0,
    pricePerPerson: selectedOffer.pricePerPerson || 0,
    persons,
    phoneLines: persons,
    productType: 'family',
    unitLabel: 'abonnemang',
    rewardTotal: selectedOffer.reward,
    rewardMixLabel: giftCardPlaceholder,
    rewards,
    answers: selectedOffer.answers || {},
    streamingOffer: selectedOffer.streamingOffer || null,
    listedMonthlyPrice: selectedOffer.listedMonthlyPrice || selectedOffer.price || 0,
    includedServiceValue: selectedOffer.includedServiceValue || 0,
    internationalTravel: selectedOffer.internationalTravel || selectedOffer.answers?.internationalTravel || 'none',
    features: [
      selectedOffer.members,
      'Samlad faktura',
      'Fria samtal och sms',
      selectedOffer.streamingOffer ? `Streaming: ${selectedOffer.streamingOffer.label}` : '',
      selectedOffer.includedServiceValue ? `Streamingvärde avräknat ${formatCurrency(selectedOffer.includedServiceValue)} kr/mån` : '',
      selectedOffer.internationalTravel ? getTravelLabel(selectedOffer.internationalTravel) : '',
      selectedOffer.addonPrice ? `Extra abonnemang ${formatCurrency(selectedOffer.addonPrice)} kr/st` : '',
    ].filter(Boolean),
  };

  const cart = window.DealettCart.appendItem(cartItem, {
    state: {
      persons,
      operator: cartItem.operator,
      wishes: ['Familjabonnemang'],
      answers: cartItem.answers,
    },
  });
  openCartDrawer(cart);
});

window.DealettCart?.bindDrawerEvents();
familySize?.addEventListener('change', () => {
  updateFamilySizeValue();
  selectedOffer = null;
  rewardSection?.classList.add('is-hidden');
  renderOffers();
});
familySize?.addEventListener('input', updateFamilySizeValue);
dataFilter?.addEventListener('change', () => {
  updateDataFilterValue();
  selectedOffer = null;
  rewardSection?.classList.add('is-hidden');
  renderOffers();
});
dataFilter?.addEventListener('input', updateDataFilterValue);
dataFilterAll?.addEventListener('click', () => {
  activeData = 'all';
  if (dataFilterValue) dataFilterValue.textContent = 'Alla';
  dataFilterAll.classList.add('is-active');
  dataFilterAll.setAttribute('aria-pressed', 'true');
  selectedOffer = null;
  rewardSection?.classList.add('is-hidden');
  renderOffers();
});
renderOperatorFilter();
updateFamilySizeValue();
renderOffers();
})();
