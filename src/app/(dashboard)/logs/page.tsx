'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import styles from './page.module.css'
import ActivityLogDense, { type LogEvent, type LogChange } from '@/components/activity/ActivityLogDense'

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
  // 상담/등록 시점
  counsel_completed_at: '상담완료일시',
  contact_scheduled_at: '연락예정일',
  registered_at: '등록일',
  last_counsel_level: '상담등급',
  current_situation: '현재상황',
  reaction_point: '반응포인트',
  delete_reason: '삭제사유',
  deleted_at: '삭제일시',
  // 학생 정보 (등록학생관리)
  phone: '연락처',
  education_level: '최종학력',
  major: '전공',
  desired_degree: '희망학위과정',
  course_id: '희망자격증과정',
  manager_name: '담당자',
  cost: '비용',
  unit_price: '과목당비용',
  class_start: '개강반',
  target_completion_date: '목표취득일',
  education_center_name: '등록교육원',
  education_center_id: '등록교육원ID',
  all_care: '올케어 가입',
  // 행정 절차
  learner_username: '학습자등록 아이디',
  learner_password: '학습자등록 비밀번호',
  credit_application: '학점인정신청',
  degree_application: '학위신청',
  course_plan_date: '수강신청 및 플랜',
  dup_check_university: '중복과목(전적대)',
  dup_check_certificate: '중복과목(자격증)',
  // 메타
  updated_at: '수정일시',
  created_at: '생성일시',
  user_id: '사용자ID',
  user_email: '사용자',
  display_name: '이름',
}

// 매핑되지 않은 영어 컬럼명을 한글 친화적으로 변환 (보조)
function humanizeKey(k: string): string {
  // 흔한 접미사 변환
  let s = k
  s = s.replace(/_at$/, '일시')
  s = s.replace(/_date$/, '일')
  s = s.replace(/_id$/, 'ID')
  s = s.replace(/_url$/, '주소')
  s = s.replace(/_/g, ' ')
  return s
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
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? '예' : '아니오'
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—'
  if (typeof v === 'string') {
    // ISO datetime → "yyyy.MM.dd HH:mm"
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
      const d = new Date(v)
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0')
        return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
      }
    }
    // 날짜만(YYYY-MM-DD) → "yyyy.MM.dd"
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.replace(/-/g, '.')
    // 큰 정수 금액 보정 (e.g. "720000" → "720,000원")  — 키와 무관하게 안전하게: 6자리 이상 숫자만
    if (/^\d{6,}$/.test(v) && Number(v) > 0) return Number(v).toLocaleString() + '원'
  }
  if (typeof v === 'number' && v >= 100000) return v.toLocaleString() + '원'
  return String(v)
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15

const ACTION_OPTIONS = [
  { value: '', label: '전체 액션' },
  { value: 'create', label: '등록' },
  { value: 'update', label: '수정' },
  { value: 'view', label: '조회' },
  { value: 'delete', label: '삭제(휴지통)' },
  { value: 'bulk_create', label: '일괄등록' },
  { value: 'bulk_delete', label: '일괄삭제' },
  { value: 'restore', label: '복원' },
  { value: 'hard_delete', label: '영구삭제' },
]

// DB의 resource 값 → 사이드바 메뉴명으로 표시 (실제 화면과 용어 통일)
const RESOURCE_LABEL_MAP: Record<string, string> = {
  '학점은행제 상담': '문의DB',
  '민간자격증 학생관리': '학생관리(자격증)',
  '자격증신청': '자격증 신청',
  '기관협약': '기관협약',
  '매출파일': '매출파일',
  '휴지통': '삭제목록',
  '어드민관리': '어드민 관리',
  '예산현황': '예산현황',
}

const RESOURCE_OPTIONS = [
  { value: '', label: '전체 메뉴' },
  { value: '학점은행제 상담', label: '문의DB' },
  { value: '민간자격증 학생관리', label: '학생관리(자격증)' },
  { value: '자격증신청', label: '자격증 신청' },
  { value: '기관협약', label: '기관협약' },
  { value: '매출파일', label: '매출파일' },
  { value: '예산현황', label: '예산현황' },
  { value: '휴지통', label: '삭제목록' },
  { value: '어드민관리', label: '어드민 관리' },
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

// ─── 날짜 포맷 ───────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return { date, time }
}

