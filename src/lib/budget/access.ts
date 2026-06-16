import { requireManagementAccess } from '@/lib/auth/managementAccess'
import { supabaseAdmin } from '@/lib/supabase/admin'

export interface DepartmentRow {
  id: string
  code: string | null
  name: string
}

export interface BudgetAccess {
  ok: true
  /** 모든 본부 열람 가능 (어드민 또는 경영지원본부) */
  seeAll: boolean
  /** 본인 본부 id (seeAll=false 일 때 필터 기준) */
  ownDepartmentId: string | null
  /** 본인 팀 id */
  ownTeamId: string | null
  /** 본부장 여부 (본인 본부 예산한도 수정 가능) */
  isHead: boolean
  /** 팀 제한 여부 — true 면 본인 팀 데이터만 열람 (일반 직원) */
  teamRestricted: boolean
  /** 열람 가능한 본부 목록 */
  departments: DepartmentRow[]
  appUserId: number
}

/** 특정 본부의 예산한도 수정 권한 (어드민·경영지원 → 전체, 본부장 → 본인 본부) */
export function canEditLimit(access: BudgetAccess, departmentId: string): boolean {
  if (access.seeAll) return true
  return access.isHead && departmentId === access.ownDepartmentId
}

type AccessResult = BudgetAccess | { ok: false; response: Response }

// 경영지원본부 코드
const MGT_CODE = 'MGT'

/**
 * 예산현황 접근 권한 해석.
 * - 어드민(master-admin/admin) 또는 경영지원본부 소속 → 전 본부 열람
 * - 그 외 → 본인 본부만 열람
 */
export async function resolveBudgetAccess(): Promise<AccessResult> {
  const access = await requireManagementAccess('budget', { allowOwn: true })
  if (!access.ok) return { ok: false, response: access.response }

  const [{ data: allDepts }, position, { data: me }] = await Promise.all([
    supabaseAdmin.from('departments').select('id, code, name').order('sort_order'),
    access.appUser.position_id
      ? supabaseAdmin.from('positions').select('name').eq('id', access.appUser.position_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string | null } | null }),
    supabaseAdmin.from('app_users').select('team_id').eq('id', access.appUser.id).maybeSingle(),
  ])

  const departments = (allDepts ?? []) as DepartmentRow[]
  const ownDepartmentId = access.appUser.department_id ?? null
  const ownTeamId = (me?.team_id as string | null) ?? null
  const ownDept = departments.find((d) => d.id === ownDepartmentId)

  const seeAll = access.scope === 'all' || ownDept?.code === MGT_CODE
  const isHead = (position?.data?.name ?? '').replace(/\s+/g, '').includes('본부장')
  // 일반 직원(전체권한·본부장 아님)은 본인 팀 데이터만
  const teamRestricted = !seeAll && !isHead

  return {
    ok: true,
    seeAll,
    ownDepartmentId,
    ownTeamId,
    isHead,
    teamRestricted,
    departments: seeAll
      ? departments
      : departments.filter((d) => d.id === ownDepartmentId),
    appUserId: access.appUser.id,
  }
}
