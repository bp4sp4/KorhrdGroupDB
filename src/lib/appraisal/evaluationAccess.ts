import { supabaseAdmin } from '@/lib/supabase/admin'

// 인사고과 평가 권한 (규정 제6조)
//   팀 역량평가  : 사업본부장(departments.head_user_id)이 본부 내 팀별 작성
//   개인 역량평가: 팀원 → 소속 팀의 팀장(teams.leader_user_id) / 팀장 → 사업본부장
//   master-admin 은 전체 작성 가능 (운영 보정용)
//   본부장/팀장은 어드민 사업부·팀 탭에서 명시 지정한다 (직책 추론 안 함).

export interface TeamTarget {
  teamId: string
  teamName: string
}

export interface PersonalTarget {
  userId: number
  name: string
  teamId: string | null
  teamName: string | null
  isLeader: boolean
}

export interface EvaluationTargets {
  isMaster: boolean
  isHead: boolean
  isLeader: boolean
  teamTargets: TeamTarget[]
  personalTargets: PersonalTarget[]
}

interface AppUserLike {
  id: number
  role: string
  position_id?: string | null
  department_id?: string | null
}

export async function getEvaluationTargets(
  appUser: AppUserLike,
): Promise<EvaluationTargets> {
  const isMaster = appUser.role === 'master-admin'

  // 내가 본부장으로 지정된 사업부 (departments.head_user_id)
  const { data: headDepts } = await supabaseAdmin
    .from('departments')
    .select('id')
    .eq('head_user_id', appUser.id)
    .eq('is_active', true)
  const headDeptIds = new Set((headDepts ?? []).map((d) => d.id as string))
  const isHead = headDeptIds.size > 0

  const { data: allTeams } = await supabaseAdmin
    .from('teams')
    .select('id, name, department_id, leader_user_id, is_active')
    .eq('is_active', true)
    .order('sort_order')

  const teams = allTeams ?? []
  const ledTeamIds = teams
    .filter((t) => t.leader_user_id === appUser.id)
    .map((t) => t.id)
  const isLeader = ledTeamIds.length > 0

  // ── 팀 역량평가 대상 ──────────────────────────────────────────────
  let teamTargets: TeamTarget[] = []
  if (isMaster) {
    teamTargets = teams.map((t) => ({ teamId: t.id, teamName: t.name }))
  } else if (isHead) {
    teamTargets = teams
      .filter((t) => headDeptIds.has(t.department_id))
      .map((t) => ({ teamId: t.id, teamName: t.name }))
  }

  // ── 개인 역량평가 대상 ────────────────────────────────────────────
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]))
  const leaderIds = new Set(
    teams.map((t) => t.leader_user_id).filter((v): v is number => v != null),
  )

  const personalMap = new Map<number, PersonalTarget>()
  const pushUser = (u: {
    id: number
    display_name: string | null
    team_id: string | null
  }) => {
    if (u.id === appUser.id || personalMap.has(u.id)) return
    personalMap.set(u.id, {
      userId: u.id,
      name: u.display_name ?? `사용자 ${u.id}`,
      teamId: u.team_id ?? null,
      teamName: u.team_id ? (teamNameById.get(u.team_id) ?? null) : null,
      isLeader: leaderIds.has(u.id),
    })
  }

  if (isMaster) {
    const { data } = await supabaseAdmin
      .from('app_users')
      .select('id, display_name, team_id')
      .eq('is_active', true)
      .neq('role', 'mini-admin')
    for (const u of data ?? []) pushUser(u)
  } else {
    // 팀장 → 자기 팀 팀원
    if (isLeader) {
      const { data } = await supabaseAdmin
        .from('app_users')
        .select('id, display_name, team_id')
        .eq('is_active', true)
        .in('team_id', ledTeamIds)
      for (const u of data ?? []) pushUser(u)
    }
    // 본부장 → 본부 내 팀장들
    if (isHead) {
      const deptLeaderIds = teams
        .filter(
          (t) => headDeptIds.has(t.department_id) && t.leader_user_id != null,
        )
        .map((t) => t.leader_user_id as number)
      if (deptLeaderIds.length > 0) {
        const { data } = await supabaseAdmin
          .from('app_users')
          .select('id, display_name, team_id')
          .eq('is_active', true)
          .in('id', deptLeaderIds)
        for (const u of data ?? []) pushUser(u)
      }
    }
  }

  return {
    isMaster,
    isHead,
    isLeader,
    teamTargets,
    personalTargets: [...personalMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name, 'ko'),
    ),
  }
}

/** scores 검증 — 블록별 (1~5 | null) 2차원 배열 */
export function isValidScores(value: unknown): value is (number | null)[][] {
  if (!Array.isArray(value) || value.length > 50) return false
  return value.every(
    (row) =>
      Array.isArray(row) &&
      row.length <= 100 &&
      row.every(
        (v) =>
          v === null ||
          (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5),
      ),
  )
}
