import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * 매일 정해진 시각(KST)에 전원 강제 로그아웃.
 *
 * 기준: auth.users.last_sign_in_at (실제 로그인 시각).
 *  - 토큰 자동 갱신으로는 바뀌지 않으므로 "원래 로그인 시각"을 그대로 반영한다.
 *  - 가장 최근 컷오프(매일 DAILY_LOGOUT_HOUR_KST시) 이전에 로그인했다면
 *    다음 요청 시 세션을 무효화하고 로그인 페이지로 보낸다.
 *  - 클라이언트가 조작할 수 없는 서버 값 기반이라 우회 불가.
 */

// 매일 전원 로그아웃 기준 시각 (KST, 0~23). 기본: 새벽 5시
const DAILY_LOGOUT_HOUR_KST = 5
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** 현재 시각 기준, 가장 최근에 지나간 "매일 컷오프(KST)" 의 UTC epoch(ms) */
function getLatestCutoffMs(nowMs: number): number {
  // now 를 KST 벽시계로 환산해서 연/월/일/시 추출
  const kstNow = new Date(nowMs + KST_OFFSET_MS)
  const y = kstNow.getUTCFullYear()
  const m = kstNow.getUTCMonth()
  const d = kstNow.getUTCDate()
  const h = kstNow.getUTCHours()

  // 오늘 컷오프(KST 벽시계)를 실제 UTC 로 변환
  let cutoff = Date.UTC(y, m, d, DAILY_LOGOUT_HOUR_KST, 0, 0) - KST_OFFSET_MS
  // 아직 오늘 컷오프 시각 전이라면, 어제 컷오프가 가장 최근
  if (h < DAILY_LOGOUT_HOUR_KST) cutoff -= DAY_MS
  return cutoff
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const lastSignIn = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : NaN
    const cutoff = getLatestCutoffMs(Date.now())

    if (!Number.isNaN(lastSignIn) && lastSignIn < cutoff) {
      // 컷오프 이전 로그인 → 세션 무효화 (signOut 이 supabaseResponse 에 쿠키 삭제를 기록)
      await supabase.auth.signOut()

      const isApi = request.nextUrl.pathname.startsWith('/api')

      const response = isApi
        ? NextResponse.json(
            { error: '세션이 만료되었습니다. 다시 로그인해 주세요.' },
            { status: 401 }
          )
        : (() => {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            url.search = ''
            url.searchParams.set('expired', '1')
            return NextResponse.redirect(url)
          })()

      // signOut 으로 삭제된 인증 쿠키를 최종 응답에 반영
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value, cookie)
      })

      return response
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /**
     * 아래를 제외한 모든 경로에 적용:
     * - _next/static, _next/image : 정적 자산
     * - favicon, 이미지 파일       : 정적 파일
     * - login                     : 로그인 페이지 (리다이렉트 루프 방지)
     */
    '/((?!_next/static|_next/image|favicon.ico|login|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
