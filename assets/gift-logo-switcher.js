(() => {
  const switchers = document.querySelectorAll('[data-gift-logo-switcher]');

  switchers.forEach((switcher) => {
    const slots = Array.from(switcher.querySelectorAll('[data-gift-logo-slot]'));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    let showingAlternateSet = false;
    let cycleTimer = 0;

    const setFace = (slot, showAlternate) => {
      const faces = Array.from(slot.querySelectorAll('.gift-logo__face'));
      const current = faces.find((face) => face.classList.contains('is-current'));
      const next = faces[showAlternate ? 1 : 0];

      if (!current || !next || current === next) return;

      current.classList.remove('is-current');
      current.classList.add('is-leaving');
      current.setAttribute('aria-hidden', 'true');
      next.classList.remove('is-next', 'is-leaving');
      next.classList.add('is-current');
      next.removeAttribute('aria-hidden');
      slot.setAttribute('aria-label', next.dataset.company || '');

      window.setTimeout(() => {
        current.classList.remove('is-leaving');
        current.classList.add('is-next');
      }, 700);
    };

    const runCycle = () => {
      if (!visible || document.hidden || reduceMotion.matches) return;

      showingAlternateSet = !showingAlternateSet;
      slots.forEach((slot, index) => {
        window.setTimeout(() => setFace(slot, showingAlternateSet), index * 120);
      });
    };

    const start = () => {
      window.clearInterval(cycleTimer);
      cycleTimer = window.setInterval(runCycle, 4200);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    }, { threshold: 0.15 });

    slots.forEach((slot) => {
      const current = slot.querySelector('.gift-logo__face.is-current');
      slot.setAttribute('aria-label', current?.dataset.company || '');
    });
    observer.observe(switcher);
    reduceMotion.addEventListener('change', start);
    start();
  });
})();
