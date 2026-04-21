import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(here, 'fb-cover-nz.html');
const outPath = path.join(here, 'assets', 'fb-cover-nz.png');

const WIDTH = 1640;
const HEIGHT = 856;

// Fallback to a pre-installed chromium if Playwright's own download is missing.
const fallbacks = [
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
];
const executablePath = fallbacks.find(p => fs.existsSync(p));

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(250);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
await page.screenshot({
  path: outPath,
  clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
});
await browser.close();
console.log('wrote', outPath);
