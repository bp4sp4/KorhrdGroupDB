import { NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import {
  completePermissions,
  getEffectivePermissions,
  getEffectivePermissionsFromBase,
  getPermissionScope,
  normalizePermissionRecords,
  type PermissionSection,
} from '@/lib/auth/permissions'
import { supabaseAdmin } from '@/lib/supabase/admin'

// 팀별 매출(team-wise revenue) 데이터에 접근 가능한 사업부 코드
// 매출 소스(NMS/자격증/유학/올케어)는 모두 사업본부(BIZ) 소속이므로,
// 다른 본부(개발/경영지원) 소속 사용자는 'own' 스코프에서 빈 결과
const REVENUE_OWN_ALLOWED_DEPT_CODES = ['BIZ']

export async function isRevenueOwnAllowedForDepartment(departmentId: string | null | undefined): Promise<boolean> {
  if (!departmentId) return false
  const { data } = await supabaseAdmin
    .from('departments')
    .select('code')
    .eq('id', departmentId)
    .maybeSingle()
  return Boolean(data?.code && REVENUE_OWN_ALLOWED_DEPT_CODES.includes(data.code))
}

export async function requireManagementAccess(
  section: PermissionSection,
  options?: { allowOwn?: boolean; deniedStatus?: number; emptyBody?: unknown }
) {
  const { user, appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) {
    return { ok: false as const, response: errorResponse }
  }

  const isFullAccess = appUser.role === 'master-admin' || appUser.role === 'admin'
  if (isFullAccess) {
    return { ok: true as const, user, appUser, scope: 'all' as const }
  }

  const { data: overridePerms } = await supabaseAdmin
    .from('user_permissions')
    .select('section, scope, allowed_tabs')
    .eq('user_id', appUser.id)

  let permissions
  if (appUser.position_id) {
    const { data: positionPerms } = await supabaseAdmin
      .from('position_permissions')
      .select('section, scope, allowed_tabs')
      .eq('position_id', appUser.position_id)

    permissions = (positionPerms && positionPerms.length > 0)
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
    permissions = completePermissions(normalizePermissionRecords(overridePerms ?? []))
  }

  const scope = getPermissionScope(permissions, section)
  if (scope === 'none') {
    if (options?.emptyBody !== undefined) {
      return {
        ok: false as const,
        response: NextResponse.json(options.emptyBody),
      }
    }
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: options?.deniedStatus ?? 403 }
      ),
    }
  }

  if (scope === 'own' && !options?.allowOwn) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: options?.deniedStatus ?? 403 }
      ),
    }
  }

  return { ok: true as const, user, appUser, scope }
}
