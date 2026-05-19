'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import GuideProvider from '@/components/guide/GuideProvider'
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
  const [revenueOwnDivisions, setRevenueOwnDivisions] = useState<('nms' | 'cert' | 'abroad')[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hrRecordStatus, setHrRecordStatus] = useState<'unknown' | 'approved' | 'blocked'>('unknown')
  const supabase = createClient()

  const refreshMe = useCallback(async () => {
    let role = 'admin'
    let perms: { section: string; scope: string; allowed_tabs?: string[] | null }[] = []
    let name = '관리자'
    let divisions: ('nms' | 'cert' | 'abroad')[] = []
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        role = data.role ?? 'admin'
        perms = data.permissions ?? []
        name = data.displayName ?? '관리자'
        divisions = Array.isArray(data.revenueOwnDivisions)
          ? data.revenueOwnDivisions.filter((division: string): division is 'nms' | 'cert' | 'abroad' => (
              division === 'nms' || division === 'cert' || division === 'abroad'
            ))
          : []
      }
    } catch {
      // keep defaults
    }
    setUserRole(role)
    setDisplayName(name)
    setPermissions(perms)
    setRevenueOwnDivisions(divisions)

    // 인사기록카드 승인 여부 — master-admin은 체크 생략, exempt=true 도 우회
    if (role === 'master-admin') {
      setHrRecordStatus('approved')
    } else {
      try {
        const hrRes = await fetch('/api/hr-records/me', { cache: 'no-store' })
        if (hrRes.ok) {
          const d = await hrRes.json()
          // 면제 플래그가 켜져있으면 작성 강제 우회
          if (d?.exempt === true) {
            setHrRecordStatus('approved')
          } else {
            setHrRecordStatus(
              d?.record?.status === 'approved' ? 'approved' : 'blocked',
            )
          }
        } else {
          setHrRecordStatus('blocked')
        }
      } catch {
        setHrRecordStatus('blocked')
      }
    }
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
    // 작성 페이지에서 제출/저장 직후 즉시 가드 갱신용 (같은 탭)
    const handleHrUpdated = () => {
      void refreshMe()
    }

    window.addEventListener('permissions-updated', handlePermissionsUpdated)
    window.addEventListener('hr-record-updated', handleHrUpdated)
    return () => {
      window.removeEventListener('permissions-updated', handlePermissionsUpdated)
      window.removeEventListener('hr-record-updated', handleHrUpdated)
    }
  }, [refreshMe])

  // hr_records Realtime 구독 — 어드민 승인/반려/타사용자 작성 즉시 반영
  useEffect(() => {
    const channel = supabase
      .channel('hr-records-self')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hr_records' },
        () => {
          // 어떤 행이든 변경되면 자기 상태 다시 확인 (서버에서 user_id 매칭)
          void refreshMe()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      { path: '/reports',      section: 'reports' },
      { path: '/bankaccount',  section: 'bankaccount' },
    ]

    if (userRole === 'mini-admin' && !pathname.startsWith('/mini-admin') && !pathname.startsWith('/paymentstatus')) {
      router.replace('/paymentstatus')
      return
    }

    if (pathname.startsWith('/admin') && userRole !== 'master-admin') {
      router.replace('/hakjeom')
      return
    }

    // 인사기록카드 승인 가드 — master-admin 제외
    // 승인 안 됐고, 인사기록카드 작성 페이지가 아니면 강제 리다이렉트
    if (
      userRole !== 'master-admin' &&
      hrRecordStatus === 'blocked' &&
      !pathname.startsWith('/me/hr-record')
    ) {
      router.replace('/me/hr-record')
      return
    }
    // hr 상태 로드 전(unknown)에는 차단 화면을 보여주지 않게 진행 보류
    if (userRole !== 'master-admin' && hrRecordStatus === 'unknown') {
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
  }, [pathname, userRole, permissions, hrRecordStatus, router])

  if (isChecking) {
    return (
      <div className={styles.loadingWrap}>
        <p className={styles.loadingText}>로딩 중...</p>
      </div>
    )
  }

  return (
    <GuideProvider>
      <div className={styles.dashboardWrap}>
        <Header userName={displayName} userRole={userRole} permissions={permissions} revenueOwnDivisions={revenueOwnDivisions} onMenuToggle={() => setSidebarOpen(v => !v)} />

        <div className={styles.dashboardBody}>
          <Sidebar userRole={userRole} permissions={permissions} revenueOwnDivisions={revenueOwnDivisions} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          {sidebarOpen && (
            <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
          )}

          <main className={`${styles.mainContent}${pathname.startsWith('/approvals') ? ` ${styles.mainContentWhite}` : ''}`}>
            {children}
          </main>
        </div>
      </div>
    </GuideProvider>
  )
}
