import { unstable_cache } from 'next/cache';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  MAX_LOGO_BYTES,
  detectLogoType,
  getIpHash,
  isAllowedSize,
  isHexColor,
  isHttpsUrl,
  isInsideGrid,
  isRateLimited,
  rectanglesOverlap,
  recordSubmission,
  type SlotRect,
} from '@/lib/server/slots';
import type { PublicSlot } from '@/lib/blocks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PUBLIC_SLOT_FIELDS =
  'id,x,y,w,h,project_name,description,link,logo_url,color,contract_address';

const getApprovedSlots = unstable_cache(
  async (): Promise<PublicSlot[]> => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('slots')
      .select(PUBLIC_SLOT_FIELDS)
      .eq('status', 'approved')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as PublicSlot[];
  },
  ['approved-slots'],
  { revalidate: 30, tags: ['approved-slots'] },
);

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

function parseInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseOptionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export async function GET() {
  try {
    const slots = await getApprovedSlots();
    return NextResponse.json(
      { slots },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      },
    );
  } catch (error) {
    console.error('GET /api/slots failed', error);
    return NextResponse.json(
      { slots: [], error: 'Slots unavailable' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('Body must be multipart/form-data.', 400);
  }

  const x = parseInteger(formData.get('x'));
  const y = parseInteger(formData.get('y'));
  const w = parseInteger(formData.get('w'));
  const h = parseInteger(formData.get('h'));

  if (x === null || y === null || w === null || h === null) {
    return jsonError('x, y, w, and h must be integers.', 400);
  }
  if (!isAllowedSize(w, h)) {
    return jsonError('Slot size must be 3x3, 5x5, or 10x10.', 400);
  }
  if (!isInsideGrid(x, y, w, h)) {
    return jsonError('Slot must be inside the 100x100 grid.', 400);
  }

  const projectName = parseOptionalText(formData.get('project_name'));
  if (!projectName || projectName.length > 40) {
    return jsonError('project_name is required and must be 40 characters or fewer.', 400);
  }

  const description = parseOptionalText(formData.get('description'));
  if (description && description.length > 140) {
    return jsonError('description must be 140 characters or fewer.', 400);
  }

  const link = parseOptionalText(formData.get('link'));
  if (!link || !isHttpsUrl(link) || link.length > 300) {
    return jsonError('link must use https:// and be 300 characters or fewer.', 400);
  }

  const color = parseOptionalText(formData.get('color'));
  if (!color || !isHexColor(color)) {
    return jsonError('color must be a hex value in #RRGGBB format.', 400);
  }

  const contractAddress = parseOptionalText(formData.get('contract_address'));
  if (contractAddress && !/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
    return jsonError('contract_address must be 0x followed by 40 hex characters.', 400);
  }

  const wallet = parseOptionalText(formData.get('wallet'));
  if (wallet && !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return jsonError('wallet must be 0x followed by 40 hex characters.', 400);
  }

  const logo = formData.get('logo');
  if (!(logo instanceof File) || logo.size === 0) {
    return jsonError('logo is required.', 400);
  }
  if (logo.size > MAX_LOGO_BYTES) {
    return jsonError('logo must be 200KB or smaller.', 413);
  }

  const logoBytes = new Uint8Array(await logo.arrayBuffer());
  const logoType = detectLogoType(logoBytes);
  if (!logoType) {
    return jsonError('logo must be PNG, JPG, or WEBP.', 415);
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    console.error('POST /api/slots is missing Supabase env', error);
    return jsonError('Server is not configured.', 500);
  }

  const ipHash = getIpHash(request);
  try {
    if (await isRateLimited(supabase, ipHash)) {
      return NextResponse.json(
        { error: 'Too many submissions. Try again in 1 hour.' },
        {
          status: 429,
          headers: {
            'Retry-After': '3600',
            'Cache-Control': 'no-store',
          },
        },
      );
    }
  } catch (error) {
    console.error('POST /api/slots rate-limit check failed', error);
    return jsonError('Server is busy. Try again.', 500);
  }

  let logoPath: string | null = null;
  try {
    // Fast pre-check overlap (cheap, not authoritative)
    const { data: occupied, error: overlapError } = await supabase
      .from('slots')
      .select('x,y,w,h')
      .in('status', ['pending', 'approved']);

    if (overlapError) throw overlapError;

    const candidate: SlotRect = { x, y, w, h };
    const overlaps = ((occupied ?? []) as SlotRect[]).some((slot) =>
      rectanglesOverlap(candidate, slot),
    );

    if (overlaps) {
      return jsonError('That area is already taken. Pick another spot.', 409);
    }

    const extension =
      logoType === 'image/png' ? 'png' : logoType === 'image/jpeg' ? 'jpg' : 'webp';
    logoPath = `slots/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(logoPath, logoBytes, {
        contentType: logoType,
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(logoPath);
    const logoUrl = publicUrlData.publicUrl;

    const { data: inserted, error: insertError } = await supabase
      .from('slots')
      .insert({
        x,
        y,
        w,
        h,
        project_name: projectName,
        description,
        link,
        logo_url: logoUrl,
        color,
        contract_address: contractAddress,
        wallet,
        status: 'pending',
      })
      .select(PUBLIC_SLOT_FIELDS)
      .single();

    if (insertError) {
      // Clean up uploaded logo on any insert failure
      if (logoPath) {
        await supabase.storage.from('logos').remove([logoPath]);
      }
      // Handle exclusion violation (overlap) from DB constraint
      if (insertError.code === '23P01') {
        return jsonError('That area is already taken. Pick another spot.', 409);
      }
      throw insertError;
    }

    try {
      await recordSubmission(supabase, ipHash);
    } catch (error) {
      console.error('POST /api/slots failed to record rate-limit event', error);
    }

    return NextResponse.json(
      { slot: inserted },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('POST /api/slots failed', error);
    // Clean up logo if we uploaded but something else failed
    if (logoPath) {
      try {
        await supabase.storage.from('logos').remove([logoPath]);
      } catch (cleanupError) {
        console.error('Failed to cleanup logo after error', cleanupError);
      }
    }
    return jsonError('Failed to save submission.', 500);
  }
}