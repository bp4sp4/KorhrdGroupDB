'use client'

import { useEffect, useState, useCallback } from 'react'
import styles from '../hakjeom/page.module.css'

// ─── Types ───────────────────────────────────
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled'

interface MiniAdminApplication {
  id: string
  name: string
  contact: string
  payment_status: PaymentStatus | null
  created_at: string
  certificates: string[]
  amount: number | null
  ref: string | null
}

// ─── Constants ───────────────────────────────
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: '결제완료',
  pending: '결제대기',
  failed: '결제실패',
  cancelled: '취소',
}

const PAYMENT_STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  paid: { bg: '#d1fae5', color: '#065f46' },
  pending: { bg: '#fef3c7', color: '#92400e' },
  failed: { bg: '#fee2e2', color: '#991b1b' },
  cancelled: { bg: '#fee2e2', color: '#991b1b' },
}

const PAGE_SIZE = 10

export default function PaymentStatusPage() {
  const [rows, setRows] = useState<MiniAdminApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchName, setSearchName] = useState('')
  const [filterStatus, setFilterStatus] = useState('paid')
  const [page, setPage] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (searchName) params.set('name', searchName)
      if (filterStatus !== 'all') params.set('payment_status', filterStatus)

      const res = await fetch(`/api/mini-admin?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || '데이터 조회 실패')
      }
      const data = await res.json()
      setRows(data)
      setPage(0)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [searchName, filterStatus])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── 통계 ───────────────────────────────
  const stats = {
    total: rows.length,
    paid: rows.filter(r => r.payment_status === 'paid').length,
    pending: rows.filter(r => r.payment_status === 'pending').length,
  }

  // ─── 페이징 ────────────────────────────
  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const pagedRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#991b1b' }}>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 통계 카드 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { label: '전체 신청', value: stats.total, color: '#3182f6' },
          { label: '결제완료', value: stats.paid, color: '#065f46' },
          { label: '결제대기', value: stats.pending, color: '#92400e' },
        ].map(s => (
          <div key={s.label} style={{
            flex: '1 1 160px',
            background: 'var(--toss-card-bg)',
            border: '1px solid var(--toss-border)',
            borderRadius: 'var(--toss-radius-card)',
            padding: '16px 20px',
            boxShadow: 'var(--toss-shadow-card)',
          }}>
            <p style={{ fontSize: 12, color: 'var(--toss-text-secondary)', margin: 0 }}>{s.label}</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: s.color, margin: '4px 0 0' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className={styles.filterRow}>
        <input
          className={styles.input}
          placeholder="이름 검색"
          value={searchName}
          onChange={e => setSearchName(e.target.value)}
          style={{ width: 160 }}
        />
        <select
          className={styles.select}
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">전체 상태</option>
          <option value="paid">결제완료</option>
          <option value="pending">결제대기</option>
          <option value="failed">결제실패</option>
          <option value="cancelled">취소</option>
        </select>
      </div>

      {/* 테이블 */}
      <div style={{
        background: 'var(--toss-card-bg)',
        border: '1px solid var(--toss-border)',
        borderRadius: 'var(--toss-radius-card)',
        boxShadow: 'var(--toss-shadow-card)',
        overflow: 'hidden',
      }}>
        <div className={styles.tableOverflow}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>이름</th>
                <th className={styles.th}>연락처</th>
                <th className={styles.th}>결제상태</th>
                <th className={styles.th}>금액</th>
                <th className={styles.th}>신청일</th>
                <th className={styles.th}>자격증</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className={styles.td} colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                    로딩 중...
                  </td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td className={styles.td} colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--toss-text-tertiary)' }}>
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                pagedRows.map(row => {
                  const statusKey = row.payment_status ?? 'pending'
                  const statusColor = PAYMENT_STATUS_COLOR[statusKey] ?? PAYMENT_STATUS_COLOR.pending
                  return (
                    <tr key={row.id}>
                      <td className={styles.td} style={{ fontWeight: 600 }}>{row.name}</td>
                      <td className={styles.td}>{row.contact}</td>
                      <td className={styles.td}>
                        <span className={styles.statusBadge} style={{
                          background: statusColor.bg,
                          color: statusColor.color,
                        }}>
                          {PAYMENT_STATUS_LABEL[statusKey] ?? statusKey}
                        </span>
                      </td>
                      <td className={styles.td}>
                        {row.amount != null ? `${row.amount.toLocaleString()}원` : '-'}
                      </td>
                      <td className={styles.td}>
                        {new Date(row.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className={styles.td} style={{ maxWidth: 200 }}>
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 4,
                        }}>
                          {row.certificates?.slice(0, 3).map((cert, i) => (
                            <span key={i} style={{
                              fontSize: 11,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: '#f3f4f6',
                              color: '#374151',
                              whiteSpace: 'nowrap',
                            }}>
                              {cert}
                            </span>
                          ))}
                          {row.certificates?.length > 3 && (
                            <span style={{ fontSize: 11, color: 'var(--toss-text-tertiary)' }}>
                              +{row.certificates.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 페이징 */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            padding: '12px 0',
            borderTop: '1px solid var(--toss-border)',
          }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: '6px 12px',
                fontSize: 13,
                border: '1px solid var(--toss-border)',
                borderRadius: 6,
                background: page === 0 ? '#f9fafb' : '#fff',
                color: page === 0 ? '#d1d5db' : 'var(--toss-text-primary)',
                cursor: page === 0 ? 'default' : 'pointer',
              }}
            >
              이전
            </button>
            <span style={{ fontSize: 13, color: 'var(--toss-text-secondary)' }}>
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{
                padding: '6px 12px',
                fontSize: 13,
                border: '1px solid var(--toss-border)',
                borderRadius: 6,
                background: page >= totalPages - 1 ? '#f9fafb' : '#fff',
                color: page >= totalPages - 1 ? '#d1d5db' : 'var(--toss-text-primary)',
                cursor: page >= totalPages - 1 ? 'default' : 'pointer',
              }}
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
