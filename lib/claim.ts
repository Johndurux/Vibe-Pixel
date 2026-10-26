import { GRID_SIZE } from '@/lib/blocks';

export type ClaimStep = 'size' | 'position' | 'details' | 'success';
export type ClaimSize = 3 | 5 | 10;

export interface CellPosition {
  x: number;
  y: number;
}

export interface ClaimFieldErrors {
  projectName?: string;
  description?: string;
  link?: string;
  logo?: string;
  color?: string;
  contractAddress?: string;
  position?: string;
}

export interface ClaimState {
  open: boolean;
  step: ClaimStep;
  size: ClaimSize | null;
  position: CellPosition | null;
  projectName: string;
  description: string;
  link: string;
  color: string;
  contractAddress: string;
  logoFile: File | null;
  honeypot: string;
  submitting: boolean;
  fieldErrors: ClaimFieldErrors;
  generalError: string | null;
  retryable: boolean;
}

export const DEFAULT_SLOT_COLOR = '#FFD23F';

export const SLOT_COLORS = [
  '#FFD23F',
  '#FF5A36',
  '#C9A876',
  '#A68B5E',
  '#F2EADF',
  '#16140F',
] as const;

export const SLOT_SIZES: Array<{
  value: ClaimSize;
  label: string;
  cells: string;
  pixels: string;
  preview: number;
}> = [
  { value: 10, label: 'L', cells: '10x10', pixels: '100px', preview: 100 },
  { value: 5, label: 'M', cells: '5x5', pixels: '50px', preview: 50 },
  { value: 3, label: 'S', cells: '3x3', pixels: '30px', preview: 30 },
];

export const MAX_LOGO_BYTES = 200 * 1024;
export const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export function createInitialClaim(): ClaimState {
  return {
    open: false,
    step: 'size',
    size: 10,
    position: null,
    projectName: '',
    description: '',
    link: '',
    color: DEFAULT_SLOT_COLOR,
    contractAddress: '',
    logoFile: null,
    honeypot: '',
    submitting: false,
    fieldErrors: {},
    generalError: null,
    retryable: false,
  };
}

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

export function isContractAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

export function isAllowedLogoType(type: string): boolean {
  return (ALLOWED_LOGO_TYPES as readonly string[]).includes(type);
}

export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function clampPosition(x: number, y: number, size: ClaimSize): CellPosition {
  const max = GRID_SIZE - size;
  return {
    x: Math.min(Math.max(0, x), max),
    y: Math.min(Math.max(0, y), max),
  };
}

export function validateClaim(claim: ClaimState): ClaimFieldErrors {
  const errors: ClaimFieldErrors = {};
  const projectName = claim.projectName.trim();
  const link = claim.link.trim();
  const contractAddress = claim.contractAddress.trim();

  if (!projectName) {
    errors.projectName = 'Project name is required.';
  } else if (projectName.length > 40) {
    errors.projectName = 'Project name must be 40 characters or fewer.';
  }

  if (claim.description.length > 140) {
    errors.description = 'Description must be 140 characters or fewer.';
  }

  if (!link) {
    errors.link = 'Project link is required.';
  } else if (!isHttpsUrl(link)) {
    errors.link = 'Project link must start with https://.';
  }

  if (!claim.logoFile) {
    errors.logo = 'Logo is required.';
  } else if (!isAllowedLogoType(claim.logoFile.type)) {
    errors.logo = 'Logo must be PNG, JPG, or WEBP.';
  } else if (claim.logoFile.size > MAX_LOGO_BYTES) {
    errors.logo = 'Logo must be 200KB or smaller.';
  }

  if (!claim.color) {
    errors.color = 'Pick a slot color.';
  }

  if (contractAddress && !isContractAddress(contractAddress)) {
    errors.contractAddress = 'Use 0x followed by 40 hex characters.';
  }

  if (!claim.size || !claim.position) {
    errors.position = 'Pick a position on the board.';
  }

  return errors;
}

export function fieldForApiError(message: string): keyof ClaimFieldErrors | null {
  const text = message.toLowerCase();
  if (text.includes('project_name')) return 'projectName';
  if (text.includes('description')) return 'description';
  if (text.includes('link')) return 'link';
  if (text.includes('color')) return 'color';
  if (text.includes('contract_address')) return 'contractAddress';
  if (text.includes('logo')) return 'logo';
  if (
    text.includes('slot size') ||
    text.includes('inside the 100x100 grid') ||
    text.includes('x, y, w, and h')
  ) {
    return 'position';
  }
  return null;
}
