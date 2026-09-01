import { chromium } from 'playwright';
import path from 'path';

const URL = 'https://stream.broadcastsn.com/presentation/index.html';
const OUT = '/srv/tv-radio-app/public/presentation/Broadcast-SN-Stream-Control-Center.pdf';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.evaluate(async () => {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const img of document.querySelectorAll('img[loading="lazy"]')) {
    img.loading = 'eager';
  }
  for (let y = 0; y < document.body.scrollHeight; y += 600) {
    window.scrollTo(0, y);
    await delay(200);
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(8000);

await page.emulateMedia({ media: 'print' });

await page.pdf({
  path: OUT,
  format: 'A4',
  landscape: true,
  printBackground: true,
  margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
  preferCSSPageSize: false,
});

await browser.close();
console.log('PDF généré :', OUT);
