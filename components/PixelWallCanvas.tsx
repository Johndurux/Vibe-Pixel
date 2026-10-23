'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  DUMMY_BLOCKS,
  GRID_SIZE,
  CANVAS_BG,
  CANVAS_GRID,
  CANVAS_BORDER,
  type DummyBlock,
} from '@/lib/blocks';

interface View {
  scale: number;
  offsetX: number;
  offsetY: number;
}

// Two full-size canvases (static + overlay) are expensive. Cap the backing
// store so a 3000px board never allocates a 6000x6000 (or larger) bitmap.
const MAX_CANVAS_SIDE = 2048;
const MAX_ZOOM = 3;

function canvasDpr(boardPx: number) {
  return Math.min(window.devicePixelRatio || 1, 2, MAX_CANVAS_SIDE / boardPx);
}

// Measure the fit before the first paint on the client, without triggering
// React's server-rendering warning for useLayoutEffect.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Helper to create a tiled background pattern
function createPattern(ctx: CanvasRenderingContext2D, cellPx: number) {
  const tile = document.createElement('canvas');
  tile.width = cellPx;
  tile.height = cellPx;
  const tctx = tile.getContext('2d')!;
  tctx.fillStyle = CANVAS_BG;
  tctx.fillRect(0, 0, cellPx, cellPx);
  tctx.strokeStyle = CANVAS_GRID;
  tctx.lineWidth = 1;
  tctx.beginPath();
  tctx.moveTo(cellPx - 0.5, 0);
  tctx.lineTo(cellPx - 0.5, cellPx);
  tctx.stroke();
  tctx.beginPath();
  tctx.moveTo(0, cellPx - 0.5);
  tctx.lineTo(cellPx, cellPx - 0.5);
  tctx.stroke();
  const pattern = ctx.createPattern(tile, 'repeat')!;
  ctx.fillStyle = pattern;
}

