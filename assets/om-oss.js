(() => {
  const section = document.querySelector('.about-logo-reveal');
  if (!section) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const updateReveal = () => {
    if (reducedMotion.matches) {
      section.style.removeProperty('--logo-reveal-offset');
      section.style.removeProperty('--logo-tagline-opacity');
      section.style.removeProperty('--logo-tagline-rise');
      return;
    }
    const bounds = section.getBoundingClientRect();
    const offset = (window.innerHeight - bounds.height) / 2 - bounds.top;
    section.style.setProperty('--logo-reveal-offset', `${offset}px`);
    const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.55 - bounds.top) / (window.innerHeight * 0.25)));
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
    new ResizeObserver(updateReveal).observe(section);
    window.addEventListener('scroll', updateReveal, { passive: true });
    window.addEventListener('resize', updateReveal);
    reducedMotion.addEventListener('change', updateReveal);
    updateReveal();
  });
})();
