'use client';

import PixelWallCanvas from '@/components/PixelWallCanvas';
import { DUMMY_BLOCKS, TOTAL_CELLS } from '@/lib/blocks';

export default function Home() {
  return (
    <main className="min-h-[100dvh] flex flex-col bg-paper text-ink">
      {/* Header */}
      <header className="px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto max-w-7xl">
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl title-rotated">
            VIBE PIXEL WALL
          </h1>
          <p className="font-mono-ui text-xs sm:text-sm mt-1 text-ink/60">
            Papan buletin komunitas builder vibe/vibe · 100×100 sel · Showcase builder ekosistem vibe/vibe
          </p>
        </div>
      </header>

      
      <section className="mx-auto flex-1 w-full max-w-7xl px-4 pb-8 sm:px-6 sm:pb-12">
        <div className="cork-frame-border">
          {/* Corkboard frame with texture */}
          <div className="cork-frame p-3 sm:p-8 w-full min-h-[420px] sm:min-h-[640px]">
            {/* Paper inner area */}
            <div className="paper-inner overflow-hidden relative w-full h-full">
              {/* Canvas wrapper - horizontal scroll when zoomed */}
              <div data-testid="board-scroll" className="relative overflow-auto h-full flex items-start justify-start pb-4 w-full min-w-0">
                <PixelWallCanvas />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer with paper-tag stats */}
      <footer className="px-4 py-4 sm:px-6 border-t border-ink/20 bg-paper/50">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tag-paper">
              <span className="font-bold text-accent">{DUMMY_BLOCKS.length}</span> / {TOTAL_CELLS.toLocaleString('id-ID')} blok terisi
            </span>
          </div>
          <p className="font-mono-ui text-xs text-ink/50 text-right sm:text-left">
            Dibangun untuk komunitas vibe/vibe · <a href="https://testnet.vibevibe.fun" target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">testnet.vibevibe.fun</a>
          </p>
        </div>
      </footer>
    </main>
  );
}
