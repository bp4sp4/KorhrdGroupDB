import { requireAuthFull } from '@/lib/auth/requireAuth'
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logAction } from '@/lib/audit/logAction';

// POST /api/hakjeom/migrate-jiin
// 등록완료 상태인 지인소개 레코드의 click_source를 기타로 일괄 변경 (1회성 마이그레이션)
export async function POST() {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { data: records, error: fetchError } = await supabaseAdmin
    .from('hakjeom_consultations')
    .select('id, name, click_source')
    .eq('status', '등록완료')
    .like('click_source', '지인소개%');

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
  }

  if (!records || records.length === 0) {
    return NextResponse.json({ message: '변경 대상 없음', updated: 0 });
  }

  const ids = records.map(r => r.id);
  const { error: updateError } = await supabaseAdmin
    .from('hakjeom_consultations')
    .update({ click_source: '기타' })
    .in('id', ids);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update records' }, { status: 500 });
  }

  await logAction({
    user_id: appUser.id,
    action: 'update',
    resource: '학점은행제 상담',
    resource_id: ids.join(','),
    detail: `마이그레이션: 등록완료+지인소개 ${ids.length}건 → 기타`,
    meta: { ids, names: records.map(r => r.name) },
  });

  return NextResponse.json({ message: '마이그레이션 완료', updated: ids.length, ids });
}
