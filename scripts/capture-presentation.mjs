import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';

const BASE = 'https://stream.broadcastsn.com';
const PASSWORD = process.env.ADMIN_PASSWORD;
if (!PASSWORD) {
  console.error('Set ADMIN_PASSWORD env var');
  process.exit(1);
}
const OUT = '/srv/tv-radio-app/public/presentation/screenshots';

const pages = [
  { name: '01-login', url: '/login', auth: false },
  { name: '02-dashboard', url: '/', auth: true, fullPage: true },
  { name: '03-streams', url: '/streams', auth: true, fullPage: true },
  { name: '04-monitoring', url: '/monitoring', auth: true, fullPage: true },
  { name: '05-recordings', url: '/recordings', auth: true, fullPage: true },
  { name: '06-srt', url: '/srt', auth: true, fullPage: true },
  { name: '07-rtmp', url: '/rtmp', auth: true, fullPage: true },
  { name: '08-endpoints', url: '/endpoints', auth: true, fullPage: true },
  { name: '09-watch', url: '/watch', auth: false, fullPage: true },
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

// Login once
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.fill('input[type="password"]', PASSWORD);
await page.click('button:has-text("Se connecter")');
await page.waitForURL(`${BASE}/`, { timeout: 30000 });
await page.waitForTimeout(2000);

for (const p of pages) {
  if (!p.auth) {
    // Fresh context without cookies for public pages
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const pg = await ctx.newPage();
    await pg.goto(`${BASE}${p.url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pg.waitForTimeout(4000);
    await pg.screenshot({
      path: path.join(OUT, `${p.name}.png`),
      fullPage: p.fullPage ?? false,
    });
    await ctx.close();
    console.log(`✓ ${p.name}`);
    continue;
  }

  await page.goto(`${BASE}${p.url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.screenshot({
    path: path.join(OUT, `${p.name}.png`),
    fullPage: p.fullPage ?? false,
  });
  console.log(`✓ ${p.name}`);
}

await browser.close();
console.log('Done:', OUT);
