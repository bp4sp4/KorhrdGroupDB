import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { completePermissions, getBasePermissions, mergePermissions, normalizePermissionRecords } from '@/lib/auth/permissions'

// GET: 전체 계정 + 각 계정의 권한 목록 조회
export async function GET() {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const { data: users, error } = await supabaseAdmin
    .from('app_users')
    .select('id, display_name, username, role, position_id')
    .not('role', 'in', '("master-admin","admin")')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: perms } = await supabaseAdmin
    .from('user_permissions')
    .select('user_id, section, scope, allowed_tabs')

  const positionIds = Array.from(new Set((users ?? []).map(user => user.position_id).filter(Boolean)))

  const { data: positionPerms } = positionIds.length === 0
    ? { data: [] as { position_id: string; section: string; scope: string; allowed_tabs?: string[] | null }[] }
    : await supabaseAdmin
        .from('position_permissions')
        .select('position_id, section, scope, allowed_tabs')
        .in('position_id', positionIds)
  const { data: positions } = positionIds.length === 0
    ? { data: [] as { id: string; name: string }[] }
    : await supabaseAdmin
        .from('positions')
        .select('id, name')
        .in('id', positionIds)

  const positionMap = Object.fromEntries((positions ?? []).map(position => [position.id, position.name]))

  const permsMap: Record<number, { section: string; scope: string; allowed_tabs?: string[] | null }[]> = {}
  for (const p of perms ?? []) {
    if (!permsMap[p.user_id]) permsMap[p.user_id] = []
    permsMap[p.user_id].push({ section: p.section, scope: p.scope, allowed_tabs: p.allowed_tabs ?? null })
  }

  const positionPermsMap: Record<string, { section: string; scope: string; allowed_tabs?: string[] | null }[]> = {}
  for (const p of positionPerms ?? []) {
    if (!positionPermsMap[p.position_id]) positionPermsMap[p.position_id] = []
    positionPermsMap[p.position_id].push({ section: p.section, scope: p.scope, allowed_tabs: p.allowed_tabs ?? null })
  }

  const result = (users ?? []).map(u => ({
    ...u,
    position_name: u.position_id ? positionMap[u.position_id] ?? null : null,
    base_permissions: completePermissions(
      normalizePermissionRecords(
        u.position_id
          ? (positionPermsMap[u.position_id] ?? getBasePermissions({ role: u.role, positionName: positionMap[u.position_id] ?? null }))
          : getBasePermissions({ role: u.role, positionName: null })
      )
    ),
    permissions: mergePermissions(
      completePermissions(
        normalizePermissionRecords(
          u.position_id
            ? (positionPermsMap[u.position_id] ?? getBasePermissions({ role: u.role, positionName: positionMap[u.position_id] ?? null }))
            : getBasePermissions({ role: u.role, positionName: null })
        )
      ),
      normalizePermissionRecords(permsMap[u.id] ?? [])
    ),
    overrides: normalizePermissionRecords(permsMap[u.id] ?? []),
  }))

  return NextResponse.json(result)
}

// POST: 특정 유저의 섹션 권한 upsert (clear_override=true면 삭제)
// 권한 부여는 master-admin 전용 (admin이 자신/타인에게 임의 권한 부여 방지)
export async function POST(request: NextRequest) {
  const { errorResponse } = await requireMasterAdmin()
  if (errorResponse) return errorResponse

  const body = await request.json() as {
    user_id: number
    section: string
    scope?: string | null
    allowed_tabs?: string[] | null
    clear_override?: boolean
  }
  const { user_id, section, scope, allowed_tabs, clear_override } = body

  if (!user_id || !section) {
    return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
  }

  // allowed_tabs만 업데이트 (scope 변경 없이)
  if (clear_override) {
    const { error } = await supabaseAdmin
      .from('user_permissions')
      .delete()
      .eq('user_id', user_id)
      .eq('section', section)
    if (error) {
      console.error('[permissions POST clear] error:', error)
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }
  } else if (scope === undefined) {
    const { error } = await supabaseAdmin
      .from('user_permissions')
      .update({ allowed_tabs: allowed_tabs ?? null })
      .eq('user_id', user_id)
      .eq('section', section)
    if (error) {
      console.error('[permissions POST update] error:', error)
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }
  } else {
    // upsert (scope + allowed_tabs)
    const { error } = await supabaseAdmin
      .from('user_permissions')
      .upsert(
        { user_id, section, scope, allowed_tabs: allowed_tabs ?? null },
        { onConflict: 'user_id,section' }
      )
    if (error) {
      console.error('[permissions POST upsert] error:', error, 'payload:', { user_id, section, scope, allowed_tabs })
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
