'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  GraduationCap, Users, UserCog, Trash2,
  ClipboardList, Copy, TrendingUp, FileCheck, BarChart2, Settings, UserCheck, Plane, Link2, ChevronRight, Upload, Landmark, Megaphone,
} from 'lucide-react'
import styles from './layout.module.css'
import { createClient } from '@/lib/supabase/client'

interface NavSubItem {
  id: string
  label: string
  href: string
  sectionLabel?: string
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
    activeOn: ['/hakjeom', '/cert', '/practice', '/allcare', '/abroad', '/revenues', '/revenue-upload', '/approvals', '/reports', '/bankaccount', '/marketing', '/duplicate', '/trash', '/ref-manage', '/logs', '/assignment', '/links'],
    items: [
      {
        id: 'education', label: '학점은행제 사업부', href: '/hakjeom', icon: <GraduationCap size={16} />, groupLabel: '사업부서',
        activeOn: ['/hakjeom', '/allcare'],
        children: [
          { id: 'hakjeom-tab-hakjeom',      label: '문의DB',     href: '/hakjeom?tab=hakjeom' },
          { id: 'hakjeom-tab-edu-students', label: '등록학생관리', href: '/hakjeom?tab=edu-students' },
          { id: 'hakjeom-tab-agency',       label: '기관협약',   href: '/hakjeom?tab=agency' },
          { id: 'hakjeom-tab-bulk',         label: '일괄등록',   href: '/hakjeom?tab=bulk' },
          { id: 'hakjeom-tab-counsel_done', label: '연락예정',   href: '/hakjeom?tab=counsel_done' },
          { id: 'hakjeom-tab-stats',        label: '통계',       href: '/hakjeom?tab=stats' },
          { id: 'allcare-tab-users',    label: '올케어 회원목록', href: '/allcare?tab=users' },
          { id: 'allcare-tab-payments', label: '올케어 결제내역', href: '/allcare?tab=payments' },
          { id: 'allcare-tab-stats',    label: '올케어 통계',     href: '/allcare?tab=stats' },
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
        id: 'management', label: '경영지원본부', href: '/revenues/nms-sales', icon: <TrendingUp size={16} />, groupLabel: '지원부서',
        activeOn: ['/revenues', '/revenue-upload', '/bankaccount', '/approvals', '/reports'],
        children: [
          { id: 'management-nms-sales',      label: '팀별 매출 관리',   href: '/revenues/nms-sales' },
          { id: 'management-revenue-upload', label: '매출 데이터 관리', href: '/revenue-upload' },
          { id: 'management-bankaccount',    label: '계좌조회',         href: '/bankaccount' },
          { id: 'management-approvals',      label: '전자결재',         href: '/approvals' },
          { id: 'management-reports',        label: '손익 리포트',      href: '/reports' },
        ],
      },
      {
        id: 'marketing', label: '마케팅개발본부', href: '/marketing', icon: <Megaphone size={16} />,
        children: [
          { id: 'marketing-nms-channel',    label: '채널별 성과', href: '/marketing?tab=nms-channel',    sectionLabel: '학점은행제' },
          { id: 'marketing-nms-creative',   label: '소재별 성과', href: '/marketing?tab=nms-creative' },
          { id: 'marketing-nms-dashboard',  label: '대시보드',    href: '/marketing?tab=nms-dashboard' },
          { id: 'marketing-cert-channel',   label: '채널별 성과', href: '/marketing?tab=cert-channel',   sectionLabel: '민간자격증' },
          { id: 'marketing-cert-creative',  label: '소재별 성과', href: '/marketing?tab=cert-creative' },
          { id: 'marketing-cert-dashboard', label: '대시보드',    href: '/marketing?tab=cert-dashboard' },
          { id: 'marketing-abroad-channel',   label: '채널별 성과', href: '/marketing?tab=abroad-channel',   sectionLabel: '유학' },
          { id: 'marketing-abroad-creative',  label: '소재별 성과', href: '/marketing?tab=abroad-creative' },
          { id: 'marketing-abroad-dashboard', label: '대시보드',    href: '/marketing?tab=abroad-dashboard' },
          { id: 'marketing-mom-cafe',         label: '맘카페 관리', href: '/marketing?tab=mom-cafe',         sectionLabel: '맘카페' },
        ],
      },
      { id: 'duplicate', label: '중복 조회', href: '/duplicate', icon: <Copy size={16} />, groupLabel: '시스템' },
      { id: 'trash', label: '삭제목록', href: '/trash', icon: <Trash2 size={16} /> },
      { id: 'ref-manage', label: '어드민 관리', href: '/ref-manage', icon: <UserCog size={16} /> },
      { id: 'logs', label: '로그 관리', href: '/logs', icon: <ClipboardList size={16} /> },
      { id: 'assignment', label: '배정 현황', href: '/assignment', icon: <UserCheck size={16} /> },
      { id: 'links', label: '링크모음', href: '/links', icon: <Link2 size={16} /> },
    ],
  },
  {
    sectionKey: '어드민',
    activeOn: ['/admin'],
    items: [
      { id: 'admin-settings', label: '시스템 설정', href: '/admin', icon: <Settings size={16} />, groupLabel: '관리자', exactMatch: true },
      { id: 'admin-approval-forms', label: '결재 양식 관리', href: '/admin/approval-forms', icon: <FileCheck size={16} /> },
    ],
  },
]

