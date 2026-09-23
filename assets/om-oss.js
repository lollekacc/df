(() => {
  const section = document.querySelector('.about-logo-reveal');
  if (!section) return;
  const main = section.closest('.about-main');
  const hero = main.querySelector('.about-hero');
  const partners = main.querySelector('.about-partners-section');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const updateReveal = () => {
    if (reducedMotion.matches) {
      main.style.removeProperty('--logo-background-offset');
      section.style.removeProperty('--logo-reveal-offset');
      section.style.removeProperty('--logo-tagline-opacity');
      section.style.removeProperty('--logo-tagline-rise');
      return;
    }
    const bounds = section.getBoundingClientRect();
    const center = Math.min(window.innerHeight / 2, (hero.offsetHeight + partners.offsetHeight) / 2);
    main.style.setProperty('--logo-background-height', `${center * 2}px`);
    main.style.setProperty('--logo-background-offset', `${-main.getBoundingClientRect().top}px`);
    const offset = center - bounds.height / 2 - bounds.top;
    section.style.setProperty('--logo-reveal-offset', `${offset}px`);
    const progress = Math.min(1, Math.max(0, (center - bounds.top) / Math.min(180, center * 0.5)));
    section.style.setProperty('--logo-tagline-opacity', `${progress}`);
    section.style.setProperty('--logo-tagline-rise', `${(1 - progress) * 16}px`);
  };

  Promise.resolve(window.DEALETT_includesReady).then(() => {
    const content = section.closest('.dealett-smooth-content');
    if (content) {
      new MutationObserver(updateReveal).observe(content, {
        attributes: true,
        attributeFilter: ['style'],
      });
    }
    const resizeObserver = new ResizeObserver(updateReveal);
    resizeObserver.observe(section);
    resizeObserver.observe(main);
    window.addEventListener('scroll', updateReveal, { passive: true });
    window.addEventListener('resize', updateReveal);
    reducedMotion.addEventListener('change', updateReveal);
    updateReveal();
  });
})();
