const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  } catch {
    response.writeHead(404).end();
  }
});

async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, headless: true });
  try {
    for (const width of [1920, 1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      const requests = [];
      let heldRoute = null;
      let mode = 'reply';
      const reply = route => route.fulfill({ json: { source: 'openai', reply: 'Hej! Vad vill du ha hjälp med?' } });
      await page.route('**/api/chat', async route => {
        requests.push(route.request().postDataJSON());
        if (mode === 'hold') heldRoute = route;
        else if (mode === 'fail') await route.fulfill({ status: 503, body: '{}' });
        else await reply(route);
      });
      await page.route('**/api/chat/feedback', route => route.fulfill({ json: {} }));
      const url = `http://127.0.0.1:${server.address().port}/`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.DealettChat));
      await page.evaluate(() => sessionStorage.setItem('dealettChatConversationV3', JSON.stringify({
        version: 3, conversationId: 'old-widget-session', updatedAt: Date.now(),
        messages: [
          { role: 'user', content: 'OLD WIDGET MESSAGE', sequence: 1 },
          { role: 'assistant', content: 'OLD WIDGET REPLY', sequence: 2 },
        ],
      })));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.DealettChat));
      const input = page.locator('#home-ai-question');
      const send = page.locator('[data-home-ai-form] [type="submit"]');
      const newChat = page.getByRole('button', { name: '+ Ny chatt', exact: true });
      const retry = page.locator('#dealettChat .dealett-chat-inline-controls').getByRole('button', { name: 'Försök igen', exact: true });
      const users = page.locator('#dealettChat .dealett-chat-message--user');
      const assistants = page.locator('#dealettChat .dealett-chat-message--assistant:not(.dealett-chat-message--typing):not(.dealett-chat-message--greeting)');
      const waitIdle = () => page.waitForFunction(() => document.querySelector('.dealett-chat-messages')?.getAttribute('aria-busy') === 'false');
      const count = async (locator, expected) => assert.equal(await locator.count(), expected);
      const initialStyle = await input.evaluate(e => [getComputedStyle(e.parentElement).borderRadius, getComputedStyle(e.parentElement).backgroundColor]);
      await input.fill('   ');
      await input.press('Enter');
      assert.equal(requests.length, 0);
      mode = 'hold';
      await input.fill('hej');
      const pageLayout = () => page.evaluate(() => ({
        top: document.querySelector('.hero-ai-guide__composer').getBoundingClientRect().top + scrollY,
        valueTop: document.querySelector('.hero-value').getBoundingClientRect().top + scrollY,
        finderTop: document.querySelector('.hero-finder').getBoundingClientRect().top + scrollY,
        height: document.documentElement.scrollHeight,
        scroll: scrollY,
      }));
      const initialLayout = await pageLayout();
      await input.press('Enter');
      await page.waitForFunction(() => document.querySelector('.dealett-chat-messages')?.getAttribute('aria-busy') === 'true');
      await count(users, 1);
      const activeLayout = await pageLayout();
      for (const key of Object.keys(initialLayout)) assert(Math.abs(initialLayout[key] - activeLayout[key]) <= 1, `Page moved: ${key}`);
      assert.equal(await send.isDisabled(), true);
      await input.fill('Mitt nästa svar');
      await input.press('Enter');
      assert.equal(await input.inputValue(), 'Mitt nästa svar');
      await count(users, 1);
      await page.waitForFunction(() => document.querySelector('#dealettChat').innerText.includes('Dealett AI svarar'));
      while (!heldRoute) await new Promise(resolve => setTimeout(resolve, 10));
      assert.equal(requests.length, 1);
      assert.equal(requests[0].messages.length, 0);
      assert.notEqual(requests[0].conversationId, 'old-widget-session');
      await reply(heldRoute);
      heldRoute = null;
      await waitIdle();
      await count(assistants, 1);
      assert.equal(await retry.isVisible(), false);
      assert.equal(await input.inputValue(), 'Mitt nästa svar');
      assert(!await page.locator('#dealettChat .dealett-chat-messages').innerText().then(text => /OLD WIDGET|välkommen/.test(text)));
      assert.deepEqual(await input.evaluate(e => [getComputedStyle(e.parentElement).borderRadius, getComputedStyle(e.parentElement).backgroundColor]), initialStyle);
      mode = 'reply';
      await send.click();
      await waitIdle();
      await count(users, 2);
      await count(assistants, 2);
      assert.equal(requests[1].messages.length, 2);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.hero-ai-guide #dealettChat');
      await count(users, 2);
      await count(assistants, 2);
      assert.equal(requests.length, 2);
      await input.fill('rad ett');
      await input.press('Shift+Enter');
      assert.equal(await input.inputValue(), 'rad ett\n');
      mode = 'fail';
      await input.fill('Misslyckat meddelande');
      await send.click();
      await retry.waitFor({ state: 'visible' });
      await count(users, 3);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await retry.waitFor({ state: 'visible' });
      mode = 'reply';
      await retry.click();
      await waitIdle();
      await count(users, 3);
      await count(assistants, 3);
      assert.equal(requests[2].clientMessage.id, requests[3].clientMessage.id);
      mode = 'hold';
      await input.fill('Svara senare');
      await send.click();
      await page.waitForFunction(() => document.querySelector('.dealett-chat-messages')?.getAttribute('aria-busy') === 'true');
      await newChat.click();
      assert.equal(await input.inputValue(), '');
      await count(users, 0);
      if (heldRoute) await reply(heldRoute).catch(() => {});
      heldRoute = null;
      mode = 'reply';
      await input.fill('hej');
      await send.click();
      await waitIdle();
      await count(users, 1);
      await count(assistants, 1);
      assert.equal(requests.at(-1).messages.length, 0);
      const bounds = await page.locator('.dealett-chat-panel').boundingBox();
      assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
      const box = await page.locator('.hero-ai-guide__composer').boundingBox();
      assert(bounds.x >= box.x && bounds.y >= box.y);
      assert(bounds.x + bounds.width <= box.x + box.width);
      assert(bounds.y + bounds.height <= box.y + box.height);
      const composerInput = await input.boundingBox();
      const sendBounds = await send.boundingBox();
      const statusBounds = await page.locator('.dealett-chat-inline-controls').boundingBox();
      const resetBounds = await newChat.boundingBox();
      assert(statusBounds.y >= bounds.y);
      assert.equal(composerInput.height, 30);
      assert.equal(sendBounds.height, 30);
      assert(Math.abs(composerInput.y + composerInput.height / 2 - sendBounds.y - sendBounds.height / 2) <= 2);
      assert(sendBounds.x >= composerInput.x + composerInput.width);
      assert.equal(await page.locator('.hero-ai-guide__ask-label').isVisible(), false);
      assert(sendBounds.y + sendBounds.height <= box.y + box.height);
      assert(resetBounds.y >= box.y && resetBounds.y < box.y + 44);
      assert(resetBounds.x + resetBounds.width <= box.x + box.width);
      assert.equal(await newChat.innerText(), '+ Ny chatt');
      const messagesBounds = await page.locator('.dealett-chat-messages').boundingBox();
      const userBubbleBounds = await users.last().locator('.dealett-chat-bubble').boundingBox();
      const replyBounds = await page.locator('.hero-ai-guide__form').boundingBox();
      assert(Math.abs(messagesBounds.y - box.y - 44) <= 2);
      assert(Math.abs(messagesBounds.x + messagesBounds.width - box.x - box.width) <= 2);
      assert(userBubbleBounds.x + userBubbleBounds.width <= messagesBounds.x + messagesBounds.width);
      assert(statusBounds.height <= 24 && statusBounds.x >= box.x);
      assert(Math.abs(messagesBounds.y + messagesBounds.height - replyBounds.y) <= 2);
      assert.equal(await page.locator('form form').count(), 0);
      const promptsBounds = await page.locator('.hero-ai-guide__prompts').boundingBox();
      const nextBounds = await page.locator(width <= 900 ? '.hero-finder' : '.hero-value').boundingBox();
      assert(promptsBounds.y + promptsBounds.height <= nextBounds.y, 'Chat overlaps the next section');
      assert(nextBounds.y - promptsBounds.y - promptsBounds.height <= 16, 'Unused space below chat');
      if (width > 900) {
        const finder = await page.locator('.hero-finder').boundingBox();
        assert(box.x + box.width <= finder.x - 20, 'Chat overlaps adjacent finder');
      }
      assert.equal(await page.getByRole('button', { name: 'Starta om chatten', exact: true }).isVisible(), true);
      const activeTabBounds = await page.locator('.dealett-chat-tab.is-active').boundingBox();
      const tabsBounds = await page.locator('.dealett-chat-tabs').boundingBox();
      assert(activeTabBounds.x >= tabsBounds.x - 1 && activeTabBounds.x + activeTabBounds.width <= tabsBounds.x + tabsBounds.width + 1, 'Active tab is clipped');
      if (process.env.CHAT_SCREENSHOT_DIR) {
        await page.locator('.hero-ai-guide').screenshot({ path: path.join(process.env.CHAT_SCREENSHOT_DIR, `home-chat-${width}.png`) });
      }
      mode = 'hold';
      await input.fill('Avbrutet vid omladdning');
      await send.click();
      await page.waitForFunction(() => document.querySelector('.dealett-chat-messages')?.getAttribute('aria-busy') === 'true');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await retry.waitFor({ state: 'visible' });
      if (heldRoute) await reply(heldRoute).catch(() => {});
      heldRoute = null;
      mode = 'reply';
      await retry.click();
      await waitIdle();
      await count(users, 2);
      await count(assistants, 2);
      await page.evaluate(() => {
        const key = 'dealettChatConversationV3';
        const stored = JSON.parse(sessionStorage.getItem(key));
        stored.updatedAt = Date.now() - 3600001;
        sessionStorage.setItem(key, JSON.stringify(stored));
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.DealettChat));
      await count(users, 0);
      await input.fill('hej');
      await send.click();
      await waitIdle();
      await count(users, 1);
      await count(assistants, 1);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const beforeLongConversation = await page.locator('.hero-ai-guide__composer').boundingBox();
      for (let turn = 0; turn < 8; turn += 1) {
        await input.fill(`Följdfråga ${turn + 1}`);
        await send.click();
        await waitIdle();
      }
      const scroll = await page.locator('.dealett-chat-messages').evaluate(e => ({ height: e.clientHeight, content: e.scrollHeight }));
      assert(scroll.height > 0 && scroll.content > scroll.height);
      const longConversationBox = await page.locator('.hero-ai-guide__composer').boundingBox();
      assert(Math.abs(longConversationBox.height - beforeLongConversation.height) <= 1, `Chat height changed from ${beforeLongConversation.height} to ${longConversationBox.height}`);
      const replyDivider = await page.locator('.hero-ai-guide__form').evaluate(e => getComputedStyle(e).borderTopWidth);
      assert.equal(replyDivider, '1px');
      assert.equal(await input.isVisible(), true);
      await newChat.click();
      await page.evaluate(() => window.DealettChat.close());
      await page.locator('.dealett-chat-toggle').click();
      assert.equal(await page.locator('.dealett-chat-panel').getAttribute('role'), 'dialog');
      assert.equal(await page.locator('.dealett-chat-form').isVisible(), true);
      await page.close();
      console.log(`PASS ${width}px: history, single submit, pending draft, follow-up, reload, retry, reset, stale reply, interrupted request, expiration, layout, widget`);
    }
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
