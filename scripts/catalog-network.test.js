const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../assets/network-utils.js'), 'utf8');
const load = fetch => {
  const window = { location: { hostname: 'localhost' }, setTimeout, clearTimeout };
  vm.runInNewContext(source, { window, fetch, AbortController, TextDecoder, performance });
  return window.DealettNetwork;
};

test('catalog reads recover from temporary service and connection failures', async () => {
  let requests = 0;
  const network = load(async (_url, options) => {
    assert.equal(options.retries, undefined);
    if (++requests === 1) return new Response('', { status: 503 });
    if (requests === 2) throw new TypeError('Failed to fetch');
    return Response.json([{ id: 'offer' }]);
  });
  assert.equal((await network.fetchJson('/api/featured-offers', { retries: 2, retryDelayMs: 1 }))[0].id, 'offer');
  assert.equal(requests, 3);
});

test('a timed out catalog request can recover on the next attempt', async () => {
  let requests = 0;
  const network = load(async (_url, options) => {
    if (++requests > 1) return Response.json([]);
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => {
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true }));
  });
  await network.fetchJson('/api/mobile/plans', { retries: 1, retryDelayMs: 1, timeoutMs: 5 });
  assert.equal(requests, 2);
});

test('retries are bounded and never repeat a purchase or permanent failure', async () => {
  for (const [method, status, expected] of [['GET', 503, 3], ['POST', 503, 1], ['GET', 404, 1]]) {
    let requests = 0;
    const network = load(async () => { requests++; return new Response('', { status }); });
    await assert.rejects(network.fetchJson('/api/example', { method, retries: 2, retryDelayMs: 1 }));
    assert.equal(requests, expected);
  }
});

test('cancellation during retry backoff prevents further requests', async () => {
  let requests = 0;
  const controller = new AbortController();
  const network = load(async () => {
    requests++;
    setTimeout(() => controller.abort(), 5);
    return new Response('', { status: 503 });
  });
  await assert.rejects(network.fetchJson('/api/mobile/plans', {
    retries: 5, retryDelayMs: 100, signal: controller.signal,
  }));
  assert.equal(requests, 1);
});

test('invalid JSON is not retried', async () => {
  let requests = 0;
  const network = load(async () => { requests++; return new Response('invalid'); });
  await assert.rejects(network.fetchJson('/api/mobile/plans', { retries: 2, retryDelayMs: 1 }));
  assert.equal(requests, 1);
});
