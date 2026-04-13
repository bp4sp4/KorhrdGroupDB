'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  GraduationCap, Briefcase, Users, UserCog, Trash2,
  HeartPulse, ClipboardList, Copy, TrendingUp, FileCheck, BarChart2, Settings, UserCheck, Plane, Link2,
} from 'lucide-react'
import styles from './layout.module.css'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  id: string
  label: string
  href: string
  icon: React.ReactNode
  activeOn?: string[]
  exactMatch?: boolean
  groupLabel?: string
}

interface NavSection {
  sectionKey: string
  activeOn: string[]
  items: NavItem[]
}

const ALL_SECTIONS: NavSection[] = [
  {
    sectionKey: '교육운영',
    activeOn: ['/hakjeom', '/cert', '/practice', '/allcare', '/abroad', '/duplicate', '/trash', '/ref-manage', '/logs', '/assignment', '/links'],
    items: [
      { id: 'education', label: '학점은행제 사업부', href: '/hakjeom', icon: <GraduationCap size={16} />, groupLabel: '학습/취업' },
      { id: 'cert', label: '민간자격증 사업부', href: '/cert', icon: <GraduationCap size={16} /> },
      { id: 'abroad', label: '한평생유학', href: '/abroad', icon: <Plane size={16} /> },
      { id: 'practice', label: '실습/취업', href: '/practice', icon: <Briefcase size={16} /> },
      { id: 'allcare', label: '올케어 관리자', href: '/allcare', icon: <HeartPulse size={16} /> },
      { id: 'duplicate', label: '중복 조회', href: '/duplicate', icon: <Copy size={16} />, groupLabel: '시스템' },
      { id: 'trash', label: '삭제목록', href: '/trash', icon: <Trash2 size={16} /> },
      { id: 'ref-manage', label: '어드민 관리', href: '/ref-manage', icon: <UserCog size={16} /> },
      { id: 'logs', label: '로그 관리', href: '/logs', icon: <ClipboardList size={16} /> },
      { id: 'assignment', label: '배정 현황', href: '/assignment', icon: <UserCheck size={16} /> },
      { id: 'links', label: '링크모음', href: '/links', icon: <Link2 size={16} /> },
    ],
  },
  {
    sectionKey: '경영관리',
    activeOn: ['/revenues', '/approvals', '/reports'],
    items: [
      { id: 'revenues', label: '매출 관리', href: '/revenues', icon: <TrendingUp size={16} />, groupLabel: '경영관리', exactMatch: true },
      { id: 'nms-sales', label: 'NMS 팀별 매출', href: '/revenues/nms-sales', icon: <TrendingUp size={16} /> },
      { id: 'approvals', label: '전자결재', href: '/approvals', icon: <FileCheck size={16} /> },
      { id: 'reports', label: '손익 리포트', href: '/reports', icon: <BarChart2 size={16} /> },
    ],
  },
  {
    sectionKey: '어드민',
    activeOn: ['/admin'],
    items: [
      { id: 'admin-settings', label: '시스템 설정', href: '/admin', icon: <Settings size={16} />, groupLabel: '관리자' },
      { id: 'admin-accounts', label: '계정 관리', href: '/admin?tab=accounts', icon: <Users size={16} /> },
    ],
  },
]

const MINI_ADMIN_ITEMS: NavItem[] = [
  { id: 'mini-admin', label: '결제확인', href: '/paymentstatus', icon: <Users size={16} /> },
]

const SECTION_ITEM_MAP: Record<string, string> = {
  hakjeom:    'education',
  cert:       'cert',
  abroad:     'abroad',
  practice:   'practice',
  allcare:    'allcare',
  duplicate:  'duplicate',
  trash:      'trash',
  logs:       'logs',
  'ref-manage': 'ref-manage',
  assignment: 'assignment',
}

interface SidebarProps {
  userRole?: string | null
  permissions?: { section: string; scope: string }[]
}

export default function Sidebar({ userRole, permissions = [] }: SidebarProps) {
  const pathname = usePathname()
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
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => fetchCount())
    })
    channel.subscribe()
    channelRef.current = channel

    return () => {
      clearInterval(interval)
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [userRole])

  const activeSection = ALL_SECTIONS.find((sec) =>
    sec.activeOn.some((p) => pathname.startsWith(p))
  )
  const isFullAccess = userRole === 'master-admin' || userRole === 'admin'
  const allowedSections = new Set(
    permissions.filter(p => p.scope && p.scope !== 'none').map(p => p.section)
  )

  const rawItems = userRole === 'mini-admin'
    ? MINI_ADMIN_ITEMS
    : (activeSection?.items ?? ALL_SECTIONS[0].items)

  const currentItems = isFullAccess
    ? rawItems
    : rawItems.filter(item => {
        const sectionKey = Object.entries(SECTION_ITEM_MAP).find(([, id]) => id === item.id)?.[0]
        if (!sectionKey) return true
        return allowedSections.has(sectionKey)
      })

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.sidebarNav}>
        <ul className={styles.sidebarList}>
          {currentItems.map((item) => {
            const isActive = item.exactMatch
              ? pathname === item.href
              : item.activeOn
                ? item.activeOn.some(p => pathname.startsWith(p))
                : pathname.startsWith(item.href)
            const isTrash = item.id === 'trash'

            return (
              <li key={item.id}>
                {item.groupLabel && (
                  <p className={styles.sidebarMenuLabel}>{item.groupLabel}</p>
                )}
                <Link
                  href={item.href}
                  className={`${styles.sidebarLink} ${isActive ? styles.sidebarLinkActive : ''}`}
                >
                  <span className={styles.sidebarLinkIcon}>{item.icon}</span>
                  <span className={styles.sidebarLinkLabel}>{item.label}</span>
                  {isTrash && trashCount > 0 && (
                    <span className={styles.sidebarBadge}>{trashCount}</span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className={styles.sidebarFooter}>
        <p className={styles.sidebarVersion}>v1.0.0</p>
      </div>
    </aside>
  )
}
