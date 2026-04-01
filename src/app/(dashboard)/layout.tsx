'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/client'
import styles from '@/components/layout/layout.module.css'

interface PageMeta {
  title: string
  section?: string
}

const PAGE_META: Record<string, PageMeta> = {
  '/hakjeom':      { title: '교육운영',     section: '교육운영' },
  '/cert':         { title: '교육운영',     section: '교육운영' },
  '/practice':     { title: '실습/취업',    section: '교육운영' },
  '/allcare':      { title: '올케어 관리자', section: '교육운영' },
  '/revenues':     { title: '매출 관리',    section: '경영관리' },
  '/approvals':    { title: '전자결재',     section: '경영관리' },
  '/reports':      { title: '손익 리포트',  section: '경영관리' },
  '/duplicate':    { title: '중복 조회',    section: '시스템' },
  '/trash':        { title: '삭제목록',     section: '시스템' },
  '/ref-manage':   { title: '어드민 관리',  section: '시스템' },
  '/logs':         { title: '로그 관리',    section: '시스템' },
  '/mini-admin':   { title: '결제확인' },
  '/paymentstatus':{ title: '결제확인' },
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
  const [permissions, setPermissions] = useState<{ section: string; scope: string }[]>([])
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
          setPermissions(data.permissions ?? [])

          // mini-admin이 일반 페이지 접근 시 리다이렉트
          if (data.role === 'mini-admin' && !window.location.pathname.startsWith('/mini-admin') && !window.location.pathname.startsWith('/paymentstatus')) {
            router.replace('/paymentstatus')
            return
          }

          // /admin 경로 접근 시 master-admin 권한 확인
          if (window.location.pathname.startsWith('/admin') && data.role !== 'master-admin') {
            router.replace('/hakjeom')
            return
          }

          // 경영관리 경로 접근 시 admin 이상 권한 확인
          const isAdminRole = data.role === 'admin' || data.role === 'master-admin'
          const mgmtPaths = ['/revenues', '/approvals', '/reports']
          if (!isAdminRole && mgmtPaths.some(p => window.location.pathname.startsWith(p))) {
            router.replace('/hakjeom')
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

  const meta = PAGE_META[pathname] ?? { title: '관리' }

  return (
    <div className={styles.dashboardWrap}>
      <Header userName={displayName} userRole={userRole} />

      <div className={styles.dashboardBody}>
        <Sidebar userRole={userRole} permissions={permissions} />

        <main className={styles.mainContent}>
          {children}
        </main>
      </div>
    </div>
  )
}
