import React from 'react'
import styles from '../expenseResolution/styles.module.css'
import own from '../affiliatePayment/styles.module.css'
import type { DocBodyProps, FieldDef } from '../types'
import { DateInput } from '@/components/ui/Calendar/DateInput'
import { parse, isValid, format } from 'date-fns'
import { ko } from 'date-fns/locale'

export const AFFILIATE_REFUND_FIELDS: FieldDef[] = [
  { key: 'category',       label: '구분',            type: 'text' },
  { key: 'partner_name',   label: '협약기관명',       type: 'text', required: true },
  { key: 'contact',        label: '관계자 연락수단',  type: 'text' },
  { key: 'vendor_name',    label: '상호명(거래처명)', type: 'text', required: true },
  { key: 'contract_start', label: '계약기간 시작',    type: 'date' },
  { key: 'contract_end',   label: '계약기간 종료',    type: 'date' },
  { key: 'bank_holder',    label: '은행명/입금자명',  type: 'text', required: true },
  { key: 'account_number', label: '계좌번호(-제외)',  type: 'text', required: true },
  { key: 'amount',         label: '환불금액',         type: 'number', required: true },
  { key: 'cost_type',      label: '비용처리',         type: 'text' },
  { key: 'deduction_months', label: '공제된 월',      type: 'text' },
  { key: 'special_note',   label: '특이사항',         type: 'textarea' },
]

const CATEGORY_OPTIONS = [
  { value: '네이버 카페',          label: '네이버 카페' },
  { value: '네이버 밴드',          label: '네이버 밴드' },
  { value: '다음 카페',            label: '다음 카페' },
  { value: '토스',                 label: '토스' },
  { value: '당근마켓',             label: '당근마켓' },
  { value: '기타 (특이사항 기재)', label: '기타 (특이사항 기재)' },
]

const COST_TYPE_OPTIONS = [
  { value: 'tax_invoice',  label: '세금계산서 (VAT 10%별도)' },
  { value: 'cash_receipt', label: '현금영수증 (지출증빙 / 227-88-03196)' },
  { value: 'other',        label: '기타 (특이사항 기재)' },
]

const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12]

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

function parseMonths(raw: string): number[] {
  try { return JSON.parse(raw) } catch { return [] }
}

export function AffiliateRefundBody({ content, onChange }: DocBodyProps) {
  const ro = !onChange
  const costType = v(content, 'cost_type') || 'tax_invoice'
  const selectedMonths = parseMonths(v(content, 'deduction_months'))

  function toggleMonth(m: number) {
    const next = selectedMonths.includes(m)
      ? selectedMonths.filter(x => x !== m)
      : [...selectedMonths, m].sort((a, b) => a - b)
    onChange!('deduction_months', JSON.stringify(next))
  }

  return (
    <>
      {/* ── 환불 상세내용 ── */}
      <table className={styles.table_main}>
        <thead>
          <tr>
            <th colSpan={7} className={styles.th_title}>환불 상세내용</th>
          </tr>
        </thead>
        <tbody>
          {/* 구분 / 협약기관명 / 관계자 연락수단 */}
          <tr>
            <td className={styles.label_cell}>구분</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, 'category') || '-'}</span>
              ) : (
                <select className={styles.select_full}
                  value={v(content, 'category')}
                  onChange={(e) => onChange!('category', e.target.value)}>
                  <option value="">-</option>
                  {CATEGORY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            </td>
            <td className={styles.label_cell}>협약기관명</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, 'partner_name') || '-'}</span>
              ) : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'partner_name')} placeholder=""
                  onChange={(e) => onChange!('partner_name', e.target.value)} />
              )}
            </td>
            <td className={styles.label_cell}>관계자 연락수단</td>
            <td colSpan={2} className={styles.value_cell}>
              {ro ? (
                <span>{v(content, 'contact') || '-'}</span>
              ) : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'contact')} placeholder=""
                  onChange={(e) => onChange!('contact', e.target.value)} />
              )}
            </td>
          </tr>

          {/* 상호명 / 계약기간 */}
          <tr>
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
            <td className={styles.label_cell}>계약기간</td>
            <td colSpan={4} className={styles.value_cell}>
              {ro ? (
                <span>
                  {formatDateKo(v(content, 'contract_start'))}
                  {v(content, 'contract_end') ? ` ~ ${formatDateKo(v(content, 'contract_end'))}` : ''}
                </span>
              ) : (
                <div className={own.period_row}>
                  <DateInput value={v(content, 'contract_start')}
                    onChange={(val) => onChange!('contract_start', val)}
                    align="left" direction="down" />
                  <span className={own.tilde}>~</span>
                  <DateInput value={v(content, 'contract_end')}
                    onChange={(val) => onChange!('contract_end', val)}
                    align="left" direction="down" />
                </div>
              )}
            </td>
          </tr>

          {/* 은행명/입금자명 / 계좌번호 / 환불금액 */}
          <tr>
            <td className={styles.label_cell}>은행명/입금자명</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, 'bank_holder') || '-'}</span>
              ) : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'bank_holder')} placeholder=""
                  onChange={(e) => onChange!('bank_holder', e.target.value)} />
              )}
            </td>
            <td className={styles.label_cell}>계좌번호(- 제외)</td>
            <td colSpan={2} className={styles.value_cell}>
              {ro ? (
                <span>{v(content, 'account_number') || '-'}</span>
              ) : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'account_number')} placeholder=""
                  onChange={(e) => onChange!('account_number', e.target.value)} />
              )}
            </td>
            <td className={styles.label_cell}>환불금액</td>
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
            <td colSpan={6} className={styles.value_cell}>
              {ro ? (
                <span>{COST_TYPE_OPTIONS.find(o => o.value === costType)?.label ?? costType}</span>
              ) : (
                <div className={styles.radio_group}>
                  {COST_TYPE_OPTIONS.map(opt => (
                    <label key={opt.value} className={styles.radio_label}>
                      <input type="radio" name="refund_cost_type"
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

      {/* ── 공제된 월 선택 ── */}
      <table className={own.table_section}>
        <thead>
          <tr>
            <th className={own.section_title}>공제된 월 선택</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={own.months_cell}>
              {ro ? (
                <span>{selectedMonths.length > 0 ? selectedMonths.map(m => `${m}월`).join(', ') : '-'}</span>
              ) : (
                <div className={own.months_row}>
                  {MONTHS.map(m => (
                    <label key={m} className={own.month_label}>
                      <input type="checkbox"
                        checked={selectedMonths.includes(m)}
                        onChange={() => toggleMonth(m)} />
                      {m}월
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
                <textarea className={styles.textarea_full}
                  value={v(content, 'special_note')} placeholder=""
                  onChange={(e) => onChange!('special_note', e.target.value)} />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <div className={own.notes}>
        <p>※ 제휴 계약서를 작성하여 첨부해주세요. (한평생교육 / 227-88-03196)</p>
        <p>※ 공제 적용 월 선택은 계약 기간과 관계없이 익월부터 적용됩니다.</p>
        <p>※ 입금요청 작성이 완료되면 회계팀 확인 후 월, 수, 금 입주일에 총 3번 일괄처리 되오니 양해 부탁드립니다.</p>
      </div>
    </>
  )
}
