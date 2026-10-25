import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const PORT = Number(process.env.E2E_PORT || 4310);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = 'screenshots';

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

async function boardMetrics(page) {
  return page.evaluate(() => {
    const board = document.querySelector('[data-testid="wall-board"]');
    const viewport = document.querySelector('[data-testid="board-scroll"]');
    const frame = document.querySelector('.cork-frame');
    const block = document.querySelector('[data-block-id]');
    const grid = document.querySelector('.wall-grid');
    const emptyNote = document.querySelector('.empty-wall-note');
    if (!board || !viewport || !frame || !grid) return null;

    const box = board.getBoundingClientRect();
    return {
      board: { width: box.width, height: box.height, x: box.x, y: box.y },
      viewport: { width: viewport.clientWidth, height: viewport.clientHeight },
      frame: { width: frame.getBoundingClientRect().width },
      blockCount: document.querySelectorAll('[data-block-id]').length,
      boardDom: board.querySelectorAll('*').length,
      gridVisibility: getComputedStyle(grid).visibility,
      borderWidth: block ? getComputedStyle(block).borderTopWidth : null,
      shadow: block ? getComputedStyle(block).boxShadow : null,
      zoomed: board.dataset.zoomed,
      labels: board.dataset.labels,
      zoom: document.querySelector('[data-testid="zoom-level"]')?.textContent?.trim(),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      canvasCount: document.querySelectorAll('canvas').length,
      emptyState: Boolean(emptyNote),
      emptyText: emptyNote?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      counterText:
        document.querySelector('.counter-sticker')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    };
  });
}

async function clickFirstBlock(page) {
  const block = page.locator('[data-block-id]').first();
  if ((await block.count()) === 0) {
    await page.locator('.empty-wall-note').waitFor({ state: 'visible', timeout: 5000 });
    return false;
  }

  const box = await block.boundingBox();
  assert.ok(box, 'block has no bounding box');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const detail = page.getByTestId('selected-detail');
  await detail.waitFor({ state: 'visible', timeout: 5000 });
  assert.ok((await detail.innerText()).trim().length > 0, 'selected detail is empty');
  return true;
}

async function closeDetail(page) {
  await page.getByLabel('Tutup detail').click();
  await page.getByTestId('selected-detail').waitFor({ state: 'detached' });
}

async function waitForWallData(page) {
  await page.waitForFunction(
    () =>
      Boolean(
        document.querySelector('.empty-wall-state') || document.querySelector('[data-block-id]'),
      ),
    undefined,
    { timeout: 15000 },
  );
}

