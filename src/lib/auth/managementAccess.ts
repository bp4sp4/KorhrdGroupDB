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
