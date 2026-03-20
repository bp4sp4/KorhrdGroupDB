import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logAction } from '@/lib/audit/logAction';

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { rows } = await req.json();
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'rows required' }, { status: 400 });

  const isValidDate = (v: unknown) => v && typeof v === 'string' && !isNaN(new Date(v).getTime());

  const insertData = rows.map((r: Record<string, unknown>) => ({
    name: r.name,
    contact: r.contact,
    major_category: r.major_category || null,
    hope_course: r.hope_course || null,
    click_source: r.click_source || null,
    reason: r.reason || null,
    memo: r.memo || null,
    status: r.status || '상담대기',
    manager: r.manager || null,
    residence: r.residence || null,
    counsel_check: r.counsel_check || null,
    subject_cost: r.subject_cost || null,
    ...(isValidDate(r.applied_at) ? { created_at: r.applied_at } : {}),
  }));

  const { error } = await supabaseAdmin.from('private_cert_consultations').insert(insertData);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAction({ user_id: user.id, user_email: user.email, action: 'bulk_create', resource: '민간자격증 상담', detail: `${insertData.length}건 일괄 등록` });
  return NextResponse.json({ count: insertData.length }, { status: 201 });
}
