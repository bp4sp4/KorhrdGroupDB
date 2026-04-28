'use client'

import { useState, useEffect, useRef, FormEvent, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { QRCodeSVG } from 'qrcode.react'
import styles from './login.module.css'

type Tab = 'password' | 'qr'
type QrPhase = 'loading' | 'scanning' | 'confirmed' | 'expired'

const getDefaultPath = (data: { role: string; permissions?: { section: string; scope: string }[] }) => {
  if (data.role === 'mini-admin') return '/mini-admin'
  if (data.role === 'admin' || data.role === 'master-admin') return '/hakjeom'
  const SECTION_PATHS = [
    { section: 'hakjeom', path: '/hakjeom' },
    { section: 'cert', path: '/cert' },
    { section: 'practice', path: '/practice' },
    { section: 'allcare', path: '/allcare' },
    { section: 'abroad', path: '/abroad' },
    { section: 'revenue-upload', path: '/revenue-upload' },
    { section: 'revenues', path: '/revenues/nms-sales' },
    { section: 'approvals', path: '/approvals' },
    { section: 'reports', path: '/reports' },
  ]
  const perms = data.permissions ?? []
  for (const { section, path } of SECTION_PATHS) {
    if (perms.some(p => p.section === section && p.scope && p.scope !== 'none')) return path
  }
  return '/hakjeom'
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('password')

  // 비밀번호 로그인
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // QR
  const [qrPhase, setQrPhase] = useState<QrPhase>('loading')
  const [qrToken, setQrToken] = useState('')
  const [qrChars, setQrChars] = useState<string[]>([])
  const [qrCorrectIndex, setQrCorrectIndex] = useState(0)
  const [qrUrl, setQrUrl] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
        router.replace('/hakjeom')
      }
    })
  }, [router, supabase.auth])

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  useEffect(() => () => stopPolling(), [stopPolling])

  // ── 비밀번호 로그인 ──────────────────────────────────────────────────────────
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
    router.replace('/hakjeom')
  }

  // ── QR 세션 생성 + 폴링 시작 ────────────────────────────────────────────────
  const startQrSession = useCallback(async () => {
    stopPolling()
    setQrPhase('loading')

    const res = await fetch('/api/auth/qr-session-open', { method: 'POST' })
    if (!res.ok) { setQrPhase('expired'); return }
    const { token, chars, correctIndex } = await res.json()

    setQrToken(token)
    setQrChars(chars)
    setQrCorrectIndex(correctIndex)
    // QR URL: 환경변수 NEXT_PUBLIC_QR_HOST 우선, 없으면 현재 origin 사용
    // 모바일에서 접근 가능한 LAN IP/도메인을 NEXT_PUBLIC_QR_HOST로 설정 권장
    const host = process.env.NEXT_PUBLIC_QR_HOST || window.location.origin
    setQrUrl(`${host}/qr/${token}`)
    setQrPhase('scanning')

    pollRef.current = setInterval(async () => {
      const statusRes = await fetch(`/api/auth/qr-status/${token}`)
      const data = await statusRes.json()
      if (data.status === 'confirmed' && data.access_token && data.refresh_token) {
        stopPolling()
        setQrPhase('confirmed')
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })
        const meRes = await fetch('/api/auth/me')
        if (meRes.ok) {
          const me = await meRes.json()
          localStorage.setItem('user_role', me.role ?? 'guest')
          router.replace(getDefaultPath(me))
          return
        }
        router.replace('/hakjeom')
      } else if (data.status === 'expired') {
        stopPolling()
        setQrPhase('expired')
      }
    }, 2000)
  }, [router, supabase.auth, stopPolling])

  // QR 탭 전환 시 자동 생성
  useEffect(() => {
    if (tab === 'qr') startQrSession()
    else stopPolling()
  }, [tab, startQrSession, stopPolling])

  const isDisabled = isLoading || !email || !password

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logoArea}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="한평생그룹 로고" className={styles.logo} />
        </div>

        <div className={styles.tabRow}>
          <button
            className={tab === 'password' ? styles.tabActive : styles.tabInactive}
            onClick={() => setTab('password')}
          >
            이메일 로그인
          </button>
          <button
            className={tab === 'qr' ? styles.tabActive : styles.tabInactive}
            onClick={() => setTab('qr')}
          >
            QR코드 로그인
          </button>
        </div>

        {tab === 'password' && (
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
        )}

        {tab === 'qr' && (
          <div className={styles.qrArea}>
            {qrPhase === 'loading' && (
              <div className={styles.qrCenter}>
                <div className={styles.qrSpinner} />
                <p className={styles.qrHint}>QR코드를 생성하는 중...</p>
              </div>
            )}

            {qrPhase === 'scanning' && (
              <div className={styles.qrScanArea}>
                <div className={styles.qrBox}>
                  <QRCodeSVG
                    value={qrUrl}
                    size={180}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                  />
                </div>
                <p className={styles.qrScanHint}>
                  스마트폰 카메라로 QR코드를 스캔하고<br />
                  아래 <strong>강조된 글자</strong>를 선택하세요
                </p>
                <div className={styles.charRow}>
                  {qrChars.map((char, i) => (
                    <div
                      key={char}
                      className={i === qrCorrectIndex ? styles.charHighlight : styles.charNormal}
                    >
                      {char}
                    </div>
                  ))}
                </div>
                <p className={styles.qrWaiting}>스마트폰에서 인증을 기다리는 중...</p>
                <button className={styles.qrCancelBtn} onClick={startQrSession}>QR코드 새로고침</button>
              </div>
            )}

            {qrPhase === 'confirmed' && (
              <div className={styles.qrCenter}>
                <div className={styles.qrCheck}>✓</div>
                <p className={styles.qrSuccessText}>인증 완료! 로그인 중...</p>
              </div>
            )}

            {qrPhase === 'expired' && (
              <div className={styles.qrCenter}>
                <p className={styles.qrExpiredText}>QR코드가 만료되었습니다</p>
                <button className={styles.submitBtn} onClick={startQrSession} style={{ marginTop: 16 }}>
                  다시 생성
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
