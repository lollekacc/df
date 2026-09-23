document.addEventListener('DOMContentLoaded', () => {
  const comparison = document.querySelector('.company-comparison');
  if (!comparison) return;

  const cards = Array.from(comparison.querySelectorAll('.company-plan-card'));
  const sizeButtons = Array.from(comparison.querySelectorAll('.company-size-button'));
  const operatorButtons = Array.from(comparison.querySelectorAll('.company-operator-filter'));
  const sortControl = comparison.querySelector('#companyPlanSort');
  const planGrid = comparison.querySelector('.company-plan-grid');
  const resultCount = comparison.querySelector('[data-result-count]');
  const resultLabel = comparison.querySelector('[data-result-label]');
  const resetButton = comparison.querySelector('[data-reset-filters]');
  const emptyState = comparison.querySelector('[data-empty-state]');
  const guidance = comparison.querySelector('[data-size-guidance]');
  const guidanceLink = comparison.querySelector('[data-guidance-link]');
  const planLinks = Array.from(comparison.querySelectorAll('[data-plan-cta]'));
  const validSizes = new Set(['small', 'medium', 'large']);
  const validOperators = new Set(['all', 'telia', 'tele2', 'telenor', 'tre']);
  const validSorts = new Set(['recommended', 'price', 'operator']);
  const params = new URLSearchParams(window.location.search);
  const requestedOperator = params.get('operator');
  let storedSize = '';

  try {
    storedSize = localStorage.getItem('business_size') || '';
  } catch {
    storedSize = '';
  }

  const state = {
    operator: validOperators.has(requestedOperator) ? requestedOperator : 'all',
    size: validSizes.has(params.get('size'))
      ? params.get('size')
      : (validSizes.has(storedSize) ? storedSize : 'small'),
    sort: validSorts.has(params.get('sort')) ? params.get('sort') : 'recommended',
  };

  const sizeGuidance = {
    small: 'För 1–9 personer: jämför planerna nedan och välj den nivå som passar varje användare.',
    medium: 'För 10–99 personer: jämför planerna eller be oss samla upplägget för hela teamet.',
    large: 'För 100+ personer rekommenderar vi en skräddarsydd lösning. Planerna nedan är en bra utgångspunkt.',
  };

  const setQueryValue = (link, key, value) => {
    const url = new URL(link.href, window.location.href);
    url.searchParams.set(key, value);
    link.href = url.href;
  };

  const syncUrlState = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('size', state.size);

    if (state.operator === 'all') url.searchParams.delete('operator');
    else url.searchParams.set('operator', state.operator);

    if (state.sort === 'recommended') url.searchParams.delete('sort');
    else url.searchParams.set('sort', state.sort);

    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const sortCards = () => {
    const sorted = [...cards].sort((first, second) => {
      const firstPrice = Number(first.dataset.price || Number.MAX_SAFE_INTEGER);
      const secondPrice = Number(second.dataset.price || Number.MAX_SAFE_INTEGER);
      const firstOrder = Number(first.dataset.order || 0);
      const secondOrder = Number(second.dataset.order || 0);

      if (state.sort === 'price') return firstPrice - secondPrice || firstOrder - secondOrder;

      if (state.sort === 'operator') {
        return (first.dataset.operator || '').localeCompare(second.dataset.operator || '', 'sv')
          || firstPrice - secondPrice
          || firstOrder - secondOrder;
      }

      return Number(second.dataset.featured || 0) - Number(first.dataset.featured || 0)
        || firstOrder - secondOrder;
    });

    sorted.forEach((card) => planGrid.append(card));
  };

  const updateSize = () => {
    sizeButtons.forEach((button) => {
      const isActive = button.dataset.size === state.size;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });

    guidance.textContent = sizeGuidance[state.size];
    setQueryValue(guidanceLink, 'size', state.size);
    planLinks.forEach((link) => setQueryValue(link, 'size', state.size));

    try {
      localStorage.setItem('business_size', state.size);
    } catch {
      return;
    }
  };

  const updateOperator = () => {
    operatorButtons.forEach((button) => {
      const isActive = button.dataset.operatorFilter === state.operator;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  };

  const updateResults = (animate = false) => {
    sortCards();
    let visibleCount = 0;

    cards.forEach((card) => {
      const isVisible = state.operator === 'all' || card.dataset.operator === state.operator;
      card.hidden = !isVisible;
      if (isVisible) visibleCount += 1;
      if (!isVisible) card.querySelectorAll('details[open]').forEach((details) => details.removeAttribute('open'));
    });

    resultCount.textContent = String(visibleCount);
    resultLabel.textContent = visibleCount === 1 ? 'lösning' : 'lösningar';
    emptyState.hidden = visibleCount !== 0;
    if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      planGrid.getAnimations().forEach((animation) => animation.cancel());
      planGrid.animate(
        [{ opacity: 0.65, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 180, easing: 'ease-out' },
      );
    }
  };

  sizeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.size = button.dataset.size;
      updateSize();
      syncUrlState();
    });
  });

  operatorButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.operator = button.dataset.operatorFilter;
      updateOperator();
      updateResults(true);
      syncUrlState();
    });
  });

  sortControl.addEventListener('change', () => {
    state.sort = sortControl.value;
    updateResults(true);
    syncUrlState();
  });

  resetButton.addEventListener('click', () => {
    state.operator = 'all';
    state.size = 'small';
    state.sort = 'recommended';
    sortControl.value = state.sort;
    updateSize();
    updateOperator();
    updateResults(true);
    syncUrlState();
  });

  planLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const card = link.closest('.company-plan-card');
      const plan = card?.querySelector('h3')?.textContent.trim() || '';
      const operator = card?.dataset.operator || '';

      try {
        localStorage.setItem('business_inquiry', JSON.stringify({ operator, plan, size: state.size }));
      } catch {
        return;
      }
    });
  });

  const chatForm = document.querySelector('.company-chat [data-home-ai-form]');
  const chatInput = chatForm?.querySelector('textarea');
  chatForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const question = chatInput.value.trim();
    if (!question || !window.DealettChat?.ask) return;
    const accepted = window.DealettChat.ask(question, {
      source: 'business_ai_guide',
      audience: 'business',
      companySize: state.size,
      operator: state.operator,
    });
    if (accepted) chatInput.value = '';
    chatInput.focus({ preventScroll: true });
  });
  chatInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      chatForm.requestSubmit();
    }
  });
  document.querySelectorAll('[data-business-ai-prompt]').forEach((button) => {
    button.addEventListener('click', () => {
      chatInput.value = button.dataset.businessAiPrompt;
      chatInput.focus({ preventScroll: true });
    });
  });

  sortControl.value = state.sort;
  updateSize();
  updateOperator();
  updateResults();
});