// Draw a sticker block (same as original implementation)
function drawStickerBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  isHot: boolean,
  cellPx: number,
  name: string
) {
  const isTiny = cellPx < 6;
  const shadowOffset = isTiny ? 0 : Math.max(1, Math.round(cellPx * 0.2));
  const outlineWidth = isTiny ? 0 : Math.max(1, Math.round(cellPx * 0.16));

  // Shadow
  if (shadowOffset > 0) {
    ctx.fillStyle = '#16140F';
    ctx.fillRect(x + shadowOffset, y + shadowOffset, w, h);
  }

  // Body
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);

  // Outline
  if (outlineWidth > 0) {
    ctx.strokeStyle = '#16140F';
    ctx.lineWidth = outlineWidth;
    ctx.strokeRect(x + outlineWidth / 2, y + outlineWidth / 2, w - outlineWidth, h - outlineWidth);
  }

  if (isHot) {
    const hotWidth = Math.max(1, Math.round(cellPx * 0.08));
    const hotInset = Math.min(
      Math.round(outlineWidth + Math.max(1, cellPx * 0.1)),
      Math.floor((Math.min(w, h) - 1) / 2),
    );
    ctx.strokeStyle = '#FF5A36';
    ctx.lineWidth = hotWidth;
    ctx.strokeRect(
      x + hotInset,
      y + hotInset,
      Math.max(1, w - hotInset * 2),
      Math.max(1, h - hotInset * 2),
    );
  }

  const screenCell = cellPx;
  if (screenCell > 22) {
    ctx.fillStyle = '#16140F';
    ctx.font = `700 ${Math.max(9, Math.round(cellPx * 0.6))}px var(--font-anton), var(--font-archivo-black), sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x + cellPx * 0.6, y + h / 2);
  }
}

export default function PixelWallCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null); // pre‑rendered grid + blocks
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null); // hover / selection overlay
  const sizeRef = useRef<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<View>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [hover, setHover] = useState<DummyBlock | null>(null);
  const [selected, setSelected] = useState<DummyBlock | null>(null);
  const fitScaleRef = useRef(1);
  const userZoomedRef = useRef(false);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [fitted, setFitted] = useState(false);

  const baseCell = 10;
  const cellPx = Math.max(2, Math.round(baseCell * view.scale));
  const boardPx = GRID_SIZE * cellPx;
  const chromeWidth = Math.min(availableWidth || boardPx, boardPx);

  // Resize both canvases only when the snapped board size changes
  useEffect(() => {
    if (!fitted) return;
    const dpr = canvasDpr(boardPx);
    const newW = Math.round(boardPx * dpr);
    const newH = Math.round(boardPx * dpr);
    const prev = sizeRef.current;
    if (!prev || prev.w !== newW || prev.h !== newH) {
      [staticCanvasRef.current, overlayCanvasRef.current].forEach((c) => {
        if (c) {
          c.width = newW;
          c.height = newH;
        }
      });
      sizeRef.current = { w: newW, h: newH };
    }
  }, [boardPx, fitted]);

  // Fit the whole 100x100 board into the available width on first paint.
  // Snapping to a whole pixel per cell keeps grid lines and hit-testing aligned.
  // This runs before paint so the first canvas allocation is already the fitted
  // size (on mobile the initial 1000px board would otherwise allocate 2000x2000
  // bitmaps twice before being resized down to 300px).
  useIsomorphicLayoutEffect(() => {
    const wrap = wrapRef.current;
    const scroller = wrap?.parentElement?.parentElement;
    if (!wrap || !scroller) return;
    const computeFit = () => {
      const available = scroller.clientWidth;
      if (available < 50) return;
      setAvailableWidth(prev => (prev === available ? prev : available));
      const fitCell = Math.max(2, Math.min(10, Math.floor(available / GRID_SIZE)));
      const fit = fitCell / baseCell;
      fitScaleRef.current = fit;
      if (!userZoomedRef.current) {
        setView(v => (v.scale === fit ? v : { ...v, scale: fit, offsetX: 0, offsetY: 0 }));
      }
      setFitted(true);
    };
    computeFit();
    const ro = new ResizeObserver(computeFit);
    ro.observe(scroller);
    return () => ro.disconnect();
  }, [baseCell]);

  // Pre‑render static background + all blocks (no highlights)
  useEffect(() => {
    if (!fitted) return;
    const canvas = staticCanvasRef.current;
    if (!canvas) return;
    const dpr = canvasDpr(boardPx);
    const viewportW = boardPx;
    const viewportH = boardPx;

    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.translate(view.offsetX, view.offsetY);

    // Background pattern
    createPattern(ctx, cellPx);
    ctx.fillRect(0, 0, viewportW, viewportH);

    // Draw all blocks (culling)
    for (const b of DUMMY_BLOCKS) {
      const x = b.cols[0] * cellPx;
      const y = b.rows[0] * cellPx;
      const w = (b.cols[1] - b.cols[0] + 1) * cellPx;
      const h = (b.rows[1] - b.rows[0] + 1) * cellPx;
      if (x + w < 0 || y + h < 0 || x > viewportW || y > viewportH) continue;
      drawStickerBlock(ctx, x, y, w, h, b.color, false, cellPx, b.name);
    }

    // Outer border
    ctx.strokeStyle = CANVAS_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(0.5, 0.5, viewportW - 1, viewportH - 1);
  }, [view, cellPx, boardPx, fitted]);

  // Render overlay (hover & selected) on each change
  useEffect(() => {
    if (!fitted) return;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const dpr = canvasDpr(boardPx);
    const viewportW = boardPx;
    const viewportH = boardPx;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.translate(view.offsetX, view.offsetY);

    if (hover) {
      const x = hover.cols[0] * cellPx;
      const y = hover.rows[0] * cellPx;
      const w = (hover.cols[1] - hover.cols[0] + 1) * cellPx;
      const h = (hover.rows[1] - hover.rows[0] + 1) * cellPx;
      if (!(x + w < 0 || y + h < 0 || x > viewportW || y > viewportH)) {
        drawStickerBlock(ctx, x, y, w, h, hover.color, true, cellPx, hover.name);
      }
    }
    if (selected && (!hover || selected.id !== hover.id)) {
      const x = selected.cols[0] * cellPx;
      const y = selected.rows[0] * cellPx;
      const w = (selected.cols[1] - selected.cols[0] + 1) * cellPx;
      const h = (selected.rows[1] - selected.rows[0] + 1) * cellPx;
      if (!(x + w < 0 || y + h < 0 || x > viewportW || y > viewportH)) {
        drawStickerBlock(ctx, x, y, w, h, selected.color, true, cellPx, selected.name);
      }
    }
  }, [hover, selected, view, cellPx, boardPx, fitted]);

  // Hit testing
  const pickBlock = (clientX: number, clientY: number): DummyBlock | null => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - view.offsetX;
    const y = clientY - rect.top - view.offsetY;
    const col = Math.floor(x / cellPx);
    const row = Math.floor(y / cellPx);
    for (const b of DUMMY_BLOCKS) {
      if (row >= b.rows[0] && row <= b.rows[1] && col >= b.cols[0] && col <= b.cols[1]) {
        return b;
      }
    }
    return null;
  };

  const onZoom = (dir: 1 | -1) => {
    userZoomedRef.current = true;
    setView(v => {
      const ns = Math.min(MAX_ZOOM, Math.max(0.3, v.scale * (dir === 1 ? 1.4 : 1 / 1.4)));
      return ns === v.scale ? v : { ...v, scale: ns };
    });
  };
  const onReset = () => {
    userZoomedRef.current = false;
    const available = wrapRef.current?.parentElement?.parentElement?.clientWidth ?? 0;
    const fitCell = available >= 50
      ? Math.max(2, Math.min(10, Math.floor(available / GRID_SIZE)))
      : Math.round(fitScaleRef.current * baseCell);
    const fit = fitCell / baseCell;
    fitScaleRef.current = fit;
    setView({ scale: fit, offsetX: 0, offsetY: 0 });
  };

  return (
    <div className="mx-auto flex h-full flex-col gap-3" style={{ width: `${boardPx}px` }}>
      <div
        className="sticky left-0 z-10 flex items-center justify-between gap-3 flex-wrap"
        style={{ width: `${chromeWidth}px` }}
      >
        <div className="flex items-center gap-2">
          <button onClick={() => onZoom(1)} aria-label="Perbesar" className="btn-paper h-9 px-3 text-sm">+</button>
          <button onClick={() => onZoom(-1)} aria-label="Perkecil" className="btn-paper h-9 px-3 text-sm">−</button>
          <button onClick={onReset} aria-label="Reset tampilan" className="btn-paper h-9 px-3 text-sm">⟲</button>
          <span data-testid="zoom-level" className="font-mono-ui text-xs ml-2 text-ink/60">{Math.round(view.scale * 100)}%</span>
        </div>
        {hover && (
          <div className="tag-paper hidden sm:block" style={{ color: hover.color }}>
            {hover.name} · @{hover.author}
          </div>
        )}
      </div>
      <div
        ref={wrapRef}
        data-testid="wall-board"
        className="relative mx-auto"
        style={{
          background: CANVAS_BG,
          width: `${boardPx}px`,
          height: `${boardPx}px`,
        }}
        onMouseMove={e => setHover(pickBlock(e.clientX, e.clientY))}
        onMouseLeave={() => setHover(null)}
        onClick={e => {
          const b = pickBlock(e.clientX, e.clientY);
          if (b) setSelected(b);
        }}
      >
        <canvas
          ref={staticCanvasRef}
          className="absolute top-0 left-0"
          style={{
            width: `${boardPx}px`,
            height: `${boardPx}px`,
          }}
        />
        <canvas
          ref={overlayCanvasRef}
          className="absolute top-0 left-0 cursor-crosshair"
          style={{
            width: `${boardPx}px`,
            height: `${boardPx}px`,
          }}
        />
      </div>
      {selected && (
        <div data-testid="selected-detail" className="tag-paper sticky left-0 z-10 flex items-center gap-3" style={{ borderColor: '#16140F', width: `${chromeWidth}px` }}>
          <span className="shrink-0 h-4 w-4 rounded-sm border-2 border-ink" style={{ background: selected.color }} />
          <div className="min-w-0 leading-tight">
            <div className="truncate font-bold text-sm" style={{ color: selected.color }}>{selected.name}</div>
            <div className="truncate text-xs text-ink/60">by {selected.author}</div>
          </div>
          <a href={selected.url} target="_blank" rel="noopener noreferrer" className="btn-accent shrink-0 px-3 py-1 text-xs">Buka</a>
          <button onClick={() => setSelected(null)} aria-label="Tutup detail" className="shrink-0 text-ink/50 hover:text-accent font-bold text-lg leading-none">×</button>
        </div>
      )}
    </div>
  );
}
