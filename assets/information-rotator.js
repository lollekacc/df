(() => {
  const questions = [
    'Jag är ensam och använder mest mobilen till sociala medier, musik och vanlig surf. Vilket abonnemang passar mig bäst?',
    'Vi är två personer som vill samla våra abonnemang och få en lägre månadskostnad. Vilket alternativ ger oss bäst värde?',
    'Vi är en familj på 3 personer med olika surfbehov. En använder mycket surf medan de andra använder mindre. Vad passar oss bäst?',
    'Vi är en familj på 5 personer och vill samla alla abonnemang hos samma operatör. Vilket familjeabonnemang blir billigast för oss?',
    'Jag reser ofta utanför EU och behöver kunna använda surf och ringa utomlands utan höga extrakostnader. Vilket abonnemang passar mig bäst?',
    'Jag betalar redan separat för Netflix, Disney+ och HBO Max. Finns det ett mobilabonnemang där tjänsterna ingår och som blir billigare totalt?',
    'Jag har bindningstid kvar hos min nuvarande operatör men vill byta till ett bättre erbjudande. När lönar det sig för mig att byta?',
    'Vi är en familj på 4 personer och är intresserade av ett familjeabonnemang. Två är vuxna och barnen är mellan 9–20 år. Vad passar oss bäst?',
  ];

  const rotator = document.querySelector('[data-information-rotator]');
  const dialog = document.querySelector('[data-information-dialog]');
  if (!rotator || !dialog) return;

  const slots = Array.from(rotator.querySelectorAll('[data-information-slot]'));
  const pages = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7],
  ];
  const position = rotator.querySelector('[data-information-position]');
  const toggleButton = rotator.querySelector('[data-information-toggle]');
  const toggleIcon = rotator.querySelector('[data-information-toggle-icon]');
  const pageButtons = Array.from(rotator.querySelectorAll('[data-information-page]'));
  const dialogQuestion = dialog.querySelector('[data-information-dialog-question]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let pageIndex = 0;
  let cycleTimer = 0;
  let visible = true;
  let manuallyPaused = false;
  let interactionPaused = false;
  let lastTrigger = null;
  let swapTimers = [];
  let touchStartX = 0;
  let touchStartY = 0;

  const visibleIndexes = () => pages[pageIndex];

  const updatePosition = () => {
    if (!position) return;
    position.textContent = `${visibleIndexes().map((index) => index + 1).join(', ')} / ${questions.length}`;
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
    slot.dataset.informationIndex = String(questionIndex);
    slot.setAttribute('aria-label', `Visa svar på fråga ${questionIndex + 1}`);
    const text = slot.querySelector('[data-information-text]');
    if (text) text.textContent = questions[questionIndex];
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

  const openDialog = (slot) => {
    const questionIndex = Number(slot.dataset.informationIndex);
    if (!Number.isInteger(questionIndex) || !questions[questionIndex]) return;
    lastTrigger = slot;
    if (dialogQuestion) dialogQuestion.textContent = questions[questionIndex];
    dialog.showModal();
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
    lastTrigger?.focus();
    lastTrigger = null;
  });

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }, { threshold: 0.15 });
  observer.observe(rotator);
  reduceMotion.addEventListener('change', startCycle);
  updatePosition();
  updateControls();
  startCycle();
})();
