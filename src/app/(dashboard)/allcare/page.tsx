'use client'

import { useEffect, useState, useCallback } from 'react'
import styles from './page.module.css'
import {
  ResponsiveContainer, ComposedChart, AreaChart, BarChart, PieChart,
  Bar, Line, Area, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'

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

type Tab = 'users' | 'payments' | 'custom' | 'stats'

interface ChartData {
  monthly: { month: string; users: number; subs: number }[]
  statusDist: { name: string; value: number; fill: string }[]
  revenueDist: { name: string; value: number }[]
  dailyUsers: { date: string; count: number }[]
}
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

// ─── 차트 툴팁 ────────────────────────────────────────────────────────────────

function AlcareTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.statsTip}>
      <p className={styles.statsTipLabel}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className={styles.statsTipRow} style={{ color: p.fill ?? '#3b82f6' }}>
          {p.name}: {typeof p.value === 'number' && p.value >= 10000
            ? p.value.toLocaleString('ko-KR') + '원'
            : p.value + (p.name === '신규회원' || p.name === '신규구독' ? '명' : '')}
        </p>
      ))}
    </div>
  )
}

function RevTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.statsTip}>
      <p className={styles.statsTipLabel}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className={styles.statsTipRow}>{p.name}: {p.value.toLocaleString('ko-KR')}원</p>
      ))}
    </div>
  )
}

// ─── 통계 탭 ──────────────────────────────────────────────────────────────────

