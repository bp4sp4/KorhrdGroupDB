'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './page.module.css'

type User = {
  id: string
  full_name: string | null
  email: string | null
  target_country: string | null
  created_at: string
  is_admin: boolean | null
  login_provider: string | null
}

type Application = {
  id: string
  user_id: string | null
  status: string
  created_at: string
  program: string | null
  name: string | null
  phone: string | null
  email: string | null
}

type Payment = {
  id: string
  user_id: string | null
  program: string
  amount: number
  payapp_order_id: string | null
  payapp_tid: string | null
  status: string
  created_at: string
}

type Consultation = {
  id: string
  user_id: string | null
  name: string
  phone: string
  region: string
  desired_start: string
  message: string
  status: string
  type: string
  created_at: string
}

const CONSULT_TYPE_LABEL: Record<string, string> = {
  consult:  '간편상담',
  estimate: '견적문의',
}

const TAB_ITEMS = [
  { id: 'users', label: '회원 목록' },
  { id: 'consult', label: '간편상담' },
  { id: 'applications', label: '신청서 목록' },
  { id: 'payments', label: '결제 목록' },
]

const STATUS_LABEL: Record<string, string> = {
  draft: '임시저장', submitted: '신청완료', reviewing: '검토중', approved: '승인', rejected: '반려',
}
const STATUS_CLASS: Record<string, string> = {
  draft: 'badge_draft', submitted: 'badge_submitted', reviewing: 'badge_reviewing',
  approved: 'badge_approved', rejected: 'badge_rejected',
}
const PROGRAM_LABEL: Record<string, string> = {
  philippines_cebu_solo: '필리핀 세부 나홀로',
  usa_newjersey_solo: '미국 뉴저지 나홀로',
  canada_vancouver_solo: '캐나다 밴쿠버-써리 나홀로',
  uk_solo: '영국 나홀로',
  nz_auckland_solo: '뉴질랜드 오클랜드 나홀로',
  nz_hamilton_solo_4w: '뉴질랜드 해밀턴 나홀로 4주',
  nz_hamilton_parent_4w: '뉴질랜드 해밀턴 부모동반 4주',
  nz_hamilton_solo_3w: '뉴질랜드 해밀턴 나홀로 3주',
  nz_hamilton_parent_3w: '뉴질랜드 해밀턴 부모동반 3주',
  nz_hamilton_solo_10w: '뉴질랜드 해밀턴 나홀로 10주',
  nz_hamilton_parent_10w: '뉴질랜드 해밀턴 부모동반 10주',
}
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: '대기중', completed: '결제완료', failed: '실패', cancelled: '취소',
}
const PAYMENT_STATUS_CLASS: Record<string, string> = {
  pending: 'badge_pending', completed: 'badge_approved', failed: 'badge_rejected', cancelled: 'badge_reviewing',
}

