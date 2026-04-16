'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/client'
import styles from '@/components/layout/layout.module.css'

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
  const [permissions, setPermissions] = useState<{ section: string; scope: string; allowed_tabs?: string[] | null }[]>([])
  const supabase = createClient()

  const refreshMe = useCallback(async () => {
    let role = 'admin'
    let perms: { section: string; scope: string; allowed_tabs?: string[] | null }[] = []
    let name = '관리자'
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        role = data.role ?? 'admin'
        perms = data.permissions ?? []
        name = data.displayName ?? '관리자'
      }
    } catch {
      // keep defaults
    }
    setUserRole(role)
    setDisplayName(name)
    setPermissions(perms)
  }, [])

  // 1) 최초 1회: 세션 확인 + 유저 정보 로드
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }
      await refreshMe()
      // isChecking은 effect 2에서 처리
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMe])

  useEffect(() => {
    const handlePermissionsUpdated = () => {
      void refreshMe()
    }

    window.addEventListener('permissions-updated', handlePermissionsUpdated)
    return () => {
      window.removeEventListener('permissions-updated', handlePermissionsUpdated)
    }
  }, [refreshMe])

  // 2) 권한 체크 + 리다이렉트 — userRole/permissions/pathname 바뀔 때마다 실행
  useEffect(() => {
    if (!userRole) return

    const SECTION_PATHS = [
      { section: 'hakjeom',   path: '/hakjeom' },
      { section: 'cert',      path: '/cert' },
      { section: 'practice',  path: '/practice' },
      { section: 'allcare',   path: '/allcare' },
      { section: 'abroad',    path: '/abroad' },
      { section: 'approvals', path: '/approvals' },
      { section: 'revenues',  path: '/revenues' },
      { section: 'revenue-upload', path: '/revenue-upload' },
    ]
    const PERM_PATHS: { path: string; section: string }[] = [
      { path: '/assignment', section: 'assignment' },
      { path: '/duplicate',  section: 'duplicate' },
      { path: '/trash',      section: 'trash' },
      { path: '/logs',       section: 'logs' },
      { path: '/ref-manage', section: 'ref-manage' },
      { path: '/allcare',    section: 'allcare' },
      { path: '/abroad',     section: 'abroad' },
      { path: '/hakjeom',    section: 'hakjeom' },
      { path: '/cert',       section: 'cert' },
      { path: '/practice',   section: 'practice' },
      { path: '/approvals',  section: 'approvals' },
      { path: '/revenues',   section: 'revenues' },
      { path: '/revenue-upload', section: 'revenue-upload' },
      { path: '/reports',    section: 'reports' },
    ]

    if (userRole === 'mini-admin' && !pathname.startsWith('/mini-admin') && !pathname.startsWith('/paymentstatus')) {
      router.replace('/paymentstatus')
      return
    }

    if (pathname.startsWith('/admin') && userRole !== 'master-admin') {
      router.replace('/hakjeom')
      return
    }

    const isAdminRole = userRole === 'admin' || userRole === 'master-admin'
    if (!isAdminRole) {
      const getFirstAllowedPath = () => {
        for (const { section, path } of SECTION_PATHS) {
          if (permissions.some(p => p.section === section && p.scope && p.scope !== 'none')) return path
        }
        return null
      }
      for (const { path, section } of PERM_PATHS) {
        if (pathname.startsWith(path)) {
          const perm = permissions.find(p => p.section === section)
          if (!perm || perm.scope === 'none' || !perm.scope) {
            const fallback = getFirstAllowedPath()
            if (fallback && fallback !== pathname) {
              router.replace(fallback)
              return
            }
          }
          break
        }
      }
    }

    // 리다이렉트 없이 여기까지 오면 권한 OK → 콘텐츠 표시
    setIsChecking(false)
  }, [pathname, userRole, permissions, router])

  if (isChecking) {
    return (
      <div className={styles.loadingWrap}>
        <p className={styles.loadingText}>로딩 중...</p>
      </div>
    )
  }

  return (
    <div className={styles.dashboardWrap}>
      <Header userName={displayName} userRole={userRole} permissions={permissions} />

      <div className={styles.dashboardBody}>
        <Sidebar userRole={userRole} permissions={permissions} />

        <main className={`${styles.mainContent}${pathname.startsWith('/approvals') ? ` ${styles.mainContentWhite}` : ''}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
