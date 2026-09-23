(() => {
  const trigger = document.querySelector('[data-surf-calculator]');
  const page = document.querySelector('[data-surf-page]');
  if (!trigger && !page) return;
  const activities = [
    { id: 'video', label: 'Video & streaming', icon: 'play', rate: 7 },
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
    <div class="surf-layout"><section class="surf-inputs" aria-labelledby="surf-day"><h3 id="surf-day">Hur ser din dag ut?</h3><p>Per person, endast tiden på mobilnätet. Räkna inte med tiden på Wi-Fi. Ange aktiviteterna var för sig, högst 24 timmar totalt.</p>
    ${activities.map(a => `<div class="surf-activity"><div class="surf-label"><label for="surf-${a.id}"><i class="fa-solid fa-${a.icon}" aria-hidden="true"></i>${a.label}</label><output for="surf-${a.id}" id="surf-${a.id}-value">0 min</output></div><input id="surf-${a.id}" type="range" min="0" max="1440" step="15" value="0" /></div>`).join('')}
    </section>
    <section class="surf-result" aria-labelledby="surf-result-title"><span class="surf-eyebrow" id="surf-result-title">DITT UPPSKATTADE BEHOV</span><div class="surf-number" aria-live="polite" aria-atomic="true"><strong id="surf-gb">0</strong><span>GB / månad</span></div><p id="surf-advice">Dra i reglagen för att hitta din nivå.</p><dl><div><dt>Tid på mobilnätet / dag</dt><dd id="surf-total">0 min</dd></div><div><dt>Med 20 % marginal</dt><dd id="surf-buffer">0 GB</dd></div></dl><button type="button" class="surf-apply" disabled>Välj surfmängd</button><p class="surf-note" id="surf-match">En vägledning för en person, inte en exakt förbrukning.</p><details><summary>Så räknar vi</summary><p>Vi räknar med 30 dagar och följande uppskattningar per timme: video 7 GB (alltid 4K), musik 0,1 GB, sociala medier 0,3 GB, webb 0,06 GB och onlinespel 0,1 GB.</p><p>Vi lägger på 20 % marginal och föreslår närmaste tillgängliga surfmängd som räcker. Kvalitet och appar påverkar förbrukningen. Nedladdningar, uppdateringar och internetdelning ingår inte.</p></details></section></div>`;
  const disclaimer = document.createElement('p');
  disclaimer.className = 'surf-disclaimer';
  disclaimer.textContent = 'Observera: Surfkalkylen ger en grov uppskattning utifrån generella antaganden, inte en uppmätt eller verifierad förbrukning. Din faktiska dataförbrukning kan skilja sig betydligt. Använd resultatet som vägledning och kontrollera din förbrukning hos din operatör eller i mobilens inställningar innan du väljer abonnemang.';
  dialog.append(disclaimer);
  if (page) {
    dialog.classList.add('surf-calculator--page');
    dialog.querySelector('.surf-header').remove();
    dialog.querySelector('.surf-result details p:last-child').textContent = 'Vi lägger på 20 % marginal. Kvalitet och appar påverkar förbrukningen. Nedladdningar, uppdateringar och internetdelning ingår inte.';
    dialog.setAttribute('aria-label', 'Beräkna ditt surfbehov');
    dialog.removeAttribute('aria-labelledby');
    dialog.querySelector('.surf-apply').outerHTML = '<a class="surf-apply" href="mobilabonnemang.html">Jämför mobilabonnemang <span aria-hidden="true">↗</span></a>';
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