async function assertFitted(page, label) {
  await page.waitForFunction(
    () => {
      const board = document.querySelector('[data-testid="wall-board"]');
      const viewport = document.querySelector('[data-testid="board-scroll"]');
      if (!board || !viewport) return false;
      const box = board.getBoundingClientRect();
      return box.width <= viewport.clientWidth + 1 && box.height <= viewport.clientHeight + 1;
    },
    undefined,
    { timeout: 3000 },
  );
  const metrics = await boardMetrics(page);
  assert.ok(metrics, `${label}: board metrics missing`);
  assert.equal(metrics.canvasCount, 0, `${label}: canvas element found`);
  assert.ok(metrics.boardDom < 200, `${label}: board DOM too large (${metrics.boardDom})`);
  assert.ok(
    metrics.board.width <= metrics.viewport.width + 1 &&
      metrics.board.height <= metrics.viewport.height + 1,
    `${label}: board does not fit (${metrics.board.width}x${metrics.board.height} in ${metrics.viewport.width}x${metrics.viewport.height})`,
  );
  assert.ok(metrics.board.width > 0 && metrics.board.height > 0, `${label}: board has no size`);
  assert.equal(metrics.gridVisibility, 'visible', `${label}: grid should be visible`);
  assert.equal(metrics.overflow, 0, `${label}: horizontal document overflow`);

  if (metrics.blockCount > 0) {
    assert.equal(metrics.borderWidth, '2px', `${label}: block border should be 2px`);
    assert.match(metrics.shadow, /2px 2px 0px 0px/, `${label}: block shadow should be hard`);
    assert.equal(metrics.emptyState, false, `${label}: empty state should be hidden`);
  } else {
    assert.equal(metrics.emptyState, true, `${label}: empty state missing`);
    assert.match(metrics.emptyText, /Belum ada project/, `${label}: empty state text missing`);
    assert.match(metrics.counterText, /^0 \/ 10\.000 blok terisi/, `${label}: counter should be 0`);
  }

  return metrics;
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
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('wall-board').waitFor({ state: 'visible' });
    await waitForWallData(page);

    const desktop = await assertFitted(page, 'desktop');
    assert.ok(desktop.frame.width <= 1021 && desktop.frame.width > 900, `desktop frame width ${desktop.frame.width}`);
    assert.ok(
      desktop.board.x > 0 && desktop.board.x + desktop.board.width < 1440,
      'desktop board is not centred',
    );
    const desktopFit = desktop.zoom;

    const clickedDesktop = await clickFirstBlock(page);
    await page.screenshot({ path: `${OUT}/desktop-1440.png`, fullPage: true });
    if (clickedDesktop) await closeDetail(page);

    // Zoom until the grid and heavier block treatment turn on.
    for (let i = 0; i < 4; i++) await page.getByLabel('Perbesar').click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="wall-board"]')?.dataset.zoomed === 'true',
      undefined,
      { timeout: 3000 },
    );
    const zoomed = await boardMetrics(page);
    assert.ok(zoomed, 'zoomed metrics missing');
    assert.equal(zoomed.gridVisibility, 'visible', 'grid should be visible at >= 200%');
    if (zoomed.blockCount > 0) {
      assert.equal(zoomed.borderWidth, '2px', 'zoomed block border should be 2px');
      assert.match(zoomed.shadow, /2px 2px 0px 0px/, `unexpected zoomed shadow: ${zoomed.shadow}`);
    }
    assert.ok(zoomed.board.width > zoomed.viewport.width, 'zoomed board should be pannable');
    await page.screenshot({ path: `${OUT}/desktop-zoom.png`, fullPage: true });

    // One-finger/one-pointer pan must update the transform without scrolling.
    const beforePan = await page.getByTestId('wall-board').evaluate(el => el.style.transform);
    const viewportBox = await page.getByTestId('board-scroll').boundingBox();
    assert.ok(viewportBox, 'viewport box missing');
    await page.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      viewportBox.x + viewportBox.width / 2 - 80,
      viewportBox.y + viewportBox.height / 2 - 40,
      { steps: 5 },
    );
    await page.mouse.up();
    await page.waitForTimeout(80);
    const afterPan = await page.getByTestId('wall-board').evaluate(el => el.style.transform);
    assert.notEqual(beforePan, afterPan, 'pan did not move the board');

    // Reset returns to fit.
    await page.getByLabel('Reset tampilan').click();
    await page.waitForFunction(
      fit => document.querySelector('[data-testid="zoom-level"]')?.textContent?.trim() === fit,
      desktopFit,
      { timeout: 3000 },
    );
    await assertFitted(page, 'desktop reset');

    // Max zoom stays bounded at 400%.
    for (let i = 0; i < 10; i++) await page.getByLabel('Perbesar').click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="zoom-level"]')?.textContent?.trim() === '400%',
      undefined,
      { timeout: 3000 },
    );
    const maxZoom = await boardMetrics(page);
    assert.ok(maxZoom && Math.abs(maxZoom.board.width - 4000) <= 1, `max board width ${maxZoom?.board.width}`);
    await page.screenshot({ path: `${OUT}/desktop-zoom400.png`, fullPage: true });

    // Tablet: auto-fit keeps the whole board inside the viewport.
    await page.setViewportSize({ width: 768, height: 900 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('wall-board').waitFor({ state: 'visible' });
    await waitForWallData(page);
    const tablet = await assertFitted(page, 'tablet');
    assert.ok(tablet.board.width <= 768 - 16, `tablet board overflows: ${tablet.board.width}`);
    const clickedTablet = await clickFirstBlock(page);
    await page.screenshot({ path: `${OUT}/tablet-768.png`, fullPage: true });
    if (clickedTablet) await closeDetail(page);

    // Mobile: no horizontal document scroll, board still tappable.
    await page.setViewportSize({ width: 375, height: 800 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('wall-board').waitFor({ state: 'visible' });
    await waitForWallData(page);
    const mobile = await assertFitted(page, 'mobile');
    assert.ok(mobile.board.width <= 375 - 16, `mobile board overflows: ${mobile.board.width}`);
    const clickedMobile = await clickFirstBlock(page);
    await page.screenshot({ path: `${OUT}/mobile-375.png`, fullPage: true });
    if (clickedMobile) await closeDetail(page);

    // Required phone widths from the brief.
    for (const width of [360, 412]) {
      await page.setViewportSize({ width, height: 800 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByTestId('wall-board').waitFor({ state: 'visible' });
      await waitForWallData(page);
      const metrics = await assertFitted(page, `mobile-${width}`);
      assert.equal(metrics.overflow, 0, `mobile-${width}: horizontal overflow`);
    }

    assert.deepEqual(errors, [], `browser errors:\n${errors.join('\n')}`);
    console.log('E2E OK: corkboard wall fits, grid/zoom/pan work, empty state and counters are correct on desktop/tablet/mobile');
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
