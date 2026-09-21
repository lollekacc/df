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
    await wait('window.DEALETT_CART_CHECKOUT_READY && document.querySelector("[data-restore-cart]")');
    assert.ok(await page.evaluate('document.querySelector("#savedCartNotice").textContent.includes("Återställ tidigare val")'));
    console.log('PASS expired cart is empty and restore option is rendered');
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(os.tmpdir(), 'dealett-cart-expiry.png'), Buffer.from(shot.data, 'base64'));
    await page.evaluate(`DealettCart.appendItem({cartItemId: 'new', offerId: 'new', title: 'Nytt abonnemang', price: 399});`);
    assert.deepEqual(await page.evaluate('DealettCart.readCart().map(item => item.cartItemId)'), ['new']);
    assert.ok(await page.evaluate('document.querySelector("[data-restore-cart]").textContent.includes("Ersätt")'));
    await page.evaluate('document.querySelector("[data-restore-cart]").click()');
    assert.deepEqual(await page.evaluate('DealettCart.readCart().map(item => item.cartItemId)'), ['old']);
    assert.equal(await page.evaluate('!!document.querySelector("#savedCartNotice")'), false);
    assert.ok(await page.evaluate('document.querySelector("#cartSummaryContainer").textContent.includes("Tidigare abonnemang")'));
    await wait('[...document.querySelectorAll(".cart-summary-logo img")].every(img => img.complete && img.naturalWidth > 0)');
    console.log('PASS new selections stay separate and explicit restore replaces them');
    await page.evaluate("DealettCart.setSubmitting(true); localStorage.setItem('dealettCartActivity', Date.now() - 3600001)");
    assert.equal(await page.evaluate('DealettCart.readCart().length'), 1);
    await page.evaluate('DealettCart.setSubmitting(false)');
    console.log('PASS in-progress submission survives expiry');
    await page.evaluate(`DealettCart.appendItem({cartItemId: 'later', offerId: 'later', title: 'Extra', price: 99}); sessionStorage.setItem('dealettCheckout', JSON.stringify({orderReference: 'CONFIRMED'})); DealettCart.completePurchase([{cartItemId:'old'}]);`);
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
