import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const PORT = Number(process.env.E2E_PORT || 4310);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = 'screenshots';
const CLAIM_LOGO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl9sAAAAASUVORK5CYII=',
  'base64',
);

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
  await page.getByLabel('Close details').click();
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
    assert.match(metrics.emptyText, /No projects yet/, `${label}: empty state text missing`);
    assert.match(metrics.counterText, /^0 \/ 10,000 blocks filled/, `${label}: counter should be 0`);
  }

  return metrics;
}

async function runClaimFlow(browser, errors) {
  const mockSlot = {
    id: 'vibe-runner',
    x: 45,
    y: 47,
    w: 5,
    h: 5,
    project_name: 'Vibe Runner',
    description: null,
    link: 'https://vrunner.vercel.app',
    logo_url: null,
    color: '#FFD23F',
    contract_address: null,
  };
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('status of 409')) {
      errors.push(`claim console: ${msg.text()}`);
    }
  });
  page.on('pageerror', err => errors.push(`claim pageerror: ${err.message}`));

  let postCount = 0;
  let postedBody = '';
  let postedUrl = '';
  const postedBodies = [];
  await page.route('**/api/slots', async route => {
    const request = route.request();
    if (request.method() === 'POST') {
      postCount += 1;
      postedUrl = request.url();
      const buffer = request.postDataBuffer();
      postedBody = buffer ? buffer.toString('utf8') : '';
      postedBodies.push(postedBody);
      if (postCount === 1) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'That area is already taken. Pick another spot.' }),
        });
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          slot: {
            ...mockSlot,
            id: 'new-slot',
            x: 40,
            y: 40,
            project_name: 'Vibe Test',
            description: 'A test project',
            link: 'https://example.com',
            color: '#FFD23F',
            contract_address: `0x${'a'.repeat(40)}`,
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ slots: [mockSlot] }),
    });
  });

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('wall-board').waitFor({ state: 'visible' });
    await page.waitForFunction(
      () => Boolean(document.querySelector('[data-block-id="vibe-runner"]')),
      undefined,
      { timeout: 15000 },
    );

    const cta = page.getByRole('button', { name: 'Claim a slot' });
    await cta.click();
    const sheet = page.getByTestId('claim-sheet');
    await sheet.waitFor({ state: 'visible' });
    assert.match(await sheet.innerText(), /Pick your size/);
    assert.equal(await page.getByRole('button', { name: 'Next' }).isDisabled(), true);
    await page.waitForTimeout(20);

    assert.equal(
      await page.evaluate(
        () => document.activeElement?.closest('[data-testid="claim-sheet"]') !== null,
      ),
      true,
      'claim sheet did not receive focus',
    );
    await page.keyboard.press('Escape');
    await sheet.waitFor({ state: 'detached' });
    assert.equal(
      await cta.evaluate(el => document.activeElement === el),
      true,
      'focus was not restored to the claim CTA',
    );

    await cta.click();
    await sheet.waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'M 5x5 (50px)' }).click();
    assert.equal(await page.getByRole('button', { name: 'Next' }).isDisabled(), false);
    await page.getByRole('button', { name: 'Next' }).click();

    const bar = page.getByTestId('claim-position-bar');
    await bar.waitFor({ state: 'visible' });
    assert.equal(await page.getByTestId('claim-ghost').count(), 0, 'ghost should start hidden');
    assert.equal(
      await page.getByRole('button', { name: 'Confirm position' }).isDisabled(),
      true,
      'confirm should start disabled',
    );

    const block = page.locator('[data-block-id="vibe-runner"]');
    const blockBox = await block.boundingBox();
    assert.ok(blockBox, 'Vibe Runner block missing');
    await page.mouse.click(blockBox.x + blockBox.width / 2, blockBox.y + blockBox.height / 2);

    const ghost = page.getByTestId('claim-ghost');
    await ghost.waitFor({ state: 'visible' });
    assert.equal(
      await ghost.getAttribute('data-status'),
      'blocked',
      'overlap at Vibe Runner was not detected',
    );
    assert.equal(
      await page.getByRole('button', { name: 'Confirm position' }).isDisabled(),
      true,
      'confirm should be disabled on an overlap',
    );
    assert.match(await bar.innerText(), /That spot is taken/);

    const ghostBeforeMove = await ghost.evaluate(
      el => `${el.style.left}|${el.style.top}|${el.dataset.status}`,
    );
    const boardBox = await page.getByTestId('wall-board').boundingBox();
    assert.ok(boardBox, 'board box missing');
    await page.mouse.move(boardBox.x + boardBox.width * 0.2, boardBox.y + boardBox.height * 0.2);
    await page.mouse.move(
      boardBox.x + boardBox.width * 0.8,
      boardBox.y + boardBox.height * 0.8,
      { steps: 4 },
    );
    const ghostAfterMove = await ghost.evaluate(
      el => `${el.style.left}|${el.style.top}|${el.dataset.status}`,
    );
    assert.equal(ghostAfterMove, ghostBeforeMove, 'ghost changed during pointermove');

    // Zoom/pan stay available while placing; the next tap must still map to a cell.
    await page.getByLabel('Zoom in').click();
    await page.waitForFunction(
      () => document.querySelector('[data-testid="zoom-level"]')?.textContent?.trim() !== '100%',
      undefined,
      { timeout: 3000 },
    );
    const viewportBox = await page.getByTestId('board-scroll').boundingBox();
    assert.ok(viewportBox, 'viewport box missing while placing');
    await page.mouse.move(
      viewportBox.x + viewportBox.width / 2,
      viewportBox.y + viewportBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      viewportBox.x + viewportBox.width / 2 - 80,
      viewportBox.y + viewportBox.height / 2 - 40,
      { steps: 5 },
    );
    await page.mouse.up();
    await page.waitForTimeout(80);
    const ghostAfterPan = await ghost.evaluate(
      el => `${el.style.left}|${el.style.top}|${el.dataset.status}`,
    );
    assert.equal(ghostAfterPan, ghostBeforeMove, 'ghost changed during pan');

    const zoomedBoardBox = await page.getByTestId('wall-board').boundingBox();
    assert.ok(zoomedBoardBox, 'zoomed board box missing');
    await page.mouse.click(
      zoomedBoardBox.x + zoomedBoardBox.width * 0.305,
      zoomedBoardBox.y + zoomedBoardBox.height * 0.305,
    );
    await page.waitForFunction(() => {
      const element = document.querySelector('[data-testid="claim-ghost"]');
      return element?.getAttribute('data-status') === 'free';
    });
    assert.equal(
      await page.getByRole('button', { name: 'Confirm position' }).isDisabled(),
      false,
      'confirm should be enabled on a free spot',
    );
    assert.match(await bar.innerText(), /30,\s*30/);
    await page.getByRole('button', { name: 'Confirm position' }).click();

    const details = page.getByTestId('claim-sheet');
    await details.waitFor({ state: 'visible' });
    assert.match(await details.innerText(), /Project details/);
    assert.match(await details.innerText(), /5x5 at 30, 30/);
    const pageDom = await page.evaluate(() => document.querySelectorAll('*').length);
    assert.ok(pageDom < 250, `claim page DOM too large (${pageDom})`);

    await page.getByLabel('Project name').fill('Vibe Test');
    await page.getByLabel(/Description/).fill('A test project');
    const linkInput = page.getByLabel('Project link');
    await linkInput.fill('example.com');
    await page.getByText('Project link must start with https://.').waitFor({ state: 'visible' });
    await linkInput.fill('https://example.com');

    const logoInput = page.getByLabel('Upload project logo');
    await logoInput.setInputFiles({
      name: 'logo.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });
    await page.getByText('Logo must be PNG, JPG, or WEBP.').waitFor({ state: 'visible' });
    await logoInput.setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: CLAIM_LOGO_PNG,
    });
    await page.getByAltText('Selected logo preview').waitFor({ state: 'visible' });

    const contractInput = page.getByLabel(/Contract address/);
    await contractInput.fill('0x123');
    await page.getByText('Use 0x followed by 40 hex characters.').waitFor({ state: 'visible' });
    const contract = `0x${'a'.repeat(40)}`;
    await contractInput.fill(contract);

    assert.equal(
      await page
        .getByRole('button', { name: /Use Yellow \(#FFD23F\)/ })
        .getAttribute('aria-pressed'),
      'true',
      'default slot color should be yellow',
    );

    const honeypot = page.locator('input[name="website"]');
    assert.equal(await honeypot.count(), 1, 'honeypot field missing');
    assert.equal(await honeypot.getAttribute('tabindex'), '-1');
    assert.equal(await honeypot.getAttribute('aria-hidden'), 'true');

    await page.getByRole('button', { name: 'Submit' }).click();
    await page.getByText('That spot was just taken, pick another.').waitFor({ state: 'visible' });
    assert.equal(postCount, 1, 'expected the first mocked POST');
    assert.match(await bar.innerText(), /That spot was just taken, pick another/);
    assert.equal(
      await page.getByRole('button', { name: 'Confirm position' }).isDisabled(),
      true,
      'confirm should be disabled after a 409',
    );
    assert.match(postedBodies[0], /name="x"\r?\n\r?\n30/, 'first POST x should be 30');
    assert.match(postedBodies[0], /name="y"\r?\n\r?\n30/, 'first POST y should be 30');

    const retryBoardBox = await page.getByTestId('wall-board').boundingBox();
    assert.ok(retryBoardBox, 'board box missing after 409');
    await page.mouse.click(
      retryBoardBox.x + retryBoardBox.width * 0.405,
      retryBoardBox.y + retryBoardBox.height * 0.405,
    );
    await page.waitForFunction(() => {
      const element = document.querySelector('[data-testid="claim-ghost"]');
      return element?.getAttribute('data-status') === 'free';
    });
    await page.getByRole('button', { name: 'Confirm position' }).click();
    await details.waitFor({ state: 'visible' });
    assert.match(await details.innerText(), /5x5 at 40, 40/);
    assert.equal(await page.getByLabel('Project name').inputValue(), 'Vibe Test');
    assert.equal(await page.getByLabel('Project link').inputValue(), 'https://example.com');
    assert.equal(await page.getByLabel(/Contract address/).inputValue(), contract);
    await page.getByAltText('Selected logo preview').waitFor({ state: 'visible' });

    await page.getByRole('button', { name: 'Submit' }).click();
    await page.getByText('Submitted! Your slot is pending review.').waitFor({ state: 'visible' });
    await page.waitForTimeout(220);
    await page.screenshot({ path: `${OUT}/claim-success.png`, fullPage: true });
    assert.equal(postCount, 2, 'expected the 409 retry POST to succeed');
    assert.ok(postedUrl.startsWith(`${BASE}/api/slots`), `unexpected POST URL ${postedUrl}`);
    for (const field of [
      'x',
      'y',
      'w',
      'h',
      'project_name',
      'description',
      'link',
      'color',
      'contract_address',
      'logo',
    ]) {
      assert.ok(postedBody.includes(`name="${field}"`), `POST body missing ${field}`);
    }
    assert.ok(postedBody.includes('Vibe Test'), 'POST body missing project name');
    assert.ok(postedBody.includes('https://example.com'), 'POST body missing link');
    assert.ok(postedBody.includes('#FFD23F'), 'POST body missing color');
    assert.ok(postedBody.includes(contract), 'POST body missing contract');
    assert.ok(postedBody.includes('filename="logo.png"'), 'POST body missing logo file');
    assert.match(postedBody, /name="x"\r?\n\r?\n40/, 'retry POST x should be 40');
    assert.match(postedBody, /name="y"\r?\n\r?\n40/, 'retry POST y should be 40');

    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await sheet.waitFor({ state: 'detached' });
    await cta.waitFor({ state: 'visible' });
    assert.equal(
      await cta.getAttribute('aria-disabled'),
      'false',
      'CTA should re-enable after closing',
    );

    // Honeypot submissions must fake success without sending a request.
    await cta.click();
    await sheet.waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'M 5x5 (50px)' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await bar.waitFor({ state: 'visible' });
    const freshBoardBox = await page.getByTestId('wall-board').boundingBox();
    assert.ok(freshBoardBox, 'board box missing for honeypot flow');
    await page.mouse.click(
      freshBoardBox.x + freshBoardBox.width * 0.205,
      freshBoardBox.y + freshBoardBox.height * 0.205,
    );
    await page.getByRole('button', { name: 'Confirm position' }).click();
    await sheet.waitFor({ state: 'visible' });
    await honeypot.evaluate(el => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(el, 'https://spam.example');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.getByText('Submitted! Your slot is pending review.').waitFor({ state: 'visible' });
    assert.equal(postCount, 2, 'honeypot must not send a POST');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await sheet.waitFor({ state: 'detached' });

    // Mobile-first check: the sheet, bar, and form must not create horizontal scroll.
    for (const width of [360, 412]) {
      await page.setViewportSize({ width, height: 800 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByTestId('wall-board').waitFor({ state: 'visible' });
      await page.waitForFunction(
        () => Boolean(document.querySelector('[data-block-id="vibe-runner"]')),
        undefined,
        { timeout: 15000 },
      );

      await cta.click();
      await sheet.waitFor({ state: 'visible' });
      await page.waitForTimeout(220);
      let overflow = await page.evaluate(() => {
        const sheetElement = document.querySelector('[data-testid="claim-sheet"]');
        const body = sheetElement?.querySelector('.claim-sheet-body');
        return {
          page: document.documentElement.scrollWidth - window.innerWidth,
          body: body ? body.scrollWidth - body.clientWidth : 0,
        };
      });
      assert.equal(overflow.page, 0, `claim size ${width}: page overflow`);
      assert.equal(overflow.body, 0, `claim size ${width}: sheet body overflow`);
      await page.screenshot({ path: `${OUT}/claim-${width}-size.png`, fullPage: false });

      await page.getByRole('button', { name: 'M 5x5 (50px)' }).click();
      await page.getByRole('button', { name: 'Next' }).click();
      await bar.waitFor({ state: 'visible' });
      await page.waitForTimeout(220);
      overflow = await page.evaluate(() => {
        const barElement = document.querySelector('[data-testid="claim-position-bar"]');
        return {
          page: document.documentElement.scrollWidth - window.innerWidth,
          bar: barElement ? barElement.scrollWidth - barElement.clientWidth : 0,
        };
      });
      assert.equal(overflow.page, 0, `claim position ${width}: page overflow`);
      assert.equal(overflow.bar, 0, `claim position ${width}: bar overflow`);
      await page.screenshot({ path: `${OUT}/claim-${width}-position.png`, fullPage: false });

      const mobileBoardBox = await page.getByTestId('wall-board').boundingBox();
      assert.ok(mobileBoardBox, `claim ${width}: board box missing`);
      await page.mouse.click(
        mobileBoardBox.x + mobileBoardBox.width * 0.205,
        mobileBoardBox.y + mobileBoardBox.height * 0.205,
      );
      await page.getByRole('button', { name: 'Confirm position' }).click();
      await sheet.waitFor({ state: 'visible' });
      overflow = await page.evaluate(() => {
        const sheetElement = document.querySelector('[data-testid="claim-sheet"]');
        const body = sheetElement?.querySelector('.claim-sheet-body');
        return {
          page: document.documentElement.scrollWidth - window.innerWidth,
          body: body ? body.scrollWidth - body.clientWidth : 0,
        };
      });
      assert.equal(overflow.page, 0, `claim details ${width}: page overflow`);
      assert.equal(overflow.body, 0, `claim details ${width}: sheet body overflow`);
      await page.waitForTimeout(220);
      await page.screenshot({ path: `${OUT}/claim-${width}-details.png`, fullPage: false });
      await page.getByLabel('Close claim form').click();
      await sheet.waitFor({ state: 'detached' });
    }
  } finally {
    await page.close();
  }
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
    for (let i = 0; i < 4; i++) await page.getByLabel('Zoom in').click();
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
    await page.getByLabel('Reset view').click();
    await page.waitForFunction(
      fit => document.querySelector('[data-testid="zoom-level"]')?.textContent?.trim() === fit,
      desktopFit,
      { timeout: 3000 },
    );
    await assertFitted(page, 'desktop reset');

    // Max zoom stays bounded at 400%.
    for (let i = 0; i < 10; i++) await page.getByLabel('Zoom in').click();
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

    await runClaimFlow(browser, errors);

    assert.deepEqual(errors, [], `browser errors:\n${errors.join('\n')}`);
    console.log('E2E OK: wall, zoom/pan, claim flow, overlap, ghost-on-tap, DOM budget, and POST payload');
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
