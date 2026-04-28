import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isValidRole } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import bcrypt from 'bcryptjs'

// GET: 전체 계정 목록 조회
export async function GET() {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('id, username, display_name, role, is_active, created_at, position_id, department_id, phone')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST: 새 계정 생성
export async function POST(request: NextRequest) {
  const { appUser, errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const body = await request.json()
  const { email, password, display_name, role, position_id, department_id, phone } = body as {
    email: string
    password: string
    display_name: string
    role?: string
    position_id?: string | null
    department_id?: string | null
    phone?: string | null
  }

  if (!email || !password || !display_name) {
    return NextResponse.json({ error: '필수 항목을 입력하세요.' }, { status: 400 })
  }

  // ── 권한 강화 ────────────────────────────────────────────────────────────
  // role 화이트리스트 검증
  if (role !== undefined && !isValidRole(role)) {
    return NextResponse.json({ error: '허용되지 않은 role입니다.' }, { status: 400 })
  }
  // 일반 admin은 admin/master-admin 계정 생성 불가 (권한 상승 방지)
  // master-admin만 admin 또는 master-admin 계정 생성 가능
  const targetRole = role ?? 'admin'
  if (
    appUser.role !== 'master-admin' &&
    (targetRole === 'admin' || targetRole === 'master-admin')
  ) {
    return NextResponse.json(
      { error: 'admin 이상 권한 계정 생성은 최고 관리자만 가능합니다.' },
      { status: 403 }
    )
  }

  // Supabase Auth에 사용자 생성
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  // app_users 테이블에 계정 정보 insert
  const password_hash = await bcrypt.hash(password, 10)

  const { error: dbError } = await supabaseAdmin.from('app_users').insert({
    username: email,
    password_hash,
    display_name,
    role: role ?? 'admin',
    is_active: true,
    auth_user_id: authUser.user.id, // 신규 계정은 처음부터 auth_user_id 저장 (보안 강화)
    ...(position_id ? { position_id } : {}),
    ...(department_id ? { department_id } : {}),
    ...(phone ? { phone } : {}),
  })

  if (dbError) {
    // DB 삽입 실패 시 Auth 사용자도 롤백
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: authUser.user.id }, { status: 201 })
}
