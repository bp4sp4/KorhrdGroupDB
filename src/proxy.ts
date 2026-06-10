import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * 매일 정해진 시각(KST) 전원 강제 로그아웃.
 * 기준: auth.users.last_sign_in_at (실제 로그인 시각, 토큰 갱신으로 안 바뀜).
 * 가장 최근 컷오프(매일 DAILY_LOGOUT_HOUR_KST시)보다 이전 로그인이면 세션 무효화.
 * 클라이언트가 조작할 수 없는 서버 값 기반이라 우회 불가.
 */
const DAILY_LOGOUT_HOUR_KST = 5 // 매일 전원 로그아웃 기준 시각 (KST, 0~23)
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** 현재 시각 기준, 가장 최근에 지나간 "매일 컷오프(KST)" 의 UTC epoch(ms) */
function getLatestCutoffMs(nowMs: number): number {
  const kstNow = new Date(nowMs + KST_OFFSET_MS)
  const y = kstNow.getUTCFullYear()
  const m = kstNow.getUTCMonth()
  const d = kstNow.getUTCDate()
  const h = kstNow.getUTCHours()
  let cutoff = Date.UTC(y, m, d, DAILY_LOGOUT_HOUR_KST, 0, 0) - KST_OFFSET_MS
  if (h < DAILY_LOGOUT_HOUR_KST) cutoff -= DAY_MS
  return cutoff
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            response.cookies.set(name, value, options as any)
          )
        },
      },
    }
  )

  // getUser()로 토큰 유효성 검증 + 만료 시 자동 갱신
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // 인증 없이 접근 가능한 경로
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/hakjeom/notify' ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/logo.png' ||
    pathname === '/og-image.png' ||
    // 손익 이익률 배너 아이콘 — next/image 옵티마이저가 내부 요청으로 가져가므로 공개 필요
    pathname === '/face_01.png' ||
    pathname === '/face_02.png' ||
    pathname === '/face_03.png'

  if (isPublic) return response

  if (!user) {
    // API 요청 → 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    // 페이지 요청 → 로그인으로 리다이렉트
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ── 매일 전원 자동 로그아웃: 컷오프 이전 로그인이면 세션 무효화 ──
  const lastSignIn = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : NaN
  if (!Number.isNaN(lastSignIn) && lastSignIn < getLatestCutoffMs(Date.now())) {
    await supabase.auth.signOut() // refresh token 폐기 + 쿠키 삭제(response 에 반영됨)

    if (pathname.startsWith('/api/')) {
      const res = NextResponse.json(
        { error: '세션이 만료되었습니다. 다시 로그인해 주세요.' },
        { status: 401 }
      )
      response.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c))
      return res
    }

    const url = new URL('/login', request.url)
    url.searchParams.set('expired', '1')
    const res = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, c))
    return res
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
