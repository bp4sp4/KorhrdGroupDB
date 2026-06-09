'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from './login.module.css'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const getDefaultPath = (data: { role: string; permissions?: { section: string; scope: string; allowed_tabs?: string[] | null }[] }) => {
    // mini-admin 은 전용 페이지로, 그 외 모든 사용자는 대시보드를 홈으로 사용
    if (data.role === 'mini-admin') return '/mini-admin'
    return '/dashboard'
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        try {
          const res = await fetch('/api/auth/me')
          if (res.ok) {
            const data = await res.json()
            localStorage.setItem('user_role', data.role ?? 'guest')
            router.replace(getDefaultPath(data))
            return
          }
        } catch { /* ignore */ }
        router.replace('/dashboard')
      }
    })
  }, [router, supabase.auth])

  // 매일 자동 로그아웃으로 만료된 경우 안내
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('expired') === '1') {
      setError('보안을 위해 자동 로그아웃되었습니다. 다시 로그인해 주세요.')
    }
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

    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        localStorage.setItem('user_role', data.role ?? 'guest')
        router.replace(getDefaultPath(data))
        return
      }
    } catch { /* ignore */ }
    router.replace('/dashboard')
  }

  const isDisabled = isLoading || !email || !password

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logoArea}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="한평생그룹 로고" className={styles.logo} />
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputWrap}>
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={styles.input}
            />
          </div>

          <div className={styles.inputWrap}>
            <div className={styles.inputRow}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={styles.input}
              />
              <button
                type="button"
                className={styles.toggleBtn}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className={styles.errorBox}>
              <AlertCircle size={14} color="#F04452" style={{ flexShrink: 0 }} />
              <p className={styles.errorText}>{error}</p>
            </div>
          )}

          <button type="submit" disabled={isDisabled} className={styles.submitBtn}>
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
