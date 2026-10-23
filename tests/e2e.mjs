import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const PORT = Number(process.env.E2E_PORT || 4310);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = 'screenshots';
const BLOCK = { col: 12, row: 8, name: 'VibeLaunch' };

if (!existsSync('.next/BUILD_ID')) {
  console.error('No production build found. Run `npm run build` first.');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

let server;
let serverLog = '';

function stopServer() {
  if (!server || server.exitCode !== null) return;
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    try {
      server.kill('SIGTERM');
    } catch {
      /* already gone */
    }
  }
}

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(BASE, { redirect: 'manual' });
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error(`server did not start on ${BASE}\n${serverLog.slice(-1500)}`);
}

async function clickBlock(page, board, cell) {
  const box = await board.boundingBox();
  assert.ok(box, 'board has no bounding box');
  await page.mouse.click(box.x + (BLOCK.col + 0.5) * cell, box.y + (BLOCK.row + 0.5) * cell);
}

async function assertBlockSelected(page) {
  const detail = page.getByTestId('selected-detail');
  await detail.waitFor({ state: 'visible', timeout: 5000 });
  assert.match(await detail.innerText(), new RegExp(BLOCK.name));
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
    { timeout: 5000 },
  );
}

async function main() {
  const nextBin = path.join('node_modules', '.bin', 'next');
  server = spawn(nextBin, ['start', '-p', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  server.stdout.on('data', d => { serverLog += d.toString(); });
  server.stderr.on('data', d => { serverLog += d.toString(); });

  await waitForServer();

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));

  try {
    // Desktop: board fits, is centred, and hover/click hit-testing works.
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const board = page.getByTestId('wall-board');
    await board.waitFor({ state: 'visible' });
    let box = await board.boundingBox();
    assert.ok(box, 'desktop board box');
    assert.ok(box.width <= 1001, `desktop board too wide: ${box.width}`);
    assert.ok(box.x > 0 && box.x + box.width < 1440, 'desktop board is not centred');

    await clickBlock(page, board, Math.round(box.width / 100));
    await assertBlockSelected(page);
    await page.getByLabel('Tutup detail').click();
    await page.getByTestId('selected-detail').waitFor({ state: 'detached' });
    await page.screenshot({ path: `${OUT}/desktop-1440.png`, fullPage: true });

    // Zoom 140%: the grid must stay aligned and clicks must still land on b1.
    await page.getByLabel('Perbesar').click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="zoom-level"]')?.textContent?.trim() === '140%',
      undefined,
      { timeout: 3000 },
    );
    const zoom = (await page.getByTestId('zoom-level').innerText()).trim();
    assert.equal(zoom, '140%', `zoom label was ${zoom}`);
    box = await board.boundingBox();
    assert.ok(box, 'zoomed board box');
    assert.ok(Math.abs(box.width - 1400) <= 1, `zoomed board width ${box.width}, expected 1400`);
    await clickBlock(page, board, Math.round(box.width / 100));
    await assertBlockSelected(page);
    await page.screenshot({ path: `${OUT}/desktop-zoom140.png`, fullPage: true });

    // At 140% the board is wider than its frame; the scroller must expose the
    // right/bottom edge instead of clipping the outer border away.
    const scroller = page.getByTestId('board-scroll');
    const scrollerSize = await scroller.evaluate(el => ({
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
    }));
    assert.ok(
      scrollerSize.scrollWidth > scrollerSize.clientWidth,
      `zoomed board is not scrollable (${scrollerSize.scrollWidth}/${scrollerSize.clientWidth})`,
    );
    await scroller.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await page.waitForTimeout(100);
    const zoomBox = await page.getByTestId('zoom-level').boundingBox();
    assert.ok(
      zoomBox && zoomBox.x >= 0 && zoomBox.x + zoomBox.width <= 1440,
      'zoom controls scrolled out of view',
    );
    await page.screenshot({ path: `${OUT}/desktop-zoom140-edge.png`, fullPage: true });

    // Reset returns to the fitted scale. Because this is a zoom-out, it also
    // verifies the overlay was cleared rather than leaving ghost trails.
    await page.getByLabel('Reset tampilan').click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="zoom-level"]')?.textContent?.trim() === '100%',
      undefined,
      { timeout: 3000 },
    );
    await page.waitForTimeout(150);
    box = await board.boundingBox();
    assert.ok(box && Math.abs(box.width - 1000) <= 1, `reset board width ${box?.width}, expected 1000`);
    await page.screenshot({ path: `${OUT}/desktop-reset.png`, fullPage: true });

    // Max zoom must stay bounded: a 3000px board may only allocate a 2048px
    // canvas, otherwise mobile Chrome runs out of memory and stutters.
    for (let i = 0; i < 6; i++) await page.getByLabel('Perbesar').click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="zoom-level"]')?.textContent?.trim() === '300%',
      undefined,
      { timeout: 3000 },
    );
    box = await board.boundingBox();
    assert.ok(box && Math.abs(box.width - 3000) <= 1, `max zoom board width ${box?.width}, expected 3000`);
    const canvasSizes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('canvas')).map(c => [c.width, c.height]),
    );
    assert.ok(
      canvasSizes.length === 2 && canvasSizes.every(([w, h]) => w <= 2048 && h <= 2048),
      `canvas backing store too large: ${JSON.stringify(canvasSizes)}`,
    );
    await page.screenshot({ path: `${OUT}/desktop-zoom300.png`, fullPage: true });

    // Tablet: auto-fit keeps the whole board inside the viewport.
    await page.setViewportSize({ width: 768, height: 900 });
    await page.reload({ waitUntil: 'networkidle' });
    await waitForBoardWidth(page, 768 - 16);
    box = await board.boundingBox();
    assert.ok(box && box.width <= 768 - 32, `tablet board overflows: ${box?.width}`);
    await clickBlock(page, board, Math.round(box.width / 100));
    await assertBlockSelected(page);
    await page.screenshot({ path: `${OUT}/tablet-768.png`, fullPage: true });

    // Mobile: no horizontal document scroll, board still clickable.
    await page.setViewportSize({ width: 375, height: 800 });
    await page.reload({ waitUntil: 'networkidle' });
    await waitForBoardWidth(page, 375 - 16);
    box = await board.boundingBox();
    assert.ok(box && box.width <= 375 - 32, `mobile board overflows: ${box?.width}`);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    assert.ok(overflow <= 2, `mobile horizontal overflow: ${overflow}px`);
    await clickBlock(page, board, Math.round(box.width / 100));
    await assertBlockSelected(page);
    await page.screenshot({ path: `${OUT}/mobile-375.png`, fullPage: true });

    assert.deepEqual(errors, [], `browser errors:\n${errors.join('\n')}`);
    console.log('E2E OK: desktop centre, 140% hit-test, tablet/mobile fit, no console errors');
  } finally {
    await browser.close();
  }
}

main()
  .catch(err => {
    console.error('E2E FAIL:', err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    stopServer();
  });
