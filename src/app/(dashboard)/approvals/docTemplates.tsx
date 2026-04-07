import React from 'react'
import styles from './page.module.css'
import type { FieldDef, DocBodyProps, DocTemplateConfig } from './templates/types'
import { AttendanceBody, ATTENDANCE_FIELDS } from './templates/attendance'
import { BusinessCardBody, BUSINESS_CARD_FIELDS } from './templates/businessCard'
import { EmployeeIdBody, EMPLOYEE_ID_FIELDS } from './templates/employeeId'
import { HandoverBody, HANDOVER_FIELDS } from './templates/handover'
import { ResignationBody, RESIGNATION_FIELDS } from './templates/resignation'
import { VacationBody, VACATION_FIELDS } from './templates/vacation'
import { BusinessTripReportBody, BUSINESS_TRIP_REPORT_FIELDS } from './templates/businessTripReport'
import { BusinessTripApplicationBody, BUSINESS_TRIP_APPLICATION_FIELDS } from './templates/businessTripApplication'
import { CorporateCardBody, CORPORATE_CARD_FIELDS } from './templates/corporateCard'
import { ExpenseResolutionBody, EXPENSE_RESOLUTION_FIELDS } from './templates/expenseResolution'
import { ExpenseProposalBody, EXPENSE_PROPOSAL_FIELDS } from './templates/expenseProposal'
import { AffiliatePaymentBody, AFFILIATE_PAYMENT_FIELDS } from './templates/affiliatePayment'
import { PointResolutionBody, POINT_RESOLUTION_FIELDS } from './templates/pointResolution'
import { AffiliateRefundBody, AFFILIATE_REFUND_FIELDS } from './templates/affiliateRefund'
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
    id: 'affiliate-refund',
    match: (doc) => doc.document_type.replace(/\s/g, '') === '[제휴]환불요청서',
    fields: AFFILIATE_REFUND_FIELDS,
    BodySection: AffiliateRefundBody,
    supportsAttachments: true,
  },
  {
    id: 'point-resolution',
    match: (doc) => doc.document_type.replace(/\s/g, '') === '[적립금]지출결의서',
    fields: POINT_RESOLUTION_FIELDS,
    BodySection: PointResolutionBody,
    supportsAttachments: true,
  },
  {
    id: 'affiliate-payment',
    match: (doc) => doc.document_type.replace(/\s/g, '') === '[제휴]입금요청서',
    fields: AFFILIATE_PAYMENT_FIELDS,
    BodySection: AffiliatePaymentBody,
    supportsAttachments: true,
  },
  {
    id: 'expense-proposal',
    match: (doc) => doc.document_type.replace(/\s/g, '') === '[품의서]지출품의서',
    fields: EXPENSE_PROPOSAL_FIELDS,
    BodySection: ExpenseProposalBody,
    supportsAttachments: true,
  },
  {
    id: 'expense-resolution',
    match: (doc) => doc.document_type.replace(/\s/g, '') === '[결의서]지출결의서',
    fields: EXPENSE_RESOLUTION_FIELDS,
    BodySection: ExpenseResolutionBody,
    supportsAttachments: true,
  },
  {
    id: 'corporate-card',
    match: (doc) => doc.document_type.replace(/\s/g, '') === '법인카드사용내역제출서',
    fields: CORPORATE_CARD_FIELDS,
    BodySection: CorporateCardBody,
    supportsAttachments: true,
  },
  {
    id: 'business-card',
    match: (doc) => doc.document_type.replace(/\s/g, '') === '명함신청서',
    fields: BUSINESS_CARD_FIELDS,
    BodySection: BusinessCardBody,
  },
  {
    id: 'resignation',
    match: (doc) => doc.document_type.replace(/\s/g, '') === '퇴사확정일요청서',
    fields: RESIGNATION_FIELDS,
    BodySection: ResignationBody,
    supportsAttachments: true,
  },
  {
    id: 'handover',
    match: (doc) => doc.document_type.replace(/\s/g, '') === '인수인계요청서',
    fields: HANDOVER_FIELDS,
    BodySection: HandoverBody,
  },
  {
    id: 'employee-id',
    match: (doc) => doc.document_type.replace(/\s/g, '') === '사원증신청서',
    fields: EMPLOYEE_ID_FIELDS,
    BodySection: EmployeeIdBody,
    supportsAttachments: true,
  },
  {
    id: 'vacation',
    match: (doc) => doc.document_type.replace(/\s/g, '') === '휴가신청서',
    fields: VACATION_FIELDS,
    BodySection: VacationBody,
    supportsAttachments: true,
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
    id: 'business-trip-application',
    match: (doc) => doc.document_type.replace(/\s/g, '') === '출장신청서',
    fields: BUSINESS_TRIP_APPLICATION_FIELDS,
    BodySection: BusinessTripApplicationBody,
    supportsAttachments: false,
  },
  {
    id: 'business-trip-report',
    match: (doc) => doc.document_type.replace(/\s/g, '') === '출장업무보고서',
    fields: BUSINESS_TRIP_REPORT_FIELDS,
    BodySection: BusinessTripReportBody,
    supportsAttachments: true,
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
  ...EMPLOYEE_ID_FIELDS,
  ...HANDOVER_FIELDS,
  ...RESIGNATION_FIELDS,
  ...VACATION_FIELDS,
  ...BUSINESS_TRIP_REPORT_FIELDS,
  ...BUSINESS_TRIP_APPLICATION_FIELDS,
  ...CORPORATE_CARD_FIELDS,
  ...EXPENSE_RESOLUTION_FIELDS,
  ...EXPENSE_PROPOSAL_FIELDS,
  ...AFFILIATE_PAYMENT_FIELDS,
  ...POINT_RESOLUTION_FIELDS,
  ...AFFILIATE_REFUND_FIELDS,
]
