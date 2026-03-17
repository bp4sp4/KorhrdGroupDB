'use client'

import { useEffect, useState, useCallback } from 'react'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled'

// source 탭 구분: 'all' = 전체, 'hakjeom' = 학점연계 신청, 'edu' = 교육원
type SourceTab = 'all' | 'hakjeom' | 'edu'

interface CertApplication {
  id: string
  name: string
  contact: string
  birth_prefix: string
  address: string
  address_main?: string | null
  address_detail?: string | null
  certificates: string[]
  cash_receipt: string
  photo_url?: string | null
  order_id?: string | null
  amount?: number | null
  payment_status?: PaymentStatus | null
  trade_id?: string | null
  mul_no?: string | null
  pay_method?: string | null
  paid_at?: string | null
  failed_at?: string | null
  cancelled_at?: string | null
  is_checked?: boolean | null
  source?: string | null
  created_at: string
  updated_at?: string | null
}

interface Stats {
  total: number
  paid: number
  pending: number
  cancelled: number
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: '결제완료',
  pending: '결제대기',
  failed: '결제실패',
  cancelled: '취소',
}

const PAYMENT_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  paid: { bg: '#d1fae5', color: '#065f46' },
  pending: { bg: '#fef3c7', color: '#92400e' },
  failed: { bg: '#fee2e2', color: '#991b1b' },
  cancelled: { bg: '#fee2e2', color: '#991b1b' },
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: '전체 결제상태' },
  { value: 'paid', label: '결제완료' },
  { value: 'pending', label: '결제대기' },
  { value: 'cancelled', label: '취소' },
  { value: 'failed', label: '결제실패' },
]

// source 탭 정의: value는 API로 전달되는 source_tab 파라미터 값
const SOURCE_TABS: { value: SourceTab; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'hakjeom', label: '학점연계 신청' },
  { value: 'edu', label: '교육원' },
]

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

/** 결제 상태 배지 */
function PaymentBadge({ status }: { status?: PaymentStatus | null }) {
  const key = status ?? 'pending'
  const style = PAYMENT_STATUS_STYLE[key] ?? PAYMENT_STATUS_STYLE.pending
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 'var(--toss-radius-badge)',
      fontSize: 12,
      fontWeight: 600,
      background: style.bg,
      color: style.color,
      whiteSpace: 'nowrap',
    }}>
      {PAYMENT_STATUS_LABEL[key] ?? key}
    </span>
  )
}

/** 통계 카드 */
function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{
      background: 'var(--toss-card-bg)',
      border: '1px solid var(--toss-border)',
      borderRadius: 'var(--toss-radius-card)',
      padding: '20px 24px',
      boxShadow: 'var(--toss-shadow-card)',
      minWidth: 0,
      flex: 1,
    }}>
      <p style={{ fontSize: 13, color: 'var(--toss-text-secondary)', margin: '0 0 8px 0' }}>{label}</p>
      <p style={{
        fontSize: 28,
        fontWeight: 700,
        color: highlight ? 'var(--toss-blue)' : 'var(--toss-text-primary)',
        margin: 0,
        lineHeight: 1,
      }}>
        {value.toLocaleString()}
        <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 4, color: 'var(--toss-text-secondary)' }}>건</span>
      </p>
    </div>
  )
}

