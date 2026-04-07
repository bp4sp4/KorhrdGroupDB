import React from 'react'
import styles from './styles.module.css'
import type { DocBodyProps, FieldDef } from '../types'
import { DateInput } from '@/components/ui/Calendar/DateInput'
import { parse, isValid, format } from 'date-fns'
import { ko } from 'date-fns/locale'

export const BUSINESS_TRIP_REPORT_FIELDS: FieldDef[] = [
  { key: 'trip_start',    label: '출장 시작일', type: 'date',     required: true },
  { key: 'trip_end',      label: '출장 종료일', type: 'date',     required: true },
  { key: 'trip_region',   label: '출장지역',    type: 'text',     required: true },
  { key: 'trip_org',      label: '방문기관',    type: 'text',     required: true },
  { key: 'trip_purpose',  label: '출장목적',    type: 'text',     required: true },
  { key: 'trip_persons',  label: '출장자',      type: 'text',     required: true },
  { key: 'trip_content',  label: '출장 내용',   type: 'text',     required: true },
  { key: 'trip_result',   label: '출장 결과',   type: 'textarea', required: true },
  { key: 'expense_items', label: '경비 내역',   type: 'text' },
]

interface ExpenseItem { name: string; amount: string; note: string }

function v(content: Record<string, unknown>, key: string): string {
  return String(content[key] ?? '')
}

function parseDate(str: string): Date | undefined {
  if (!str) return undefined
  const d = parse(str, 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : undefined
}

function formatDateKo(str: string): string {
  const d = parseDate(str)
  return d ? format(d, 'yyyy-MM-dd(eee)', { locale: ko }) : ''
}

function numDisplay(str: string): string {
  const n = Number(str)
  return !str || isNaN(n) || n === 0 ? '' : n.toLocaleString()
}

function parseJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) } catch { return fallback }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size))
  return rows.length > 0 ? rows : [[]]
}

const PERSON_COLS = 4

