export const GRID_SIZE = 100;

// 1 blok = 1 sel grid. Total blok pada wall 100x100.
export const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

/** Slot publik yang dikirim GET /api/slots (tanpa wallet). */
export interface PublicSlot {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  project_name: string;
  description: string | null;
  link: string;
  logo_url: string | null;
  color: string;
  contract_address: string | null;
}

/** Bentuk seragam yang dipakai renderer untuk slot API. */
export interface WallBlock {
  id: string;
  name: string;
  description: string | null;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  link: string;
  logo_url: string | null;
  contract_address: string | null;
  author?: string;
}

export function slotToWallBlock(slot: PublicSlot): WallBlock {
  return {
    id: slot.id,
    name: slot.project_name,
    description: slot.description,
    color: slot.color,
    x: slot.x,
    y: slot.y,
    w: slot.w,
    h: slot.h,
    link: slot.link,
    logo_url: slot.logo_url,
    contract_address: slot.contract_address,
  };
}
