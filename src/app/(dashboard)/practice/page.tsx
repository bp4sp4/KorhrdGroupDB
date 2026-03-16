'use client'

import { useState, useEffect, useCallback } from 'react'

// ---------------------------------------------------------------------------
// 탭 타입
// ---------------------------------------------------------------------------

type PracticeTab = 'consultation' | 'practice' | 'employment'

// ---------------------------------------------------------------------------
// 타입 정의 — 상담신청 (practice_consultations)
// ---------------------------------------------------------------------------

type ConsultationStatus =
  | '상담대기'
  | '상담중'
  | '보류'
  | '등록대기'
  | '등록완료'

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

// ---------------------------------------------------------------------------
// 타입 정의 — 실습섭외신청서 (practice_applications)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 타입 정의 — 취업신청 (employment_applications)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

const CONSULTATION_STATUS_OPTIONS: ConsultationStatus[] = [
  '상담대기',
  '상담중',
  '보류',
  '등록대기',
  '등록완료',
]

const CONSULTATION_TYPE_LABEL: Record<ConsultationType, string> = {
  consultation: '상담',
  practice: '실습',
  employment: '취업',
}

const CONSULTATION_STATUS_COLOR: Record<ConsultationStatus, { bg: string; text: string }> = {
  상담대기: { bg: '#FFF7ED', text: '#C2410C' },
  상담중: { bg: '#EFF6FF', text: '#1D4ED8' },
  보류: { bg: '#F9FAFB', text: '#6B7684' },
  등록대기: { bg: '#FEFCE8', text: '#A16207' },
  등록완료: { bg: '#F0FDF4', text: '#15803D' },
}

const PAYMENT_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  paid: { bg: '#d1fae5', color: '#065f46' },
  pending: { bg: '#fef3c7', color: '#92400e' },
  failed: { bg: '#fee2e2', color: '#991b1b' },
  cancelled: { bg: '#fee2e2', color: '#991b1b' },
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: '결제완료',
  pending: '결제대기',
  failed: '결제실패',
  cancelled: '취소',
}

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(dateString))
}

function formatDateTime(dateString: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

// ---------------------------------------------------------------------------
// 공통 서브 컴포넌트
// ---------------------------------------------------------------------------

function StatCard({ label, value, color = 'var(--toss-text-primary)' }: { label: string; value: number; color?: string }) {
  return (
    <div style={{
      background: 'var(--toss-card-bg)',
      border: '1px solid var(--toss-border)',
      borderRadius: 'var(--toss-radius-card)',
      padding: '20px 24px',
      boxShadow: 'var(--toss-shadow-card)',
      flex: 1,
      minWidth: 0,
    }}>
      <p style={{ fontSize: 13, color: 'var(--toss-text-secondary)', margin: 0, marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 700, color, margin: 0 }}>
        {value.toLocaleString()}
        <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 4, color: 'var(--toss-text-secondary)' }}>건</span>
      </p>
    </div>
  )
}

// 검색 + 필터 입력 공통 스타일
const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid var(--toss-border)',
  borderRadius: 'var(--toss-radius-input)',
  fontSize: 13,
  background: 'var(--toss-card-bg)',
  color: 'var(--toss-text-primary)',
  outline: 'none',
}

// ---------------------------------------------------------------------------
// 서브 컴포넌트: 상담신청 상세 패널
// ---------------------------------------------------------------------------

interface ConsultationDetailPanelProps {
  item: PracticeConsultation
  onClose: () => void
  onUpdate: (id: number, fields: Partial<PracticeConsultation>) => Promise<void>
}

