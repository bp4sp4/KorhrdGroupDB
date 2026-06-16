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
  /** 열람 가능한 본부 목록 */
  departments: DepartmentRow[]
  appUserId: number
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

  const { data: allDepts } = await supabaseAdmin
    .from('departments')
    .select('id, code, name')
    .order('sort_order')

  const departments = (allDepts ?? []) as DepartmentRow[]
  const ownDepartmentId = access.appUser.department_id ?? null
  const ownDept = departments.find((d) => d.id === ownDepartmentId)

  const seeAll = access.scope === 'all' || ownDept?.code === MGT_CODE

  return {
    ok: true,
    seeAll,
    ownDepartmentId,
    departments: seeAll
      ? departments
      : departments.filter((d) => d.id === ownDepartmentId),
    appUserId: access.appUser.id,
  }
}
