const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { createServer } = require('../../db/server');
const { setOpenAiTransportForTests } = require('../../db/chat-service');
process.env.OPENAI_API_KEY = 'test-key';
let release;
let fail = false;
const reply = 'Första delen — nu kommer resten. Åäö 😀';
const frame = event => Buffer.from(`data: ${JSON.stringify(event)}\n\n`);
setOpenAiTransportForTests(async (_url, options) => {
  const request = JSON.parse(options.body);
  const message = JSON.parse(request.input.at(-1).content).latestMessage;
  if (request.text.format.name === 'dealett_customer_need') return {
    ok: true, json: async () => ({ output_text: JSON.stringify(
      message === 'Visa erbjudanden' ? { topic: 'mobile', interactionStage: 'solve', qualification: { peopleCount: 1, monthlyBudget: { amount: 300, scope: 'total', inclusive: false } }, recommendationRequested: true, offerPreference: 'preview' }
        : message === 'Detaljerad jämförelse' ? { topic: 'mobile', interactionStage: 'understand', qualification: { peopleCount: 1 }, recommendationRequested: true, offerPreference: 'personalized' }
          : { topic: 'greeting', interactionStage: 'greeting', qualification: {}, recommendationRequested: false }
    ) }),
  };
  const answer = { reply, quickReplies: [], showOfferCards: message === 'Visa erbjudanden',
    bestMatchReason: '', lowestEffectiveCostReason: '', bestMatchBenefits: [], lowestEffectiveCostBenefits: [],
    offerCardCopy: { dataTitle: 'Surf', monthlyPriceTitle: 'Pris', perMonthSuffix: '/mån', bindingTitle: 'Bindningstid', bindingMonthsSuffix: ' månader', rewardLabel: 'Presentkort', ctaLabel: 'Välj' },
  };
  return { ok: true, body: (async function* () {
    const gate = new Promise(resolve => { release = resolve; });
    yield frame({ type: 'response.output_text.delta', delta: '{"reply":"Första delen' });
    await gate;
    if (fail) throw new Error('test interrupted response');
    yield frame({ type: 'response.output_text.delta', delta: JSON.stringify(answer).slice('{"reply":"Första delen'.length) });
    yield frame({ type: 'response.completed', response: { status: 'completed', output_text: JSON.stringify(answer) } });
  })() };
});
(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.DealettChat));
      const input = page.locator('#home-ai-question');
      await input.fill('Hej');
      await input.press('Enter');
      await page.locator('[data-streaming="true"] p').waitFor();
      assert.equal(await page.locator('[data-streaming="true"] p').innerText(), 'Första delen');
      assert.equal(await page.locator('[data-home-ai-form] [type="submit"]').isDisabled(), true);
      assert.equal(await page.evaluate(() => JSON.stringify(sessionStorage).includes('Första delen')), false);
      await page.screenshot({ path: `/tmp/dealett-stream-partial-${width}.png` });
      release();
      await page.waitForFunction(() => document.querySelector('.dealett-chat-messages')?.getAttribute('aria-busy') === 'false');
      assert.equal(await page.locator('[data-streaming]').count(), 0);
      assert.equal(await page.locator('.dealett-chat-message--assistant').count(), 1);
      assert((await page.locator('.dealett-chat-message--assistant').innerText()).includes(reply));
      await page.screenshot({ path: `/tmp/dealett-stream-complete-${width}.png` });
      fail = true;
      await input.fill('Nästa fråga');
      await input.press('Enter');
      await page.locator('[data-streaming="true"]').waitFor();
      release();
      const retry = page.locator('#dealettChat .dealett-chat-inline-controls').getByRole('button', { name: 'Försök igen', exact: true });
      await retry.waitFor();
      assert.equal(await page.locator('[data-streaming]').count(), 0);
      assert.equal(await page.locator('.dealett-chat-message--assistant').count(), 1);
      fail = false;
      await retry.click();
      await page.locator('[data-streaming="true"]').waitFor();
      release();
      await page.waitForFunction(() => document.querySelector('.dealett-chat-messages')?.getAttribute('aria-busy') === 'false');
      assert.equal(await page.locator('.dealett-chat-message--assistant').count(), 2);
      await input.fill('Visa erbjudanden');
      await input.press('Enter');
      await page.locator('[data-streaming="true"]').waitFor();
      assert.equal(await page.locator('.dealett-chat-offer-card').count(), 0);
      release();
      await page.locator('.dealett-chat-offer-card').first().waitFor();
      assert.equal(await page.locator('.dealett-chat-offer-card').count(), 2);
      const cardText = await page.locator('.dealett-chat-offers').innerText();
      assert.match(cardText, /229/);
      assert.match(cardText, /299/);
      assert.match(cardText, /inte skräddarsytt/);
      await page.screenshot({ path: `/tmp/dealett-stream-offers-${width}.png` });
      await input.fill('Detaljerad jämförelse');
      await input.press('Enter');
      await page.locator('[data-streaming="true"]').waitFor();
      assert.equal(await page.locator('.dealett-chat-operator-binding-widget').count(), 0);
      release();
      await page.locator('.dealett-chat-operator-binding-widget').waitFor();
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Streaming browser tests passed at desktop and mobile widths, including interruption and retry.');
  } finally {
    release?.();
    await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    setOpenAiTransportForTests();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
