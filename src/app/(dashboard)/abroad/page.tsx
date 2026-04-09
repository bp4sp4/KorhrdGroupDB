'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'

type User = {
  id: string
  full_name: string | null
  email: string | null
  target_country: string | null
  created_at: string
  is_admin: boolean | null
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
  created_at: string
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
  const [tab, setTab] = useState('users')
  const [loading, setLoading] = useState(true)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [payments, setPayments] = useState<Payment[]>([])

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

  if (loading) {
    return <div className={styles.loadingWrap}>불러오는 중...</div>
  }

  return (
    <div className={styles.pageWrap}>
      {/* 탭 */}
      <nav className={styles.tabNav}>
        {TAB_ITEMS.map(t => (
          <button
            key={t.id}
            className={tab === t.id ? styles.tabBtnActive : styles.tabBtn}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* 회원 목록 */}
      {tab === 'users' && (
        <div className={styles.tableCard}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>이름</th>
                  <th className={styles.th}>이메일</th>
                  <th className={styles.th}>가입일</th>
                  <th className={styles.th}>권한</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={4} className={styles.tdEmpty}>회원이 없습니다.</td></tr>
                ) : users.map(u => (
                  <tr key={u.id} className={styles.tr}>
                    <td className={styles.td}>{u.full_name ?? '-'}</td>
                    <td className={styles.td}>{u.email}</td>
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
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>이름</th>
                  <th className={styles.th}>연락처</th>
                  <th className={styles.th}>거주지역</th>
                  <th className={styles.th}>희망 시작일</th>
                  <th className={styles.th}>회원여부</th>
                  <th className={styles.th}>신청일</th>
                </tr>
              </thead>
              <tbody>
                {consultations.length === 0 ? (
                  <tr><td colSpan={6} className={styles.tdEmpty}>간편상담 신청 내역이 없습니다.</td></tr>
                ) : consultations.map(c => (
                  <tr key={c.id} className={styles.tr}>
                    <td className={styles.td}>{c.name}</td>
                    <td className={styles.td}>{c.phone}</td>
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
                {applications.length === 0 ? (
                  <tr><td colSpan={7} className={styles.tdEmpty}>신청서가 없습니다.</td></tr>
                ) : applications.map(a => {
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
                      <td className={styles.td}>{a.name ?? '-'}</td>
                      <td className={styles.td}>{a.phone ?? '-'}</td>
                      <td className={styles.td}>{a.email ?? '-'}</td>
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
                {payments.length === 0 ? (
                  <tr><td colSpan={7} className={styles.tdEmpty}>결제 내역이 없습니다.</td></tr>
                ) : payments.map(p => (
                  <tr key={p.id} className={styles.tr}>
                    <td className={styles.td}>{p.user_id ? (userNameMap.get(p.user_id) ?? '-') : '-'}</td>
                    <td className={styles.td}>{PROGRAM_LABEL[p.program] ?? p.program}</td>
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