/** 행 클릭 시 오른쪽에서 슬라이드인 되는 상세 패널 */
function DetailPanel({
  app,
  onClose,
  onToggleChecked,
  updatingId,
}: {
  app: CertApplication
  onClose: () => void
  onToggleChecked: (id: string, current: boolean) => void
  updatingId: string | null
}) {
  const isChecked = !!app.is_checked

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.25)',
          zIndex: 40,
        }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 420,
        background: 'var(--toss-card-bg)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        zIndex: 50,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* 패널 헤더 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--toss-border)',
          position: 'sticky',
          top: 0,
          background: 'var(--toss-card-bg)',
          zIndex: 1,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--toss-text-primary)' }}>
            신청 상세
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: 'var(--toss-text-secondary)',
              lineHeight: 1,
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* 패널 본문 */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
          {/* 확인 처리 토글 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isChecked ? '#d1fae5' : 'var(--toss-bg)',
            border: `1px solid ${isChecked ? '#6ee7b7' : 'var(--toss-border)'}`,
            borderRadius: 'var(--toss-radius-card)',
            padding: '14px 16px',
          }}>
            <span style={{
              fontSize: 14,
              fontWeight: 600,
              color: isChecked ? '#065f46' : 'var(--toss-text-primary)',
            }}>
              {isChecked ? '확인 완료' : '미확인'}
            </span>
            <button
              onClick={() => onToggleChecked(app.id, isChecked)}
              disabled={updatingId === app.id}
              style={{
                padding: '7px 18px',
                borderRadius: 'var(--toss-radius-button)',
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                cursor: updatingId === app.id ? 'not-allowed' : 'pointer',
                background: isChecked ? '#ef4444' : 'var(--toss-blue)',
                color: '#fff',
                opacity: updatingId === app.id ? 0.6 : 1,
                transition: 'all 0.15s',
              }}
            >
              {updatingId === app.id ? '처리중...' : isChecked ? '확인 취소' : '확인 처리'}
            </button>
          </div>

          {/* 기본 정보 */}
          <DetailSection title="기본 정보">
            <DetailRow label="이름" value={app.name} />
            <DetailRow label="연락처" value={app.contact} />
            <DetailRow label="생년월일" value={app.birth_prefix} />
            <DetailRow label="주소" value={app.address_main ?? app.address} />
            {app.address_detail && (
              <DetailRow label="상세주소" value={app.address_detail} />
            )}
          </DetailSection>

          {/* 신청 자격증 */}
          <DetailSection title="신청 자격증">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 14px' }}>
              {app.certificates?.map((cert, idx) => (
                <span key={idx} style={{
                  padding: '4px 10px',
                  background: 'var(--toss-blue-subtle)',
                  color: 'var(--toss-blue)',
                  borderRadius: 'var(--toss-radius-badge)',
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  {cert}
                </span>
              ))}
            </div>
          </DetailSection>

          {/* 결제 정보 */}
          <DetailSection title="결제 정보">
            <DetailRow
              label="결제 상태"
              value={<PaymentBadge status={app.payment_status} />}
            />
            <DetailRow
              label="결제 금액"
              value={app.amount ? `${app.amount.toLocaleString()}원` : '-'}
            />
            <DetailRow label="결제 수단" value={app.pay_method ?? '-'} />
            <DetailRow label="결제번호(mul_no)" value={app.mul_no ?? '-'} mono />
            <DetailRow label="주문번호(order_id)" value={app.order_id ?? '-'} mono />
            <DetailRow label="거래번호(trade_id)" value={app.trade_id ?? '-'} mono />
            <DetailRow
              label="결제일"
              value={app.paid_at ? new Date(app.paid_at).toLocaleString('ko-KR') : '-'}
            />
            {app.failed_at && (
              <DetailRow
                label="실패일"
                value={new Date(app.failed_at).toLocaleString('ko-KR')}
              />
            )}
            {app.cancelled_at && (
              <DetailRow
                label="취소일"
                value={new Date(app.cancelled_at).toLocaleString('ko-KR')}
              />
            )}
            <DetailRow label="현금영수증" value={app.cash_receipt ?? '-'} />
          </DetailSection>

          {/* 기타 */}
          <DetailSection title="기타">
            <DetailRow label="출처(source)" value={app.source ?? '-'} />
            <DetailRow
              label="신청일"
              value={new Date(app.created_at).toLocaleString('ko-KR')}
            />
            {app.updated_at && (
              <DetailRow
                label="수정일"
                value={new Date(app.updated_at).toLocaleString('ko-KR')}
              />
            )}
          </DetailSection>

          {/* 사진 */}
          {app.photo_url && (
            <DetailSection title="제출 사진">
              <img
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${app.photo_url}`}
                alt="제출 사진"
                style={{
                  width: '100%',
                  borderRadius: 'var(--toss-radius-card)',
                  border: '1px solid var(--toss-border)',
                  objectFit: 'cover',
                  marginTop: 4,
                }}
              />
            </DetailSection>
          )}
        </div>
      </div>
    </>
  )
}

/** 상세 패널 내 섹션 */
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--toss-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        margin: '0 0 10px 0',
      }}>
        {title}
      </p>
      <div style={{
        background: 'var(--toss-bg)',
        border: '1px solid var(--toss-border)',
        borderRadius: 'var(--toss-radius-card)',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  )
}

/** 상세 패널 내 행 */
function DetailRow({
  label,
  value,
  mono,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '10px 14px',
      borderBottom: '1px solid var(--toss-border)',
    }}>
      <span style={{
        fontSize: 13,
        color: 'var(--toss-text-secondary)',
        minWidth: 100,
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 13,
        color: 'var(--toss-text-primary)',
        fontFamily: mono ? 'var(--font-mono)' : undefined,
        wordBreak: 'break-all',
      }}>
        {value ?? '-'}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function CertPage() {
  const [applications, setApplications] = useState<CertApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  // source 탭 상태: 전체/학점연계/교육원
  const [sourceTab, setSourceTab] = useState<SourceTab>('all')
  const [selectedApp, setSelectedApp] = useState<CertApplication | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // ── 데이터 fetch ──────────────────────────────
  const fetchApplications = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('payment_status', statusFilter)
      if (sourceTab !== 'all') params.set('source_tab', sourceTab)

      const res = await fetch(`/api/cert?${params.toString()}`)
      if (!res.ok) throw new Error('데이터를 불러오지 못했습니다.')
      const data: CertApplication[] = await res.json()
      setApplications(data)
    } catch (err) {
      console.error('[CertPage] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, sourceTab])

  useEffect(() => {
    fetchApplications()
  }, [fetchApplications])

  // ── 통계: 현재 탭 기준 데이터로 계산 ──────────
  const stats: Stats = {
    total: applications.length,
    paid: applications.filter((a) => a.payment_status === 'paid').length,
    pending: applications.filter((a) => a.payment_status === 'pending').length,
    cancelled: applications.filter((a) => a.payment_status === 'cancelled').length,
  }

  // ── 클라이언트 사이드 검색 필터링 ────────────
  const filtered = searchQuery.trim()
    ? applications.filter((app) => {
        const q = searchQuery.toLowerCase()
        const contactClean = app.contact.replace(/-/g, '')
        return (
          app.name.toLowerCase().includes(q) ||
          app.contact.toLowerCase().includes(q) ||
          contactClean.includes(q.replace(/-/g, ''))
        )
      })
    : applications

  // ── is_checked 토글 ───────────────────────────
  const handleToggleChecked = async (id: string, currentChecked: boolean) => {
    setUpdatingId(id)

    // Optimistic update
    const newChecked = !currentChecked
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_checked: newChecked } : a)),
    )
    if (selectedApp?.id === id) {
      setSelectedApp((prev) => (prev ? { ...prev, is_checked: newChecked } : prev))
    }

    try {
      const res = await fetch('/api/cert', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_checked: newChecked }),
      })
      if (!res.ok) throw new Error('업데이트 실패')
    } catch (err) {
      console.error('[CertPage] toggle checked error:', err)
      // 롤백
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_checked: currentChecked } : a)),
      )
      if (selectedApp?.id === id) {
        setSelectedApp((prev) => (prev ? { ...prev, is_checked: currentChecked } : prev))
      }
    } finally {
      setUpdatingId(null)
    }
  }

  // ── 탭 변경 시 선택 초기화 ─────────────────────
  const handleSourceTabChange = (tab: SourceTab) => {
    setSourceTab(tab)
    setSelectedApp(null)
    setSearchQuery('')
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* 페이지 헤더 */}
      <div>
        <h2 style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--toss-text-primary)',
          margin: 0,
        }}>
          민간자격증
        </h2>
        <p style={{ fontSize: 14, color: 'var(--toss-text-secondary)', marginTop: 4, marginBottom: 0 }}>
          민간자격증 신청 내역을 관리합니다.
        </p>
      </div>

      {/* source 탭 */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: '2px solid var(--toss-border)',
      }}>
        {SOURCE_TABS.map((tab) => {
          const isActive = sourceTab === tab.value
          return (
            <button
              key={tab.value}
              onClick={() => handleSourceTabChange(tab.value)}
              style={{
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--toss-blue)' : 'var(--toss-text-secondary)',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--toss-blue)' : '2px solid transparent',
                marginBottom: -2,
                cursor: 'pointer',
                transition: 'color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 통계 카드 */}
      <div style={{ display: 'flex', gap: 12 }}>
        <StatCard label="전체 신청" value={stats.total} />
        <StatCard label="결제완료" value={stats.paid} highlight />
        <StatCard label="결제대기" value={stats.pending} />
        <StatCard label="취소" value={stats.cancelled} />
      </div>

      {/* 검색 / 필터 */}
      <div style={{
        background: 'var(--toss-card-bg)',
        border: '1px solid var(--toss-border)',
        borderRadius: 'var(--toss-radius-card)',
        padding: '16px 20px',
        boxShadow: 'var(--toss-shadow-card)',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        {/* 이름·연락처 검색 */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <input
            type="text"
            placeholder="이름, 연락처 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 36px 9px 12px',
              border: '1px solid var(--toss-border)',
              borderRadius: 'var(--toss-radius-input)',
              fontSize: 14,
              color: 'var(--toss-text-primary)',
              background: 'var(--toss-bg)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                color: 'var(--toss-text-secondary)',
                padding: 0,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* 결제 상태 필터 */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '9px 12px',
            border: '1px solid var(--toss-border)',
            borderRadius: 'var(--toss-radius-input)',
            fontSize: 14,
            color: 'var(--toss-text-primary)',
            background: 'var(--toss-bg)',
            cursor: 'pointer',
            outline: 'none',
            minWidth: 130,
          }}
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* 새로고침 */}
        <button
          onClick={fetchApplications}
          disabled={loading}
          style={{
            padding: '9px 16px',
            borderRadius: 'var(--toss-radius-button)',
            fontSize: 14,
            fontWeight: 600,
            border: '1px solid var(--toss-border)',
            background: 'var(--toss-card-bg)',
            color: 'var(--toss-text-primary)',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          새로고침
        </button>
      </div>

      {/* 테이블 카드 */}
      <div style={{
        background: 'var(--toss-card-bg)',
        border: '1px solid var(--toss-border)',
        borderRadius: 'var(--toss-radius-card)',
        boxShadow: 'var(--toss-shadow-card)',
        overflow: 'hidden',
      }}>
        {/* 테이블 헤더 요약 */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--toss-border)',
          fontSize: 14,
          color: 'var(--toss-text-secondary)',
        }}>
          총 <strong style={{ color: 'var(--toss-text-primary)' }}>{filtered.length}</strong>건
          {searchQuery && (
            <span style={{ marginLeft: 8, color: 'var(--toss-blue)', fontSize: 13 }}>
              &quot;{searchQuery}&quot; 검색 결과
            </span>
          )}
        </div>

        {loading ? (
          <div style={{
            padding: '60px 24px',
            textAlign: 'center',
            color: 'var(--toss-text-secondary)',
            fontSize: 14,
          }}>
            데이터를 불러오고 있습니다...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            padding: '60px 24px',
            textAlign: 'center',
            color: 'var(--toss-text-secondary)',
            fontSize: 14,
          }}>
            신청 내역이 없습니다.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 14,
            }}>
              <thead>
                <tr style={{ background: 'var(--toss-bg)' }}>
                  {['이름', '연락처', '신청 자격증', '결제 금액', '결제 상태', '출처', '신청일'].map((h) => (
                    <th key={h} style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--toss-text-secondary)',
                      whiteSpace: 'nowrap',
                      borderBottom: '1px solid var(--toss-border)',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    style={{
                      cursor: 'pointer',
                      background: app.is_checked ? '#f0fdf4' : 'transparent',
                      borderBottom: '1px solid var(--toss-border)',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      if (!app.is_checked) {
                        (e.currentTarget as HTMLTableRowElement).style.background = 'var(--toss-bg)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!app.is_checked) {
                        (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                      }
                    }}
                  >
                    {/* 이름 */}
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--toss-text-primary)', whiteSpace: 'nowrap' }}>
                      {app.name}
                      {app.is_checked && (
                        <span style={{
                          marginLeft: 6,
                          fontSize: 11,
                          background: '#d1fae5',
                          color: '#065f46',
                          borderRadius: 4,
                          padding: '1px 6px',
                          fontWeight: 600,
                        }}>
                          확인
                        </span>
                      )}
                    </td>

                    {/* 연락처 */}
                    <td style={{ padding: '14px 16px', color: 'var(--toss-text-primary)', whiteSpace: 'nowrap' }}>
                      {app.contact}
                    </td>

                    {/* 신청 자격증 */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 280 }}>
                        {app.certificates?.map((cert, idx) => (
                          <span key={idx} style={{
                            padding: '2px 8px',
                            background: 'var(--toss-blue-subtle)',
                            color: 'var(--toss-blue)',
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}>
                            {cert}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* 결제 금액 */}
                    <td style={{ padding: '14px 16px', fontWeight: 500, color: 'var(--toss-text-primary)', whiteSpace: 'nowrap' }}>
                      {app.amount ? `${app.amount.toLocaleString()}원` : '-'}
                    </td>

                    {/* 결제 상태 */}
                    <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                      <PaymentBadge status={app.payment_status} />
                    </td>

                    {/* 출처 */}
                    <td style={{ padding: '14px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap', fontSize: 13 }}>
                      {app.source ?? '-'}
                    </td>

                    {/* 신청일 */}
                    <td style={{ padding: '14px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap', fontSize: 13 }}>
                      {new Date(app.created_at).toLocaleDateString('ko-KR')}
                      <br />
                      <span style={{ fontSize: 12 }}>
                        {new Date(app.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 상세 패널 */}
      {selectedApp && (
        <DetailPanel
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onToggleChecked={handleToggleChecked}
          updatingId={updatingId}
        />
      )}
    </div>
  )
}
