const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/preview-analytics.js'), 'utf8');

async function setup({ hostname = 'preview.dealett.se', pathname = '/', search = '', saved, token = 'phc_test' } = {}) {
  const elements = [];
  const events = [];
  const storage = new Map(saved ? [['dealett-preview-consent-v1', JSON.stringify(saved)]] : []);
  const listeners = {};
  const element = (tag) => {
    const children = new Map();
    const handlers = {};
    return { tag, hidden: false, checked: false, handlers,
      setAttribute() {}, append() {}, focus() {}, remove() {},
      addEventListener(name, fn) { handlers[name] = fn; },
      querySelector(selector) { if (!children.has(selector)) children.set(selector, element(selector)); return children.get(selector); },
    };
  };
  const context = {
    URL, Date, Set, location: { hostname, pathname, search, hash: '', origin: `https://${hostname}`, href: `https://${hostname}${pathname}${search}` },
    localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    document: { readyState: 'complete', createElement: element, head: { append: (node) => elements.push(node) }, body: { append: (...nodes) => elements.push(...nodes) }, addEventListener: (name, fn) => { listeners[name] = fn; } },
    fetch: async () => ({ ok: true, json: async () => ({ projectToken: token, apiHost: 'https://eu.i.posthog.com' }) }),
    addEventListener: (name, fn) => { listeners[name] = fn; },
  };
  context.window = context;
  let options;
  let recording = false;
  let optedOut = false;
  const sdk = {
    init(key, value) { options = value; optedOut = false; value.loaded(sdk); },
    capture(name, properties) { const event = options.before_send({ event: name, properties }); if (!optedOut && event) events.push(event); },
    startSessionRecording() { recording = true; }, stopSessionRecording() { recording = false; },
    opt_out_capturing() { optedOut = true; }, opt_in_capturing() { optedOut = false; },
  };
  context.posthog = sdk;
  vm.runInNewContext(source, context);
  await new Promise(setImmediate);
  const panel = elements.find((node) => node.className === 'preview-consent');
  const click = (choice) => panel.querySelector(`[data-choice="${choice}"]`).handlers.click();
  const load = () => elements.find((node) => node.tag === 'script')?.onload();
  return { elements, events, storage, panel, click, load, listeners, sdk, get options() { return options; }, get recording() { return recording; }, get optedOut() { return optedOut; } };
}

test('does not load third-party code before consent or after rejection', async () => {
  const state = await setup();
  assert.ok(state.panel);
  assert.equal(state.elements.some((node) => node.tag === 'script'), false);
  state.click('reject');
  assert.equal(state.elements.some((node) => node.tag === 'script'), false);
  assert.equal(state.panel.hidden, true);
});
test('stays disabled on other hosts and without a project token', async () => {
  assert.equal((await setup({ hostname: 'dealett.se' })).elements.length, 0);
  assert.equal((await setup({ token: '' })).elements.length, 0);
});
test('analytics-only consent does not record and strips URL parameters', async () => {
  const state = await setup();
  state.panel.querySelector('[name="analytics"]').checked = true;
  state.click('save');
  state.load();
  assert.equal(state.recording, false);
  assert.equal(state.events[0].event, '$pageview');
  const cleaned = state.options.before_send({ event: 'preview_navigation', properties: { $current_url: 'https://preview.dealett.se/?email=private', $referrer: 'https://example.com/?secret=x', utm_source: 'private' } });
  assert.equal(cleaned.properties.$current_url, 'https://preview.dealett.se/');
  assert.equal(cleaned.properties.$referrer, 'https://example.com/');
  assert.equal(cleaned.properties.utm_source, undefined);
  assert.equal(state.options.before_send({ event: '$snapshot', properties: {} }), null);
});
test('recording requires separate consent and withdrawal stops all events', async () => {
  const state = await setup();
  state.click('accept');
  state.load();
  assert.equal(state.recording, true);
  assert.equal(state.options.session_recording.maskAllInputs, true);
  assert.equal(state.options.session_recording.maskTextSelector, '*');
  state.click('reject');
  assert.equal(state.recording, false);
  assert.equal(state.optedOut, true);
  assert.equal(state.options.before_send({ event: '$pageview', properties: {} }), null);
  state.click('accept');
  assert.equal(state.optedOut, false);
  assert.equal(state.recording, true);
});
test('withdrawal while SDK is loading prevents initialization', async () => {
  const state = await setup();
  state.click('accept');
  state.click('reject');
  state.load();
  assert.equal(state.options, undefined);
});
test('expired consent and private pages cannot start tracking', async () => {
  const saved = { analytics: true, replay: true, at: Date.now() - 181 * 86400000 };
  const expired = await setup({ saved });
  assert.equal(expired.elements.some((node) => node.tag === 'script'), false);
  assert.equal(expired.panel.hidden, false);
  const privateState = await setup({ pathname: '/bestallning.html', saved: { ...saved, at: Date.now() } });
  assert.equal(privateState.elements.some((node) => node.tag === 'script'), false);
});
test('cross-tab withdrawal stops collection and query URLs disable replay', async () => {
  const state = await setup({ search: '?email=private' });
  state.click('accept'); state.load();
  assert.equal(state.recording, false);
  state.storage.clear();
  state.listeners.storage({ key: null });
  assert.equal(state.optedOut, true);
  assert.equal(state.panel.hidden, false);
});
