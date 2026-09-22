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
const response = text => new Response(new ReadableStream({
  start(controller) {
    for (const byte of new TextEncoder().encode(text)) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  },
}), { headers: { 'Content-Type': 'text/event-stream' } });

test('chat reader streams UTF-8 safely and only returns on done', async () => {
  const deltas = [];
  const network = load(async (_url, options) => {
    assert.equal(options.headers.Accept, 'text/event-stream');
    return response(': keepalive\r\n\r\nevent: delta\r\ndata: {"text":"Hej å😀"}\r\n\r\nevent: done\ndata: {"reply":"Hej å😀","source":"openai"}\n\n');
  });
  const result = await network.fetchChat('/api/chat', { onDelta: d => deltas.push(d) });
  assert.equal(deltas.join(''), result.reply);
  assert.equal(result.source, 'openai');
  assert.ok(result.clientPerformance.firstTextMs !== null);
});

test('supports old JSON backend without submitting twice', async () => {
  let requests = 0;
  const network = load(async () => { requests++; return Response.json({ reply: 'Hej' }); });
  assert.equal((await network.fetchChat('/api/chat')).reply, 'Hej');
  assert.equal(requests, 1);
});

test('partial EOF and explicit failure are not successful replies', async () => {
  for (const body of ['event: delta\ndata: {"text":"Hej"}\n\n', 'event: error\ndata: {"error":"Failed"}\n\n']) {
    await assert.rejects(load(async () => response(body)).fetchChat('/api/chat'));
  }
});

test('timeout and cancellation stay active after response headers', async () => {
  for (const cancel of [false, true]) {
    const external = new AbortController();
    const network = load(async (_url, options) => new Response(new ReadableStream({
      start(controller) {
        options.signal.addEventListener('abort', () => controller.error(new Error('aborted')), { once: true });
        if (cancel) setTimeout(() => external.abort(), 10);
      },
    }), { headers: { 'Content-Type': 'text/event-stream' } }));
    await assert.rejects(network.fetchChat('/api/chat', { timeoutMs: 20, signal: external.signal }), /aborted/);
  }
});
