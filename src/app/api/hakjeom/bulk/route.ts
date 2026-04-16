import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logAction } from '@/lib/audit/logAction';

// 신청일시(applied_at) → KST 타임스탬프 변환
// 허용 형식: "2026-03-01", "2026-03-01 2:23", "2026-03-01 10:30", "2026-03-01T10:30:00" 등
function parseAppliedAtToKst(v: unknown): string | null {
  if (!v || typeof v !== 'string') return null
  const s = v.trim()
  if (!s) return null
  const pad = (x: string) => x.padStart(2, '0')
  // 날짜만
  const dOnly = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (dOnly) {
    const [, y, mo, d] = dOnly
    return `${y}-${pad(mo)}-${pad(d)}T00:00:00+09:00`
  }
  // 날짜 + 시간 (한 자리/두 자리 모두 허용)
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/)
  if (m) {
    const [, y, mo, d, hh, mm, ss] = m
    return `${y}-${pad(mo)}-${pad(d)}T${pad(hh)}:${pad(mm)}:${pad(ss ?? '00')}+09:00`
  }
  return null
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { rows } = await req.json();
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: 'rows required' }, { status: 400 });

  // 현재 한국시간(KST) - applied_at이 없을 때 폴백
  const nowKST = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T') + '+09:00'

  const insertData = rows.map((r: Record<string, unknown>) => ({
    name: r.name,
    contact: r.contact,
    education: r.education || null,
    hope_course: r.hope_course || null,
    click_source: r.click_source || null,
    reason: r.reason || null,
    memo: r.memo || null,
    status: r.status || '상담대기',
    manager: r.manager || null,
    residence: r.residence || null,
    counsel_check: r.counsel_check || null,
    subject_cost: r.subject_cost ?? null,
    // 신청일시가 있으면 created_at으로 사용, 없으면 현재 KST
    created_at: parseAppliedAtToKst(r.applied_at) ?? nowKST,
  }));

  const { error } = await supabaseAdmin.from('hakjeom_consultations').insert(insertData);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAction({ user_id: user.id, user_email: user.email, action: 'bulk_create', resource: '학점은행제 상담', detail: `${insertData.length}건 일괄 등록` });
  return NextResponse.json({ count: insertData.length }, { status: 201 });
}
