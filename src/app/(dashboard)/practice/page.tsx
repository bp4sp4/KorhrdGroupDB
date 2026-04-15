'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import styles from '../hakjeom/page.module.css'
import practiceStyles from './page.module.css'
import MemoTimeline from '@/components/ui/MemoTimeline'
import { TableSkeleton, FilterBarSkeleton } from '@/components/ui/Skeleton'
import { downloadExcel } from '@/lib/excelExport'

// ─── 탭 타입 ─────────────────────────────────────────────────────────────────

type PracticeTab = 'consultation' | 'practice' | 'employment'

// ─── 타입 정의 ────────────────────────────────────────────────────────────────

type ConsultationStatus = '상담대기' | '상담중' | '취업추진중' | '완료'
type PracticeAppStatus = '대기' | '진행중' | '완료'
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
  memo_count?: number
  latest_memo?: string | null
}

interface PracticeApplication {
  id: string
  name: string
  gender: string | null
  contact: string
  birth_date: string | null
  address: string | null
  address_detail: string | null
  zonecode: string | null
  practice_type: string | null
  desired_job_field: string | null
  employment_types: string[] | null
  has_resume: boolean
  certifications: string | null
  payment_amount: number | null
  payment_status: string | null
  payment_id: string | null
  privacy_agreed: boolean
  terms_agreed: boolean
  click_source: string | null
  status: string
  memo: string | null
  manager: string | null
  created_at: string
  updated_at: string
  memo_count?: number
  latest_memo?: string | null
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
  memo_count?: number
  latest_memo?: string | null
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

const CONSULTATION_STATUS_OPTIONS: ConsultationStatus[] = ['상담대기', '상담중', '취업추진중', '완료']
const PRACTICE_APP_STATUS_OPTIONS: PracticeAppStatus[] = ['대기', '진행중', '완료']
const EDUCATION_OPTIONS = ['고등학교 졸업', '전문대 졸업', '대학교 재학', '대학교 중퇴', '대학교 졸업', '대학원 이상']

const CONSULTATION_TYPE_LABEL: Record<ConsultationType, string> = {
  consultation: '상담',
  practice: '실습',
  employment: '취업',
}

const CONSULTATION_STATUS_STYLE: Record<ConsultationStatus, { background: string; color: string }> = {
  상담대기:   { background: '#EBF3FE', color: '#3182F6' },
  상담중:     { background: '#FFF8E6', color: '#D97706' },
  취업추진중: { background: '#F3E8FF', color: '#7C3AED' },
  완료:       { background: '#DCFCE7', color: '#16A34A' },
}

const PRACTICE_APP_STATUS_STYLE: Record<PracticeAppStatus, { background: string; color: string }> = {
  대기:   { background: '#EBF3FE', color: '#3182F6' },
  진행중: { background: '#FFF8E6', color: '#D97706' },
  완료:   { background: '#DCFCE7', color: '#16A34A' },
}

const APP_STATUS_LABEL: Record<string, string> = {
  pending: '대기중', confirmed: '확인됨', completed: '완료', cancelled: '취소', failed: '실패',
}

const APP_STATUS_STYLE: Record<string, { background: string; color: string }> = {
  pending:   { background: '#fef3c7', color: '#92400e' },
  confirmed: { background: '#d1fae5', color: '#065f46' },
  completed: { background: '#dbeafe', color: '#1d4ed8' },
  cancelled: { background: '#fee2e2', color: '#991b1b' },
  failed:    { background: '#fee2e2', color: '#991b1b' },
}

const PAYMENT_STATUS_STYLE: Record<string, { background: string; color: string }> = {
  paid:      { background: '#d1fae5', color: '#065f46' },
  pending:   { background: '#fef3c7', color: '#92400e' },
  requested: { background: '#fef9c3', color: '#854d0e' },
  failed:    { background: '#fee2e2', color: '#991b1b' },
  cancelled: { background: '#fee2e2', color: '#991b1b' },
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: '결제완료', pending: '결제대기', requested: '요청됨', failed: '결제실패', cancelled: '취소',
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
  // 하이픈 제거 후 매칭 (전화번호 등)
  const textClean = text.replace(/-/g, '')
  const queryClean = query.replace(/-/g, '')
  if (queryClean && textClean.toLowerCase().includes(queryClean.toLowerCase())) {
    const cleanIdx = textClean.toLowerCase().indexOf(queryClean.toLowerCase())
    let origStart = 0, cleanCount = 0
    for (let i = 0; i < text.length && cleanCount < cleanIdx; i++) {
      if (text[i] !== '-') cleanCount++
      origStart = i + 1
    }
    let origEnd = origStart, matched = 0
    for (let i = origStart; i < text.length && matched < queryClean.length; i++) {
      if (text[i] !== '-') matched++
      origEnd = i + 1
    }
    return (
      <>
        {text.slice(0, origStart)}
        <mark style={{ background: '#FFE500', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>{text.slice(origStart, origEnd)}</mark>
        {text.slice(origEnd)}
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

// ─── 상담신청 추가 모달 ──────────────────────────────────────────────────────

function AddConsultationModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [serviceType, setServiceType] = useState<'' | 'practice' | 'employment' | 'both'>('')
  const [employmentHopeTime, setEmploymentHopeTime] = useState<'' | '바로 취업' | '3개월 준비' | '6개월 준비'>('')
  const [employmentSupportFund, setEmploymentSupportFund] = useState<'' | 'true' | 'false'>('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = '이름을 입력해주세요'
    if (!contact.trim()) e.contact = '연락처를 입력해주세요'
    if (!serviceType) e.serviceType = '희망 신청 서비스를 선택해주세요'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        contact: contact.trim(),
        service_practice: serviceType === 'practice' || serviceType === 'both',
        service_employment: serviceType === 'employment' || serviceType === 'both',
      }
      if (employmentHopeTime) body.employment_hope_time = employmentHopeTime
      if (employmentSupportFund) body.employment_support_fund = employmentSupportFund === 'true'
      const res = await fetch('/api/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      onSaved()
      onClose()
    } catch {
      alert('추가에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={e => e.stopPropagation()} style={{ maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 className={practiceStyles.addModalTitle}>상담 신청</h3>
          <button onClick={onClose} className={practiceStyles.addModalCloseBtn}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className={practiceStyles.addModalFieldLabel}>이름<span className={practiceStyles.addModalRequired}>*</span></label>
            <input className={styles.inputFull} value={name} onChange={e => setName(e.target.value)} placeholder="이름을 입력해주세요" />
            {errors.name && <span className={practiceStyles.addModalFieldError}>{errors.name}</span>}
          </div>

          <div>
            <label className={practiceStyles.addModalFieldLabel}>연락처<span className={practiceStyles.addModalRequired}>*</span></label>
            <input className={styles.inputFull} value={contact} onChange={e => setContact(e.target.value)} placeholder="010-0000-0000" />
            {errors.contact && <span className={practiceStyles.addModalFieldError}>{errors.contact}</span>}
          </div>

          <div>
            <label className={practiceStyles.addModalFieldLabel}>희망 신청 서비스<span className={practiceStyles.addModalRequired}>*</span></label>
            <CustomSelect
              value={serviceType}
              onChange={v => setServiceType(v as typeof serviceType)}
              options={[
                { value: 'practice', label: '실습' },
                { value: 'employment', label: '취업' },
                { value: 'both', label: '실습 + 취업' },
              ]}
              placeholder="선택해주세요"
              fullWidth
            />
            {errors.serviceType && <span className={practiceStyles.addModalFieldError}>{errors.serviceType}</span>}
          </div>

          <div>
            <label className={practiceStyles.addModalFieldLabel}>취업 희망 시기</label>
            <CustomSelect
              value={employmentHopeTime}
              onChange={v => setEmploymentHopeTime(v as typeof employmentHopeTime)}
              options={[
                { value: '바로 취업', label: '바로 취업' },
                { value: '3개월 준비', label: '3개월 준비' },
                { value: '6개월 준비', label: '6개월 준비' },
              ]}
              placeholder="선택해주세요"
              fullWidth
            />
          </div>

          <div>
            <label className={practiceStyles.addModalFieldLabel}>취업지원금 희망여부</label>
            <CustomSelect
              value={employmentSupportFund}
              onChange={v => setEmploymentSupportFund(v as typeof employmentSupportFund)}
              options={[
                { value: 'true', label: '희망함' },
                { value: 'false', label: '희망하지 않음' },
              ]}
              placeholder="선택해주세요"
              fullWidth
            />
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className={styles.btnSecondary}>취소</button>
          <button onClick={handleSubmit} disabled={saving} className={styles.btnPrimary}>{saving ? '저장 중...' : '추가'}</button>
        </div>
      </div>
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
  const [memoCount, setMemoCount] = useState<number | null>(null)
  const [editStatus, setEditStatus] = useState<ConsultationStatus>(item.status)
  const [editManager, setEditManager] = useState(item.manager ?? '')
  const [editMemo, setEditMemo] = useState(item.memo ?? '')
  const [editNotes, setEditNotes] = useState(item.notes ?? '')
  const [editType, setEditType] = useState<ConsultationType | null>(item.type)
  const [editEducation, setEditEducation] = useState(item.education ?? '')
  const [editHopeCourse, setEditHopeCourse] = useState(item.hope_course ?? '')
  const [editResidence, setEditResidence] = useState(item.residence ?? '')
  const [editAddress, setEditAddress] = useState(item.address ?? '')
  const [editStudyMethod, setEditStudyMethod] = useState(item.study_method ?? '')
  const [editServicePractice, setEditServicePractice] = useState(item.service_practice ?? false)
  const [editServiceEmployment, setEditServiceEmployment] = useState(item.service_employment ?? false)
  const [editEmploymentHopeTime, setEditEmploymentHopeTime] = useState(item.employment_hope_time ?? '')
  const [editEmploymentSupportFund, setEditEmploymentSupportFund] = useState<boolean | null>(item.employment_support_fund ?? null)
  const [editName, setEditName] = useState(item.name ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditStatus(item.status)
    setEditManager(item.manager ?? '')
    setEditMemo(item.memo ?? '')
    setEditNotes(item.notes ?? '')
    setEditType(item.type)
    setEditEducation(item.education ?? '')
    setEditHopeCourse(item.hope_course ?? '')
    setEditResidence(item.residence ?? '')
    setEditAddress(item.address ?? '')
    setEditStudyMethod(item.study_method ?? '')
    setEditServicePractice(item.service_practice ?? false)
    setEditServiceEmployment(item.service_employment ?? false)
    setEditEmploymentHopeTime(item.employment_hope_time ?? '')
    setEditEmploymentSupportFund(item.employment_support_fund ?? null)
    setEditName(item.name ?? '')
    setActiveTab('basic')
  }, [item.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(item.id, {
        status: editStatus,
        manager: editManager,
        memo: editMemo,
        notes: editNotes,
        type: editType,
        education: editEducation || null,
        hope_course: editHopeCourse || null,
        residence: editResidence || null,
        address: editAddress || null,
        study_method: editStudyMethod || null,
        service_practice: editServicePractice,
        service_employment: editServiceEmployment,
        employment_hope_time: editEmploymentHopeTime || null,
        employment_support_fund: editEmploymentSupportFund,
        name: editName.trim() || item.name,
      })
      onClose()
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
                  {tab === 'memo' && memoCount != null && memoCount > 0
                    ? `메모 (${memoCount})`
                    : labels[tab]}
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
                      className={practiceStyles.chipBtn}
                      style={editStatus === s ? {
                        border: `2px solid ${CONSULTATION_STATUS_STYLE[s].color}`,
                        background: CONSULTATION_STATUS_STYLE[s].background,
                        color: CONSULTATION_STATUS_STYLE[s].color,
                      } : undefined}
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

              {/* 유형 */}
              <div className={styles.detailChipSection}>
                <span className={styles.detailChipSectionLabel}>유형</span>
                <div className={styles.detailChipRow}>
                  {(['practice', 'employment', 'consultation'] as ConsultationType[]).map(t => (
                    <button key={t} type="button" onClick={() => setEditType(t)}
                      className={practiceStyles.chipBtn}
                      style={editType === t ? { border: `2px solid ${CONSULTATION_STATUS_STYLE['상담대기'].color}`, background: CONSULTATION_STATUS_STYLE['상담대기'].background, color: CONSULTATION_STATUS_STYLE['상담대기'].color } : undefined}
                    >{CONSULTATION_TYPE_LABEL[t]}</button>
                  ))}
                </div>
              </div>

              {/* 최종학력 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>최종학력</span>
                <CustomSelect
                  value={editEducation}
                  onChange={setEditEducation}
                  fullWidth
                  options={[
                    { value: '', label: '선택 안 함' },
                    ...EDUCATION_OPTIONS.map(o => ({ value: o, label: o })),
                  ]}
                />
              </div>

              {/* 희망과정 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>희망과정</span>
                <input value={editHopeCourse} onChange={e => setEditHopeCourse(e.target.value)} placeholder="희망 과정 입력" className={`${styles.input} ${styles.inputFull}`} />
              </div>

              {/* 거주지 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>거주지</span>
                <input value={editResidence} onChange={e => setEditResidence(e.target.value)} placeholder="예) 서울 강남구" className={`${styles.input} ${styles.inputFull}`} />
              </div>

              {/* 주소 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>주소</span>
                <input value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="상세 주소 입력" className={`${styles.input} ${styles.inputFull}`} />
              </div>

              {/* 이름 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>이름</span>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="이름" className={`${styles.input} ${styles.inputFull}`} />
              </div>

              {/* 유입경로 (읽기 전용) */}
              <InfoRow label="유입경로" value={item.click_source} />
            </>
          )}

          {activeTab === 'detail' && (
            <>
              {/* 실습서비스 */}
              <div className={styles.detailChipSection}>
                <span className={styles.detailChipSectionLabel}>실습서비스</span>
                <div className={styles.detailChipRow}>
                  {[true, false].map(v => (
                    <button key={String(v)} type="button" onClick={() => setEditServicePractice(v)}
                      className={`${practiceStyles.chipBtn} ${editServicePractice === v ? (v ? practiceStyles.chipBtnTrue : practiceStyles.chipBtnFalse) : ''}`}
                    >{v ? '예' : '아니오'}</button>
                  ))}
                </div>
              </div>

              {/* 취업서비스 */}
              <div className={styles.detailChipSection}>
                <span className={styles.detailChipSectionLabel}>취업서비스</span>
                <div className={styles.detailChipRow}>
                  {[true, false].map(v => (
                    <button key={String(v)} type="button" onClick={() => setEditServiceEmployment(v)}
                      className={`${practiceStyles.chipBtn} ${editServiceEmployment === v ? (v ? practiceStyles.chipBtnTrue : practiceStyles.chipBtnFalse) : ''}`}
                    >{v ? '예' : '아니오'}</button>
                  ))}
                </div>
              </div>

              {/* 취업희망시기 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>취업희망시기</span>
                <input
                  value={editEmploymentHopeTime}
                  onChange={e => setEditEmploymentHopeTime(e.target.value)}
                  placeholder="예) 바로 취업, 6개월 후"
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>

              {/* 고용지원금 */}
              <div className={styles.detailChipSection}>
                <span className={styles.detailChipSectionLabel}>고용지원금</span>
                <div className={styles.detailChipRow}>
                  {([true, false, null] as (boolean | null)[]).map(v => (
                    <button key={String(v)} type="button" onClick={() => setEditEmploymentSupportFund(v)}
                      className={`${practiceStyles.chipBtn} ${editEmploymentSupportFund === v ? (v === true ? practiceStyles.chipBtnTrue : v === false ? practiceStyles.chipBtnFalse : practiceStyles.chipBtnNull) : ''}`}
                    >{v === true ? '희망' : v === false ? '미희망' : '미입력'}</button>
                  ))}
                </div>
              </div>

              {/* 비고 */}
              <div className={styles.detailFieldRow} style={{ alignItems: 'flex-start' }}>
                <span className={styles.detailFieldLabel} style={{ paddingTop: 6 }}>비고</span>
                <textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  rows={4}
                  placeholder="비고를 입력하세요"
                  className={styles.textarea}
                  style={{ flex: 1 }}
                />
              </div>

              <InfoRow label="등록일" value={formatDateTime(item.created_at)} />
              <InfoRow label="수정일" value={formatDateTime(item.updated_at)} />
            </>
          )}

          {activeTab === 'memo' && (
            <MemoTimeline
              tableName="practice_consultations"
              recordId={String(item.id)}
              legacyMemo={item.memo}
              onCountChange={setMemoCount}
            />
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
  const [activeTab, setActiveTab] = useState<'basic' | 'detail' | 'memo'>('basic')
  const [memoCount, setMemoCount] = useState<number | null>(null)
  const [editStatus, setEditStatus] = useState(item.status)
  const [editManager, setEditManager] = useState(item.manager ?? '')
  const [editMemo, setEditMemo] = useState(item.memo ?? '')
  const [editPracticeType, setEditPracticeType] = useState(item.practice_type ?? '')
  const [editDesiredJobField, setEditDesiredJobField] = useState(item.desired_job_field ?? '')
  const [editCertifications, setEditCertifications] = useState(item.certifications ?? '')
  const [editPaymentAmount, setEditPaymentAmount] = useState(item.payment_amount != null ? String(item.payment_amount) : '')
  const [editPaymentStatus, setEditPaymentStatus] = useState(item.payment_status ?? '')
  const [editClickSource, setEditClickSource] = useState(item.click_source ?? '')
  const [editName, setEditName] = useState(item.name ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setEditStatus(item.status)
    setEditManager(item.manager ?? '')
    setEditMemo(item.memo ?? '')
    setEditPracticeType(item.practice_type ?? '')
    setEditDesiredJobField(item.desired_job_field ?? '')
    setEditCertifications(item.certifications ?? '')
    setEditPaymentAmount(item.payment_amount != null ? String(item.payment_amount) : '')
    setEditPaymentStatus(item.payment_status ?? '')
    setEditClickSource(item.click_source ?? '')
    setEditName(item.name ?? '')
    setActiveTab('basic')
  }, [item.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(item.id, {
        name: editName.trim() || item.name,
        status: editStatus, manager: editManager, memo: editMemo,
        practice_type: editPracticeType || null,
        desired_job_field: editDesiredJobField || null,
        certifications: editCertifications || null,
        payment_amount: editPaymentAmount ? Number(editPaymentAmount) : null,
        payment_status: editPaymentStatus || null,
        click_source: editClickSource || null,
      })
      onClose()
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
                  <span className={styles.statusBadge} style={{ background: (APP_STATUS_STYLE[item.status] ?? APP_STATUS_STYLE.pending).background, color: (APP_STATUS_STYLE[item.status] ?? APP_STATUS_STYLE.pending).color }}>
                    {APP_STATUS_LABEL[item.status] ?? item.status}
                  </span>
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
                  {tab === 'memo' && memoCount != null && memoCount > 0
                    ? `메모 (${memoCount})`
                    : labels[tab]}
                </button>
              )
            })}
          </div>
        </div>

        {/* 바디 */}
        <div className={styles.detailModalBody}>
          {activeTab === 'basic' && (
            <>
              {/* 담당자 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>담당자</span>
                <input value={editManager} onChange={e => setEditManager(e.target.value)} placeholder="담당자 이름" className={`${styles.input} ${styles.inputFull}`} />
              </div>

              {/* 이름 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>이름</span>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="이름" className={`${styles.input} ${styles.inputFull}`} />
              </div>

              <InfoRow label="성별" value={item.gender} />
              <InfoRow label="생년월일" value={item.birth_date} />
              <InfoRow label="주소" value={item.address} />
              <InfoRow label="상세주소" value={item.address_detail} />
            </>
          )}

          {activeTab === 'detail' && (
            <>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>실습유형</span>
                <input value={editPracticeType} onChange={e => setEditPracticeType(e.target.value)} placeholder="실습유형 입력" className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>희망직무</span>
                <input value={editDesiredJobField} onChange={e => setEditDesiredJobField(e.target.value)} placeholder="희망직무 입력" className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <InfoRow label="고용형태" value={item.employment_types?.join(', ')} />
              <InfoRow label="이력서" value={item.has_resume ? '있음' : '없음'} />
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>자격증</span>
                <input value={editCertifications} onChange={e => setEditCertifications(e.target.value)} placeholder="자격증 입력" className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>결제금액</span>
                <input type="number" value={editPaymentAmount} onChange={e => setEditPaymentAmount(e.target.value)} placeholder="금액 입력" className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>결제상태</span>
                <CustomSelect
                  value={editPaymentStatus}
                  onChange={v => setEditPaymentStatus(v)}
                  options={[
                    { value: '', label: '미선택' },
                    { value: 'pending', label: '결제대기' },
                    { value: 'requested', label: '요청됨' },
                    { value: 'paid', label: '결제완료' },
                    { value: 'failed', label: '결제실패' },
                    { value: 'cancelled', label: '취소' },
                  ]}
                  fullWidth
                />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>유입경로</span>
                <input value={editClickSource} onChange={e => setEditClickSource(e.target.value)} placeholder="유입경로 입력" className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <InfoRow label="개인정보동의" value={item.privacy_agreed ? '동의' : '미동의'} />
              <InfoRow label="등록일" value={formatDateTime(item.created_at)} />
              <InfoRow label="수정일" value={formatDateTime(item.updated_at)} />
            </>
          )}

          {activeTab === 'memo' && (
            <MemoTimeline
              tableName="practice_applications"
              recordId={String(item.id)}
              legacyMemo={item.memo}
              onCountChange={setMemoCount}
            />
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

const EMPLOYMENT_TYPE_OPTIONS = ['정규직', '계약직', '파트타임', '부업']
const PRACTICE_TYPE_OPTIONS = [
  '사회복지사 실습 160시간',
  '사회복지사 실습 120시간',
  '보육교사 실습 240시간',
  '평생교육사 실습 160시간',
]

function EmploymentDetailModal({ item, onClose, onUpdate }: {
  item: EmploymentApplication
  onClose: () => void
  onUpdate: (id: string, fields: Partial<EmploymentApplication>) => Promise<void>
}) {
  const [activeTab, setActiveTab] = useState<'basic' | 'detail' | 'memo'>('basic')
  const [memoCount, setMemoCount] = useState<number | null>(null)
  const [form, setForm] = useState({
    name: item.name ?? '',
    gender: item.gender ?? '',
    contact: item.contact ?? '',
    birth_date: item.birth_date ?? '',
    address: item.address ?? '',
    address_detail: item.address_detail ?? '',
    status: item.status ?? '',
    manager: item.manager ?? '',
    memo: item.memo ?? '',
    desired_job_field: item.desired_job_field ?? '',
    employment_types: item.employment_types ?? [],
    has_resume: item.has_resume,
    certifications: item.certifications ?? '',
    click_source: item.click_source ?? '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm({
      name: item.name ?? '',
      gender: item.gender ?? '',
      contact: item.contact ?? '',
      birth_date: item.birth_date ?? '',
      address: item.address ?? '',
      address_detail: item.address_detail ?? '',
      status: item.status ?? '',
      manager: item.manager ?? '',
      memo: item.memo ?? '',
      desired_job_field: item.desired_job_field ?? '',
      employment_types: item.employment_types ?? [],
      has_resume: item.has_resume,
      certifications: item.certifications ?? '',
      click_source: item.click_source ?? '',
    })
    setActiveTab('basic')
  }, [item.id])

  const set = (field: string, value: unknown) => setForm(prev => ({ ...prev, [field]: value }))

  const toggleEmploymentType = (type: string) => {
    setForm(prev => ({
      ...prev,
      employment_types: prev.employment_types.includes(type)
        ? prev.employment_types.filter(t => t !== type)
        : [...prev.employment_types, type],
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(item.id, {
        ...form,
        has_resume: form.has_resume,
      })
      onClose()
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
                  <span className={styles.statusBadge} style={{ background: payStyle.background, color: payStyle.color }}>
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
            {(['basic', 'detail', 'memo'] as const).map(tab => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                className={`${styles.detailModalTab} ${activeTab === tab ? styles.detailModalTabActive : ''}`}>
                {tab === 'memo' && memoCount != null && memoCount > 0
                  ? `메모 (${memoCount})`
                  : { basic: '기본정보', detail: '상세정보', memo: '메모' }[tab]}
              </button>
            ))}
          </div>
        </div>

        {/* 바디 */}
        <div className={styles.detailModalBody}>
          {activeTab === 'basic' && (
            <>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>이름</span>
                <input value={form.name} onChange={e => set('name', e.target.value)} className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>성별</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {['여', '남'].map(g => (
                    <label key={g} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 14 }}>
                      <input type="radio" name="gender" value={g} checked={form.gender === g} onChange={() => set('gender', g)} /> {g}
                    </label>
                  ))}
                </div>
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>연락처</span>
                <input value={form.contact} onChange={e => set('contact', e.target.value)} className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>생년월일</span>
                <input value={form.birth_date} onChange={e => set('birth_date', e.target.value)} placeholder="YYMMDD" className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>주소</span>
                <input value={form.address} onChange={e => set('address', e.target.value)} className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>상세주소</span>
                <input value={form.address_detail} onChange={e => set('address_detail', e.target.value)} className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>상태</span>
                <input value={form.status} onChange={e => set('status', e.target.value)} className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>담당자</span>
                <input value={form.manager} onChange={e => set('manager', e.target.value)} placeholder="담당자 이름" className={`${styles.input} ${styles.inputFull}`} />
              </div>
            </>
          )}

          {activeTab === 'detail' && (
            <>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>취업 희망분야</span>
                <input value={form.desired_job_field} onChange={e => set('desired_job_field', e.target.value)} placeholder="ex. 노인복지" className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <div className={styles.detailFieldRow} style={{ alignItems: 'flex-start' }}>
                <span className={styles.detailFieldLabel} style={{ paddingTop: 4 }}>고용형태</span>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {EMPLOYMENT_TYPE_OPTIONS.map(type => (
                    <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 14 }}>
                      <input type="checkbox" checked={form.employment_types.includes(type)} onChange={() => toggleEmploymentType(type)} /> {type}
                    </label>
                  ))}
                </div>
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>이력서 보유</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {[{ label: '보유함', value: true }, { label: '보유하지 않음', value: false }].map(opt => (
                    <label key={String(opt.value)} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 14 }}>
                      <input type="radio" name="has_resume" checked={form.has_resume === opt.value} onChange={() => set('has_resume', opt.value)} /> {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>자격증</span>
                <input value={form.certifications} onChange={e => set('certifications', e.target.value)} placeholder="보유 자격증을 입력하세요" className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>유입경로</span>
                <input value={form.click_source} onChange={e => set('click_source', e.target.value)} className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <InfoRow label="결제ID" value={item.payment_id} />
              <InfoRow label="등록일" value={formatDateTime(item.created_at)} />
            </>
          )}

          {activeTab === 'memo' && (
            <MemoTimeline
              tableName="employment_applications"
              recordId={String(item.id)}
              legacyMemo={item.memo}
              onCountChange={setMemoCount}
            />
          )}
        </div>

        {/* 푸터 */}
        <div className={styles.detailModalFooter}>
          <button onClick={handleSave} disabled={saving} className={`${styles.panelSaveBtn} ${saving ? styles.panelSaveBtnDisabled : ''}`}>
            {saving ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 실습섭외신청 추가 모달 (토스 스타일) ─────────────────────────────────────

function PracticeAddModal({ onClose, onAdd }: {
  onClose: () => void
  onAdd: (fields: Partial<PracticeApplication>) => Promise<void>
}) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '', gender: '', contact: '', birth_date: '',
    address: '', address_detail: '',
    practice_type: '', desired_job_field: '',
    employment_types: [] as string[],
    has_resume: null as boolean | null,
    certifications: '', manager: '', memo: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (field: string, value: unknown) => setForm(prev => ({ ...prev, [field]: value }))
  const toggleType = (type: string) => setForm(prev => ({
    ...prev,
    employment_types: prev.employment_types.includes(type)
      ? prev.employment_types.filter(t => t !== type)
      : [...prev.employment_types, type],
  }))

  const handleNext = () => {
    if (!form.name || !form.contact) { alert('이름과 연락처는 필수입니다.'); return }
    setStep(2)
  }

  const handleSubmit = async () => {
    setSaving(true)
    try { await onAdd({ ...form, has_resume: form.has_resume ?? false }) } finally { setSaving(false) }
  }

  return (
    <div className={practiceStyles.empAddOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={practiceStyles.empAddModal}>
        <div className={practiceStyles.empAddHeader}>
          <div className={practiceStyles.empAddHeaderTop}>
            <div>
              <p className={practiceStyles.empAddTitle}>실습섭외 신청 추가</p>
              <p className={practiceStyles.empAddStep}>{step} / 2단계</p>
            </div>
            <button onClick={onClose} className={practiceStyles.empAddCloseBtn}>✕</button>
          </div>
          <div className={practiceStyles.empAddProgress}>
            {[1, 2].map(s => (
              <div key={s} className={`${practiceStyles.empAddProgressBar} ${s <= step ? practiceStyles.empAddProgressBarActive : ''}`} />
            ))}
          </div>
        </div>

        <div className={practiceStyles.empAddBody}>
          {step === 1 && (
            <>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>이름 <span className={practiceStyles.addModalRequired}>*</span></span>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="이름을 입력하세요" className={practiceStyles.empAddInput} />
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>성별</span>
                <div className={practiceStyles.empAddOptionRow}>
                  {[{ label: '여성', value: '여' }, { label: '남성', value: '남' }].map(g => (
                    <div key={g.value} className={`${practiceStyles.empAddOptionCard} ${form.gender === g.value ? practiceStyles.empAddOptionCardActive : ''}`} onClick={() => set('gender', g.value)}>
                      <div className={`${practiceStyles.empAddDot} ${form.gender === g.value ? practiceStyles.empAddDotActive : ''}`}>
                        {form.gender === g.value && <div className={practiceStyles.empAddDotInner} />}
                      </div>
                      {g.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>연락처 <span className={practiceStyles.addModalRequired}>*</span></span>
                <input value={form.contact} onChange={e => set('contact', e.target.value)} placeholder="연락처를 입력하세요" className={practiceStyles.empAddInput} />
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>생년월일</span>
                <input value={form.birth_date} onChange={e => set('birth_date', e.target.value)} placeholder="생년월일 6자리 (ex. 900101)" className={practiceStyles.empAddInput} />
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>주소</span>
                <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="주소를 입력하세요" className={practiceStyles.empAddInput} />
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>상세주소</span>
                <input value={form.address_detail} onChange={e => set('address_detail', e.target.value)} placeholder="상세주소" className={practiceStyles.empAddInput} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>실습 유형</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {PRACTICE_TYPE_OPTIONS.map(type => (
                    <div key={type} className={`${practiceStyles.empAddOptionCard} ${form.practice_type === type ? practiceStyles.empAddOptionCardActive : ''}`} onClick={() => set('practice_type', type)}>
                      <div className={`${practiceStyles.empAddDot} ${form.practice_type === type ? practiceStyles.empAddDotActive : ''}`}>
                        {form.practice_type === type && <div className={practiceStyles.empAddDotInner} />}
                      </div>
                      {type}
                    </div>
                  ))}
                </div>
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>취업 희망분야</span>
                <input value={form.desired_job_field} onChange={e => set('desired_job_field', e.target.value)} placeholder="ex. 노인복지" className={practiceStyles.empAddInput} />
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>고용형태</span>
                <div className={practiceStyles.empAddOptionGrid}>
                  {EMPLOYMENT_TYPE_OPTIONS.map(type => {
                    const active = form.employment_types.includes(type)
                    return (
                      <div key={type} className={`${practiceStyles.empAddOptionCard} ${active ? practiceStyles.empAddOptionCardActive : ''}`} onClick={() => toggleType(type)}>
                        <div className={`${practiceStyles.empAddCheckbox} ${active ? practiceStyles.empAddCheckboxActive : ''}`}>{active && '✓'}</div>
                        {type}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>자기소개서·이력서 보유 여부</span>
                <div className={practiceStyles.empAddOptionRow}>
                  {[{ label: '보유함', value: true }, { label: '보유하지 않음', value: false }].map(opt => (
                    <div key={String(opt.value)} className={`${practiceStyles.empAddOptionCard} ${form.has_resume === opt.value ? practiceStyles.empAddOptionCardActive : ''}`} onClick={() => set('has_resume', opt.value)}>
                      <div className={`${practiceStyles.empAddDot} ${form.has_resume === opt.value ? practiceStyles.empAddDotActive : ''}`}>
                        {form.has_resume === opt.value && <div className={practiceStyles.empAddDotInner} />}
                      </div>
                      {opt.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>보유 자격증</span>
                <input value={form.certifications} onChange={e => set('certifications', e.target.value)} placeholder="취득하신 자격증이 있다면 작성해주세요" className={practiceStyles.empAddInput} />
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>담당자</span>
                <input value={form.manager} onChange={e => set('manager', e.target.value)} placeholder="담당자 이름" className={practiceStyles.empAddInput} />
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>메모</span>
                <textarea value={form.memo} onChange={e => set('memo', e.target.value)} placeholder="메모를 입력하세요" className={practiceStyles.empAddTextarea} />
              </div>
            </>
          )}
        </div>

        <div className={practiceStyles.empAddFooter}>
          {step === 1 ? (
            <button onClick={handleNext} className={practiceStyles.empAddNextBtn}>다음</button>
          ) : (
            <>
              <button onClick={() => setStep(1)} className={practiceStyles.empAddBackBtn}>이전</button>
              <button onClick={handleSubmit} disabled={saving} className={practiceStyles.empAddNextBtn}>
                {saving ? '저장 중...' : '추가하기'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 취업신청 추가 모달 (토스 스타일) ────────────────────────────────────────

function EmploymentAddModal({ onClose, onAdd }: {
  onClose: () => void
  onAdd: (fields: Partial<EmploymentApplication>) => Promise<void>
}) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '', gender: '', contact: '', birth_date: '',
    address: '', address_detail: '',
    desired_job_field: '', employment_types: [] as string[],
    has_resume: null as boolean | null,
    certifications: '', manager: '', memo: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (field: string, value: unknown) => setForm(prev => ({ ...prev, [field]: value }))
  const toggleType = (type: string) => setForm(prev => ({
    ...prev,
    employment_types: prev.employment_types.includes(type)
      ? prev.employment_types.filter(t => t !== type)
      : [...prev.employment_types, type],
  }))

  const handleNext = () => {
    if (!form.name || !form.contact) { alert('이름과 연락처는 필수입니다.'); return }
    setStep(2)
  }

  const handleSubmit = async () => {
    setSaving(true)
    try { await onAdd(form) } finally { setSaving(false) }
  }

  return (
    <div className={practiceStyles.empAddOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={practiceStyles.empAddModal}>
        {/* 헤더 */}
        <div className={practiceStyles.empAddHeader}>
          <div className={practiceStyles.empAddHeaderTop}>
            <div>
              <p className={practiceStyles.empAddTitle}>취업신청 추가</p>
              <p className={practiceStyles.empAddStep}>{step} / 2단계</p>
            </div>
            <button onClick={onClose} className={practiceStyles.empAddCloseBtn}>✕</button>
          </div>
          <div className={practiceStyles.empAddProgress}>
            {[1, 2].map(s => (
              <div key={s} className={`${practiceStyles.empAddProgressBar} ${s <= step ? practiceStyles.empAddProgressBarActive : ''}`} />
            ))}
          </div>
        </div>

        {/* 바디 */}
        <div className={practiceStyles.empAddBody}>
          {step === 1 && (
            <>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>이름 <span className={practiceStyles.addModalRequired}>*</span></span>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="이름을 입력하세요" className={practiceStyles.empAddInput} />
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>성별</span>
                <div className={practiceStyles.empAddOptionRow}>
                  {[{ label: '여성', value: '여' }, { label: '남성', value: '남' }].map(g => (
                    <div key={g.value} className={`${practiceStyles.empAddOptionCard} ${form.gender === g.value ? practiceStyles.empAddOptionCardActive : ''}`} onClick={() => set('gender', g.value)}>
                      <div className={`${practiceStyles.empAddDot} ${form.gender === g.value ? practiceStyles.empAddDotActive : ''}`}>
                        {form.gender === g.value && <div className={practiceStyles.empAddDotInner} />}
                      </div>
                      {g.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>연락처 <span className={practiceStyles.addModalRequired}>*</span></span>
                <input value={form.contact} onChange={e => set('contact', e.target.value)} placeholder="연락처를 입력하세요" className={practiceStyles.empAddInput} />
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>생년월일</span>
                <input value={form.birth_date} onChange={e => set('birth_date', e.target.value)} placeholder="생년월일 6자리 (ex. 900101)" className={practiceStyles.empAddInput} />
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>주소</span>
                <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="주소를 입력하세요" className={practiceStyles.empAddInput} />
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>상세주소</span>
                <input value={form.address_detail} onChange={e => set('address_detail', e.target.value)} placeholder="상세주소" className={practiceStyles.empAddInput} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>취업 희망분야</span>
                <input value={form.desired_job_field} onChange={e => set('desired_job_field', e.target.value)} placeholder="ex. 노인복지" className={practiceStyles.empAddInput} />
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>고용형태</span>
                <div className={practiceStyles.empAddOptionGrid}>
                  {EMPLOYMENT_TYPE_OPTIONS.map(type => {
                    const active = form.employment_types.includes(type)
                    return (
                      <div key={type} className={`${practiceStyles.empAddOptionCard} ${active ? practiceStyles.empAddOptionCardActive : ''}`} onClick={() => toggleType(type)}>
                        <div className={`${practiceStyles.empAddCheckbox} ${active ? practiceStyles.empAddCheckboxActive : ''}`}>
                          {active && '✓'}
                        </div>
                        {type}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>자기소개서·이력서 보유 여부</span>
                <div className={practiceStyles.empAddOptionRow}>
                  {[{ label: '보유함', value: true }, { label: '보유하지 않음', value: false }].map(opt => (
                    <div key={String(opt.value)} className={`${practiceStyles.empAddOptionCard} ${form.has_resume === opt.value ? practiceStyles.empAddOptionCardActive : ''}`} onClick={() => set('has_resume', opt.value)}>
                      <div className={`${practiceStyles.empAddDot} ${form.has_resume === opt.value ? practiceStyles.empAddDotActive : ''}`}>
                        {form.has_resume === opt.value && <div className={practiceStyles.empAddDotInner} />}
                      </div>
                      {opt.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>보유 자격증</span>
                <input value={form.certifications} onChange={e => set('certifications', e.target.value)} placeholder="취득하신 자격증이 있다면 작성해주세요" className={practiceStyles.empAddInput} />
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>담당자</span>
                <input value={form.manager} onChange={e => set('manager', e.target.value)} placeholder="담당자 이름" className={practiceStyles.empAddInput} />
              </div>
              <div className={practiceStyles.empAddField}>
                <span className={practiceStyles.empAddFieldLabel}>메모</span>
                <textarea value={form.memo} onChange={e => set('memo', e.target.value)} placeholder="메모를 입력하세요" className={practiceStyles.empAddTextarea} />
              </div>
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className={practiceStyles.empAddFooter}>
          {step === 1 ? (
            <button onClick={handleNext} className={practiceStyles.empAddNextBtn}>다음</button>
          ) : (
            <>
              <button onClick={() => setStep(1)} className={practiceStyles.empAddBackBtn}>이전</button>
              <button onClick={handleSubmit} disabled={saving} className={practiceStyles.empAddNextBtn}>
                {saving ? '저장 중...' : '추가하기'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function PracticePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlHighlight = searchParams.get('highlight') ? Number(searchParams.get('highlight')) : undefined
  const urlTab = searchParams.get('tab') as PracticeTab | null

  const [activeTab, setActiveTab] = useState<PracticeTab>(
    urlTab && (['consultation', 'practice', 'employment'] as PracticeTab[]).includes(urlTab)
      ? urlTab
      : 'consultation'
  )

  useEffect(() => {
    const valid: PracticeTab[] = ['consultation', 'practice', 'employment']
    if (urlTab && valid.includes(urlTab)) setActiveTab(urlTab)
  }, [urlTab])

  // 상담신청
  const [consultations, setConsultations] = useState<PracticeConsultation[]>([])
  const [consultationSearch, setConsultationSearch] = useState('')
  const [consultationPage, setConsultationPage] = useState(1)
  // 컬럼 헤더 필터 (다중선택)
  const [consultNameFilter, setConsultNameFilter] = useState<string[]>([])
  const [consultServiceFilter, setConsultServiceFilter] = useState<string[]>([])
  const [consultHopeTimeFilter, setConsultHopeTimeFilter] = useState<string[]>([])
  const [consultManagerFilter, setConsultManagerFilter] = useState<string[]>([])
  const [consultStatusMultiFilter, setConsultStatusMultiFilter] = useState<string[]>([])
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [filterDropdownPos, setFilterDropdownPos] = useState({ top: 0, left: 0 })
  const [selectedConsultation, setSelectedConsultation] = useState<PracticeConsultation | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const [deleteToastVisible, setDeleteToastVisible] = useState(false)

  // 실습섭외신청서
  const [practiceApplications, setPracticeApplications] = useState<PracticeApplication[]>([])
  const [practiceSearch, setPracticeSearch] = useState('')
  const [practicePage, setPracticePage] = useState(1)
  const [selectedPracticeApp, setSelectedPracticeApp] = useState<PracticeApplication | null>(null)
  // 컬럼 헤더 필터 (다중선택)
  const [practiceNameFilter, setPracticeNameFilter] = useState<string[]>([])
  const [practiceContactFilter, setPracticeContactFilter] = useState<string[]>([])
  const [practiceTypeFilter, setPracticeTypeFilter] = useState<string[]>([])
  const [practiceJobFilter, setPracticeJobFilter] = useState<string[]>([])
  const [practicePayStatusFilter, setPracticePayStatusFilter] = useState<string[]>([])
  const [practiceStatusFilter, setPracticeStatusFilter] = useState<string[]>([])
  const [practiceManagerFilter, setPracticeManagerFilter] = useState<string[]>([])

  // 체크박스 선택
  const [selectedConsultationIds, setSelectedConsultationIds] = useState<Set<number>>(new Set())
  const [selectedPracticeAppIds, setSelectedPracticeAppIds] = useState<Set<string>>(new Set())
  const [showAddPracticeModal, setShowAddPracticeModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 취업신청
  const [employmentApplications, setEmploymentApplications] = useState<EmploymentApplication[]>([])
  const [employmentSearch, setEmploymentSearch] = useState('')
  const [employmentPage, setEmploymentPage] = useState(1)
  const [selectedEmploymentApp, setSelectedEmploymentApp] = useState<EmploymentApplication | null>(null)
  const [selectedEmploymentIds, setSelectedEmploymentIds] = useState<Set<string>>(new Set())
  const [showAddEmploymentModal, setShowAddEmploymentModal] = useState(false)
  // 컬럼 헤더 필터 (다중선택)
  const [empNameFilter, setEmpNameFilter] = useState<string[]>([])
  const [empContactFilter, setEmpContactFilter] = useState<string[]>([])
  const [empTypeFilter, setEmpTypeFilter] = useState<string[]>([])
  const [empPayStatusFilter, setEmpPayStatusFilter] = useState<string[]>([])
  const [empManagerFilter, setEmpManagerFilter] = useState<string[]>([])

  // 모달
  const [showAddConsultationModal, setShowAddConsultationModal] = useState(false)

  // 공통
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 검색에서 직접 이동 시 해당 행 하이라이트
  useEffect(() => {
    if (!urlHighlight || consultations.length === 0) return
    const idx = consultations.findIndex(c => c.id === urlHighlight)
    if (idx < 0) return
    setConsultationPage(Math.ceil((idx + 1) / PAGE_SIZE))
    setTimeout(() => {
      const el = document.querySelector(`tr[data-id="${urlHighlight}"]`) as HTMLElement | null
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.add(styles.highlightRow)
      setTimeout(() => el.classList.remove(styles.highlightRow), 2500)
    }, 150)
  }, [consultations, urlHighlight])

  // ─── 데이터 페칭 ───────────────────────────────────────────────────────────

  const fetchConsultations = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (consultationSearch) params.set('search', consultationSearch)
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
  }, [consultationSearch])

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

  useEffect(() => {
    setConsultationPage(1)
  }, [consultNameFilter, consultServiceFilter, consultHopeTimeFilter, consultManagerFilter, consultStatusMultiFilter])

  useEffect(() => {
    setPracticePage(1)
  }, [practiceNameFilter, practiceContactFilter, practiceTypeFilter, practiceJobFilter, practicePayStatusFilter, practiceStatusFilter, practiceManagerFilter])

  useEffect(() => {
    setEmploymentPage(1)
  }, [empNameFilter, empContactFilter, empTypeFilter, empPayStatusFilter, empManagerFilter])

  useEffect(() => {
    if (!openFilterColumn) return
    const handleMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenFilterColumn(null)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [openFilterColumn])

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
    setToastVisible(true); setTimeout(() => setToastVisible(false), 2500)
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
    setToastVisible(true); setTimeout(() => setToastVisible(false), 2500)
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
    setToastVisible(true); setTimeout(() => setToastVisible(false), 2500)
  }

  // 추가 (실습섭외신청)
  async function handlePracticeAdd(fields: Partial<PracticeApplication>) {
    const res = await fetch('/api/practice/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error ?? '등록에 실패했습니다.'); return }
    const created: PracticeApplication = await res.json()
    setPracticeApplications(prev => [created, ...prev])
    setShowAddPracticeModal(false)
  }

  // 삭제 (취업신청)
  async function handleDeleteEmploymentApps() {
    const ids = Array.from(selectedEmploymentIds)
    if (ids.length === 0) return
    if (!confirm(`${ids.length}건을 삭제할까요?`)) return
    setDeleting(true)
    const res = await fetch('/api/practice/employment', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setDeleting(false)
    if (!res.ok) { alert('삭제에 실패했습니다.'); return }
    setEmploymentApplications(prev => prev.filter(a => !selectedEmploymentIds.has(a.id)))
    setSelectedEmploymentIds(new Set())
    if (selectedEmploymentApp && selectedEmploymentIds.has(selectedEmploymentApp.id)) setSelectedEmploymentApp(null)
    setDeleteToastVisible(true)
    setTimeout(() => setDeleteToastVisible(false), 2500)
  }

  // 추가 (취업신청)
  async function handleEmploymentAdd(fields: Partial<EmploymentApplication>) {
    const res = await fetch('/api/practice/employment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error ?? '등록에 실패했습니다.'); return }
    const created: EmploymentApplication = await res.json()
    setEmploymentApplications(prev => [created, ...prev])
    setShowAddEmploymentModal(false)
  }

  // 삭제 (상담신청)
  async function handleDeleteConsultations() {
    const ids = Array.from(selectedConsultationIds)
    if (ids.length === 0) return
    if (!confirm(`${ids.length}건을 삭제할까요?`)) return
    setDeleting(true)
    const res = await fetch('/api/practice', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setDeleting(false)
    if (!res.ok) { alert('삭제에 실패했습니다.'); return }
    setConsultations(prev => prev.filter(c => !selectedConsultationIds.has(c.id)))
    setSelectedConsultationIds(new Set())
    if (selectedConsultation && selectedConsultationIds.has(selectedConsultation.id)) setSelectedConsultation(null)
    setDeleteToastVisible(true)
    setTimeout(() => setDeleteToastVisible(false), 2500)
  }

  // 삭제 (실습섭외신청서)
  async function handleDeletePracticeApps() {
    const ids = Array.from(selectedPracticeAppIds)
    if (ids.length === 0) return
    if (!confirm(`${ids.length}건을 삭제할까요?`)) return
    setDeleting(true)
    const res = await fetch('/api/practice/applications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setDeleting(false)
    if (!res.ok) { alert('삭제에 실패했습니다.'); return }
    setPracticeApplications(prev => prev.filter(a => !selectedPracticeAppIds.has(a.id)))
    setSelectedPracticeAppIds(new Set())
    if (selectedPracticeApp && selectedPracticeAppIds.has(selectedPracticeApp.id)) setSelectedPracticeApp(null)
    setDeleteToastVisible(true)
    setTimeout(() => setDeleteToastVisible(false), 2500)
  }

  // 인라인 상태 변경 (실습섭외신청서)
  async function handlePracticeAppStatusChange(id: string, status: string) {
    const res = await fetch('/api/practice/applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (!res.ok) return
    const updated: PracticeApplication = await res.json()
    setPracticeApplications(prev => prev.map(item => item.id === updated.id ? updated : item))
    if (selectedPracticeApp?.id === updated.id) setSelectedPracticeApp(updated)
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
    router.replace(`/practice?tab=${tab}`, { scroll: false })
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

  // ─── 클라이언트 필터 ────────────────────────────────────────────────────────

  const consultationNames = [...new Set(consultations.map(c => c.name).filter(Boolean))]
  const consultationManagers = [...new Set(consultations.map(c => c.manager).filter(Boolean) as string[])]

  const consultationFiltered = consultations.filter(item => {
    if (consultNameFilter.length > 0 && !consultNameFilter.includes(item.name)) return false
    if (consultServiceFilter.length > 0) {
      const svc = item.service_practice && item.service_employment ? '실습+취업'
        : item.service_practice ? '실습'
        : item.service_employment ? '취업'
        : ''
      if (!consultServiceFilter.includes(svc)) return false
    }
    if (consultHopeTimeFilter.length > 0 && !consultHopeTimeFilter.includes(item.employment_hope_time ?? '')) return false
    if (consultManagerFilter.length > 0 && !consultManagerFilter.includes(item.manager ?? '')) return false
    if (consultStatusMultiFilter.length > 0 && !consultStatusMultiFilter.includes(item.status)) return false
    return true
  })

  // ─── 페이징 ────────────────────────────────────────────────────────────────

  const consultationTotalPages = Math.ceil(consultationFiltered.length / PAGE_SIZE)
  const consultationPaged = consultationFiltered.slice((consultationPage - 1) * PAGE_SIZE, consultationPage * PAGE_SIZE)

  const practiceNames = [...new Set(practiceApplications.map(a => a.name).filter(Boolean))]
  const practiceContacts = [...new Set(practiceApplications.map(a => a.contact).filter(Boolean))]
  const practiceTypes = [...new Set(practiceApplications.map(a => a.practice_type).filter(Boolean) as string[])]
  const practiceJobs = [...new Set(practiceApplications.map(a => a.desired_job_field).filter(Boolean) as string[])]
  const practicePayStatuses = [...new Set(practiceApplications.map(a => a.payment_status).filter(Boolean) as string[])]
  const practiceStatuses = [...new Set(practiceApplications.map(a => a.status).filter(Boolean))]
  const practiceManagers = [...new Set(practiceApplications.map(a => a.manager).filter(Boolean) as string[])]

  const practiceFiltered = practiceApplications.filter(item => {
    if (practiceNameFilter.length > 0 && !practiceNameFilter.includes(item.name)) return false
    if (practiceContactFilter.length > 0 && !practiceContactFilter.includes(item.contact)) return false
    if (practiceTypeFilter.length > 0 && !practiceTypeFilter.includes(item.practice_type ?? '')) return false
    if (practiceJobFilter.length > 0 && !practiceJobFilter.includes(item.desired_job_field ?? '')) return false
    if (practicePayStatusFilter.length > 0 && !practicePayStatusFilter.includes(item.payment_status ?? '')) return false
    if (practiceStatusFilter.length > 0 && !practiceStatusFilter.includes(item.status)) return false
    if (practiceManagerFilter.length > 0 && !practiceManagerFilter.includes(item.manager ?? '')) return false
    return true
  })

  const practiceTotalPages = Math.ceil(practiceFiltered.length / PAGE_SIZE)
  const practicePaged = practiceFiltered.slice((practicePage - 1) * PAGE_SIZE, practicePage * PAGE_SIZE)

  const empNames = [...new Set(employmentApplications.map(a => a.name).filter(Boolean))]
  const empContacts = [...new Set(employmentApplications.map(a => a.contact).filter(Boolean))]
  const empTypes = [...new Set(employmentApplications.flatMap(a => Array.isArray(a.employment_types) ? a.employment_types : []).filter(Boolean))]
  const empPayStatuses = [...new Set(employmentApplications.map(a => a.payment_status).filter(Boolean))]
  const empManagers = [...new Set(employmentApplications.map(a => a.manager).filter(Boolean) as string[])]

  const employmentFiltered = employmentApplications.filter(item => {
    if (empNameFilter.length > 0 && !empNameFilter.includes(item.name)) return false
    if (empContactFilter.length > 0 && !empContactFilter.includes(item.contact)) return false
    if (empTypeFilter.length > 0 && !empTypeFilter.some(t => Array.isArray(item.employment_types) && item.employment_types.includes(t))) return false
    if (empPayStatusFilter.length > 0 && !empPayStatusFilter.includes(item.payment_status)) return false
    if (empManagerFilter.length > 0 && !empManagerFilter.includes(item.manager ?? '')) return false
    return true
  })

  const employmentTotalPages = Math.ceil(employmentFiltered.length / PAGE_SIZE)
  const employmentPaged = employmentFiltered.slice((employmentPage - 1) * PAGE_SIZE, employmentPage * PAGE_SIZE)

  // ─── Excel 다운로드 ────────────────────────────────────────────────────────

  const CONSULT_HEADERS = ['번호', '이름', '연락처', '서비스', '희망취업시기', '담당자', '상태', '등록일']
  const consultToRow = (item: PracticeConsultation, i: number) => [
    i + 1,
    item.name,
    item.contact,
    [item.service_practice && '실습', item.service_employment && '취업'].filter(Boolean).join(', '),
    item.employment_hope_time ?? '',
    item.manager ?? '',
    item.status,
    item.created_at ? new Date(item.created_at).toLocaleString('ko-KR') : '',
  ]

  const handleConsultDownloadSelected = () => {
    const targets = consultationFiltered.filter(c => selectedConsultationIds.has(c.id))
    downloadExcel(`상담신청_선택_${new Date().toLocaleDateString('ko-KR').replace(/\. /g,'-').replace('.','')}.xlsx`, [{
      name: '상담신청', headers: CONSULT_HEADERS, rows: targets.map((c, i) => consultToRow(c, i)),
    }])
  }
  const handleConsultDownloadAll = () => {
    downloadExcel(`상담신청_전체_${new Date().toLocaleDateString('ko-KR').replace(/\. /g,'-').replace('.','')}.xlsx`, [{
      name: '상담신청', headers: CONSULT_HEADERS, rows: consultationFiltered.map((c, i) => consultToRow(c, i)),
    }])
  }

  const PRACTICE_HEADERS = ['번호', '이름', '연락처', '실습유형', '희망직무', '취업유형', '결제금액', '결제상태', '담당자', '상태', '등록일']
  const practiceAppToRow = (item: PracticeApplication, i: number) => [
    i + 1,
    item.name,
    item.contact,
    item.practice_type ?? '',
    item.desired_job_field ?? '',
    item.employment_types?.join(', ') ?? '',
    item.payment_amount ?? '',
    item.payment_status ?? '',
    item.manager ?? '',
    item.status,
    item.created_at ? new Date(item.created_at).toLocaleString('ko-KR') : '',
  ]

  const handlePracticeDownloadSelected = () => {
    const targets = practiceFiltered.filter(a => selectedPracticeAppIds.has(a.id))
    downloadExcel(`실습섭외신청서_선택_${new Date().toLocaleDateString('ko-KR').replace(/\. /g,'-').replace('.','')}.xlsx`, [{
      name: '실습섭외신청서', headers: PRACTICE_HEADERS, rows: targets.map((a, i) => practiceAppToRow(a, i)),
    }])
  }
  const handlePracticeDownloadAll = () => {
    downloadExcel(`실습섭외신청서_전체_${new Date().toLocaleDateString('ko-KR').replace(/\. /g,'-').replace('.','')}.xlsx`, [{
      name: '실습섭외신청서', headers: PRACTICE_HEADERS, rows: practiceFiltered.map((a, i) => practiceAppToRow(a, i)),
    }])
  }

  const EMP_HEADERS = ['번호', '이름', '연락처', '희망직무', '취업유형', '이력서', '자격증', '결제금액', '결제상태', '담당자', '상태', '등록일']
  const empToRow = (item: EmploymentApplication, i: number) => [
    i + 1,
    item.name,
    item.contact,
    item.desired_job_field ?? '',
    item.employment_types?.join(', ') ?? '',
    item.has_resume ? '있음' : '없음',
    item.certifications ?? '',
    item.payment_amount ?? '',
    item.payment_status ?? '',
    item.manager ?? '',
    item.status,
    item.created_at ? new Date(item.created_at).toLocaleString('ko-KR') : '',
  ]

  const handleEmpDownloadSelected = () => {
    const targets = employmentFiltered.filter(a => selectedEmploymentIds.has(a.id))
    downloadExcel(`취업신청_선택_${new Date().toLocaleDateString('ko-KR').replace(/\. /g,'-').replace('.','')}.xlsx`, [{
      name: '취업신청', headers: EMP_HEADERS, rows: targets.map((a, i) => empToRow(a, i)),
    }])
  }
  const handleEmpDownloadAll = () => {
    downloadExcel(`취업신청_전체_${new Date().toLocaleDateString('ko-KR').replace(/\. /g,'-').replace('.','')}.xlsx`, [{
      name: '취업신청', headers: EMP_HEADERS, rows: employmentFiltered.map((a, i) => empToRow(a, i)),
    }])
  }

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
      {showAddConsultationModal && (
        <AddConsultationModal onClose={() => setShowAddConsultationModal(false)} onSaved={fetchConsultations} />
      )}
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
      {toastVisible && <div className={styles.toast}>저장이 완료되었습니다</div>}
      {deleteToastVisible && <div className={styles.toast}>삭제되었습니다</div>}


      {/* ===== 상담신청 탭 ===== */}
      {activeTab === 'consultation' && (
        <>
          {loading ? <FilterBarSkeleton /> : (
            <>
              {/* 필터 */}
              <div className={styles.filterRow}>
                <input
                  className={`${styles.input} ${practiceStyles.searchInput}`}
                  type="text"
                  value={consultationSearch}
                  onChange={e => setConsultationSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') fetchConsultations() }}
                  placeholder="이름, 연락처 검색..."
                />
                {selectedConsultationIds.size > 0 && (
                  <>
                    <button onClick={handleDeleteConsultations} disabled={deleting} className={styles.btnDanger}>
                      {deleting ? '삭제 중...' : '선택 삭제'}
                    </button>
                    <button onClick={handleConsultDownloadSelected} className={styles.btnDownload}>↓ 선택 다운로드</button>
                  </>
                )}
              </div>
              {/* 액션 바 */}
              <div className={styles.actionBar}>
                <span className={styles.actionBarCount}>총 <strong className={styles.actionBarCountBold}>{consultationFiltered.length}</strong>건</span>
                <div className={styles.actionBarSpacer} />
                <button onClick={handleConsultDownloadAll} className={styles.btnDownload}>↓ 전체 다운로드</button>
                <button onClick={() => setShowAddConsultationModal(true)} className={styles.btnPrimary}>+ 추가</button>
              </div>
            </>
          )}

          {/* 테이블 */}
          <div className={styles.tableCard}>
            <div className={styles.tableOverflow}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thCenter}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={consultationPaged.length > 0 && consultationPaged.every(c => selectedConsultationIds.has(c.id))}
                        onChange={() => {
                          const allSelected = consultationPaged.every(c => selectedConsultationIds.has(c.id))
                          setSelectedConsultationIds(allSelected ? new Set() : new Set(consultationPaged.map(c => c.id)))
                        }}
                      />
                    </th>
                    <th className={styles.thNum}>번호</th>
                    {/* 이름 */}
                    <th className={styles.thFilterable}>
                      <div className={styles.thInner}>
                        이름
                        <button
                          className={`${styles.thFilterBtn}${consultNameFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`}
                          onClick={e => { e.stopPropagation(); if (openFilterColumn === 'name') { setOpenFilterColumn(null); return; } const r = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: r.bottom + 4, left: r.left }); setOpenFilterColumn('name') }}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                    </th>
                    {/* 연락처 */}
                    <th className={styles.th}>연락처</th>
                    {/* 희망서비스 */}
                    <th className={styles.thFilterable}>
                      <div className={styles.thInner}>
                        희망서비스
                        <button
                          className={`${styles.thFilterBtn}${consultServiceFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`}
                          onClick={e => { e.stopPropagation(); if (openFilterColumn === 'service') { setOpenFilterColumn(null); return; } const r = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: r.bottom + 4, left: r.left }); setOpenFilterColumn('service') }}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                    </th>
                    {/* 취업희망시기 */}
                    <th className={styles.thFilterable}>
                      <div className={styles.thInner}>
                        취업희망시기
                        <button
                          className={`${styles.thFilterBtn}${consultHopeTimeFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`}
                          onClick={e => { e.stopPropagation(); if (openFilterColumn === 'hopeTime') { setOpenFilterColumn(null); return; } const r = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: r.bottom + 4, left: r.left }); setOpenFilterColumn('hopeTime') }}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                    </th>
                    {/* 고용지원금 */}
                    <th className={styles.th}>고용지원금</th>
                    {/* 담당자 */}
                    <th className={styles.thFilterable}>
                      <div className={styles.thInner}>
                        담당자
                        <button
                          className={`${styles.thFilterBtn}${consultManagerFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`}
                          onClick={e => { e.stopPropagation(); if (openFilterColumn === 'manager') { setOpenFilterColumn(null); return; } const r = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: r.bottom + 4, left: r.left }); setOpenFilterColumn('manager') }}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                    </th>
                    {/* 상태 */}
                    <th className={styles.thFilterable}>
                      <div className={styles.thInner}>
                        상태
                        <button
                          className={`${styles.thFilterBtn}${consultStatusMultiFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`}
                          onClick={e => { e.stopPropagation(); if (openFilterColumn === 'status') { setOpenFilterColumn(null); return; } const r = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: r.bottom + 4, left: r.left }); setOpenFilterColumn('status') }}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                    </th>
                    <th className={styles.th}>등록일</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeleton cols={9} rows={8} />
                  ) : error ? (
                    <tr><td className={styles.td} colSpan={9}><ErrorState message={error} /></td></tr>
                  ) : consultationPaged.length === 0 ? (
                    <tr><td className={styles.td} colSpan={9}><EmptyState /></td></tr>
                  ) : consultationPaged.map((item, index) => (
                    <tr
                      key={item.id}
                      data-id={item.id}
                      className={styles.tr}
                      onClick={() => setSelectedConsultation(item)}
                      style={{ background: selectedConsultation?.id === item.id ? 'var(--toss-blue-subtle)' : selectedConsultationIds.has(item.id) ? '#f0f7ff' : undefined }}
                    >
                      <td className={styles.tdCenter} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={selectedConsultationIds.has(item.id)}
                          onChange={() => setSelectedConsultationIds(prev => {
                            const next = new Set(prev)
                            next.has(item.id) ? next.delete(item.id) : next.add(item.id)
                            return next
                          })}
                        />
                      </td>
                      <td className={styles.tdNum}>{(consultationPage - 1) * PAGE_SIZE + index + 1}</td>
                      <td className={styles.td} style={{ fontWeight: 600 }}>
                        <Highlight text={item.name} query={consultationSearch} />
                      </td>
                      <td className={styles.td}>
                        <Highlight text={item.contact} query={consultationSearch} />
                      </td>
                      <td className={styles.td}>
                        {item.service_practice && item.service_employment ? '실습 + 취업'
                          : item.service_practice ? '실습'
                          : item.service_employment ? '취업'
                          : '-'}
                      </td>
                      <td className={styles.td}>{item.employment_hope_time ?? '-'}</td>
                      <td className={styles.td}>
                        {item.employment_support_fund === true ? '희망'
                          : item.employment_support_fund === false ? '미희망'
                          : '-'}
                      </td>
                      <td className={styles.td}>{item.manager ?? '-'}</td>
                      <td className={styles.td} onClick={e => e.stopPropagation()}>
                        <StatusSelect
                          value={item.status}
                          onChange={v => handleConsultationStatusChange(item.id, v as ConsultationStatus)}
                          options={CONSULTATION_STATUS_OPTIONS}
                          styleMap={CONSULTATION_STATUS_STYLE}
                        />
                      </td>
                      <td className={styles.td}>{formatDateShort(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && !error && consultationFiltered.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--toss-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--toss-text-secondary)' }}>총 {consultationFiltered.length.toLocaleString()}건</span>
                <Pagination page={consultationPage} totalPages={consultationTotalPages} onChange={setConsultationPage} />
              </div>
            )}
          </div>

          {/* 컬럼 필터 드롭다운 */}
          {openFilterColumn && (
            <div
              ref={dropdownRef}
              className={styles.filterColumnDropdown}
              style={{ top: filterDropdownPos.top, left: filterDropdownPos.left }}
            >
              {openFilterColumn === 'name' && consultationNames.map(n => (
                <div key={n} className={`${styles.filterDropdownItem}${consultNameFilter.includes(n) ? ` ${styles.filterDropdownItemActive}` : ''}`}
                  onClick={() => setConsultNameFilter(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])}>{n}</div>
              ))}
              {openFilterColumn === 'service' && ['실습', '취업', '실습+취업'].map(opt => (
                <div key={opt} className={`${styles.filterDropdownItem}${consultServiceFilter.includes(opt) ? ` ${styles.filterDropdownItemActive}` : ''}`}
                  onClick={() => setConsultServiceFilter(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt])}>{opt}</div>
              ))}
              {openFilterColumn === 'hopeTime' && ['바로 취업', '3개월 준비', '6개월 준비'].map(opt => (
                <div key={opt} className={`${styles.filterDropdownItem}${consultHopeTimeFilter.includes(opt) ? ` ${styles.filterDropdownItemActive}` : ''}`}
                  onClick={() => setConsultHopeTimeFilter(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt])}>{opt}</div>
              ))}
              {openFilterColumn === 'manager' && consultationManagers.map(m => (
                <div key={m} className={`${styles.filterDropdownItem}${consultManagerFilter.includes(m) ? ` ${styles.filterDropdownItemActive}` : ''}`}
                  onClick={() => setConsultManagerFilter(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}>{m}</div>
              ))}
              {openFilterColumn === 'status' && CONSULTATION_STATUS_OPTIONS.map(s => (
                <div key={s} className={`${styles.filterDropdownItem}${consultStatusMultiFilter.includes(s) ? ` ${styles.filterDropdownItemActive}` : ''}`}
                  onClick={() => setConsultStatusMultiFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}>{s}</div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== 실습섭외신청서 탭 ===== */}
      {activeTab === 'practice' && (
        <>
          {loading ? <FilterBarSkeleton /> : (
            <>
              {/* 필터 */}
              <div className={styles.filterRow}>
                <input
                  className={`${styles.input} ${practiceStyles.searchInput}`}
                  type="text"
                  value={practiceSearch}
                  onChange={e => setPracticeSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') fetchPracticeApplications() }}
                  placeholder="이름, 연락처 검색..."
                />
                {selectedPracticeAppIds.size > 0 && (
                  <>
                    <button onClick={handleDeletePracticeApps} disabled={deleting} className={styles.btnDanger}>
                      {deleting ? '삭제 중...' : '선택 삭제'}
                    </button>
                    <button onClick={handlePracticeDownloadSelected} className={styles.btnDownload}>↓ 선택 다운로드</button>
                  </>
                )}
              </div>
              {/* 액션 바 */}
              <div className={styles.actionBar}>
                <span className={styles.actionBarCount}>총 <strong className={styles.actionBarCountBold}>{practiceFiltered.length}</strong>건</span>
                <div className={styles.actionBarSpacer} />
                <button onClick={handlePracticeDownloadAll} className={styles.btnDownload}>↓ 전체 다운로드</button>
                <button onClick={() => setShowAddPracticeModal(true)} className={styles.btnPrimary}>+ 추가</button>
              </div>
            </>
          )}

          {/* 테이블 */}
          <div className={styles.tableCard}>
            <div className={styles.tableOverflow}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thCenter}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={practicePaged.length > 0 && practicePaged.every(a => selectedPracticeAppIds.has(a.id))}
                        onChange={() => {
                          const allSelected = practicePaged.every(a => selectedPracticeAppIds.has(a.id))
                          setSelectedPracticeAppIds(allSelected ? new Set() : new Set(practicePaged.map(a => a.id)))
                        }}
                      />
                    </th>
                    <th className={styles.thNum}>번호</th>
                    {/* 이름 */}
                    <th className={styles.thFilterable}><div className={styles.thInner}>이름<button className={`${styles.thFilterBtn}${practiceNameFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'pname') { setOpenFilterColumn(null); return; } const r = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: r.bottom + 4, left: r.left }); setOpenFilterColumn('pname') }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div></th>
                    {/* 연락처 */}
                    <th className={styles.thFilterable}><div className={styles.thInner}>연락처<button className={`${styles.thFilterBtn}${practiceContactFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'pcontact') { setOpenFilterColumn(null); return; } const r = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: r.bottom + 4, left: r.left }); setOpenFilterColumn('pcontact') }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div></th>
                    {/* 실습유형 */}
                    <th className={styles.thFilterable}><div className={styles.thInner}>실습유형<button className={`${styles.thFilterBtn}${practiceTypeFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'ptype') { setOpenFilterColumn(null); return; } const r = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: r.bottom + 4, left: r.left }); setOpenFilterColumn('ptype') }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div></th>
                    {/* 희망직무 */}
                    <th className={styles.thFilterable}><div className={styles.thInner}>희망직무<button className={`${styles.thFilterBtn}${practiceJobFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'pjob') { setOpenFilterColumn(null); return; } const r = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: r.bottom + 4, left: r.left }); setOpenFilterColumn('pjob') }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div></th>
                    {/* 결제금액 */}
                    <th className={styles.th}>결제금액</th>
                    {/* 결제상태 */}
                    <th className={styles.thFilterable}><div className={styles.thInner}>결제상태<button className={`${styles.thFilterBtn}${practicePayStatusFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'ppaystatus') { setOpenFilterColumn(null); return; } const r = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: r.bottom + 4, left: r.left }); setOpenFilterColumn('ppaystatus') }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div></th>
                    {/* 담당자 */}
                    <th className={styles.thFilterable}><div className={styles.thInner}>담당자<button className={`${styles.thFilterBtn}${practiceManagerFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'pmanager') { setOpenFilterColumn(null); return; } const r = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: r.bottom + 4, left: r.left }); setOpenFilterColumn('pmanager') }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div></th>
                    {/* 상태 */}
                    <th className={styles.thFilterable}><div className={styles.thInner}>상태<button className={`${styles.thFilterBtn}${practiceStatusFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'pstatus') { setOpenFilterColumn(null); return; } const r = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: r.bottom + 4, left: r.left }); setOpenFilterColumn('pstatus') }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div></th>
                    <th className={styles.th}>등록일</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeleton cols={10} rows={8} />
                  ) : error ? (
                    <tr><td className={styles.td} colSpan={10}><ErrorState message={error} /></td></tr>
                  ) : practicePaged.length === 0 ? (
                    <tr><td className={styles.td} colSpan={10}><EmptyState /></td></tr>
                  ) : practicePaged.map((item, index) => (
                    <tr
                      key={item.id}
                      className={styles.tr}
                      onClick={() => setSelectedPracticeApp(item)}
                      style={{ background: selectedPracticeApp?.id === item.id ? 'var(--toss-blue-subtle)' : selectedPracticeAppIds.has(item.id) ? '#f0f7ff' : undefined }}
                    >
                      <td className={styles.tdCenter} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={selectedPracticeAppIds.has(item.id)}
                          onChange={() => setSelectedPracticeAppIds(prev => {
                            const next = new Set(prev)
                            next.has(item.id) ? next.delete(item.id) : next.add(item.id)
                            return next
                          })}
                        />
                      </td>
                      <td className={styles.tdNum}>{(practicePage - 1) * PAGE_SIZE + index + 1}</td>
                      <td className={styles.td} style={{ fontWeight: 600 }}>
                        <Highlight text={item.name} query={practiceSearch} />
                      </td>
                      <td className={styles.td}>
                        <Highlight text={item.contact} query={practiceSearch} />
                      </td>
                      <td className={styles.td}>{item.practice_type ?? '-'}</td>
                      <td className={styles.td}>{item.desired_job_field ?? '-'}</td>
                      <td className={styles.td}>{item.payment_amount != null ? `${item.payment_amount.toLocaleString()}원` : '-'}</td>
                      <td className={styles.td}>
                        {item.payment_status ? (
                          <span
                            className={styles.statusBadge}
                            style={{
                              background: (PAYMENT_STATUS_STYLE[item.payment_status] ?? PAYMENT_STATUS_STYLE.pending).background,
                              color: (PAYMENT_STATUS_STYLE[item.payment_status] ?? PAYMENT_STATUS_STYLE.pending).color,
                            }}
                          >
                            {PAYMENT_STATUS_LABEL[item.payment_status] ?? item.payment_status}
                          </span>
                        ) : '-'}
                      </td>
                      <td className={styles.td}>{item.manager ?? '-'}</td>
                      <td className={styles.td} onClick={e => e.stopPropagation()}>
                        <StatusSelect
                          value={PRACTICE_APP_STATUS_OPTIONS.includes(item.status as PracticeAppStatus) ? item.status : '대기'}
                          onChange={v => handlePracticeAppStatusChange(item.id, v)}
                          options={PRACTICE_APP_STATUS_OPTIONS}
                          styleMap={PRACTICE_APP_STATUS_STYLE}
                        />
                      </td>
                      <td className={styles.td}>{formatDateShort(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && !error && practiceFiltered.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--toss-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--toss-text-secondary)' }}>총 {practiceFiltered.length.toLocaleString()}건</span>
                <Pagination page={practicePage} totalPages={practiceTotalPages} onChange={setPracticePage} />
              </div>
            )}
          </div>

          {/* 컬럼 필터 드롭다운 */}
          {openFilterColumn && (
            <div
              ref={dropdownRef}
              className={styles.filterColumnDropdown}
              style={{ top: filterDropdownPos.top, left: filterDropdownPos.left }}
            >
              {openFilterColumn === 'pname' && practiceNames.map(n => (
                <div key={n} className={`${styles.filterDropdownItem}${practiceNameFilter.includes(n) ? ` ${styles.filterDropdownItemActive}` : ''}`}
                  onClick={() => setPracticeNameFilter(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])}>{n}</div>
              ))}
              {openFilterColumn === 'pcontact' && practiceContacts.map(c => (
                <div key={c} className={`${styles.filterDropdownItem}${practiceContactFilter.includes(c) ? ` ${styles.filterDropdownItemActive}` : ''}`}
                  onClick={() => setPracticeContactFilter(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}>{c}</div>
              ))}
              {openFilterColumn === 'ptype' && practiceTypes.map(t => (
                <div key={t} className={`${styles.filterDropdownItem}${practiceTypeFilter.includes(t) ? ` ${styles.filterDropdownItemActive}` : ''}`}
                  onClick={() => setPracticeTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}>{t}</div>
              ))}
              {openFilterColumn === 'pjob' && practiceJobs.map(j => (
                <div key={j} className={`${styles.filterDropdownItem}${practiceJobFilter.includes(j) ? ` ${styles.filterDropdownItemActive}` : ''}`}
                  onClick={() => setPracticeJobFilter(prev => prev.includes(j) ? prev.filter(x => x !== j) : [...prev, j])}>{j}</div>
              ))}
              {openFilterColumn === 'ppaystatus' && practicePayStatuses.map(ps => (
                <div key={ps} className={`${styles.filterDropdownItem}${practicePayStatusFilter.includes(ps) ? ` ${styles.filterDropdownItemActive}` : ''}`}
                  onClick={() => setPracticePayStatusFilter(prev => prev.includes(ps) ? prev.filter(x => x !== ps) : [...prev, ps])}>{PAYMENT_STATUS_LABEL[ps] ?? ps}</div>
              ))}
              {openFilterColumn === 'pmanager' && practiceManagers.map(m => (
                <div key={m} className={`${styles.filterDropdownItem}${practiceManagerFilter.includes(m) ? ` ${styles.filterDropdownItemActive}` : ''}`}
                  onClick={() => setPracticeManagerFilter(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}>{m}</div>
              ))}
              {openFilterColumn === 'pstatus' && practiceStatuses.map(s => (
                <div key={s} className={`${styles.filterDropdownItem}${practiceStatusFilter.includes(s) ? ` ${styles.filterDropdownItemActive}` : ''}`}
                  onClick={() => setPracticeStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}>{s}</div>
              ))}
            </div>
          )}

          {showAddPracticeModal && (
            <PracticeAddModal
              onClose={() => setShowAddPracticeModal(false)}
              onAdd={handlePracticeAdd}
            />
          )}
        </>
      )}

      {/* ===== 취업신청 탭 ===== */}
      {activeTab === 'employment' && (
        <>
          {loading ? <FilterBarSkeleton /> : (
            <>
              {/* 필터 + 액션 */}
              <div className={styles.filterRow}>
                <input
                  className={`${styles.input} ${practiceStyles.searchInput}`}
                  type="text"
                  value={employmentSearch}
                  onChange={e => setEmploymentSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') fetchEmploymentApplications() }}
                  placeholder="이름, 연락처 검색..."
                />
                {selectedEmploymentIds.size > 0 && (
                  <>
                    <button onClick={handleDeleteEmploymentApps} disabled={deleting} className={styles.btnDanger}>
                      {deleting ? '삭제 중...' : '선택 삭제'}
                    </button>
                    <button onClick={handleEmpDownloadSelected} className={styles.btnDownload}>↓ 선택 다운로드</button>
                  </>
                )}
              </div>
              {/* 액션 바 */}
              <div className={styles.actionBar}>
                <span className={styles.actionBarCount}>총 <strong className={styles.actionBarCountBold}>{employmentFiltered.length}</strong>건</span>
                <div className={styles.actionBarSpacer} />
                <button onClick={handleEmpDownloadAll} className={styles.btnDownload}>↓ 전체 다운로드</button>
                <button onClick={() => setShowAddEmploymentModal(true)} className={styles.btnPrimary}>+ 추가</button>
              </div>
            </>
          )}

          {/* 테이블 */}
          <div className={styles.tableCard}>
            <div className={styles.tableOverflow}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thCenter}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={employmentPaged.length > 0 && employmentPaged.every(a => selectedEmploymentIds.has(a.id))}
                        onChange={() => {
                          const allSelected = employmentPaged.every(a => selectedEmploymentIds.has(a.id))
                          setSelectedEmploymentIds(allSelected ? new Set() : new Set(employmentPaged.map(a => a.id)))
                        }}
                      />
                    </th>
                    <th className={styles.thNum}>번호</th>
                    <th className={styles.thFilterable}><div className={styles.thInner}>이름<button className={`${styles.thFilterBtn}${empNameFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'ename') { setOpenFilterColumn(null); return; } const r = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: r.bottom + 4, left: r.left }); setOpenFilterColumn('ename') }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div></th>
                    <th className={styles.thFilterable}><div className={styles.thInner}>연락처<button className={`${styles.thFilterBtn}${empContactFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'econtact') { setOpenFilterColumn(null); return; } const r = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: r.bottom + 4, left: r.left }); setOpenFilterColumn('econtact') }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div></th>
                    <th className={styles.th}>희망직무</th>
                    <th className={styles.thFilterable}><div className={styles.thInner}>취업유형<button className={`${styles.thFilterBtn}${empTypeFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'etype') { setOpenFilterColumn(null); return; } const r = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: r.bottom + 4, left: r.left }); setOpenFilterColumn('etype') }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div></th>
                    <th className={styles.th}>자격증</th>
                    <th className={styles.th}>결제금액</th>
                    <th className={styles.thFilterable}><div className={styles.thInner}>결제상태<button className={`${styles.thFilterBtn}${empPayStatusFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'epaystatus') { setOpenFilterColumn(null); return; } const r = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: r.bottom + 4, left: r.left }); setOpenFilterColumn('epaystatus') }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div></th>
                    <th className={styles.thFilterable}><div className={styles.thInner}>담당자<button className={`${styles.thFilterBtn}${empManagerFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'emanager') { setOpenFilterColumn(null); return; } const r = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: r.bottom + 4, left: r.left }); setOpenFilterColumn('emanager') }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div></th>
                    <th className={styles.th}>등록일</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeleton cols={10} rows={8} />
                  ) : error ? (
                    <tr><td className={styles.td} colSpan={10}><ErrorState message={error} /></td></tr>
                  ) : employmentPaged.length === 0 ? (
                    <tr><td className={styles.td} colSpan={10}><EmptyState /></td></tr>
                  ) : employmentPaged.map((item, index) => {
                    const payStyle = PAYMENT_STATUS_STYLE[item.payment_status] ?? PAYMENT_STATUS_STYLE.pending
                    return (
                      <tr
                        key={item.id}
                        className={styles.tr}
                        onClick={() => setSelectedEmploymentApp(item)}
                        style={{ background: selectedEmploymentApp?.id === item.id ? 'var(--toss-blue-subtle)' : selectedEmploymentIds.has(item.id) ? '#f0f7ff' : undefined }}
                      >
                        <td className={styles.tdCenter} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={selectedEmploymentIds.has(item.id)}
                            onChange={() => setSelectedEmploymentIds(prev => {
                              const next = new Set(prev)
                              next.has(item.id) ? next.delete(item.id) : next.add(item.id)
                              return next
                            })}
                          />
                        </td>
                        <td className={styles.tdNum}>{(employmentPage - 1) * PAGE_SIZE + index + 1}</td>
                        <td className={styles.td} style={{ fontWeight: 600 }}>
                          <Highlight text={item.name} query={employmentSearch} />
                        </td>
                        <td className={styles.td}>
                          <Highlight text={item.contact} query={employmentSearch} />
                        </td>
                        <td className={styles.td}>{item.desired_job_field ?? '-'}</td>
                        <td className={styles.td}>{Array.isArray(item.employment_types) ? item.employment_types.join(', ') : (item.employment_types ?? '-')}</td>
                        <td className={styles.td}>{item.certifications ?? '-'}</td>
                        <td className={styles.td} style={{ fontWeight: 500 }}>
                          {item.payment_amount ? `${item.payment_amount.toLocaleString()}원` : '-'}
                        </td>
                        <td className={styles.td}>
                          <span className={styles.statusBadge} style={{ background: payStyle.background, color: payStyle.color }}>
                            {PAYMENT_STATUS_LABEL[item.payment_status] ?? item.payment_status}
                          </span>
                        </td>
                        <td className={styles.td}>{item.manager ?? '-'}</td>
                        <td className={styles.td}>{formatDateShort(item.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {!loading && !error && employmentFiltered.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--toss-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--toss-text-secondary)' }}>총 {employmentFiltered.length.toLocaleString()}건</span>
                <Pagination page={employmentPage} totalPages={employmentTotalPages} onChange={setEmploymentPage} />
              </div>
            )}
          </div>

          {/* 컬럼 필터 드롭다운 */}
          {openFilterColumn && (
            <div
              ref={dropdownRef}
              className={styles.filterColumnDropdown}
              style={{ top: filterDropdownPos.top, left: filterDropdownPos.left }}
            >
              {openFilterColumn === 'ename' && empNames.map(n => (
                <div key={n} className={`${styles.filterDropdownItem}${empNameFilter.includes(n) ? ` ${styles.filterDropdownItemActive}` : ''}`}
                  onClick={() => setEmpNameFilter(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])}>{n}</div>
              ))}
              {openFilterColumn === 'econtact' && empContacts.map(c => (
                <div key={c} className={`${styles.filterDropdownItem}${empContactFilter.includes(c) ? ` ${styles.filterDropdownItemActive}` : ''}`}
                  onClick={() => setEmpContactFilter(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}>{c}</div>
              ))}
              {openFilterColumn === 'etype' && empTypes.map(t => (
                <div key={t} className={`${styles.filterDropdownItem}${empTypeFilter.includes(t) ? ` ${styles.filterDropdownItemActive}` : ''}`}
                  onClick={() => setEmpTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}>{t}</div>
              ))}
              {openFilterColumn === 'epaystatus' && empPayStatuses.map(ps => (
                <div key={ps} className={`${styles.filterDropdownItem}${empPayStatusFilter.includes(ps) ? ` ${styles.filterDropdownItemActive}` : ''}`}
                  onClick={() => setEmpPayStatusFilter(prev => prev.includes(ps) ? prev.filter(x => x !== ps) : [...prev, ps])}>{PAYMENT_STATUS_LABEL[ps] ?? ps}</div>
              ))}
              {openFilterColumn === 'emanager' && empManagers.map(m => (
                <div key={m} className={`${styles.filterDropdownItem}${empManagerFilter.includes(m) ? ` ${styles.filterDropdownItemActive}` : ''}`}
                  onClick={() => setEmpManagerFilter(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}>{m}</div>
              ))}
            </div>
          )}

          {showAddEmploymentModal && (
            <EmploymentAddModal
              onClose={() => setShowAddEmploymentModal(false)}
              onAdd={handleEmploymentAdd}
            />
          )}
        </>
      )}
    </div>
  )
}
