import React from 'react'
import styles from './styles.module.css'
import type { DocBodyProps, FieldDef } from '../types'

export const EXPENSE_RESOLUTION_FIELDS: FieldDef[] = [
  { key: 'belong_dept',    label: '소속부서',           type: 'text' },
  { key: 'vendor_name',    label: '상호명(거래처명)',    type: 'text',   required: true },
  { key: 'vendor_phone',   label: '거래처 담당 전화번호', type: 'text' },
  { key: 'detail',         label: '상세내역',            type: 'text',   required: true },
  { key: 'bank_name',      label: '은행명',              type: 'text',   required: true },
  { key: 'account_number', label: '계좌번호(-제외)',     type: 'text',   required: true },
  { key: 'account_holder', label: '예금자명',            type: 'text',   required: true },
  { key: 'amount',         label: '요청금액',            type: 'number', required: true },
  { key: 'cost_type',      label: '비용처리',            type: 'text' },
  { key: 'special_note',   label: '특이사항',            type: 'textarea' },
]

const COST_TYPE_OPTIONS = [
  { value: 'tax_invoice',  label: '세금계산서 (VAT 10%별도)' },
  { value: 'cash_receipt', label: '현금영수증 (지출증빙 / 227-88-03196)' },
  { value: 'other',        label: '기타 (특이사항 기재)' },
]

function v(content: Record<string, unknown>, key: string): string {
  return String(content[key] ?? '')
}

function numDisplay(str: string): string {
  const n = Number(str)
  return !str || isNaN(n) || n === 0 ? '' : n.toLocaleString()
}

export function ExpenseResolutionBody({ content, onChange, departments = [] }: DocBodyProps) {
  const ro = !onChange

  const costType = v(content, 'cost_type') || 'tax_invoice'

  return (
    <>
      {/* ── 입금요청 상세내용 ── */}
      <table className={styles.table_main}>
        <thead>
          <tr>
            <th colSpan={4} className={styles.th_title}>입금요청 상세내용</th>
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
                <select
                  className={styles.select_full}
                  value={v(content, 'belong_dept')}
                  onChange={(e) => onChange!('belong_dept', e.target.value)}
                >
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

          {/* 거래처 담당 전화번호 / 상세내역 */}
          <tr>
            <td className={styles.label_cell}>거래처 담당 전화번호</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, 'vendor_phone') || '-'}</span>
              ) : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'vendor_phone')} placeholder="010-0000-0000"
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
                    let formatted = digits
                    if (digits.length > 7) formatted = `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`
                    else if (digits.length > 3) formatted = `${digits.slice(0,3)}-${digits.slice(3)}`
                    onChange!('vendor_phone', formatted)
                  }} />
              )}
            </td>
            <td className={styles.label_cell}>상세내역</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, 'detail') || '-'}</span>
              ) : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'detail')} placeholder=""
                  onChange={(e) => onChange!('detail', e.target.value)} />
              )}
            </td>
          </tr>

          {/* 은행명 / 계좌번호 */}
          <tr>
            <td className={styles.label_cell}>은행명</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, 'bank_name') || '-'}</span>
              ) : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'bank_name')} placeholder=""
                  onChange={(e) => onChange!('bank_name', e.target.value)} />
              )}
            </td>
            <td className={styles.label_cell}>계좌번호 (- 제외)</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, 'account_number') || '-'}</span>
              ) : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'account_number')} placeholder=""
                  onChange={(e) => onChange!('account_number', e.target.value)} />
              )}
            </td>
          </tr>

          {/* 예금자명 / 요청금액 */}
          <tr>
            <td className={styles.label_cell}>예금자명</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, 'account_holder') || '-'}</span>
              ) : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'account_holder')} placeholder=""
                  onChange={(e) => onChange!('account_holder', e.target.value)} />
              )}
            </td>
            <td className={styles.label_cell}>요청금액</td>
            <td className={styles.value_cell_num}>
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
                      <input
                        type="radio"
                        name="cost_type"
                        value={opt.value}
                        checked={costType === opt.value}
                        onChange={() => onChange!('cost_type', opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── 특이사항 ── */}
      <table className={styles.table_special}>
        <tbody>
          <tr>
            <td className={styles.special_label}>특이사항</td>
            <td className={styles.special_value}>
              {ro ? (
                <span className={styles.pre_wrap}>{v(content, 'special_note') || ''}</span>
              ) : (
                <textarea
                  className={styles.textarea_full}
                  value={v(content, 'special_note')}
                  placeholder=""
                  onChange={(e) => onChange!('special_note', e.target.value)}
                />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <p className={styles.note}>※ 문자/고지서/이메일 청구서 수령 여부 사진 첨부</p>
    </>
  )
}
