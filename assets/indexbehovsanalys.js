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
    currentMonthlyCosts: [],
    noticePeriodMonths: [],
    keepNumberPreferences: [],
    numberOwnerConfirmed: [],
    addOnMonthlyCosts: [],
    devicePaymentMonthlyCosts: [],
    devicePaymentRemainingMonths: [],
    coverageLocations: [],
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
    internationalUsage: null,
    resultMode: "initial",
    selectedRefinements: [],
    refinementQueue: [],
    refinementPromptCollapsed: false
  };

  const dom = {
    intro: document.getElementById("quiz-intro"),
    wrapper: document.getElementById("quiz-steps-wrapper"),
    slot: document.getElementById("quiz-slot"),
    stack: document.getElementById("quiz-card-stack"),
    startButton: document.getElementById("quiz-start"),
    heroStartButton: document.getElementById("hero-start-analysis"),
    heroOfferButtons: document.querySelectorAll("[data-hero-offer-persons]"),
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
  const dataStepIndex = 2;
  const priceStepIndex = 6;
  const refinementStepIndexes = {
    streaming: 3,
    travel: 4,
    internationalUsage: 5
  };
  const sectionWrapperAnchor = document.createComment("quiz section mount");
  let quizModalLayer = null;
  const selectionFeedbackMs = 220;
  const giftCardPlaceholder = "Presentkort: XXX kr";
  let recommendationsRequestId = 0;
  let lastOfferCalculation = null;
  let pendingAdvanceTimer = null;

  function init() {
    if (!dom.wrapper || !dom.stack || !steps.length) return;

    window.abonState = state;
    window.DealettQuiz = {
      getChatContext: buildQuizChatContext,
      applyQualification: applyQualificationFromChat,
      getState: () => JSON.parse(JSON.stringify(state)),
    };

    injectQuizAiButtons();
    bindEvents();
    document.addEventListener("dealett:chat-qualification-updated", handleChatQualificationUpdate);
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
    dom.heroOfferButtons?.forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        startQuizFromHeroOffer(button);
      });
    });
    document.querySelectorAll("[data-home-quiz-link]").forEach(link => {
      link.addEventListener("click", event => {
        event.preventDefault();
        startQuiz({ inHero: true });
      });
    });
    dom.familyOfferGrid?.addEventListener("click", handleFamilyOfferClick);
    dom.wrapper.addEventListener("click", handleWrapperClick);
    dom.wrapper.addEventListener("change", handleWrapperChange);
    dom.wrapper.addEventListener("input", handleWrapperInput);
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

  function injectQuizAiButtons() {
    steps.forEach((step) => {
      const card = step.querySelector(".quiz-card");
      if (!card || card.querySelector("[data-quiz-ai-actions]")) return;

      const actions = document.createElement("div");
      actions.className = "quiz-ai-actions";
      actions.dataset.quizAiActions = "";
      actions.innerHTML = '<button type="button" class="quiz-ai-button" data-quiz-ai-action="continue" aria-label="Fortsätt härifrån med Dealett AI"><span>Fortsätt härifrån med</span><strong>Dealett AI</strong></button>';
      card.append(actions);
    });
  }

  function handleWrapperClick(event) {
    const aiButton = event.target.closest("[data-quiz-ai-action]");
    if (aiButton) {
      handleQuizAiClick(aiButton);
      return;
    }

    const refinementStart = event.target.closest("[data-refinement-start]");
    if (refinementStart) {
      handleRefinementStart();
      return;
    }

    const refinementToggle = event.target.closest("[data-refinement-toggle]");
    if (refinementToggle) {
      const panel = refinementToggle.closest(".quiz-refinement-panel");
      state.refinementPromptCollapsed = refinementToggle.dataset.refinementToggle !== "open";
      panel?.classList.toggle("is-collapsed", state.refinementPromptCollapsed);
      refinementToggle.setAttribute("aria-expanded", String(!state.refinementPromptCollapsed));
      syncStackHeight();
      return;
    }

    const refinementSkip = event.target.closest("[data-refinement-skip]");
    if (refinementSkip) {
      state.refinementPromptCollapsed = true;
      const panel = refinementSkip.closest(".quiz-refinement-panel");
      panel?.classList.add("is-collapsed");
      syncStackHeight();
      return;
    }

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

    if (event.target.matches("[data-current-monthly-cost], [data-notice-period], [data-keep-number], [data-number-owner-confirmed], [data-addon-monthly-cost], [data-device-monthly-cost], [data-device-remaining-months], [data-coverage-locations]")) {
      handleOperatorDetailChange(event.target);
      return;
    }

    if (event.target !== dom.newCustomersSelect) return;

    const existingCustomers = Number(dom.newCustomersSelect.value);
    if (!existingCustomers) return;

    state.existingCustomers = existingCustomers;
    state.newCustomers = Math.max((state.persons || 1) - existingCustomers, 0);
    prepareOperatorQuestion(existingCustomers);
  }

  function handleWrapperInput(event) {
    if (!event.target.matches("[data-current-monthly-cost], [data-addon-monthly-cost], [data-device-monthly-cost], [data-device-remaining-months], [data-coverage-locations]")) return;
    handleOperatorDetailChange(event.target);
  }

  function handleQuizAiClick(button) {
    const context = buildQuizChatContext();
    const message = "Fortsätt härifrån med Dealett AI";

    if (window.DealettChat?.continueFromQuiz) {
      window.DealettChat.continueFromQuiz({
        message,
        qualification: context.qualification,
        currentStage: context.currentStage,
        currentStep: context.currentStep,
        answers: context.answers,
        context,
      });
      return;
    }

    document.querySelector(".dealett-chat-toggle")?.click();
  }

  function buildQuizChatContext() {
    const qualification = buildQualificationFromState();
    const activeStep = steps[state.currentStep] || null;
    const stageTitle = activeStep?.querySelector(".quiz-title, .result-title")?.textContent?.trim() || "";

    return {
      quizHandoff: true,
      source: "homepage_mobile_quiz",
      currentStep: state.currentStep,
      currentStage: activeStep?.id || `step${state.currentStep}`,
      currentStageTitle: stageTitle,
      readyForOffer: qualification.readyForOffer,
      missingFields: qualification.missingFields || [],
      answers: JSON.parse(JSON.stringify({
        ...state,
        qualification,
        answerFacts: getAnswerCompareFacts(),
      })),
      people: qualification.people || [],
      qualification,
    };
  }

  function handleOperatorDetailChange(input) {
    const personIndex = Number(input.dataset.personIndex);
    if (!Number.isInteger(personIndex)) return;

    const numericValue = Math.max(Number(input.value) || 0, 0);
    if (input.matches("[data-current-monthly-cost]")) state.currentMonthlyCosts[personIndex] = numericValue || null;
    if (input.matches("[data-notice-period]")) state.noticePeriodMonths[personIndex] = numericValue;
    if (input.matches("[data-keep-number]")) state.keepNumberPreferences[personIndex] = input.value || "port_number";
    if (input.matches("[data-number-owner-confirmed]")) state.numberOwnerConfirmed[personIndex] = Boolean(input.checked);
    if (input.matches("[data-addon-monthly-cost]")) state.addOnMonthlyCosts[personIndex] = numericValue;
    if (input.matches("[data-device-monthly-cost]")) state.devicePaymentMonthlyCosts[personIndex] = numericValue;
    if (input.matches("[data-device-remaining-months]")) state.devicePaymentRemainingMonths[personIndex] = numericValue;
    if (input.matches("[data-coverage-locations]")) state.coverageLocations[personIndex] = input.value || "";

    maybeAdvanceFromOperatorQuestion();
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
      rewardMixLabel: rewardTotal ? giftCardPlaceholder : "",
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
      rewardMixLabel: rewardTotal ? giftCardPlaceholder : card.dataset.rewardMixLabel || "",
      rewards: rewardTotal > 0 ? { Presentkort: rewardTotal } : {}
    };
  }

  function buildRecommendationCartItem(plan) {
    const persons = Number(plan.peopleCount ?? plan.offerCalculation?.peopleCount ?? state.persons) || 1;
    const rewardTotal = Math.max(Number(plan.giftCardValue ?? plan.offerCalculation?.giftCardValue) || 0, 0);

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
      regularMonthlyPrice: Number(plan.planMonthlyPrice ?? plan.finalPrice ?? plan.price) || 0,
      pricePerPerson: persons > 1 ? Number(plan.pricePerPerson) || 0 : 0,
      persons,
      phoneLines: persons,
      productType: persons > 1 ? "family" : "mobile",
      unitLabel: "abonnemang",
      rewardTotal,
      rewardMixLabel: rewardTotal ? giftCardPlaceholder : "",
      rewards: rewardTotal ? { Presentkort: rewardTotal } : {},
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
        currentMonthlyCosts: state.currentMonthlyCosts,
        noticePeriodMonths: state.noticePeriodMonths,
        keepNumberPreferences: state.keepNumberPreferences,
        numberOwnerConfirmed: state.numberOwnerConfirmed,
        addOnMonthlyCosts: state.addOnMonthlyCosts,
        devicePaymentMonthlyCosts: state.devicePaymentMonthlyCosts,
        devicePaymentRemainingMonths: state.devicePaymentRemainingMonths,
        coverageLocations: state.coverageLocations,
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
        plan.offerCalculation?.total24MonthCost
          ? `24 mån total ${new Intl.NumberFormat("sv-SE").format(plan.offerCalculation.total24MonthCost)} kr`
          : "",
        giftCardPlaceholder,
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
        handlePriceStep(step, option);
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
    resizePersonDetailArrays(persons);
    state.selectedOperator = null;
    state.customerStatus = "all";
    state.existingCustomers = persons;
    state.newCustomers = 0;
    state.resultMode = "initial";
    state.selectedRefinements = [];
    state.refinementQueue = [];
    state.refinementPromptCollapsed = false;

    setSelected(step, "[data-persons]", option);
    resetCustomerStep();
    prepareOperatorQuestion(persons);
    showStepAfterSelection(1);
  }

  function startQuizFromHeroOffer(button) {
    const persons = Number(button.dataset.heroOfferPersons);
    if (!persons) return;

    startQuiz({ inHero: true });
    window.setTimeout(() => {
      const option = steps[0]?.querySelector(`[data-persons="${persons}"]`);
      if (option) handlePersonsStep(option, steps[0]);
    }, selectionFeedbackMs);
  }

  function resizePersonDetailArrays(persons) {
    const count = Math.max(Number(persons) || 0, 0);
    const resize = (items, fallback) => Array.from({ length: count }, (_, index) => (
      items[index] !== undefined ? items[index] : fallback
    ));

    state.currentMonthlyCosts = resize(state.currentMonthlyCosts || [], null);
    state.noticePeriodMonths = resize(state.noticePeriodMonths || [], 0);
    state.keepNumberPreferences = resize(state.keepNumberPreferences || [], "port_number");
    state.numberOwnerConfirmed = resize(state.numberOwnerConfirmed || [], false);
    state.addOnMonthlyCosts = resize(state.addOnMonthlyCosts || [], 0);
    state.devicePaymentMonthlyCosts = resize(state.devicePaymentMonthlyCosts || [], 0);
    state.devicePaymentRemainingMonths = resize(state.devicePaymentRemainingMonths || [], 0);
    state.coverageLocations = resize(state.coverageLocations || [], "");
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
      resizePersonDetailArrays(state.persons || 1);
      dom.newCustomersField?.classList.add("hidden");
      hideOperatorQuestion();
      showStepAfterSelection(dataStepIndex);
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
    resizePersonDetailArrays(persons);
    [
      "currentMonthlyCosts",
      "noticePeriodMonths",
      "keepNumberPreferences",
      "numberOwnerConfirmed",
      "addOnMonthlyCosts",
      "devicePaymentMonthlyCosts",
      "devicePaymentRemainingMonths",
      "coverageLocations"
    ].forEach(key => {
      state[key] = state[key].map((value, index) => (
        index < boundedExistingCount ? value : (key === "keepNumberPreferences" ? "new_number" : key === "coverageLocations" ? "" : key === "numberOwnerConfirmed" ? false : 0)
      ));
    });
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
    const isComplete = selectedCount === existingCount &&
      bindingChoiceCount === existingCount;

    return isComplete;
  }

  function maybeAdvanceFromOperatorQuestion() {
    if (!updateOperatorContinueState() || state.currentStep !== 1) return;

    showStepAfterSelection(dataStepIndex);
  }

  function handlePriceStep(step, option) {
    state.price = option.dataset.price || null;
    state.resultMode = state.selectedRefinements.length ? "refined" : "initial";
    setSelected(step, "[data-price]", option);
    showStepAfterSelection(resultStepIndex);
  }

  function handleSingleChoiceStep(step, selector, option, applyState) {
    applyState();
    setSelected(step, selector, option);

    showStepAfterSelection(getNextStepAfterCurrent());
  }

  function handleTravelStep(step, option) {
    state.internationalTravel = option.dataset.travel || null;
    setSelected(step, "[data-travel]", option);

    if (state.resultMode === "refined" && state.refinementQueue.includes(refinementStepIndexes.internationalUsage)) {
      showStepAfterSelection(getNextStepAfterCurrent());
      return;
    }

    if (isInternationalUsageRelevant()) {
      showStepAfterSelection(5);
      return;
    }

    state.internationalUsage = null;
    steps[5]?.querySelectorAll("[data-international-usage]").forEach(button => {
      button.classList.remove("selected", "active");
      button.setAttribute("aria-pressed", "false");
    });
    showStepAfterSelection(getNextStepAfterCurrent());
  }

  function isInternationalUsageRelevant() {
    return state.internationalTravel === "outside_eu";
  }

  function getPreviousStepIndex(index) {
    if (index === resultStepIndex) {
      return state.resultMode === "refined" && state.selectedRefinements.length
        ? getLastAnsweredRefinementStep()
        : priceStepIndex;
    }
    if (index === priceStepIndex) return dataStepIndex;
    if (index === refinementStepIndexes.internationalUsage) return refinementStepIndexes.travel;
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

    showStepAfterSelection(getNextStepAfterCurrent());
  }

  function handleRefinementStart() {
    const selected = ["streaming", "travel", "internationalUsage"];
    state.resultMode = "refined";
    state.selectedRefinements = selected;
    state.refinementQueue = buildRefinementQueue(selected);
    state.refinementPromptCollapsed = false;

    const firstStep = state.refinementQueue[0];
    if (Number.isInteger(firstStep)) {
      showStep(firstStep);
    }
  }

  function buildRefinementQueue(selected = state.selectedRefinements) {
    const order = ["streaming", "travel", "internationalUsage"];
    return order
      .filter(key => selected.includes(key))
      .map(key => refinementStepIndexes[key])
      .filter(Number.isInteger);
  }

  function getNextStepAfterCurrent() {
    if (state.currentStep === dataStepIndex) return priceStepIndex;
    if (state.resultMode !== "refined" || !state.refinementQueue.length) return resultStepIndex;

    const currentQueueIndex = state.refinementQueue.indexOf(state.currentStep);
    if (currentQueueIndex >= 0 && currentQueueIndex < state.refinementQueue.length - 1) {
      return state.refinementQueue[currentQueueIndex + 1];
    }

    return resultStepIndex;
  }

  function getLastAnsweredRefinementStep() {
    const queue = buildRefinementQueue();
    return queue.length ? queue[queue.length - 1] : priceStepIndex;
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
    dom.operatorContainer.dataset.operatorCount = String(count);
    dom.operatorContainer.classList.toggle("hidden", count <= 0);
    const operatorBody = dom.operatorContainer.closest(".quiz-card-body");
    operatorBody?.classList.toggle("quiz-card-body--operator-active", count > 0);
    if (operatorBody) operatorBody.dataset.operatorCount = String(count);
    updateOperatorQuestionTitle(count);
    dom.customerOperatorQuestion?.classList.toggle("hidden", count <= 0);

    state.operators.slice(0, count).forEach((selectedOperator, personIndex) => {
      const fragment = dom.operatorTemplate.content.cloneNode(true);
      const card = fragment.firstElementChild;

      card?.setAttribute("data-operator-group", "");
      card?.setAttribute("data-operator-count", String(count));

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

      fragment.querySelectorAll("[data-current-monthly-cost]").forEach(input => {
        input.dataset.personIndex = String(personIndex);
        input.value = state.currentMonthlyCosts[personIndex] || "";
      });

      fragment.querySelectorAll("[data-notice-period]").forEach(input => {
        input.dataset.personIndex = String(personIndex);
        input.value = String(state.noticePeriodMonths[personIndex] || 0);
      });

      fragment.querySelectorAll("[data-keep-number]").forEach(input => {
        input.dataset.personIndex = String(personIndex);
        input.value = state.keepNumberPreferences[personIndex] || "port_number";
      });

      fragment.querySelectorAll("[data-number-owner-confirmed]").forEach(input => {
        input.dataset.personIndex = String(personIndex);
        input.checked = Boolean(state.numberOwnerConfirmed[personIndex]);
      });

      fragment.querySelectorAll("[data-addon-monthly-cost]").forEach(input => {
        input.dataset.personIndex = String(personIndex);
        input.value = state.addOnMonthlyCosts[personIndex] || "";
      });

      fragment.querySelectorAll("[data-device-monthly-cost]").forEach(input => {
        input.dataset.personIndex = String(personIndex);
        input.value = state.devicePaymentMonthlyCosts[personIndex] || "";
      });

      fragment.querySelectorAll("[data-device-remaining-months]").forEach(input => {
        input.dataset.personIndex = String(personIndex);
        input.value = state.devicePaymentRemainingMonths[personIndex] || "";
      });

      fragment.querySelectorAll("[data-coverage-locations]").forEach(input => {
        input.dataset.personIndex = String(personIndex);
        input.value = state.coverageLocations[personIndex] || "";
      });

      dom.operatorContainer.appendChild(fragment);
    });

    syncStackHeight();
  }

  function updateOperatorQuestionTitle(count) {
    if (!dom.customerOperatorQuestion) return;

    dom.customerOperatorQuestion.textContent = count === 1
      ? "Vilken operatör har du? Välj datum för bindningstiden också."
      : "Vilka operatörer har ni? Välj datum för bindningstiderna också.";
  }

  function mountQuizInHero() {
    if (!dom.wrapper) return;

    if (!sectionWrapperAnchor.parentNode) {
      dom.wrapper.parentNode?.insertBefore(sectionWrapperAnchor, dom.wrapper);
    }

    if (!quizModalLayer) {
      quizModalLayer = document.createElement("div");
      quizModalLayer.id = "dealett-quiz-modal-layer";
      quizModalLayer.className = "quiz-modal-layer";
      quizModalLayer.setAttribute("aria-live", "polite");
      document.body.appendChild(quizModalLayer);
    }

    quizModalLayer.appendChild(dom.wrapper);
    document.body.classList.add("quiz-overlay-open");
  }

  function mountQuizInSection() {
    if (!dom.wrapper) return;

    sectionWrapperAnchor.parentNode?.insertBefore(dom.wrapper, sectionWrapperAnchor);
    document.body.classList.remove("quiz-overlay-open");
  }

  function startQuiz(options = {}) {
    const preserveScroll = options.inHero
      ? { x: window.scrollX || 0, y: window.scrollY || 0 }
      : null;

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
      if (preserveScroll) {
        window.scrollTo(preserveScroll.x, preserveScroll.y);
        window.setTimeout(() => window.scrollTo(preserveScroll.x, preserveScroll.y), 0);
      }
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
    requestAnimationFrame(alignActiveStepInViewport);

    if (safeIndex === resultStepIndex) {
      renderRecommendations();
    }
  }

  function alignActiveStepInViewport() {
    const activeStep = steps[state.currentStep];
    const activeCard = activeStep?.querySelector(".quiz-card") || activeStep;
    if (!activeCard || dom.wrapper?.classList.contains("hidden")) return;
    if (document.body.classList.contains("quiz-overlay-open") && dom.wrapper?.parentElement === quizModalLayer) return;

    const headerHeight = document.querySelector(".site-header")?.getBoundingClientRect().height || 0;
    const rect = activeCard.getBoundingClientRect();
    const targetTop = Math.max(window.scrollY + rect.top - headerHeight - 12, 0);
    const isHiddenUnderHeader = rect.top < headerHeight + 8;
    const isTooLow = rect.top > Math.max(window.innerHeight * 0.2, headerHeight + 80);

    if (isHiddenUnderHeader || isTooLow) {
      window.scrollTo({ top: targetTop, behavior: "auto" });
    }
  }

  function updateStepState(activeIndex) {
    const visibleIndexes = getVisibleStepIndexes();
    const activeVisibleIndex = visibleIndexes.indexOf(activeIndex);

    steps.forEach((step, index) => {
      step.classList.remove("active-step", "stacked-card", "upcoming-card", "hidden-step");
      step.setAttribute("aria-hidden", index === activeIndex ? "false" : "true");

      const visibleIndex = visibleIndexes.indexOf(index);
      if (visibleIndex < 0) {
        step.classList.add("hidden-step");
        return;
      }

      if (visibleIndex < activeVisibleIndex) {
        step.classList.add("stacked-card");
      } else if (index === activeIndex) {
        step.classList.add("active-step");
      } else {
        step.classList.add("upcoming-card");
      }
    });
  }

  function getVisibleStepIndexes() {
    const baseSteps = [0, 1, dataStepIndex, priceStepIndex];
    const refinementSteps = state.resultMode === "refined"
      ? buildRefinementQueue()
      : [];

    return [...new Set([...baseSteps, ...refinementSteps, resultStepIndex])]
      .filter(index => index >= 0 && index <= resultStepIndex);
  }

  function syncProgress() {
    const visibleQuestionSteps = getVisibleStepIndexes().filter(index => index !== resultStepIndex);
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

    updateResultHeader();

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
      dom.offersContainer.appendChild(buildRefinementPanel());
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
      dom.offersContainer.appendChild(buildRefinementPanel());
      syncStackHeight();
      return;
    }

    renderRecommendationResults(getUniqueOperatorPlans(recommendedPlans), { expanded: false });

    syncStackHeight();
  }

  function updateResultHeader() {
    const resultStep = steps[resultStepIndex];
    const title = resultStep?.querySelector(".result-title");
    const desc = resultStep?.querySelector(".result-desc");
    const isRefined = state.resultMode === "refined" && state.selectedRefinements.length > 0;

    if (title) {
      title.textContent = isRefined
        ? "Vi uppdaterade dina bästa alternativ"
        : "Här är våra initiala erbjudanden";
    }

    if (desc) {
      desc.textContent = isRefined
        ? "Nu väger vi även in de extra frågor du besvarade."
        : "Baserat på antal personer, nuvarande operatör, bindningstid, surf och pris visar vi en första matchning.";
    }
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

    const calculation = await fetchOfferCalculation(qualification);
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

  async function fetchOfferCalculation(qualification) {
    const requestCalculation = (requestQualification) => window.DealettNetwork.fetchJson("https://db-qtmd.onrender.com/api/offers/calculate", {
      label: "Behovsanalys kalkyl",
      timeoutMs: 18000,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qualification: requestQualification }),
    });

    const calculation = await requestCalculation(qualification);
    const canRetryInitialWithoutData = qualification.recommendationMode === "initial" &&
      calculation?.readyForOffer === false &&
      Array.isArray(calculation.missingFields) &&
      calculation.missingFields.length === 1 &&
      calculation.missingFields.includes("mobileUsage");

    if (!canRetryInitialWithoutData) return calculation;

    return requestCalculation({
      ...qualification,
      mobileUsage: "low",
      people: (qualification.people || []).map(person => ({
        ...person,
        dataNeed: person.dataNeed || "low",
      })),
      initialCompatibilityAssumption: "mobileUsage-low",
      missingFields: [],
      readyForOffer: true,
    });
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
    if (!plan) return "";
    return String(plan.planId ?? plan.id ?? [plan.operator, plan.title].filter(Boolean).join("-"));
  }

  function buildCalculatedRecommendationPlan(plan, qualification) {
    const offerCalculation = plan.offerCalculation || plan;
    const planId = offerCalculation.planId || plan.planId || plan.id;

    return {
      ...plan,
      id: planId,
      logo: getOperatorLogo(plan.operator),
      finalPrice: plan.planMonthlyPrice ?? plan.finalPrice,
      offerCalculation,
      qualification,
    };
  }

  function combineRecommendationLabels(labels = []) {
    const uniqueLabels = [...new Set(labels.filter(Boolean))];
    if (uniqueLabels.length <= 1) return uniqueLabels[0] || "Rekommenderat";

    return uniqueLabels
      .map((label, index) => index === 0 ? label : label.charAt(0).toLowerCase() + label.slice(1))
      .join(" & ");
  }

  function selectFeaturedRecommendationEntries(plans = []) {
    const qualification = buildQualificationFromState();
    const featuredByKey = new Map();
    const addFeaturedPlan = (plan, label, { mergeLabel = true } = {}) => {
      const key = getRecommendationKey(plan);
      if (!key) return;

      if (featuredByKey.has(key)) {
        if (mergeLabel) featuredByKey.get(key).labels.push(label);
        return;
      }

      featuredByKey.set(key, {
        labels: [label],
        plan: buildCalculatedRecommendationPlan(plan, qualification),
      });
    };

    [
      { plan: lastOfferCalculation?.bestValue, label: "Bäst värde" },
      { plan: lastOfferCalculation?.bestTravelFit, label: "Bäst för utlandet" },
      { plan: lastOfferCalculation?.bestStreamingFit, label: "Bäst för streaming" },
      { plan: lastOfferCalculation?.lowestMonthlyPrice, label: "Lägst månadspris" }
    ].forEach(entry => addFeaturedPlan(entry.plan, entry.label));

    [...plans]
      .sort((left, right) => (
        (Number(left?.planMonthlyPrice ?? left?.finalPrice) || Number.POSITIVE_INFINITY) -
        (Number(right?.planMonthlyPrice ?? right?.finalPrice) || Number.POSITIVE_INFINITY)
      ))
      .forEach(plan => {
        if (featuredByKey.size < 2) addFeaturedPlan(plan, "Annat starkt alternativ", { mergeLabel: false });
      });

    return [...featuredByKey.values()].slice(0, 2).map(entry => ({
      plan: entry.plan,
      label: combineRecommendationLabels(entry.labels),
    }));
  }

  function getExpandedRecommendationLabel(plan, index, featuredEntries = []) {
    const key = getRecommendationKey(plan);
    const featuredEntry = featuredEntries.find(entry => key === getRecommendationKey(entry.plan));

    if (featuredEntry) return featuredEntry.label;

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
      toggle.textContent = "Visa alla operatörer";
      toggle.setAttribute("aria-expanded", "false");
      toggle.addEventListener("click", () => {
        renderRecommendationResults(plans, { expanded: true });
        syncStackHeight();
      });
      dom.offersContainer.appendChild(toggle);
    }

    dom.offersContainer.appendChild(buildRefinementPanel());
  }

  function buildRefinementPanel() {
    const panel = document.createElement("section");
    panel.className = [
      "quiz-refinement-panel",
      "quiz-refinement-panel--blind",
      state.refinementPromptCollapsed ? "is-collapsed" : ""
    ].filter(Boolean).join(" ");
    panel.setAttribute("aria-label", "Förfina erbjudanden");

    const isRefined = state.resultMode === "refined" && state.selectedRefinements.length > 0;
    const title = isRefined
      ? "Resultaten är uppdaterade med dina extra svar."
      : "Svara på 3 frågor till för bättre resultat";
    const copy = isRefined
      ? "Du kan fortfarande gå igenom frågorna igen om du vill finjustera analysen."
      : "Vi väger in streaming, resor och användning utanför EU innan vi räknar om dina erbjudanden.";

    panel.innerHTML = [
      '<button class="quiz-refinement-tab" type="button" data-refinement-toggle="open" aria-expanded="false">',
      '  <span>3 frågor för bättre resultat</span>',
      '  <span aria-hidden="true">⌄</span>',
      '</button>',
      '<div class="quiz-refinement-blind">',
      '  <div class="quiz-refinement-copy">',
      `    <p class="quiz-refinement-kicker">${isRefined ? 'Fördjupad matchning' : 'Bättre matchning'}</p>`,
      `    <h4>${escapeHtml(title)}</h4>`,
      `    <p>${escapeHtml(copy)}</p>`,
      '  </div>',
      '  <div class="quiz-refinement-actions">',
      '    <button class="quiz-next-button" type="button" data-refinement-start>Svara på frågorna</button>',
      '    <button class="quiz-refinement-link" type="button" data-refinement-skip data-refinement-toggle="close" aria-expanded="true">Stäng</button>',
      '  </div>',
      '</div>',
    ].join("");

    return panel;
  }

  function buildQualificationFromState() {
    const peopleCount = Number(state.persons) || null;
    const existingCount = Number(state.existingCustomers || 0);
    const operators = Array.from({ length: peopleCount || 0 }, (_, index) => {
      if (state.customerStatus === "none" || index >= existingCount) {
        return "Annan / ingen";
      }

      return state.operators[index] || "Annan / ingen";
    });
    const bindingEnds = Array.from({ length: peopleCount || 0 }, (_, index) => {
      if (state.customerStatus === "none" || index >= existingCount) {
        return "Ingen bindningstid";
      }

      if (state.operatorNoBinding[index]) return "Ingen bindningstid";
      return state.operatorDates[index] || "Vet inte";
    });
    const exactMonthlyPrices = Array.from({ length: peopleCount || 0 }, (_, index) => Number(state.currentMonthlyCosts[index]) || 0)
      .filter(value => value > 0);
    const people = Array.from({ length: peopleCount || 0 }, (_, index) => {
      const existingCustomer = state.customerStatus !== "none" && index < existingCount;
      const coverage = String(state.coverageLocations[index] || "")
        .split(/[,;]+/)
        .map(value => value.trim())
        .filter(Boolean);

      return {
        id: `person-${index + 1}`,
        label: `Person ${index + 1}`,
        currentOperator: existingCustomer ? (state.operators[index] || "Annan / ingen") : "Annan / ingen",
        currentMonthlyCost: existingCustomer ? Number(state.currentMonthlyCosts[index]) || null : null,
        bindingEnd: existingCustomer
          ? (state.operatorNoBinding[index] ? "Ingen bindningstid" : state.operatorDates[index] || "Vet inte")
          : "Ingen bindningstid",
        noticePeriodMonths: existingCustomer ? Number(state.noticePeriodMonths[index]) || 0 : 0,
        dataNeed: state.data || null,
        keepNumberPreference: existingCustomer
          ? state.keepNumberPreferences[index] || "port_number"
          : "new_number",
        mustKeepNumber: existingCustomer && ["port_number", "scheduled_port"].includes(state.keepNumberPreferences[index] || "port_number"),
        numberOwnerConfirmed: Boolean(state.numberOwnerConfirmed[index]),
        hasAddOns: Number(state.addOnMonthlyCosts[index]) > 0,
        addOnMonthlyCost: existingCustomer ? Number(state.addOnMonthlyCosts[index]) || 0 : 0,
        devicePaymentMonthlyCost: existingCustomer ? Number(state.devicePaymentMonthlyCosts[index]) || 0 : 0,
        devicePaymentRemainingMonths: existingCustomer ? Number(state.devicePaymentRemainingMonths[index]) || 0 : 0,
        coverageLocations: coverage,
        existingCustomer,
        excluded: (state.keepNumberPreferences[index] || "") === "exclude"
      };
    });
    const missingFields = [];
    if (!peopleCount) missingFields.push("peopleCount");
    if (!peopleCount || operators.length < peopleCount) missingFields.push("operators");
    if (!peopleCount || bindingEnds.length < peopleCount) missingFields.push("bindingEnds");
    if (!state.data) missingFields.push("mobileUsage");
    if (!state.price) missingFields.push("priceRange");

    return {
      peopleCount,
      people,
      operators,
      bindingEnds,
      recommendationMode: state.resultMode === "refined" ? "refined" : "initial",
      mobileUsage: state.data || null,
      priceRange: state.price || null,
      streamingCalculation: state.streamingCalculation || null,
      streamingServices: state.streamingServices,
      streamingMonthlyCosts: state.streamingMonthlyCosts,
      internationalTravel: state.internationalTravel || null,
      internationalUsage: state.internationalUsage || null,
      exactMonthlyPrice: null,
      exactMonthlyPrices,
      readyForOffer: missingFields.length === 0,
      missingFields,
    };
  }

  function handleChatQualificationUpdate(event) {
    const qualification = event.detail?.qualification;
    if (!qualification || !document.body.contains(dom.wrapper)) return;
    applyQualificationFromChat(qualification, { refreshResults: true });
  }

  function applyQualificationFromChat(qualification = {}, options = {}) {
    const peopleCount = Number(qualification.peopleCount) || state.persons || null;
    if (peopleCount) {
      state.persons = peopleCount;
      state.operators = Array.from({ length: peopleCount }, (_, index) => state.operators[index] || null);
      state.operatorDates = Array.from({ length: peopleCount }, (_, index) => state.operatorDates[index] || null);
      state.operatorNoBinding = Array.from({ length: peopleCount }, (_, index) => Boolean(state.operatorNoBinding[index]));
      resizePersonDetailArrays(peopleCount);
    }

    const people = Array.isArray(qualification.people) ? qualification.people : [];
    if (people.length) {
      const count = Number(state.persons) || people.length;
      state.existingCustomers = people.filter((person) => person.existingCustomer !== false && person.currentOperator && person.currentOperator !== "Annan / ingen").length;
      state.newCustomers = Math.max(count - (state.existingCustomers || 0), 0);
      state.customerStatus = state.existingCustomers === 0
        ? "none"
        : state.existingCustomers < count ? "partial" : "all";

      people.slice(0, count).forEach((person, index) => {
        state.operators[index] = person.currentOperator && person.currentOperator !== "Annan / ingen" ? person.currentOperator : null;
        state.currentMonthlyCosts[index] = Number(person.currentMonthlyCost) || state.currentMonthlyCosts[index] || null;
        state.noticePeriodMonths[index] = Number(person.noticePeriodMonths) || 0;
        state.keepNumberPreferences[index] = person.keepNumberPreference || state.keepNumberPreferences[index] || "port_number";
        state.numberOwnerConfirmed[index] = person.numberOwnerConfirmed === true;
        state.addOnMonthlyCosts[index] = Number(person.addOnMonthlyCost) || 0;
        state.devicePaymentMonthlyCosts[index] = Number(person.devicePaymentMonthlyCost) || 0;
        state.devicePaymentRemainingMonths[index] = Number(person.devicePaymentRemainingMonths) || 0;
        state.coverageLocations[index] = Array.isArray(person.coverageLocations)
          ? person.coverageLocations.join(", ")
          : state.coverageLocations[index] || "";

        const bindingEnd = String(person.bindingEnd || "").trim();
        state.operatorNoBinding[index] = /ingen bindningstid/i.test(bindingEnd) || Number(person.remainingBindingMonths) === 0;
        state.operatorDates[index] = /^\d{4}-\d{2}-\d{2}$/.test(bindingEnd) ? bindingEnd : null;
      });
      state.selectedOperator = state.operators.find(Boolean) || null;
    } else {
      if (Array.isArray(qualification.operators)) {
        state.operators = Array.from({ length: state.persons || qualification.operators.length }, (_, index) => {
          const operator = qualification.operators[index];
          return operator && operator !== "Annan / ingen" ? operator : null;
        });
        state.selectedOperator = state.operators.find(Boolean) || null;
      }
      if (Array.isArray(qualification.bindingEnds)) {
        state.operatorDates = Array.from({ length: state.persons || qualification.bindingEnds.length }, (_, index) => {
          const bindingEnd = String(qualification.bindingEnds[index] || "");
          return /^\d{4}-\d{2}-\d{2}$/.test(bindingEnd) ? bindingEnd : null;
        });
        state.operatorNoBinding = Array.from({ length: state.persons || qualification.bindingEnds.length }, (_, index) => (
          /ingen bindningstid/i.test(String(qualification.bindingEnds[index] || ""))
        ));
      }
    }

    if (qualification.mobileUsage) state.data = qualification.mobileUsage;
    if (qualification.priceRange) state.price = qualification.priceRange;
    if (qualification.streamingCalculation) state.streamingCalculation = qualification.streamingCalculation;
    if (Array.isArray(qualification.streamingServices)) state.streamingServices = qualification.streamingServices;
    if (qualification.streamingMonthlyCosts && typeof qualification.streamingMonthlyCosts === "object") {
      state.streamingMonthlyCosts = { ...qualification.streamingMonthlyCosts };
    }
    if (qualification.internationalTravel) state.internationalTravel = qualification.internationalTravel;
    if (qualification.internationalUsage) state.internationalUsage = qualification.internationalUsage;

    syncQuizUiFromState();
    if (options.refreshResults && state.currentStep === resultStepIndex) {
      renderRecommendations();
    }
  }

  function syncQuizUiFromState() {
    steps[0]?.querySelectorAll("[data-persons]").forEach(button => {
      const selected = Number(button.dataset.persons) === Number(state.persons);
      button.classList.toggle("selected", selected);
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    [
      { index: 2, selector: "[data-data]", value: state.data, key: "data" },
      { index: 4, selector: "[data-travel]", value: state.internationalTravel, key: "travel" },
      { index: 5, selector: "[data-international-usage]", value: state.internationalUsage, key: "internationalUsage" },
      { index: 6, selector: "[data-price]", value: state.price, key: "price" },
    ].forEach(({ index, selector, value, key }) => {
      steps[index]?.querySelectorAll(selector).forEach(button => {
        const selected = button.dataset[key] === value;
        button.classList.toggle("selected", selected);
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    });

    steps[3]?.querySelectorAll("[data-streaming-service]").forEach(input => {
      input.checked = state.streamingServices.includes(input.value);
    });
    steps[3]?.querySelectorAll("[data-streaming-cost]").forEach(input => {
      input.value = state.streamingMonthlyCosts[input.dataset.streamingCost] || "";
    });

    if (state.currentStep === 1) {
      renderOperatorChoices(state.existingCustomers || state.persons || 0);
    }
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
    const total24MonthCost = Number(plan.offerCalculation?.total24MonthCost);
    const total24MonthResult = Number(plan.offerCalculation?.total24MonthResult);
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
        { label: "Presentkort", value: "XXX kr" },
        isMulti ? { label: "Totalpris", value: `${formatMoney(finalPrice)}/m\u00e5n` } : null,
        contractMonths ? { label: "Bindningstid", value: `${contractMonths} m\u00e5n` } : null,
        { label: "Effektiv kostnad", value: `${formatMoney(effectiveMonthlyCost)}/mån` },
        Number.isFinite(total24MonthCost) ? { label: "24 mån total", value: formatMoney(total24MonthCost) } : null,
        Number.isFinite(total24MonthResult) ? {
          label: total24MonthResult >= 0 ? "24 mån resultat" : "24 mån merkostnad",
          value: formatMoney(Math.abs(total24MonthResult)),
        } : null,
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
    const peopleCount = Number(plan.peopleCount ?? plan.offerCalculation?.peopleCount ?? state.persons) || 1;
    const planMonthlyPrice = Number(plan.planMonthlyPrice ?? plan.finalPrice ?? plan.price) || 0;
    const total24MonthCost = Number(plan.total24MonthCost ?? plan.offerCalculation?.total24MonthCost);
    const remainingOldCosts = Number(plan.remainingOldCosts ?? plan.offerCalculation?.remainingOldCosts) || 0;
    const streamingSavings = Number(plan.streamingSavings ?? plan.offerCalculation?.streamingSavings) || 0;
    const switchAction = plan.switchAction || plan.offerCalculation?.switchAction || "";
    const dataText = plan.data || (plan.dataAmount >= 999 ? "obegränsad surf" : `${plan.dataAmount} GB`);
    const operator = plan.operator || "operatören";
    const notes = [
      `Det här passar ${peopleCount === 1 ? "1 användare" : `${peopleCount} användare`} med ${String(dataText).toLowerCase()} hos ${operator}.`,
      planMonthlyPrice > 0 ? `Du betalar ${formatMoney(planMonthlyPrice)}/mån.` : "",
      Number.isFinite(total24MonthCost)
        ? `På 24 månader blir helheten cirka ${formatMoney(total24MonthCost)} efter presentkort och valda behov.`
        : "",
      remainingOldCosts > 0
        ? "Vi har också räknat med att en gammal kostnad kan finnas kvar en kort period."
        : "",
      streamingSavings > 0
        ? "Streaming som ingår räknas som extra värde om den ersätter något du redan betalar för."
        : "",
      switchAction === "delay_switch"
        ? "Om bindningen är för lång är det bättre att vänta eller välja bort den personen just nu."
        : "",
      switchAction === "switch_some_now"
        ? "De som kan byta nu visas direkt, och övriga kan vänta tills bindningen är kortare."
        : "",
      "Numret kan flyttas, men kontrollera nummerägare, tillägg, mobilbetalning och uppsägningstid innan beställning."
    ];

    return notes.filter(Boolean).join(" ");
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
      '    <span class="offer-card__gift-badge" aria-label="Presentkort XXX kr"><strong>XXX kr</strong><span>Presentkort</span></span>',
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
      '        <p class="offer-card__stat-label">Månadskostnad</p>',
      `        <p class="offer-card__stat-value">${escapeHtml(priceMain)}</p>`,
      priceSub ? `        <p class="offer-card__stat-sub">${escapeHtml(priceSub)}</p>` : '',
      '      </div>',
      '    </div>',
      '  </div>',
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
