'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { GraduationCap, FileText, Briefcase, ChevronLeft, ChevronRight, Users, UserCog } from 'lucide-react'
import styles from './layout.module.css'

interface NavItem {
  id: string
  label: string
  href: string
  icon: React.ReactNode
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    id: 'hakjeom',
    label: '학점은행제 상담신청',
    href: '/hakjeom',
    icon: <GraduationCap size={18} />,
  },
  {
    id: 'cert',
    label: '민간자격증',
    href: '/cert',
    icon: <FileText size={18} />,
  },
  {
    id: 'practice',
    label: '실습/취업',
    href: '/practice',
    icon: <Briefcase size={18} />,
  },
  {
    id: 'ref-manage',
    label: '미니어드민 관리',
    href: '/ref-manage',
    icon: <UserCog size={18} />,
  },
]

const MINI_ADMIN_NAV_ITEMS: NavItem[] = [
  {
    id: 'mini-admin',
    label: '결제확인',
    href: '/paymentstatus',
    icon: <Users size={18} />,
  },
]

interface SidebarProps {
  userRole?: string | null
}

export default function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const navItems = userRole === 'mini-admin' ? MINI_ADMIN_NAV_ITEMS : ADMIN_NAV_ITEMS

  return (
    <aside
      className={styles.sidebar}
      style={{ width: collapsed ? 80 : 'var(--toss-sidebar-width)' }}
    >
      {/* 로고 영역 */}
      <div className={`${styles.sidebarLogo} ${collapsed ? styles.sidebarLogoCollapsed : styles.sidebarLogoExpanded}`}>
        {!collapsed && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src="/logo.png" alt="한평생교육 로고" className={styles.sidebarLogoImg} />
        )}
        <button
          onClick={() => setCollapsed(v => !v)}
          className={styles.sidebarToggleBtn}
          title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* 네비게이션 메뉴 */}
      <nav className={`${styles.sidebarNav} ${collapsed ? styles.sidebarNavCollapsed : styles.sidebarNavExpanded}`}>
        {!collapsed && (
          <p className={styles.sidebarMenuLabel}>메뉴</p>
        )}

        <ul className={styles.sidebarList}>
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`${styles.sidebarLink} ${collapsed ? styles.sidebarLinkCollapsed : styles.sidebarLinkExpanded}`}
                  style={{
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--toss-blue)' : 'var(--toss-text-secondary)',
                    background: isActive ? 'var(--toss-blue-subtle)' : 'transparent',
                  }}
                >
                  <span
                    className={styles.sidebarLinkIcon}
                    style={{ color: isActive ? 'var(--toss-blue)' : 'var(--toss-text-tertiary)' }}
                  >
                    {item.icon}
                  </span>
                  <span className={styles.sidebarLinkLabel}>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 하단 버전 정보 */}
      <div className={`${styles.sidebarFooter} ${collapsed ? styles.sidebarFooterCollapsed : ''}`}>
        {!collapsed && (
          <p className={styles.sidebarVersion}>v1.0.0</p>
        )}
      </div>
    </aside>
  )
}
