(() => {
const selectedItems = new Map();
const registeredButtons = new Map();

let tray = null;
let trayItems = null;
let trayCount = null;
let modal = null;
let modalBody = null;
let clearButton = null;
let openButton = null;

const createElement = (tag, className, text) => {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;

  return element;
};

const normalizeFacts = (facts) => (Array.isArray(facts) ? facts : [])
  .filter((fact) => fact && fact.label && fact.value !== undefined && fact.value !== null && String(fact.value).trim() !== '')
  .map((fact) => ({
    label: String(fact.label),
    value: Array.isArray(fact.value) ? fact.value.filter(Boolean).join(', ') : String(fact.value),
  }));

const withGiftCardFact = (facts) => {
  const normalized = normalizeFacts(facts);
  const hasGiftCard = normalized.some((fact) => /presentkort|gift card/i.test(fact.label));
  return hasGiftCard
    ? normalized
    : [...normalized, { label: 'Presentkort', value: 'XXX kr' }];
};

const normalizeItem = (item) => ({
  id: String(item.id),
  title: String(item.title || item.operator || 'Valt alternativ'),
  operator: String(item.operator || ''),
  type: String(item.type || 'Alternativ'),
  logo: item.logo || '',
  accent: item.accent || 'var(--accent)',
  facts: withGiftCardFact(item.facts),
});

const makeIcon = (className) => {
  const icon = document.createElement('i');
  icon.className = className;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
};

const makeCompareIcon = () => {
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-code-compare';
  icon.setAttribute('aria-hidden', 'true');
  return icon;
};

const getItemMeta = (item) => [item.type, item.operator].filter(Boolean).join(' | ');

const ensureModal = () => {
  if (modal) return;

  modal = createElement('div', 'compare-modal');
  modal.hidden = true;
  modal.innerHTML = [
    '<div class="compare-modal-backdrop" data-compare-close></div>',
    '<section class="compare-modal-panel" role="dialog" aria-modal="true" aria-labelledby="compareModalTitle">',
    '  <div class="compare-modal-head">',
    '    <div>',
    '      <span class="compare-modal-kicker">J\u00e4mf\u00f6relse</span>',
    '      <h2 id="compareModalTitle">J\u00e4mf\u00f6r valda alternativ</h2>',
    '    </div>',
    '    <button class="compare-modal-close" type="button" data-compare-close aria-label="St\u00e4ng j\u00e4mf\u00f6relse"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>',
    '  </div>',
    '  <div class="compare-modal-body"></div>',
    '</section>',
  ].join('');
  document.body.append(modal);
  modalBody = modal.querySelector('.compare-modal-body');
  modal.querySelectorAll('[data-compare-close]').forEach((button) => {
    button.addEventListener('click', closeModal);
  });
};

const ensureTray = () => {
  if (tray) return;

  tray = createElement('aside', 'compare-tray');
  tray.hidden = true;

  const head = createElement('div', 'compare-tray-head');
  const title = createElement('strong', '', 'J\u00e4mf\u00f6r');
  trayCount = createElement('span', 'compare-tray-count', '0 valda');
  head.append(makeIcon('fa-solid fa-right-left'), title, trayCount);

  trayItems = createElement('div', 'compare-tray-items');

  const actions = createElement('div', 'compare-tray-actions');
  clearButton = createElement('button', 'compare-clear-button', 'Rensa');
  clearButton.type = 'button';
  clearButton.addEventListener('click', clear);

  openButton = createElement('button', 'compare-open-button');
  openButton.type = 'button';
  openButton.append('J\u00e4mf\u00f6r valda', makeIcon('fa-solid fa-up-right-from-square'));
  openButton.addEventListener('click', openModal);

  actions.append(clearButton, openButton);
  tray.append(head, trayItems, actions);
  document.body.append(tray);
};

const getFactLabels = (items) => {
  const labels = [];
  const seen = new Set();

  for (const item of items) {
    for (const fact of item.facts) {
      if (seen.has(fact.label)) continue;
      seen.add(fact.label);
      labels.push(fact.label);
    }
  }

  return labels;
};

const getFactValue = (item, label) => item.facts.find((fact) => fact.label === label)?.value || '-';

const renderModal = () => {
  ensureModal();

  const items = [...selectedItems.values()];
  modalBody.replaceChildren();

  if (!items.length) {
    modalBody.append(createElement('p', 'compare-empty-text', 'V\u00e4lj minst ett alternativ att j\u00e4mf\u00f6ra.'));
    return;
  }

  const tableWrap = createElement('div', 'compare-table-wrap');
  const table = createElement('table', 'compare-table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.append(createElement('th', '', ''));

  items.forEach((item) => {
    const th = document.createElement('th');
    const header = createElement('div', 'compare-table-product');

    if (item.logo) {
      const logo = document.createElement('img');
      logo.src = item.logo;
      logo.alt = item.operator || item.title;
      logo.loading = 'lazy';
      logo.decoding = 'async';
      header.append(logo);
    }

    header.append(
      createElement('strong', '', item.title),
      createElement('span', '', getItemMeta(item))
    );
    th.append(header);
    headRow.append(th);
  });

  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement('tbody');
  getFactLabels(items).forEach((label) => {
    const row = document.createElement('tr');
    row.append(createElement('th', '', label));

    items.forEach((item) => {
      row.append(createElement('td', '', getFactValue(item, label)));
    });

    tbody.append(row);
  });

  table.append(tbody);
  tableWrap.append(table);
  modalBody.append(tableWrap);
};

const updateButtons = () => {
  registeredButtons.forEach((buttons, id) => {
    const isSelected = selectedItems.has(id);

    buttons.forEach((button) => {
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
      button.setAttribute('aria-label', isSelected ? 'Vald f\u00f6r j\u00e4mf\u00f6relse' : 'J\u00e4mf\u00f6r');

      const label = button.querySelector('[data-compare-label]');
      if (label) label.textContent = 'J\u00e4mf\u00f6r';
    });
  });
};

const remove = (id) => {
  selectedItems.delete(String(id));
  renderTray();
};

const renderTray = () => {
  ensureTray();

  const items = [...selectedItems.values()];
  tray.hidden = !items.length;
  document.body.classList.toggle('has-compare-tray', items.length > 0);
  trayCount.textContent = `${items.length} valda`;
  trayItems.replaceChildren();

  items.forEach((item) => {
    const chip = createElement('div', 'compare-tray-item');
    chip.style.setProperty('--compare-accent', item.accent);

    if (item.logo) {
      const logo = document.createElement('img');
      logo.src = item.logo;
      logo.alt = item.operator || item.title;
      logo.loading = 'lazy';
      logo.decoding = 'async';
      chip.append(logo);
    }

    const copy = createElement('div', 'compare-tray-copy');
    copy.append(
      createElement('strong', '', item.title),
      createElement('span', '', getItemMeta(item))
    );

    const removeButton = createElement('button', 'compare-remove-button');
    removeButton.type = 'button';
    removeButton.setAttribute('aria-label', `Ta bort ${item.title} fr\u00e5n j\u00e4mf\u00f6relsen`);
    removeButton.append(makeIcon('fa-solid fa-xmark'));
    removeButton.addEventListener('click', () => remove(item.id));

    chip.append(copy, removeButton);
    trayItems.append(chip);
  });

  openButton.disabled = !items.length;
  clearButton.disabled = !items.length;
  updateButtons();
};

const toggle = (item) => {
  const normalized = normalizeItem(item);

  if (selectedItems.has(normalized.id)) {
    selectedItems.delete(normalized.id);
  } else {
    selectedItems.set(normalized.id, normalized);
  }

  renderTray();
};

const clear = () => {
  selectedItems.clear();
  closeModal();
  renderTray();
};

function openModal() {
  ensureModal();
  renderModal();
  modal.hidden = false;
  document.body.classList.add('compare-modal-open');
  modal.querySelector('.compare-modal-close')?.focus();
}

function closeModal() {
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove('compare-modal-open');
}

const bindButton = (button, item) => {
  if (!button || !item?.id) return;

  const normalized = normalizeItem(item);
  if (!registeredButtons.has(normalized.id)) registeredButtons.set(normalized.id, new Set());
  registeredButtons.get(normalized.id).add(button);
  button.type = 'button';
  button.classList.add('offer-compare-button');
  button.setAttribute('aria-pressed', String(selectedItems.has(normalized.id)));
  button.setAttribute('aria-label', selectedItems.has(normalized.id) ? 'Vald f\u00f6r j\u00e4mf\u00f6relse' : 'J\u00e4mf\u00f6r');

  const label = createElement('span', '', 'Jämför');
  label.dataset.compareLabel = '';
  button.replaceChildren(makeCompareIcon(), label);
  button.addEventListener('click', () => toggle(normalized));
  updateButtons();
};

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
});

window.DealettOfferCompare = {
  bindButton,
  clear,
  remove,
  toggle,
};
})();