const MINI_ADMIN_ITEMS: NavItem[] = [
  { id: 'mini-admin', label: '결제확인', href: '/paymentstatus', icon: <Users size={16} /> },
]

const SECTION_ITEM_MAP: Record<string, string> = {
  hakjeom:          'education',
  cert:             'cert',
  abroad:           'abroad',
  practice:         'practice',
  allcare:          'education',
  revenues:         'management',
  'revenue-upload': 'management',
  bankaccount:      'management',
  approvals:        'management',
  reports:          'management',
  marketing:        'marketing',
  duplicate:        'duplicate',
  trash:            'trash',
  logs:             'logs',
  'ref-manage':     'ref-manage',
  assignment:       'assignment',
  links:            'links',
}

interface SidebarProps {
  userRole?: string | null
  permissions?: { section: string; scope: string; allowed_tabs?: string[] | null }[]
  revenueOwnDivisions?: ('nms' | 'cert' | 'abroad')[]
}

export default function Sidebar({ userRole, permissions = [], revenueOwnDivisions = [] }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [trashCount, setTrashCount] = useState<number>(0)
  const [counselCount, setCounselCount] = useState<number>(0)
  const [certCounselCount, setCertCounselCount] = useState<number>(0)
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const toggleItem = (id: string) => {
    setOpenItems(prev => prev.has(id) ? new Set() : new Set([id]))
  }

  useEffect(() => {
    if (userRole === 'mini-admin') return

    const fetchHakjeomCount = () => {
      fetch('/api/hakjeom/counsel-count')
        .then(r => r.ok ? r.json() : { count: 0 })
        .then((data: { count: number }) => setCounselCount(data.count ?? 0))
        .catch(() => {})
    }

    const fetchCertCount = () => {
      fetch('/api/cert/students/counsel-count')
        .then(r => r.ok ? r.json() : { count: 0 })
        .then((data: { count: number }) => setCertCounselCount(data.count ?? 0))
        .catch(() => {})
    }

    fetchHakjeomCount()
    fetchCertCount()

    const supabase = createClient()
    const channel = supabase.channel('sidebar-counsel-count')
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'hakjeom_consultations' }, fetchHakjeomCount)
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'cert_students' }, fetchCertCount)
    channel.subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userRole])

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
  const revenueScope = permissions.find(p => p.section === 'revenues')?.scope ?? 'none'

  const rawItems = userRole === 'mini-admin'
    ? MINI_ADMIN_ITEMS
    : (activeSection?.items ?? ALL_SECTIONS[0].items)

  const baseItems = isFullAccess
    ? rawItems
    : rawItems.filter(item => {
        // 같은 item.id에 여러 section이 매핑될 수 있음 (예: management = revenues+approvals+reports+...)
        // 그 중 하나라도 허용된 section이 있으면 부모 메뉴를 보여줌
        const matchingSections = Object.entries(SECTION_ITEM_MAP)
          .filter(([, id]) => id === item.id)
          .map(([sec]) => sec)
        if (matchingSections.length === 0) return true
        return matchingSections.some(sec => allowedSections.has(sec))
      })

  // section -> 해당 section item 의 children 에 적용할 allowed_tabs (NavSubItem.id 기준)
  // NOTE: education 아이템에는 hakjeom 권한의 allowed_tabs 가 적용됨
  //       (allcare-tab-* 자식들은 권한 매핑상 'allcare' section 이지만, education 자식 풀에서 hakjeom 권한 기준으로 함께 필터)
  const allowedTabsBySection = new Map<string, Set<string> | null>()
  for (const p of permissions) {
    if (p.allowed_tabs && Array.isArray(p.allowed_tabs)) {
      allowedTabsBySection.set(p.section, new Set(p.allowed_tabs))
    } else {
      allowedTabsBySection.set(p.section, null) // null = 전체 허용
    }
  }

  /** itemId(NavItem.id) → 해당 item 의 자식 필터에 적용할 sectionKey */
  const itemIdToSection: Record<string, string> = {
    education: 'hakjeom',
    cert: 'cert',
    abroad: 'abroad',
  }

  /** 경영지원본부(management) 자식 menu id → section 매핑 */
  const managementChildSection: Record<string, string> = {
    'management-nms-sales':      'revenues',
    'management-revenue-upload': 'revenue-upload',
    'management-bankaccount':    'bankaccount',
    'management-approvals':      'approvals',
    'management-reports':        'reports',
  }

  const currentItems = baseItems
    .map(item => {
      if (!item.children) return item

      // (0) 경영지원본부 — 자식별 section 권한에 따라 필터
      if (item.id === 'management' && !isFullAccess) {
        const filteredChildren = item.children.filter(child => {
          const sec = managementChildSection[child.id]
          if (!sec) return true
          return allowedSections.has(sec)
        })
        return { ...item, children: filteredChildren }
      }

      // (1) 매출 관리 — 기존 own scope 분기 유지
      if (item.id === 'nms-sales') {
        if (isFullAccess || revenueScope !== 'own') return item
        const allowedRevenueTabs = new Set(
          revenueOwnDivisions.length > 1
            ? ['nms-sales-tab-stats', ...revenueOwnDivisions.map(division => `nms-sales-tab-${division}`)]
            : revenueOwnDivisions.map(division => `nms-sales-tab-${division}`)
        )
        const filteredChildren = item.children.filter(child => allowedRevenueTabs.has(child.id))
        return { ...item, children: filteredChildren }
      }

      // (2) 권한 기반 자식 필터 (full access 면 스킵)
      if (isFullAccess) return item

      const sectionForTabs = itemIdToSection[item.id]
      if (!sectionForTabs) return item

      const allowed = allowedTabsBySection.get(sectionForTabs)
      // null 또는 없음 = 전체 허용 → 그대로
      if (allowed === undefined || allowed === null) return item

      // 권한 시스템에 등록된 탭 ID 목록 — 이 목록에 없는 탭은 새로 추가된 탭으로 간주해 자동 허용
      const MANAGED_TAB_IDS: Record<string, Set<string>> = {
        hakjeom: new Set([
          'hakjeom-tab-hakjeom', 'hakjeom-tab-edu-students', 'hakjeom-tab-agency',
          'hakjeom-tab-bulk', 'hakjeom-tab-counsel_done', 'hakjeom-tab-stats',
          'allcare-tab-users', 'allcare-tab-payments', 'allcare-tab-stats',
        ]),
        cert: new Set([
          'cert-tab-hakjeom', 'cert-tab-edu', 'cert-tab-private-cert',
          'cert-tab-student-mgmt', 'cert-tab-student-contact', 'cert-tab-student-bulk', 'cert-tab-stats',
        ]),
        abroad: new Set([
          'abroad-tab-users', 'abroad-tab-consult', 'abroad-tab-applications', 'abroad-tab-payments',
        ]),
      }

      const managedSet = MANAGED_TAB_IDS[sectionForTabs]
      const filteredChildren = item.children.filter(child =>
        allowed.has(child.id) || !managedSet?.has(child.id)
      )
      return { ...item, children: filteredChildren }
    })
    .filter(item => !item.children || item.children.length > 0)

  // 현재 경로에 맞는 아이템 자동 펼치기
  useEffect(() => {
    for (const item of currentItems) {
      if (!item.children) continue
      const isParentActive = item.activeOn
        ? item.activeOn.some(p => pathname.startsWith(p))
        : pathname.startsWith(item.href.split('?')[0])
      if (isParentActive) {
        setTimeout(() => {
          setOpenItems(prev => new Set([...prev, item.id]))
        }, 0)
        break
      }
    }
  }, [pathname, searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.sidebarNav}>
        <ul className={styles.sidebarList}>
          {currentItems.map((item) => {
            const [basePath, itemQuery = ''] = item.href.split('?')
            const itemTab = new URLSearchParams(itemQuery).get('tab')
            const currentTabParam = searchParams.get('tab')

            // 동일 basePath 안에서 tab 으로 구분되는 형제가 있는지 확인
            const siblingsOnSameBase = currentItems.filter(other => other.href.split('?')[0] === basePath)
            const siblingTabs = siblingsOnSameBase
              .map(s => new URLSearchParams(s.href.split('?')[1] ?? '').get('tab'))
              .filter((t): t is string => !!t)

            const pathMatches = item.exactMatch
              ? pathname === basePath
              : item.activeOn
                ? item.activeOn.some(p => pathname.startsWith(p))
                : pathname.startsWith(basePath)

            let tabMatches = true
            if (siblingsOnSameBase.length > 1) {
              if (itemTab) {
                tabMatches = currentTabParam === itemTab
              } else {
                // tab 없는 기본 항목: 현재 tab 이 형제 tab 중 하나이면 비활성
                tabMatches = !currentTabParam || !siblingTabs.includes(currentTabParam)
              }
            }

            const isPathActive = pathMatches && tabMatches
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
                          const childBasePath = child.href.split('?')[0]
                          const childTab = new URLSearchParams(child.href.split('?')[1] ?? '').get('tab')
                          const isChildActive =
                            (childBasePath === basePath && pathname.startsWith(basePath) && activeChildHref === child.href) ||
                            (childBasePath !== basePath && pathname.startsWith(childBasePath) && (childTab === null || searchParams.get('tab') === childTab))
                          const isCounselDone = child.id === 'hakjeom-tab-counsel_done'
                          const isCertCounsel = child.id === 'cert-tab-student-contact'
                          return (
                            <li key={child.id}>
                              {child.sectionLabel && (
                                <p className={styles.sidebarSubSectionLabel}>{child.sectionLabel}</p>
                              )}
                              <Link
                                href={child.href}
                                className={`${styles.sidebarSubLink} ${isChildActive ? styles.sidebarSubLinkActive : ''}`}
                              >
                                {child.label}
                                {isCounselDone && counselCount > 0 && (
                                  <span className={styles.sidebarBadge}>{counselCount}</span>
                                )}
                                {isCertCounsel && certCounselCount > 0 && (
                                  <span className={styles.sidebarBadge}>{certCounselCount}</span>
                                )}
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
    </aside>
  )
}
