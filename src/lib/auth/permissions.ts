export type PermissionScope = 'none' | 'all' | 'own'

export type PermissionSection =
  | 'hakjeom'
  | 'edu-sales'
  | 'edu-students'
  | 'cert'
  | 'cert-sales'
  | 'practice'
  | 'practice-sales'
  | 'allcare'
  | 'abroad'
  | 'duplicate'
  | 'trash'
  | 'logs'
  | 'ref-manage'
  | 'assignment'
  | 'links'
  | 'marketing'
  | 'approvals'
  | 'revenues'
  | 'revenue-upload'
  | 'reports'
  | 'bankaccount'
  | 'budget'
  | 'budget-hakjeom'
  | 'budget-cert'
  | 'budget-practice'
  | 'budget-dev'
  | 'task-board'
  | 'me-leave'
  | 'calendar'
  | 'wj-admin'
  | 'wj-archive'
  | 'me-attendance'
  | 'profit'
  | 'me-contracts'
  | 'appraisal'
  | 'me-appraisal'

export interface PermissionRecord {
  section: PermissionSection
  scope: PermissionScope
  allowed_tabs?: string[] | null
}

interface PermissionInput {
  section: string
  scope: string
  allowed_tabs?: string[] | null
}

export const ALL_PERMISSION_SECTIONS: PermissionSection[] = [
  'hakjeom',
  'edu-sales',
  'edu-students',
  'cert',
  'cert-sales',
  'practice',
  'practice-sales',
  'allcare',
  'abroad',
  'duplicate',
  'trash',
  'logs',
  'ref-manage',
  'assignment',
  'links',
  'marketing',
  'approvals',
  'revenues',
  'revenue-upload',
  'reports',
  'bankaccount',
  'budget',
  'budget-hakjeom',
  'budget-cert',
  'budget-practice',
  'budget-dev',
  'task-board',
  'me-leave',
  'calendar',
  'wj-admin',
  'wj-archive',
  'me-attendance',
  'profit',
  'me-contracts',
  'appraisal',
  'me-appraisal',
]

// 기본 허용 섹션 — 권한 레코드가 없으면 'all' 로 간주 (명시적으로 none 줄 때만 차단)
// wj-admin 은 역할(관리자/부서관리자) 게이트가 별도로 있어 기본 all 이어도 일반 직원에겐 안 열린다
// me-contracts / appraisal / me-appraisal — 기존에 전직원 공통이던 메뉴라 기본 all,
// 권한관리에서 특정 사용자만 '접근 불가'로 끌 수 있다
const DEFAULT_ALLOW_SECTIONS: PermissionSection[] = [
  'wj-admin',
  'wj-archive',
  'me-attendance',
  'me-contracts',
  'appraisal',
  'me-appraisal',
]

// 기본 'own' 섹션 — 권한 레코드가 없으면 본인 소속 데이터만 열람 가능
// 예산현황(budget)은 기본 접근 불가(none) — 권한관리에서 개별 부여.
// 부여받으면 본인 부서 예산현황만 노출(부서별 메뉴 분리).
const DEFAULT_OWN_SECTIONS: PermissionSection[] = []

// 직책별 기본 권한 (position_permissions 테이블이 비어있을 때 fallback)
// links / marketing / task-board / me-leave / calendar 은 모든 직책 공통 (전사 도구로 누구나 접근)
const COMMON_SECTIONS: PermissionSection[] = [
  'links', 'marketing', 'task-board', 'me-leave', 'calendar',
  'wj-admin', 'wj-archive', 'me-attendance',
  'me-contracts', 'appraisal', 'me-appraisal',
]

const MANAGEMENT_ACCESS_BY_POSITION: Record<string, PermissionSection[]> = {
  사원: [...COMMON_SECTIONS],
  주임: ['revenue-upload', 'approvals', ...COMMON_SECTIONS],
  대리: ['revenues', 'revenue-upload', 'approvals', ...COMMON_SECTIONS],
  이사: ['revenues', 'revenue-upload', 'approvals', 'reports', 'bankaccount', ...COMMON_SECTIONS],
  상무: ['revenues', 'revenue-upload', 'approvals', 'reports', 'bankaccount', ...COMMON_SECTIONS],
  본부장: ['bankaccount', ...COMMON_SECTIONS],
  대표이사: ['revenues', 'revenue-upload', 'approvals', 'reports', 'bankaccount', ...COMMON_SECTIONS],
  임원: ['revenues', 'revenue-upload', 'approvals', 'reports', 'bankaccount', ...COMMON_SECTIONS],
}

