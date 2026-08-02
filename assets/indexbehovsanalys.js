document.addEventListener("DOMContentLoaded", () => {
  const quiz = createIndexQuiz();
  quiz.init();
});

function createIndexQuiz() {
  const state = {
    currentStep: 0,
    persons: null,
    operators: [],
    operatorDates: [],
    operatorNoBinding: [],
    selectedOperator: null,
    customerStatus: null,
    existingCustomers: null,
    newCustomers: null,
    data: null,
    price: null,
    binding: null,
    streamingCalculation: null,
    streamingServices: [],
    streamingMonthlyCosts: {},
    internationalTravel: null,
    internationalUsage: null
  };

  const dom = {
    intro: document.getElementById("quiz-intro"),
    wrapper: document.getElementById("quiz-steps-wrapper"),
    slot: document.getElementById("quiz-slot"),
    stack: document.getElementById("quiz-card-stack"),
    startButton: document.getElementById("quiz-start"),
    heroStartButton: document.getElementById("hero-start-analysis"),
    hero: document.querySelector(".hero"),
    heroVisual: document.querySelector(".hero-visual"),
    heroMount: document.getElementById("hero-quiz-mount"),
    familyOfferGrid: document.querySelector(".family-offer-grid"),
    operatorContainer: document.getElementById("operator-per-person"),
    operatorTemplate: document.getElementById("operator-picker-template"),
    personExtraOptions: document.getElementById("person-extra-options"),
    personMoreToggle: document.getElementById("person-more-toggle"),
    customerOperatorQuestion: document.getElementById("customer-operator-question"),
    newCustomersField: document.getElementById("new-customers-field"),
    newCustomersSelect: document.getElementById("new-customers-select"),
    offersContainer: document.getElementById("offers-container"),
    deploymentGrid: document.querySelector(".deployment-card-grid")
  };

  const steps = Array.from(document.querySelectorAll("#quiz-card-stack .quiz-step-card"));
  const questionStepCount = Math.max(steps.length - 1, 0);
  const resultStepIndex = Math.max(steps.length - 1, 0);
  const sectionWrapperAnchor = document.createComment("quiz section mount");
  const selectionFeedbackMs = 220;
  let recommendationsRequestId = 0;
  let lastOfferCalculation = null;
  let pendingAdvanceTimer = null;

  function init() {
    if (!dom.wrapper || !dom.stack || !steps.length) return;

    window.abonState = state;

    bindEvents();
    updateStepState(0);
    syncProgress();
    syncStackHeight();

    if (new URLSearchParams(window.location.search).get("start") === "quiz") {
      requestAnimationFrame(() => startQuiz({ inHero: true }));
    }
  }

  function bindEvents() {
    dom.startButton?.addEventListener("click", startQuiz);
    dom.heroStartButton?.addEventListener("click", event => {
      event.preventDefault();
      startQuiz({ inHero: true });
    });
    document.querySelectorAll("[data-home-quiz-link]").forEach(link => {
      link.addEventListener("click", event => {
        event.preventDefault();
        startQuiz({ inHero: true });
        dom.hero?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    dom.familyOfferGrid?.addEventListener("click", handleFamilyOfferClick);
    dom.wrapper.addEventListener("click", handleWrapperClick);
    dom.wrapper.addEventListener("change", handleWrapperChange);
    window.addEventListener("resize", syncStackHeight);
    bindNewsletterForm();
    bindStaticOfferCards();

    steps.forEach((step, index) => {
      const backButton = step.querySelector(".quiz-back-inline");
      backButton?.addEventListener("click", event => {
        event.preventDefault();

        if (index === 0) {
          showIntro();
          return;
        }

        showStep(getPreviousStepIndex(index));
      });
    });
  }

  function handleWrapperClick(event) {
    const personToggle = event.target.closest("[data-person-toggle]");
    if (personToggle) {
      toggleExtraPersonOptions();
      return;
    }

    const noBindingOption = event.target.closest("[data-no-binding]");
    if (noBindingOption) {
      handleOperatorNoBinding(noBindingOption);
      return;
    }

    const streamingNext = event.target.closest("[data-streaming-next]");
    if (streamingNext) {
      const step = streamingNext.closest(".quiz-step-card");
      if (step) handleStreamingStep(step);
      return;
    }

    const option = event.target.closest(".quiz-option");
    if (option) {
      handleOptionClick(option);
      return;
    }

    const stackedStep = event.target.closest(".quiz-step-card.stacked-card");
    if (!stackedStep || event.target.closest("button")) return;

    const stackedIndex = steps.indexOf(stackedStep);
    if (stackedIndex >= 0) {
      showStep(stackedIndex);
    }
  }

  function handleWrapperChange(event) {
    if (event.target.matches("[data-operator-date]")) {
      handleOperatorDateChange(event.target);
      return;
    }

    if (event.target !== dom.newCustomersSelect) return;

    const existingCustomers = Number(dom.newCustomersSelect.value);
    if (!existingCustomers) return;

    state.existingCustomers = existingCustomers;
    state.newCustomers = Math.max((state.persons || 1) - existingCustomers, 0);
    prepareOperatorQuestion(existingCustomers);
  }

  function handleFamilyOfferClick(event) {
    const card = event.target.closest("[data-family-offer]");
    if (!card) return;

    event.preventDefault();

    const item = buildFamilyCartItem(card);
    persistCartItem(item, {
      persons: 4,
      data: getDataTier(item.dataAmount),
      operator: item.operator,
      binding: null,
      bindingEndDate: null,
      wishes: ["Familjabonnemang"],
      operatorsByPerson: Array.from({ length: 4 }, () => "Andra / Ingen"),
      bindingsByPerson: Array.from({ length: 4 }, () => null),
      bindingEndDatesByPerson: Array.from({ length: 4 }, () => null)
    });

    openUnifiedCart();
  }

  function bindStaticOfferCards() {
    if (!dom.deploymentGrid) return;

    dom.deploymentGrid.addEventListener("click", event => {
      const card = event.target.closest("[data-static-offer]");
      if (!card || !dom.deploymentGrid.contains(card)) return;

      event.preventDefault();
      saveStaticOfferAndNavigate(card);
    });

    dom.deploymentGrid.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;

      const card = event.target.closest("[data-static-offer]");
      if (!card || !dom.deploymentGrid.contains(card)) return;

      event.preventDefault();
      saveStaticOfferAndNavigate(card);
    });
  }

  function saveStaticOfferAndNavigate(card) {
    const item = buildStaticCartItem(card);
    const savedOffer = persistCartItem(item, {
      persons: item.persons,
      data: "high",
      operator: item.operator,
      binding: null,
      bindingEndDate: null,
      wishes: ["Startsida"],
      operatorsByPerson: Array.from({ length: item.persons }, () => "Andra / Ingen"),
      bindingsByPerson: Array.from({ length: item.persons }, () => null),
      bindingEndDatesByPerson: Array.from({ length: item.persons }, () => null)
    });

    if (savedOffer) {
      openUnifiedCart();
    } else {
      window.location.href = card.querySelector(".provider-button")?.getAttribute("href") || "varukorg.html";
    }
  }

  function saveRecommendationAndNavigate(plan) {
    const item = buildRecommendationCartItem(plan);
    persistCartItem(item, {
      persons: item.persons,
      data: state.data || getDataTier(item.dataAmount),
      operator: item.operator,
      binding: state.binding,
      bindingEndDate: null,
      wishes: [item.productType === "family" ? "Familjabonnemang" : "Mobilabonnemang"],
      answers: {
        qualification: item.qualification || null,
        offerCalculation: item.offerCalculation || null,
        customerStatus: state.customerStatus,
        existingCustomers: state.existingCustomers,
        newCustomers: state.newCustomers,
        currentOperator: state.selectedOperator,
        operatorDates: state.operatorDates,
        operatorNoBinding: state.operatorNoBinding,
        binding: state.binding,
        streamingCalculation: state.streamingCalculation,
        streamingServices: state.streamingServices,
        internationalTravel: state.internationalTravel,
        internationalUsage: state.internationalUsage
      },
      operatorsByPerson: state.operators.length ? state.operators : Array.from({ length: item.persons }, () => "Andra / Ingen"),
      bindingsByPerson: Array.from({ length: item.persons }, () => state.binding || null),
      bindingEndDatesByPerson: state.operatorDates.length ? state.operatorDates : Array.from({ length: item.persons }, () => null)
    });

    openUnifiedCart();
  }

  function persistCartItem(item, statePayload) {
    try {
      if (window.DealettCart?.appendItem) {
        window.DealettCart.appendItem(item, { state: statePayload });
        return true;
      }

      const cart = readCart();
      cart.push(item);
      localStorage.setItem("dealettCart", JSON.stringify(cart));
      localStorage.setItem("selectedOffer", JSON.stringify({
        id: item.offerId,
        operator: item.operator,
        title: item.title,
        logo: item.logo,
        dataAmount: item.dataAmount,
        finalPrice: item.price,
        pricePerPerson: item.pricePerPerson,
        rewardTotal: item.rewardTotal,
        rewardMixLabel: item.rewardMixLabel
      }));
      localStorage.setItem("dealettState", JSON.stringify(statePayload));
      localStorage.removeItem("rewardChoice");
      localStorage.setItem("rewardDistribution", JSON.stringify(item.rewards || {}));
      window.DEALETT_updateCartCount?.();
      return true;
    } catch {
      return false;
    }
  }

  function openUnifiedCart() {
    const cart = window.DealettCart?.readCart?.() || readCart();
    if (window.DealettCart?.openDrawer) {
      window.DealettCart.openDrawer(cart);
      return;
    }

    window.location.href = "varukorg.html";
  }

  function buildStaticCartItem(card) {
    const rewardTotal = Number(card.dataset.rewardTotal) || 0;
    const title = card.dataset.title || "4 abonnemang";
    const persons = Number((title.match(/\d+/) || [])[0]) || 1;
    const dataTitle = card.dataset.dataTitle || "Obegr\u00e4nsad surf";
    const features = String(card.dataset.features || "")
      .split("|")
      .map(item => item.trim())
      .filter(Boolean);

    return {
      cartItemId: `${card.dataset.offerId || "homepage-offer"}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      offerId: card.dataset.offerId || "",
      operator: card.dataset.operator || "",
      title,
      logo: card.dataset.logo || "",
      data: dataTitle,
      dataAmount: Number(card.dataset.dataAmount) || 0,
      price: Number(card.dataset.price) || 0,
      pricePerPerson: Number(card.dataset.pricePerPerson) || 0,
      persons,
      phoneLines: persons,
      productType: "family",
      unitLabel: "abonnemang",
      rewardTotal,
      rewardMixLabel: rewardTotal ? `Presentkort ${new Intl.NumberFormat("sv-SE").format(rewardTotal)} kr` : "",
      rewards: rewardTotal > 0 ? { Presentkort: rewardTotal } : {},
      features,
      source: "homepage-provider-card"
    };
  }

  function readCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem("dealettCart") || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function buildFamilyCartItem(card) {
    const rewardTotal = Number(card.dataset.rewardTotal) || 0;
    const title = card.dataset.title || "Familjeabonnemang";
    const persons = Number((title.match(/\d+/) || [])[0]) || 1;

    return {
      cartItemId: `${card.dataset.offerId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      offerId: card.dataset.offerId,
      operator: card.dataset.operator,
      title,
      logo: card.dataset.logo,
      dataAmount: Number(card.dataset.dataAmount) || 0,
      price: Number(card.dataset.price) || 0,
      pricePerPerson: Number(card.dataset.pricePerPerson) || 0,
      persons,
      phoneLines: persons,
      productType: "family",
      unitLabel: "abonnemang",
      rewardTotal,
      rewardMixLabel: card.dataset.rewardMixLabel || "",
      rewards: rewardTotal > 0 ? { Presentkort: rewardTotal } : {}
    };
  }

  function buildRecommendationCartItem(plan) {
    const persons = state.persons || 1;
    const rewardTotal = 0;

    return {
      cartItemId: `${plan.id || "recommended-offer"}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      offerId: plan.id || plan.title,
      operator: plan.operator,
      title: plan.title || plan.data || "Mobilabonnemang",
      logo: plan.logo,
      data: plan.data || (plan.dataAmount >= 999 ? "Obegränsad" : `${plan.dataAmount} GB`),
      dataAmount: Number(plan.dataAmount) || 0,
      price: Number(plan.planMonthlyPrice ?? plan.finalPrice ?? plan.price) || 0,
      monthlyPrice: Number(plan.planMonthlyPrice ?? plan.finalPrice ?? plan.price) || 0,
      regularMonthlyPrice: Number(plan.regularMonthlyPlanPrice ?? plan.planMonthlyPrice ?? plan.finalPrice ?? plan.price) || 0,
      pricePerPerson: persons > 1 ? Number(plan.pricePerPerson) || 0 : 0,
      persons,
      phoneLines: persons,
      productType: persons > 1 ? "family" : "mobile",
      unitLabel: "abonnemang",
      rewardTotal,
      rewardMixLabel: "",
      rewards: {},
      qualification: plan.qualification || null,
      offerCalculation: plan.offerCalculation || null,
      answers: {
        qualification: plan.qualification || null,
        offerCalculation: plan.offerCalculation || null,
        customerStatus: state.customerStatus,
        existingCustomers: state.existingCustomers,
        newCustomers: state.newCustomers,
        currentOperator: state.selectedOperator,
        operatorDates: state.operatorDates,
        operatorNoBinding: state.operatorNoBinding,
        binding: state.binding,
        streamingCalculation: state.streamingCalculation,
        streamingServices: state.streamingServices,
        streamingMonthlyCosts: state.streamingMonthlyCosts,
        internationalTravel: state.internationalTravel,
        internationalUsage: state.internationalUsage
      },
      features: [
        persons > 1 ? `${persons} abonnemang` : "1 abonnemang",
        plan.offerCalculation ? `${plan.offerCalculation.bindingMonths} mån bindningstid` : "",
        plan.offerCalculation?.streamingSavings > 0
          ? `Streaming avräknad ${new Intl.NumberFormat("sv-SE").format(plan.offerCalculation.streamingSavings)} kr/mån`
          : "",
        plan.offerCalculation ? `Effektiv kostnad ${new Intl.NumberFormat("sv-SE").format(plan.offerCalculation.effectiveMonthlyCost)} kr/mån` : "",
        ...(plan.offerCalculation?.benefits || []),
      ].filter(Boolean),
      source: "homepage-quiz"
    };
  }

  function getDataTier(dataAmount) {
    if (dataAmount >= 999) return "high";
    if (dataAmount >= 20) return "medium";
    return "low";
  }

  function handleOptionClick(option) {
    const step = option.closest(".quiz-step-card");
    if (!step) return;

    const stepIndex = steps.indexOf(step);
    if (stepIndex < 0) return;

    switch (stepIndex) {
      case 0:
        handlePersonsStep(option, step);
        break;
      case 1:
        handleOperatorStep(option);
        break;
      case 2:
        handleSingleChoiceStep(step, "[data-data]", option, () => {
          state.data = option.dataset.data || null;
        });
        break;
      case 3:
        break;
      case 4:
        handleTravelStep(step, option);
        break;
      case 5:
        handleSingleChoiceStep(step, "[data-international-usage]", option, () => {
          state.internationalUsage = option.dataset.internationalUsage || null;
        });
        break;
      case 6:
        handleSingleChoiceStep(step, "[data-price]", option, () => {
          state.price = option.dataset.price || null;
        });
        break;
      default:
        break;
    }
  }

  function handlePersonsStep(option, step) {
    const persons = Number(option.dataset.persons);
    if (!persons) return;

    state.persons = persons;
    state.operators = Array.from({ length: persons }, () => null);
    state.operatorDates = Array.from({ length: persons }, () => null);
    state.operatorNoBinding = Array.from({ length: persons }, () => false);
    state.selectedOperator = null;
    state.customerStatus = "all";
    state.existingCustomers = persons;
    state.newCustomers = 0;

    setSelected(step, "[data-persons]", option);
    resetCustomerStep();
    prepareOperatorQuestion(persons);
    showStepAfterSelection(1);
  }

  function handleOperatorStep(option) {
    if (option.dataset.noBinding !== undefined) {
      handleOperatorNoBinding(option);
      return;
    }

    if (option.dataset.operator) {
      handlePerPersonOperator(option);
      return;
    }

    if (!option.dataset.customerStatus) return;

    state.customerStatus = option.dataset.customerStatus;
    setSelected(steps[1], "[data-customer-status]", option);

    if (state.customerStatus === "none") {
      state.existingCustomers = 0;
      state.newCustomers = state.persons || 1;
      state.selectedOperator = null;
      state.operators = Array.from({ length: state.persons || 1 }, () => null);
      state.operatorDates = Array.from({ length: state.persons || 1 }, () => null);
      state.operatorNoBinding = Array.from({ length: state.persons || 1 }, () => false);
      dom.newCustomersField?.classList.add("hidden");
      hideOperatorQuestion();
      showStepAfterSelection(2);
      return;
    }

    if (state.customerStatus === "partial") {
      renderNewCustomersSelect();
      dom.newCustomersField?.classList.remove("hidden");
      hideOperatorQuestion();
      return;
    }

    state.existingCustomers = state.persons || 1;
    state.newCustomers = 0;
    dom.newCustomersField?.classList.add("hidden");
    prepareOperatorQuestion(state.existingCustomers);
  }

  function toggleExtraPersonOptions() {
    if (!dom.personExtraOptions || !dom.personMoreToggle) return;

    const isOpening = dom.personExtraOptions.classList.contains("hidden");
    dom.personExtraOptions.classList.toggle("hidden", !isOpening);
    dom.personMoreToggle.setAttribute("aria-expanded", String(isOpening));
    dom.personMoreToggle.textContent = isOpening ? "Dölj" : "Visa fler";
  }

  function resetCustomerStep() {
    const customerStep = steps[1];
    if (!customerStep) return;

    customerStep.querySelectorAll("[data-current-operator], [data-customer-status], [data-operator]").forEach(button => {
      button.classList.remove("selected", "active");
      button.setAttribute("aria-pressed", "false");
    });

    const partialOption = customerStep.querySelector('[data-customer-status="partial"]');
    if (partialOption) {
      partialOption.disabled = (state.persons || 0) < 2;
    }

    dom.newCustomersField?.classList.add("hidden");
    if (dom.newCustomersSelect) {
      dom.newCustomersSelect.innerHTML = '<option value="">Välj antal</option>';
    }

    hideOperatorQuestion();
  }

  function renderNewCustomersSelect() {
    if (!dom.newCustomersSelect) return;

    const persons = state.persons || 1;
    const maxExistingCustomers = Math.max(persons - 1, 1);
    const options = ['<option value="">Välj antal</option>'];

    for (let index = 1; index <= maxExistingCustomers; index += 1) {
      options.push(`<option value="${index}">${index}</option>`);
    }

    dom.newCustomersSelect.innerHTML = options.join("");
  }

  function prepareOperatorQuestion(existingCount) {
    const persons = state.persons || 1;
    const boundedExistingCount = Math.max(Math.min(existingCount, persons), 0);

    state.existingCustomers = boundedExistingCount;
    state.operators = Array.from({ length: persons }, (_, index) => (
      index < boundedExistingCount ? state.operators[index] || null : null
    ));
    state.operatorDates = Array.from({ length: persons }, (_, index) => (
      index < boundedExistingCount ? state.operatorDates[index] || null : null
    ));
    state.operatorNoBinding = Array.from({ length: persons }, (_, index) => (
      index < boundedExistingCount ? Boolean(state.operatorNoBinding[index]) : false
    ));
    state.selectedOperator = state.operators.find(Boolean) || null;

    renderOperatorChoices(boundedExistingCount);
    updateOperatorContinueState();
  }

  function hideOperatorQuestion() {
    dom.customerOperatorQuestion?.classList.add("hidden");
    dom.operatorContainer?.classList.add("hidden");
    dom.operatorContainer?.closest(".quiz-card-body")?.classList.remove("quiz-card-body--operator-active");

    if (dom.operatorContainer) {
      dom.operatorContainer.innerHTML = "";
    }
  }

  function handlePerPersonOperator(option) {
    const personIndex = Number(option.dataset.personIndex);
    if (!Number.isInteger(personIndex)) return;

    const group = option.closest("[data-operator-group]");
    const isSelected = state.operators[personIndex] === option.dataset.operator;

    if (isSelected) {
      state.operators[personIndex] = null;
      option.classList.remove("selected", "active");
      option.setAttribute("aria-pressed", "false");
    } else {
      state.operators[personIndex] = option.dataset.operator || null;
      setSelected(group || steps[1], "[data-operator]", option);
    }

    state.selectedOperator = state.operators.find(Boolean) || null;
    maybeAdvanceFromOperatorQuestion();
  }

  function handleOperatorDateChange(input) {
    const personIndex = Number(input.dataset.personIndex);
    if (!Number.isInteger(personIndex)) return;

    state.operatorDates[personIndex] = input.value || null;
    if (input.value) {
      state.operatorNoBinding[personIndex] = false;
      const group = input.closest("[data-operator-group]");
      group?.querySelector("[data-no-binding]")?.classList.remove("selected", "active");
      group?.querySelector("[data-no-binding]")?.setAttribute("aria-pressed", "false");
    }

    maybeAdvanceFromOperatorQuestion();
  }

  function handleOperatorNoBinding(option) {
    const personIndex = Number(option.dataset.personIndex);
    if (!Number.isInteger(personIndex)) return;

    state.operatorNoBinding[personIndex] = true;
    state.operatorDates[personIndex] = null;

    const group = option.closest("[data-operator-group]");
    const dateInput = group?.querySelector("[data-operator-date]");
    if (dateInput) {
      dateInput.value = "";
    }

    option.classList.add("selected", "active");
    option.setAttribute("aria-pressed", "true");
    maybeAdvanceFromOperatorQuestion();
  }

  function updateOperatorContinueState() {
    const existingCount = state.existingCustomers || 0;
    const selectedCount = state.operators.slice(0, existingCount).filter(Boolean).length;
    const bindingChoiceCount = state.operatorDates
      .slice(0, existingCount)
      .filter((date, index) => date || state.operatorNoBinding[index])
      .length;
    const isComplete = selectedCount === existingCount && bindingChoiceCount === existingCount;

    return isComplete;
  }

  function maybeAdvanceFromOperatorQuestion() {
    if (!updateOperatorContinueState() || state.currentStep !== 1) return;

    showStepAfterSelection(2);
  }

  function handleSingleChoiceStep(step, selector, option, applyState) {
    applyState();
    setSelected(step, selector, option);

    const nextIndex = Math.min(state.currentStep + 1, resultStepIndex);
    showStepAfterSelection(nextIndex);
  }

  function handleTravelStep(step, option) {
    state.internationalTravel = option.dataset.travel || null;
    setSelected(step, "[data-travel]", option);

    if (isInternationalUsageRelevant()) {
      showStepAfterSelection(5);
      return;
    }

    state.internationalUsage = null;
    steps[5]?.querySelectorAll("[data-international-usage]").forEach(button => {
      button.classList.remove("selected", "active");
      button.setAttribute("aria-pressed", "false");
    });
    showStepAfterSelection(6);
  }

  function isInternationalUsageRelevant() {
    return state.internationalTravel === "outside_eu";
  }

  function getPreviousStepIndex(index) {
    if (index === 6 && !isInternationalUsageRelevant()) return 4;
    return Math.max(index - 1, 0);
  }

  function handleStreamingStep(step) {
    state.streamingServices = Array.from(step.querySelectorAll("[data-streaming-service]:checked"))
      .map(input => input.value)
      .filter(Boolean);
    state.streamingMonthlyCosts = state.streamingServices.reduce((costs, service) => {
      const input = step.querySelector(`[data-streaming-cost="${service}"]`);
      const amount = Number(input?.value);
      if (amount > 0) costs[service] = amount;
      return costs;
    }, {});
    state.streamingCalculation = state.streamingServices.length ? "include" : "none";

    const missingCost = state.streamingServices.find(service => !state.streamingMonthlyCosts[service]);
    if (missingCost) {
      const input = step.querySelector(`[data-streaming-cost="${missingCost}"]`);
      input?.focus();
      input?.setCustomValidity("Ange vad du betalar per månad så att effektiv kostnad blir korrekt.");
      input?.reportValidity();
      return;
    }
    step.querySelectorAll("[data-streaming-cost]").forEach(input => input.setCustomValidity(""));

    showStepAfterSelection(Math.min(state.currentStep + 1, resultStepIndex));
  }

  function setSelected(scope, selector, activeOption) {
    scope.querySelectorAll(selector).forEach(button => {
      button.classList.remove("selected", "active");
      button.setAttribute("aria-pressed", button === activeOption ? "true" : "false");
    });

    activeOption.classList.add("selected", "active");
    activeOption.setAttribute("aria-pressed", "true");
  }

  function renderOperatorChoices(count = state.existingCustomers || 0) {
    if (!dom.operatorContainer || !dom.operatorTemplate || !state.persons) return;

    dom.operatorContainer.innerHTML = "";
    dom.operatorContainer.classList.toggle("hidden", count <= 0);
    dom.operatorContainer.closest(".quiz-card-body")?.classList.toggle("quiz-card-body--operator-active", count > 0);
    updateOperatorQuestionTitle(count);
    dom.customerOperatorQuestion?.classList.toggle("hidden", count <= 0);

    state.operators.slice(0, count).forEach((selectedOperator, personIndex) => {
      const fragment = dom.operatorTemplate.content.cloneNode(true);
      const card = fragment.firstElementChild;

      card?.setAttribute("data-operator-group", "");

      const personNumber = fragment.querySelector("[data-person-number]");
      if (personNumber) {
        personNumber.textContent = String(personIndex + 1);
      }

      fragment.querySelectorAll("[data-operator]").forEach(button => {
        button.dataset.personIndex = String(personIndex);
        button.setAttribute("aria-pressed", button.dataset.operator === selectedOperator ? "true" : "false");

        if (button.dataset.operator === selectedOperator) {
          button.classList.add("selected", "active");
        } else {
          button.classList.remove("selected", "active");
        }
      });

      fragment.querySelectorAll("[data-operator-date]").forEach(input => {
        input.dataset.personIndex = String(personIndex);
        input.value = state.operatorDates[personIndex] || "";
      });

      fragment.querySelectorAll("[data-no-binding]").forEach(button => {
        button.dataset.personIndex = String(personIndex);
        button.setAttribute("aria-pressed", state.operatorNoBinding[personIndex] ? "true" : "false");

        if (state.operatorNoBinding[personIndex]) {
          button.classList.add("selected", "active");
        } else {
          button.classList.remove("selected", "active");
        }
      });

      dom.operatorContainer.appendChild(fragment);
    });

    syncStackHeight();
  }

  function updateOperatorQuestionTitle(count) {
    if (!dom.customerOperatorQuestion) return;

    dom.customerOperatorQuestion.textContent = count === 1
      ? "Vilken operatör och bindningstid har du?"
      : "Vilka operatörer och bindningstider har ni?";
  }

  function mountQuizInHero() {
    if (!dom.heroMount || !dom.wrapper) return;

    if (!sectionWrapperAnchor.parentNode) {
      dom.wrapper.parentNode?.insertBefore(sectionWrapperAnchor, dom.wrapper);
    }

    dom.heroMount.appendChild(dom.wrapper);
    dom.hero?.classList.add("quiz-in-hero");
    dom.heroVisual?.classList.add("is-quiz-active");
  }

  function mountQuizInSection() {
    if (!dom.wrapper) return;

    sectionWrapperAnchor.parentNode?.insertBefore(dom.wrapper, sectionWrapperAnchor);
    dom.hero?.classList.remove("quiz-in-hero");
    dom.heroVisual?.classList.remove("is-quiz-active");
  }

  function startQuiz(options = {}) {
    if (options.inHero) {
      mountQuizInHero();
    } else {
      mountQuizInSection();
    }

    dom.intro?.classList.add("hidden");
    dom.wrapper?.classList.remove("hidden");
    dom.wrapper?.classList.remove("opacity-0");
    document.getElementById("analys")?.classList.add("quiz-running");

    requestAnimationFrame(() => {
      dom.wrapper?.classList.remove("opacity-0");
      showStep(0);
    });
  }

  function showIntro() {
    mountQuizInSection();
    dom.wrapper?.classList.add("hidden", "opacity-0");
    dom.intro?.classList.remove("hidden");
    document.getElementById("analys")?.classList.remove("quiz-running");
    updateStepState(0);
    syncProgress();
  }

  function showStepAfterSelection(index) {
    if (pendingAdvanceTimer) {
      window.clearTimeout(pendingAdvanceTimer);
    }

    pendingAdvanceTimer = window.setTimeout(() => {
      pendingAdvanceTimer = null;
      showStep(index);
    }, selectionFeedbackMs);
  }

  function showStep(index) {
    if (pendingAdvanceTimer) {
      window.clearTimeout(pendingAdvanceTimer);
      pendingAdvanceTimer = null;
    }

    const safeIndex = Math.max(0, Math.min(index, resultStepIndex));

    state.currentStep = safeIndex;
    updateStepState(safeIndex);
    syncProgress();
    syncStackHeight();

    if (safeIndex === resultStepIndex) {
      renderRecommendations();
    }
  }

  function updateStepState(activeIndex) {
    steps.forEach((step, index) => {
      step.classList.remove("active-step", "stacked-card", "upcoming-card", "hidden-step");
      step.setAttribute("aria-hidden", index === activeIndex ? "false" : "true");

      if (index === 5 && !isInternationalUsageRelevant()) {
        step.classList.add("hidden-step");
        return;
      }

      if (index < activeIndex) {
        step.classList.add("stacked-card");
      } else if (index === activeIndex) {
        step.classList.add("active-step");
      } else {
        step.classList.add("upcoming-card");
      }
    });
  }

  function syncProgress() {
    const visibleQuestionSteps = Array.from({ length: questionStepCount }, (_, index) => index)
      .filter(index => index !== 5 || isInternationalUsageRelevant());
    const visibleStepIndex = visibleQuestionSteps.indexOf(state.currentStep);
    const visibleStep = state.currentStep === resultStepIndex
      ? visibleQuestionSteps.length
      : Math.max(visibleStepIndex + 1, 1);
    const visibleStepCount = visibleQuestionSteps.length;
    const progressWidth = visibleStepCount
      ? `${(visibleStep / visibleStepCount) * 100}%`
      : "0%";

    document.querySelectorAll(".quiz-step-current").forEach(node => {
      node.textContent = String(visibleStep);
    });

    document.querySelectorAll(".quiz-step-total").forEach(node => {
      node.textContent = String(visibleStepCount);
    });

    document.querySelectorAll(".quiz-progress-inline").forEach(node => {
      node.style.width = progressWidth;
    });
  }

  function syncStackHeight() {
    if (dom.stack) dom.stack.style.minHeight = "";
    if (dom.slot)  dom.slot.style.minHeight  = "";
  }

  async function renderRecommendations() {
    if (!dom.offersContainer) return;

    const requestId = ++recommendationsRequestId;
    dom.offersContainer.innerHTML = [
      '<div class="quiz-loading" role="status" aria-live="polite">',
      '  <span class="quiz-loading-spinner" aria-hidden="true"></span>',
      '  <span>Analyserar svar...</span>',
      '</div>'
    ].join("");

    let recommendedPlans = [];

    try {
      [recommendedPlans] = await Promise.all([
        getRecommendedPlans(),
        wait(850)
      ]);
    } catch {
      if (requestId !== recommendationsRequestId) return;

      dom.offersContainer.innerHTML = [
        '<article class="offer-card offer-card--empty">',
        '<h4 class="offer-card__title">Kunde inte hämta erbjudanden</h4>',
        '<p class="offer-card__empty-text">Försök igen om en stund eller välj ett paket direkt från startsidan.</p>',
        "</article>"
      ].join("");
      syncStackHeight();
      return;
    }

    if (requestId !== recommendationsRequestId) return;

    dom.offersContainer.innerHTML = "";

    if (!recommendedPlans.length) {
      const noOfferText = lastOfferCalculation?.noOfferReason ||
        "Testa att gå tillbaka och justera prisnivå eller surfbehov så visar vi fler relevanta alternativ.";
      dom.offersContainer.innerHTML = [
        '<article class="offer-card offer-card--empty">',
        '<h4 class="offer-card__title">Inga träffar just nu</h4>',
        `<p class="offer-card__empty-text">${escapeHtml(noOfferText)}</p>`,
        "</article>"
      ].join("");
      syncStackHeight();
      return;
    }

    renderRecommendationResults(getUniqueOperatorPlans(recommendedPlans), { expanded: false });

    syncStackHeight();
  }

  function wait(duration) {
    return new Promise(resolve => {
      window.setTimeout(resolve, duration);
    });
  }

  async function getRecommendedPlans() {
    return getStrictCalculatedPlans();
  }

  async function getStrictCalculatedPlans() {
    const qualification = buildQualificationFromState();
    if (!qualification.readyForOffer) {
      lastOfferCalculation = null;
      return null;
    }

    const calculation = await window.DealettNetwork.fetchJson("https://db-qtmd.onrender.com/api/offers/calculate", {
      label: "Behovsanalys kalkyl",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qualification }),
    });
    lastOfferCalculation = calculation;

    if (!calculation.validOfferAvailable) {
      return [];
    }

    return (calculation.options || []).map(option => ({
      ...option,
      id: option.planId,
      logo: getOperatorLogo(option.operator),
      finalPrice: option.planMonthlyPrice,
      offerCalculation: option,
      qualification,
      source: "homepage-quiz-calculator",
    }));
  }

  function getUniqueOperatorPlans(items = []) {
    const seenOperators = new Set();

    return items.filter(item => {
      const operatorKey = String(item?.operator || "").trim().toLowerCase();
      if (!operatorKey || seenOperators.has(operatorKey)) return false;
      seenOperators.add(operatorKey);
      return true;
    });
  }

  function getRecommendationKey(plan) {
    return String(plan?.planId ?? plan?.id ?? `${plan?.operator || ""}-${plan?.title || ""}`);
  }

  function selectFeaturedRecommendationEntries(plans = []) {
    const qualification = buildQualificationFromState();
    return [
      { plan: lastOfferCalculation?.bestValue, label: "Bäst värde" },
      { plan: lastOfferCalculation?.lowestMonthlyPrice, label: "Lägst månadspris" }
    ].filter(entry => entry.plan).map(entry => ({
      ...entry,
      plan: {
        ...entry.plan,
        id: entry.plan.planId,
        logo: getOperatorLogo(entry.plan.operator),
        finalPrice: entry.plan.planMonthlyPrice,
        offerCalculation: entry.plan,
        qualification,
      }
    }));
  }

  function getExpandedRecommendationLabel(plan, index, featuredEntries = []) {
    const key = getRecommendationKey(plan);

    if (key === getRecommendationKey(featuredEntries[0]?.plan)) return "Bäst värde";
    if (key === getRecommendationKey(featuredEntries[1]?.plan)) return "Lägst månadspris";

    return `Operatör ${index + 1}`;
  }

  function renderRecommendationResults(plans = [], { expanded = false } = {}) {
    const featuredEntries = selectFeaturedRecommendationEntries(plans);
    const visibleEntries = expanded
      ? plans.map((plan, index) => ({
        plan,
        label: getExpandedRecommendationLabel(plan, index, featuredEntries)
      }))
      : featuredEntries;
    const hasMoreOperators = plans.length > visibleEntries.length;

    dom.offersContainer.classList.toggle("offers-recommendation-grid--featured", !expanded);
    dom.offersContainer.classList.toggle("offers-recommendation-grid--expanded", expanded);
    dom.offersContainer.innerHTML = "";

    visibleEntries.forEach(({ plan, label }, index) => {
      dom.offersContainer.appendChild(
        buildRecommendationCard(plan, index, label)
      );
    });

    if (!expanded && hasMoreOperators) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "recommendation-results-toggle";
      toggle.textContent = "Show all 4 operators";
      toggle.setAttribute("aria-expanded", "false");
      toggle.addEventListener("click", () => {
        renderRecommendationResults(plans, { expanded: true });
        syncStackHeight();
      });
      dom.offersContainer.appendChild(toggle);
    }
  }

  function buildQualificationFromState() {
    const peopleCount = Number(state.persons) || null;
    const operators = Array.from({ length: peopleCount || 0 }, (_, index) => {
      if (state.customerStatus === "none" || index >= Number(state.existingCustomers || 0)) {
        return "Annan / ingen";
      }

      return state.operators[index] || "Annan / ingen";
    });
    const bindingEnds = Array.from({ length: peopleCount || 0 }, (_, index) => {
      if (state.customerStatus === "none" || index >= Number(state.existingCustomers || 0)) {
        return "Ingen bindningstid";
      }

      if (state.operatorNoBinding[index]) return "Ingen bindningstid";
      return state.operatorDates[index] || "Vet inte";
    });
    const missingFields = [];
    if (!peopleCount) missingFields.push("peopleCount");
    if (!peopleCount || operators.length < peopleCount) missingFields.push("operators");
    if (!peopleCount || bindingEnds.length < peopleCount) missingFields.push("bindingEnds");
    if (!state.data) missingFields.push("mobileUsage");
    if (!state.price) missingFields.push("priceRange");

    return {
      peopleCount,
      operators,
      bindingEnds,
      mobileUsage: state.data || null,
      priceRange: state.price || null,
      streamingCalculation: state.streamingCalculation || null,
      streamingServices: state.streamingServices,
      streamingMonthlyCosts: state.streamingMonthlyCosts,
      internationalTravel: state.internationalTravel || null,
      internationalUsage: state.internationalUsage || null,
      exactMonthlyPrice: null,
      exactMonthlyPrices: [],
      readyForOffer: missingFields.length === 0,
      missingFields,
    };
  }

  function escapeHtml(value) {
    if (window.DealettCart?.escapeHtml) return window.DealettCart.escapeHtml(value);

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatMoney(value) {
    return `${new Intl.NumberFormat("sv-SE").format(Math.max(Number(value) || 0, 0))} kr`;
  }

  function createCompareButton(item, options = {}) {
    const button = document.createElement("button");
    button.className = [
      "offer-compare-button",
      options.compact === false ? "" : "offer-compare-button--icon"
    ].filter(Boolean).join(" ");
    button.type = "button";
    button.setAttribute("aria-label", "J\u00e4mf\u00f6r");

    if (window.DealettOfferCompare) {
      window.DealettOfferCompare.bindButton(button, item);
    } else {
      button.innerHTML = '<i class="fa-solid fa-code-compare" aria-hidden="true"></i><span data-compare-label>Jämför</span>';
    }

    return button;
  }

  function getAnswerCompareFacts() {
    const persons = Number(state.persons) || 1;
    const existingOperators = state.operators
      .slice(0, Number(state.existingCustomers) || 0)
      .filter(Boolean)
      .join(", ");

    return [
      { label: "Antal abonnemang", value: `${persons} abonnemang` },
      state.data ? { label: "Surfbehov", value: getDataNeedLabel(state.data) } : null,
      state.streamingCalculation ? { label: "Streaming", value: getStreamingCalculationLabel(state.streamingCalculation) } : null,
      state.streamingServices.length ? { label: "Betalar f\u00f6r", value: getStreamingServicesLabel(state.streamingServices) } : null,
      state.internationalTravel ? { label: "Utlandsresor", value: getTravelLabel(state.internationalTravel) } : null,
      state.internationalUsage ? { label: "Anv\u00e4ndning utanf\u00f6r EU", value: getInternationalUsageLabel(state.internationalUsage) } : null,
      state.price ? { label: "Prisniv\u00e5", value: getPriceNeedLabel(state.price) } : null,
      existingOperators ? { label: "Nuvarande operat\u00f6r", value: existingOperators } : null,
    ].filter(Boolean);
  }

  function getDataNeedLabel(value) {
    if (value === "low") return "Mest wifi & sociala medier";
    if (value === "medium") return "Mellansurf, 20-50 GB";
    if (value === "high") return "Max surf";
    return value;
  }

  function getStreamingCalculationLabel(value) {
    if (value === "include") return "Räkna av valda streamingtjänster";
    if (value === "none") return "Bara abonnemang";
    if (value === "unknown") return "Vet inte";
    return value;
  }

  function getStreamingServiceLabel(value) {
    if (value === "netflix") return "Netflix";
    if (value === "hbo") return "HBO Max";
    if (value === "disney") return "Disney+";
    if (value === "amazon") return "Amazon Prime";
    if (value === "tv4") return "TV4 Play";
    return value;
  }

  function getStreamingServicesLabel(values = []) {
    return values.map(getStreamingServiceLabel).filter(Boolean).join(", ");
  }

  function getTravelLabel(value) {
    if (value === "none") return "Reser inte mycket";
    if (value === "eu") return "Mest inom EU";
    if (value === "outside_eu") return "Även utanför EU";
    return value;
  }

  function getInternationalUsageLabel(value) {
    if (value === "calls") return "Lokala samtal och surf";
    if (value === "data") return "Bara surf";
    return value;
  }

  function getPriceNeedLabel(value) {
    if (value === "under300") return "Under 300 kr";
    if (value === "300-400") return "300-400 kr";
    if (value === "400-500") return "400 kr eller mer";
    return value;
  }

  function buildRecommendationCompareItem(plan, index) {
    const persons = Number(state.persons) || 1;
    const isMulti = persons > 1;
    const dataText = plan.dataAmount >= 999 ? "Obegr\u00e4nsad" : `${plan.dataAmount} GB`;
    const finalPrice = Number(plan.planMonthlyPrice ?? plan.finalPrice ?? plan.price) || 0;
    const pricePerPerson = Number(plan.pricePerPerson) || finalPrice;
    const contractMonths = Number(plan.offerCalculation?.bindingMonths) || null;
    const savings = Number(plan.offerCalculation?.monthlySavings);
    const includedServiceValue = Number(plan.offerCalculation?.streamingSavings) || 0;
    const effectiveMonthlyCost = Number(plan.offerCalculation?.effectiveMonthlyCost) || finalPrice;

    return {
      id: `index-quiz-${plan.id || plan.title || plan.operator}-${persons}-${index}`,
      title: plan.title || plan.data || "Mobilabonnemang",
      operator: plan.operator,
      type: isMulti ? "Familjepaket" : "Mobilabonnemang",
      logo: plan.logo,
      accent: "var(--accent)",
      facts: [
        { label: "Typ", value: isMulti ? "Familjabonnemang" : "Mobilabonnemang" },
        { label: "Operat\u00f6r", value: plan.operator },
        { label: "Antal abonnemang", value: `${persons} abonnemang` },
        { label: "Surf", value: dataText },
        { label: "Pris", value: isMulti ? `${formatMoney(pricePerPerson)}/person` : `${formatMoney(finalPrice)}/m\u00e5n` },
        isMulti ? { label: "Totalpris", value: `${formatMoney(finalPrice)}/m\u00e5n` } : null,
        contractMonths ? { label: "Bindningstid", value: `${contractMonths} m\u00e5n` } : null,
        { label: "Effektiv kostnad", value: `${formatMoney(effectiveMonthlyCost)}/mån` },
        includedServiceValue > 0 ? { label: "Ersatt streaming", value: `${formatMoney(includedServiceValue)}/mån` } : null,
        Number.isFinite(savings) ? {
          label: savings >= 0 ? "Besparing" : "Högre kostnad",
          value: `${formatMoney(Math.abs(savings))}/mån`,
        } : null,
        ...(plan.offerCalculation?.benefits || []).map(benefit => ({ label: "Fördel", value: benefit })),
        ...getAnswerCompareFacts(),
      ].filter(Boolean),
    };
  }

  function buildRecommendationReason(plan) {
    return plan.offerCalculation?.reason || "Matchar behoven du angav i analysen.";
  }

  function buildRecommendationCard(plan, index, label) {
    const article = document.createElement("article");
    const providerClass = getProviderClass(plan.operator);
    article.className = [
      "offer-card",
      index === 0 ? "offer-card--top" : "",
      providerClass ? `provider-card--${providerClass}` : ""
    ].filter(Boolean).join(" ");

    const topLabel = label || `Operatör ${index + 1}`;
    const isMulti = state.persons && state.persons > 1;
    const planMonthlyPrice = Number(plan.planMonthlyPrice ?? plan.finalPrice) || 0;
    const effectiveMonthlyCost = Number(plan.effectiveMonthlyCost ?? plan.offerCalculation?.effectiveMonthlyCost) || planMonthlyPrice;
    const monthlySavings = Number(plan.monthlySavings ?? plan.offerCalculation?.monthlySavings);
    const priceMain = `${planMonthlyPrice} kr/mån`;
    const priceSub  = isMulti ? `${plan.pricePerPerson} kr per användare` : null;
    const dataText  = plan.dataAmount >= 999 ? "Obegränsad" : `${plan.dataAmount} GB`;
    const reasonText = buildRecommendationReason(plan);

    article.innerHTML = [
      '<div class="offer-card__accent"></div>',
      '<div class="offer-card__inner">',
      '  <div class="offer-card__top">',
      `    <span class="offer-card__label">${escapeHtml(topLabel)}</span>`,
      '  </div>',
      '  <div class="offer-card__head">',
      `    <img src="${escapeHtml(plan.logo)}" alt="${escapeHtml(plan.operator)}" class="offer-card__logo ${providerClass ? `offer-card__logo--${providerClass}` : ""}" />`,
      '  </div>',
      plan.text ? `  <p class="offer-card__desc">${escapeHtml(plan.text)}</p>` : '',
      '  <div class="offer-card__stats">',
      '    <div class="offer-card__stat">',
      '      <span class="offer-card__stat-icon"><i class="fa-solid fa-signal"></i></span>',
      '      <div>',
      '        <p class="offer-card__stat-label">Surf</p>',
      `        <p class="offer-card__stat-value">${escapeHtml(dataText)}</p>`,
      '      </div>',
      '    </div>',
      '    <div class="offer-card__stat">',
      '      <span class="offer-card__stat-icon"><i class="fa-solid fa-tag"></i></span>',
      '      <div>',
      '        <p class="offer-card__stat-label">Pris</p>',
      `        <p class="offer-card__stat-value">${escapeHtml(priceMain)}</p>`,
      priceSub ? `        <p class="offer-card__stat-sub">${escapeHtml(priceSub)}</p>` : '',
      '      </div>',
      '    </div>',
      '  </div>',
      `  <div class="offer-card__stats"><div class="offer-card__stat"><span class="offer-card__stat-icon"><i class="fa-solid fa-scale-balanced"></i></span><div><p class="offer-card__stat-label">Effektiv kostnad</p><p class="offer-card__stat-value">${escapeHtml(`${effectiveMonthlyCost} kr/mån`)}</p></div></div>${Number.isFinite(monthlySavings) ? `<div class="offer-card__stat"><span class="offer-card__stat-icon"><i class="fa-solid fa-piggy-bank"></i></span><div><p class="offer-card__stat-label">${plan.currentMonthlyTotalIsEstimate ? 'Uppskattad besparing' : 'Besparing'}</p><p class="offer-card__stat-value">${escapeHtml(`${monthlySavings} kr/mån`)}</p></div></div>` : ''}</div>`,
      `  <p class="offer-card__reason">${escapeHtml(reasonText)}</p>`,
      Array.isArray(plan.benefits) && plan.benefits.length ? `  <ul class="offer-card__benefits">${plan.benefits.map(benefit => `<li>${escapeHtml(benefit)}</li>`).join("")}</ul>` : '',
      '  <div class="offer-card__actions"></div>',
      '  <a href="varukorg.html" class="offer-card__cta" data-recommendation-cart>Till varukorg <i class="fa-solid fa-cart-shopping"></i></a>',
      '</div>'
    ].join("\n");

    article.querySelector("[data-recommendation-cart]")?.addEventListener("click", event => {
      event.preventDefault();
      saveRecommendationAndNavigate(plan);
    });

    const compareButton = createCompareButton(buildRecommendationCompareItem(plan, index), { compact: false });
    article.querySelector(".offer-card__actions")?.append(compareButton);

    return article;
  }

  function bindNewsletterForm() {
    const form = document.querySelector("[data-newsletter-form]");
    const status = document.querySelector("[data-newsletter-status]");
    if (!form) return;

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const email = String(new FormData(form).get("email") || "").trim().toLowerCase();
      if (!email) return;

      const submitButton = form.querySelector("button[type='submit']");
      if (submitButton) submitButton.disabled = true;
      if (status) status.textContent = "Registrerar...";

      try {
        await window.DealettNetwork.fetchJson("https://db-qtmd.onrender.com/api/newsletter", {
          label: "Nyhetsbrev",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, source: "homepage" }),
        });
      } catch {
        saveNewsletterFallback(email);
      } finally {
        if (submitButton) submitButton.disabled = false;
      }

      form.reset();
      if (status) status.textContent = "Klart, du är registrerad.";
    });
  }

  function saveNewsletterFallback(email) {
    try {
      const saved = JSON.parse(localStorage.getItem("dealettNewsletterSubscribers") || "[]");
      const list = Array.isArray(saved) ? saved : [];
      if (!list.some(item => item.email === email)) {
        list.push({ email, source: "homepage", createdAt: new Date().toISOString() });
      }
      localStorage.setItem("dealettNewsletterSubscribers", JSON.stringify(list));
    } catch {
      // Private browsing or storage limits can block fallback persistence.
    }
  }

  function getProviderClass(operator) {
    return String(operator || "")
      .toLowerCase()
      .replace("å", "a")
      .replace("ä", "a")
      .replace("ö", "o")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function getOperatorLogo(operator) {
    const provider = getProviderClass(operator);
    return `images/${provider}.${["telia", "tele2"].includes(provider) ? "png" : "jpg"}`;
  }

  return { init };
}
