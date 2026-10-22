import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('https://vibe-pixel-wall.vercel.app', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: '/home/ubuntu/vpw_redesign_100.png', fullPage: true });
console.log('100% zoom saved to /home/ubuntu/vpw_redesign_100.png');

// Zoom out using mouse wheel
await page.mouse.wheel(0, -5000);
await page.waitForTimeout(500);
await page.screenshot({ path: '/home/ubuntu/vpw_redesign_zoomout.png', fullPage: true });
console.log('Zoomed out saved to /home/ubuntu/vpw_redesign_zoomout.png');

await browser.close();
