'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface HeaderProps {
  title: string
  userName?: string
}

/**
 * userName에서 이니셜을 추출한다.
 * 예: "관리자" → "관" / "Hong Gil" → "HG"
 */
function getInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  // 한글이면 첫 글자
  if (/[\uAC00-\uD7A3]/.test(trimmed[0])) {
    return trimmed[0]
  }
  // 영문이면 단어 첫 글자들 (최대 2글자)
  const words = trimmed.split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return trimmed[0].toUpperCase()
}

export default function Header({ title, userName = '관리자' }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const initial = getInitial(userName)

  return (
    <header style={{
      height: 'var(--toss-nav-height)',
      background: 'var(--toss-card-bg)',
      borderBottom: '1px solid var(--toss-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      flexShrink: 0,
    }}>
      {/* 페이지 타이틀 */}
      <h1 style={{
        fontSize: 16,
        fontWeight: 700,
        color: 'var(--toss-text-primary)',
        margin: 0,
        letterSpacing: '-0.3px',
      }}>
        {title}
      </h1>

      {/* 사용자 정보 + 로그아웃 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* 이니셜 아바타 */}
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'var(--toss-blue-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--toss-blue)',
            lineHeight: 1,
          }}>
            {initial}
          </span>
        </div>

        {/* 사용자 이름 */}
        <span style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--toss-text-primary)',
        }}>
          {userName}
        </span>

        {/* 구분선 */}
        <div style={{
          width: 1,
          height: 14,
          background: 'var(--toss-border)',
          flexShrink: 0,
        }} />

        {/* 로그아웃 버튼 */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 10px',
            border: 'none',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--toss-text-secondary)',
            fontSize: 13,
            fontWeight: 400,
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--toss-bg)'
            e.currentTarget.style.color = 'var(--toss-text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--toss-text-secondary)'
          }}
        >
          <LogOut size={14} />
          로그아웃
        </button>
      </div>
    </header>
  )
}
