'use client';

import { useState } from 'react';
import ClaimSheet from '@/components/ClaimSheet';
import PixelWall from '@/components/PixelWall';
import { TOTAL_CELLS } from '@/lib/blocks';
import {
  clampPosition,
  createInitialClaim,
  fieldForApiError,
  rectsOverlap,
  validateClaim,
  type CellPosition,
  type ClaimFieldErrors,
  type ClaimState,
} from '@/lib/claim';
import { OFFICIAL_LINKS } from '@/lib/links';
import { useWallBlocks } from '@/lib/useWallBlocks';

export default function Home() {
  const { blocks, loading } = useWallBlocks();
  const [claim, setClaim] = useState<ClaimState>(() => createInitialClaim());
  const filledCells = blocks.reduce((total, block) => total + block.w * block.h, 0);
  const filledPercent = Math.min(100, (filledCells / TOTAL_CELLS) * 100);
  const hasApprovedSlots = blocks.length > 0;

  const claimRect =
    claim.size && claim.position
      ? {
          x: claim.position.x,
          y: claim.position.y,
          w: claim.size,
          h: claim.size,
        }
      : null;
  const positionBlocked = claimRect
    ? blocks.some((block) => rectsOverlap(claimRect, block))
    : false;
  const claimGhost =
    claim.open && claim.step === 'position' && claimRect
      ? {
          ...claimRect,
          status: positionBlocked ? ('blocked' as const) : ('free' as const),
        }
      : null;

  const openClaim = () => setClaim({ ...createInitialClaim(), open: true });
  const closeClaim = () => setClaim(createInitialClaim());

  const handlePlace = (cell: CellPosition) => {
    if (!claim.size) return;
    const position = clampPosition(cell.x, cell.y, claim.size);
    setClaim((current) => ({
      ...current,
      position,
      fieldErrors: { ...current.fieldErrors, position: undefined },
    }));
  };

  const handleSubmit = async () => {
    if (claim.submitting) return;

    if (claim.honeypot.trim()) {
      setClaim({ ...createInitialClaim(), open: true, step: 'success' });
      return;
    }

    const errors = validateClaim(claim);
    if (Object.keys(errors).length > 0) {
      setClaim((current) => ({
        ...current,
        fieldErrors: errors,
        generalError: null,
        retryable: false,
      }));
      return;
    }

    if (!claim.size || !claim.position || !claim.logoFile) return;

    const formData = new FormData();
    formData.append('x', String(claim.position.x));
    formData.append('y', String(claim.position.y));
    formData.append('w', String(claim.size));
    formData.append('h', String(claim.size));
    formData.append('project_name', claim.projectName.trim());
    formData.append('description', claim.description.trim());
    formData.append('link', claim.link.trim());
    formData.append('color', claim.color);
    formData.append('contract_address', claim.contractAddress.trim());
    formData.append('logo', claim.logoFile, claim.logoFile.name);

    setClaim((current) => ({
      ...current,
      submitting: true,
      fieldErrors: {},
      generalError: null,
      retryable: false,
    }));

    try {
      const response = await fetch('/api/slots', {
        method: 'POST',
        body: formData,
        headers: { accept: 'application/json' },
      });
      const payload: unknown = await response.json().catch(() => null);

      if (response.ok) {
        setClaim({ ...createInitialClaim(), open: true, step: 'success' });
        return;
      }

      const message =
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof (payload as { error?: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : 'Something went wrong. Please try again.';

      if (response.status === 409) {
        setClaim((current) => ({
          ...current,
          submitting: false,
          step: 'position',
          position: null,
          fieldErrors: { position: 'That spot was just taken, pick another.' },
          generalError: null,
          retryable: false,
        }));
        return;
      }

      if (response.status === 429) {
        setClaim((current) => ({
          ...current,
          submitting: false,
          generalError: 'Too many submissions. Try again later.',
          retryable: false,
        }));
        return;
      }

      if (response.status === 400 || response.status === 413 || response.status === 415) {
        const field = fieldForApiError(message);
        setClaim((current) => {
          const fieldErrors: ClaimFieldErrors = field ? { [field]: message } : {};
          return {
            ...current,
            submitting: false,
            fieldErrors,
            generalError: field ? null : message,
            retryable: false,
          };
        });
        return;
      }

      setClaim((current) => ({
        ...current,
        submitting: false,
        generalError: 'Something went wrong. Please try again.',
        retryable: true,
      }));
    } catch {
      setClaim((current) => ({
        ...current,
        submitting: false,
        generalError: 'Network error. Check your connection and try again.',
        retryable: true,
      }));
    }
  };

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
            Pin your project to the vibe/vibe wall.
          </p>
          <p className="mt-1 max-w-xl text-sm text-ink/75">
            Community builder bulletin board · 100×100 cells · one block, one story.
          </p>
        </div>
      </header>

      {/* Claim CTA stays in flow so it never covers the board or its gestures. */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-4 sm:px-6">
        <div className="mx-auto w-full max-w-[1020px]">
          <button
            type="button"
            onClick={() => {
              if (!claim.open) openClaim();
            }}
            aria-disabled={claim.open}
            aria-haspopup="dialog"
            aria-expanded={claim.open}
            className="btn-sticker claim-cta"
          >
            Claim a slot
          </button>
          <p className="mt-2 max-w-md font-mono-ui text-xs text-ink/75">
            Free during testnet. Submissions are reviewed before they appear.
          </p>
        </div>
      </div>

      <section className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6">
        {/* Keep the old 1020px frame footprint; the frame now hugs the wall. */}
        <div className="mx-auto w-full max-w-[1020px]">
          <div className="cork-frame">
            <span className="pushpin pushpin-tl" aria-hidden="true" />
            <span className="pushpin pushpin-tr" aria-hidden="true" />
            <span className="pushpin pushpin-bl" aria-hidden="true" />
            <span className="pushpin pushpin-br" aria-hidden="true" />

            <div className="board-scroll relative z-[2] flex w-full min-w-0 items-stretch justify-start overflow-hidden">
              <PixelWall
                blocks={blocks}
                placing={claim.open && claim.step === 'position'}
                onPlace={handlePlace}
                ghost={claimGhost}
              />

              {!loading && !hasApprovedSlots ? (
                <div className="empty-wall-state" aria-hidden="true">
                  <div className="empty-wall-note">
                    No projects yet. Be the first to pin yours!
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-col items-center gap-3 sm:items-start">
            <div
              className="counter-sticker"
              aria-label={`${filledCells.toLocaleString('en-US')} of ${TOTAL_CELLS.toLocaleString('en-US')} blocks filled`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <span>
                  <span className="counter-value">{filledCells.toLocaleString('en-US')}</span>{' '}
                  / {TOTAL_CELLS.toLocaleString('en-US')} blocks filled
                </span>
                <span className="text-ink/75">{Math.round(filledPercent)}%</span>
              </div>
              <div className="counter-progress" aria-hidden="true">
                <div
                  className="counter-progress-fill"
                  style={{ width: `${filledPercent}%` }}
                />
              </div>
            </div>
            <a
              href={OFFICIAL_LINKS.app}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open vibe/vibe testnet in a new tab"
              className="btn-paper btn-secondary"
            >
              Open vibe/vibe testnet
            </a>
          </div>
        </div>
      </section>

      {/* Footer sits right after the content, not pushed to the viewport bottom. */}
      <footer className="border-t border-ink/20 bg-paper/50 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono-ui text-xs text-ink">
            Built for the vibe/vibe community ·{' '}
            <a
              href={OFFICIAL_LINKS.app}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open vibe/vibe testnet in a new tab"
              className="underline hover:text-accent"
            >
              testnet.vibevibe.fun
            </a>
          </p>
          <nav aria-label="Official vibe/vibe links" className="mt-3 flex flex-wrap gap-2">
            <a
              href={OFFICIAL_LINKS.x}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open vibe/vibe on X in a new tab"
              className="link-sticker"
            >
              X
            </a>
            <a
              href={OFFICIAL_LINKS.discord}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Join the vibe/vibe Discord in a new tab"
              className="link-sticker"
            >
              Discord
            </a>
            <a
              href={OFFICIAL_LINKS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Join the vibe/vibe Telegram in a new tab"
              className="link-sticker"
            >
              Telegram
            </a>
            <a
              href={OFFICIAL_LINKS.website}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open the vibe/vibe website in a new tab"
              className="link-sticker"
            >
              Website
            </a>
          </nav>
          <p className="mt-3 font-mono-ui text-xs text-ink/75">
            Community project. Not affiliated with vibe/vibe.
          </p>
        </div>
      </footer>

      {claim.open ? (
        <ClaimSheet
          claim={claim}
          setClaim={setClaim}
          positionBlocked={positionBlocked}
          onClose={closeClaim}
          onSubmit={handleSubmit}
        />
      ) : null}
    </main>
  );
}
