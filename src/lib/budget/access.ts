import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  completePermissions,
  getEffectivePermissions,
  getEffectivePermissionsFromBase,
  getPermissionScope,
  normalizePermissionRecords,
  type PermissionRecord,
  type PermissionSection,
} from '@/lib/auth/permissions'
import { BUDGET_SCOPES } from './scopes'

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
  /** 접근 가능한 예산 scope 키 (부서별 예산 권한 기반) */
  accessibleScopeKeys: Set<string>
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

// 예산 scope 키 → 부서별 예산 권한 섹션
const SCOPE_SECTION: Record<string, PermissionSection> = {
  hakjeom: 'budget-hakjeom',
  cert: 'budget-cert',
  practice: 'budget-practice',
  dev: 'budget-dev',
}

/**
 * 예산현황 접근 권한 해석.
 * - 어드민(master-admin/admin) 또는 경영지원본부 소속 또는 budget=all → 전 본부 열람(seeAll)
 * - 그 외 → 권한관리에서 부여받은 부서별 예산 권한(budget-hakjeom/cert/practice/dev)에 해당하는 scope 만 열람
 */
export async function resolveBudgetAccess(): Promise<AccessResult> {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return { ok: false, response: errorResponse }
  if (!appUser || appUser.role === 'guest') {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: '접근 권한이 없습니다.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    }
  }

  const isFullAccess =
    appUser.role === 'master-admin' || appUser.role === 'admin'

  // 효과 권한 산출 (비관리자만)
  let permissions: PermissionRecord[] = []
  if (!isFullAccess) {
    const { data: overridePerms } = await supabaseAdmin
      .from('user_permissions')
      .select('section, scope, allowed_tabs')
      .eq('user_id', appUser.id)
    if (appUser.position_id) {
      const { data: positionPerms } = await supabaseAdmin
        .from('position_permissions')
        .select('section, scope, allowed_tabs')
        .eq('position_id', appUser.position_id)
      permissions =
        positionPerms && positionPerms.length > 0
          ? getEffectivePermissionsFromBase({
              basePermissions: positionPerms,
              overridePermissions: overridePerms ?? [],
            }).permissions
          : getEffectivePermissions({
              role: appUser.role,
              positionName: null,
              overridePermissions: overridePerms ?? [],
            }).permissions
    } else {
      permissions = completePermissions(
        normalizePermissionRecords(overridePerms ?? []),
      )
    }
  }

  const [{ data: allDepts }, position, { data: me }] = await Promise.all([
    supabaseAdmin
      .from('departments')
      .select('id, code, name')
      .order('sort_order'),
    appUser.position_id
      ? supabaseAdmin
          .from('positions')
          .select('name')
          .eq('id', appUser.position_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { name: string | null } | null }),
    supabaseAdmin
      .from('app_users')
      .select('team_id')
      .eq('id', appUser.id)
      .maybeSingle(),
  ])

  const departments = (allDepts ?? []) as DepartmentRow[]
  const ownDepartmentId = appUser.department_id ?? null
  const ownTeamId = (me?.team_id as string | null) ?? null
  const ownDept = departments.find((d) => d.id === ownDepartmentId)

  const budgetScope = isFullAccess
    ? 'all'
    : getPermissionScope(permissions, 'budget')
  const seeAll =
    isFullAccess || budgetScope === 'all' || ownDept?.code === MGT_CODE
  const isHead = (position?.data?.name ?? '')
    .replace(/\s+/g, '')
    .includes('본부장')
  const teamRestricted = !seeAll && !isHead

  // 접근 가능한 scope 키 — seeAll 전체 / 그 외엔 부여받은 부서별 예산 권한
  const accessibleScopeKeys = new Set<string>()
  for (const s of BUDGET_SCOPES) {
    if (seeAll) {
      accessibleScopeKeys.add(s.key)
    } else {
      const sec = SCOPE_SECTION[s.key]
      if (sec && getPermissionScope(permissions, sec) !== 'none')
        accessibleScopeKeys.add(s.key)
    }
  }

  // 열람 가능 본부 — seeAll 전체 / 그 외엔 접근 scope 의 본부코드 + 본인 본부
  const accessibleDeptCodes = new Set(
    BUDGET_SCOPES.filter((s) => accessibleScopeKeys.has(s.key)).map(
      (s) => s.deptCode,
    ),
  )
  const accessDepts = seeAll
    ? departments
    : departments.filter(
        (d) =>
          (d.code && accessibleDeptCodes.has(d.code)) ||
          d.id === ownDepartmentId,
      )

  return {
    ok: true,
    seeAll,
    ownDepartmentId,
    ownTeamId,
    isHead,
    teamRestricted,
    departments: accessDepts,
    accessibleScopeKeys,
    appUserId: appUser.id,
  }
}
