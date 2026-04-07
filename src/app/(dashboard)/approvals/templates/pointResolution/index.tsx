import React from 'react'
import styles from '../expenseResolution/styles.module.css'
import own from './styles.module.css'
import type { DocBodyProps, FieldDef } from '../types'

export const POINT_RESOLUTION_FIELDS: FieldDef[] = [
  { key: 'student_name',   label: '학생 성함',  type: 'text',     required: true },
  { key: 'contact',        label: '연락처',      type: 'text',     required: true },
  { key: 'course',         label: '진행과정',    type: 'text',     required: true },
  { key: 'summary',        label: '내용 정리',   type: 'textarea', required: true },
  { key: 'unit_price',     label: '단가',        type: 'number' },
  { key: 'subject_count',  label: '과목 수',     type: 'number' },
  { key: 'amount',         label: '요청 금액',   type: 'number',   required: true },
  { key: 'bank_name',      label: '은행명',      type: 'text',     required: true },
  { key: 'account_number', label: '계좌번호(-제외)', type: 'text', required: true },
  { key: 'account_holder', label: '입금자명',    type: 'text',     required: true },
]

function v(content: Record<string, unknown>, key: string): string {
  return String(content[key] ?? '')
}

function numDisplay(str: string): string {
  const n = Number(str)
  return !str || isNaN(n) || n === 0 ? '' : n.toLocaleString()
}

export function PointResolutionBody({ content, onChange }: DocBodyProps) {
  const ro = !onChange

  return (
    <>
      {/* ── 문제건 상세내용(학습자) ── */}
      <table className={own.table_section}>
        <thead>
          <tr>
            <th colSpan={6} className={own.section_title}>문제건 상세내용(학습자)</th>
          </tr>
        </thead>
        <tbody>
          {/* 학생 성함 / 연락처 / 진행과정 */}
          <tr>
            <td className={own.label_cell}>학생 성함</td>
            <td className={own.value_cell}>
              {ro ? <span>{v(content, 'student_name') || '-'}</span> : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'student_name')} placeholder=""
                  onChange={(e) => onChange!('student_name', e.target.value)} />
              )}
            </td>
            <td className={own.label_cell}>연락처</td>
            <td className={own.value_cell}>
              {ro ? <span>{v(content, 'contact') || '-'}</span> : (
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
            <td className={own.label_cell}>진행과정</td>
            <td className={own.value_cell}>
              {ro ? <span>{v(content, 'course') || '-'}</span> : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'course')} placeholder=""
                  onChange={(e) => onChange!('course', e.target.value)} />
              )}
            </td>
          </tr>

          {/* 내용 정리 */}
          <tr>
            <td className={own.label_cell_mid}>내용 정리</td>
            <td colSpan={5} className={own.value_cell}>
              {ro ? (
                <span className={styles.pre_wrap}>{v(content, 'summary') || '-'}</span>
              ) : (
                <textarea className={styles.textarea_full}
                  value={v(content, 'summary')} placeholder=""
                  onChange={(e) => onChange!('summary', e.target.value)} />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── 지출 은행(본인) ── */}
      <table className={own.table_section2}>
        <thead>
          <tr>
            <th colSpan={6} className={own.section_title}>지출 은행(본인)</th>
          </tr>
        </thead>
        <tbody>
          {/* 단가 / 과목 수 / 요청 금액 */}
          <tr>
            <td className={own.label_cell}>단가</td>
            <td className={own.value_cell}>
              {ro ? <span>{numDisplay(v(content, 'unit_price'))}</span> : (
                <input type="number" className={styles.input_num}
                  value={v(content, 'unit_price')} placeholder=""
                  onChange={(e) => onChange!('unit_price', e.target.value)} />
              )}
            </td>
            <td className={own.label_cell}>과목 수</td>
            <td className={own.value_cell}>
              {ro ? <span>{v(content, 'subject_count') || '-'}</span> : (
                <input type="number" className={styles.input_num}
                  value={v(content, 'subject_count')} placeholder=""
                  onChange={(e) => onChange!('subject_count', e.target.value)} />
              )}
            </td>
            <td className={own.label_cell}>요청 금액</td>
            <td className={own.value_cell}>
              {ro ? <span>{numDisplay(v(content, 'amount'))}</span> : (
                <input type="number" className={styles.input_num}
                  value={v(content, 'amount')} placeholder=""
                  onChange={(e) => onChange!('amount', e.target.value)} />
              )}
            </td>
          </tr>

          {/* 은행명 / 계좌번호 / 입금자명 */}
          <tr>
            <td className={own.label_cell}>은행명</td>
            <td className={own.value_cell}>
              {ro ? <span>{v(content, 'bank_name') || '-'}</span> : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'bank_name')} placeholder=""
                  onChange={(e) => onChange!('bank_name', e.target.value)} />
              )}
            </td>
            <td className={own.label_cell}>계좌번호(- 제외)</td>
            <td className={own.value_cell}>
              {ro ? <span>{v(content, 'account_number') || '-'}</span> : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'account_number')} placeholder=""
                  onChange={(e) => onChange!('account_number', e.target.value)} />
              )}
            </td>
            <td className={own.label_cell}>입금자명</td>
            <td className={own.value_cell}>
              {ro ? <span>{v(content, 'account_holder') || '-'}</span> : (
                <input type="text" className={styles.input_full}
                  value={v(content, 'account_holder')} placeholder=""
                  onChange={(e) => onChange!('account_holder', e.target.value)} />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <div className={own.notes}>
        <p>※ 내용정리 - 육하원칙에 따라 상황과 처리 방식을 정확히 적어주세요.</p>
        <p>※ 지출 은행은 본인 계좌를 적어야 합니다.</p>
        <p>※ 학습플랜 첨부하지 않을 경우 반려됩니다.</p>
      </div>
    </>
  )
}
