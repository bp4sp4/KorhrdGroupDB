'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { GraduationCap, FileText, Briefcase } from 'lucide-react'

interface NavItem {
  id: string
  label: string
  href: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'hakjeom',
    label: '학점은행제',
    href: '/hakjeom',
    icon: <GraduationCap size={18} />,
  },
  {
    id: 'cert',
    label: '자격증신청',
    href: '/cert',
    icon: <FileText size={18} />,
  },
  {
    id: 'practice',
    label: '실습/취업',
    href: '/practice',
    icon: <Briefcase size={18} />,
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      width: 'var(--toss-sidebar-width)',
      flexShrink: 0,
      background: 'var(--toss-card-bg)',
      borderRight: '1px solid var(--toss-border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
    }}>
      {/* 로고 영역 */}
      <div style={{
        height: 'var(--toss-nav-height)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        borderBottom: '1px solid var(--toss-border)',
        gap: 10,
        flexShrink: 0,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="한평생교육 로고" style={{ width: '100%', height: 'auto', display: 'block' }} />
      </div>

      {/* 네비게이션 메뉴 */}
      <nav style={{ padding: '16px 10px', flex: 1 }}>
        {/* 메뉴 섹션 레이블 */}
        <p style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--toss-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          padding: '0 12px',
          marginBottom: 6,
        }}>
          메뉴
        </p>

        <ul style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href)

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--toss-blue)' : 'var(--toss-text-secondary)',
                    background: isActive ? 'var(--toss-blue-subtle)' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 150ms ease',
                  }}
                >
                  <span style={{
                    color: isActive ? 'var(--toss-blue)' : 'var(--toss-text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'color 150ms ease',
                  }}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 하단 버전 정보 */}
      <div style={{
        padding: '12px 20px 16px',
        borderTop: '1px solid var(--toss-border)',
        flexShrink: 0,
      }}>
        <p style={{
          fontSize: 11,
          color: 'var(--toss-text-tertiary)',
          margin: 0,
        }}>
          v1.0.0
        </p>
      </div>
    </aside>
  )
}
