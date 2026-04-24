import React from 'react'
import styles from './styles.module.css'
import type { DocBodyProps, FieldDef } from '../types'
import { DateInput } from '@/components/ui/Calendar/DateInput'
import { parse, isValid, format } from 'date-fns'
import { ko } from 'date-fns/locale'

export { ExpenseProofPanel } from './ExpenseProofPanel'
export type { CardItemLike } from './ExpenseProofPanel'

/** 외부에서 content → card_items 파싱하여 패널로 넘길 때 사용 */
export function parseCardItems(content: Record<string, unknown>): Array<{ date: string; amount: string; merchant?: string }> {
  const raw = String(content['card_items'] ?? '')
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const CORPORATE_CARD_FIELDS: FieldDef[] = [
  { key: 'card_items', label: '사용내역', type: 'text', required: true },
]

interface CardItem {
  date: string
  card_last4: string
  dept: string
  user: string
  merchant: string
  detail: string
  amount: string
}

const DEFAULT_ROWS = 10

function emptyItem(): CardItem {
  return { date: '', card_last4: '', dept: '', user: '', merchant: '', detail: '', amount: '' }
}

function v(content: Record<string, unknown>, key: string): string {
  return String(content[key] ?? '')
}

function parseJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) } catch { return fallback }
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

export function CorporateCardBody({ content, onChange, departments = [] }: DocBodyProps) {
  const ro = !onChange

  const items: CardItem[] = (() => {
    const parsed = parseJson<CardItem[]>(v(content, 'card_items'), [])
    if (!ro && parsed.length < DEFAULT_ROWS) {
      return [...parsed, ...Array(DEFAULT_ROWS - parsed.length).fill(null).map(emptyItem)]
    }
    return parsed
  })()

  function updateItems(next: CardItem[]) {
    onChange!('card_items', JSON.stringify(next))
  }

  function updateItem(idx: number, field: keyof CardItem, value: string) {
    updateItems(items.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const total = items.reduce((sum, item) => {
    const n = Number(item.amount)
    return sum + (isNaN(n) ? 0 : n)
  }, 0)

  const visibleItems = ro
    ? items.filter(item => item.date || item.card_last4 || item.merchant || item.amount)
    : items

  return (
    <>
      <table className={styles.table_main}>
        <thead>
          <tr>
            <th className={styles.th_date}>결제일</th>
            <th className={styles.th_card}>카드번호 뒷 4자리</th>
            <th className={styles.th_dept}>사용부서</th>
            <th className={styles.th_user}>사용자</th>
            <th className={styles.th_merchant}>상호명(거래처명)</th>
            <th className={styles.th_detail}>세부내용</th>
            <th className={styles.th_amount}>금액</th>
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((item, idx) => (
            <tr key={idx}>
              <td className={styles.td_date}>
                {ro ? (
                  <span>{formatDateKo(item.date)}</span>
                ) : (
                  <DateInput
                    value={item.date}
                    onChange={(val) => updateItem(idx, 'date', val)}
                    align="left"
                    direction="down"
                  />
                )}
              </td>
              <td className={styles.td_card}>
                {ro ? <span>{item.card_last4}</span> : (
                  <input
                    type="text"
                    className={styles.input_center}
                    value={item.card_last4}
                    maxLength={4}
                    placeholder="0000"
                    onChange={(e) => updateItem(idx, 'card_last4', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                )}
              </td>
              <td className={styles.td_dept}>
                {ro ? (
                  <span>{(departments.find(d => d.id === item.dept)?.name ?? item.dept) || '-'}</span>
                ) : (
                  <select
                    className={styles.select_full}
                    value={item.dept}
                    onChange={(e) => updateItem(idx, 'dept', e.target.value)}
                  >
                    <option value="">-</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                )}
              </td>
              <td className={styles.td_user}>
                {ro ? <span>{item.user}</span> : (
                  <input type="text" className={styles.input_full}
                    value={item.user} placeholder=""
                    onChange={(e) => updateItem(idx, 'user', e.target.value)} />
                )}
              </td>
              <td className={styles.td_merchant}>
                {ro ? <span>{item.merchant}</span> : (
                  <input type="text" className={styles.input_full}
                    value={item.merchant} placeholder=""
                    onChange={(e) => updateItem(idx, 'merchant', e.target.value)} />
                )}
              </td>
              <td className={styles.td_detail}>
                {ro ? <span>{item.detail}</span> : (
                  <input type="text" className={styles.input_full}
                    value={item.detail} placeholder=""
                    onChange={(e) => updateItem(idx, 'detail', e.target.value)} />
                )}
              </td>
              <td className={styles.td_amount}>
                {ro ? <span>{numDisplay(item.amount)}</span> : (
                  <input type="number" className={styles.input_num}
                    value={item.amount} placeholder=""
                    onChange={(e) => updateItem(idx, 'amount', e.target.value)} />
                )}
              </td>
            </tr>
          ))}
          <tr className={styles.total_row}>
            <td colSpan={6} className={styles.total_label}>합 계</td>
            <td className={styles.total_amount}>{total.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      {!ro && (
        <button type="button" className={styles.btn_add_row}
          onClick={() => updateItems([...items, emptyItem()])}>
          + 행 추가
        </button>
      )}

      <div className={styles.notes}>
        <p className={styles.notes_title}>※ 제출 안내</p>
        <p>- 법인카드 사용 영수증은 반드시 전자결재에 첨부파일로 업로드해 주세요. (스캔 또는 사진 가능)</p>
        <p>- 결제한 해당 월의 사용내역은 그 달 안에 제출해 주시기 바랍니다.</p>
      </div>
    </>
  )
}
