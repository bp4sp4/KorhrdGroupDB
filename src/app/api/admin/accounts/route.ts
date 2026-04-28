import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAuth'
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
  const { errorResponse } = await requireAdmin()
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
