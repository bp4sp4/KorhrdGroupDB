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

  const nowKST = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T') + '+09:00'

  const insertData = rows.map((r: Record<string, unknown>) => {
    let created_at = nowKST;
    if (typeof r.created_at === 'string' && r.created_at.trim()) {
      const parsed = new Date(r.created_at.trim());
      if (!isNaN(parsed.getTime())) {
        created_at = parsed.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T') + '+09:00';
      }
    }
    return {
      name: r.name,
      contact: r.contact,
      course: r.course || null,
      status: r.status || '과정안내',
      manager: r.manager || null,
      click_source: r.click_source || null,
      memo: r.memo || null,
      created_at,
      is_draft: true,
    };
  });

  const { error } = await supabaseAdmin.from('cert_students').insert(insertData);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAction({ user_id: user.id, user_email: user.email, action: 'bulk_create', resource: '민간자격증 학생관리', detail: `${insertData.length}건 일괄 등록` });
  return NextResponse.json({ count: insertData.length }, { status: 201 });
}
