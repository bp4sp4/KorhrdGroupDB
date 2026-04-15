'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from './layout.module.css'
import NotificationBell from './NotificationBell'
import QuickSearch from './QuickSearch'

interface NavSection {
  label: string
  href: string
  activeOn: string[]
}

const SECTION_NAV: NavSection[] = [
  {
    label: '교육운영',
    href: '/hakjeom',
    activeOn: ['/hakjeom', '/cert', '/practice', '/allcare', '/duplicate', '/trash', '/ref-manage', '/logs', '/links', '/revenues', '/approvals', '/reports'],
  },
  {
    label: '어드민',
    href: '/admin',
    activeOn: ['/admin'],
  },
]

interface HeaderProps {
  userName?: string
  userRole?: string | null
  permissions?: { section: string; scope: string }[]
}


function hasPermission(permissions: { section: string; scope: string }[], sections: string[]): boolean {
  return sections.some(s => permissions.some(p => p.section === s && p.scope !== 'none'))
}

const EDUCATION_SECTIONS = ['hakjeom', 'cert', 'practice', 'allcare', 'duplicate', 'trash', 'logs', 'ref-manage', 'assignment', 'approvals', 'revenues', 'reports']

export default function Header({ userName = '관리자', userRole, permissions = [] }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const isMiniAdmin = userRole === 'mini-admin'
  const isMasterAdmin = userRole === 'master-admin'
  const isAdminRole = userRole === 'admin' || isMasterAdmin

  const showEducation = isAdminRole || hasPermission(permissions, EDUCATION_SECTIONS)
  const showAdmin = isAdminRole

  const visibleSectionNav = SECTION_NAV.filter((sec) => {
    if (sec.href === '/admin') return showAdmin
    if (sec.href === '/hakjeom') return showEducation
    return true
  })

  return (
    <header className={styles.header}>
      {/* 로고 */}
      <Link href="/hakjeom" className={styles.headerLogo}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="한평생교육 로고" className={styles.headerLogoImg} />
      </Link>

      {/* 섹션 네비게이션 */}
      {!isMiniAdmin && (
        <nav className={styles.headerNav}>
          {visibleSectionNav.map((sec) => {
            const isActive = sec.activeOn.some((p) => pathname.startsWith(p))
            return (
              <Link
                key={sec.label}
                href={sec.href}
                className={`${styles.headerNavItem} ${isActive ? styles.headerNavItemActive : ''}`}
              >
                {sec.label}
              </Link>
            )
          })}
        </nav>
      )}

      <div className={styles.headerNavSpacer} />

      {/* 우측 액션 */}
      <div className={styles.headerRight}>
        <QuickSearch />

        <div className={styles.headerDivider} />

        <NotificationBell />

        <div className={styles.headerDivider} />

     

        <span className={styles.headerUserName}>{userName}</span>

        <div className={styles.headerDivider} />

        <button onClick={handleLogout} className={styles.logoutBtn}>
          <LogOut size={14} />
          로그아웃
        </button>
      </div>
    </header>
  )
}
