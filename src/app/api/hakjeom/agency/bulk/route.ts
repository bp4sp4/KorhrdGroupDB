import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const { user: _user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { rows } = await req.json();
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'rows required' }, { status: 400 });

  const insertData = rows.map((r: Record<string, unknown>) => ({
    category: r.category || null,
    region: r.region || null,
    institution_name: r.institution_name || null,
    contact: r.contact || null,
    credit_commission: r.credit_commission || null,
    private_commission: r.private_commission || null,
    manager: r.manager || null,
    memo: r.memo || null,
    status: r.status || '협약대기',
  })).filter(r => r.institution_name);

  if (insertData.length === 0)
    return NextResponse.json({ error: '기관명이 있는 행이 없습니다.' }, { status: 400 });

  const { error } = await supabaseAdmin.from('agency_agreements').insert(insertData);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: insertData.length }, { status: 201 });
}
