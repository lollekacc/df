const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try {
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' })[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, headless: true });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      await page.route('**/api/mobile/plans', route => route.fulfill({ json: [10, 30, 100, 999].map(dataAmount => ({ id: 'test-' + dataAmount, category: 'mobil', operator: 'Telenor', title: dataAmount >= 999 ? 'Obegränsad' : dataAmount + ' GB', dataAmount, price: 299, runtimeSellable: true })) }));
      await page.goto(`http://127.0.0.1:${server.address().port}/mobilabonnemang.html`, { waitUntil: 'networkidle' });
      const trigger = page.locator('[data-surf-calculator]');
      await trigger.click();
      assert.equal(await page.locator('dialog').evaluate(el => el.open), true);
      assert.equal(await page.locator('#surf-wifi').isDisabled(), true);
      const set = async (id, value) => page.locator('#surf-' + id).evaluate((el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
      await set('video', 60);
      assert.equal(await page.locator('#surf-gb').textContent(), '21');
      assert.equal(await page.locator('#surf-buffer').textContent(), '26 GB');
      await set('wifi', 30);
      assert.equal(await page.locator('#surf-gb').textContent(), '11');
      await page.selectOption('#surf-quality', '2');
      assert.equal(await page.locator('#surf-gb').textContent(), '30');
      await set('wifi', 60);
      assert.equal(await page.locator('#surf-gb').textContent(), '0');
      assert.equal(await page.locator('.surf-apply').isDisabled(), true);
      await set('video', 15);
      assert.equal(await page.locator('#surf-wifi').inputValue(), '15');
      await set('music', 1440);
      assert.equal(await page.locator('#surf-total').textContent(), '24 tim');
      await set('music', 0);
      await set('video', 60);
      await set('wifi', 0);
      await page.selectOption('#surf-quality', '0.7');
      await page.screenshot({ path: path.join(process.env.TEMP, `dealett-surf-${width}.png`) });
      assert.equal(await page.locator('dialog').evaluate(el => el.scrollWidth <= el.clientWidth), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
      await trigger.click();
      const values = await page.locator('#dataFilter').getAttribute('data-values');
      assert.ok(values, 'Offer API data must populate the existing filter');
      await page.locator('.surf-apply').click();
      assert.equal(await page.locator('dialog').evaluate(el => el.open), false);
      const chosen = values.split(',').find(v => v === 'unlimited' || Number(v) >= 26);
      assert.ok((await page.locator('#dataFilterValue').textContent()).includes(chosen === 'unlimited' ? 'Obegränsad' : chosen));
      assert.ok(await page.locator('.offer-card').count() > 0);
      console.log(`${width}px: calculations, limits, Wi-Fi, quality, modal focus and offer filter with API fixture passed (${chosen}).`);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
