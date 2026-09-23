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
      for (const persons of [1, 4, 10]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 } });
        await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => Boolean(window.DealettQuiz));
        if (persons > 5) await page.locator('[data-finder-more]').click();
        await page.locator(`label:has(input[name="finder-persons"][value="${persons}"])`).click();
        await page.evaluate(() => {
          window.quizFrames = [];
          const sample = () => {
            const wrapper = document.getElementById('quiz-steps-wrapper');
            if (!wrapper.classList.contains('hidden')) {
              window.quizFrames.push(document.querySelector('#quiz-card-stack .active-step')?.textContent || '');
            }
            window.quizFrameRequest = requestAnimationFrame(sample);
          };
          sample();
        });
        await page.getByRole('button', { name: 'Visa mina alternativ', exact: true }).click();
        await page.waitForTimeout(650);
        const result = await page.evaluate(() => {
          cancelAnimationFrame(window.quizFrameRequest);
          return { frames: window.quizFrames, state: window.DealettQuiz.getState() };
        });
        assert.ok(result.frames.length > 0);
        assert.ok(result.frames.every(text => !text.includes('Hur många abonnemang?')), 'Old people question was displayed');
        assert.equal(result.state.currentStep, 1);
        assert.equal(result.state.persons, persons);
        assert.equal(result.state.data, 'medium');
        assert.ok(await page.locator('#quiz-card-stack .active-step').isVisible());
        await page.close();
      }
    }
    console.log('Finder opens directly on the operator question at desktop and mobile widths for 1, 4 and 10 people.');
  } finally {
    await browser.close();
    server.close();
  }
}
run().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
