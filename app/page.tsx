'use client';

import { useState } from 'react';
import PixelWallCanvas from '@/components/PixelWallCanvas';
import { DUMMY_BLOCKS, FILLED_CELLS, TOTAL_CELLS } from '@/lib/blocks';

export default function Home() {
  const [legendOpen, setLegendOpen] = useState(false);

  const kindColors = [
    { k: 'neon', c: '#22d3ee', label: 'Neon' },
    { k: 'vapor', c: '#a855f7', label: 'Vapor' },
    { k: 'terminal', c: '#4ade80', label: 'Terminal' },
    { k: 'synth', c: '#c084fc', label: 'Synth' },
    { k: 'cyber', c: '#facc15', label: 'Cyber' },
  ];

  return (
    <main className="flex min-h-[100dvh] flex-col bg-vibe-dark text-slate-200">
      {/* Header */}
      <header className="vibe-safe-top z-30 border-b border-vibe-accent/20 bg-vibe-surface/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl"
              style={{ backgroundImage: 'linear-gradient(90deg,#22d3ee,#a855f7)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>
              VIBE&nbsp;PIXEL&nbsp;WALL
            </h1>
            <p className="mt-0.5 hidden text-[11px] text-slate-400 sm:block">
              Papan pixel kolektif — klaim, catat, dan tampilkan karyamu
            </p>
          </div>
          <button
            onClick={() => setLegendOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-vibe-accent/30 bg-vibe-accent/10 px-3 py-2 font-mono text-xs font-bold text-vibe-accent transition hover:bg-vibe-accent hover:text-vibe-dark active:scale-95"
          >
            <span>◧</span> {legendOpen ? 'Tutup' : 'Legenda'}
          </button>
        </div>
      </header>

      {/* Legenda (opsional, di atas canvas) */}
      {legendOpen && (
        <div className="z-20 border-b border-vibe-secondary/20 bg-vibe-surface/30">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            {kindColors.map((kk) => (
              <span key={kk.k} className="flex items-center gap-2 rounded-md border bg-vibe-dark/60 px-2.5 py-1 font-mono text-[11px]"
                style={{ borderColor: kk.c, color: kk.c }}>
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: kk.c }} />
                {kk.label}
              </span>
            ))}
            <span className="ml-auto text-[11px] text-slate-500">
              {DUMMY_BLOCKS.length} block · 100×100
            </span>
          </div>
        </div>
      )}

      {/* Canvas utama — fill sisa ruang, mobile-safe */}
      <section className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-3 py-3 sm:px-6">
        <div className="relative min-h-[48dvh] flex-1 sm:min-h-[62dvh]">
          <PixelWallCanvas />
        </div>
      </section>

      {/* Footer — statistik user, bukan metadata debug */}
      <footer className="vibe-safe-bottom z-10 border-t border-vibe-accent/10 bg-vibe-surface/30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 font-mono text-[11px] sm:px-6">
          <span className="text-slate-400">
            <span className="text-vibe-accent">{DUMMY_BLOCKS.length}</span> /{' '}
            {TOTAL_CELLS.toLocaleString('id-ID')} blok terisi
          </span>
          <span className="hidden text-slate-500 sm:inline">
            {FILLED_CELLS.toLocaleString('id-ID')} sel aktif dari {TOTAL_CELLS.toLocaleString('id-ID')}
          </span>
        </div>
      </footer>
    </main>
  );
}
