import { NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

const MGMT_DEPT_CODE = 'MGT' // 경영지원본부

// 영업 손익관리 / 예상손익계산서 접근 가드 — 관리자(master-admin/admin)는 항상 허용,
//  · 권한관리에서 profit 권한이 명시적으로 부여된 경우
//  · 매출목표 관리 권한자(본부장/팀장/경영지원본부)도 허용 (영업손익·매출목표·예상손익 합본)
// opts.excludeLeader=true → 팀장(팀 leader)은 제외 (예상손익계산서 보기 권한용)
export async function requireProfitAccess(opts: { excludeLeader?: boolean } = {}) {
  const result = await requireAuthFull()
  if (result.errorResponse) return result
  const { role, id, department_id } = result.appUser
  let allowed = role === 'master-admin' || role === 'admin'
  if (!allowed) {
    const { data } = await supabaseAdmin
      .from('user_permissions')
      .select('scope')
      .eq('user_id', id)
      .eq('section', 'profit')
      .maybeSingle()
    allowed = !!data?.scope && data.scope !== 'none'
  }
  if (!allowed) {
    // 본부장(부서 head) / 팀장(팀 leader) / 경영지원본부(부서코드 MGT)
    const { data: headDepts } = await supabaseAdmin
      .from('departments')
      .select('id')
      .eq('head_user_id', id)
      .eq('is_active', true)
      .limit(1)
    let leaderOk = false
    if (!opts.excludeLeader) {
      const { data: ledTeams } = await supabaseAdmin
        .from('teams')
        .select('id')
        .eq('leader_user_id', id)
        .limit(1)
      leaderOk = (ledTeams?.length ?? 0) > 0
    }
    allowed = (headDepts?.length ?? 0) > 0 || leaderOk
    if (!allowed && department_id) {
      const { data: dept } = await supabaseAdmin
        .from('departments')
        .select('code')
        .eq('id', department_id)
        .maybeSingle()
      allowed = dept?.code === MGMT_DEPT_CODE
    }
  }
  if (!allowed) {
    return {
      user: null,
      appUser: null,
      errorResponse: NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 },
      ),
    }
  }
  return result
}
