'use client';

import PixelWallCanvas from '@/components/PixelWallCanvas';
import { DUMMY_BLOCKS, TOTAL_CELLS } from '@/lib/blocks';

export default function Home() {
  return (
    <main className="bg-paper text-ink">
      {/* Header */}
      <header className="px-4 py-4 sm:px-6 sm:py-5">
        <div className="mx-auto max-w-7xl">
          <h1 className="font-display title-rotated">
            VIBE PIXEL WALL
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            Papan buletin komunitas builder · 100×100 sel
          </p>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6">
        {/* One frame only: the cork frame hugs the fitted board. */}
        <div className="mx-auto w-fit max-w-full">
          <div className="cork-frame">
            <div
              data-testid="board-scroll"
              className="board-scroll relative z-[2] flex h-full w-full min-w-0 items-start justify-start overflow-auto"
            >
              <PixelWallCanvas />
            </div>
          </div>

          <div className="mt-3 flex items-center">
            <span className="tag-paper">
              <span className="font-bold text-accent">{DUMMY_BLOCKS.length}</span> /{' '}
              {TOTAL_CELLS.toLocaleString('id-ID')} blok terisi
            </span>
          </div>
        </div>
      </section>

      {/* Footer sits right after the content, not pushed to the viewport bottom. */}
      <footer className="border-t border-ink/20 bg-paper/50 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono-ui text-xs text-ink">
            Dibangun untuk komunitas vibe/vibe ·{' '}
            <a
              href="https://testnet.vibevibe.fun"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-accent"
            >
              testnet.vibevibe.fun
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
