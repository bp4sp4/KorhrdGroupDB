import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getQrSession, confirmQrSession } from '@/lib/qr-sessions'

// GET: 모바일에서 글자 목록 + 현재 모바일 로그인 사용자 정보 조회
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const session = await getQrSession(token)

  if (!session) {
    return NextResponse.json({ error: '만료되었거나 유효하지 않은 QR코드입니다.' }, { status: 404 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  return NextResponse.json({
    chars: session.chars,
    authenticated: !!user,
    email: user?.email ?? null,
  })
}

// POST: 모바일에서 글자 선택 → 인증 처리
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const body = await request.json().catch(() => ({}))
  const { email, password, char } = body as { email?: string; password?: string; char?: string }

  if (!char) {
    return NextResponse.json({ error: '글자를 선택해주세요.' }, { status: 400 })
  }

  const session = await getQrSession(token)
  if (!session) {
    return NextResponse.json({ error: '만료되었거나 유효하지 않은 QR코드입니다.' }, { status: 404 })
  }
  if (session.correct_char !== char) {
    return NextResponse.json({ error: '틀린 글자입니다. 다시 시도해주세요.' }, { status: 400 })
  }

  let accessToken: string | undefined
  let refreshToken: string | undefined

  // 모드 1: 모바일 이미 로그인 → 쿠키 세션 토큰 사용
  const serverSupabase = await createServerClient()
  const { data: { session: existingSession } } = await serverSupabase.auth.getSession()

  if (existingSession) {
    accessToken = existingSession.access_token
    refreshToken = existingSession.refresh_token
  } else {
    // 모드 2: 비로그인 → 이메일/비밀번호 검증
    if (!email || !password) {
      return NextResponse.json({ error: '이메일/비밀번호를 입력해주세요.' }, { status: 400 })
    }
    const anonClient = createAnonClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await anonClient.auth.signInWithPassword({ email, password })
    if (error || !data.session) {
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }
    accessToken = data.session.access_token
    refreshToken = data.session.refresh_token
  }

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: '인증 토큰을 가져올 수 없습니다.' }, { status: 500 })
  }

  const result = await confirmQrSession(token, char, { accessToken, refreshToken })
  if (result !== 'ok') {
    return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
