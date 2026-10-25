import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isAdminRequest } from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(request)) return jsonError('Unauthorized', 401);

  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return jsonError('Invalid slot id.', 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Body must be JSON.', 400);
  }

  const status =
    body && typeof body === 'object' ? (body as { status?: unknown }).status : undefined;

  if (status !== 'approved' && status !== 'rejected') {
    return jsonError('status must be approved or rejected.', 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('slots')
      .update({ status })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!data) return jsonError('Slot not found.', 404);

    // The public list is cached for 30s; make moderation changes show up now.
    revalidateTag('approved-slots', 'max');

    return NextResponse.json(
      { slot: data },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('PATCH /api/admin/slots/[id] failed', error);
    return jsonError('Failed to update slot.', 500);
  }
}