function ConsultationDetailPanel({ item, onClose, onUpdate }: ConsultationDetailPanelProps) {
  const [status, setStatus] = useState<ConsultationStatus>(item.status)
  const [memo, setMemo] = useState(item.memo ?? '')
  const [manager, setManager] = useState(item.manager ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setStatus(item.status)
    setMemo(item.memo ?? '')
    setManager(item.manager ?? '')
    setNotes(item.notes ?? '')
  }, [item.id, item.status, item.memo, item.manager, item.notes])

  async function handleSave() {
    setSaving(true)
    try {
      await onUpdate(item.id, { status, memo, manager, notes })
    } finally {
      setSaving(false)
    }
  }

  function InfoRow({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
    const displayValue =
      value === null || value === undefined || value === ''
        ? '-'
        : typeof value === 'boolean'
        ? value ? '예' : '아니오'
        : String(value)
    return (
      <div style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--toss-border)' }}>
        <span style={{ fontSize: 12, color: 'var(--toss-text-secondary)', width: 110, flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 13, color: 'var(--toss-text-primary)', wordBreak: 'break-all' }}>{displayValue}</span>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, right: 0,
      width: 420,
      height: '100vh',
      background: 'var(--toss-card-bg)',
      borderLeft: '1px solid var(--toss-border)',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: '1px solid var(--toss-border)',
        position: 'sticky', top: 0, background: 'var(--toss-card-bg)', zIndex: 1,
      }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--toss-text-primary)' }}>{item.name}</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--toss-text-secondary)', marginTop: 2 }}>{item.contact}</p>
        </div>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--toss-text-secondary)', padding: 4, lineHeight: 1 }}>✕</button>
      </div>

      {/* 상태 관리 */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--toss-border)' }}>
        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--toss-text-primary)' }}>상태 관리</p>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--toss-text-secondary)', display: 'block', marginBottom: 4 }}>상태</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ConsultationStatus)} style={{ ...inputStyle, width: '100%' }}>
            {CONSULTATION_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--toss-text-secondary)', display: 'block', marginBottom: 4 }}>담당자</label>
          <input type="text" value={manager} onChange={(e) => setManager(e.target.value)} placeholder="담당자 이름" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--toss-text-secondary)', display: 'block', marginBottom: 4 }}>메모</label>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모를 입력하세요" rows={3} style={{ ...inputStyle, width: '100%', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--toss-text-secondary)', display: 'block', marginBottom: 4 }}>비고</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="비고를 입력하세요" rows={2} style={{ ...inputStyle, width: '100%', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '10px', background: saving ? 'var(--toss-border)' : 'var(--toss-blue)', color: '#fff', border: 'none', borderRadius: 'var(--toss-radius-button)', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* 상세 정보 */}
      <div style={{ padding: '16px 20px' }}>
        <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--toss-text-primary)' }}>상세 정보</p>
        <InfoRow label="유형" value={item.type ? CONSULTATION_TYPE_LABEL[item.type] : '-'} />
        <InfoRow label="학력" value={item.education} />
        <InfoRow label="희망과정" value={item.hope_course} />
        <InfoRow label="거주지" value={item.residence} />
        <InfoRow label="주소" value={item.address} />
        <InfoRow label="학습방법" value={item.study_method} />
        <InfoRow label="진행상황" value={item.progress} />
        <InfoRow label="실습처" value={item.practice_place} />
        <InfoRow label="실습예정일" value={item.practice_planned_date} />
        <InfoRow label="취업희망시기" value={item.employment_hope_time} />
        <InfoRow label="고용지원금" value={item.employment_support_fund} />
        <InfoRow label="취업상담" value={item.employment_consulting} />
        <InfoRow label="취업연계" value={item.employment_connection} />
        <InfoRow label="자격취득후취업" value={item.employment_after_cert} />
        <InfoRow label="유입경로" value={item.click_source} />
        <InfoRow label="상담이유" value={item.reason} />
        <InfoRow label="과목비용" value={item.subject_cost !== null ? `${item.subject_cost?.toLocaleString()}원` : null} />
        <InfoRow label="학생상태" value={item.student_status} />
        <InfoRow label="실습서비스" value={item.service_practice} />
        <InfoRow label="취업서비스" value={item.service_employment} />
        <InfoRow label="완료여부" value={item.is_completed} />
        <InfoRow label="등록일" value={formatDateTime(item.created_at)} />
        <InfoRow label="수정일" value={formatDateTime(item.updated_at)} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 서브 컴포넌트: 실습섭외신청서 상세 패널
