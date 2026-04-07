import React from 'react'
import styles from '../expenseResolution/styles.module.css'
import type { DocBodyProps, FieldDef } from '../types'
import { DateInput } from '@/components/ui/Calendar/DateInput'
import { parse, isValid, format } from 'date-fns'
import { ko } from 'date-fns/locale'

export const EXPENSE_PROPOSAL_FIELDS: FieldDef[] = [
  { key: 'belong_dept', label: '소속부서',                     type: 'text' },
  { key: 'vendor_name', label: '상호명(거래처명)',              type: 'text',     required: true },
  { key: 'payment_due', label: '지급희망일',                    type: 'date' },
  { key: 'contact',     label: '담당자 연락처',                  type: 'text' },
  { key: 'purpose',     label: '지출 건명 (품의 사유 및 내역)', type: 'textarea', required: true },
  { key: 'amount',      label: '필요금액',                      type: 'number',   required: true },
  { key: 'cost_type',   label: '비용처리',                      type: 'text' },
  { key: 'special_note',label: '특이사항',                      type: 'textarea' },
]

const COST_TYPE_OPTIONS = [
  { value: 'tax_invoice',  label: '세금계산서 (VAT 10%별도)' },
  { value: 'cash_receipt', label: '현금영수증 (지출증빙)' },
  { value: 'other',        label: '기타 (특이사항 기재)' },
]

function v(content: Record<string, unknown>, key: string): string {
  return String(content[key] ?? '')
}

function numDisplay(str: string): string {
  const n = Number(str)
  return !str || isNaN(n) || n === 0 ? '' : n.toLocaleString()
}

function formatDateKo(str: string): string {
  if (!str) return ''
  const d = parse(str, 'yyyy-MM-dd', new Date())
  return isValid(d) ? format(d, 'yyyy-MM-dd(eee)', { locale: ko }) : str
}

export function ExpenseProposalBody({ content, onChange, departments = [] }: DocBodyProps) {
  const ro = !onChange
  const costType = v(content, 'cost_type') || 'tax_invoice'

  return (
    <>
      <table className={styles.table_main}>
        <thead>
          <tr>
            <th colSpan={4} className={styles.th_title}>지출 품의 상세내용</th>
          </tr>
        </thead>
        <tbody>
          {/* 소속부서 / 상호명 */}
          <tr>
            <td className={styles.label_cell}>소속부서</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{(departments.find(d => d.id === v(content, 'belong_dept'))?.name ?? v(content, 'belong_dept')) || '-'}</span>
              ) : (
                <select className={styles.select_full}
                  value={v(content, 'belong_dept')}
                  onChange={(e) => onChange!('belong_dept', e.target.value)}>
                  <option value="">-</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}
            </td>
            <td className={styles.label_cell}>상호명(거래처명)</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, 'vendor_name') || '-'}</span>
              ) : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'vendor_name')} placeholder=""
                  onChange={(e) => onChange!('vendor_name', e.target.value)} />
              )}
            </td>
          </tr>

          {/* 지급희망일 / 담당자 연락처 */}
          <tr>
            <td className={styles.label_cell}>지급희망일</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{formatDateKo(v(content, 'payment_due')) || '-'}</span>
              ) : (
                <DateInput
                  value={v(content, 'payment_due')}
                  onChange={(val) => onChange!('payment_due', val)}
                  align="left"
                  direction="down"
                />
              )}
            </td>
            <td className={styles.label_cell}>담당자 연락처</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, 'contact') || '-'}</span>
              ) : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'contact')} placeholder="010-0000-0000"
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
                    let formatted = digits
                    if (digits.length > 7) formatted = `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`
                    else if (digits.length > 3) formatted = `${digits.slice(0,3)}-${digits.slice(3)}`
                    onChange!('contact', formatted)
                  }} />
              )}
            </td>
          </tr>

          {/* 지출 건명 */}
          <tr>
            <td className={styles.label_cell}>지출 건명<br />(품의 사유 및 내역)</td>
            <td colSpan={3} className={styles.value_cell}>
              {ro ? (
                <span className={styles.pre_wrap}>{v(content, 'purpose') || '-'}</span>
              ) : (
                <textarea className={styles.textarea_full}
                  value={v(content, 'purpose')} placeholder=""
                  onChange={(e) => onChange!('purpose', e.target.value)} />
              )}
            </td>
          </tr>

          {/* 필요금액 */}
          <tr>
            <td className={styles.label_cell}>필요금액</td>
            <td colSpan={3} className={styles.value_cell_num}>
              {ro ? (
                <span>{numDisplay(v(content, 'amount'))}</span>
              ) : (
                <input type="number" className={styles.input_num}
                  value={v(content, 'amount')} placeholder=""
                  onChange={(e) => onChange!('amount', e.target.value)} />
              )}
            </td>
          </tr>

          {/* 비용처리 */}
          <tr>
            <td className={styles.label_cell}>비용처리</td>
            <td colSpan={3} className={styles.value_cell}>
              {ro ? (
                <span>{COST_TYPE_OPTIONS.find(o => o.value === costType)?.label ?? costType}</span>
              ) : (
                <div className={styles.radio_group}>
                  {COST_TYPE_OPTIONS.map(opt => (
                    <label key={opt.value} className={styles.radio_label}>
                      <input type="radio" name="proposal_cost_type"
                        value={opt.value} checked={costType === opt.value}
                        onChange={() => onChange!('cost_type', opt.value)} />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 특이사항 */}
      <table className={styles.table_special}>
        <tbody>
          <tr>
            <td className={styles.special_label}>특이사항</td>
            <td className={styles.special_value}>
              {ro ? (
                <span className={styles.pre_wrap}>{v(content, 'special_note') || ''}</span>
              ) : (
                <textarea className={styles.textarea_full}
                  value={v(content, 'special_note')} placeholder=""
                  onChange={(e) => onChange!('special_note', e.target.value)} />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <p className={styles.note}>※ 견적서, 거래명세서, 결제영수증 등 증빙서류 필수 첨부</p>
    </>
  )
}
