import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const TABLE = 'csv_staging';

export async function GET() {
  const { user: _user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse
  const { data, error } = await supabaseAdmin
    .from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const { user: _user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse
  const { rows } = await req.json();
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'rows required' }, { status: 400 });
  const { error } = await supabaseAdmin.from(TABLE).insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: rows.length }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { user: _user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse
  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: 'ids required' }, { status: 400 });
  const { error } = await supabaseAdmin.from(TABLE).delete().in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
