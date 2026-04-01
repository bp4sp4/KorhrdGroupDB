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
    activeOn: ['/hakjeom', '/cert', '/practice', '/allcare', '/duplicate', '/trash', '/ref-manage', '/logs'],
  },
  {
    label: '경영관리',
    href: '/revenues',
    activeOn: ['/revenues', '/approvals', '/reports'],
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
}

function getInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  if (/[\uAC00-\uD7A3]/.test(trimmed[0])) return trimmed[0]
  const words = trimmed.split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return trimmed[0].toUpperCase()
}

export default function Header({ userName = '관리자', userRole }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const initial = getInitial(userName)
  const isMiniAdmin = userRole === 'mini-admin'
  const isMasterAdmin = userRole === 'master-admin'

  // admin 이상인 경우 어드민 탭 표시 (접근 제한은 서버에서 처리)
  const isAdmin = userRole === 'admin' || isMasterAdmin

  const visibleSectionNav = SECTION_NAV.filter((sec) => {
    if (sec.href === '/admin') return isAdmin
    if (sec.href === '/revenues') return isAdmin
    return true
  })

  return (
    <header className={styles.header}>
      {/* 로고 */}
      <div className={styles.headerLogo}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="한평생교육 로고" className={styles.headerLogoImg} />
      </div>

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

        <div className={styles.avatar}>
          <span className={styles.avatarInitial}>{initial}</span>
        </div>

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
