
import { chromium } from "playwright";
const url = "http://127.0.0.1:3100";
async function shot(name, width, height, deviceScaleFactor, isMobile) {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor,
    isMobile,
    hasTouch: isMobile,
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `/tmp/${name}.png`, fullPage: true });
  await browser.close();
  console.log("saved /tmp/" + name + ".png");
}
(async () => {
  await shot("vpw_new_desktop", 1440, 900, 1, false);
  await shot("vpw_new_mobile", 390, 844, 2, true);
  console.log("done");
})();
