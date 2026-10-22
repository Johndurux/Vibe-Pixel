'use client';

import { useEffect, useRef, useState } from 'react';
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

// Render grid tile (offscreen) for performance
function buildTile(size: number): HTMLCanvasElement {
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext('2d')!;
  tctx.fillStyle = CANVAS_BG;
  tctx.fillRect(0, 0, size, size);
  tctx.strokeStyle = CANVAS_GRID;
  tctx.lineWidth = 1;
  tctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  return tile;
}

// Draw a sticker block with thick black outline and hard shadow
function drawStickerBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  isHot: boolean,
  cellPx: number,
  viewScale: number,
  name: string
) {
  const shadowOffset = Math.max(2, Math.round(3 * viewScale));
  const outlineWidth = Math.max(2, Math.round(3 * viewScale));

  // Hard drop shadow (ink color)
  ctx.fillStyle = '#16140F';
  ctx.fillRect(x + shadowOffset, y + shadowOffset, w, h);

  // Sticker body
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);

  // Thick black outline
  ctx.strokeStyle = '#16140F';
  ctx.lineWidth = outlineWidth;
  ctx.strokeRect(x + outlineWidth / 2, y + outlineWidth / 2, w - outlineWidth, h - outlineWidth);

  // Highlight on hover/select - accent border inside
  if (isHot) {
    ctx.strokeStyle = '#FF5A36';
    ctx.lineWidth = Math.max(1, Math.round(2 * viewScale));
    ctx.strokeRect(x + outlineWidth + 1, y + outlineWidth + 1, w - outlineWidth * 2 - 2, h - outlineWidth * 2 - 2);
  }

  // Label when zoomed in enough
  const screenCell = cellPx * viewScale;
  if (screenCell > 22) {
    ctx.fillStyle = '#16140F';
    ctx.font = `700 ${Math.max(9, Math.round(cellPx * 0.6))}px var(--font-anton), var(--font-archivo-black), sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x + cellPx * 0.6, y + h / 2);
  }
}

export default function PixelWallCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [hover, setHover] = useState<DummyBlock | null>(null);
  const [selected, setSelected] = useState<DummyBlock | null>(null);

  const baseCell = 10; // 10px per cell at scale=1

  // Pre‑render static grid (background + thin lines) into an off‑screen canvas.
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cellPx = Math.max(2, Math.round(baseCell * view.scale));
    const fullW = GRID_SIZE * cellPx;
    const off = document.createElement('canvas');
    off.width = fullW;
    off.height = fullW;
    const ctx = off.getContext('2d')!;
    // Fill paper background
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, fullW, fullW);
    // Draw grid lines
    ctx.strokeStyle = CANVAS_GRID;
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      const p = i * cellPx;
      ctx.beginPath();
      ctx.moveTo(p + 0.5, 0);
      ctx.lineTo(p + 0.5, fullW);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p + 0.5);
      ctx.lineTo(fullW, p + 0.5);
      ctx.stroke();
    }
    gridCanvasRef.current = off;
  }, [view.scale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d')!;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cellPx = Math.max(2, Math.round(baseCell * view.scale));
    const fullW = GRID_SIZE * cellPx;

    // Canvas size = full grid size (not viewport) so entire grid is drawn
    const canvasW = Math.round(fullW * dpr);
    const canvasH = Math.round(fullW * dpr);
    canvas.width = canvasW;
    canvas.height = canvasH;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.translate(view.offsetX, view.offsetY);
    ctx.scale(view.scale, view.scale);

    // Draw pre‑rendered static grid
    const grid = gridCanvasRef.current;
    if (grid) {
      ctx.drawImage(grid, 0, 0, fullW, fullW);
    }

    // Draw blocks as stickers
    for (const b of DUMMY_BLOCKS) {
      const x = b.cols[0] * cellPx;
      const y = b.rows[0] * cellPx;
      const w = (b.cols[1] - b.cols[0] + 1) * cellPx;
      const h = (b.rows[1] - b.rows[0] + 1) * cellPx;
      const isHot = hover?.id === b.id || selected?.id === b.id;
      drawStickerBlock(ctx, x, y, w, h, b.color, isHot, cellPx, view.scale, b.name);
    }

    // Outer grid border
    ctx.strokeStyle = CANVAS_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, fullW - 2, fullW - 2);
  }, [view, baseCell, hover, selected]);

  const pickBlock = (clientX: number, clientY: number, target: Element): DummyBlock | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cellPx = Math.max(2, Math.round(baseCell * view.scale));
    const x = (clientX - rect.left - view.offsetX) / view.scale;
    const y = (clientY - rect.top - view.offsetY) / view.scale;
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
    setView((v) => {
      const ns = Math.min(5, Math.max(0.3, v.scale * (dir === 1 ? 1.4 : 1 / 1.4)));
      return { ...v, scale: ns };
    });
  };
  const onReset = () => setView({ scale: 1, offsetX: 0, offsetY: 0 });

  return (
    <div className="flex h-full w-full flex-col gap-3">
      {/* Toolbar - paper buttons */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onZoom(1)}
            aria-label="Perbesar"
            className="btn-paper h-9 px-3 text-sm"
          >
            +
          </button>
          <button
            onClick={() => onZoom(-1)}
            aria-label="Perkecil"
            className="btn-paper h-9 px-3 text-sm"
          >
            −
          </button>
          <button
            onClick={onReset}
            aria-label="Reset tampilan"
            className="btn-paper h-9 px-3 text-sm"
          >
            ⟲
          </button>
          <span className="font-mono-ui text-xs ml-2 text-ink/60">
            {Math.round(view.scale * 100)}%
          </span>
        </div>
        {hover && (
          <div className="tag-paper" style={{ color: hover.color }}>
            {hover.name} · @{hover.author}
          </div>
        )}
      </div>

      {/* Canvas area */}
      <div
        ref={wrapRef}
        className="relative"
        style={{
          background: CANVAS_BG,
          width: `${GRID_SIZE * baseCell * view.scale}px`,
          height: `${GRID_SIZE * baseCell * view.scale}px`,
        }}
        onMouseMove={(e) => setHover(pickBlock(e.clientX, e.clientY, e.currentTarget))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const b = pickBlock(e.clientX, e.clientY, e.currentTarget);
          if (b) setSelected(b);
        }}
      >
        <canvas
          ref={canvasRef}
          className="cursor-crosshair"
          style={{
            width: `${GRID_SIZE * baseCell * view.scale}px`,
            height: `${GRID_SIZE * baseCell * view.scale}px`,
          }}
        />
      </div>

      {/* Selected block detail - paper tag style */}
      {selected && (
        <div className="tag-paper flex items-center gap-3" style={{ borderColor: '#16140F' }}>
          <span
            className="shrink-0 h-4 w-4 rounded-sm border-2 border-ink"
            style={{ background: selected.color }}
          />
          <div className="min-w-0 leading-tight">
            <div className="truncate font-bold text-sm" style={{ color: selected.color }}>
              {selected.name}
            </div>
            <div className="truncate text-xs text-ink/60">by {selected.author}</div>
          </div>
          <a
            href={selected.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-accent shrink-0 px-3 py-1 text-xs"
          >
            Buka
          </a>
          <button
            onClick={() => setSelected(null)}
            aria-label="Tutup detail"
            className="shrink-0 text-ink/50 hover:text-accent font-bold text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
