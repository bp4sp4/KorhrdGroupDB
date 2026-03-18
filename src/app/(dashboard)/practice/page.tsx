'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import styles from '../hakjeom/page.module.css'
import practiceStyles from './page.module.css'

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
      })
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

              <InfoRow label="등록일" value={formatDateTime(item.created_at)} />
              <InfoRow label="수정일" value={formatDateTime(item.updated_at)} />
            </>
          )}

          {activeTab === 'memo' && (
            <>
              <div className={practiceStyles.memoGroup}>
                <label className={practiceStyles.memoLabel}>메모</label>
                <textarea
                  value={editMemo}
                  onChange={e => setEditMemo(e.target.value)}
                  rows={6}
                  placeholder="메모를 입력하세요"
                  className={styles.textarea}
                />
              </div>
              <div>
                <label className={practiceStyles.memoLabel}>비고</label>
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
  const [editMemo, setEditMemo] = useState(item.memo ?? '')
  const [editPracticeType, setEditPracticeType] = useState(item.practice_type ?? '')
  const [editDesiredJobField, setEditDesiredJobField] = useState(item.desired_job_field ?? '')
  const [editCertifications, setEditCertifications] = useState(item.certifications ?? '')
  const [editPaymentAmount, setEditPaymentAmount] = useState(item.payment_amount != null ? String(item.payment_amount) : '')
  const [editPaymentStatus, setEditPaymentStatus] = useState(item.payment_status ?? '')
  const [editClickSource, setEditClickSource] = useState(item.click_source ?? '')
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
    setActiveTab('basic')
  }, [item.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(item.id, {
        status: editStatus, manager: editManager, memo: editMemo,
        practice_type: editPracticeType || null,
        desired_job_field: editDesiredJobField || null,
        certifications: editCertifications || null,
        payment_amount: editPaymentAmount ? Number(editPaymentAmount) : null,
        payment_status: editPaymentStatus || null,
        click_source: editClickSource || null,
      })
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
              {/* 담당자 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>담당자</span>
                <input value={editManager} onChange={e => setEditManager(e.target.value)} placeholder="담당자 이름" className={`${styles.input} ${styles.inputFull}`} />
              </div>

              {/* 메모 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>메모</span>
                <textarea value={editMemo} onChange={e => setEditMemo(e.target.value)} rows={4} placeholder="메모를 입력하세요" className={styles.textarea} />
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

  // 체크박스 선택
  const [selectedConsultationIds, setSelectedConsultationIds] = useState<Set<number>>(new Set())
  const [selectedPracticeAppIds, setSelectedPracticeAppIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  // 취업신청
  const [employmentApplications, setEmploymentApplications] = useState<EmploymentApplication[]>([])
  const [employmentSearch, setEmploymentSearch] = useState('')
  const [employmentPage, setEmploymentPage] = useState(1)
  const [selectedEmploymentApp, setSelectedEmploymentApp] = useState<EmploymentApplication | null>(null)

  // 모달
  const [showAddConsultationModal, setShowAddConsultationModal] = useState(false)

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
              className={`${styles.input} ${practiceStyles.searchInput}`}
              type="text"
              value={consultationSearch}
              onChange={e => setConsultationSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') fetchConsultations() }}
              placeholder="이름 또는 연락처 검색"
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
            <button onClick={() => setShowAddConsultationModal(true)} className={styles.btnPrimary} style={{ marginLeft: 'auto' }}>+ 추가</button>
            {selectedConsultationIds.size > 0 && (
              <button onClick={handleDeleteConsultations} disabled={deleting} className={styles.btnDanger}>
                {deleting ? '삭제 중...' : `${selectedConsultationIds.size}건 삭제`}
              </button>
            )}
          </div>

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
                    {['이름', '연락처', '희망서비스(실습/취업)', '취업희망시기', '고용지원금', '담당자', '상태', '등록일'].map(col => (
                      <th key={col} className={styles.th}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className={styles.td} colSpan={9}><LoadingState /></td></tr>
                  ) : error ? (
                    <tr><td className={styles.td} colSpan={9}><ErrorState message={error} /></td></tr>
                  ) : consultationPaged.length === 0 ? (
                    <tr><td className={styles.td} colSpan={9}><EmptyState /></td></tr>
                  ) : consultationPaged.map(item => (
                    <tr
                      key={item.id}
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
              className={`${styles.input} ${practiceStyles.searchInput}`}
              type="text"
              value={practiceSearch}
              onChange={e => setPracticeSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') fetchPracticeApplications() }}
              placeholder="이름 또는 연락처 검색"
            />
            {selectedPracticeAppIds.size > 0 && (
              <button onClick={handleDeletePracticeApps} disabled={deleting} className={styles.btnDanger}>
                {deleting ? '삭제 중...' : `${selectedPracticeAppIds.size}건 삭제`}
              </button>
            )}
          </div>

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
                    {['이름', '연락처', '실습유형', '희망직무', '결제금액', '결제상태', '담당자', '상태', '등록일'].map(col => (
                      <th key={col} className={styles.th}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className={styles.td} colSpan={10}><LoadingState /></td></tr>
                  ) : error ? (
                    <tr><td className={styles.td} colSpan={10}><ErrorState message={error} /></td></tr>
                  ) : practicePaged.length === 0 ? (
                    <tr><td className={styles.td} colSpan={10}><EmptyState /></td></tr>
                  ) : practicePaged.map(item => (
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
              className={`${styles.input} ${practiceStyles.searchInput}`}
              type="text"
              value={employmentSearch}
              onChange={e => setEmploymentSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') fetchEmploymentApplications() }}
              placeholder="이름 또는 연락처 검색"
            />
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
