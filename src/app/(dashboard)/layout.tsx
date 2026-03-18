'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/client'
import styles from '@/components/layout/layout.module.css'

// 경로별 헤더 타이틀 매핑
const PAGE_TITLES: Record<string, string> = {
  '/hakjeom': '학점은행제',
  '/cert': '자격증신청',
  '/practice': '실습/취업',
  '/mini-admin': '결제확인',
  '/paymentstatus': '결제확인',
  '/ref-manage': '미니어드민 관리',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string>('관리자')
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }

      // app_users에서 role 조회
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          setUserRole(data.role ?? 'admin')
          setDisplayName(data.displayName ?? '관리자')

          // mini-admin이 일반 페이지 접근 시 리다이렉트
          if (data.role === 'mini-admin' && !window.location.pathname.startsWith('/mini-admin') && !window.location.pathname.startsWith('/paymentstatus')) {
            router.replace('/paymentstatus')
            return
          }
        }
      } catch {
        // role 조회 실패 시 기본 admin으로
        setUserRole('admin')
      }

      setIsChecking(false)
    })
  }, [router])

  if (isChecking) {
    return (
      <div className={styles.loadingWrap}>
        <p className={styles.loadingText}>로딩 중...</p>
      </div>
    )
  }

  const pageTitle = PAGE_TITLES[pathname] ?? '대시보드'

  return (
    <div className={styles.dashboardWrap}>
      <Sidebar userRole={userRole} />

      <div className={styles.dashboardMain}>
        <Header title={pageTitle} userName={displayName} />

        <main className={styles.mainContent}>
          {children}
        </main>
      </div>
    </div>
  )
}
