(() => {
  const buttons = [...document.querySelectorAll('[data-featured-offer]')];
  if (!buttons.length) return;
  const status = document.querySelector('[data-featured-offer-status]');
  const format = value => Number(value).toLocaleString('sv-SE');
  let pending = false;

  const load = async () => {
    try {
      const offers = await window.DealettNetwork.fetchJson('/api/featured-offers', { label: 'Aktuella erbjudanden' });
      buttons.forEach(button => {
        const offer = offers.find(item => item.id === button.dataset.featuredOffer && item.available);
        button.disabled = !offer;
        button.dataset.available = String(Boolean(offer));
        if (!offer) return;
        button.querySelector('.offer-content__heading').textContent = `${offer.persons} abonnemang`;
        button.querySelector('.offer-content__description').textContent = `${offer.operator} ${offer.title}`;
        button.querySelector('[data-offer-price]').textContent = format(offer.monthlyPrice);
        button.querySelector('[data-offer-per-person]').textContent = offer.persons > 1
          ? `${Number.isInteger(offer.monthlyPrice / offer.persons) ? '' : '≈ '}${format(Math.round(offer.monthlyPrice / offer.persons))} kr/person och månad`
          : 'Ett abonnemang. Hela priset.';
        button.querySelector('.offer-content__benefit').textContent = `${offer.bindingMonths} mån bindningstid`;
        const logo = button.querySelector('.offer-content__brand img');
        logo.src = offer.logo;
        logo.alt = offer.operator;
        const features = button.querySelector('[data-offer-features]');
        features.replaceChildren(...offer.features.map(text => {
          const row = document.createElement('span');
          const icon = document.createElement('i');
          icon.className = 'fa-solid fa-check';
          icon.setAttribute('aria-hidden', 'true');
          row.append(icon, document.createTextNode(text));
          return row;
        }));
        button.querySelector('.offer-content__amount').replaceChildren(document.createTextNode(`${format(offer.rewardTotal)} `), Object.assign(document.createElement('span'), { textContent: 'kr' }));
        button.setAttribute('aria-label', `Köp ${offer.operator} ${offer.title}, ${offer.persons} abonnemang, ${format(offer.monthlyPrice)} kr per månad`);
      });
      status.textContent = offers.some(offer => !offer.available) ? 'Vissa erbjudanden är inte tillgängliga just nu.' : '';
    } catch {
      status.textContent = 'Erbjudandena kunde inte laddas. Försök igen.';
      const retry = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Försök igen' });
      retry.addEventListener('click', () => { retry.disabled = true; void load(); });
      status.append(' ', retry);
    }
  };

  buttons.forEach(button => {
    button.disabled = true;
    button.addEventListener('click', async () => {
      if (pending || button.dataset.available !== 'true') return;
      pending = true;
      buttons.forEach(item => { item.disabled = true; });
      button.setAttribute('aria-busy', 'true');
      status.textContent = 'Lägger till erbjudandet…';
      try {
        const result = await window.DealettNetwork.fetchJson('/api/featured-offers/cart-item', {
          label: 'Lägg till erbjudande', method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offerId: button.dataset.featuredOffer }),
        });
        if (!result?.cartItem || !result?.state) throw new Error('Invalid offer');
        const cart = window.DealettCart.readCart();
        const existing = cart.findIndex(item => item.offerId === result.cartItem.offerId);
        if (existing >= 0) cart[existing] = result.cartItem;
        else cart.push(result.cartItem);
        window.DealettCart.setCart(cart, { state: result.state });
        window.DealettCart.openDrawer();
        status.textContent = '';
      } catch {
        status.textContent = 'Erbjudandet kunde inte läggas till. Försök igen.';
      } finally {
        pending = false;
        button.removeAttribute('aria-busy');
        buttons.forEach(item => { item.disabled = item.dataset.available !== 'true'; });
      }
    });
  });
  void load();
})();
