(() => {
  const trigger = document.querySelector('[data-surf-calculator]');
  const page = document.querySelector('[data-surf-page]');
  if (!trigger && !page) return;
  const activities = [
    { id: 'video', label: 'Video & streaming', icon: 'play', rate: 0.7 },
    { id: 'music', label: 'Musik & poddar', icon: 'headphones', rate: 0.1 },
    { id: 'social', label: 'Sociala medier', icon: 'comments', rate: 0.3 },
    { id: 'web', label: 'Webb & mejl', icon: 'globe', rate: 0.06 },
    { id: 'gaming', label: 'Onlinespel', icon: 'gamepad', rate: 0.1 }
  ];
  const dialog = document.createElement(page ? 'section' : 'dialog');
  dialog.className = 'surf-calculator';
  dialog.setAttribute('aria-labelledby', 'surf-title');
  dialog.innerHTML = `
    <header class="surf-header"><div><span class="surf-eyebrow">DEALETT · SURFKALKYL</span><h2 id="surf-title">Lagom med surf. För din vardag.</h2><p>Räkna på en vanlig dag och hitta en surfmängd som passar dig.</p></div><button type="button" class="surf-close" aria-label="Stäng surfkalkylen" autofocus>×</button></header>
    <div class="surf-layout"><section class="surf-inputs" aria-labelledby="surf-day"><h3 id="surf-day">Hur ser din dag ut?</h3><p>Ange minuter per dag och person. Resultatet gäller 30 dagar, endast på mobilnätet. Räkna inte med tiden på Wi-Fi. Ange aktiviteterna var för sig, högst 24 timmar totalt.</p>
    ${activities.map(a => `<div class="surf-activity"><div class="surf-label"><label for="surf-${a.id}"><i class="fa-solid fa-${a.icon}" aria-hidden="true"></i>${a.label}</label><output for="surf-${a.id}" id="surf-${a.id}-value">0 min</output></div><input id="surf-${a.id}" type="range" min="0" max="1440" step="15" value="0" /></div>`).join('')}
    </section>
    <section class="surf-result" aria-labelledby="surf-result-title"><span class="surf-eyebrow" id="surf-result-title">DITT UPPSKATTADE BEHOV</span><div class="surf-number" aria-live="polite" aria-atomic="true"><strong id="surf-gb">0</strong><span>GB / månad</span></div><p id="surf-advice">Dra i reglagen för att hitta din nivå.</p><dl><div><dt>Tid på mobilnätet / dag</dt><dd id="surf-total">0 min</dd></div><div><dt>Med 20 % marginal</dt><dd id="surf-buffer">0 GB</dd></div></dl><button type="button" class="surf-apply" disabled>Välj surfmängd</button><p class="surf-note" id="surf-match">En vägledning för en person, inte en exakt förbrukning.</p><details><summary>Så räknar vi</summary><p>Vi räknar med 30 dagar och följande uppskattningar per timme: video 0,7 GB (standardkvalitet), musik 0,1 GB, sociala medier 0,3 GB, webb 0,06 GB och onlinespel 0,1 GB.</p><p>Vi lägger på 20 % marginal och föreslår närmaste tillgängliga surfmängd som räcker. Kvalitet och appar påverkar förbrukningen. Nedladdningar, uppdateringar och internetdelning ingår inte.</p></details></section></div>`;
  dialog.querySelector('.surf-result details').insertAdjacentHTML('beforeend', '<p>Video beräknas med 0,7 GB/timme, baserat på Netflix uppgift om upp till 0,7 GB/timme vid standardkvalitet. Det är ett schablonvärde, inte ett genomsnitt för alla videotjänster. HD och 4K kan dra betydligt mer. <a href="https://help.netflix.com/sv/node/87" target="_blank" rel="noopener noreferrer">Källa: Netflix</a></p>');
  const disclaimer = document.createElement('p');
  disclaimer.className = 'surf-disclaimer';
  disclaimer.textContent = 'Observera: Surfkalkylen ger en grov uppskattning utifrån generella antaganden, inte en uppmätt eller verifierad förbrukning. Din faktiska dataförbrukning kan skilja sig betydligt. Använd resultatet som vägledning och kontrollera din förbrukning hos din operatör eller i mobilens inställningar innan du väljer abonnemang.';
  dialog.append(disclaimer);
  if (page) {
    dialog.classList.add('surf-calculator--page');
    dialog.querySelector('.surf-header').remove();
    dialog.querySelector('.surf-result details p:nth-of-type(2)').textContent = 'Vi lägger på 20 % marginal. Kvalitet och appar påverkar förbrukningen. Nedladdningar, uppdateringar och internetdelning ingår inte.';
    dialog.setAttribute('aria-label', 'Beräkna ditt surfbehov');
    dialog.removeAttribute('aria-labelledby');
    dialog.querySelector('.surf-apply').outerHTML = '<a class="surf-apply" href="mobilabonnemang.html">Jämför mobilabonnemang <span aria-hidden="true">↗</span></a>';
    dialog.querySelector('#surf-result-title').textContent = 'UPPSKATTAT BEHOV MED MARGINAL';
    dialog.querySelector('.surf-number').innerHTML = '<strong id="surf-recommended">0</strong><span>GB / månad</span>';
    dialog.querySelector('.surf-result dl').insertAdjacentHTML('afterbegin', '<div><dt>Beräknad förbrukning</dt><dd><span id="surf-gb">0</span> GB</dd></div>');
    dialog.querySelector('#surf-buffer').previousElementSibling.textContent = 'Extra marginal (20 %)';
    dialog.querySelector('.surf-result').id = 'surf-summary';
    activities.forEach(a => {
      const row = dialog.querySelector(`#surf-${a.id}`).closest('.surf-activity');
      row.querySelector('output').classList.add('surf-time-description');
      row.querySelector('.surf-label').insertAdjacentHTML('beforeend', `<label class="surf-time-entry" for="surf-${a.id}-minutes"><input type="number" id="surf-${a.id}-minutes" min="0" max="1440" step="15" value="0" aria-label="${a.label}, minuter per dag" /><span>min / dag</span></label>`);
      if (a.id === 'video') row.querySelector('.surf-label > label').insertAdjacentHTML('beforeend', '<small class="surf-video-rate">≈ 0,7 GB/tim</small>');
      row.insertAdjacentHTML('beforeend', `<div class="surf-shortcuts" aria-label="Snabbval för ${a.label}">${[15, 30, 60, 120].map(value => `<button type="button" data-surf-activity="${a.id}" data-minutes="${value}" aria-pressed="false">${value < 60 ? `${value} min` : `${value / 60} tim`}</button>`).join('')}</div>`);
    });
    dialog.querySelector('.surf-result details').insertAdjacentHTML('beforebegin', `<section class="surf-breakdown" aria-labelledby="surf-breakdown-title"><h3 id="surf-breakdown-title">Så fördelas din surf</h3>${activities.map(a => `<div class="surf-breakdown-row"><div><span>${a.label}</span><output id="surf-${a.id}-gb">0 GB</output></div><div class="surf-breakdown-track" aria-hidden="true"><span id="surf-${a.id}-bar"></span></div></div>`).join('')}</section>`);
    page.insertAdjacentHTML('beforebegin', '<a class="surf-mobile-summary" href="#surf-summary"><span>Uppskattat behov <small>inkl. 20 % marginal</small></span><strong id="surf-mobile-estimate" aria-live="polite" aria-atomic="true">0 GB / mån</strong><span aria-hidden="true">↓</span></a>');
    page.append(dialog);
  } else {
    document.body.append(dialog);
  }
  const get = id => dialog.querySelector(`#surf-${id}`);
  const inputs = activities.map(a => get(a.id));
  const filter = document.querySelector('#dataFilter');
  const apply = dialog.querySelector('.surf-apply');
  const formatTime = minutes => minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} tim${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
  let selectedIndex = -1;
  let previousOverflow = '';
  const update = () => {
    const total = inputs.reduce((sum, input) => sum + Number(input.value), 0);
    const usage = activities.reduce((sum, a, i) => sum + Number(inputs[i].value) / 60 * a.rate, 0) * 30;
    const required = Math.ceil(usage * 1.2);
    inputs.forEach(input => {
      const minutes = Number(input.value);
      get(`${input.id.replace('surf-', '')}-value`).textContent = formatTime(minutes);
      input.setAttribute('aria-valuetext', formatTime(minutes));
      input.style.setProperty('--surf-progress', `${Number(input.max) ? minutes / Number(input.max) * 100 : 0}%`);
    });
    get('gb').textContent = String(Math.ceil(usage));
    get('total').textContent = formatTime(total);
    get('buffer').textContent = `${required} GB`;
    if (page) {
      get('recommended').textContent = String(required);
      get('buffer').textContent = `+${(usage * 0.2).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} GB`;
      document.querySelector('#surf-mobile-estimate').textContent = `${required} GB / mån`;
      activities.forEach((a, index) => {
        const minutes = Number(inputs[index].value);
        get(`${a.id}-minutes`).value = String(minutes);
        const activityUsage = minutes / 60 * a.rate * 30;
        get(`${a.id}-gb`).textContent = `${activityUsage.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} GB`;
        get(`${a.id}-bar`).style.width = `${usage ? activityUsage / usage * 100 : 0}%`;
      });
      dialog.querySelectorAll('[data-minutes]').forEach(button => {
        button.setAttribute('aria-pressed', String(Number(get(button.dataset.surfActivity).value) === Number(button.dataset.minutes)));
      });
    }
    const values = (filter?.dataset.values || '').split(',').filter(Boolean);
    selectedIndex = required > 0 ? values.findIndex(value => value === 'unlimited' || Number(value) >= required) : -1;
    const selected = values[selectedIndex];
    const label = selected === 'unlimited' ? 'obegränsad surf' : `${selected} GB`;
    if (!page) apply.disabled = selectedIndex < 0;
    if (!page) apply.textContent = selectedIndex >= 0 ? `Välj ${label}` : 'Välj surfmängd';
    get('advice').textContent = !total ? 'Dra i reglagen för att hitta din nivå.' : `Sikta på minst ${required} GB per månad, inklusive lite extra utrymme.`;
    get('match').textContent = page ? 'Ta med din uppskattning när du jämför surfmängder och priser.' : selectedIndex >= 0 ? `Väljer ${label} i surffiltret. Ditt operatörsval behålls.` : required > 0 ? 'Ingen tillräcklig surfmängd finns i det tillgängliga utbudet just nu.' : 'En vägledning för en person, inte en exakt förbrukning.';
  };
  inputs.forEach(input => input.addEventListener('input', () => {
    const otherMinutes = inputs.reduce((sum, other) => sum + (other === input ? 0 : Number(other.value)), 0);
    input.value = String(Math.min(Number(input.value), 1440 - otherMinutes));
    update();
  }));
  if (page) {
    const setMinutes = (id, value) => {
      const input = get(id);
      input.value = String(Math.max(0, Math.min(1440, Math.round((Number(value) || 0) / 15) * 15)));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    activities.forEach(a => get(`${a.id}-minutes`).addEventListener('change', event => setMinutes(a.id, event.target.value)));
    dialog.querySelectorAll('[data-minutes]').forEach(button => button.addEventListener('click', () => setMinutes(button.dataset.surfActivity, button.dataset.minutes)));
  }
  if (!page) {
    trigger.addEventListener('click', () => {
      update();
      previousOverflow = document.body.style.overflow;
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    });
    dialog.querySelector('.surf-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.body.style.overflow = previousOverflow;
      trigger.focus();
    });
    apply.addEventListener('click', () => {
      update();
      if (selectedIndex < 0) return;
      filter.value = String(selectedIndex);
      filter.dispatchEvent(new Event('input', { bubbles: true }));
      filter.dispatchEvent(new Event('change', { bubbles: true }));
      dialog.close();
    });
  }
  if (filter) new MutationObserver(update).observe(filter, { attributes: true, attributeFilter: ['data-values'] });
  update();
})();