// 그룹 헤더 라벨: 오늘 / 어제 / N월 N일 (요일)
function dateGroupLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000)
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  if (diffDays === 0) return `오늘 · ${d.getMonth() + 1}월 ${d.getDate()}일 (${weekday})`
  if (diffDays === 1) return `어제 · ${d.getMonth() + 1}월 ${d.getDate()}일 (${weekday})`
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${weekday})`
}

function formatEmail(email: string | null) {
  if (!email) return '-'
  return email.split('@')[0]
}

// AuditLog → ActivityLogDense의 LogEvent로 변환
const ACTION_LABELS_LOG: Record<string, string> = {
  create: '등록',
  update: '수정',
  view: '조회',
  delete: '삭제',
  bulk_create: '일괄등록',
  bulk_delete: '일괄삭제',
  restore: '복원',
  hard_delete: '영구삭제',
}

function logToEvent(log: AuditLog): LogEvent {
  const { time } = formatDateTime(log.created_at)
  const dateHeader = dateGroupLabel(log.created_at)
  const actor = log.display_name ?? formatEmail(log.user_email)
  const target = extractTargetName(log.detail, log.resource_id)
  const actionLabel = ACTION_LABELS_LOG[log.action] ?? log.action
  const resourceLabel = RESOURCE_LABEL_MAP[log.resource] ?? log.resource
  const category = `${resourceLabel} · ${actionLabel}`

  // meta.changes → LogChange[]
  const rawChanges = log.meta?.changes as Record<string, unknown> | undefined
  const changes: LogChange[] = rawChanges
    ? Object.entries(rawChanges)
        .filter(([, v]) => {
          if (
            typeof v === 'object' &&
            v !== null &&
            !Array.isArray(v) &&
            'before' in (v as object)
          ) {
            const { before, after } = v as { before: unknown; after: unknown }
            return String(before ?? '') !== String(after ?? '')
          }
          return v !== null && v !== undefined && v !== ''
        })
        .map(([k, v]): LogChange => {
          const field = FIELD_LABELS[k] ?? humanizeKey(k)
          if (
            typeof v === 'object' &&
            v !== null &&
            !Array.isArray(v) &&
            'before' in (v as object)
          ) {
            const { before, after } = v as { before: unknown; after: unknown }
            return {
              field,
              from: formatChangeVal(before),
              to: formatChangeVal(after),
            }
          }
          return { field, to: formatChangeVal(v) }
        })
    : []

  // 변경 항목 없으면 detail을 note로 사용
  const finalChanges = changes.length > 0 ? changes : [{ note: log.detail ?? actionLabel }]

  return {
    id: log.id,
    time,
    date: dateHeader,
    actor,
    target,
    category,
    changes: finalChanges,
  }
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
  const [actor, setActor] = useState('') // user_email
  const [actorOptions, setActorOptions] = useState<
    { value: string; label: string }[]
  >([])

  // 담당자 옵션 1회 로드
  useEffect(() => {
    fetch('/api/logs/actors')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.actors) return
        const opts: { value: string; label: string }[] = [
          { value: '', label: '전체 담당자' },
          ...data.actors.map(
            (a: { email: string; displayName: string }) => ({
              value: a.email,
              label: a.displayName,
            }),
          ),
        ]
        setActorOptions(opts)
      })
      .catch(() => {})
  }, [])

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (resource) params.set('resource', resource)
      if (action) params.set('action', action)
      if (search) params.set('search', search)
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      if (actor) params.set('actor', actor)
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
  }, [resource, action, search, fromDate, toDate, actor])

  useEffect(() => {
    setPage(1)
  }, [resource, action, search, fromDate, toDate, actor])

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
    setActor('')
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

        <CustomSelect
          value={actor}
          onChange={setActor}
          options={
            actorOptions.length > 0
              ? actorOptions
              : [{ value: '', label: '전체 담당자' }]
          }
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

      {/* 로그 — Dense 디자인 (한 줄 압축) */}
      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.emptyWrap}>로딩 중...</div>
        ) : (
          <ActivityLogDense events={logs.map(logToEvent)} />
        )}

        {/* 페이지네이션 */}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  )
}
