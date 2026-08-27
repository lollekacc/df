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
  const position = rotator.querySelector('[data-information-position]');
  const dialogQuestion = dialog.querySelector('[data-information-dialog-question]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let startIndex = 0;
  let cycleTimer = 0;
  let visible = true;
  let paused = false;
  let lastTrigger = null;
  let swapTimers = [];

  const visibleIndexes = () => slots.map((_, index) => (startIndex + index) % questions.length);

  const updatePosition = () => {
    if (!position) return;
    position.textContent = `${visibleIndexes().map((index) => index + 1).join(', ')} / ${questions.length}`;
  };

  const applyQuestion = (slot, questionIndex) => {
    slot.dataset.informationIndex = String(questionIndex);
    slot.setAttribute('aria-label', `Visa svar på fråga ${questionIndex + 1}`);
    const number = slot.querySelector('[data-information-number]');
    const text = slot.querySelector('[data-information-text]');
    if (number) number.textContent = String(questionIndex + 1).padStart(2, '0');
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
      const update = () => {
        if (!animate || reduceMotion.matches) {
          applyQuestion(slot, indexes[slotIndex]);
          slot.classList.remove('is-leaving', 'is-next');
          return;
        }

        slot.classList.add('is-leaving');
        const replaceTimer = window.setTimeout(() => {
          applyQuestion(slot, indexes[slotIndex]);
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
  };

  const move = (direction) => {
    startIndex = (startIndex + direction * slots.length + questions.length) % questions.length;
    render();
  };

  const runCycle = () => {
    if (!visible || paused || document.hidden || reduceMotion.matches || dialog.open) return;
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
      move(-1);
      return;
    }

    const next = event.target.closest('[data-information-next]');
    if (next) {
      move(1);
      return;
    }

    const slot = event.target.closest('[data-information-slot]');
    if (slot) openDialog(slot);
  });

  rotator.addEventListener('mouseenter', () => { paused = true; });
  rotator.addEventListener('mouseleave', () => { paused = false; });
  rotator.addEventListener('focusin', () => { paused = true; });
  rotator.addEventListener('focusout', (event) => {
    if (!rotator.contains(event.relatedTarget)) paused = false;
  });

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
  startCycle();
})();
