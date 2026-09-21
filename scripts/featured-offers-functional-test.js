const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { CdpPage, CHROME, delay, getFreePort, waitForJson } = require('./checkout-visual-test');

(async () => {
  const port = await getFreePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dealett-featured-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let page;
  try {
    await waitForJson(`http://127.0.0.1:${port}/json/version`);
    const tabs = await waitForJson(`http://127.0.0.1:${port}/json/list`);
    page = new CdpPage(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Page.navigate', { url: process.env.CHECKOUT_BASE_URL || 'http://127.0.0.1:3000' });
    const wait = async expression => {
      for (let i = 0; i < 100; i++) {
        if (await page.evaluate(expression)) return;
        await delay(100);
      }
      throw new Error(`Timed out: ${expression}`);
    };
    await wait('document.querySelectorAll("[data-featured-offer]:not(:disabled)").length === 4');
    for (const [id, operator, persons, price, reward] of [
      ['family-4', 'Telenor', 4, 1136, 4000], ['family-3', 'Tele2', 3, 737, 3000],
      ['duo-2', 'Tre', 2, 578, 2000], ['single-1', 'Telia', 1, 499, 1000],
    ]) {
      await page.evaluate('window.DealettCart.clearCart(); window.DealettCart.closeDrawer()');
      const selector = `[data-featured-offer="featured-${id}"]`;
      const text = await page.evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`);
      assert.ok(text.includes(operator));
      assert.ok(text.replace(/\s/g, '').includes(`${price}kr/mån`));
      await page.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
      await wait('document.querySelector("#cartDrawer")?.getAttribute("aria-hidden") === "false" && document.querySelector(".cart-summary-card")');
      const cart = await page.evaluate('window.DealettCart.readCart()');
      assert.equal(cart.length, 1);
      assert.equal(cart[0].persons, persons);
      assert.equal(cart[0].price, price);
      assert.equal(cart[0].rewardTotal, reward);
      const rendered = await page.evaluate('document.querySelector("#cartDrawer").textContent');
      assert.ok(rendered.includes(operator));
      assert.ok(rendered.includes(`${persons} abonnemang`));
      assert.ok(rendered.replace(/\s/g, '').includes(`${price}kr/mån`));
      await wait('[...document.querySelectorAll(".cart-summary-logo img")].every(img => img.complete && img.naturalWidth > 0)');
      assert.equal(await page.evaluate('document.querySelector("#quiz-steps-wrapper").classList.contains("hidden")'), true);
      await page.evaluate('window.DealettCart.closeDrawer()');
      await page.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
      await wait('!document.querySelector("[aria-busy=true]")');
      assert.equal(await page.evaluate('window.DealettCart.readCart().length'), 1);
      await page.evaluate('document.querySelector("#cartCheckoutBtn").click()');
      await wait('!document.querySelector("[data-cart-step=checkout]").classList.contains("is-hidden")');
      console.log(`PASS ${operator}: ${persons} subscriptions, ${price} kr/month, direct cart and checkout`);
    }
    const finalCart = await page.evaluate('window.DealettCart.readCart()');
    await page.evaluate(`window.DealettCart.closeDrawer(); window.DealettCart.clearCart(); window.DealettNetwork.fetchJson = async () => { throw new Error('offline'); }; document.querySelector('[data-featured-offer]').click()`);
    await wait('document.querySelector("[data-featured-offer-status]").textContent.includes("kunde inte läggas till")');
    assert.equal(await page.evaluate('window.DealettCart.readCart().length'), 0);
    assert.equal(await page.evaluate('document.querySelectorAll("[data-featured-offer]:not(:disabled)").length'), 4);
    console.log('PASS failure recovery and duplicate-click protection');
    await page.evaluate(`window.DealettCart.setCart(${JSON.stringify(finalCart)})`);
    const checkoutUrl = new URL('bestallning.html', (process.env.CHECKOUT_BASE_URL || 'http://127.0.0.1:3000').replace(/\/?$/, '/')).href;
    await page.send('Page.navigate', { url: checkoutUrl });
    await wait('document.querySelector("#giftCardDetails")?.textContent.replace(/\\s/g, "").includes("1000kr")');
    console.log('PASS agreement page retains fixed package reward');
  } finally {
    page?.close();
    chrome.kill();
    await delay(500);
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