// ---------------------------------------------------------------------------

interface PracticeApplicationDetailPanelProps {
  item: PracticeApplication
  onClose: () => void
  onUpdate: (id: string, fields: Partial<PracticeApplication>) => Promise<void>
}

function PracticeApplicationDetailPanel({ item, onClose, onUpdate }: PracticeApplicationDetailPanelProps) {
  const [status, setStatus] = useState(item.status)
  const [memo, setMemo] = useState(item.memo ?? '')
  const [manager, setManager] = useState(item.manager ?? '')
  const [practicePlace, setPracticePlace] = useState(item.practice_place ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setStatus(item.status)
    setMemo(item.memo ?? '')
    setManager(item.manager ?? '')
    setPracticePlace(item.practice_place ?? '')
  }, [item.id])

  async function handleSave() {
    setSaving(true)
    try {
      await onUpdate(item.id, { status, memo, manager, practice_place: practicePlace })
    } finally {
      setSaving(false)
    }
  }

  function InfoRow({ label, value }: { label: string; value: string | boolean | null | undefined }) {
    const displayValue =
      value === null || value === undefined || value === ''
        ? '-'
        : typeof value === 'boolean'
        ? value ? '예' : '아니오'
        : String(value)
    return (
      <div style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--toss-border)' }}>
        <span style={{ fontSize: 12, color: 'var(--toss-text-secondary)', width: 110, flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 13, color: 'var(--toss-text-primary)', wordBreak: 'break-all' }}>{displayValue}</span>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, right: 0,
      width: 420,
      height: '100vh',
      background: 'var(--toss-card-bg)',
      borderLeft: '1px solid var(--toss-border)',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: '1px solid var(--toss-border)',
        position: 'sticky', top: 0, background: 'var(--toss-card-bg)', zIndex: 1,
      }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--toss-text-primary)' }}>{item.student_name}</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--toss-text-secondary)', marginTop: 2 }}>{item.contact}</p>
        </div>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--toss-text-secondary)', padding: 4, lineHeight: 1 }}>✕</button>
      </div>

      {/* 상태 관리 */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--toss-border)' }}>
        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--toss-text-primary)' }}>상태 관리</p>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--toss-text-secondary)', display: 'block', marginBottom: 4 }}>상태</label>
          <input type="text" value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--toss-text-secondary)', display: 'block', marginBottom: 4 }}>담당자</label>
          <input type="text" value={manager} onChange={(e) => setManager(e.target.value)} placeholder="담당자 이름" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--toss-text-secondary)', display: 'block', marginBottom: 4 }}>실습처</label>
          <input type="text" value={practicePlace} onChange={(e) => setPracticePlace(e.target.value)} placeholder="실습처 이름" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--toss-text-secondary)', display: 'block', marginBottom: 4 }}>메모</label>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모를 입력하세요" rows={3} style={{ ...inputStyle, width: '100%', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '10px', background: saving ? 'var(--toss-border)' : 'var(--toss-blue)', color: '#fff', border: 'none', borderRadius: 'var(--toss-radius-button)', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* 상세 정보 */}
      <div style={{ padding: '16px 20px' }}>
        <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--toss-text-primary)' }}>상세 정보</p>
        <InfoRow label="성별" value={item.gender} />
        <InfoRow label="생년월일" value={item.birth_date} />
        <InfoRow label="거주지역" value={item.residence_area} />
        <InfoRow label="주소" value={item.address} />
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
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 서브 컴포넌트: 취업신청 상세 패널
// ---------------------------------------------------------------------------

interface EmploymentDetailPanelProps {
  item: EmploymentApplication
  onClose: () => void
  onUpdate: (id: string, fields: Partial<EmploymentApplication>) => Promise<void>
}

