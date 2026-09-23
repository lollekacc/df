const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { CdpPage, CHROME, delay, getFreePort, waitForJson } = require('./checkout-visual-test');

(async () => {
  const port = await getFreePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dealett-cart-expiry-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let page;
  try {
    await waitForJson(`http://127.0.0.1:${port}/json/version`);
    const tabs = await waitForJson(`http://127.0.0.1:${port}/json/list`);
    page = new CdpPage(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    const wait = async expression => {
      for (let i = 0; i < 100; i++) {
        if (await page.evaluate(expression)) return;
        await delay(100);
      }
      throw new Error(`Timed out: ${expression}`);
    };
    await page.send('Page.navigate', { url: process.env.CHECKOUT_BASE_URL || 'http://127.0.0.1:3000' });
    await wait('!!window.DealettCart');
    await page.evaluate(`localStorage.clear(); DealettCart.appendItem({ cartItemId: 'old', offerId: 'old', title: 'Tidigare abonnemang', operator: 'Telenor', price: 299, logo: 'images/telenor.svg' });`);
    const activity = await page.evaluate("localStorage.getItem('dealettCartActivity')");
    await page.send('Page.reload');
    await wait('!!window.DealettCart');
    assert.equal(await page.evaluate('DealettCart.readCart().length'), 1);
    assert.equal(await page.evaluate("localStorage.getItem('dealettCartActivity')"), activity);
    console.log('PASS reload retains cart without resetting inactivity');
    await page.evaluate("localStorage.setItem('dealettCartActivity', Date.now() - 1800000)");
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    assert.ok(await page.evaluate("Date.now() - Number(localStorage.getItem('dealettCartActivity')) < 2000"));
    console.log('PASS real customer activity renews the timer');

    await page.evaluate("localStorage.setItem('dealettCartActivity', Date.now() - 3600001)");
    await page.send('Page.reload');
    await wait('!!window.DealettCart');
    assert.equal(await page.evaluate('DealettCart.readCart().length'), 0);
    assert.equal(await page.evaluate("localStorage.getItem('selectedOffer')"), null);
    await page.evaluate('DealettCart.openDrawer()');
    await wait('window.DEALETT_CART_CHECKOUT_READY');
    assert.equal(await page.evaluate('!!document.querySelector("#savedCartNotice, [data-restore-cart], [data-dismiss-saved-cart]")'), false);
    assert.equal(await page.evaluate("localStorage.getItem('dealettSavedCart')"), null);
    assert.equal(await page.evaluate('document.querySelector("#cartSummaryContainer").textContent.includes("Tidigare abonnemang")'), false);
    console.log('PASS expired cart is removed automatically without restore or delete choices');
    await page.evaluate(`DealettCart.appendItem({cartItemId: 'new', offerId: 'new', title: 'Nytt abonnemang', price: 399});`);
    assert.deepEqual(await page.evaluate('DealettCart.readCart().map(item => item.cartItemId)'), ['new']);
    assert.equal(await page.evaluate('!!document.querySelector("#savedCartNotice")'), false);
    assert.ok(await page.evaluate('document.querySelector("#cartSummaryContainer").textContent.includes("Nytt abonnemang")'));
    console.log('PASS new selections render without an inactivity prompt');
    await page.evaluate("DealettCart.setSubmitting(true); localStorage.setItem('dealettCartActivity', Date.now() - 3600001)");
    assert.equal(await page.evaluate('DealettCart.readCart().length'), 1);
    await page.evaluate('DealettCart.setSubmitting(false)');
    console.log('PASS in-progress submission survives expiry');
    await page.evaluate(`DealettCart.appendItem({cartItemId: 'later', offerId: 'later', title: 'Extra', price: 99}); sessionStorage.setItem('dealettCheckout', JSON.stringify({orderReference: 'CONFIRMED'})); DealettCart.completePurchase([{cartItemId:'new'}]);`);
    assert.deepEqual(await page.evaluate('DealettCart.readCart().map(item => item.cartItemId)'), ['later']);
    assert.equal(await page.evaluate("JSON.parse(sessionStorage.getItem('dealettCheckout')).orderReference"), 'CONFIRMED');
    assert.equal(await page.evaluate("localStorage.getItem('dealettSavedCart')"), null);
    console.log('PASS completion removes only purchased items and preserves confirmation');
  } finally {
    page?.close();
    chrome.kill('SIGTERM');
    await delay(300);
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
