'use client';

import PixelWallCanvas from '@/components/PixelWallCanvas';
import { DUMMY_BLOCKS, FILLED_CELLS, TOTAL_CELLS } from '@/lib/blocks';

export default function Home() {
  return (
    <main className="flex min-h-[100dvh] flex-col bg-ink text-slate-200">
      <header className="vibe-safe-top z-30 border-b border-hairline bg-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <h1 className="truncate font-display text-lg text-white sm:text-2xl">
            VIBE <span className="text-accent">PIXEL WALL</span>
          </h1>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-3 py-3 sm:px-6">
        <div className="relative min-h-[48dvh] flex-1 sm:min-h-[62dvh]">
          <PixelWallCanvas />
        </div>
      </section>

      <footer className="vibe-safe-bottom z-10 border-t border-hairline bg-ink/30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 font-mono text-[11px] sm:px-6">
          <span className="text-dim">
            <span className="text-accent">{DUMMY_BLOCKS.length}</span> /{' '}
            {TOTAL_CELLS.toLocaleString('id-ID')} blok terisi
          </span>
          <span className="hidden text-dim/70 sm:inline">
            {FILLED_CELLS.toLocaleString('id-ID')} sel aktif dari {TOTAL_CELLS.toLocaleString('id-ID')}
          </span>
        </div>
      </footer>
    </main>
  );
}
