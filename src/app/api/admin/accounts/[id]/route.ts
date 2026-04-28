import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isValidRole } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PATCH: role, display_name, is_active 수정
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { appUser, errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const { id } = await params
  const body = await request.json()
  const { role, display_name, is_active, position_id, department_id, phone } = body as {
    role?: string
    display_name?: string
    is_active?: boolean
    position_id?: string | null
    department_id?: string | null
    phone?: string | null
  }

  // ── 권한 강화: role 변경 또는 is_active 변경은 master-admin 전용 ─────────
  const isPrivilegedChange = role !== undefined || is_active !== undefined
  if (isPrivilegedChange && appUser.role !== 'master-admin') {
    return NextResponse.json(
      { error: '계정 권한/활성화 상태 변경은 최고 관리자만 가능합니다.' },
      { status: 403 }
    )
  }

  // ── 자기 자신의 role/is_active 변경 금지 ─────────────────────────────────
  if (isPrivilegedChange && Number(id) === appUser.id) {
    return NextResponse.json(
      { error: '본인 계정의 권한은 변경할 수 없습니다.' },
      { status: 403 }
    )
  }

  // ── role 화이트리스트 검증 ───────────────────────────────────────────────
  if (role !== undefined && !isValidRole(role)) {
    return NextResponse.json(
      { error: '허용되지 않은 role입니다.' },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = {}
  if (role !== undefined) updates.role = role
  if (display_name !== undefined) updates.display_name = display_name
  if (is_active !== undefined) updates.is_active = is_active
  if (position_id !== undefined) updates.position_id = position_id
  if (department_id !== undefined) updates.department_id = department_id
  if (phone !== undefined) updates.phone = phone || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '변경할 항목이 없습니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[admin/accounts PATCH]', error)
    return NextResponse.json({ error: '계정 수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE: 계정 삭제 (master-admin 전용, Supabase Auth + app_users 동시 삭제)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { appUser, errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  // 권한: master-admin만 삭제 가능
  if (appUser.role !== 'master-admin') {
    return NextResponse.json(
      { error: '계정 삭제는 최고 관리자만 가능합니다.' },
      { status: 403 }
    )
  }

  const { id } = await params

  // 본인 계정 삭제 금지
  if (Number(id) === appUser.id) {
    return NextResponse.json(
      { error: '본인 계정은 삭제할 수 없습니다.' },
      { status: 403 }
    )
  }

  // 1. 대상 계정 조회 (auth_user_id 확보)
  const { data: target, error: fetchErr } = await supabaseAdmin
    .from('app_users')
    .select('id, auth_user_id, role, username')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !target) {
    return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
  }

  // master-admin 계정 보호 (master-admin이 다른 master-admin을 삭제하지 못하도록 안전장치)
  if (target.role === 'master-admin') {
    return NextResponse.json(
      { error: '최고 관리자 계정은 삭제할 수 없습니다.' },
      { status: 403 }
    )
  }

  // 2. app_users 삭제 (FK ON DELETE SET NULL이라 auth.users 삭제 전에 안전)
  const { error: dbErr } = await supabaseAdmin.from('app_users').delete().eq('id', id)
  if (dbErr) {
    console.error('[admin/accounts DELETE] app_users:', dbErr)
    return NextResponse.json({ error: '계정 삭제 중 오류가 발생했습니다.' }, { status: 500 })
  }

  // 3. Supabase Auth 사용자 삭제 (있으면) + 기존 세션/토큰 강제 무효화
  if (target.auth_user_id) {
    // 보유 중인 모든 세션 강제 종료 (퇴사자가 가지고 있던 토큰 즉시 무효화)
    const { error: signOutErr } = await supabaseAdmin.auth.admin.signOut(
      target.auth_user_id,
      'global'
    )
    if (signOutErr) console.error('[admin/accounts DELETE] signOut:', signOutErr)

    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(target.auth_user_id)
    if (authErr) {
      // 이미 app_users는 삭제됨 — Auth 정리 실패는 로그만 남기고 성공 응답
      console.error('[admin/accounts DELETE] auth user:', authErr)
    }
  }

  return NextResponse.json({ success: true })
}
