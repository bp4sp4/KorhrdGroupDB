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

export type RevenueDivision = 'nms' | 'cert' | 'abroad'

type DepartmentRecord = {
  code: string | null
  name: string | null
}

const HIGHER_REVENUE_POSITION_KEYWORDS = ['대리', '과장', '차장', '부장', '이사', '대표', '원장', '실장', '본부장', '팀장']

function normalizeDepartmentToken(value: string | null | undefined) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9가-힣]/g, '')
}

function isHigherRevenuePosition(positionName: string | null | undefined) {
  const normalized = String(positionName ?? '').replace(/\s+/g, '')
  return HIGHER_REVENUE_POSITION_KEYWORDS.some(keyword => normalized.includes(keyword))
}

function inferRevenueDivision(department: DepartmentRecord): RevenueDivision | null {
  const code = normalizeDepartmentToken(department.code)
  const name = normalizeDepartmentToken(department.name)
  const token = `${code} ${name}`

  // 사업본부(BIZ)는 학점은행제 사업부로 취급한다.
  if (
    code === 'BIZ' ||
    name.includes('사업본부') ||
    token.includes('NMS') ||
    token.includes('HAKJEOM') ||
    token.includes('학점은행제') ||
    token.includes('학점')
  ) {
    return 'nms'
  }

  if (
    token.includes('CERT') ||
    token.includes('PRIVATE') ||
    token.includes('민간자격증') ||
    token.includes('민간') ||
    token.includes('자격증')
  ) {
    return 'cert'
  }

  if (
    token.includes('ABROAD') ||
    token.includes('STUDY') ||
    token.includes('유학')
  ) {
    return 'abroad'
  }

  return null
}

async function getDepartmentRecord(departmentId: string | null | undefined): Promise<DepartmentRecord | null> {
  if (!departmentId) return null
  const { data } = await supabaseAdmin
    .from('departments')
    .select('code, name')
    .eq('id', departmentId)
    .maybeSingle()
  return data ?? null
}

async function getPositionName(positionId: string | null | undefined): Promise<string | null> {
  if (!positionId) return null
  const { data } = await supabaseAdmin
    .from('positions')
    .select('name')
    .eq('id', positionId)
    .maybeSingle()
  return data?.name ?? null
}

export async function getRevenueOwnAccessibleDivisions(
  departmentId: string | null | undefined,
  positionId?: string | null | undefined
): Promise<RevenueDivision[]> {
  const positionName = await getPositionName(positionId)
  if (isHigherRevenuePosition(positionName)) {
    return ['nms', 'cert', 'abroad']
  }

  const department = await getDepartmentRecord(departmentId)
  if (!department) return []

  const division = inferRevenueDivision(department)
  return division ? [division] : []
}

export async function isRevenueOwnAllowedForDepartment(
  departmentId: string | null | undefined,
  positionId?: string | null | undefined
): Promise<boolean> {
  const divisions = await getRevenueOwnAccessibleDivisions(departmentId, positionId)
  return divisions.length > 0
}

export async function isRevenueOwnAllowedForDivision(
  departmentId: string | null | undefined,
  division: RevenueDivision,
  positionId?: string | null | undefined
): Promise<boolean> {
  const divisions = await getRevenueOwnAccessibleDivisions(departmentId, positionId)
  return divisions.includes(division)
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
