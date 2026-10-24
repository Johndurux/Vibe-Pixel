'use client';

import { useEffect, useState } from 'react';
import {
  FALLBACK_BLOCKS,
  slotToWallBlock,
  type PublicSlot,
  type WallBlock,
} from '@/lib/blocks';

function isPublicSlot(value: unknown): value is PublicSlot {
  if (!value || typeof value !== 'object') return false;
  const slot = value as Record<string, unknown>;

  return (
    typeof slot.id === 'string' &&
    typeof slot.x === 'number' &&
    typeof slot.y === 'number' &&
    typeof slot.w === 'number' &&
    typeof slot.h === 'number' &&
    typeof slot.project_name === 'string' &&
    (slot.description === null || typeof slot.description === 'string') &&
    typeof slot.link === 'string' &&
    (slot.logo_url === null || typeof slot.logo_url === 'string') &&
    typeof slot.color === 'string' &&
    (slot.contract_address === null || typeof slot.contract_address === 'string')
  );
}

function getSlots(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray((payload as { slots?: unknown }).slots)) {
    return (payload as { slots: unknown[] }).slots;
  }
  return [];
}

export function useWallBlocks(): WallBlock[] {
  const [blocks, setBlocks] = useState<WallBlock[]>(FALLBACK_BLOCKS);

  useEffect(() => {
    // Local/demo builds without Supabase simply keep the bundled fallback.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;

    const controller = new AbortController();
    let active = true;

    async function load() {
      try {
        const response = await fetch('/api/slots', {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        });

        // Always consume the body so failed requests do not leave a pending
        // browser network stream (important for network-idle tooling).
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) return;

        const slots = getSlots(payload).filter(isPublicSlot).map(slotToWallBlock);

        // Empty/error responses intentionally keep the bundled dummy fallback.
        if (active && slots.length > 0) setBlocks(slots);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // Do not break the wall when the API is not configured yet.
        console.warn('Using fallback wall blocks:', error);
      }
    }

    load();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return blocks;
}
