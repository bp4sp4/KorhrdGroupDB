import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { completePermissions, getEffectivePermissions, getEffectivePermissionsFromBase, getFullAccessPermissions, getPermissionScope, normalizePermissionRecords } from '@/lib/auth/permissions';
import { getRevenueOwnAccessibleDivisions } from '@/lib/auth/managementAccess';

// GET: 현재 로그인한 유저의 role 정보 조회
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // app_users에서 role 조회 (email로 매칭)
    const { data: appUser } = await supabaseAdmin
      .from('app_users')
      .select('id, role, display_name, ref_code, department_id, position_id')
      .eq('username', user.email)
      .single();

    let positionName: string | null = null
    let departmentCode: string | null = null
    let departmentName: string | null = null
    if (appUser?.position_id) {
      const { data: position } = await supabaseAdmin
        .from('positions')
        .select('name')
        .eq('id', appUser.position_id)
        .single()
      positionName = position?.name ?? null
    }

    if (appUser?.department_id) {
      const { data: department } = await supabaseAdmin
        .from('departments')
        .select('code, name')
        .eq('id', appUser.department_id)
        .maybeSingle()
      departmentCode = department?.code ?? null
      departmentName = department?.name ?? null
    }

    // master-admin 판정은 DB role 컬럼 기반
    // app_users 미등록자는 guest 권한 (모든 섹션 차단)
    const effectiveRole = appUser?.role ?? 'guest'
    const isFullAccess = effectiveRole === 'master-admin' || effectiveRole === 'admin'

    let permissions = isFullAccess ? getFullAccessPermissions() : []
    let basePermissions = isFullAccess ? getFullAccessPermissions() : []
    let overridePermissions: { section: string; scope: string; allowed_tabs?: string[] | null }[] = []

    if (appUser?.id && !isFullAccess) {
      const { data: perms } = await supabaseAdmin
        .from('user_permissions')
        .select('section, scope, allowed_tabs')
        .eq('user_id', appUser.id)

      let effectivePermissions
      if (appUser.position_id) {
        const { data: positionPerms } = await supabaseAdmin
          .from('position_permissions')
          .select('section, scope, allowed_tabs')
          .eq('position_id', appUser.position_id)

        effectivePermissions = (positionPerms && positionPerms.length > 0)
          ? getEffectivePermissionsFromBase({
              basePermissions: positionPerms,
              overridePermissions: perms ?? [],
            })
          : getEffectivePermissions({
              role: effectiveRole,
              positionName,
              overridePermissions: perms ?? [],
            })
      } else {
        effectivePermissions = {
          basePermissions: completePermissions([]),
          overridePermissions: normalizePermissionRecords(perms ?? []),
          permissions: normalizePermissionRecords(perms ?? []),
        }
      }

      permissions = effectivePermissions.permissions
      basePermissions = effectivePermissions.basePermissions
      overridePermissions = effectivePermissions.overridePermissions
    }

    const revenueScope = isFullAccess ? 'all' : getPermissionScope(permissions, 'revenues')
    const revenueOwnDivisions = revenueScope === 'own'
      ? await getRevenueOwnAccessibleDivisions(appUser?.department_id ?? null, appUser?.position_id ?? null)
      : []

    return NextResponse.json({
      id: appUser?.id ?? null,
      role: effectiveRole,
      displayName: appUser?.display_name ?? user.email,
      refCode: appUser?.ref_code ?? null,
      departmentId: appUser?.department_id ?? null,
      departmentCode,
      departmentName,
      positionId: appUser?.position_id ?? null,
      positionName,
      basePermissions,
      overridePermissions,
      permissions,
      revenueOwnDivisions,
    });
  } catch (err) {
    console.error('[auth/me] Unexpected error:', err);
    return NextResponse.json(
      { error: '사용자 정보를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}
