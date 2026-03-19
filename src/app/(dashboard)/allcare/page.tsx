'use client'

import { useEffect, useState, useCallback } from 'react'
import styles from './page.module.css'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface Stats {
  totalUsers: number
  activeSubscriptions: number
  cancelledSubscriptions: number
  totalRevenue: number
  subscriptionRevenue: number
  packageRevenue: number
  customRevenue: number
}

interface UserData {
  user_id: string
  email: string
  name: string
  phone: string
  provider: string
  registered_at: string
  subscription_status: string | null
  plan: string | null
  amount: number | null
  next_billing_date: string | null
  cancelled_at: string | null
  practice_matching_access: boolean
}

interface Payment {
  id: string
  order_id: string
  trade_id: string | null
  amount: number
  good_name: string | null
  status: string
  payment_method: string | null
  approved_at: string | null
  users: { name: string; email: string; phone: string } | null
}

interface CustomPayment {
  id: string
  subject: string
  subject_count: number
  amount: number
  status: string
  memo: string | null
  created_at: string
  paid_at: string | null
  users: { name: string; email: string; phone: string } | null
}

type Tab = 'users' | 'payments' | 'custom'
type SubStatus = 'active' | 'cancel_scheduled' | 'cancelled'

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

function fmtDate(s: string | null) {
  if (!s) return '-'
  return new Date(s).toLocaleDateString('ko-KR')
}

function SubscriptionBadge({ status, cancelledAt }: { status: string | null; cancelledAt: string | null }) {
  if (!status) return <span className={`${styles.badge} ${styles.badgeNone}`}>없음</span>
  if (status === 'cancel_scheduled' || (status === 'active' && cancelledAt)) {
    return <span className={`${styles.badge} ${styles.badgeCancelScheduled}`}>취소예정</span>
  }
  if (status === 'active') return <span className={`${styles.badge} ${styles.badgeActive}`}>활성</span>
  return <span className={`${styles.badge} ${styles.badgeCancelled}`}>취소</span>
}

