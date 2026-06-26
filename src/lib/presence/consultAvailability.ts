import { supabaseAdmin } from '@/lib/supabase/admin'

// 영업 상담 가능/불가 상태 — app_settings key = presence.consult_available.{uid}, value = { available }
const consultKey = (uid: number) => `presence.consult_available.${uid}`

// 영업팀 소속 여부 (팀명에 '영업' 포함) — consult-availability 로스터 기준과 동일
async function isSalesMember(userId: number): Promise<boolean> {
  const { data: user } = await supabaseAdmin
    .from('app_users')
    .select('team_id')
    .eq('id', userId)
    .maybeSingle()
  const teamId = user?.team_id as string | null | undefined
  if (!teamId) return false
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('name')
    .eq('id', teamId)
    .maybeSingle()
  return ((team?.name as string) ?? '').includes('영업')
}

// 출퇴근 → 영업 상담 가능/불가 자동 동기화 (영업팀원만).
// 동기화 실패가 출퇴근 처리 자체를 막지 않도록 예외는 삼킨다.
export async function syncConsultAvailability(
  userId: number,
  available: boolean,
): Promise<void> {
  try {
    if (!(await isSalesMember(userId))) return
    await supabaseAdmin.from('app_settings').upsert(
      {
        key: consultKey(userId),
        value: { available },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )
  } catch {
    // 무시
  }
}
