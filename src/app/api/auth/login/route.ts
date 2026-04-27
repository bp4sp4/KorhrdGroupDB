import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 })
    }

    // app_users 테이블에서 유저 조회
    const { data: user, error } = await supabaseAdmin
      .from('app_users')
      .select('id, username, password_hash, display_name, role, is_active')
      .eq('username', username)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    if (!user.is_active) {
      return NextResponse.json({ error: '비활성화된 계정입니다.' }, { status: 403 })
    }

    // 비밀번호 검증
    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      },
    })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