function isPermissionSection(section: string): section is PermissionSection {
  return ALL_PERMISSION_SECTIONS.includes(section as PermissionSection)
}

function isPermissionScope(scope: string): scope is PermissionScope {
  return scope === 'none' || scope === 'all' || scope === 'own'
}

export function getFullAccessPermissions(): PermissionRecord[] {
  return ALL_PERMISSION_SECTIONS.map(section => ({ section, scope: 'all' }))
}

export function getEmptyPermissions(): PermissionRecord[] {
  return ALL_PERMISSION_SECTIONS.map(section => ({ section, scope: 'none' }))
}

export function completePermissions(records: PermissionRecord[]): PermissionRecord[] {
  const recordMap = new Map(records.map(record => [record.section, record]))
  return ALL_PERMISSION_SECTIONS.map(section => {
    const existing = recordMap.get(section)
    if (existing) return existing
    const scope: PermissionScope = DEFAULT_ALLOW_SECTIONS.includes(section)
      ? 'all'
      : DEFAULT_OWN_SECTIONS.includes(section)
        ? 'own'
        : 'none'
    return { section, scope }
  })
}

export function getBasePermissions(params: {
  role?: string | null
  positionName?: string | null
}): PermissionRecord[] {
  if (params.role === 'master-admin') {
    return getFullAccessPermissions()
  }

  const sections = MANAGEMENT_ACCESS_BY_POSITION[(params.positionName ?? '').trim()] ?? []
  return completePermissions(ALL_PERMISSION_SECTIONS.map(section => ({
    section,
    scope: sections.includes(section) ? 'all' : 'none',
  })))
}

export function normalizePermissionRecords(records: PermissionInput[] | null | undefined): PermissionRecord[] {
  return (records ?? []).flatMap((record) => {
    if (!isPermissionSection(record.section) || !isPermissionScope(record.scope)) {
      return []
    }
    return [{
      section: record.section,
      scope: record.scope,
      allowed_tabs: record.allowed_tabs ?? null,
    }]
  })
}

export function getEffectivePermissionsFromBase(params: {
  basePermissions: PermissionInput[] | null | undefined
  overridePermissions?: PermissionInput[] | null
}): {
  basePermissions: PermissionRecord[]
  overridePermissions: PermissionRecord[]
  permissions: PermissionRecord[]
} {
  const basePermissions = completePermissions(normalizePermissionRecords(params.basePermissions))
  const overridePermissions = normalizePermissionRecords(params.overridePermissions)
  const permissions = mergePermissions(basePermissions, overridePermissions)

  return {
    basePermissions,
    overridePermissions,
    permissions,
  }
}

export function mergePermissions(basePermissions: PermissionRecord[], overridePermissions: PermissionRecord[]): PermissionRecord[] {
  const merged = new Map<PermissionSection, PermissionRecord>()

  for (const basePermission of basePermissions) {
    merged.set(basePermission.section, { ...basePermission, allowed_tabs: basePermission.allowed_tabs ?? null })
  }

  for (const overridePermission of overridePermissions) {
    const previous = merged.get(overridePermission.section)
    merged.set(overridePermission.section, {
      section: overridePermission.section,
      scope: overridePermission.scope,
      allowed_tabs: overridePermission.allowed_tabs ?? previous?.allowed_tabs ?? null,
    })
  }

  return Array.from(merged.values())
}

export function getEffectivePermissions(params: {
  role?: string | null
  positionName?: string | null
  overridePermissions?: PermissionInput[] | null
}): {
  basePermissions: PermissionRecord[]
  overridePermissions: PermissionRecord[]
  permissions: PermissionRecord[]
} {
  const basePermissions = getBasePermissions({
    role: params.role,
    positionName: params.positionName,
  })
  const overridePermissions = normalizePermissionRecords(params.overridePermissions)
  const permissions = mergePermissions(basePermissions, overridePermissions)

  return {
    basePermissions,
    overridePermissions,
    permissions,
  }
}

export function getPermissionScope(
  permissions: PermissionRecord[],
  section: PermissionSection
): PermissionScope {
  return permissions.find(permission => permission.section === section)?.scope ?? 'none'
}
