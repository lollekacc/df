(() => {
  const messages = {
    outstandingTransaction: 'Starta BankID på den här enheten eller öppna appen manuellt.',
    userSign: 'Kontrollera uppgifterna och signera i BankID.',
    started: 'BankID är öppet. Väntar på bekräftelse.',
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const postJson = async (url, body) => {
    if (window.DealettNetwork?.fetchJson) {
      return window.DealettNetwork.fetchJson(url, {
        label: 'BankID',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });

    if (!response.ok) throw new Error('BankID kunde inte startas.');
    return response.json();
  };

  const createModal = ({ title, description, intent }) => {
    const modal = document.createElement('div');
    modal.className = 'bankid-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = [
      '<div class="bankid-modal__backdrop" data-bankid-close></div>',
      '<div class="bankid-modal__panel">',
      '  <button class="bankid-modal__close" type="button" data-bankid-close aria-label="Stäng BankID">×</button>',
      '  <div class="bankid-modal__mark" aria-hidden="true">ID</div>',
      `  <p class="bankid-modal__kicker">${intent === 'sign' ? 'Signering' : 'Inloggning'}</p>`,
      `  <h2>${escapeHtml(title)}</h2>`,
      `  <p class="bankid-modal__description">${escapeHtml(description)}</p>`,
      '  <div class="bankid-modal__qr-wrap">',
      '    <div class="bankid-modal__qr" data-bankid-qr aria-label="BankID QR-kod" role="img"></div>',
      '    <p>Skanna QR-koden med BankID på en annan enhet.</p>',
      '  </div>',
      '  <div class="bankid-modal__status" role="status" aria-live="polite">',
      '    <span class="bankid-modal__spinner" aria-hidden="true"></span>',
      '    <span data-bankid-status>Startar BankID...</span>',
      '  </div>',
      '  <p class="bankid-modal__note">I demoläge slutförs BankID automatiskt. I produktion kopplas samma flöde till BankID API.</p>',
      '</div>',
    ].join('');

    document.body.append(modal);
    document.body.classList.add('bankid-modal-open');
    return modal;
  };

  const setStatus = (modal, text) => {
    const status = modal.querySelector('[data-bankid-status]');
    if (status) status.textContent = text;
  };

  const hashSeed = (value) => {
    let hash = 2166136261;
    const text = String(value || '');

    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  };

  const isFinderCell = (row, col, startRow, startCol) => {
    const localRow = row - startRow;
    const localCol = col - startCol;
    if (localRow < 0 || localRow > 6 || localCol < 0 || localCol > 6) return false;
    return localRow === 0 ||
      localRow === 6 ||
      localCol === 0 ||
      localCol === 6 ||
      (localRow >= 2 && localRow <= 4 && localCol >= 2 && localCol <= 4);
  };

  const isFinderArea = (row, col) => (
    (row <= 7 && col <= 7) ||
    (row <= 7 && col >= 17) ||
    (row >= 17 && col <= 7)
  );

  const renderFakeQr = (modal, seed) => {
    const qr = modal.querySelector('[data-bankid-qr]');
    if (!qr) return;

    const hash = hashSeed(seed);
    const cells = [];

    for (let row = 0; row < 25; row += 1) {
      for (let col = 0; col < 25; col += 1) {
        const finder = isFinderCell(row, col, 0, 0) ||
          isFinderCell(row, col, 0, 18) ||
          isFinderCell(row, col, 18, 0);
        const value = Math.imul(row + 11, col + 17) + hash + ((row ^ col) * 13);
        const active = finder || (!isFinderArea(row, col) && value % 5 < 2);
        cells.push(`<span${active ? ' class="is-active"' : ''}></span>`);
      }
    }

    cells.push([
      '<span class="bankid-modal__qr-logo" aria-hidden="true">',
      '  <img src="images/Dealett.png" alt="" />',
      '</span>'
    ].join(''));

    qr.innerHTML = cells.join('');
  };

  const closeModal = async (modal, orderRef) => {
    if (orderRef) {
      try {
        await postJson('https://db-qtmd.onrender.com/api/bankid/cancel', { orderRef });
      } catch {
        // Closing the UI should not get stuck if the cancel request fails.
      }
    }

    modal.remove();
    document.body.classList.remove('bankid-modal-open');
  };

  const open = async ({
    intent = 'login',
    title = 'BankID',
    description = 'Bekräfta med BankID för att fortsätta.',
    userVisibleData = '',
    payload = {},
    onComplete,
    onError,
    onCancel,
  } = {}) => {
    const modal = createModal({ title, description, intent });
    let orderRef = '';
    let timer = null;
    let qrTimer = null;
    let closed = false;

    const stop = () => {
      if (timer) window.clearTimeout(timer);
      if (qrTimer) window.clearInterval(qrTimer);
      timer = null;
      qrTimer = null;
    };

    const startQrRefresh = () => {
      const updateQr = () => {
        renderFakeQr(modal, `${orderRef}:${Math.floor(Date.now() / 1000)}`);
      };

      updateQr();
      qrTimer = window.setInterval(updateQr, 1000);
    };

    const handleClose = async () => {
      if (closed) return;
      closed = true;
      stop();
      await closeModal(modal, orderRef);
      onCancel?.();
    };

    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-bankid-close]')) {
        event.preventDefault();
        handleClose();
      }
    });

    const collect = async () => {
      if (closed) return;

      try {
        const result = await postJson('https://db-qtmd.onrender.com/api/bankid/collect', { orderRef });

        if (result.status === 'complete') {
          closed = true;
          stop();
          setStatus(modal, intent === 'sign' ? 'Signeringen är klar.' : 'Inloggningen är klar.');
          window.setTimeout(() => {
            modal.remove();
            document.body.classList.remove('bankid-modal-open');
            onComplete?.(result);
          }, 450);
          return;
        }

        setStatus(modal, messages[result.hintCode] || result.message || 'Väntar på BankID.');
        timer = window.setTimeout(collect, 1100);
      } catch (error) {
        closed = true;
        stop();
        setStatus(modal, error.message || 'BankID kunde inte slutföras.');
        onError?.(error);
      }
    };

    try {
      const start = await postJson('https://db-qtmd.onrender.com/api/bankid/start', {
        intent,
        userVisibleData,
        payload,
      });
      orderRef = start.orderRef;
      startQrRefresh();
      setStatus(modal, start.message || 'Öppna BankID för att fortsätta.');
      timer = window.setTimeout(collect, 900);
    } catch (error) {
      closed = true;
      stop();
      setStatus(modal, error.message || 'BankID kunde inte startas.');
      onError?.(error);
    }
  };

  window.DealettBankId = { open };
})();
