(() => {
  const rewardDialog = document.querySelector('#rewardSection');
  const selection = document.querySelector('#subscriptionSelection');
  const selectedText = document.querySelector('#subscriptionSelectedText');
  const continueButton = document.querySelector('#subscriptionContinue');
  let rewardTrigger = null;
  const compareObserver = new MutationObserver(() => {
    const tray = document.querySelector('.compare-tray');
    if (!tray) return;
    new ResizeObserver(() => {
      document.body.style.setProperty('--subscription-compare-height', `${tray.getBoundingClientRect().height}px`);
    }).observe(tray);
    compareObserver.disconnect();
  });
  compareObserver.observe(document.body, { childList: true });
  new ResizeObserver(() => {
    document.body.style.setProperty('--subscription-selection-height', `${selection.getBoundingClientRect().height}px`);
  }).observe(selection);

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const openRewards = (trigger) => {
    if (!rewardDialog || rewardDialog.open) return;
    rewardTrigger = trigger;
    rewardDialog.showModal();
    document.body.classList.add('subscription-dialog-open');
  };

  const closeRewards = () => rewardDialog?.close();

  continueButton?.addEventListener('click', () => openRewards(continueButton));
  rewardDialog?.querySelector('[data-reward-close]')?.addEventListener('click', closeRewards);
  rewardDialog?.addEventListener('click', (event) => {
    const rect = rewardDialog.getBoundingClientRect();
    if (event.target === rewardDialog && (
      event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom
    )) closeRewards();
  });
  rewardDialog?.addEventListener('close', () => {
    document.body.classList.remove('subscription-dialog-open');
    if (rewardTrigger?.isConnected) rewardTrigger.focus();
  });

  const select = (offer) => {
    selectedText.textContent = [
      offer.operator || offer.provider,
      offer.title || offer.data || offer.surf,
      `${new Intl.NumberFormat('sv-SE').format(offer.price)} kr/mån`,
    ].filter(Boolean).join(' · ');
    selection.hidden = false;
    document.body.classList.add('has-subscription-selection');
  };

  const reset = () => {
    closeRewards();
    selection.hidden = true;
    document.body.classList.remove('has-subscription-selection');
  };

  const buildCard = (card, { logo, operator, heading, price, priceDetail, meta, actions, reward, onSelect }) => {
    card.style.setProperty('--provider-accent', card.style.getPropertyValue('--offer-accent'));
    card.style.removeProperty('--offer-accent');
    actions.querySelector('.offer-compare-button')?.classList.add('bredband-tv-btn');
    const selected = element('div', 'bredband-offer-selected');
    selected.setAttribute('aria-hidden', 'true');
    selected.append(element('i', 'fa-solid fa-check'));
    const top = element('div', 'bredband-offer-top');
    const brand = element('div', 'bredband-offer-brand');
    const logoWrap = element('div', 'bredband-operator-logo-wrap');
    const image = element('img', '');
    image.src = logo;
    image.alt = operator;
    image.loading = 'lazy';
    image.decoding = 'async';
    logoWrap.append(image);
    brand.append(logoWrap, heading);
    const gift = element('button', 'bredband-reward-btn');
    gift.type = 'button';
    gift.append(element('span', '', 'Presentkort'), element('strong', '', 'XXXX:-'));
    gift.addEventListener('click', () => {
      localStorage.setItem('rewardChoice', JSON.stringify({ reward: Number(reward) || 0 }));
      onSelect();
      openRewards(gift);
    });
    top.append(brand, gift);
    const priceRow = element('div', 'bredband-price-row');
    const priceCopy = element('div', '');
    priceCopy.append(price);
    const binding = meta.firstElementChild;
    if (binding) {
      priceCopy.append(element('p', 'bredband-binding', binding.textContent));
      binding.remove();
    }
    if (priceDetail) priceCopy.append(priceDetail);
    priceRow.append(priceCopy);
    for (const item of meta.children) {
      const text = element('span', '', item.textContent);
      const icon = element('i', 'fa-solid fa-check');
      icon.setAttribute('aria-hidden', 'true');
      item.replaceChildren(icon, text);
    }
    card.append(selected, top, priceRow, meta, actions);
    card.addEventListener('click', (event) => {
      if (!event.target.closest('button, a, input, select, label')) onSelect();
    });
  };

  window.DealettSubscriptionUI = { buildCard, select, reset, openRewards, closeRewards };
})();
