(() => {
  'use strict';
  if (location.hostname !== 'preview.dealett.se') return;
  const consentKey = 'dealett-preview-consent-v1';
  const maxAge = 180 * 24 * 60 * 60 * 1000;
  const privatePage = /\/(?:bestallning|account|login)(?:\.html)?\/?$/.test(location.pathname);
  let consent = null;
  let client = null;
  let loading = false;
  let config;
  let panel;
  let settings;
  const readConsent = () => {
    try {
      const value = JSON.parse(localStorage.getItem(consentKey));
      return value && typeof value.analytics === 'boolean' && typeof value.replay === 'boolean' &&
        Number.isFinite(value.at) && value.at <= Date.now() && Date.now() - value.at < maxAge ? value : null;
    } catch { return null; }
  };
  const allowed = () => consent?.analytics === true && Date.now() - consent.at < maxAge && !privatePage;
  const cleanUrl = (value) => {
    try { const url = new URL(value); return url.origin + url.pathname; } catch { return ''; }
  };
  const beforeSend = (event) => {
    if (!allowed()) return null;
    if (event.event === '$snapshot' && (!consent.replay || location.search || location.hash)) return null;
    const properties = event.properties || {};
    for (const key of Object.keys(properties)) {
      if (/url|referrer/i.test(key) && typeof properties[key] === 'string') properties[key] = cleanUrl(properties[key]);
      if (/utm_|gclid|fbclid|msclkid|\$set|\$initial|\$browser_language/i.test(key)) delete properties[key];
    }
    properties.$current_url = location.origin + location.pathname;
    return event;
  };
  const capture = (name, properties = {}) => {
    if (client && allowed()) client.capture(name, { ...properties, environment: 'preview' });
  };
  const applyConsent = () => {
    if (!allowed()) {
      if (client) { client.stopSessionRecording(); client.opt_out_capturing(); client.set_config({ disable_persistence: true }); }
      return;
    }
    if (client) {
      client.set_config({ disable_persistence: false });
      client.opt_in_capturing({ captureEventName: false });
      if (consent.replay && !location.search && !location.hash) client.startSessionRecording();
      else client.stopSessionRecording();
      return;
    }
    if (loading) return;
    loading = true;
    const script = document.createElement('script');
    script.src = 'https://eu-assets.i.posthog.com/static/array.js';
    script.async = true;
    script.onload = () => {
      loading = false;
      if (!allowed() || !window.posthog?.init) return;
      window.posthog.init(config.projectToken, {
        api_host: config.apiHost,
        ui_host: 'https://eu.posthog.com',
        persistence: 'localStorage',
        person_profiles: 'never',
        save_referrer: false,
        save_campaign_params: false,
        disable_capture_url_hashes: true,
        disable_surveys: true,
        disable_product_tours: true,
        disable_conversations: true,
        disable_web_experiments: true,
        capture_heatmaps: false,
        capture_webmcp: false,
        advanced_disable_feature_flags: true,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_dead_clicks: false,
        capture_performance: false,
        capture_exceptions: false,
        rageclick: false,
        enable_recording_console_log: false,
        disable_session_recording: !consent.replay || Boolean(location.search || location.hash),
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: '*',
          blockSelector: 'form, iframe, canvas, [contenteditable], [class*="chat"], [id*="chat"], [class*="hero-ai"], [id*="coverage"], [data-private]',
          recordHeaders: false,
          recordBody: false,
          collectFonts: false,
          recordCrossOriginIframes: false,
          captureJsonLd: false,
        },
        before_send: beforeSend,
        loaded: (instance) => {
          client = instance;
          if (!allowed()) { applyConsent(); return; }
          applyConsent();
          capture('$pageview');
        },
      });
    };
    script.onerror = () => { loading = false; script.remove(); };
    document.head.append(script);
  };
  const save = (analytics, replay) => {
    consent = { analytics, replay: analytics && replay, at: Date.now() };
    try { localStorage.setItem(consentKey, JSON.stringify(consent)); } catch {}
    panel.close();
    panel.hidden = true;
    applyConsent();
    settings.focus();
  };
  const setView = (detailed) => {
    panel.querySelector('.preview-consent-intro').hidden = detailed;
    panel.querySelector('.preview-consent-details').hidden = !detailed;
    panel.querySelector('[data-choice="configure"]').hidden = detailed;
    panel.querySelector('[data-choice="save"]').hidden = !detailed;
    panel.querySelector('[data-choice="back"]').hidden = !detailed;
    panel.querySelector('h2').textContent = detailed ? 'Dina integritetsval' : 'Vi värnar om din integritet';
  };
  const show = () => {
    panel.querySelector('[name="analytics"]').checked = consent?.analytics === true;
    panel.querySelector('[name="replay"]').checked = consent?.replay === true;
    setView(false);
    panel.hidden = false;
    if (!panel.open) panel.showModal();
    panel.querySelector('h2').focus();
  };
  const mount = () => {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/assets/preview-analytics.css?v=20261028-modal';
    document.head.append(style);
    panel = document.createElement('dialog');
    panel.className = 'preview-consent';
    panel.setAttribute('aria-labelledby', 'preview-consent-title');
    panel.setAttribute('lang', 'sv');
    panel.setAttribute('dir', 'ltr');
    panel.innerHTML = '<header><button type="button" data-choice="back" hidden>← Tillbaka</button><h2 id="preview-consent-title" tabindex="-1">Vi värnar om din integritet</h2></header>' +
      '<div class="preview-consent-content"><div class="preview-consent-intro">' +
      '<p>Vi vill göra Dealett enklare och bättre att använda. Med ditt godkännande använder vi PostHog i EU för att förstå hur vår previewsida används.</p>' +
      '<p>Besöksstatistik visar sidbesök, klick och hur långt du scrollar. Din IP-adress sparas tillsammans med statistiken och ett slumpmässigt besöks-id lagras i din webbläsare.</p>' +
      '<p>Du kan också godkänna sessionsinspelning, så att vi kan se hur du navigerar på sidan. Text och inmatningar maskeras och känsliga delar undantas.</p>' +
      '<p>Välj <strong>Godkänn alla</strong> för statistik och inspelning, eller öppna <strong>Inställningar</strong> för att välja var för sig. Du kan använda sidan även om du avvisar allt.</p>' +
      '<p>Ditt val sparas i 180 dagar. Du kan när som helst ändra eller återkalla det via <strong>Integritetsval</strong>.</p></div>' +
      '<div class="preview-consent-details" hidden><p>Välj vad du vill tillåta. Valfria funktioner startar först när du godkänner dem.</p>' +
      '<div class="preview-consent-category"><details><summary>Nödvändig lagring <span>Alltid aktiv</span></summary><p>Sparar dina integritetsval så att vi kommer ihåg dem. Detta aktiverar inte besöksstatistik eller inspelning.</p></details></div>' +
      '<div class="preview-consent-category"><label><span>Besöksstatistik</span><input type="checkbox" name="analytics" role="switch"></label><details><summary>Visa information</summary><p>PostHog i EU samlar sidbesök, utvalda klick, scrollning och IP-adress. Ett slumpmässigt besöks-id lagras i din webbläsare.</p></details></div>' +
      '<div class="preview-consent-category"><label><span>Sessionsinspelning</span><input type="checkbox" name="replay" role="switch"></label><details><summary>Visa information</summary><p>Visar hur du navigerar på sidan. Text och inmatningar maskeras. Kräver besöksstatistik; den slås på om du väljer inspelning.</p></details></div>' +
      '<p>Valet sparas i 180 dagar. Du kan ändra det när som helst via Integritetsval.</p></div>' +
      '<a href="/integritetspolicy.html#preview-analytics">Läs vår integritetspolicy</a></div>' +
      '<div class="preview-consent-actions"><button type="button" data-choice="configure">Inställningar</button>' +
      '<button type="button" data-choice="reject">Avvisa alla</button><button type="button" data-choice="accept">Godkänn alla</button>' +
      '<button type="button" data-choice="save" hidden>Spara mina val</button></div>';
    panel.addEventListener('cancel', () => { panel.hidden = true; });
    panel.querySelector('[data-choice="configure"]').addEventListener('click', () => {
      setView(true);
      panel.querySelector('h2').focus();
    });
    panel.querySelector('[data-choice="back"]').addEventListener('click', () => {
      setView(false);
      panel.querySelector('h2').focus();
    });
    settings = document.createElement('button');
    settings.type = 'button';
    settings.className = 'preview-consent-settings';
    settings.textContent = 'Integritetsval';
    settings.addEventListener('click', show);
    panel.querySelector('[data-choice="reject"]').addEventListener('click', () => save(false, false));
    panel.querySelector('[data-choice="accept"]').addEventListener('click', () => save(true, true));
    panel.querySelector('[data-choice="save"]').addEventListener('click', () => save(
      panel.querySelector('[name="analytics"]').checked, panel.querySelector('[name="replay"]').checked));
    panel.querySelector('[name="replay"]').addEventListener('change', (event) => {
      if (event.target.checked) panel.querySelector('[name="analytics"]').checked = true;
    });
    panel.querySelector('[name="analytics"]').addEventListener('change', (event) => {
      if (!event.target.checked) panel.querySelector('[name="replay"]').checked = false;
    });
    document.body.append(settings, panel);
    panel.hidden = true;
    if (!consent) show();
    applyConsent();
    window.addEventListener('storage', (event) => {
      if (event.key !== consentKey && event.key !== null) return;
      consent = readConsent();
      applyConsent();
      if (!consent) show();
    });
    document.addEventListener('click', (event) => {
      const actions = [
        ['[data-featured-offer]', 'featured_offer_clicked'],
        ['[data-recommendation-cart]', 'recommendation_selected'],
        ['[data-information-add-to-cart]', 'suggested_offer_clicked'],
        ['.quiz-next-button', 'questionnaire_next_clicked'],
      ];
      for (const [selector, action] of actions) {
        const control = event.target.closest?.(selector);
        if (control && !control.disabled) { capture('preview_action', { action }); break; }
      }
      const link = event.target.closest?.('a[href]');
      if (!link || link.closest('.preview-consent')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || !/^\/[a-z0-9-]*\.?[a-z]*\/?$/i.test(url.pathname)) return;
      capture('preview_navigation', { destination: url.pathname });
    });
    const milestones = new Set();
    window.addEventListener('scroll', () => {
      const height = document.documentElement.scrollHeight - innerHeight;
      if (height <= 0 || !allowed() || !client) return;
      const percent = Math.round(scrollY / height * 100);
      for (const depth of [25, 50, 75, 100]) {
        if (percent >= depth && !milestones.has(depth)) { milestones.add(depth); capture('preview_scroll', { depth }); }
      }
    }, { passive: true });
  };
  fetch('/assets/preview-analytics.json', { credentials: 'omit', cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((value) => {
      if (!/^phc_[a-zA-Z0-9]+$/.test(value?.projectToken || '') || value.apiHost !== 'https://eu.i.posthog.com') return;
      config = value;
      consent = readConsent();
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
      else mount();
    }).catch(() => {});
})();
