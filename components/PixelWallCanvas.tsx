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

// Render satu sel dasar sebagai gambar (offscreen) agar drawing 10.000 sel murah
function buildTile(size: number): HTMLCanvasElement {
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext('2d')!;
  tctx.fillStyle = CANVAS_BG;
  tctx.fillRect(0, 0, size, size);
  tctx.strokeStyle = CANVAS_GRID;
  tctx.lineWidth = Math.max(1, size / 16);
  tctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  const pad = Math.max(1, size / 12);
  tctx.fillStyle = CANVAS_BG;
  tctx.fillRect(pad, pad, size - pad * 2, size - pad * 2);
  return tile;
}

export default function PixelWallCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tileRef = useRef<HTMLCanvasElement | null>(null);
  const [view, setView] = useState<View>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [hover, setHover] = useState<DummyBlock | null>(null);
  const [selected, setSelected] = useState<DummyBlock | null>(null);

  const baseCell = 6; // px per sel di scale=1 → 100 sel = 600px

  useEffect(() => {
    const cellPx = Math.max(2, Math.round(baseCell * view.scale));
    tileRef.current = buildTile(cellPx);
  }, [view.scale, baseCell]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d')!;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(wrap.clientWidth * dpr);
    const H = Math.round(wrap.clientHeight * dpr);
    canvas.width = W;
    canvas.height = H;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, W, H);

    ctx.scale(dpr, dpr);
    ctx.translate(view.offsetX, view.offsetY);
    ctx.scale(view.scale, view.scale);

    const cellPx = Math.max(2, Math.round(baseCell * view.scale));
    const fullW = GRID_SIZE * cellPx;

    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, fullW, fullW);

    const tile = tileRef.current;
    if (tile) {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          ctx.drawImage(tile, c * cellPx, r * cellPx, cellPx, cellPx);
        }
      }
    }

    for (const b of DUMMY_BLOCKS) {
      const x = b.cols[0] * cellPx;
      const y = b.rows[0] * cellPx;
      const w = (b.cols[1] - b.cols[0] + 1) * cellPx;
      const h = (b.rows[1] - b.rows[0] + 1) * cellPx;
      const isHot = hover?.id === b.id || selected?.id === b.id;
      ctx.fillStyle = b.color;
      ctx.globalAlpha = isHot ? 1 : 0.85;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      if (isHot) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1.5, cellPx / 5);
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      }
      // Tampilkan nama hanya saat sel cukup besar (zoom dekat) agar tidak berantakan
      const screenCell = cellPx * view.scale;
      if (screenCell > 22) {
        ctx.fillStyle = '#0f172a';
        ctx.font = `700 ${Math.max(10, cellPx * 0.7)}px 'Space Grotesk', sans-serif`;
        ctx.fillText(b.name, x + cellPx * 0.6, y + cellPx * 0.9);
      }
    }

    ctx.strokeStyle = CANVAS_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, fullW, fullW);
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
      const ns = Math.min(6, Math.max(0.4, v.scale * (dir === 1 ? 1.3 : 1 / 1.3)));
      return { ...v, scale: ns };
    });
  };
  const onReset = () => setView({ scale: 1, offsetX: 0, offsetY: 0 });

  return (
    <div className="relative flex h-full w-full flex-col gap-2">
      {/* Toolbar zoom */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ToolBtn onClick={() => onZoom(1)} label="Zoom +">+</ToolBtn>
          <ToolBtn onClick={() => onZoom(-1)} label="Zoom -">−</ToolBtn>
          <ToolBtn onClick={onReset} label="Reset view">⟲</ToolBtn>
          <span className="ml-2 rounded-md bg-vibe-surface/60 px-2 py-1 font-mono text-[11px] text-vibe-accent/80">
            {Math.round(view.scale * 100)}%
          </span>
        </div>
        {hover && (
          <div
            className="max-w-[60%] truncate rounded-md border px-3 py-1.5 font-mono text-xs"
            style={{ borderColor: hover.color, color: hover.color, background: '#0f172a99' }}
          >
            {hover.name} · @{hover.author} · {hover.rows[0]}:{hover.rows[1]}×{hover.cols[0]}-{hover.cols[1]}
          </div>
        )}
      </div>

      {/* Canvas area */}
      <div
        ref={wrapRef}
        className="relative flex-1 overflow-hidden rounded-xl border border-vibe-accent/20 bg-vibe-dark shadow-[0_0_40px_-10px_#22d3ee44]"
        onMouseMove={(e) => setHover(pickBlock(e.clientX, e.clientY, e.currentTarget))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const b = pickBlock(e.clientX, e.clientY, e.currentTarget);
          if (b) setSelected(b);
        }}
      >
        <canvas ref={canvasRef} className="h-full w-full cursor-crosshair" />
      </div>

      {selected && (
        <div
          className="absolute bottom-3 left-3 z-20 flex items-center gap-3 rounded-lg border bg-vibe-surface/90 px-4 py-3 backdrop-blur"
          style={{ borderColor: selected.color }}
        >
          <span className="h-3 w-3 rounded-full" style={{ background: selected.color }} />
          <div className="leading-tight">
            <div className="font-mono text-sm font-bold" style={{ color: selected.color }}>
              {selected.name}
            </div>
            <div className="text-[11px] text-slate-400">by {selected.author}</div>
          </div>
          <a
            href={selected.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md px-3 py-1.5 text-xs font-bold transition hover:brightness-125"
            style={{ background: selected.color, color: '#0f172a' }}
          >
            Open ↗
          </a>
          <button
            onClick={() => setSelected(null)}
            className="text-slate-400 hover:text-white"
            aria-label="Tutup detail"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-vibe-accent/30 bg-vibe-surface/70 font-mono text-base font-bold text-vibe-accent transition hover:bg-vibe-accent hover:text-vibe-dark active:scale-95"
    >
      {children}
    </button>
  );
}