export default function AbroadPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlTab = searchParams.get('tab')
  const [tab, setTab] = useState(() =>
    urlTab && TAB_ITEMS.some(t => t.id === urlTab) ? urlTab : 'users'
  )

  useEffect(() => {
    if (urlTab && TAB_ITEMS.some(t => t.id === urlTab)) setTab(urlTab)
  }, [urlTab])
  const [loading, setLoading] = useState(true)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [consultFilter, setConsultFilter] = useState<string>('all')
  const [userSearch, setUserSearch] = useState('')
  const [consultSearch, setConsultSearch] = useState('')
  const [appSearch, setAppSearch] = useState('')
  const [paymentSearch, setPaymentSearch] = useState('')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const matchesDate = (createdAt: string) => {
    const d = new Date(createdAt)
    if (startDate && d < new Date(startDate + 'T00:00:00')) return false
    if (endDate && d > new Date(endDate + 'T23:59:59')) return false
    return true
  }

  const fetchData = useCallback(() => {
    fetch('/api/abroad')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setUsers(data.users)
          setApplications(data.applications)
          setConsultations(data.consultations)
          setPayments(data.payments)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // user_id → 이름 맵
  const userNameMap = new Map<string, string>()
  for (const u of users) {
    if (u.full_name) userNameMap.set(u.id, u.full_name)
  }

  // user_id → 결제 상태 맵 (completed 우선)
  const userPaymentMap = new Map<string, string>()
  for (const p of payments) {
    if (!p.user_id) continue
    const cur = userPaymentMap.get(p.user_id)
    if (!cur || p.status === 'completed') {
      userPaymentMap.set(p.user_id, p.status)
    }
  }

  const handleStatusChange = async (e: React.MouseEvent, paymentId: string, status: string) => {
    e.stopPropagation()
    if (approvingId) return
    setApprovingId(paymentId)
    await fetch(`/api/abroad/payments/${paymentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setApprovingId(null)
    fetchData()
  }

  const highlight = (text: string, keyword: string) => {
    const kw = keyword.trim()
    if (!kw) return <>{text}</>
    const idx = text.toLowerCase().indexOf(kw.toLowerCase())
    if (idx === -1) return <>{text}</>
    return (
      <>
        {text.slice(0, idx)}
        <mark className={styles.highlight}>{text.slice(idx, idx + kw.length)}</mark>
        {text.slice(idx + kw.length)}
      </>
    )
  }

  if (loading) {
    return <div className={styles.loadingWrap}>불러오는 중...</div>
  }

  return (
    <div className={styles.pageWrap}>
      {/* 페이지 타이틀 */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>유학 사업부</h1>
        <p className={styles.pageSubtitle}>유학 회원, 상담, 신청서, 결제 내역을 관리합니다.</p>
      </div>

      {/* 탭 */}
      <nav className={styles.tabNav}>
        {TAB_ITEMS.map(t => (
          <button
            key={t.id}
            className={tab === t.id ? styles.tabBtnActive : styles.tabBtn}
            onClick={() => { setTab(t.id); router.replace(`/abroad?tab=${t.id}`, { scroll: false }) }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* 회원 목록 */}
      {tab === 'users' && (
        <div className={styles.tableCard}>
          <div className={styles.filterRow}>
            <input className={styles.searchInput} placeholder="이름, 이메일 검색" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            <input type="date" className={styles.dateInput} value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className={styles.dateSeparator}>~</span>
            <input type="date" className={styles.dateInput} value={endDate} onChange={e => setEndDate(e.target.value)} />
            {(userSearch || startDate || endDate) && (
              <button className={styles.resetBtn} onClick={() => { setUserSearch(''); setStartDate(''); setEndDate('') }}>초기화</button>
            )}
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>이름</th>
                  <th className={styles.th}>이메일</th>
                  <th className={styles.th}>가입방식</th>
                  <th className={styles.th}>가입일</th>
                  <th className={styles.th}>권한</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => {
                  if (!matchesDate(u.created_at)) return false
                  const kw = userSearch.trim().toLowerCase()
                  if (!kw) return true
                  return (u.full_name ?? '').toLowerCase().includes(kw) || (u.email ?? '').toLowerCase().includes(kw)
                }).length === 0 ? (
                  <tr><td colSpan={5} className={styles.tdEmpty}>회원이 없습니다.</td></tr>
                ) : users.filter(u => {
                  if (!matchesDate(u.created_at)) return false
                  const kw = userSearch.trim().toLowerCase()
                  if (!kw) return true
                  return (u.full_name ?? '').toLowerCase().includes(kw) || (u.email ?? '').toLowerCase().includes(kw)
                }).map(u => (
                  <tr key={u.id} className={styles.tr}>
                    <td className={styles.td}>{highlight(u.full_name ?? '-', userSearch)}</td>
                    <td className={styles.td}>{highlight(u.email ?? '', userSearch)}</td>
                    <td className={styles.td}>
                      {u.login_provider === 'google'
                        ? <span className={styles.badge_google}>Google</span>
                        : u.login_provider === 'kakao'
                        ? <span className={styles.badge_kakao}>카카오</span>
                        : <span className={styles.badge_email}>이메일</span>}
                    </td>
                    <td className={styles.tdDate}>{new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
                    <td className={styles.td}>
                      {u.is_admin
                        ? <span className={styles.badge_admin}>관리자</span>
                        : <span className={styles.badge_user}>일반</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 간편상담 */}
      {tab === 'consult' && (
        <div className={styles.tableCard}>
          <div className={styles.filterRow}>
            <input className={styles.searchInput} placeholder="이름, 연락처 검색" value={consultSearch} onChange={e => setConsultSearch(e.target.value)} />
            <input type="date" className={styles.dateInput} value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className={styles.dateSeparator}>~</span>
            <input type="date" className={styles.dateInput} value={endDate} onChange={e => setEndDate(e.target.value)} />
            {['all', 'consult', 'estimate'].map(f => (
              <button key={f} className={consultFilter === f ? styles.filterBtnActive : styles.filterBtn} onClick={() => setConsultFilter(f)}>
                {f === 'all' ? '전체' : CONSULT_TYPE_LABEL[f]}
              </button>
            ))}
            {(consultSearch || startDate || endDate || consultFilter !== 'all') && (
              <button className={styles.resetBtn} onClick={() => { setConsultSearch(''); setStartDate(''); setEndDate(''); setConsultFilter('all') }}>초기화</button>
            )}
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>유형</th>
                  <th className={styles.th}>이름</th>
                  <th className={styles.th}>연락처</th>
                  <th className={styles.th}>거주지역</th>
                  <th className={styles.th}>희망 시작일</th>
                  <th className={styles.th}>회원여부</th>
                  <th className={styles.th}>신청일</th>
                </tr>
              </thead>
              <tbody>
                {consultations.filter(c => {
                  if (!matchesDate(c.created_at)) return false
                  if (consultFilter !== 'all' && c.type !== consultFilter) return false
                  const kw = consultSearch.trim().toLowerCase()
                  if (!kw) return true
                  return c.name.toLowerCase().includes(kw) || c.phone.toLowerCase().includes(kw)
                }).length === 0 ? (
                  <tr><td colSpan={7} className={styles.tdEmpty}>간편상담 신청 내역이 없습니다.</td></tr>
                ) : consultations.filter(c => {
                  if (!matchesDate(c.created_at)) return false
                  if (consultFilter !== 'all' && c.type !== consultFilter) return false
                  const kw = consultSearch.trim().toLowerCase()
                  if (!kw) return true
                  return c.name.toLowerCase().includes(kw) || c.phone.toLowerCase().includes(kw)
                }).map(c => (
                  <tr key={c.id} className={styles.tr}>
                    <td className={styles.td}>
                      <span className={c.type === 'estimate' ? styles.badge_submitted : styles.badge_draft}>
                        {CONSULT_TYPE_LABEL[c.type] ?? c.type}
                      </span>
                    </td>
                    <td className={styles.td}>{highlight(c.name, consultSearch)}</td>
                    <td className={styles.td}>{highlight(c.phone, consultSearch)}</td>
                    <td className={styles.td}>{c.region}</td>
                    <td className={styles.td}>{c.desired_start}</td>
                    <td className={styles.td}>
                      {c.user_id
                        ? <span className={styles.badge_admin}>회원</span>
                        : <span className={styles.badge_user}>비회원</span>}
                    </td>
                    <td className={styles.tdDate}>{new Date(c.created_at).toLocaleDateString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 신청서 목록 */}
      {tab === 'applications' && (
        <div className={styles.tableCard}>
          <div className={styles.filterRow}>
            <input className={styles.searchInput} placeholder="이름, 연락처, 이메일 검색" value={appSearch} onChange={e => setAppSearch(e.target.value)} />
            <input type="date" className={styles.dateInput} value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className={styles.dateSeparator}>~</span>
            <input type="date" className={styles.dateInput} value={endDate} onChange={e => setEndDate(e.target.value)} />
            {(appSearch || startDate || endDate) && (
              <button className={styles.resetBtn} onClick={() => { setAppSearch(''); setStartDate(''); setEndDate('') }}>초기화</button>
            )}
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>이름</th>
                  <th className={styles.th}>연락처</th>
                  <th className={styles.th}>이메일</th>
                  <th className={styles.th}>프로그램</th>
                  <th className={styles.th}>신청 상태</th>
                  <th className={styles.th}>결제</th>
                  <th className={styles.th}>신청일</th>
                </tr>
              </thead>
              <tbody>
                {applications.filter(a => {
                  if (!matchesDate(a.created_at)) return false
                  const kw = appSearch.trim().toLowerCase()
                  if (!kw) return true
                  return (a.name ?? '').toLowerCase().includes(kw) || (a.phone ?? '').toLowerCase().includes(kw) || (a.email ?? '').toLowerCase().includes(kw)
                }).length === 0 ? (
                  <tr><td colSpan={7} className={styles.tdEmpty}>신청서가 없습니다.</td></tr>
                ) : applications.filter(a => {
                  if (!matchesDate(a.created_at)) return false
                  const kw = appSearch.trim().toLowerCase()
                  if (!kw) return true
                  return (a.name ?? '').toLowerCase().includes(kw) || (a.phone ?? '').toLowerCase().includes(kw) || (a.email ?? '').toLowerCase().includes(kw)
                }).map(a => {
                  const payStatus = a.user_id ? userPaymentMap.get(a.user_id) : undefined
                  return (
                    <tr
                      key={a.id}
                      className={`${styles.tr} ${styles.trClickable} ${loadingId === a.id ? styles.trLoading : ''}`}
                      onClick={() => {
                        if (loadingId) return
                        setLoadingId(a.id)
                        router.push(`/abroad/applications/${a.id}`)
                      }}
                    >
                      <td className={styles.td}>{highlight(a.name ?? '-', appSearch)}</td>
                      <td className={styles.td}>{highlight(a.phone ?? '-', appSearch)}</td>
                      <td className={styles.td}>{highlight(a.email ?? '-', appSearch)}</td>
                      <td className={styles.td}>{PROGRAM_LABEL[a.program ?? ''] ?? a.program ?? '-'}</td>
                      <td className={styles.td}>
                        {loadingId === a.id ? (
                          <span className={styles.badge_loading}>이동 중...</span>
                        ) : (
                          <span className={styles[STATUS_CLASS[a.status] ?? 'badge_draft']}>
                            {STATUS_LABEL[a.status] ?? a.status}
                          </span>
                        )}
                      </td>
                      <td className={styles.td}>
                        <span className={styles[PAYMENT_STATUS_CLASS[payStatus ?? ''] ?? 'badge_draft']}>
                          {PAYMENT_STATUS_LABEL[payStatus ?? ''] ?? '미결제'}
                        </span>
                      </td>
                      <td className={styles.tdDate}>{new Date(a.created_at).toLocaleDateString('ko-KR')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 결제 목록 */}
      {tab === 'payments' && (
        <div className={styles.tableCard}>
          <div className={styles.filterRow}>
            <input className={styles.searchInput} placeholder="이름, 프로그램 검색" value={paymentSearch} onChange={e => setPaymentSearch(e.target.value)} />
            <input type="date" className={styles.dateInput} value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span className={styles.dateSeparator}>~</span>
            <input type="date" className={styles.dateInput} value={endDate} onChange={e => setEndDate(e.target.value)} />
            {(paymentSearch || startDate || endDate) && (
              <button className={styles.resetBtn} onClick={() => { setPaymentSearch(''); setStartDate(''); setEndDate('') }}>초기화</button>
            )}
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>신청자</th>
                  <th className={styles.th}>프로그램</th>
                  <th className={styles.th}>금액</th>
                  <th className={styles.th}>상태</th>
                  <th className={styles.th}>주문번호</th>
                  <th className={styles.th}>결제일</th>
                  <th className={styles.th}>승인</th>
                </tr>
              </thead>
              <tbody>
                {payments.filter(p => {
                  const kw = paymentSearch.trim().toLowerCase()
                  if (!kw) return true
                  const name = p.user_id ? (userNameMap.get(p.user_id) ?? '') : ''
                  return name.toLowerCase().includes(kw) || (PROGRAM_LABEL[p.program] ?? p.program).toLowerCase().includes(kw)
                }).length === 0 ? (
                  <tr><td colSpan={7} className={styles.tdEmpty}>결제 내역이 없습니다.</td></tr>
                ) : payments.filter(p => {
                  const kw = paymentSearch.trim().toLowerCase()
                  if (!kw) return true
                  const name = p.user_id ? (userNameMap.get(p.user_id) ?? '') : ''
                  return name.toLowerCase().includes(kw) || (PROGRAM_LABEL[p.program] ?? p.program).toLowerCase().includes(kw)
                }).map(p => (
                  <tr key={p.id} className={styles.tr}>
                    <td className={styles.td}>{highlight(p.user_id ? (userNameMap.get(p.user_id) ?? '-') : '-', paymentSearch)}</td>
                    <td className={styles.td}>{highlight(PROGRAM_LABEL[p.program] ?? p.program, paymentSearch)}</td>
                    <td className={styles.td}>{p.amount.toLocaleString('ko-KR')}원</td>
                    <td className={styles.td}>
                      <span className={styles[PAYMENT_STATUS_CLASS[p.status] ?? 'badge_draft']}>
                        {PAYMENT_STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className={styles.td}>{p.payapp_order_id ?? '-'}</td>
                    <td className={styles.tdDate}>{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
                    <td className={styles.td}>
                      {approvingId === p.id ? (
                        <span className={styles.approveNone}>처리 중...</span>
                      ) : p.status === 'pending' ? (
                        <button
                          className={styles.btnApprove}
                          onClick={(e) => handleStatusChange(e, p.id, 'completed')}
                        >
                          결제 승인
                        </button>
                      ) : p.status === 'completed' ? (
                        <button
                          className={styles.btnRevoke}
                          onClick={(e) => handleStatusChange(e, p.id, 'pending')}
                        >
                          승인 취소
                        </button>
                      ) : (
                        <span className={styles.approveNone}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