function OrderIdCell({ orderId }: { orderId: string }) {
  let type = 'ORDER'
  let color = '#64748b'
  let bg = '#f1f5f9'

  if (orderId.startsWith('SUBS-')) { type = 'SUBS'; color = '#2563eb'; bg = '#dbeafe' }
  else if (orderId.startsWith('PKG-')) { type = 'PKG'; color = '#7c3aed'; bg = '#ede9fe' }
  else if (orderId.startsWith('CUSTOM-')) { type = 'CUSTOM'; color = '#d97706'; bg = '#fef3c7' }

  // 끝 숫자(타임스탬프) 추출
  const match = orderId.match(/(\d+)$/)
  const tail = match ? match[1] : orderId

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ background: bg, color, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
        {type}
      </span>
      <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{tail}</span>
    </div>
  )
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    completed: [styles.badgeCompleted, '완료'],
    cancelled: [styles.badgeCancelled, '취소'],
    refunded: [styles.badgeCancelled, '환불'],
    refund_requested: [styles.badgePending, '환불요청'],
    failed: [styles.badgeCancelled, '실패'],
    pending: [styles.badgePending, '대기'],
    paid: [styles.badgePaid, '결제완료'],
  }
  const [cls, label] = map[status] ?? [styles.badgeNone, status]
  return <span className={`${styles.badge} ${cls}`}>{label}</span>
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function AllcarePage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('users')

  // 회원
  const [users, setUsers] = useState<UserData[]>([])
  const [userTotal, setUserTotal] = useState(0)
  const [userPage, setUserPage] = useState(1)
  const [userSearch, setUserSearch] = useState('')
  const [userProvider, setUserProvider] = useState('all')
  const [userSub, setUserSub] = useState('all')
  const [usersLoading, setUsersLoading] = useState(false)

  // 결제
  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentTotal, setPaymentTotal] = useState(0)
  const [paymentPage, setPaymentPage] = useState(1)
  const [paymentsLoading, setPaymentsLoading] = useState(false)

  // 단과반
  const [customs, setCustoms] = useState<CustomPayment[]>([])
  const [customTotal, setCustomTotal] = useState(0)
  const [customPage, setCustomPage] = useState(1)
  const [customsLoading, setCustomsLoading] = useState(false)

  // 상태변경 모달
  const [showModal, setShowModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null)
  const [newStatus, setNewStatus] = useState<SubStatus>('cancelled')

  // 열람권 확인 팝업
  const [accessConfirm, setAccessConfirm] = useState<{ user: UserData; newAccess: boolean } | null>(null)

  // 완료 토스트
  const [toast, setToast] = useState<string | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  const pageSize = 10

  // ─── 통계 ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/allcare/stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setStats(d))
      .catch(() => {})
  }, [])

  // ─── 회원 ─────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(() => {
    setUsersLoading(true)
    const params = new URLSearchParams({
      page: String(userPage),
      search: userSearch,
      provider: userProvider,
      subscription: userSub,
    })
    fetch(`/api/allcare/users?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setUsers(d.users || [])
          setUserTotal(d.total || 0)
        }
      })
      .catch(() => {})
      .finally(() => setUsersLoading(false))
  }, [userPage, userSearch, userProvider, userSub])

  useEffect(() => {
    if (activeTab === 'users') fetchUsers()
  }, [activeTab, fetchUsers])

  // ─── 결제 ─────────────────────────────────────────────────────────────────
  const fetchPayments = useCallback(() => {
    setPaymentsLoading(true)
    const params = new URLSearchParams({ tab: 'payments', page: String(paymentPage) })
    fetch(`/api/allcare/payments?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setPayments(d.payments || [])
          setPaymentTotal(d.total || 0)
        }
      })
      .catch(() => {})
      .finally(() => setPaymentsLoading(false))
  }, [paymentPage])

  useEffect(() => {
    if (activeTab === 'payments') fetchPayments()
  }, [activeTab, fetchPayments])

  // ─── 단과반 ───────────────────────────────────────────────────────────────
  const fetchCustoms = useCallback(() => {
    setCustomsLoading(true)
    const params = new URLSearchParams({ tab: 'custom', page: String(customPage) })
    fetch(`/api/allcare/payments?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setCustoms(d.payments || [])
          setCustomTotal(d.total || 0)
        }
      })
      .catch(() => {})
      .finally(() => setCustomsLoading(false))
  }, [customPage])

  useEffect(() => {
    if (activeTab === 'custom') fetchCustoms()
  }, [activeTab, fetchCustoms])

  // ─── 상태변경 모달 ────────────────────────────────────────────────────────
  const openModal = (user: UserData) => {
    setSelectedUser(user)
    if (!user.subscription_status || user.subscription_status === 'cancelled') {
      setNewStatus('active')
    } else if (user.cancelled_at) {
      setNewStatus('cancel_scheduled')
    } else {
      setNewStatus('cancelled')
    }
    setShowModal(true)
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleStatusChange = async () => {
    if (!selectedUser) return
    setModalLoading(true)
    try {
      const res = await fetch('/api/allcare/subscription/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.user_id, status: newStatus }),
      })
      if (res.ok) {
        setShowModal(false)
        fetchUsers()
        showToast('구독 상태가 변경되었습니다.')
      } else {
        const d = await res.json()
        showToast(d.error || '변경에 실패했습니다.')
      }
    } catch {
      showToast('오류가 발생했습니다.')
    } finally {
      setModalLoading(false)
    }
  }

  // ─── 실습매칭 열람권 토글 ─────────────────────────────────────────────────
  const confirmAccess = (user: UserData) => {
    setAccessConfirm({ user, newAccess: !user.practice_matching_access })
  }

  const handleAccessConfirm = async () => {
    if (!accessConfirm) return
    const { user, newAccess } = accessConfirm
    setAccessConfirm(null)
    setUsers(prev => prev.map(u => u.user_id === user.user_id ? { ...u, practice_matching_access: newAccess } : u))
    const res = await fetch('/api/allcare/users/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.user_id, access: newAccess }),
    })
    if (res.ok) {
      showToast(newAccess ? '실습매칭 열람권이 허용되었습니다.' : '실습매칭 열람권이 해제되었습니다.')
    } else {
      setUsers(prev => prev.map(u => u.user_id === user.user_id ? { ...u, practice_matching_access: !newAccess } : u))
      showToast('변경에 실패했습니다.')
    }
  }

  // ─── 페이지네이션 ─────────────────────────────────────────────────────────
  function Pagination({ total, page, onPage }: { total: number; page: number; onPage: (p: number) => void }) {
    const totalPages = Math.ceil(total / pageSize)
    if (totalPages <= 1) return null
    const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
      const start = Math.max(1, page - 3)
      return start + i
    }).filter(p => p <= totalPages)

    return (
      <div className={styles.pagination}>
        <button className={styles.pageBtn} onClick={() => onPage(page - 1)} disabled={page <= 1}>이전</button>
        {pages.map(p => (
          <button
            key={p}
            className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ''}`}
            onClick={() => onPage(p)}
          >
            {p}
          </button>
        ))}
        <button className={styles.pageBtn} onClick={() => onPage(page + 1)} disabled={page >= totalPages}>다음</button>
        <span className={styles.pageInfo}>{total}명 / {page}/{totalPages}페이지</span>
      </div>
    )
  }

  // ─── 렌더링 ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.container}>

      {/* 통계 */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>전체 회원</p>
          <p className={styles.statValue}>{stats?.totalUsers?.toLocaleString() ?? '-'}명</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>활성 구독</p>
          <p className={styles.statValue}>{stats?.activeSubscriptions?.toLocaleString() ?? '-'}명</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>취소된 구독</p>
          <p className={styles.statValue}>{stats?.cancelledSubscriptions?.toLocaleString() ?? '-'}명</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statLabel}>총 매출</p>
          <p className={styles.statValue}>{stats ? fmt(stats.totalRevenue) : '-'}</p>
          <p className={styles.statSub}>
            구독 {stats ? fmt(stats.subscriptionRevenue) : '-'} &middot; 단과 {stats ? fmt(stats.customRevenue) : '-'}
          </p>
        </div>
      </div>

      {/* 탭 */}
      <div className={styles.tabs}>
        {(['users', 'payments', 'custom'] as Tab[]).map(t => (
          <button
            key={t}
            className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t === 'users' ? '회원 목록' : t === 'payments' ? '결제 내역' : '단과반 결제'}
          </button>
        ))}
      </div>

      {/* 회원 탭 */}
      {activeTab === 'users' && (
        <>
          <div className={styles.filterRow}>
            <input
              className={styles.searchInput}
              placeholder="이름, 이메일, 전화번호 검색"
              value={userSearch}
              onChange={e => { setUserSearch(e.target.value); setUserPage(1) }}
            />
            <select className={styles.select} value={userProvider} onChange={e => { setUserProvider(e.target.value); setUserPage(1) }}>
              <option value="all">전체 가입경로</option>
              <option value="email">이메일</option>
              <option value="google">구글</option>
              <option value="kakao">카카오</option>
              <option value="naver">네이버</option>
            </select>
            <select className={styles.select} value={userSub} onChange={e => { setUserSub(e.target.value); setUserPage(1) }}>
              <option value="all">전체 구독</option>
              <option value="active">활성</option>
              <option value="cancel_scheduled">취소예정</option>
              <option value="cancelled">취소</option>
              <option value="none">없음</option>
            </select>
          </div>
          <div className={styles.tableWrap}>
            {usersLoading ? (
              <p className={styles.loading}>불러오는 중...</p>
            ) : users.length === 0 ? (
              <p className={styles.empty}>회원이 없습니다.</p>
            ) : (
              <>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>이메일</th>
                      <th>전화번호</th>
                      <th>가입경로</th>
                      <th>가입일</th>
                      <th>구독 상태</th>
                      <th>플랜</th>
                      <th>금액</th>
                      <th>다음 결제일</th>
                      <th>실습매칭 열람권</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.user_id}>
                        <td>{u.name || '-'}</td>
                        <td>{u.email}</td>
                        <td>{u.phone || '-'}</td>
                        <td>{u.provider || '-'}</td>
                        <td>{fmtDate(u.registered_at)}</td>
                        <td><SubscriptionBadge status={u.subscription_status} cancelledAt={u.cancelled_at} /></td>
                        <td>{u.plan || '-'}</td>
                        <td className={styles.amount}>{u.amount ? fmt(u.amount) : '-'}</td>
                        <td>{fmtDate(u.next_billing_date)}</td>
                        <td>
                          <button
                            className={`${styles.accessBtn} ${u.practice_matching_access ? styles.accessEnabled : styles.accessDisabled}`}
                            onClick={() => confirmAccess(u)}
                          >
                            {u.practice_matching_access ? '허용됨' : '미허용'}
                          </button>
                        </td>
                        <td>
                          <button className={styles.actionBtn} onClick={() => openModal(u)}>
                            상태변경
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination total={userTotal} page={userPage} onPage={p => setUserPage(p)} />
              </>
            )}
          </div>
        </>
      )}

      {/* 결제 탭 */}
      {activeTab === 'payments' && (
        <div className={styles.tableWrap}>
          {paymentsLoading ? (
            <p className={styles.loading}>불러오는 중...</p>
          ) : payments.length === 0 ? (
            <p className={styles.empty}>결제 내역이 없습니다.</p>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>회원</th>
                    <th>이메일</th>
                    <th>상품명</th>
                    <th>주문번호</th>
                    <th>금액</th>
                    <th>상태</th>
                    <th>결제수단</th>
                    <th>결제일시</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td>{p.users?.name || '-'}</td>
                      <td>{p.users?.email || '-'}</td>
                      <td>{p.good_name || '-'}</td>
                      <td>
                        <OrderIdCell orderId={p.order_id} />
                      </td>
                      <td className={`${styles.amount} ${p.status === 'refunded' ? styles.amountNegative : ''}`}>
                        {p.status === 'refunded' ? '-' : ''}{fmt(p.amount)}
                      </td>
                      <td><PaymentStatusBadge status={p.status} /></td>
                      <td>{p.payment_method || '-'}</td>
                      <td>{fmtDate(p.approved_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination total={paymentTotal} page={paymentPage} onPage={p => setPaymentPage(p)} />
            </>
          )}
        </div>
      )}

      {/* 단과반 탭 */}
      {activeTab === 'custom' && (
        <div className={styles.tableWrap}>
          {customsLoading ? (
            <p className={styles.loading}>불러오는 중...</p>
          ) : customs.length === 0 ? (
            <p className={styles.empty}>단과반 결제 요청이 없습니다.</p>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>회원</th>
                    <th>이메일</th>
                    <th>과목</th>
                    <th>과목수</th>
                    <th>금액</th>
                    <th>상태</th>
                    <th>메모</th>
                    <th>요청일</th>
                    <th>결제일</th>
                  </tr>
                </thead>
                <tbody>
                  {customs.map(c => (
                    <tr key={c.id}>
                      <td>{c.users?.name || '-'}</td>
                      <td>{c.users?.email || '-'}</td>
                      <td>{c.subject}</td>
                      <td>{c.subject_count}</td>
                      <td className={styles.amount}>{fmt(c.amount)}</td>
                      <td><PaymentStatusBadge status={c.status} /></td>
                      <td>{c.memo || '-'}</td>
                      <td>{fmtDate(c.created_at)}</td>
                      <td>{fmtDate(c.paid_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination total={customTotal} page={customPage} onPage={p => setCustomPage(p)} />
            </>
          )}
        </div>
      )}

      {/* 열람권 확인 팝업 */}
      {accessConfirm && (
        <div className={styles.modalOverlay} onClick={() => setAccessConfirm(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>실습매칭 열람권</h3>
            <p className={styles.modalUser}>{accessConfirm.user.name} ({accessConfirm.user.email})</p>
            <p className={styles.modalDesc}>
              {accessConfirm.newAccess ? '실습매칭 열람권을 허용하시겠습니까?' : '실습매칭 열람권을 해제하시겠습니까?'}
            </p>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setAccessConfirm(null)}>취소</button>
              <button className={styles.modalConfirm} onClick={handleAccessConfirm}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 상태변경 모달 */}
      {showModal && selectedUser && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>구독 상태 변경</h3>
            <p className={styles.modalUser}>{selectedUser.name} ({selectedUser.email})</p>
            <div className={styles.modalOptions}>
              {[
                { value: 'active', label: '구독중 (정상)' },
                { value: 'cancel_scheduled', label: '구독취소 (다음 결제일까지 유지)' },
                { value: 'cancelled', label: '취소됨 (즉시 종료)' },
              ].map(opt => (
                <label key={opt.value} className={styles.modalOption}>
                  <input
                    type="radio"
                    name="status"
                    value={opt.value}
                    checked={newStatus === opt.value}
                    onChange={() => setNewStatus(opt.value as SubStatus)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowModal(false)}>취소</button>
              <button className={styles.modalConfirm} onClick={handleStatusChange} disabled={modalLoading}>
                {modalLoading ? '변경 중...' : '변경'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 완료 토스트 */}
      {toast && (
        <div className={styles.toast}>{toast}</div>
      )}
    </div>
  )
}
