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
  '/assignment':   { title: '배정 현황',    section: '시스템' },
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

  // 1) 최초 1회: 세션 확인 + 유저 정보 로드
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          setUserRole(data.role ?? 'admin')
          setDisplayName(data.displayName ?? '관리자')
          setPermissions(data.permissions ?? [])
        } else {
          setUserRole('admin')
        }
      } catch {
        setUserRole('admin')
      }
      setIsChecking(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2) 페이지 이동할 때마다: 권한 기반 리다이렉트
  useEffect(() => {
    if (isChecking || !userRole) return

    if (userRole === 'mini-admin' && !pathname.startsWith('/mini-admin') && !pathname.startsWith('/paymentstatus')) {
      router.replace('/paymentstatus')
      return
    }

    if (pathname.startsWith('/admin') && userRole !== 'master-admin') {
      router.replace('/hakjeom')
      return
    }

    const isAdminRole = userRole === 'admin' || userRole === 'master-admin'
    const mgmtPaths = ['/revenues', '/approvals', '/reports']
    if (!isAdminRole && mgmtPaths.some(p => pathname.startsWith(p))) {
      router.replace('/hakjeom')
      return
    }

    if (!isAdminRole) {
      const PERM_PATHS: { path: string; section: string }[] = [
        { path: '/assignment', section: 'assignment' },
        { path: '/duplicate',  section: 'duplicate' },
        { path: '/trash',      section: 'trash' },
        { path: '/logs',       section: 'logs' },
        { path: '/ref-manage', section: 'ref-manage' },
      ]
      for (const { path, section } of PERM_PATHS) {
        if (pathname.startsWith(path)) {
          const perm = permissions.find(p => p.section === section)
          if (!perm || perm.scope === 'none' || !perm.scope) {
            router.replace('/hakjeom')
          }
          break
        }
      }
    }
  }, [pathname, userRole, permissions, isChecking, router])

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

        <main className={`${styles.mainContent}${pathname.startsWith('/approvals') ? ` ${styles.mainContentWhite}` : ''}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
