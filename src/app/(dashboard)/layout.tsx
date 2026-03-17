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
      <Sidebar />

      <div className={styles.dashboardMain}>
        <Header title={pageTitle} />

        <main className={styles.mainContent}>
          {children}
        </main>
      </div>
    </div>
  )
}
