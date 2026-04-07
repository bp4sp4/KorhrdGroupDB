import React from 'react'
import styles from './styles.module.css'
import type { DocBodyProps, FieldDef } from '../types'
import { DateInput } from '@/components/ui/Calendar/DateInput'

export const RESIGNATION_FIELDS: FieldDef[] = [
  { key: 'dept',             label: '사업단/부서',       type: 'text',     required: true },
  { key: 'hire_date',        label: '입사일자',          type: 'date',     required: true },
  { key: 'handover_start',   label: '인수인계 시작일',   type: 'date',     required: true },
  { key: 'handover_end',     label: '인수인계 종료일',   type: 'date',     required: true },
  { key: 'contact_after',    label: '퇴사 후 연락처',    type: 'text',     required: true },
  { key: 'reason',           label: '퇴사사유',          type: 'text',     required: true },
  { key: 'check_student',    label: '학생관리파일',       type: 'text' },
  { key: 'check_db',         label: 'DB관리파일',        type: 'text' },
  { key: 'check_plan',       label: '학습플랜',          type: 'text' },
  { key: 'check_sales',      label: '매출파일',          type: 'text' },
  { key: 'check_kakao',      label: '카톡 캡처본',       type: 'text' },
  { key: 'handover_content', label: '업무 인수인계 내용', type: 'textarea', required: true },
]

const CHECK_ITEMS = [
  { key: 'check_student', label: '학생관리파일' },
  { key: 'check_db',      label: '영업 및 상담용 DB관리파일' },
  { key: 'check_plan',    label: '학습플랜' },
  { key: 'check_sales',   label: '근무 중 모든 매출파일' },
  { key: 'check_kakao',   label: '전 학생 카톡 캡처본' },
]

function v(content: Record<string, unknown>, key: string): string {
  return String(content[key] ?? '')
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

export function ResignationBody({ content, onChange, departments = [] }: DocBodyProps) {
  const ro = !onChange
  const deptName = departments.find(d => d.id === v(content, 'dept'))?.name ?? v(content, 'dept')

  const handoverPeriod = (() => {
    const s = v(content, 'handover_start')
    const e = v(content, 'handover_end')
    if (!s && !e) return '-'
    if (!e) return s
    return `${s} ~ ${e}`
  })()

  return (
    <>
      {/* ── 상세내용 섹션 ── */}
      <table className={styles.section_header}>
        <tbody><tr><td>퇴사확정일 요청 상세내용</td></tr></tbody>
      </table>

      <table className={styles.table_main}>
        <tbody>
          <tr>
            <td className={styles.label_cell}>사업단/부서</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{deptName || '-'}</span>
              ) : (
                <select
                  className={styles.select_full}
                  value={v(content, 'dept')}
                  onChange={(e) => onChange!('dept', e.target.value)}
                >
                  <option value="">부서 선택</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}
            </td>
            <td className={styles.label_cell}>입사일자</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, 'hire_date') || '-'}</span>
              ) : (
                <DateInput value={v(content, 'hire_date')} onChange={(val) => onChange!('hire_date', val)} />
              )}
            </td>
          </tr>
          <tr>
            <td className={styles.label_cell}>인수인계 기간</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{handoverPeriod}</span>
              ) : (
                <div className={styles.date_range}>
                  <DateInput value={v(content, 'handover_start')} onChange={(val) => onChange!('handover_start', val)} />
                  <span>~</span>
                  <DateInput value={v(content, 'handover_end')} onChange={(val) => onChange!('handover_end', val)} />
                </div>
              )}
            </td>
            <td className={styles.label_cell}>퇴사 후 연락처</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, 'contact_after') || '-'}</span>
              ) : (
                <input
                  type="text"
                  className={styles.input_full}
                  value={v(content, 'contact_after')}
                  placeholder="010-0000-0000"
                  onChange={(e) => onChange!('contact_after', formatPhone(e.target.value))}
                />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── 퇴사사유 ── */}
      <table className={`${styles.table_main} ${styles.table_gap}`}>
        <tbody>
          <tr>
            <td className={styles.label_cell}>퇴사사유</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{v(content, 'reason') || '-'}</span>
              ) : (
                <input
                  type="text"
                  className={styles.input_full}
                  value={v(content, 'reason')}
                  placeholder="퇴사사유 입력"
                  onChange={(e) => onChange!('reason', e.target.value)}
                />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── 점검사항 ── */}
      <table className={`${styles.section_header} ${styles.table_gap}`}>
        <tbody><tr><td>퇴사 전 유무 및 점검사항</td></tr></tbody>
      </table>

      <table className={styles.table_check}>
        <tbody>
          {CHECK_ITEMS.map(({ key, label }) => (
            <tr key={key}>
              <td className={styles.check_label}>{label}</td>
              <td className={styles.check_value}>
                <div className={styles.radio_group}>
                  <label>
                    <input
                      type="radio"
                      name={key}
                      value="이행"
                      checked={v(content, key) === '이행'}
                      onChange={() => onChange?.(key, '이행')}
                      disabled={ro}
                    />
                    이행
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={key}
                      value="미이행"
                      checked={v(content, key) === '미이행'}
                      onChange={() => onChange?.(key, '미이행')}
                      disabled={ro}
                    />
                    미이행
                  </label>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── 업무 인수인계 내용 ── */}
      <table className={`${styles.table_main} ${styles.table_gap}`}>
        <tbody>
          <tr>
            <td className={styles.label_cell}>업무 인수인계 내용</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span className={styles.pre_wrap}>{v(content, 'handover_content') || '-'}</span>
              ) : (
                <textarea
                  className={styles.textarea_full}
                  value={v(content, 'handover_content')}
                  placeholder="업무 인수인계 내용 입력"
                  onChange={(e) => onChange!('handover_content', e.target.value)}
                />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <p className={styles.note}>※ 인수인계 규정 서류 첨부가 안 될 시 반려됩니다.</p>
    </>
  )
}
