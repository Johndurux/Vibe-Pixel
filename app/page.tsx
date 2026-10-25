'use client';

import PixelWall from '@/components/PixelWall';
import { TOTAL_CELLS } from '@/lib/blocks';
import { useWallBlocks } from '@/lib/useWallBlocks';

export default function Home() {
  const { blocks, loading } = useWallBlocks();
  const filledCells = blocks.reduce((total, block) => total + block.w * block.h, 0);
  const filledPercent = Math.min(100, (filledCells / TOTAL_CELLS) * 100);
  const hasApprovedSlots = blocks.length > 0;

  return (
    <main className="bg-paper text-ink">
      {/* Header */}
      <header className="px-4 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <h1 className="font-display title-rotated relative">
              VIBE PIXEL WALL
              <span className="tape tape-title-left" aria-hidden="true" />
              <span className="tape tape-title-right" aria-hidden="true" />
            </h1>
            <span className="testnet-sticker">TESTNET</span>
          </div>
          <p className="mt-3 max-w-xl text-base font-semibold text-ink">
            Tempel karyamu di papan pixel komunitas.
          </p>
          <p className="mt-1 max-w-xl text-sm text-ink/60">
            Papan buletin builder · 100×100 sel · satu blok, satu cerita.
          </p>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6">
        {/* Keep the old 1020px frame footprint; the frame now hugs the wall. */}
        <div className="mx-auto w-full max-w-[1020px]">
          <div className="cork-frame">
            <span className="pushpin pushpin-tl" aria-hidden="true" />
            <span className="pushpin pushpin-tr" aria-hidden="true" />
            <span className="pushpin pushpin-bl" aria-hidden="true" />
            <span className="pushpin pushpin-br" aria-hidden="true" />

            <div className="board-scroll relative z-[2] flex w-full min-w-0 items-stretch justify-start overflow-hidden">
              <PixelWall blocks={blocks} />

              {!loading && !hasApprovedSlots ? (
                <div className="empty-wall-state" aria-hidden="true">
                  <div className="empty-wall-note">
                    Belum ada project. Jadilah yang pertama nempel!
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex justify-center sm:justify-start">
            <div
              className="counter-sticker"
              aria-label={`${filledCells} dari ${TOTAL_CELLS} blok terisi`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <span>
                  <span className="counter-value">{filledCells.toLocaleString('id-ID')}</span>{' '}
                  / {TOTAL_CELLS.toLocaleString('id-ID')} blok terisi
                </span>
                <span className="text-ink/60">{Math.round(filledPercent)}%</span>
              </div>
              <div className="counter-progress" aria-hidden="true">
                <div
                  className="counter-progress-fill"
                  style={{ width: `${filledPercent}%` }}
                />
              </div>
            </div>
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
              rel="noopener noreferrer nofollow"
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
