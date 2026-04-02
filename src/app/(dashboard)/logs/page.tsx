'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import styles from './page.module.css'

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: number
  created_at: string
  user_id: string | null
  user_email: string | null
  display_name: string | null
  action: string
  resource: string
  resource_id: string | null
  detail: string | null
  meta: Record<string, unknown> | null
}

// ─── 필드명 한글 레이블 ───────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  status: '상태',
  memo: '메모',
  manager: '담당자',
  counsel_check: '상담확인',
  subject_cost: '수강료',
  name: '이름',
  contact: '연락처',
  education: '학력',
  reason: '상담경로',
  click_source: '유입경로',
  residence: '거주지',
  hope_course: '희망과정',
  major_category: '분류',
  category: '카테고리',
  address: '주소',
  address_detail: '상세주소',
  institution_name: '기관명',
  credit_commission: '학점수수료',
  private_commission: '민간수수료',
  is_checked: '확인여부',
  payment_status: '결제상태',
  birth_prefix: '생년월일',
  certificates: '자격증',
  cash_receipt: '현금영수증',
  amount: '금액',
  mul_no: '물류번호',
  pay_method: '결제방법',
  source: '출처',
  progress: '진행상황',
  practice_place: '실습기관',
  student_status: '학생상태',
  notes: '비고',
  study_method: '학습방법',
  is_completed: '완료여부',
  service_practice: '실습서비스',
  service_employment: '취업서비스',
  practice_planned_date: '실습예정일',
  employment_hope_time: '취업희망시기',
  employment_support_fund: '취업지원금',
  type: '유형',
  practice_type: '실습유형',
  desired_job_field: '희망직종',
  employment_types: '고용형태',
  certifications: '보유자격증',
  payment_amount: '결제금액',
  has_resume: '이력서',
  gender: '성별',
  birth_date: '생년월일',
}

function extractTargetName(detail: string | null, resourceId: string | null): string {
  if (!detail) return resourceId ?? '-'
  if (detail.startsWith('ID ')) return resourceId ?? '-'
  if (/^\d+건/.test(detail)) return '-'
  const name = detail
    .replace(/ 상담 등록$/, '')
    .replace(/ 기관 등록$/, '')
    .replace(/ 신청 등록$/, '')
    .replace(/ 실습신청 등록$/, '')
    .replace(/ 수정$/, '')
    .replace(/ 삭제$/, '')
    .replace(/ 복원$/, '')
    .trim()
  return name || resourceId || '-'
}

function formatChangeVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return '(없음)'
  if (typeof v === 'boolean') return v ? '예' : '아니오'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15

const ACTION_OPTIONS = [
  { value: '', label: '전체 액션' },
  { value: 'create', label: '등록' },
  { value: 'update', label: '수정' },
  { value: 'delete', label: '삭제(휴지통)' },
  { value: 'bulk_create', label: '일괄등록' },
  { value: 'bulk_delete', label: '일괄삭제' },
  { value: 'restore', label: '복원' },
  { value: 'hard_delete', label: '영구삭제' },
]

const RESOURCE_OPTIONS = [
  { value: '', label: '전체 메뉴' },
  { value: '학점은행제 상담', label: '학점은행제 상담' },
  { value: '민간자격증 상담', label: '민간자격증 상담' },
  { value: '기관협약', label: '기관협약' },
  { value: '자격증신청', label: '자격증신청' },
  { value: '실습/취업 상담', label: '실습/취업 상담' },
  { value: '실습섭외신청', label: '실습섭외신청' },
  { value: '취업신청', label: '취업신청' },
  { value: '휴지통', label: '휴지통' },
  { value: '어드민관리', label: '어드민관리' },
]

// ─── Custom Select ────────────────────────────────────────────────────────────

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