function EmploymentDetailPanel({ item, onClose, onUpdate }: EmploymentDetailPanelProps) {
  const [status, setStatus] = useState(item.status)
  const [memo, setMemo] = useState(item.memo ?? '')
  const [manager, setManager] = useState(item.manager ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setStatus(item.status)
    setMemo(item.memo ?? '')
    setManager(item.manager ?? '')
  }, [item.id])

  async function handleSave() {
    setSaving(true)
    try {
      await onUpdate(item.id, { status, memo, manager })
    } finally {
      setSaving(false)
    }
  }

  function InfoRow({ label, value }: { label: string; value: string | boolean | number | string[] | null | undefined }) {
    let displayValue: string
    if (value === null || value === undefined || value === '') {
      displayValue = '-'
    } else if (typeof value === 'boolean') {
      displayValue = value ? '예' : '아니오'
    } else if (Array.isArray(value)) {
      displayValue = value.join(', ') || '-'
    } else {
      displayValue = String(value)
    }
    return (
      <div style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--toss-border)' }}>
        <span style={{ fontSize: 12, color: 'var(--toss-text-secondary)', width: 110, flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 13, color: 'var(--toss-text-primary)', wordBreak: 'break-all' }}>{displayValue}</span>
      </div>
    )
  }

  const payStyle = PAYMENT_STATUS_STYLE[item.payment_status] ?? PAYMENT_STATUS_STYLE.pending

  return (
    <div style={{
      position: 'fixed',
      top: 0, right: 0,
      width: 420,
      height: '100vh',
      background: 'var(--toss-card-bg)',
      borderLeft: '1px solid var(--toss-border)',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: '1px solid var(--toss-border)',
        position: 'sticky', top: 0, background: 'var(--toss-card-bg)', zIndex: 1,
      }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--toss-text-primary)' }}>{item.name}</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--toss-text-secondary)', marginTop: 2 }}>{item.contact}</p>
        </div>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--toss-text-secondary)', padding: 4, lineHeight: 1 }}>✕</button>
      </div>

      {/* 결제 상태 배지 */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--toss-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: 'var(--toss-text-secondary)' }}>결제 상태</span>
        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--toss-radius-badge)', fontSize: 12, fontWeight: 600, background: payStyle.bg, color: payStyle.color }}>
          {PAYMENT_STATUS_LABEL[item.payment_status] ?? item.payment_status}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--toss-text-primary)', marginLeft: 'auto' }}>
          {item.payment_amount ? `${item.payment_amount.toLocaleString()}원` : '-'}
        </span>
      </div>

      {/* 상태 관리 */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--toss-border)' }}>
        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--toss-text-primary)' }}>상태 관리</p>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--toss-text-secondary)', display: 'block', marginBottom: 4 }}>상태</label>
          <input type="text" value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--toss-text-secondary)', display: 'block', marginBottom: 4 }}>담당자</label>
          <input type="text" value={manager} onChange={(e) => setManager(e.target.value)} placeholder="담당자 이름" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--toss-text-secondary)', display: 'block', marginBottom: 4 }}>메모</label>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모를 입력하세요" rows={3} style={{ ...inputStyle, width: '100%', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '10px', background: saving ? 'var(--toss-border)' : 'var(--toss-blue)', color: '#fff', border: 'none', borderRadius: 'var(--toss-radius-button)', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* 상세 정보 */}
      <div style={{ padding: '16px 20px' }}>
        <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--toss-text-primary)' }}>상세 정보</p>
        <InfoRow label="성별" value={item.gender} />
        <InfoRow label="생년월일" value={item.birth_date} />
        <InfoRow label="주소" value={item.address} />
        <InfoRow label="상세주소" value={item.address_detail} />
        <InfoRow label="희망직무" value={item.desired_job_field} />
        <InfoRow label="취업유형" value={item.employment_types} />
        <InfoRow label="이력서보유" value={item.has_resume} />
        <InfoRow label="자격증" value={item.certifications} />
        <InfoRow label="유입경로" value={item.click_source} />
        <InfoRow label="개인정보동의" value={item.privacy_agreed} />
        <InfoRow label="이용약관동의" value={item.terms_agreed} />
        <InfoRow label="결제ID" value={item.payment_id} />
        <InfoRow label="등록일" value={formatDateTime(item.created_at)} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 메인 페이지 컴포넌트
// ---------------------------------------------------------------------------

