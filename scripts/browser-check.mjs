import { ROOT } from './browser-env.mjs';
const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-crash-reporter', '--disable-breakpad'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto(process.argv[2] || 'http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 20000 });
console.log('browser OK:', await page.title(), '·', ROOT);
await browser.close();