function AllcareStatsTab({ stats, chartData }: { stats: Stats | null; chartData: ChartData | null }) {
  const REV_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b']

  return (
    <div className={styles.statsContainer}>
      {/* 요약 카드 */}
      <div className={styles.statsGrid4}>
        <div className={styles.statsCard}>
          <p className={styles.statsCardLabel}>전체 회원</p>
          <p className={styles.statsCardValue}>{stats?.totalUsers?.toLocaleString() ?? '-'}<span className={styles.statsCardUnit}>명</span></p>
        </div>
        <div className={styles.statsCard}>
          <p className={styles.statsCardLabel}>활성 구독</p>
          <p className={styles.statsCardValue}>{stats?.activeSubscriptions?.toLocaleString() ?? '-'}<span className={styles.statsCardUnit}>명</span></p>
        </div>
        <div className={styles.statsCard}>
          <p className={styles.statsCardLabel}>취소된 구독</p>
          <p className={styles.statsCardValue}>{stats?.cancelledSubscriptions?.toLocaleString() ?? '-'}<span className={styles.statsCardUnit}>명</span></p>
        </div>
        <div className={styles.statsCard}>
          <p className={styles.statsCardLabel}>총 매출</p>
          <p className={styles.statsCardValue}>{stats ? (stats.totalRevenue / 10000).toFixed(0) : '-'}<span className={styles.statsCardUnit}>만원</span></p>
        </div>
      </div>

      {/* 차트 2열 */}
      <div className={styles.statsRow2}>
        {/* 월별 신규 회원 & 구독 */}
        <div className={styles.statsPanel}>
          <p className={styles.statsPanelTitle}>월별 신규 회원 & 구독</p>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData?.monthly ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip content={<AlcareTip />} />
              <Bar dataKey="users" name="신규회원" fill="#93c5fd" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="subs" name="신규구독" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
              <Line type="monotone" dataKey="users" name="신규회원" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* 구독 상태 분포 */}
        <div className={styles.statsPanel}>
          <p className={styles.statsPanelTitle}>구독 상태 분포</p>
          <div className={styles.statsPieWrap}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={chartData?.statusDist ?? []} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {chartData?.statusDist.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v}명`, '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.statsLegend}>
              {chartData?.statusDist.map((d, i) => (
                <div key={i} className={styles.statsLegendItem}>
                  <span className={styles.statsLegendDot} style={{ background: d.fill }} />
                  <span className={styles.statsLegendName}>{d.name}</span>
                  <span className={styles.statsLegendVal}>{d.value}명</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.statsRow2}>
        {/* 일별 신규 회원 (30일) */}
        <div className={styles.statsPanel}>
          <p className={styles.statsPanelTitle}>일별 신규 회원 (최근 30일)</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData?.dailyUsers ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="allcareUserGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip formatter={(v: number) => [`${v}명`, '신규 회원']} />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#allcareUserGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 매출 분포 */}
        <div className={styles.statsPanel}>
          <p className={styles.statsPanelTitle}>매출 구성</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData?.revenueDist ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${(v / 10000).toFixed(0)}만`} />
              <Tooltip content={<RevTip />} />
              <Bar dataKey="value" name="매출" radius={[6, 6, 0, 0]} barSize={40}>
                {chartData?.revenueDist.map((_, i) => <Cell key={i} fill={REV_COLORS[i % REV_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function AllcarePage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('users')

  // 회원
  const [users, setUsers] = useState<UserData[]>([])
  const [userTotal, setUserTotal] = useState(0)
  const [userPage, setUserPage] = useState(1)
  const [userSearch, setUserSearch] = useState('')

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
    fetch('/api/allcare/charts')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setChartData(d))
      .catch(() => {})
  }, [])

  // ─── 회원 ─────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(() => {
    setUsersLoading(true)
    const params = new URLSearchParams({
      page: String(userPage),
      search: userSearch,
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
  }, [userPage, userSearch])

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

    const start = Math.max(1, page - 2)
    const end = Math.min(totalPages, start + 4)
    const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i)

    return (
      <div className={styles.pagination}>
        <button className={styles.pageBtn} onClick={() => onPage(1)} disabled={page <= 1}>처음</button>
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
        <button className={styles.pageBtn} onClick={() => onPage(totalPages)} disabled={page >= totalPages}>마지막</button>
        <span className={styles.pageInfo}>총 {total}건 · {page}/{totalPages}페이지</span>
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
          <div className={styles.revenueBreakdown}>
            <div className={styles.revenueRow}>
              <span className={styles.revenueLabel}>구독</span>
              <span className={styles.revenueAmt}>{stats ? fmt(stats.subscriptionRevenue) : '-'}</span>
            </div>
            <div className={styles.revenueRow}>
              <span className={styles.revenueLabel}>패키지</span>
              <span className={styles.revenueAmt}>{stats ? fmt(stats.packageRevenue) : '-'}</span>
            </div>
            <div className={styles.revenueRow}>
              <span className={styles.revenueLabel}>단과</span>
              <span className={styles.revenueAmt}>{stats ? fmt(stats.customRevenue) : '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className={styles.tabs}>
        {(['users', 'payments', 'stats'] as Tab[]).map(t => (
          <button
            key={t}
            className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t === 'users' ? '회원 목록' : t === 'payments' ? '결제 내역' : '통계'}
          </button>
        ))}
      </div>

      {/* 회원 탭 */}
      {activeTab === 'users' && (
        <>
          <div className={styles.filterRow}>
            <div className={styles.searchBox}>
              <svg className={styles.searchIcon} viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M14 14l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                className={styles.searchInput}
                placeholder="이름, 이메일, 전화번호 검색"
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setUserPage(1) }}
              />
            </div>
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
                      <th>가입일</th>
                      <th>구독 상태</th>
                      <th>플랜</th>
                      <th>구독료</th>
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

      {/* 열람권 확인 팝업 */}
      {accessConfirm && (
        <div className={styles.modalOverlay} onClick={() => setAccessConfirm(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={`${styles.modalIcon} ${accessConfirm.newAccess ? styles.modalIconGreen : styles.modalIconGray}`}>
              {accessConfirm.newAccess ? '✓' : '✕'}
            </div>
            <h3 className={styles.modalTitle}>실습매칭 열람권</h3>
            <div className={styles.modalUserChip}>{accessConfirm.user.name} · {accessConfirm.user.email}</div>
            <p className={styles.modalDesc}>
              {accessConfirm.newAccess
                ? '이 회원에게 실습매칭 열람권을 허용합니다.'
                : '이 회원의 실습매칭 열람권을 해제합니다.'}
            </p>
            <div className={styles.modalActionsCol}>
              <button
                className={`${styles.modalConfirmFull} ${accessConfirm.newAccess ? '' : styles.modalConfirmDanger}`}
                onClick={handleAccessConfirm}
              >
                {accessConfirm.newAccess ? '허용하기' : '해제하기'}
              </button>
              <button className={styles.modalCancelFull} onClick={() => setAccessConfirm(null)}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 상태변경 모달 */}
      {showModal && selectedUser && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>구독 상태 변경</h3>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className={styles.modalUserChip}>{selectedUser.name} · {selectedUser.email}</div>
            <div className={styles.modalOptions}>
              {[
                { value: 'active', label: '구독중', desc: '정상 구독 상태로 유지됩니다' },
                { value: 'cancel_scheduled', label: '구독취소 예정', desc: '다음 결제일까지 서비스가 유지됩니다' },
                { value: 'cancelled', label: '취소됨', desc: '즉시 서비스가 종료됩니다' },
              ].map(opt => (
                <label key={opt.value} className={`${styles.modalOptionCard} ${newStatus === opt.value ? styles.modalOptionCardActive : ''}`}>
                  <input
                    type="radio"
                    name="status"
                    value={opt.value}
                    checked={newStatus === opt.value}
                    onChange={() => setNewStatus(opt.value as SubStatus)}
                  />
                  <div className={styles.modalOptionText}>
                    <div className={styles.modalOptionLabel}>{opt.label}</div>
                    <div className={styles.modalOptionDesc}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className={styles.modalActionsCol}>
              <button className={styles.modalConfirmFull} onClick={handleStatusChange} disabled={modalLoading}>
                {modalLoading ? '변경 중...' : '변경하기'}
              </button>
              <button className={styles.modalCancelFull} onClick={() => setShowModal(false)}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 통계 탭 */}
      {activeTab === 'stats' && (
        <AllcareStatsTab stats={stats} chartData={chartData} />
      )}

      {/* 완료 토스트 */}
      {toast && (
        <div className={styles.toast}>{toast}</div>
      )}
    </div>
  )
}
