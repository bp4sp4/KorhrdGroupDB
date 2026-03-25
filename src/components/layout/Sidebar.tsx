'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { GraduationCap, FileText, Briefcase, ChevronLeft, ChevronRight, Users, UserCog, Trash2, HeartPulse, ClipboardList, Copy } from 'lucide-react'
import styles from './layout.module.css'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  id: string
  label: string
  href: string
  icon: React.ReactNode
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    id: 'hakjeom',
    label: '학점은행제 사업부',
    href: '/hakjeom',
    icon: <GraduationCap size={18} />,
  },
  {
    id: 'cert',
    label: '민간자격증 사업부',
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
    id: 'allcare',
    label: '올케어 관리자',
    href: '/allcare',
    icon: <HeartPulse size={18} />,
  },
  {
    id: 'duplicate',
    label: '중복 조회',
    href: '/duplicate',
    icon: <Copy size={18} />,
  },
  {
    id: 'trash',
    label: '삭제목록',
    href: '/trash',
    icon: <Trash2 size={18} />,
  },
  {
    id: 'ref-manage',
    label: '어드민 관리',
    href: '/ref-manage',
    icon: <UserCog size={18} />,
  },
  {
    id: 'logs',
    label: '로그 관리',
    href: '/logs',
    icon: <ClipboardList size={18} />,
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
  const [trashCount, setTrashCount] = useState<number>(0)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  useEffect(() => {
    if (userRole === 'mini-admin') return

    const fetchCount = () => {
      fetch('/api/trash')
        .then(r => r.ok ? r.json() : [])
        .then((data: unknown[]) => setTrashCount(Array.isArray(data) ? data.length : 0))
        .catch(() => {})
    }

    fetchCount()
    const interval = setInterval(fetchCount, 5000)

    const supabase = createClient()
    const tables = ['hakjeom_consultations', 'private_cert_consultations', 'certificate_applications', 'agency_agreements']
    const channel = supabase.channel('sidebar-trash-count')
    tables.forEach(table => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        fetchCount()
      })
    })
    channel.subscribe()
    channelRef.current = channel

    return () => {
      clearInterval(interval)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [userRole])

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
            const isTrash = item.id === 'trash'

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
                  {isTrash && !collapsed && trashCount > 0 && (
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: 11,
                      fontWeight: 600,
                      background: '#fee2e2',
                      color: '#dc2626',
                      padding: '1px 6px',
                      borderRadius: 10,
                      minWidth: 18,
                      textAlign: 'center',
                    }}>
                      {trashCount}
                    </span>
                  )}
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
