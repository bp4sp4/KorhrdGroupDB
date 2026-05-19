import React, { useEffect, useState } from 'react'
import styles from './styles.module.css'
import type { DocBodyProps, FieldDef } from '../types'
import { DateInput } from '@/components/ui/Calendar/DateInput'
import { differenceInCalendarDays, parse, isValid, format } from 'date-fns'
import { ko } from 'date-fns/locale'

// 휴가 종류별 차감 단위
// - 연차: 1.0 × 일수
// - 반차: 0.5 (기간 무관 1회)
// - 경조휴가/예비군/병가: 차감 없음
export function calcLeaveDeduction(
  vacationType: string,
  start: string,
  end: string,
): number {
  if (!vacationType) return 0
  if (vacationType === '연차') {
    const days = calcDays(start, end)
    return days
  }
  if (vacationType === '반차(오전)' || vacationType === '반차(오후)') {
    return 0.5
  }
  return 0
}

export const VACATION_FIELDS: FieldDef[] = [
  {
    key: 'vacation_type', label: '휴가 종류', type: 'select', required: true,
    options: [
      { value: '연차', label: '연차' },
      { value: '반차(오전)', label: '반차(오전)' },
      { value: '반차(오후)', label: '반차(오후)' },
      { value: '경조휴가', label: '경조휴가' },
      { value: '예비군', label: '예비군' },
      { value: '병가', label: '병가' },
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
  const rawDays = calcDays(start, end)
  const vacationType = v(content, 'vacation_type')
  const deduction = calcLeaveDeduction(vacationType, start, end)
  // 반차는 0.5일, 그 외는 실제 캘린더 일수
  const isHalfDay = vacationType === '반차(오전)' || vacationType === '반차(오후)'
  const days = isHalfDay ? 0.5 : rawDays
  const daysLabel = isHalfDay ? '0.5일' : `${rawDays}일`

  // 본인 휴가 잔여 (작성 모드에서만 fetch)
  const [balance, setBalance] = useState<number | null>(null)
  useEffect(() => {
    if (ro) return
    fetch('/api/leave-balances/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.balance === 'number') setBalance(data.balance)
      })
      .catch(() => {})
  }, [ro])

  // 반차 선택 시 종료일을 시작일로 자동 동기화 (작성 모드 전용)
  useEffect(() => {
    if (ro) return
    if (!isHalfDay) return
    if (!start) return
    if (end !== start) onChange!('vacation_end', start)
  }, [isHalfDay, start, end, ro, onChange])

  const periodDisplay = (() => {
    if (!start) return '-'
    const s = formatDateKo(start)
    const e = formatDateKo(end)
    const suffix = days > 0 ? `  사용일수: ${daysLabel}` : ''
    if (!e) return `${s}${suffix}`
    return `${s} ~ ${e}${suffix}`
  })()

  return (
    <>
      {/* 작성 모드일 때만 잔여 휴가 박스 표시 */}
      {!ro && (
        <div className={styles.balance_box}>
          <div className={styles.balance_row}>
            <span className={styles.balance_label}>현재 휴가 잔여</span>
            <strong className={styles.balance_value}>
              {balance != null ? `${balance.toFixed(1)}일` : '조회 중...'}
            </strong>
          </div>
          {deduction > 0 && (
            <div className={styles.balance_row}>
              <span className={styles.balance_label}>이 신청서 차감 예정</span>
              <strong className={styles.balance_deduct}>
                -{deduction.toFixed(1)}일
              </strong>
            </div>
          )}
          {deduction > 0 && balance != null && (
            <div className={styles.balance_row}>
              <span className={styles.balance_label}>승인 후 잔여</span>
              <strong
                className={
                  balance - deduction < 0
                    ? styles.balance_warn
                    : styles.balance_value
                }
              >
                {(balance - deduction).toFixed(1)}일
              </strong>
            </div>
          )}
          {deduction === 0 && vacationType && (
            <div className={styles.balance_hint}>
              {vacationType}은(는) 휴가 일수가 차감되지 않습니다.
            </div>
          )}
          {balance != null && deduction > balance && (
            <div className={styles.balance_warn_msg}>
              ⚠️ 잔여 휴가({balance.toFixed(1)}일)보다 신청한 일수가 많습니다.
            </div>
          )}
        </div>
      )}

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
                  <option value="반차(오전)">반차(오전)</option>
                  <option value="반차(오후)">반차(오후)</option>
                  <option value="경조휴가">경조휴가</option>
                  <option value="예비군">예비군</option>
                  <option value="병가">병가</option>
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
                    onChange={(val) => {
                      onChange!('vacation_start', val)
                      // 반차면 종료일도 즉시 동일하게 동기화
                      if (isHalfDay) onChange!('vacation_end', val)
                    }}
                  />
                  <span className={styles.tilde}>~</span>
                  <DateInput
                    value={end}
                    onChange={(val) => onChange!('vacation_end', val)}
                    disabled={isHalfDay}
                  />
                  {days > 0 && (
                    <span className={styles.days_badge}>사용일수: {daysLabel}</span>
                  )}
                  {isHalfDay && (
                    <span className={styles.half_day_hint}>
                      반차는 당일만 신청 가능합니다.
                    </span>
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
        <p>
          <strong>※ 경조휴가 / 예비군 / 병가는 증빙 서류 첨부파일이 필수입니다.</strong>
        </p>
        <p>[예비군 신청시] 통지서 스캔하여 파일 첨부</p>
        <p>[경조휴가 신청시] 증빙서류 스캔하여 파일 첨부 (예: 청첩장 등본 등)</p>
        <p>[병가 신청시] 진단서/소견서 스캔하여 파일 첨부</p>
      </div>
    </>
  )
}