export function BusinessTripReportBody({ content, onChange }: DocBodyProps) {
  const ro = !onChange

  const start = v(content, 'trip_start')
  const end   = v(content, 'trip_end')

  const periodDisplay = (() => {
    if (!start) return '-'
    const s = formatDateKo(start)
    const e = formatDateKo(end)
    return e ? `${s} ~ ${e}` : s
  })()

  // ── 출장자 ──
  const persons: string[] = (() => {
    const parsed = parseJson<string[]>(v(content, 'trip_persons'), [])
    return !ro && parsed.length === 0 ? ['', '', '', ''] : parsed
  })()

  function updatePersons(next: string[]) {
    onChange!('trip_persons', JSON.stringify(next))
  }

  // ── 경비 ──
  const expenseItems: ExpenseItem[] = (() => {
    const parsed = parseJson<ExpenseItem[]>(v(content, 'expense_items'), [])
    return !ro && parsed.length === 0 ? [{ name: '', amount: '', note: '' }] : parsed
  })()

  function updateExpenses(next: ExpenseItem[]) {
    onChange!('expense_items', JSON.stringify(next))
  }

  const visiblePersons  = ro ? persons.filter(p => p.trim()) : persons
  const visibleExpenses = ro ? expenseItems.filter(e => e.name || e.amount || e.note) : expenseItems

  return (
    <>
      {/* ── 출장 정보 ── */}
      <p className={styles.section_title}>출장 정보</p>
      <table className={styles.table_info}>
        <tbody>
          <tr>
            <td className={styles.label_cell}>출장기간</td>
            <td className={styles.value_cell}>
              {ro ? <span>{periodDisplay}</span> : (
                <div className={styles.period_row}>
                  <DateInput value={start} onChange={(val) => onChange!('trip_start', val)} />
                  <span className={styles.tilde}>~</span>
                  <DateInput value={end} onChange={(val) => onChange!('trip_end', val)} />
                </div>
              )}
            </td>
            <td className={styles.label_cell}>출장지역</td>
            <td className={styles.value_cell}>
              {ro ? <span>{v(content, 'trip_region') || '-'}</span> : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'trip_region')} placeholder="출장지역"
                  onChange={(e) => onChange!('trip_region', e.target.value)} />
              )}
            </td>
          </tr>
          <tr>
            <td className={styles.label_cell}>방문기관</td>
            <td colSpan={3} className={styles.value_cell}>
              {ro ? <span>{v(content, 'trip_org') || '-'}</span> : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'trip_org')} placeholder="방문기관명"
                  onChange={(e) => onChange!('trip_org', e.target.value)} />
              )}
            </td>
          </tr>
          <tr>
            <td className={styles.label_cell}>출장목적</td>
            <td colSpan={3} className={styles.value_cell}>
              {ro ? <span>{v(content, 'trip_purpose') || '-'}</span> : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'trip_purpose')} placeholder="출장 목적 입력"
                  onChange={(e) => onChange!('trip_purpose', e.target.value)} />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── 출장자 정보 ── */}
      <p className={`${styles.section_title} ${styles.section_title_mt}`}>출장자 정보</p>
      <table className={styles.table_persons}>
        <thead>
          <tr>
            {Array.from({ length: PERSON_COLS }).map((_, i) => (
              <th key={i} className={styles.th_person}>성명 / 직급</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chunk(visiblePersons, PERSON_COLS).map((row, rowIdx) => (
            <tr key={rowIdx}>
              {row.map((person, colIdx) => {
                const idx = rowIdx * PERSON_COLS + colIdx
                return (
                  <td key={colIdx} className={styles.td_person}>
                    {ro ? (
                      <span>{person}</span>
                    ) : (
                      <div className={styles.person_item}>
                        <input
                          type="text"
                          className={styles.person_input}
                          value={person}
                          placeholder="홍길동 / 대리"
                          onChange={(e) => updatePersons(persons.map((p, i) => i === idx ? e.target.value : p))}
                        />
                        <button
                          type="button"
                          className={styles.btn_del}
                          onClick={() => {
                            const next = persons.filter((_, i) => i !== idx)
                            updatePersons(next.length >= 4 ? next : [...next, ...Array(4 - next.length).fill('')])
                          }}
                          aria-label="삭제"
                        >×</button>
                      </div>
                    )}
                  </td>
                )
              })}
              {/* 마지막 행 빈 셀 채우기 */}
              {Array.from({ length: PERSON_COLS - row.length }).map((_, i) => (
                <td key={`empty-${i}`} className={styles.td_person} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!ro && (
        <button type="button" className={styles.btn_add}
          onClick={() => updatePersons([...persons, ''])}>
          + 출장자 추가
        </button>
      )}

      {/* ── 출장 상세 내용 ── */}
      <p className={`${styles.section_title} ${styles.section_title_mt}`}>출장 상세 내용</p>
      <table className={styles.table_detail}>
        <tbody>
          <tr>
            <td className={styles.label_cell}>출장 내용</td>
            <td className={styles.value_cell}>
              {ro ? <span>{v(content, 'trip_content') || '-'}</span> : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'trip_content')} placeholder="출장 내용 요약"
                  onChange={(e) => onChange!('trip_content', e.target.value)} />
              )}
            </td>
          </tr>
          <tr>
            <td className={`${styles.label_cell} ${styles.label_cell_top}`}>출장 결과</td>
            <td className={styles.value_cell}>
              {ro ? <span className={styles.pre_wrap}>{v(content, 'trip_result') || '-'}</span> : (
                <textarea className={styles.textarea_full}
                  value={v(content, 'trip_result')} placeholder="출장 결과를 입력하세요"
                  onChange={(e) => onChange!('trip_result', e.target.value)} />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── 출장 시 사용 경비 ── */}
      <p className={`${styles.section_title} ${styles.section_title_mt}`}>출장 시 사용 경비</p>
      <table className={styles.table_expense}>
        <thead>
          <tr>
            <th className={styles.expense_th_name}>구분</th>
            <th className={styles.expense_th_amt}>금액</th>
            <th className={styles.expense_th_note}>특이사항</th>
          </tr>
        </thead>
        <tbody>
          {visibleExpenses.map((item, idx) => (
            <tr key={idx}>
              <td className={styles.expense_name}>
                {ro ? <span>{item.name}</span> : (
                  <input type="text" className={styles.input_full}
                    value={item.name} placeholder="항목명"
                    onChange={(e) => updateExpenses(expenseItems.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} />
                )}
              </td>
              <td className={styles.expense_amt}>
                {ro ? <span>{numDisplay(item.amount)}</span> : (
                  <input type="number" className={styles.input_num}
                    value={item.amount} placeholder="0"
                    onChange={(e) => updateExpenses(expenseItems.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))} />
                )}
              </td>
              <td className={styles.expense_note}>
                {ro ? <span>{item.note}</span> : (
                  <div className={styles.note_row}>
                    <input type="text" className={styles.input_full}
                      value={item.note} placeholder=""
                      onChange={(e) => updateExpenses(expenseItems.map((x, i) => i === idx ? { ...x, note: e.target.value } : x))} />
                    <button type="button" className={styles.btn_del}
                      onClick={() => {
                        const next = expenseItems.filter((_, i) => i !== idx)
                        updateExpenses(next.length > 0 ? next : [{ name: '', amount: '', note: '' }])
                      }}
                      aria-label="삭제">×</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!ro && (
        <button type="button" className={styles.btn_add}
          onClick={() => updateExpenses([...expenseItems, { name: '', amount: '', note: '' }])}>
          + 항목 추가
        </button>
      )}

      <p className={styles.note}>※ 사용한 경비는 영수증 필참</p>
    </>
  )
}
