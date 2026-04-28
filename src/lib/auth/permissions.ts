export type PermissionScope = 'none' | 'all' | 'own'

export type PermissionSection =
  | 'hakjeom'
  | 'cert'
  | 'practice'
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
  'cert',
  'practice',
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
]

// 직책별 기본 권한 (position_permissions 테이블이 비어있을 때 fallback)
// links / marketing 은 모든 직책 공통 (전사 도구로 누구나 접근)
const COMMON_SECTIONS: PermissionSection[] = ['links', 'marketing']

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
    return existing ?? { section, scope: 'none' }
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