export default function PracticePage() {
  const [activeTab, setActiveTab] = useState<PracticeTab>('consultation')

  // 상담신청 상태
  const [consultations, setConsultations] = useState<PracticeConsultation[]>([])
  const [consultationSearch, setConsultationSearch] = useState('')
  const [consultationStatusFilter, setConsultationStatusFilter] = useState<ConsultationStatus | ''>('')
  const [consultationTypeFilter, setConsultationTypeFilter] = useState<ConsultationType | ''>('')
  const [selectedConsultation, setSelectedConsultation] = useState<PracticeConsultation | null>(null)

  // 실습섭외신청서 상태
  const [practiceApplications, setPracticeApplications] = useState<PracticeApplication[]>([])
  const [practiceSearch, setPracticeSearch] = useState('')
  const [selectedPracticeApp, setSelectedPracticeApp] = useState<PracticeApplication | null>(null)

  // 취업신청 상태
  const [employmentApplications, setEmploymentApplications] = useState<EmploymentApplication[]>([])
  const [employmentSearch, setEmploymentSearch] = useState('')
  const [selectedEmploymentApp, setSelectedEmploymentApp] = useState<EmploymentApplication | null>(null)

  // 공통
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ---------------------------------------------------------------------------
  // 데이터 페칭
  // ---------------------------------------------------------------------------

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
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [employmentSearch])

  // 탭 변경 또는 필터 변경 시 해당 탭 데이터 재조회
  useEffect(() => {
    if (activeTab === 'consultation') fetchConsultations()
    else if (activeTab === 'practice') fetchPracticeApplications()
    else if (activeTab === 'employment') fetchEmploymentApplications()
  }, [activeTab, fetchConsultations, fetchPracticeApplications, fetchEmploymentApplications])

  // ---------------------------------------------------------------------------
  // 업데이트 핸들러
  // ---------------------------------------------------------------------------

  async function handleConsultationUpdate(id: number, fields: Partial<PracticeConsultation>) {
    const res = await fetch('/api/practice', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? '저장에 실패했습니다.')
      return
    }
    const updated: PracticeConsultation = await res.json()
    setConsultations((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    setSelectedConsultation(updated)
  }

  async function handlePracticeAppUpdate(id: string, fields: Partial<PracticeApplication>) {
    const res = await fetch('/api/practice/applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? '저장에 실패했습니다.')
      return
    }
    const updated: PracticeApplication = await res.json()
    setPracticeApplications((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    setSelectedPracticeApp(updated)
  }

  async function handleEmploymentAppUpdate(id: string, fields: Partial<EmploymentApplication>) {
    const res = await fetch('/api/practice/employment', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? '저장에 실패했습니다.')
      return
    }
    const updated: EmploymentApplication = await res.json()
    setEmploymentApplications((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    setSelectedEmploymentApp(updated)
  }

  // ---------------------------------------------------------------------------
  // 탭 전환 핸들러
  // ---------------------------------------------------------------------------

  function handleTabChange(tab: PracticeTab) {
    setActiveTab(tab)
    setSelectedConsultation(null)
    setSelectedPracticeApp(null)
    setSelectedEmploymentApp(null)
    setError('')
  }

  // ---------------------------------------------------------------------------
  // 통계 계산
  // ---------------------------------------------------------------------------

  const consultationStats = {
    total: consultations.length,
    waiting: consultations.filter((i) => i.status === '상담대기').length,
    practice: consultations.filter((i) => i.service_practice === true).length,
    employment: consultations.filter((i) => i.service_employment === true).length,
  }

  const practiceAppStats = {
    total: practiceApplications.length,
    completed: practiceApplications.filter((i) => i.status === 'completed').length,
  }

  const employmentStats = {
    total: employmentApplications.length,
    paid: employmentApplications.filter((i) => i.payment_status === 'paid').length,
    pending: employmentApplications.filter((i) => i.payment_status === 'pending').length,
  }

  // ---------------------------------------------------------------------------
  // 현재 열려 있는 상세 패널 여부
  // ---------------------------------------------------------------------------

  const isPanelOpen = selectedConsultation !== null || selectedPracticeApp !== null || selectedEmploymentApp !== null

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------

  // 탭 설정
  const TABS: { value: PracticeTab; label: string }[] = [
    { value: 'consultation', label: '상담신청' },
    { value: 'practice', label: '실습섭외신청서' },
    { value: 'employment', label: '취업신청' },
  ]

  return (
    <div style={{ position: 'relative' }}>

      {/* 오버레이 (상세 패널 배경) */}
      {isPanelOpen && (
        <div
          onClick={() => {
            setSelectedConsultation(null)
            setSelectedPracticeApp(null)
            setSelectedEmploymentApp(null)
          }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 99 }}
        />
      )}

      {/* 상세 패널 */}
      {selectedConsultation && (
        <ConsultationDetailPanel
          item={selectedConsultation}
          onClose={() => setSelectedConsultation(null)}
          onUpdate={handleConsultationUpdate}
        />
      )}
      {selectedPracticeApp && (
        <PracticeApplicationDetailPanel
          item={selectedPracticeApp}
          onClose={() => setSelectedPracticeApp(null)}
          onUpdate={handlePracticeAppUpdate}
        />
      )}
      {selectedEmploymentApp && (
        <EmploymentDetailPanel
          item={selectedEmploymentApp}
          onClose={() => setSelectedEmploymentApp(null)}
          onUpdate={handleEmploymentAppUpdate}
        />
      )}

      {/* 페이지 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--toss-text-primary)', margin: 0 }}>
          실습/취업
        </h2>
        <p style={{ fontSize: 14, color: 'var(--toss-text-secondary)', margin: '4px 0 0' }}>
          실습 및 취업 관련 신청 내역을 관리합니다.
        </p>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--toss-border)', marginBottom: 20 }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.value
          return (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
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

      {/* ===== 상담신청 탭 ===== */}
      {activeTab === 'consultation' && (
        <>
          {/* 통계 카드 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <StatCard label="전체" value={consultationStats.total} />
            <StatCard label="상담대기" value={consultationStats.waiting} color="#C2410C" />
            <StatCard label="실습 서비스" value={consultationStats.practice} color="var(--toss-blue)" />
            <StatCard label="취업 서비스" value={consultationStats.employment} color="#15803D" />
          </div>

          {/* 검색 / 필터 */}
          <div style={{ background: 'var(--toss-card-bg)', border: '1px solid var(--toss-border)', borderRadius: 'var(--toss-radius-card)', padding: '16px 20px', boxShadow: 'var(--toss-shadow-card)', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={consultationSearch}
              onChange={(e) => setConsultationSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchConsultations() }}
              placeholder="이름 또는 연락처 검색"
              style={{ ...inputStyle, flex: '1 1 200px' }}
            />
            <select value={consultationStatusFilter} onChange={(e) => setConsultationStatusFilter(e.target.value as ConsultationStatus | '')} style={inputStyle}>
              <option value="">전체 상태</option>
              {CONSULTATION_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={consultationTypeFilter} onChange={(e) => setConsultationTypeFilter(e.target.value as ConsultationType | '')} style={inputStyle}>
              <option value="">전체 유형</option>
              <option value="consultation">상담</option>
              <option value="practice">실습</option>
              <option value="employment">취업</option>
            </select>
            <button onClick={fetchConsultations} style={{ padding: '8px 16px', background: 'var(--toss-blue)', color: '#fff', border: 'none', borderRadius: 'var(--toss-radius-button)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              검색
            </button>
          </div>

          {/* 테이블 */}
          <div style={{ background: 'var(--toss-card-bg)', border: '1px solid var(--toss-border)', borderRadius: 'var(--toss-radius-card)', boxShadow: 'var(--toss-shadow-card)', overflow: 'hidden' }}>
            {loading && <LoadingState />}
            {!loading && error && <ErrorState message={error} />}
            {!loading && !error && consultations.length === 0 && <EmptyState />}
            {!loading && !error && consultations.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--toss-bg)', borderBottom: '1px solid var(--toss-border)' }}>
                      {['이름', '연락처', '유형', '상태', '담당자', '유입경로', '등록일'].map((col) => (
                        <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--toss-text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {consultations.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedConsultation(item)}
                        style={{ borderBottom: '1px solid var(--toss-border)', cursor: 'pointer', background: selectedConsultation?.id === item.id ? 'var(--toss-blue-subtle)' : 'transparent' }}
                        onMouseEnter={(e) => { if (selectedConsultation?.id !== item.id) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--toss-bg)' }}
                        onMouseLeave={(e) => { if (selectedConsultation?.id !== item.id) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--toss-text-primary)', whiteSpace: 'nowrap' }}>{item.name}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap' }}>{item.contact}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap' }}>{item.type ? CONSULTATION_TYPE_LABEL[item.type] : '-'}</td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--toss-radius-badge)', fontSize: 12, fontWeight: 600, background: CONSULTATION_STATUS_COLOR[item.status]?.bg ?? '#F9FAFB', color: CONSULTATION_STATUS_COLOR[item.status]?.text ?? '#6B7684' }}>
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap' }}>{item.manager ?? '-'}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap' }}>{item.click_source ?? '-'}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(item.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {!loading && !error && consultations.length > 0 && (
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--toss-text-secondary)', textAlign: 'right' }}>총 {consultations.length.toLocaleString()}건</p>
          )}
        </>
      )}

      {/* ===== 실습섭외신청서 탭 ===== */}
      {activeTab === 'practice' && (
        <>
          {/* 통계 카드 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <StatCard label="전체" value={practiceAppStats.total} />
            <StatCard label="완료" value={practiceAppStats.completed} color="var(--toss-blue)" />
          </div>

          {/* 검색 */}
          <div style={{ background: 'var(--toss-card-bg)', border: '1px solid var(--toss-border)', borderRadius: 'var(--toss-radius-card)', padding: '16px 20px', boxShadow: 'var(--toss-shadow-card)', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={practiceSearch}
              onChange={(e) => setPracticeSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchPracticeApplications() }}
              placeholder="이름 또는 연락처 검색"
              style={{ ...inputStyle, flex: '1 1 200px' }}
            />
            <button onClick={fetchPracticeApplications} style={{ padding: '8px 16px', background: 'var(--toss-blue)', color: '#fff', border: 'none', borderRadius: 'var(--toss-radius-button)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              검색
            </button>
          </div>

          {/* 테이블 */}
          <div style={{ background: 'var(--toss-card-bg)', border: '1px solid var(--toss-border)', borderRadius: 'var(--toss-radius-card)', boxShadow: 'var(--toss-shadow-card)', overflow: 'hidden' }}>
            {loading && <LoadingState />}
            {!loading && error && <ErrorState message={error} />}
            {!loading && !error && practiceApplications.length === 0 && <EmptyState />}
            {!loading && !error && practiceApplications.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--toss-bg)', borderBottom: '1px solid var(--toss-border)' }}>
                      {['이름', '연락처', '실습유형', '실습처', '실습시작일', '담당자', '상태', '등록일'].map((col) => (
                        <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--toss-text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {practiceApplications.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedPracticeApp(item)}
                        style={{ borderBottom: '1px solid var(--toss-border)', cursor: 'pointer', background: selectedPracticeApp?.id === item.id ? 'var(--toss-blue-subtle)' : 'transparent' }}
                        onMouseEnter={(e) => { if (selectedPracticeApp?.id !== item.id) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--toss-bg)' }}
                        onMouseLeave={(e) => { if (selectedPracticeApp?.id !== item.id) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--toss-text-primary)', whiteSpace: 'nowrap' }}>{item.student_name}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap' }}>{item.contact}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap' }}>{item.practice_type ?? '-'}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap' }}>{item.practice_place ?? '-'}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap' }}>{item.practice_start_date ?? '-'}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap' }}>{item.manager ?? '-'}</td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--toss-radius-badge)', fontSize: 12, fontWeight: 600, background: '#F0FDF4', color: '#15803D' }}>
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(item.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {!loading && !error && practiceApplications.length > 0 && (
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--toss-text-secondary)', textAlign: 'right' }}>총 {practiceApplications.length.toLocaleString()}건</p>
          )}
        </>
      )}

      {/* ===== 취업신청 탭 ===== */}
      {activeTab === 'employment' && (
        <>
          {/* 통계 카드 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <StatCard label="전체" value={employmentStats.total} />
            <StatCard label="결제완료" value={employmentStats.paid} color="#15803D" />
            <StatCard label="결제대기" value={employmentStats.pending} color="#C2410C" />
          </div>

          {/* 검색 */}
          <div style={{ background: 'var(--toss-card-bg)', border: '1px solid var(--toss-border)', borderRadius: 'var(--toss-radius-card)', padding: '16px 20px', boxShadow: 'var(--toss-shadow-card)', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={employmentSearch}
              onChange={(e) => setEmploymentSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchEmploymentApplications() }}
              placeholder="이름 또는 연락처 검색"
              style={{ ...inputStyle, flex: '1 1 200px' }}
            />
            <button onClick={fetchEmploymentApplications} style={{ padding: '8px 16px', background: 'var(--toss-blue)', color: '#fff', border: 'none', borderRadius: 'var(--toss-radius-button)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              검색
            </button>
          </div>

          {/* 테이블 */}
          <div style={{ background: 'var(--toss-card-bg)', border: '1px solid var(--toss-border)', borderRadius: 'var(--toss-radius-card)', boxShadow: 'var(--toss-shadow-card)', overflow: 'hidden' }}>
            {loading && <LoadingState />}
            {!loading && error && <ErrorState message={error} />}
            {!loading && !error && employmentApplications.length === 0 && <EmptyState />}
            {!loading && !error && employmentApplications.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--toss-bg)', borderBottom: '1px solid var(--toss-border)' }}>
                      {['이름', '연락처', '희망직무', '결제금액', '결제상태', '담당자', '유입경로', '등록일'].map((col) => (
                        <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--toss-text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employmentApplications.map((item) => {
                      const payStyle = PAYMENT_STATUS_STYLE[item.payment_status] ?? PAYMENT_STATUS_STYLE.pending
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedEmploymentApp(item)}
                          style={{ borderBottom: '1px solid var(--toss-border)', cursor: 'pointer', background: selectedEmploymentApp?.id === item.id ? 'var(--toss-blue-subtle)' : 'transparent' }}
                          onMouseEnter={(e) => { if (selectedEmploymentApp?.id !== item.id) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--toss-bg)' }}
                          onMouseLeave={(e) => { if (selectedEmploymentApp?.id !== item.id) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                        >
                          <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--toss-text-primary)', whiteSpace: 'nowrap' }}>{item.name}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap' }}>{item.contact}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap' }}>{item.desired_job_field ?? '-'}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--toss-text-primary)', whiteSpace: 'nowrap' }}>
                            {item.payment_amount ? `${item.payment_amount.toLocaleString()}원` : '-'}
                          </td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--toss-radius-badge)', fontSize: 12, fontWeight: 600, background: payStyle.bg, color: payStyle.color }}>
                              {PAYMENT_STATUS_LABEL[item.payment_status] ?? item.payment_status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap' }}>{item.manager ?? '-'}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap' }}>{item.click_source ?? '-'}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--toss-text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(item.created_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {!loading && !error && employmentApplications.length > 0 && (
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--toss-text-secondary)', textAlign: 'right' }}>총 {employmentApplications.length.toLocaleString()}건</p>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 공통 상태 컴포넌트
// ---------------------------------------------------------------------------

function LoadingState() {
  return <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--toss-text-secondary)', fontSize: 14 }}>데이터를 불러오는 중...</div>
}

function ErrorState({ message }: { message: string }) {
  return <div style={{ padding: '40px 24px', textAlign: 'center', color: '#DC2626', fontSize: 14 }}>{message}</div>
}

function EmptyState() {
  return <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--toss-text-secondary)', fontSize: 14 }}>조건에 맞는 데이터가 없습니다.</div>
}
