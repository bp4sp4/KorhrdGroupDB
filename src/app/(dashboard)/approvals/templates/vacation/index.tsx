import React from 'react'
import styles from './styles.module.css'
import type { DocBodyProps, FieldDef } from '../types'
import { DateInput } from '@/components/ui/Calendar/DateInput'
import { differenceInCalendarDays, parse, isValid, format } from 'date-fns'
import { ko } from 'date-fns/locale'

export const VACATION_FIELDS: FieldDef[] = [
  {
    key: 'vacation_type', label: '휴가 종류', type: 'select', required: true,
    options: [
      { value: '연차', label: '연차' },
      { value: '월차', label: '월차' },
      { value: '반차(오전)', label: '반차(오전)' },
      { value: '반차(오후)', label: '반차(오후)' },
      { value: '경조휴가', label: '경조휴가' },
      { value: '예비군', label: '예비군' },
      { value: '민방위', label: '민방위' },
      { value: '기타', label: '기타' },
    ],
  },
  { key: 'vacation_start', label: '휴가 시작일', type: 'date', required: true },
  { key: 'vacation_end',   label: '휴가 종료일', type: 'date', required: true },
  { key: 'vacation_reason', label: '휴가 사유', type: 'textarea', required: true },
]

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
  if (!d) return ''
  return format(d, 'yyyy-MM-dd(eee)', { locale: ko })
}

function calcDays(start: string, end: string): number {
  const s = parseDate(start)
  const e = parseDate(end)
  if (!s || !e) return 0
  return Math.max(0, differenceInCalendarDays(e, s) + 1)
}

export function VacationBody({ content, onChange }: DocBodyProps) {
  const ro = !onChange

  const start = v(content, 'vacation_start')
  const end   = v(content, 'vacation_end')
  const days  = calcDays(start, end)

  const periodDisplay = (() => {
    if (!start) return '-'
    const s = formatDateKo(start)
    const e = formatDateKo(end)
    const suffix = days > 0 ? `  사용일수: ${days}일` : ''
    if (!e) return `${s}${suffix}`
    return `${s} ~ ${e}${suffix}`
  })()

  return (
    <>
      <table className={styles.table_main}>
        <tbody>
          <tr>
            <td className={styles.label_cell}>
              {!ro && <span className={styles.required}>*</span>}휴가 종류
            </td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, 'vacation_type') || '-'}</span>
              ) : (
                <select
                  className={styles.select_full}
                  value={v(content, 'vacation_type')}
                  onChange={(e) => onChange!('vacation_type', e.target.value)}
                >
                  <option value="">선택</option>
                  <option value="연차">연차</option>
                  <option value="월차">월차</option>
                  <option value="반차(오전)">반차(오전)</option>
                  <option value="반차(오후)">반차(오후)</option>
                  <option value="경조휴가">경조휴가</option>
                  <option value="예비군">예비군</option>
                  <option value="민방위">민방위</option>
                  <option value="기타">기타</option>
                </select>
              )}
            </td>
          </tr>
          <tr>
            <td className={styles.label_cell}>
              {!ro && <span className={styles.required}>*</span>}휴가 기간
            </td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{periodDisplay}</span>
              ) : (
                <div className={styles.period_row}>
                  <DateInput
                    value={start}
                    onChange={(val) => onChange!('vacation_start', val)}
                  />
                  <span className={styles.tilde}>~</span>
                  <DateInput
                    value={end}
                    onChange={(val) => onChange!('vacation_end', val)}
                  />
                  {days > 0 && (
                    <span className={styles.days_badge}>사용일수: {days}일</span>
                  )}
                </div>
              )}
            </td>
          </tr>
          <tr>
            <td className={`${styles.label_cell} ${styles.label_cell_top}`}>
              {!ro && <span className={styles.required}>*</span>}휴가 사유
            </td>
            <td className={styles.value_cell}>
              {ro ? (
                <span className={styles.pre_wrap}>{v(content, 'vacation_reason') || '-'}</span>
              ) : (
                <textarea
                  className={styles.textarea_full}
                  value={v(content, 'vacation_reason')}
                  placeholder="휴가 사유를 입력하세요"
                  onChange={(e) => onChange!('vacation_reason', e.target.value)}
                />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <div className={styles.notes}>
        <p>[예비군/민방위 신청시] 통지서 스캔하여 파일 첨부</p>
        <p>[경조휴가 신청시] 증빙서류 스캔하여 파일 첨부 (예: 청첩장 등본 등)</p>
      </div>
    </>
  )
}
