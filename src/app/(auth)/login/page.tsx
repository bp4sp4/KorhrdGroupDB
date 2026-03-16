'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 이미 로그인된 경우 대시보드로 redirect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/hakjeom')
    })
  }, [])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setIsLoading(false)
      return
    }

    router.replace('/hakjeom')
  }

  const isDisabled = isLoading || !email || !password

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--toss-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'var(--toss-card-bg)',
        borderRadius: 20,
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)',
        padding: '44px 32px 40px',
      }}>
        {/* 로고 영역 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: 36,
          gap: 14,
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="한평생교육 로고" style={{ width: '100%', height: 'auto', display: 'block' }} />

          <p style={{
            fontSize: 13,
            color: 'var(--toss-text-secondary)',
            marginTop: 8,
            lineHeight: 1.5,
            margin: 0,
          }}>
            학점은행제 통합 관리 시스템
          </p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 이메일 입력 */}
          <div style={{
            background: 'var(--toss-bg)',
            borderRadius: 12,
            padding: '14px 16px',
            border: '1.5px solid transparent',
            transition: 'border-color 150ms ease',
          }}
            onFocusCapture={(e) => {
              e.currentTarget.style.borderColor = 'var(--toss-blue)'
              e.currentTarget.style.background = '#FFFFFF'
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.borderColor = 'transparent'
              e.currentTarget.style.background = 'var(--toss-bg)'
            }}
          >
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 15,
                color: 'var(--toss-text-primary)',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* 비밀번호 입력 */}
          <div style={{
            background: 'var(--toss-bg)',
            borderRadius: 12,
            padding: '14px 16px',
            border: '1.5px solid transparent',
            transition: 'border-color 150ms ease',
          }}
            onFocusCapture={(e) => {
              e.currentTarget.style.borderColor = 'var(--toss-blue)'
              e.currentTarget.style.background = '#FFFFFF'
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.borderColor = 'transparent'
              e.currentTarget.style.background = 'var(--toss-bg)'
            }}
          >
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 15,
                color: 'var(--toss-text-primary)',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: '#FFF2F3',
              borderRadius: 8,
              marginTop: 2,
            }}>
              <AlertCircle size={14} color="#F04452" style={{ flexShrink: 0 }} />
              <p style={{
                fontSize: 13,
                color: '#F04452',
                margin: 0,
                lineHeight: 1.4,
              }}>
                {error}
              </p>
            </div>
          )}

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={isDisabled}
            style={{
              marginTop: 8,
              width: '100%',
              height: 52,
              background: isDisabled ? '#B0B8C1' : 'var(--toss-blue)',
              color: '#ffffff',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              transition: 'background 150ms ease, transform 100ms ease',
              border: 'none',
              fontFamily: 'inherit',
              letterSpacing: '-0.2px',
            }}
            onMouseEnter={(e) => {
              if (!isDisabled) {
                e.currentTarget.style.background = 'var(--toss-blue-hover)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isDisabled) {
                e.currentTarget.style.background = 'var(--toss-blue)'
              }
            }}
            onMouseDown={(e) => {
              if (!isDisabled) {
                e.currentTarget.style.transform = 'scale(0.99)'
              }
            }}
            onMouseUp={(e) => {
              if (!isDisabled) {
                e.currentTarget.style.transform = 'scale(1)'
              }
            }}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
