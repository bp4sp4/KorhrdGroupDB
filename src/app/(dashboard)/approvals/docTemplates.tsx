import React from 'react'
import styles from './page.module.css'
import type { FieldDef, DocBodyProps, DocTemplateConfig } from './templates/types'
import { AttendanceBody, ATTENDANCE_FIELDS } from './templates/attendance'
import { BusinessCardBody, BUSINESS_CARD_FIELDS } from './templates/businessCard'
import { DateInput } from '@/components/ui/Calendar/DateInput'

export type { FieldDef, DocBodyProps, DocTemplateConfig }

// ─────────────────────────────────────────────────────────────────────────────
// 공통 유틸
// ─────────────────────────────────────────────────────────────────────────────

function v(content: Record<string, unknown>, key: string): string {
  return String(content[key] ?? '')
}

// ─────────────────────────────────────────────────────────────────────────────
// 제네릭 바디 팩토리 (2컬럼 기본 레이아웃)
// ─────────────────────────────────────────────────────────────────────────────

function makeGenericBody(fields: FieldDef[]): React.FC<DocBodyProps> {
  return function GenericBody({ content, onChange }) {
    const ro = !onChange
    return (
      <table className={styles.doc_body_table}>
        <tbody>
          {fields.map((f) => {
            const value = v(content, f.key)
            return (
              <tr key={f.key}>
                <td
                  className={`${styles.doc_field_label}${!ro && f.required ? ` ${styles.doc_field_label_required}` : ''}`}
                >
                  {f.label}
                </td>
                <td>
                  {ro ? (
                    <span
                      className={`${styles.doc_field_value_text}${f.type === 'textarea' ? ` ${styles.doc_field_value_prewrap}` : ''}`}
                    >
                      {value || '-'}
                    </span>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      className={styles.doc_body_textarea}
                      value={value}
                      placeholder={`${f.label} 입력`}
                      onChange={(e) => onChange!(f.key, e.target.value)}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      className={styles.doc_body_select}
                      value={value}
                      onChange={(e) => onChange!(f.key, e.target.value)}
                    >
                      <option value="">선택</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.type === 'date' ? (
                    <DateInput
                      value={value}
                      onChange={(v) => onChange!(f.key, v)}
                    />
                  ) : (
                    <input
                      type={f.type}
                      className={styles.doc_body_input}
                      value={value}
                      placeholder={`${f.label} 입력`}
                      onChange={(e) => onChange!(f.key, e.target.value)}
                    />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 회계 템플릿
// ─────────────────────────────────────────────────────────────────────────────

const EXPENSE_FIELDS: FieldDef[] = [
  { key: 'expense_date', label: '지출일', type: 'date', required: true },
  { key: 'expense_category', label: '지출 항목', type: 'text', required: true },
  { key: 'expense_detail', label: '세부 내역', type: 'text', required: true },
  { key: 'amount', label: '금액 (원)', type: 'number', required: true },
  {
    key: 'payment_method', label: '결제 수단', type: 'select', required: true,
    options: [
      { value: 'CORPORATE_CARD', label: '법인카드' },
      { value: 'BANK_TRANSFER', label: '계좌이체' },
      { value: 'CASH', label: '현금' },
      { value: 'OTHER', label: '기타' },
    ],
  },
  { key: 'vendor', label: '거래처', type: 'text' },
  { key: 'memo', label: '메모', type: 'textarea' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 출장 템플릿
// ─────────────────────────────────────────────────────────────────────────────

const TRAVEL_FIELDS: FieldDef[] = [
  { key: 'travel_start', label: '출발일', type: 'date', required: true },
  { key: 'travel_end', label: '복귀일', type: 'date', required: true },
  { key: 'destination', label: '목적지', type: 'text', required: true },
  { key: 'purpose', label: '출장 목적', type: 'text', required: true },
  { key: 'amount', label: '예상 경비 (원)', type: 'number' },
  { key: 'memo', label: '비고', type: 'textarea' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 인사 기본 템플릿
// ─────────────────────────────────────────────────────────────────────────────

const HR_FIELDS: FieldDef[] = [
  { key: 'reason', label: '사유', type: 'text', required: true },
  { key: 'start_date', label: '시작일', type: 'date', required: true },
  { key: 'end_date', label: '종료일', type: 'date' },
  { key: 'memo', label: '비고', type: 'textarea' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 레지스트리 — 새 문서 타입은 여기에만 추가
// ─────────────────────────────────────────────────────────────────────────────

export const DOC_TEMPLATE_REGISTRY: DocTemplateConfig[] = [
  {
    id: 'business-card',
    match: (doc) => doc.document_type.replace(/\s/g, '') === '명함신청서',
    fields: BUSINESS_CARD_FIELDS,
    BodySection: BusinessCardBody,
  },
  {
    id: 'attendance',
    match: (doc) => {
      const t = doc.document_type.replace(/\s/g, '')
      return t === '근태사유서' || doc.category === '근태'
    },
    fields: ATTENDANCE_FIELDS,
    BodySection: AttendanceBody,
    supportsAttachments: true,
  },
  {
    id: 'expense',
    match: (doc) => doc.category === '회계',
    fields: EXPENSE_FIELDS,
    BodySection: makeGenericBody(EXPENSE_FIELDS),
  },
  {
    id: 'travel',
    match: (doc) => doc.category === '출장',
    fields: TRAVEL_FIELDS,
    BodySection: makeGenericBody(TRAVEL_FIELDS),
  },
  {
    id: 'hr',
    match: () => true, // 위에서 매칭 안 된 경우 폴백
    fields: HR_FIELDS,
    BodySection: makeGenericBody(HR_FIELDS),
  },
]

export function getDocTemplate(
  doc: { document_type: string; category?: string } | null
): DocTemplateConfig | null {
  if (!doc) return null
  return DOC_TEMPLATE_REGISTRY.find((c) => c.match(doc)) ?? null
}

/** 모든 템플릿 필드 목록 (레이블 조회용) */
export const ALL_TEMPLATE_FIELDS: FieldDef[] = [
  ...EXPENSE_FIELDS,
  ...TRAVEL_FIELDS,
  ...HR_FIELDS,
  ...ATTENDANCE_FIELDS,
  ...BUSINESS_CARD_FIELDS,
]
