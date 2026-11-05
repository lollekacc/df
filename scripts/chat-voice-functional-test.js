const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('../../db/server');

async function run() {
  const server = createServer({ publicPreview: false });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      const errors = [];
      const requests = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        window.voiceTest = { stopped: 0, calls: [], mode: 'ok', peers: [] };
        const track = () => ({ stop() { voiceTest.stopped++; }, addEventListener() {} });
        navigator.mediaDevices.getUserMedia = async () => {
          if (voiceTest.mode === 'denied') throw new DOMException('Denied', 'NotAllowedError');
          if (voiceTest.mode === 'pending') await new Promise(resolve => { voiceTest.release = resolve; });
          return { getTracks: () => [track()] };
        };
        window.RTCPeerConnection = class {
          constructor() { voiceTest.peers.push(this); }
          addTrack() {}
          createDataChannel() {
            this.channel = {
              readyState: 'connecting', send(data) { voiceTest.calls.push(JSON.parse(data)); },
              close() { this.readyState = 'closed'; this.onclose?.(); },
            };
            return this.channel;
          }
          async createOffer() { return { type: 'offer', sdp: 'v=0\r\nmock-offer' }; }
          async setLocalDescription() {}
          async setRemoteDescription() { this.channel.readyState = 'open'; this.channel.onopen(); }
          close() { this.connectionState = 'closed'; this.onconnectionstatechange?.(); }
        };
        voiceTest.emit = data => voiceTest.peers.at(-1).channel.onmessage({ data: JSON.stringify(data) });
        voiceTest.speak = (text, id) => {
          voiceTest.emit({ type: 'input_audio_buffer.speech_started' });
          voiceTest.emit({ type: 'input_audio_buffer.committed', item_id: id });
          voiceTest.emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: id, transcript: text });
        };
      });
      await page.route('**/api/voice/session', route => route.fulfill({ json: { sdp: 'v=0\r\nmock-answer' } }));
      await page.route('**/api/chat', route => {
        requests.push(route.request().postDataJSON());
        return route.fulfill({ json: { reply: 'Hej! Jag hjälper dig hitta rätt abonnemang.', source: 'openai' } });
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.DealettChat));
      await page.waitForFunction(() => Boolean(document.querySelector('link[data-dealett-chat-launcher]')?.sheet));
      const mic = page.locator('[data-home-ai-form] .dealett-chat-voice');
      const notice = page.locator('.dealett-chat-voice-notice');
      const input = page.locator('#home-ai-question');
      assert.equal(await mic.getAttribute('aria-label'), 'Starta röstsamtal');
      assert.equal(await mic.evaluate(button => getComputedStyle(button.querySelector('svg')).stroke), 'rgb(83, 74, 67)', 'Idle microphone must remain visible on the white composer');
      await page.evaluate(() => { voiceTest.mode = 'denied'; });
      await mic.click();
      await page.waitForFunction(() => document.querySelector('.dealett-chat-voice-notice').textContent.includes('Tillåt mikrofonen'));
      assert.equal(await mic.getAttribute('aria-pressed'), 'false');
      await page.evaluate(() => { voiceTest.mode = 'ok'; });
      await input.fill('Min oskickade text');
      await mic.click();
      await page.waitForFunction(() => document.querySelector('.dealett-chat-voice-notice').textContent.includes('Lyssnar'));
      assert.equal(await input.inputValue(), 'Min oskickade text');
      assert.equal(await mic.getAttribute('aria-label'), 'Avsluta röstsamtal');
      await page.evaluate(() => voiceTest.speak('Vi är fyra i familjen', 'first'));
      await page.waitForFunction(() => voiceTest.calls.some(call => call.type === 'response.create'));
      assert.equal(requests.length, 1);
      assert.equal(requests[0].message, 'Vi är fyra i familjen');
      assert((await page.locator('.dealett-chat-messages').innerText()).includes('Vi är fyra i familjen'));
      assert((await page.locator('.dealett-chat-messages').innerText()).includes('Jag hjälper dig'));
      assert.equal(await input.inputValue(), 'Min oskickade text');
      await page.evaluate(() => voiceTest.emit({ type: 'output_audio_buffer.started' }));
      assert((await notice.innerText()).includes('pratar'));
      if (process.env.CHAT_SCREENSHOT_DIR) await page.locator('.hero-ai-guide__composer').screenshot({ path: path.join(process.env.CHAT_SCREENSHOT_DIR, `voice-${width}.png`) });
      const boxes = await Promise.all([mic.boundingBox(), page.locator('[data-home-ai-form] [type="submit"]').boundingBox(), input.boundingBox()]);
      assert(boxes.every(box => box && box.width > 15 && box.x >= 0 && box.x + box.width <= width));
      assert(boxes[0].x + boxes[0].width <= boxes[1].x + 1, 'Microphone and send must not overlap');
      await mic.click();
      assert.equal(await mic.getAttribute('aria-pressed'), 'false');
      assert.equal(await page.evaluate(() => voiceTest.stopped), 1);
      await mic.click();
      await page.waitForFunction(() => document.querySelector('.dealett-chat-voice-notice').textContent.includes('Lyssnar'));
      await input.fill('Kan jag skriva också?');
      await input.press('Enter');
      await page.waitForFunction(() => document.querySelector('.dealett-chat-messages').getAttribute('aria-busy') === 'false');
      assert.equal(requests.length, 2);
      assert.equal(requests[1].conversationId, requests[0].conversationId);
      assert(requests[1].messages.some(message => message.content === 'Vi är fyra i familjen'));
      assert.equal(await page.evaluate(() => voiceTest.stopped), 2);
      await page.evaluate(() => { voiceTest.mode = 'pending'; });
      await mic.click();
      await page.waitForFunction(() => Boolean(voiceTest.release));
      await mic.click();
      await page.evaluate(() => voiceTest.release());
      await page.waitForFunction(() => voiceTest.stopped === 3);
      assert.equal(await mic.getAttribute('aria-pressed'), 'false');
      await page.evaluate(() => { voiceTest.mode = 'ok'; });
      await mic.click();
      await page.waitForFunction(() => document.querySelector('.dealett-chat-voice-notice').textContent.includes('Lyssnar'));
      await page.evaluate(() => DealettChat.close());
      assert.equal(await page.evaluate(() => voiceTest.stopped), 4);
      await page.goto(`http://127.0.0.1:${server.address().port}/mobilabonnemang.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.DealettChat));
      await page.evaluate(() => DealettChat.open());
      const widgetMic = page.locator('#dealettChat .dealett-chat-voice');
      const widgetInput = page.locator('.dealett-chat-input');
      await widgetInput.fill('Sparat utkast');
      await widgetMic.click();
      await page.waitForFunction(() => document.querySelector('.dealett-chat-voice-notice').textContent.includes('Lyssnar'));
      const countBefore = requests.length;
      await page.evaluate(() => {
        voiceTest.emit({ type: 'input_audio_buffer.committed', item_id: 'a' });
        voiceTest.emit({ type: 'input_audio_buffer.committed', item_id: 'b' });
        voiceTest.emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'b', transcript: 'Andra röstmeddelandet' });
        voiceTest.emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'a', transcript: 'Första röstmeddelandet' });
      });
      await page.waitForFunction(() => voiceTest.calls.some(call => call.type === 'response.create'));
      assert.deepEqual(requests.slice(countBefore).map(request => request.message), ['Första röstmeddelandet', 'Andra röstmeddelandet']);
      assert.equal(await widgetInput.inputValue(), 'Sparat utkast');
      assert.equal(await page.evaluate(() => voiceTest.calls.find(call => call.type === 'response.create').response.conversation), 'auto');
      if (process.env.CHAT_SCREENSHOT_DIR) await page.locator('.dealett-chat-panel').screenshot({ path: path.join(process.env.CHAT_SCREENSHOT_DIR, `voice-widget-${width}.png`) });
      await page.evaluate(() => voiceTest.emit({ type: 'input_audio_buffer.speech_started' }));
      assert((await notice.innerText()).includes('Lyssnar'));
      await page.getByRole('button', { name: '+ Ny chatt', exact: true }).click();
      assert.equal(await page.evaluate(() => voiceTest.stopped), 1);
      assert.equal(await widgetMic.getAttribute('aria-pressed'), 'false');
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Voice chat desktop/mobile, transcript continuity, text fallback, permission denial and cleanup passed.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
