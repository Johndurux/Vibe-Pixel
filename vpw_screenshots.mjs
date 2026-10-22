import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  // screenshot at 100% zoom
  await page.screenshot({ path: '/home/ubuntu/vpw_100.png' });
  // click zoom out (Perkecil)
  await page.click('button[aria-label="Perkecil"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/home/ubuntu/vpw_zoomout.png' });
  await browser.close();
})();
