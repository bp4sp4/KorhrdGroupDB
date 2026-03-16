import { redirect } from 'next/navigation'

/**
 * 루트 경로 접근 시 로그인 페이지로 redirect.
 * 인증 상태 확인은 각 보호된 라우트에서 처리.
 */
export default function RootPage() {
  redirect('/login')
}