function CustomSelect({ value, onChange, options }: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 6,
        left: rect.left,
        minWidth: rect.width,
        zIndex: 9999,
      })
    }
    setOpen(v => !v)
  }

  const selected = options.find(o => o.value === value)
  const isDefault = !value

  return (
    <div ref={ref} className={styles.customSelectWrap}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={`${styles.customSelectTrigger} ${open ? styles.customSelectTriggerOpen : ''}`}
      >
        <span className={isDefault ? styles.customSelectPlaceholder : styles.customSelectValue}>
          {selected?.label ?? options[0]?.label}
        </span>
        <svg
          className={`${styles.customSelectCaret} ${open ? styles.customSelectCaretOpen : ''}`}
          width="13" height="13" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className={styles.customSelectDropdown} style={dropdownStyle}>
          {options.map(opt => (
            <div
              key={opt.value}
              className={`${styles.customSelectOption} ${opt.value === value ? styles.customSelectOptionActive : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false) }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 액션 배지 ────────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    create: { label: '등록', cls: styles.badgeCreate },
    update: { label: '수정', cls: styles.badgeUpdate },
    delete: { label: '삭제', cls: styles.badgeDelete },
    bulk_create: { label: '일괄등록', cls: styles.badgeBulkCreate },
    bulk_delete: { label: '일괄삭제', cls: styles.badgeBulkDelete },
    restore: { label: '복원', cls: styles.badgeRestore },
    hard_delete: { label: '영구삭제', cls: styles.badgeHardDelete },
  }
  const m = map[action] ?? { label: action, cls: '' }
  return <span className={`${styles.badge} ${m.cls}`}>{m.label}</span>
}

// ─── 날짜 포맷 ───────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return { date, time }
}

function formatEmail(email: string | null) {
  if (!email) return '-'
  return email.split('@')[0]
}

// ─── 페이지네이션 ─────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div className={styles.pagination}>
      <button
        className={styles.pageBtn}
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
      >
        ‹
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className={styles.pageEllipsis}>…</span>
        ) : (
          <button
            key={p}
            className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ''}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        )
      )}
      <button
        className={styles.pageBtn}
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
      >
        ›
      </button>
    </div>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────────────

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const [resource, setResource] = useState('')
  const [action, setAction] = useState('')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (resource) params.set('resource', resource)
      if (action) params.set('action', action)
      if (search) params.set('search', search)
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      params.set('page', String(p))

      const res = await fetch(`/api/logs?${params.toString()}`)
      if (!res.ok) return
      const json = await res.json()
      setLogs(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch {
      //
    } finally {
      setLoading(false)
    }
  }, [resource, action, search, fromDate, toDate])

  useEffect(() => {
    setPage(1)
  }, [resource, action, search, fromDate, toDate])

  useEffect(() => {
    fetchLogs(page)
  }, [fetchLogs, page])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function reset() {
    setResource('')
    setAction('')
    setSearch('')
    setFromDate('')
    setToDate('')
  }

  return (
    <div>
      {/* 필터 */}
      <div className={styles.filterRow}>
        <CustomSelect
          value={resource}
          onChange={setResource}
          options={RESOURCE_OPTIONS}
        />

        <CustomSelect
          value={action}
          onChange={setAction}
          options={ACTION_OPTIONS}
        />

        <input
          type="date"
          className={styles.filterDateInput}
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
        />
        <span className={styles.filterDateSep}>~</span>
        <input
          type="date"
          className={styles.filterDateInput}
          value={toDate}
          onChange={e => setToDate(e.target.value)}
        />

        <input
          type="text"
          className={styles.filterSearch}
          placeholder="이메일 / 내용 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <button className={styles.resetBtn} onClick={reset}>초기화</button>

        <span className={styles.countText}>
          {loading ? '로딩 중...' : `총 ${total.toLocaleString()}건`}
        </span>
      </div>

      {/* 테이블 */}
      <div className={styles.tableCard}>
        <div className={styles.tableOverflow}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th className={styles.th}>시간</th>
              <th className={styles.th}>대상</th>
              <th className={styles.th}>구분</th>
              <th className={styles.th}>변경 내용</th>
              <th className={styles.th}>담당자</th>
            </tr>
          </thead>
          <tbody>
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className={styles.emptyWrap}>로그가 없습니다.</div>
                </td>
              </tr>
            )}
            {logs.map(log => {
              const { date, time } = formatDateTime(log.created_at)
              return (
                <tr key={log.id} className={styles.tr}>
                  <td className={styles.td}>
                    <div className={styles.timeCell}>
                      <span className={styles.timeDate}>{date}</span>
                      <span className={styles.timeTime}>{time}</span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.targetName}>{extractTargetName(log.detail, log.resource_id)}</span>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.actionCell}>
                      <ActionBadge action={log.action} />
                      <span className={styles.resourceTag}>{log.resource}</span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.detailWrap}>
                      {log.meta?.changes && Object.keys(log.meta.changes as object).length > 0 ? (
                        <div className={styles.changesList}>
                          {Object.entries(log.meta.changes as Record<string, unknown>)
                            .filter(([, v]) => {
                              if (typeof v === 'object' && v !== null && !Array.isArray(v) && 'before' in (v as object)) {
                                const { before, after } = v as { before: unknown; after: unknown }
                                return String(before ?? '') !== String(after ?? '')
                              }
                              return v !== null && v !== undefined && v !== ''
                            })
                            .map(([k, v]) => {
                              const label = FIELD_LABELS[k] ?? k
                              if (typeof v === 'object' && v !== null && !Array.isArray(v) && 'before' in (v as object)) {
                                const { before, after } = v as { before: unknown; after: unknown }
                                return (
                                  <span key={k} className={styles.changeItem}>
                                    <span className={styles.changeKey}>{label}</span>
                                    <span className={styles.changeBefore}>{formatChangeVal(before)}</span>
                                    <span className={styles.changeArrow}>→</span>
                                    <span className={styles.changeAfter}>{formatChangeVal(after)}</span>
                                  </span>
                                )
                              }
                              return (
                                <span key={k} className={styles.changeItem}>
                                  <span className={styles.changeKey}>{label}</span>
                                  <span className={styles.changeVal}>{formatChangeVal(v)}</span>
                                </span>
                              )
                            })}
                        </div>
                      ) : (
                        <span className={styles.detailText}>{log.detail ?? '-'}</span>
                      )}
                    </div>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.userText}>{log.display_name ?? formatEmail(log.user_email)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>

        {/* 페이지네이션 */}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  )
}
