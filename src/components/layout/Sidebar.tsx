'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  GraduationCap, Briefcase, Users, UserCog, Trash2,
  HeartPulse, ClipboardList, Copy, TrendingUp, FileCheck, BarChart2, Settings, UserCheck, Plane, Link2, ChevronRight,
} from 'lucide-react'
import styles from './layout.module.css'
import { createClient } from '@/lib/supabase/client'

interface NavSubItem {
  id: string
  label: string
  href: string
}

interface NavItem {
  id: string
  label: string
  href: string
  icon: React.ReactNode
  activeOn?: string[]
  exactMatch?: boolean
  groupLabel?: string
  children?: NavSubItem[]
}

interface NavSection {
  sectionKey: string
  activeOn: string[]
  items: NavItem[]
}

const ALL_SECTIONS: NavSection[] = [
  {
    sectionKey: '교육운영',
    activeOn: ['/hakjeom', '/cert', '/practice', '/allcare', '/abroad', '/duplicate', '/trash', '/ref-manage', '/logs', '/assignment', '/links', '/revenues', '/approvals', '/reports'],
    items: [
      {
        id: 'education', label: '학점은행제 사업부', href: '/hakjeom', icon: <GraduationCap size={16} />, groupLabel: '학습/취업',
        children: [
          { id: 'hakjeom-tab-hakjeom',      label: '학점은행제', href: '/hakjeom?tab=hakjeom' },
          { id: 'hakjeom-tab-agency',       label: '기관협약',   href: '/hakjeom?tab=agency' },
          { id: 'hakjeom-tab-bulk',         label: '일괄등록',   href: '/hakjeom?tab=bulk' },
          { id: 'hakjeom-tab-counsel_done', label: '연락예정',   href: '/hakjeom?tab=counsel_done' },
          { id: 'hakjeom-tab-stats',        label: '통계',       href: '/hakjeom?tab=stats' },
        ],
      },
      {
        id: 'cert', label: '민간자격증 사업부', href: '/cert', icon: <GraduationCap size={16} />,
        children: [
          { id: 'cert-tab-hakjeom',         label: '학점연계 신청', href: '/cert?tab=hakjeom' },
          { id: 'cert-tab-edu',             label: '교육원',        href: '/cert?tab=edu' },
          { id: 'cert-tab-private-cert',    label: '민간자격증',    href: '/cert?tab=private-cert' },
          { id: 'cert-tab-student-mgmt',    label: '학생관리',      href: '/cert?tab=student-mgmt' },
          { id: 'cert-tab-student-contact', label: '연락예정',      href: '/cert?tab=student-contact' },
          { id: 'cert-tab-student-bulk',    label: '일괄등록',      href: '/cert?tab=student-bulk' },
          { id: 'cert-tab-stats',           label: '통계',          href: '/cert?tab=stats' },
        ],
      },
      {
        id: 'abroad', label: '유학 사업부', href: '/abroad', icon: <Plane size={16} />,
        children: [
          { id: 'abroad-tab-users',        label: '회원 목록',   href: '/abroad?tab=users' },
          { id: 'abroad-tab-consult',      label: '간편상담',    href: '/abroad?tab=consult' },
          { id: 'abroad-tab-applications', label: '신청서 목록', href: '/abroad?tab=applications' },
          { id: 'abroad-tab-payments',     label: '결제 목록',   href: '/abroad?tab=payments' },
        ],
      },
      {
        id: 'practice', label: '실습/취업', href: '/practice', icon: <Briefcase size={16} />,
        children: [
          { id: 'practice-tab-consultation', label: '상담신청',     href: '/practice?tab=consultation' },
          { id: 'practice-tab-practice',     label: '실습섭외신청', href: '/practice?tab=practice' },
          { id: 'practice-tab-employment',   label: '취업신청',     href: '/practice?tab=employment' },
        ],
      },
      {
        id: 'allcare', label: '올케어 관리자', href: '/allcare', icon: <HeartPulse size={16} />,
        children: [
          { id: 'allcare-tab-users',    label: '회원 목록', href: '/allcare?tab=users' },
          { id: 'allcare-tab-payments', label: '결제 내역', href: '/allcare?tab=payments' },
          { id: 'allcare-tab-stats',    label: '통계',      href: '/allcare?tab=stats' },
        ],
      },
      { id: 'duplicate', label: '중복 조회', href: '/duplicate', icon: <Copy size={16} />, groupLabel: '시스템' },
      { id: 'trash', label: '삭제목록', href: '/trash', icon: <Trash2 size={16} /> },
      { id: 'ref-manage', label: '어드민 관리', href: '/ref-manage', icon: <UserCog size={16} /> },
      { id: 'logs', label: '로그 관리', href: '/logs', icon: <ClipboardList size={16} /> },
      { id: 'assignment', label: '배정 현황', href: '/assignment', icon: <UserCheck size={16} /> },
      { id: 'links', label: '링크모음', href: '/links', icon: <Link2 size={16} /> },
      {
        id: 'nms-sales', label: '팀별 매출 관리', href: '/revenues/nms-sales', icon: <TrendingUp size={16} />, groupLabel: '경영관리',
        children: [
          { id: 'nms-sales-tab-nms',    label: '학점은행제', href: '/revenues/nms-sales?tab=nms' },
          { id: 'nms-sales-tab-cert',   label: '민간자격증', href: '/revenues/nms-sales?tab=cert' },
          { id: 'nms-sales-tab-abroad', label: '유학',       href: '/revenues/nms-sales?tab=abroad' },
          { id: 'nms-sales-tab-stats',  label: '통합 통계',  href: '/revenues/nms-sales?tab=stats' },
        ],
      },
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
  revenues:   'nms-sales',
  approvals:  'approvals',
  reports:    'reports',
}

interface SidebarProps {
  userRole?: string | null
  permissions?: { section: string; scope: string }[]
}

export default function Sidebar({ userRole, permissions = [] }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [trashCount, setTrashCount] = useState<number>(0)
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const toggleItem = (id: string) => {
    setOpenItems(prev => prev.has(id) ? new Set() : new Set([id]))
  }

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

  // 현재 경로에 맞는 아이템 자동 펼치기
  useEffect(() => {
    const currentTab = searchParams.get('tab')
    for (const item of currentItems) {
      if (!item.children) continue
      const isParentActive = pathname.startsWith(item.href.split('?')[0])
      if (isParentActive) {
        setOpenItems(prev => new Set([...prev, item.id]))
        break
      }
    }
  }, [pathname, searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.sidebarNav}>
        <ul className={styles.sidebarList}>
          {currentItems.map((item) => {
            const basePath = item.href.split('?')[0]
            const isPathActive = item.exactMatch
              ? pathname === basePath
              : item.activeOn
                ? item.activeOn.some(p => pathname.startsWith(p))
                : pathname.startsWith(basePath)
            const isTrash = item.id === 'trash'
            const hasChildren = item.children && item.children.length > 0
            const isOpen = openItems.has(item.id)

            // 서브 아이템 중 현재 활성 탭 확인
            const currentTab = searchParams.get('tab')
            const activeChildHref = hasChildren
              ? `${basePath}?tab=${currentTab}`
              : null

            return (
              <li key={item.id}>
                {item.groupLabel && (
                  <p className={styles.sidebarMenuLabel}>{item.groupLabel}</p>
                )}

                {hasChildren ? (
                  <>
                    <button
                      className={`${styles.sidebarParentBtn} ${isPathActive ? styles.sidebarParentBtnActive : ''}`}
                      onClick={() => toggleItem(item.id)}
                    >
                      <span className={styles.sidebarLinkIcon}>{item.icon}</span>
                      <span className={styles.sidebarLinkLabel}>{item.label}</span>
                      <span className={`${styles.sidebarChevron} ${isOpen ? styles.sidebarChevronOpen : ''}`}>
                        <ChevronRight size={13} />
                      </span>
                    </button>
                    {isOpen && (
                      <ul className={styles.sidebarSubList}>
                        {item.children!.map(child => {
                          const isChildActive = activeChildHref === child.href && isPathActive
                          return (
                            <li key={child.id}>
                              <Link
                                href={child.href}
                                className={`${styles.sidebarSubLink} ${isChildActive ? styles.sidebarSubLinkActive : ''}`}
                              >
                                {child.label}
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={`${styles.sidebarLink} ${isPathActive ? styles.sidebarLinkActive : ''}`}
                  >
                    <span className={styles.sidebarLinkIcon}>{item.icon}</span>
                    <span className={styles.sidebarLinkLabel}>{item.label}</span>
                    {isTrash && trashCount > 0 && (
                      <span className={styles.sidebarBadge}>{trashCount}</span>
                    )}
                  </Link>
                )}
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
