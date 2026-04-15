'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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

// 탭 없는 단일 페이지 레이블
const PATH_LABELS: Record<string, string> = {
  '/duplicate':  '중복 조회',
  '/trash':      '삭제목록',
  '/ref-manage': '어드민 관리',
  '/logs':       '로그 관리',
  '/assignment': '배정 현황',
  '/links':      '링크모음',
  '/approvals':  '전자결재',
  '/reports':    '손익 리포트',
}

// 경로 + 탭 → 헤더 표시 레이블
const PATH_TAB_LABELS: Record<string, Record<string, string>> = {
  '/hakjeom': {
    hakjeom:      '학점은행제',
    agency:       '기관협약',
    bulk:         '일괄등록',
    counsel_done: '연락예정',
    stats:        '통계',
  },
  '/cert': {
    hakjeom:          '학점연계 신청',
    edu:              '교육원',
    'private-cert':   '민간자격증',
    'student-mgmt':   '학생관리',
    'student-contact':'연락예정',
    'student-bulk':   '일괄등록',
    stats:            '통계',
  },
  '/abroad': {
    users:        '회원 목록',
    consult:      '간편상담',
    applications: '신청서 목록',
    payments:     '결제 목록',
  },
  '/practice': {
    consultation: '상담신청',
    practice:     '실습섭외신청',
    employment:   '취업신청',
  },
  '/allcare': {
    users:    '회원 목록',
    payments: '결제 내역',
    stats:    '통계',
  },
  '/revenues/nms-sales': {
    nms:    '학점은행제',
    cert:   '민간자격증',
    abroad: '유학',
    stats:  '통합 통계',
  },
}

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
  const searchParams = useSearchParams()
  const supabase = createClient()

  // 현재 경로 + 탭 기반으로 레이블 결정
  const getDynamicLabel = (sec: NavSection): string => {
    if (!sec.activeOn.some(p => pathname.startsWith(p))) return sec.label

    // 탭 없는 단일 페이지
    const flatLabel = PATH_LABELS[pathname]
    if (flatLabel) return flatLabel

    // 탭 있는 페이지 (가장 길게 매칭되는 경로 우선)
    const matchedPath = Object.keys(PATH_TAB_LABELS)
      .filter(p => pathname.startsWith(p))
      .sort((a, b) => b.length - a.length)[0]
    if (!matchedPath) return sec.label

    const currentTab = searchParams.get('tab')
    const tabLabels = PATH_TAB_LABELS[matchedPath]
    if (currentTab && tabLabels[currentTab]) return tabLabels[currentTab]
    return sec.label
  }

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
                {getDynamicLabel(sec)}
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
