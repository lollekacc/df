(() => {
  const section = document.querySelector('.about-logo-reveal');
  if (!section) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const updateReveal = () => {
    if (reducedMotion.matches) {
      section.style.removeProperty('--logo-reveal-offset');
      return;
    }
    const bounds = section.getBoundingClientRect();
    const offset = (window.innerHeight - bounds.height) / 2 - bounds.top;
    section.style.setProperty('--logo-reveal-offset', `${offset}px`);
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
