'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import styles from '../hakjeom/page.module.css'

// ─── 탭 타입 ─────────────────────────────────────────────────────────────────

type PracticeTab = 'consultation' | 'practice' | 'employment'

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

type ConsultationStatus = '상담대기' | '상담중' | '보류' | '등록대기' | '등록완료'
type ConsultationType = 'consultation' | 'practice' | 'employment'

interface PracticeConsultation {
  id: number
  name: string
  contact: string
  type: ConsultationType | null
  progress: string | null
  employment_consulting: boolean
  employment_connection: boolean
  student_status: string | null
  practice_place: string | null
  employment_after_cert: string | null
  education: string | null
  hope_course: string | null
  reason: string | null
  click_source: string | null
  memo: string | null
  status: ConsultationStatus
  subject_cost: number | null
  manager: string | null
  residence: string | null
  study_method: string | null
  address: string | null
  is_completed: boolean | null
  notes: string | null
  service_practice: boolean
  service_employment: boolean
  practice_planned_date: string | null
  employment_hope_time: string | null
  employment_support_fund: boolean | null
  created_at: string
  updated_at: string
}

interface PracticeApplication {
  id: string
  student_name: string
  gender: string | null
  contact: string
  birth_date: string | null
  residence_area: string | null
  address: string | null
  practice_start_date: string | null
  grade_report_date: string | null
  preferred_semester: string | null
  practice_type: string | null
  preferred_days: string | null
  has_car: boolean
  cash_receipt_number: string | null
  privacy_agreed: boolean
  practice_place: string | null
  click_source: string | null
  status: string
  memo: string | null
  manager: string | null
  created_at: string
  updated_at: string
}

interface EmploymentApplication {
  id: string
  name: string
  gender: string | null
  contact: string
  birth_date: string | null
  address: string | null
  address_detail: string | null
  desired_job_field: string | null
  employment_types: string[]
  has_resume: boolean | null
  certifications: string | null
  payment_amount: number
  payment_status: string
  payment_id: string | null
  privacy_agreed: boolean
  terms_agreed: boolean
  click_source: string | null
  status: string
  memo: string | null
  manager: string | null
  created_at: string
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

const CONSULTATION_STATUS_OPTIONS: ConsultationStatus[] = ['상담대기', '상담중', '보류', '등록대기', '등록완료']

const CONSULTATION_TYPE_LABEL: Record<ConsultationType, string> = {
  consultation: '상담',
  practice: '실습',
  employment: '취업',
}

const CONSULTATION_STATUS_STYLE: Record<ConsultationStatus, { background: string; color: string }> = {
  상담대기: { background: '#EBF3FE', color: '#3182F6' },
  상담중:   { background: '#FFF8E6', color: '#D97706' },
  보류:     { background: '#F3F4F6', color: '#6B7684' },
  등록대기: { background: '#FEF3C7', color: '#B45309' },
  등록완료: { background: '#DCFCE7', color: '#16A34A' },
}

const PAYMENT_STATUS_STYLE: Record<string, { background: string; color: string }> = {
  paid:      { background: '#d1fae5', color: '#065f46' },
  pending:   { background: '#fef3c7', color: '#92400e' },
  failed:    { background: '#fee2e2', color: '#991b1b' },
  cancelled: { background: '#fee2e2', color: '#991b1b' },
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: '결제완료', pending: '결제대기', failed: '결제실패', cancelled: '취소',
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function formatDateTime(dateString: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateString))
}

function formatDateShort(dateString: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(dateString))
}

function getPaginationPages(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const delta = 2
  const rangeStart = Math.max(2, current - delta)
  const rangeEnd = Math.min(total - 1, current + delta)
  const pages: (number | '...')[] = [1]
  if (rangeStart > 2) pages.push('...')
  for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i)
  if (rangeEnd < total - 1) pages.push('...')
  pages.push(total)
  return pages
}

// ─── 공통 서브 컴포넌트 ──────────────────────────────────────────────────────

function Highlight({ text, query }: { text: string | null; query: string }) {
  if (!query || !text) return <>{text ?? '-'}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  if (parts.length > 1) {
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase()
            ? <mark key={i} style={{ background: '#FFE500', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
            : part
        )}
      </>
    )
  }
  return <>{text}</>
}

function StatusBadge({ status, styleMap }: {
  status: string
  styleMap: Record<string, { background: string; color: string }>
}) {
  const s = styleMap[status] ?? { background: '#F3F4F6', color: '#6B7684' }
  return (
    <span className={styles.statusBadge} style={{ background: s.background, color: s.color }}>
      {status}
    </span>
  )
}

