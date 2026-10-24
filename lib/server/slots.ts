import 'server-only';

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GRID_SIZE, type PublicSlot } from '@/lib/blocks';

export const SLOT_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type SlotStatus = (typeof SLOT_STATUSES)[number];

export interface AdminSlot extends PublicSlot {
  wallet: string | null;
  status: SlotStatus;
  created_at: string;
}

export interface SlotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const ALLOWED_SLOT_SIZES = new Set(['3x3', '5x5', '10x10']);
export const MAX_LOGO_BYTES = 200 * 1024;
export const MAX_SUBMISSIONS_PER_HOUR = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export function isSlotStatus(value: string): value is SlotStatus {
  return (SLOT_STATUSES as readonly string[]).includes(value);
}

export function isAllowedSize(w: number, h: number): boolean {
  return ALLOWED_SLOT_SIZES.has(`${w}x${h}`);
}

export function isInsideGrid(x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= GRID_SIZE && y + h <= GRID_SIZE;
}

export function rectanglesOverlap(a: SlotRect, b: SlotRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function getIpHash(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip =
    forwarded?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown';

  return createHash('sha256').update(ip).digest('hex');
}

export async function isRateLimited(
  supabase: SupabaseClient,
  ipHash: string,
): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from('slot_submission_events')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since);

  if (error) throw error;
  return (count ?? 0) >= MAX_SUBMISSIONS_PER_HOUR;
}

export async function recordSubmission(
  supabase: SupabaseClient,
  ipHash: string,
): Promise<void> {
  const { error } = await supabase
    .from('slot_submission_events')
    .insert({ ip_hash: ipHash });

  if (error) throw error;
}

export function detectLogoType(
  bytes: Uint8Array,
): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  const png =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (png) return 'image/png';

  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (jpeg) return 'image/jpeg';

  const webp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (webp) return 'image/webp';

  return null;
}
