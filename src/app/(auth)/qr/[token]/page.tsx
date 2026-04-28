'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useParams } from 'next/navigation'
import styles from './page.module.css'

type Phase = 'loading' | 'authed' | 'unauthed' | 'success' | 'error'

export default function QrMobilePage() {
  const params = useParams()
  const token = params.token as string

  const [phase, setPhase] = useState<Phase>('loading')
  const [chars, setChars] = useState<string[]>([])
  const [authedEmail, setAuthedEmail] = useState<string | null>(null)
  const [selectedChar, setSelectedChar] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/auth/qr-verify/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setErrorMsg(data.error); setPhase('error'); return }
        setChars(data.chars)
        if (data.authenticated) {
          setAuthedEmail(data.email)
          setPhase('authed')
        } else {
          setPhase('unauthed')
        }
      })
      .catch(() => { setErrorMsg('네트워크 오류가 발생했습니다.'); setPhase('error') })
  }, [token])

  const submit = async (payload: Record<string, string>) => {
    setSubmitting(true)
    setErrorMsg('')
    const res = await fetch(`/api/auth/qr-verify/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.error) {
      setErrorMsg(data.error)
      setSubmitting(false)
      if (data.error.includes('글자')) setSelectedChar(null)
    } else {
      setPhase('success')
    }
  }

  const handleAuthedSubmit = () => {
    if (!selectedChar || submitting) return
    submit({ char: selectedChar })
  }

  const handleUnauthedSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedChar || !email || !password || submitting) return
    submit({ email, password, char: selectedChar })
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <div className={styles.logo}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="로고" className={styles.logoImg} />
        </div>

        {phase === 'loading' && (
          <div className={styles.centerBox}>
            <div className={styles.spinner} />
            <p className={styles.hint}>확인 중...</p>
          </div>
        )}

        {/* ── 모바일 이미 로그인 상태 ── */}
        {phase === 'authed' && (
          <>
            <h1 className={styles.title}>QR 로그인 확인</h1>
            <div className={styles.userBadge}>
              <span className={styles.userBadgeLabel}>로그인 계정</span>
              <span className={styles.userBadgeEmail}>{authedEmail}</span>
            </div>
            <p className={styles.sub}>
              이 계정으로 PC에서 로그인합니다<br />
              <strong>PC 화면에 강조된 글자</strong>를 선택해주세요
            </p>

            <div className={styles.charGrid}>
              {chars.map(char => (
                <button
                  key={char}
                  type="button"
                  className={selectedChar === char ? styles.charBtnActive : styles.charBtn}
                  onClick={() => setSelectedChar(char)}
                  disabled={submitting}
                >
                  {char}
                </button>
              ))}
            </div>

            {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

            <button
              type="button"
              disabled={!selectedChar || submitting}
              className={styles.submitBtn}
              onClick={handleAuthedSubmit}
            >
              {submitting ? '인증 중...' : 'PC에서 로그인'}
            </button>
          </>
        )}

        {/* ── 비로그인 폴백 ── */}
        {phase === 'unauthed' && (
          <>
            <h1 className={styles.title}>QR 로그인</h1>
            <p className={styles.sub}>
              모바일에 로그인되어 있지 않아요<br />
              이메일/비밀번호를 입력하고 <strong>글자</strong>를 선택해주세요
            </p>

            <form onSubmit={handleUnauthedSubmit} className={styles.form}>
              <input
                type="email"
                inputMode="email"
                placeholder="이메일"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={styles.input}
              />
              <input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={styles.input}
              />

              <div className={styles.charLabel}>PC 화면의 강조된 글자</div>
              <div className={styles.charGrid}>
                {chars.map(char => (
                  <button
                    key={char}
                    type="button"
                    className={selectedChar === char ? styles.charBtnActive : styles.charBtn}
                    onClick={() => setSelectedChar(char)}
                    disabled={submitting}
                  >
                    {char}
                  </button>
                ))}
              </div>

              {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

              <button
                type="submit"
                disabled={!selectedChar || !email || !password || submitting}
                className={styles.submitBtn}
              >
                {submitting ? '인증 중...' : '로그인'}
              </button>
            </form>
          </>
        )}

        {phase === 'success' && (
          <div className={styles.centerBox}>
            <div className={styles.checkCircle}>✓</div>
            <h2 className={styles.successTitle}>인증 완료</h2>
            <p className={styles.hint}>PC 화면에서 로그인이 완료됩니다</p>
          </div>
        )}

        {phase === 'error' && (
          <div className={styles.centerBox}>
            <div className={styles.errorCircle}>!</div>
            <h2 className={styles.errorTitle}>오류 발생</h2>
            <p className={styles.hint}>{errorMsg}</p>
          </div>
        )}
      </div>
    </div>
  )
}
