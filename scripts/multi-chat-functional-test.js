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
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const held = new Map();
      const requests = [];
      await page.route('**/api/chat', route => {
        const request = route.request().postDataJSON();
        requests.push(request);
        held.set(request.message, route);
      });
      const respond = async (message, fail = false) => {
        await page.waitForTimeout(100);
        assert(held.has(message), `Missing request: ${message}`);
        await held.get(message).fulfill(fail ? { status: 503, json: {} } : { json: { source: 'openai', reply: `Svar: ${message}`, conversationToken: `token-${message}`, qualification: { peopleCount: message === 'Mobil för familjen' ? 3 : 1 } } });
        held.delete(message);
      };
      const url = `http://127.0.0.1:${server.address().port}/`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.DealettChat));
      const input = page.locator('#home-ai-question');
      const send = page.locator('[data-home-ai-form] [type="submit"]');
      const newChat = page.getByRole('button', { name: '+ Ny chatt', exact: true });
      const chats = page.getByRole('button', { name: /^Alla chattar/ });
      const select = async title => {
        await page.getByRole('tab', { name: title, exact: false }).click();
      };
      const sendQuestion = async message => { await input.fill(message); await send.click(); };
      await sendQuestion('Mobil för familjen');
      await page.waitForFunction(() => document.querySelector('.dealett-chat-messages').getAttribute('aria-busy') === 'true');
      const firstId = await page.evaluate(() => window.DealettChat.getConversationId());
      await newChat.click();
      await sendQuestion('Bredband hemma');
      const secondId = await page.evaluate(() => window.DealettChat.getConversationId());
      assert.notEqual(firstId, secondId);
      await input.fill('Mitt utkast');
      await respond('Mobil för familjen');
      await page.waitForFunction(() => document.querySelectorAll('.dealett-chat-tab.is-unread').length === 1);
      assert(!await page.locator('.dealett-chat-messages').innerText().then(t => t.includes('Svar: Mobil')));
      assert.equal(await input.inputValue(), 'Mitt utkast');
      await respond('Bredband hemma');
      await page.waitForFunction(() => document.querySelector('.dealett-chat-messages').getAttribute('aria-busy') === 'false');
      await select('Mobil för familjen');
      assert.equal(await page.locator('.dealett-chat-message--assistant').last().innerText().then(t => t.includes('Svar: Mobil')), true);
      await sendQuestion('Följdfråga');
      await respond('Följdfråga', true);
      await page.locator('#dealettChat .dealett-chat-inline-controls').getByRole('button', { name: 'Försök igen', exact: true }).waitFor();
      await select('Bredband hemma');
      assert.equal(await input.inputValue(), 'Mitt utkast');
      await select('Mobil för familjen');
      await page.locator('#dealettChat .dealett-chat-inline-controls').getByRole('button', { name: 'Försök igen', exact: true }).click();
      await respond('Följdfråga');
      await page.waitForFunction(() => document.querySelector('.dealett-chat-messages').getAttribute('aria-busy') === 'false');
      assert.equal(requests.at(-1).conversationToken, 'token-Mobil för familjen');
      assert.equal(requests.at(-1).conversationId, firstId);
      assert.equal(requests.at(-1).qualification.peopleCount, 3);
      assert(!requests.at(-1).messages.some(message => message.content.includes('Bredband')));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.DealettChat));
      await select('Bredband hemma');
      assert.equal(await page.evaluate(() => window.DealettChat.getConversationId()), secondId);
      assert((await page.locator('.dealett-chat-messages').innerText()).includes('Svar: Bredband hemma'));
      if (!await page.locator('#dealett-chat-history').isVisible()) await chats.click();
      const row = page.locator('.dealett-chat-history-row').filter({ has: page.locator('strong', { hasText: 'Bredband hemma' }) });
      await row.locator('summary').click();
      page.once('dialog', dialog => dialog.accept('Mitt bredband'));
      await row.getByRole('button', { name: 'Byt namn' }).click();
      assert.equal(await page.locator('.dealett-chat-history-row strong').filter({ hasText: 'Mitt bredband' }).count(), 1);
      await page.locator('.dealett-chat-history-row').filter({ hasText: 'Mitt bredband' }).locator('summary').click();
      await page.getByRole('button', { name: 'Arkivera', exact: true }).click();
      if (!await page.locator('#dealett-chat-history').isVisible()) await chats.click();
      await page.getByRole('button', { name: 'Arkiverade chattar', exact: true }).click();
      assert.equal(await page.locator('.dealett-chat-history-row strong').filter({ hasText: 'Mitt bredband' }).count(), 1);
      await page.locator('.dealett-chat-history-row').filter({ hasText: 'Mitt bredband' }).locator('summary').click();
      await page.getByRole('button', { name: 'Återställ', exact: true }).click();
      await page.getByRole('button', { name: 'Tillbaka till chattar', exact: true }).click();
      await chats.click();
      await page.screenshot({ path: `/tmp/multi-chat-${width}.png` });
      const bounds = await page.locator('.dealett-chat-panel').boundingBox();
      assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
      assert.deepEqual(errors, []);
      await newChat.click();
      await sendQuestion('Ta bort under svar');
      if (!await page.locator('#dealett-chat-history').isVisible()) await chats.click();
      const deleteRow = page.locator('.dealett-chat-history-row').filter({ has: page.locator('strong', { hasText: 'Ta bort under svar' }) });
      await deleteRow.locator('summary').click();
      page.once('dialog', dialog => dialog.accept());
      await deleteRow.getByRole('button', { name: 'Ta bort', exact: true }).click();
      await respond('Ta bort under svar');
      assert(!(await page.locator('.dealett-chat-messages').innerText()).includes('Ta bort under svar'));
      await page.goto(url + 'mobilabonnemang.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.DealettChat));
      await page.evaluate(() => window.DealettChat.open());
      await newChat.click();
      const widgetInput = page.locator('.dealett-chat-input');
      await widgetInput.fill('Widget ett');
      await widgetInput.press('Enter');
      await newChat.click();
      await widgetInput.fill('Widget två');
      await widgetInput.press('Enter');
      await respond('Widget ett');
      await respond('Widget två');
      await select('Widget ett');
      assert((await page.locator('.dealett-chat-messages').innerText()).includes('Svar: Widget ett'));
      assert(!(await page.locator('.dealett-chat-messages').innerText()).includes('Svar: Widget två'));
      await page.screenshot({ path: `/tmp/multi-chat-widget-${width}.png` });
      const widgetId = await page.evaluate(() => window.DealettChat.getConversationId());
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.DealettChat));
      await page.evaluate(() => window.DealettChat.open());
      await select('Widget ett');
      await sendQuestion('Fortsätt från startsidan');
      await respond('Fortsätt från startsidan');
      assert.equal(requests.at(-1).conversationId, widgetId);
      const countBeforeRestart = await page.getByRole('tab').count();
      await page.getByRole('button', { name: 'Starta om chatten', exact: true }).click();
      assert.equal(await page.getByRole('tab').count(), countBeforeRestart);
      assert.notEqual(await page.evaluate(() => window.DealettChat.getConversationId()), widgetId);
      assert.equal(await page.locator('.dealett-chat-message--user').count(), 0);
      await select('Widget två');
      assert((await page.locator('.dealett-chat-messages').innerText()).includes('Svar: Widget två'));
      const activeTab = page.getByRole('tab', { selected: true });
      await activeTab.focus();
      await activeTab.press('Home');
      assert.equal(await page.getByRole('tab').first().getAttribute('aria-selected'), 'true');
      await page.getByRole('tab').first().press('End');
      assert.equal(await page.getByRole('tab').last().getAttribute('aria-selected'), 'true');
      await select('Widget två');
      const tabsBeforeClose = await page.getByRole('tab').count();
      await page.getByRole('button', { name: 'Stäng flik: Widget två', exact: true }).click();
      assert.equal(await page.getByRole('tab').count(), tabsBeforeClose - 1);
      await chats.click();
      await page.getByRole('button', { name: 'Arkiverade chattar', exact: true }).click();
      await page.locator('.dealett-chat-history-row > button').filter({ hasText: 'Widget två' }).click();
      assert((await page.locator('.dealett-chat-messages').innerText()).includes('Svar: Widget två'));
      assert.equal(await page.getByRole('tab').count(), tabsBeforeClose);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`PASS ${width}px: concurrent replies, isolation, unread, drafts, retry, reload, rename, archive, layout`);
    }
  } finally { await browser.close(); server.close(); }
}
run().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
