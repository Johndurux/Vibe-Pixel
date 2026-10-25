import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isAdminRequest } from '@/lib/server/admin-auth';
import { isSlotStatus, type AdminSlot } from '@/lib/server/slots';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function unauthorized() {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'pending';

  if (!isSlotStatus(status)) {
    return NextResponse.json(
      { error: 'status must be pending, approved, or rejected.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('slots')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .returns<AdminSlot[]>();

    if (error) throw error;

    return NextResponse.json(
      { slots: data ?? [] },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('GET /api/admin/slots failed', error);
    return NextResponse.json(
      { error: 'Failed to load slots.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