function StatusSelect({
  value, onChange, options, styleMap,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  styleMap: Record<string, { background: string; color: string }>
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  const s = styleMap[value] ?? { background: '#F3F4F6', color: '#6B7684' }
  return (
    <>
      <span
        className={styles.statusBadgeBtn}
        style={{ background: s.background, color: s.color }}
        onClick={e => {
          e.stopPropagation()
          const rect = e.currentTarget.getBoundingClientRect()
          setPos({ top: rect.bottom + 4, left: rect.left })
          setOpen(v => !v)
        }}
      >{value}</span>
      {open && (
        <div
          className={styles.statusSelectDropdown}
          style={{ top: pos.top, left: pos.left }}
          onClick={e => e.stopPropagation()}
        >
          {options.map(opt => {
            const st = styleMap[opt] ?? { background: '#F3F4F6', color: '#6B7684' }
            return (
              <div
                key={opt}
                className={`${styles.statusSelectOption}${value === opt ? ` ${styles.statusSelectOptionActive}` : ''}`}
                onClick={() => { onChange(opt); setOpen(false) }}
              >
                <span className={styles.statusSelectDot} style={{ background: st.color }} />
                {opt}
                {value === opt && <span style={{ marginLeft: 'auto', color: st.color, fontSize: 11 }}>✓</span>}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function CustomSelect({ value, onChange, options, placeholder, fullWidth, style }: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  fullWidth?: boolean
  style?: React.CSSProperties
}) {
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
      setDropdownStyle({ position: 'fixed', top: rect.bottom + 6, left: rect.left, width: rect.width, zIndex: 9999 })
    }
    setOpen(v => !v)
  }

  const selected = options.find(o => o.value === value)
  const displayLabel = selected?.label ?? placeholder ?? '선택'

  return (
    <div ref={ref} className={`${styles.customSelectWrap} ${fullWidth ? styles.customSelectFull : ''}`} style={style}>
      <button ref={triggerRef} type="button" onClick={handleOpen} className={styles.customSelectTrigger}>
        <span className={value ? styles.customSelectValue : styles.customSelectPlaceholder}>{displayLabel}</span>
        <svg
          className={`${styles.customSelectCaret} ${open ? styles.customSelectCaretOpen : ''}`}
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
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

function LoadingState() {
  return <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--toss-text-secondary)', fontSize: 14 }}>데이터를 불러오는 중...</div>
}

function ErrorState({ message }: { message: string }) {
  return <div style={{ padding: '40px 24px', textAlign: 'center', color: '#DC2626', fontSize: 14 }}>{message}</div>
}

function EmptyState() {
  return <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--toss-text-secondary)', fontSize: 14 }}>조건에 맞는 데이터가 없습니다.</div>
}

function InfoRow({ label, value }: { label: string; value: string | number | boolean | string[] | null | undefined }) {
  let displayValue: string
  if (value === null || value === undefined || value === '') displayValue = '-'
  else if (typeof value === 'boolean') displayValue = value ? '예' : '아니오'
  else if (Array.isArray(value)) displayValue = value.join(', ') || '-'
  else displayValue = String(value)
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoRowLabel}>{label}</span>
      <span className={styles.infoRowValue}>{displayValue}</span>
    </div>
  )
}

// ─── 상담신청 상세 모달 ──────────────────────────────────────────────────────

function ConsultationDetailModal({ item, onClose, onUpdate }: {
  item: PracticeConsultation
  onClose: () => void
  onUpdate: (id: number, fields: Partial<PracticeConsultation>) => Promise<void>
}) {
  const [activeTab, setActiveTab] = useState<'basic' | 'detail' | 'memo'>('basic')
  const [editStatus, setEditStatus] = useState<ConsultationStatus>(item.status)
  const [editManager, setEditManager] = useState(item.manager ?? '')
  const [editMemo, setEditMemo] = useState(item.memo ?? '')
  const [editNotes, setEditNotes] = useState(item.notes ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditStatus(item.status)
    setEditManager(item.manager ?? '')
    setEditMemo(item.memo ?? '')
    setEditNotes(item.notes ?? '')
    setActiveTab('basic')
  }, [item.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(item.id, { status: editStatus, manager: editManager, memo: editMemo, notes: editNotes })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.detailModalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.detailModal}>
        {/* 헤더 */}
        <div className={styles.detailModalHeader}>
          <div className={styles.detailModalHeaderTop}>
            <div className={styles.detailModalHeaderLeft}>
              <div>
                <div className={styles.detailModalNameRow}>
                  <p className={styles.detailModalName}>{item.name}</p>
                  <StatusBadge status={editStatus} styleMap={CONSULTATION_STATUS_STYLE} />
                </div>
                <p className={styles.detailModalSub}>{item.contact}</p>
                <p className={styles.detailModalSub}>등록일: {formatDateShort(item.created_at)}</p>
              </div>
            </div>
            <button onClick={onClose} className={styles.detailModalCloseBtn}>✕</button>
          </div>
          <div className={styles.detailModalTabs}>
            {(['basic', 'detail', 'memo'] as const).map(tab => {
              const labels = { basic: '기본정보', detail: '상세정보', memo: '메모' }
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`${styles.detailModalTab} ${activeTab === tab ? styles.detailModalTabActive : ''}`}
                >
                  {labels[tab]}
                </button>
              )
            })}
          </div>
        </div>

        {/* 바디 */}
        <div className={styles.detailModalBody}>
          {activeTab === 'basic' && (
            <>
              {/* 상태 */}
              <div className={styles.detailChipSection}>
                <span className={styles.detailChipSectionLabel}>상태</span>
                <div className={styles.detailChipRow}>
                  {CONSULTATION_STATUS_OPTIONS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditStatus(s)}
                      style={
                        editStatus === s
                          ? { padding: '5px 12px', borderRadius: 20, cursor: 'pointer', border: `2px solid ${CONSULTATION_STATUS_STYLE[s].color}`, background: CONSULTATION_STATUS_STYLE[s].background, color: CONSULTATION_STATUS_STYLE[s].color, fontSize: 13, fontWeight: 600, transition: 'all 0.15s' }
                          : { padding: '5px 12px', borderRadius: 20, cursor: 'pointer', border: '2px solid var(--toss-border)', background: 'transparent', color: 'var(--toss-text-secondary)', fontSize: 13, fontWeight: 600, transition: 'all 0.15s' }
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* 담당자 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>담당자</span>
                <input
                  value={editManager}
                  onChange={e => setEditManager(e.target.value)}
                  placeholder="담당자 이름"
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>

              {/* 기본 정보 */}
              <InfoRow label="유형" value={item.type ? CONSULTATION_TYPE_LABEL[item.type] : '-'} />
              <InfoRow label="학력" value={item.education} />
              <InfoRow label="희망과정" value={item.hope_course} />
              <InfoRow label="거주지" value={item.residence} />
              <InfoRow label="주소" value={item.address} />
              <InfoRow label="학습방법" value={item.study_method} />
              <InfoRow label="유입경로" value={item.click_source} />
            </>
          )}

          {activeTab === 'detail' && (
            <>
              <InfoRow label="진행상황" value={item.progress} />
              <InfoRow label="실습처" value={item.practice_place} />
              <InfoRow label="실습예정일" value={item.practice_planned_date} />
              <InfoRow label="취업희망시기" value={item.employment_hope_time} />
              <InfoRow label="고용지원금" value={item.employment_support_fund} />
              <InfoRow label="취업상담" value={item.employment_consulting} />
              <InfoRow label="취업연계" value={item.employment_connection} />
              <InfoRow label="자격취득후취업" value={item.employment_after_cert} />
              <InfoRow label="취득사유" value={item.reason} />
              <InfoRow label="과목비용" value={item.subject_cost !== null ? `${item.subject_cost?.toLocaleString()}원` : null} />
              <InfoRow label="학생상태" value={item.student_status} />
              <InfoRow label="실습서비스" value={item.service_practice} />
              <InfoRow label="취업서비스" value={item.service_employment} />
              <InfoRow label="완료여부" value={item.is_completed} />
              <InfoRow label="비고" value={item.notes} />
              <InfoRow label="등록일" value={formatDateTime(item.created_at)} />
              <InfoRow label="수정일" value={formatDateTime(item.updated_at)} />
            </>
          )}

          {activeTab === 'memo' && (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--toss-text-secondary)', display: 'block', marginBottom: 6 }}>메모</label>
                <textarea
                  value={editMemo}
                  onChange={e => setEditMemo(e.target.value)}
                  rows={6}
                  placeholder="메모를 입력하세요"
                  className={styles.textarea}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--toss-text-secondary)', display: 'block', marginBottom: 6 }}>비고</label>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={4}
                  placeholder="비고를 입력하세요"
                  className={styles.textarea}
                />
              </div>
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className={styles.detailModalFooter}>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`${styles.panelSaveBtn} ${saving ? styles.panelSaveBtnDisabled : ''}`}
          >
            {saving ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 실습섭외신청서 상세 모달 ────────────────────────────────────────────────

function PracticeApplicationDetailModal({ item, onClose, onUpdate }: {
  item: PracticeApplication
  onClose: () => void
  onUpdate: (id: string, fields: Partial<PracticeApplication>) => Promise<void>
}) {
  const [activeTab, setActiveTab] = useState<'basic' | 'detail'>('basic')
  const [editStatus, setEditStatus] = useState(item.status)
  const [editManager, setEditManager] = useState(item.manager ?? '')
  const [editPracticePlace, setEditPracticePlace] = useState(item.practice_place ?? '')
  const [editMemo, setEditMemo] = useState(item.memo ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditStatus(item.status)
    setEditManager(item.manager ?? '')
    setEditPracticePlace(item.practice_place ?? '')
    setEditMemo(item.memo ?? '')
    setActiveTab('basic')
  }, [item.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(item.id, { status: editStatus, manager: editManager, practice_place: editPracticePlace, memo: editMemo })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.detailModalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.detailModal}>
        {/* 헤더 */}
        <div className={styles.detailModalHeader}>
          <div className={styles.detailModalHeaderTop}>
            <div className={styles.detailModalHeaderLeft}>
              <div>
                <div className={styles.detailModalNameRow}>
                  <p className={styles.detailModalName}>{item.student_name}</p>
                  <span className={styles.statusBadge} style={{ background: '#DCFCE7', color: '#16A34A' }}>{item.status}</span>
                </div>
                <p className={styles.detailModalSub}>{item.contact}</p>
                <p className={styles.detailModalSub}>등록일: {formatDateShort(item.created_at)}</p>
              </div>
            </div>
            <button onClick={onClose} className={styles.detailModalCloseBtn}>✕</button>
          </div>
          <div className={styles.detailModalTabs}>
            {(['basic', 'detail'] as const).map(tab => {
              const labels = { basic: '기본정보', detail: '상세정보' }
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`${styles.detailModalTab} ${activeTab === tab ? styles.detailModalTabActive : ''}`}
                >
                  {labels[tab]}
                </button>
              )
            })}
          </div>
        </div>

        {/* 바디 */}
        <div className={styles.detailModalBody}>
          {activeTab === 'basic' && (
            <>
              {/* 상태 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>상태</span>
                <input
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>

              {/* 담당자 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>담당자</span>
                <input
                  value={editManager}
                  onChange={e => setEditManager(e.target.value)}
                  placeholder="담당자 이름"
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>

              {/* 실습처 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>실습처</span>
                <input
                  value={editPracticePlace}
                  onChange={e => setEditPracticePlace(e.target.value)}
                  placeholder="실습처 이름"
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>

              {/* 메모 */}
              <div className={styles.detailFieldRow} style={{ alignItems: 'flex-start' }}>
                <span className={styles.detailFieldLabel} style={{ paddingTop: 6 }}>메모</span>
                <textarea
                  value={editMemo}
                  onChange={e => setEditMemo(e.target.value)}
                  rows={4}
                  placeholder="메모를 입력하세요"
                  className={styles.textarea}
                  style={{ flex: 1 }}
                />
              </div>

              <InfoRow label="성별" value={item.gender} />
              <InfoRow label="생년월일" value={item.birth_date} />
              <InfoRow label="거주지역" value={item.residence_area} />
              <InfoRow label="주소" value={item.address} />
            </>
          )}

          {activeTab === 'detail' && (
            <>
              <InfoRow label="실습유형" value={item.practice_type} />
              <InfoRow label="실습시작일" value={item.practice_start_date} />
              <InfoRow label="성적표발급일" value={item.grade_report_date} />
              <InfoRow label="희망학기" value={item.preferred_semester} />
              <InfoRow label="선호요일" value={item.preferred_days} />
              <InfoRow label="자차여부" value={item.has_car} />
              <InfoRow label="현금영수증" value={item.cash_receipt_number} />
              <InfoRow label="유입경로" value={item.click_source} />
              <InfoRow label="개인정보동의" value={item.privacy_agreed} />
              <InfoRow label="등록일" value={formatDateTime(item.created_at)} />
              <InfoRow label="수정일" value={formatDateTime(item.updated_at)} />
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className={styles.detailModalFooter}>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`${styles.panelSaveBtn} ${saving ? styles.panelSaveBtnDisabled : ''}`}
          >
            {saving ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 취업신청 상세 모달 ──────────────────────────────────────────────────────

function EmploymentDetailModal({ item, onClose, onUpdate }: {
  item: EmploymentApplication
  onClose: () => void
  onUpdate: (id: string, fields: Partial<EmploymentApplication>) => Promise<void>
}) {
  const [activeTab, setActiveTab] = useState<'basic' | 'detail'>('basic')
  const [editStatus, setEditStatus] = useState(item.status)
  const [editManager, setEditManager] = useState(item.manager ?? '')
  const [editMemo, setEditMemo] = useState(item.memo ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditStatus(item.status)
    setEditManager(item.manager ?? '')
    setEditMemo(item.memo ?? '')
    setActiveTab('basic')
  }, [item.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(item.id, { status: editStatus, manager: editManager, memo: editMemo })
    } finally {
      setSaving(false)
    }
  }

  const payStyle = PAYMENT_STATUS_STYLE[item.payment_status] ?? PAYMENT_STATUS_STYLE.pending

  return (
    <div className={styles.detailModalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.detailModal}>
        {/* 헤더 */}
        <div className={styles.detailModalHeader}>
          <div className={styles.detailModalHeaderTop}>
            <div className={styles.detailModalHeaderLeft}>
              <div>
                <div className={styles.detailModalNameRow}>
                  <p className={styles.detailModalName}>{item.name}</p>
                  <span
                    className={styles.statusBadge}
                    style={{ background: payStyle.background, color: payStyle.color }}
                  >
                    {PAYMENT_STATUS_LABEL[item.payment_status] ?? item.payment_status}
                  </span>
                </div>
                <p className={styles.detailModalSub}>{item.contact}</p>
                <p className={styles.detailModalSub}>
                  등록일: {formatDateShort(item.created_at)}
                  {item.payment_amount ? ` · ${item.payment_amount.toLocaleString()}원` : ''}
                </p>
              </div>
            </div>
            <button onClick={onClose} className={styles.detailModalCloseBtn}>✕</button>
          </div>
          <div className={styles.detailModalTabs}>
            {(['basic', 'detail'] as const).map(tab => {
              const labels = { basic: '기본정보', detail: '상세정보' }
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`${styles.detailModalTab} ${activeTab === tab ? styles.detailModalTabActive : ''}`}
                >
                  {labels[tab]}
                </button>
              )
            })}
          </div>
        </div>

        {/* 바디 */}
        <div className={styles.detailModalBody}>
          {activeTab === 'basic' && (
            <>
              {/* 상태 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>상태</span>
                <input
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>

              {/* 담당자 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>담당자</span>
                <input
                  value={editManager}
                  onChange={e => setEditManager(e.target.value)}
                  placeholder="담당자 이름"
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>

              {/* 메모 */}
              <div className={styles.detailFieldRow} style={{ alignItems: 'flex-start' }}>
                <span className={styles.detailFieldLabel} style={{ paddingTop: 6 }}>메모</span>
                <textarea
                  value={editMemo}
                  onChange={e => setEditMemo(e.target.value)}
                  rows={4}
                  placeholder="메모를 입력하세요"
                  className={styles.textarea}
                  style={{ flex: 1 }}
                />
              </div>

              <InfoRow label="성별" value={item.gender} />
              <InfoRow label="생년월일" value={item.birth_date} />
              <InfoRow label="주소" value={item.address} />
              <InfoRow label="상세주소" value={item.address_detail} />
            </>
          )}

          {activeTab === 'detail' && (
            <>
              <InfoRow label="희망직무" value={item.desired_job_field} />
              <InfoRow label="취업유형" value={item.employment_types} />
              <InfoRow label="이력서보유" value={item.has_resume} />
              <InfoRow label="자격증" value={item.certifications} />
              <InfoRow label="유입경로" value={item.click_source} />
              <InfoRow label="개인정보동의" value={item.privacy_agreed} />
              <InfoRow label="이용약관동의" value={item.terms_agreed} />
              <InfoRow label="결제ID" value={item.payment_id} />
              <InfoRow label="등록일" value={formatDateTime(item.created_at)} />
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className={styles.detailModalFooter}>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`${styles.panelSaveBtn} ${saving ? styles.panelSaveBtnDisabled : ''}`}
          >
            {saving ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function PracticePage() {
  const [activeTab, setActiveTab] = useState<PracticeTab>('consultation')

  // 상담신청
  const [consultations, setConsultations] = useState<PracticeConsultation[]>([])
  const [consultationSearch, setConsultationSearch] = useState('')
  const [consultationStatusFilter, setConsultationStatusFilter] = useState<ConsultationStatus | ''>('')
  const [consultationTypeFilter, setConsultationTypeFilter] = useState<ConsultationType | ''>('')
  const [consultationPage, setConsultationPage] = useState(1)
  const [selectedConsultation, setSelectedConsultation] = useState<PracticeConsultation | null>(null)

  // 실습섭외신청서
  const [practiceApplications, setPracticeApplications] = useState<PracticeApplication[]>([])
  const [practiceSearch, setPracticeSearch] = useState('')
  const [practicePage, setPracticePage] = useState(1)
  const [selectedPracticeApp, setSelectedPracticeApp] = useState<PracticeApplication | null>(null)

  // 취업신청
  const [employmentApplications, setEmploymentApplications] = useState<EmploymentApplication[]>([])
  const [employmentSearch, setEmploymentSearch] = useState('')
  const [employmentPage, setEmploymentPage] = useState(1)
  const [selectedEmploymentApp, setSelectedEmploymentApp] = useState<EmploymentApplication | null>(null)

  // 공통
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ─── 데이터 페칭 ───────────────────────────────────────────────────────────

  const fetchConsultations = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (consultationSearch) params.set('search', consultationSearch)
      if (consultationStatusFilter) params.set('status', consultationStatusFilter)
      if (consultationTypeFilter) params.set('type', consultationTypeFilter)
      const res = await fetch(`/api/practice?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? '데이터를 불러오는데 실패했습니다.')
      }
      setConsultations(await res.json())
      setConsultationPage(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [consultationSearch, consultationStatusFilter, consultationTypeFilter])

  const fetchPracticeApplications = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (practiceSearch) params.set('search', practiceSearch)
      const res = await fetch(`/api/practice/applications?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? '데이터를 불러오는데 실패했습니다.')
      }
      setPracticeApplications(await res.json())
      setPracticePage(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [practiceSearch])

  const fetchEmploymentApplications = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (employmentSearch) params.set('search', employmentSearch)
      const res = await fetch(`/api/practice/employment?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? '데이터를 불러오는데 실패했습니다.')
      }
      setEmploymentApplications(await res.json())
      setEmploymentPage(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [employmentSearch])

  useEffect(() => {
    if (activeTab === 'consultation') fetchConsultations()
    else if (activeTab === 'practice') fetchPracticeApplications()
    else if (activeTab === 'employment') fetchEmploymentApplications()
  }, [activeTab, fetchConsultations, fetchPracticeApplications, fetchEmploymentApplications])

  // ─── 업데이트 핸들러 ───────────────────────────────────────────────────────

  async function handleConsultationUpdate(id: number, fields: Partial<PracticeConsultation>) {
    const res = await fetch('/api/practice', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    })
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error ?? '저장에 실패했습니다.'); return }
    const updated: PracticeConsultation = await res.json()
    setConsultations(prev => prev.map(item => item.id === updated.id ? updated : item))
    setSelectedConsultation(updated)
  }

  async function handlePracticeAppUpdate(id: string, fields: Partial<PracticeApplication>) {
    const res = await fetch('/api/practice/applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    })
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error ?? '저장에 실패했습니다.'); return }
    const updated: PracticeApplication = await res.json()
    setPracticeApplications(prev => prev.map(item => item.id === updated.id ? updated : item))
    setSelectedPracticeApp(updated)
  }

  async function handleEmploymentAppUpdate(id: string, fields: Partial<EmploymentApplication>) {
    const res = await fetch('/api/practice/employment', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    })
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error ?? '저장에 실패했습니다.'); return }
    const updated: EmploymentApplication = await res.json()
    setEmploymentApplications(prev => prev.map(item => item.id === updated.id ? updated : item))
    setSelectedEmploymentApp(updated)
  }

  // 인라인 상태 변경 (상담신청)
  async function handleConsultationStatusChange(id: number, status: ConsultationStatus) {
    const res = await fetch('/api/practice', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (!res.ok) return
    const updated: PracticeConsultation = await res.json()
    setConsultations(prev => prev.map(item => item.id === updated.id ? updated : item))
    if (selectedConsultation?.id === updated.id) setSelectedConsultation(updated)
  }

  // ─── 탭 전환 ───────────────────────────────────────────────────────────────

  function handleTabChange(tab: PracticeTab) {
    setActiveTab(tab)
    setSelectedConsultation(null)
    setSelectedPracticeApp(null)
    setSelectedEmploymentApp(null)
    setError('')
  }

  // ─── 통계 ──────────────────────────────────────────────────────────────────

  const consultationStats = {
    total: consultations.length,
    waiting: consultations.filter(i => i.status === '상담대기').length,
    practice: consultations.filter(i => i.service_practice).length,
    employment: consultations.filter(i => i.service_employment).length,
  }

  const practiceAppStats = {
    total: practiceApplications.length,
    completed: practiceApplications.filter(i => i.status === 'completed').length,
  }

  const employmentStats = {
    total: employmentApplications.length,
    paid: employmentApplications.filter(i => i.payment_status === 'paid').length,
    pending: employmentApplications.filter(i => i.payment_status === 'pending').length,
  }

  // ─── 페이징 ────────────────────────────────────────────────────────────────

  const consultationTotalPages = Math.ceil(consultations.length / PAGE_SIZE)
  const consultationPaged = consultations.slice((consultationPage - 1) * PAGE_SIZE, consultationPage * PAGE_SIZE)

  const practiceTotalPages = Math.ceil(practiceApplications.length / PAGE_SIZE)
  const practicePaged = practiceApplications.slice((practicePage - 1) * PAGE_SIZE, practicePage * PAGE_SIZE)

  const employmentTotalPages = Math.ceil(employmentApplications.length / PAGE_SIZE)
  const employmentPaged = employmentApplications.slice((employmentPage - 1) * PAGE_SIZE, employmentPage * PAGE_SIZE)

  // ─── 탭 설정 ───────────────────────────────────────────────────────────────

  const TABS: { value: PracticeTab; label: string }[] = [
    { value: 'consultation', label: '상담신청' },
    { value: 'practice', label: '실습섭외신청서' },
    { value: 'employment', label: '취업신청' },
  ]

  // ─── 페이지네이션 렌더러 ───────────────────────────────────────────────────

  function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
    if (totalPages <= 1) return null
    return (
      <div className={styles.pagination}>
        {getPaginationPages(page, totalPages).map((p, i) =>
          p === '...'
            ? <span key={`ellipsis-${i}`} className={styles.paginationEllipsis}>...</span>
            : (
              <button
                key={p}
                onClick={() => onChange(p as number)}
                className={`${styles.paginationBtn} ${page === p ? styles.paginationBtnActive : ''}`}
              >
                {p}
              </button>
            )
        )}
      </div>
    )
  }

  // ─── 렌더링 ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* 상세 모달 */}
      {selectedConsultation && (
        <ConsultationDetailModal
          item={selectedConsultation}
          onClose={() => setSelectedConsultation(null)}
          onUpdate={handleConsultationUpdate}
        />
      )}
      {selectedPracticeApp && (
        <PracticeApplicationDetailModal
          item={selectedPracticeApp}
          onClose={() => setSelectedPracticeApp(null)}
          onUpdate={handlePracticeAppUpdate}
        />
      )}
      {selectedEmploymentApp && (
        <EmploymentDetailModal
          item={selectedEmploymentApp}
          onClose={() => setSelectedEmploymentApp(null)}
          onUpdate={handleEmploymentAppUpdate}
        />
      )}

      {/* 페이지 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--toss-text-primary)', margin: 0 }}>실습/취업</h2>
        <p style={{ fontSize: 14, color: 'var(--toss-text-secondary)', margin: '4px 0 0' }}>
          실습 및 취업 관련 신청 내역을 관리합니다.
        </p>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--toss-border)', marginBottom: 20 }}>
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={`${styles.tabBtn} ${activeTab === tab.value ? styles.tabBtnActive : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== 상담신청 탭 ===== */}
      {activeTab === 'consultation' && (
        <>
          {/* 필터 */}
          <div className={styles.filterRow}>
            <input
              className={styles.input}
              type="text"
              value={consultationSearch}
              onChange={e => setConsultationSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') fetchConsultations() }}
              placeholder="이름 또는 연락처 검색"
              style={{ flex: '1 1 200px' }}
            />
            <CustomSelect
              value={consultationStatusFilter}
              onChange={v => setConsultationStatusFilter(v as ConsultationStatus | '')}
              options={[
                { value: '', label: '전체 상태' },
                ...CONSULTATION_STATUS_OPTIONS.map(s => ({ value: s, label: s })),
              ]}
              placeholder="전체 상태"
            />
            <CustomSelect
              value={consultationTypeFilter}
              onChange={v => setConsultationTypeFilter(v as ConsultationType | '')}
              options={[
                { value: '', label: '전체 유형' },
                { value: 'consultation', label: '상담' },
                { value: 'practice', label: '실습' },
                { value: 'employment', label: '취업' },
              ]}
              placeholder="전체 유형"
            />
            <button onClick={fetchConsultations} className={styles.btnPrimary}>검색</button>
          </div>

          {/* 테이블 */}
          <div className={styles.tableCard}>
            <div className={styles.tableOverflow}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {['이름', '연락처', '유형', '상태', '담당자', '유입경로', '등록일'].map(col => (
                      <th key={col} className={styles.th}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className={styles.td} colSpan={7}><LoadingState /></td></tr>
                  ) : error ? (
                    <tr><td className={styles.td} colSpan={7}><ErrorState message={error} /></td></tr>
                  ) : consultationPaged.length === 0 ? (
                    <tr><td className={styles.td} colSpan={7}><EmptyState /></td></tr>
                  ) : consultationPaged.map(item => (
                    <tr
                      key={item.id}
                      className={styles.tr}
                      onClick={() => setSelectedConsultation(item)}
                      style={{ background: selectedConsultation?.id === item.id ? 'var(--toss-blue-subtle)' : undefined }}
                    >
                      <td className={styles.td} style={{ fontWeight: 600 }}>
                        <Highlight text={item.name} query={consultationSearch} />
                      </td>
                      <td className={styles.td}>
                        <Highlight text={item.contact} query={consultationSearch} />
                      </td>
                      <td className={styles.td}>{item.type ? CONSULTATION_TYPE_LABEL[item.type] : '-'}</td>
                      <td className={styles.td} onClick={e => e.stopPropagation()}>
                        <StatusSelect
                          value={item.status}
                          onChange={v => handleConsultationStatusChange(item.id, v as ConsultationStatus)}
                          options={CONSULTATION_STATUS_OPTIONS}
                          styleMap={CONSULTATION_STATUS_STYLE}
                        />
                      </td>
                      <td className={styles.td}>{item.manager ?? '-'}</td>
                      <td className={styles.td}>{item.click_source ?? '-'}</td>
                      <td className={styles.td}>{formatDateShort(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && !error && consultations.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--toss-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--toss-text-secondary)' }}>총 {consultations.length.toLocaleString()}건</span>
                <Pagination page={consultationPage} totalPages={consultationTotalPages} onChange={setConsultationPage} />
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== 실습섭외신청서 탭 ===== */}
      {activeTab === 'practice' && (
        <>
          {/* 필터 */}
          <div className={styles.filterRow}>
            <input
              className={styles.input}
              type="text"
              value={practiceSearch}
              onChange={e => setPracticeSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') fetchPracticeApplications() }}
              placeholder="이름 또는 연락처 검색"
              style={{ flex: '1 1 200px' }}
            />
            <button onClick={fetchPracticeApplications} className={styles.btnPrimary}>검색</button>
          </div>

          {/* 테이블 */}
          <div className={styles.tableCard}>
            <div className={styles.tableOverflow}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {['이름', '연락처', '실습유형', '실습처', '실습시작일', '담당자', '상태', '등록일'].map(col => (
                      <th key={col} className={styles.th}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className={styles.td} colSpan={8}><LoadingState /></td></tr>
                  ) : error ? (
                    <tr><td className={styles.td} colSpan={8}><ErrorState message={error} /></td></tr>
                  ) : practicePaged.length === 0 ? (
                    <tr><td className={styles.td} colSpan={8}><EmptyState /></td></tr>
                  ) : practicePaged.map(item => (
                    <tr
                      key={item.id}
                      className={styles.tr}
                      onClick={() => setSelectedPracticeApp(item)}
                      style={{ background: selectedPracticeApp?.id === item.id ? 'var(--toss-blue-subtle)' : undefined }}
                    >
                      <td className={styles.td} style={{ fontWeight: 600 }}>
                        <Highlight text={item.student_name} query={practiceSearch} />
                      </td>
                      <td className={styles.td}>
                        <Highlight text={item.contact} query={practiceSearch} />
                      </td>
                      <td className={styles.td}>{item.practice_type ?? '-'}</td>
                      <td className={styles.td}>{item.practice_place ?? '-'}</td>
                      <td className={styles.td}>{item.practice_start_date ?? '-'}</td>
                      <td className={styles.td}>{item.manager ?? '-'}</td>
                      <td className={styles.td}>
                        <span className={styles.statusBadge} style={{ background: '#DCFCE7', color: '#16A34A' }}>
                          {item.status}
                        </span>
                      </td>
                      <td className={styles.td}>{formatDateShort(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && !error && practiceApplications.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--toss-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--toss-text-secondary)' }}>총 {practiceApplications.length.toLocaleString()}건</span>
                <Pagination page={practicePage} totalPages={practiceTotalPages} onChange={setPracticePage} />
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== 취업신청 탭 ===== */}
      {activeTab === 'employment' && (
        <>


          {/* 필터 */}
          <div className={styles.filterRow}>
            <input
              className={styles.input}
              type="text"
              value={employmentSearch}
              onChange={e => setEmploymentSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') fetchEmploymentApplications() }}
              placeholder="이름 또는 연락처 검색"
              style={{ flex: '1 1 200px' }}
            />
            <button onClick={fetchEmploymentApplications} className={styles.btnPrimary}>검색</button>
          </div>

          {/* 테이블 */}
          <div className={styles.tableCard}>
            <div className={styles.tableOverflow}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {['이름', '연락처', '희망직무', '결제금액', '결제상태', '담당자', '유입경로', '등록일'].map(col => (
                      <th key={col} className={styles.th}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className={styles.td} colSpan={8}><LoadingState /></td></tr>
                  ) : error ? (
                    <tr><td className={styles.td} colSpan={8}><ErrorState message={error} /></td></tr>
                  ) : employmentPaged.length === 0 ? (
                    <tr><td className={styles.td} colSpan={8}><EmptyState /></td></tr>
                  ) : employmentPaged.map(item => {
                    const payStyle = PAYMENT_STATUS_STYLE[item.payment_status] ?? PAYMENT_STATUS_STYLE.pending
                    return (
                      <tr
                        key={item.id}
                        className={styles.tr}
                        onClick={() => setSelectedEmploymentApp(item)}
                        style={{ background: selectedEmploymentApp?.id === item.id ? 'var(--toss-blue-subtle)' : undefined }}
                      >
                        <td className={styles.td} style={{ fontWeight: 600 }}>
                          <Highlight text={item.name} query={employmentSearch} />
                        </td>
                        <td className={styles.td}>
                          <Highlight text={item.contact} query={employmentSearch} />
                        </td>
                        <td className={styles.td}>{item.desired_job_field ?? '-'}</td>
                        <td className={styles.td} style={{ fontWeight: 500 }}>
                          {item.payment_amount ? `${item.payment_amount.toLocaleString()}원` : '-'}
                        </td>
                        <td className={styles.td}>
                          <span className={styles.statusBadge} style={{ background: payStyle.background, color: payStyle.color }}>
                            {PAYMENT_STATUS_LABEL[item.payment_status] ?? item.payment_status}
                          </span>
                        </td>
                        <td className={styles.td}>{item.manager ?? '-'}</td>
                        <td className={styles.td}>{item.click_source ?? '-'}</td>
                        <td className={styles.td}>{formatDateShort(item.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {!loading && !error && employmentApplications.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--toss-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--toss-text-secondary)' }}>총 {employmentApplications.length.toLocaleString()}건</span>
                <Pagination page={employmentPage} totalPages={employmentTotalPages} onChange={setEmploymentPage} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
