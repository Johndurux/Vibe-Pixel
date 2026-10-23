import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.LIVE_URL || 'https://vibe-pixel-wall.vercel.app';
const OUT = 'screenshots';
const BLOCK = { col: 12, row: 8, name: 'VibeLaunch' };
mkdirSync(OUT, { recursive: true });

async function clickBlock(page, board, cell) {
  const box = await board.boundingBox();
  assert.ok(box, 'board has no box');
  await page.mouse.click(box.x + (BLOCK.col + 0.5) * cell, box.y + (BLOCK.row + 0.5) * cell);
}

async function waitForBoardWidth(page, maxWidth) {
  await page.waitForFunction(
    max => {
      const el = document.querySelector('[data-testid="wall-board"]');
      if (!el) return false;
      const width = el.getBoundingClientRect().width;
      return width > 0 && width <= max;
    },
    maxWidth,
    { timeout: 8000 },
  );
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});
page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));

try {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const board = page.getByTestId('wall-board');
  await board.waitFor({ state: 'visible', timeout: 10000 });
  let box = await board.boundingBox();
  assert.ok(box, 'desktop board box');
  assert.ok(box.width <= 1001, `desktop board too wide: ${box.width}`);
  assert.ok(box.x > 0 && box.x + box.width < 1440, 'desktop board is not centred');
  await clickBlock(page, board, Math.round(box.width / 100));
  const detail = page.getByTestId('selected-detail');
  await detail.waitFor({ state: 'visible' });
  assert.match(await detail.innerText(), /VibeLaunch/);
  await page.getByLabel('Tutup detail').click();
  await page.screenshot({ path: `${OUT}/live-desktop-1440.png`, fullPage: true });

  await page.getByLabel('Perbesar').click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="zoom-level"]')?.textContent?.trim() === '140%',
    undefined,
    { timeout: 5000 },
  );
  box = await board.boundingBox();
  assert.ok(box && Math.abs(box.width - 1400) <= 1, `live zoom width ${box?.width}`);
  await clickBlock(page, board, Math.round(box.width / 100));
  await detail.waitFor({ state: 'visible' });
  await page.screenshot({ path: `${OUT}/live-zoom140.png`, fullPage: true });

  await page.setViewportSize({ width: 375, height: 800 });
  await page.reload({ waitUntil: 'networkidle' });
  await waitForBoardWidth(page, 375 - 16);
  box = await board.boundingBox();
  assert.ok(box && box.width <= 375 - 32, `live mobile board overflows: ${box?.width}`);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  assert.ok(overflow <= 2, `live mobile horizontal overflow: ${overflow}px`);
  await clickBlock(page, board, Math.round(box.width / 100));
  await detail.waitFor({ state: 'visible' });
  assert.match(await detail.innerText(), /VibeLaunch/);
  await page.screenshot({ path: `${OUT}/live-mobile-375.png`, fullPage: true });

  assert.deepEqual(errors, [], `live browser errors:\n${errors.join('\n')}`);
  console.log(`LIVE OK: ${BASE} desktop/zoom/mobile verified, no console errors`);
} finally {
  await browser.close();
}
