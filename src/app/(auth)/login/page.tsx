'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from './login.module.css'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        try {
          const res = await fetch('/api/auth/me')
          if (res.ok) {
            const data = await res.json()
            localStorage.setItem('user_role', data.role ?? 'admin')
            router.replace(getDefaultPath(data))
            return
          }
        } catch { /* ignore */ }
        router.replace('/hakjeom')
      }
    })
  }, [])

  const getDefaultPath = (data: { role: string; permissions?: { section: string; scope: string }[] }) => {
    if (data.role === 'mini-admin') return '/mini-admin'
    if (data.role === 'admin' || data.role === 'master-admin') return '/hakjeom'
    const SECTION_PATHS = [
      { section: 'hakjeom',  path: '/hakjeom' },
      { section: 'cert',     path: '/cert' },
      { section: 'practice', path: '/practice' },
      { section: 'allcare',  path: '/allcare' },
    ]
    const perms = data.permissions ?? []
    for (const { section, path } of SECTION_PATHS) {
      if (perms.some(p => p.section === section && p.scope && p.scope !== 'none')) return path
    }
    return '/hakjeom'
  }

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
        localStorage.setItem('user_role', data.role ?? 'admin')
        router.replace(getDefaultPath(data))
        return
      }
    } catch { /* ignore */ }
    router.replace('/hakjeom')
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
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={styles.input}
            />
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
