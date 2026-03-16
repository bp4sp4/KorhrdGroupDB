'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/client'

// 경로별 헤더 타이틀 매핑
const PAGE_TITLES: Record<string, string> = {
  '/hakjeom': '학점은행제',
  '/cert': '자격증신청',
  '/practice': '실습/취업',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setIsChecking(false)
      }
    })
  }, [router])

  // 인증 확인 중에는 빈 화면 표시 (flash 방지)
  if (isChecking) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--toss-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p style={{ color: 'var(--toss-text-secondary)', fontSize: 14 }}>로딩 중...</p>
      </div>
    )
  }

  const pageTitle = PAGE_TITLES[pathname] ?? '대시보드'

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--toss-bg)',
    }}>
      <Sidebar />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0, // flex 자식 overflow 방지
      }}>
        <Header title={pageTitle} />

        <main style={{
          flex: 1,
          padding: 24,
          overflow: 'auto',
        }}>
          {children}
        </main>
      </div>
    </div>
  )
}
