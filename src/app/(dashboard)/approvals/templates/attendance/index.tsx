import React from 'react'
import shared from '../../page.module.css'
import styles from './styles.module.css'
import type { DocBodyProps, FieldDef } from '../types'
import { DateInput } from '@/components/ui/Calendar/DateInput'

export const ATTENDANCE_FIELDS: FieldDef[] = [
  { key: 'attend_start_date', label: '날짜(시작)', type: 'date', required: true },
  { key: 'attend_end_date', label: '날짜(종료)', type: 'date', required: true },
  {
    key: 'attend_type', label: '구분', type: 'select', required: true,
    options: [
      { value: '지각', label: '지각' },
      { value: '조퇴', label: '조퇴' },
      { value: '외출', label: '외출' },
      { value: '병가', label: '병가' },
      { value: '기타', label: '기타' },
    ],
  },
  { key: 'reason', label: '사유', type: 'textarea', required: true },
]

function v(content: Record<string, unknown>, key: string): string {
  return String(content[key] ?? '')
}

export function AttendanceBody({ content, onChange }: DocBodyProps) {
  const ro = !onChange
  return (
    <>
      <table className={`${shared.doc_body_table} ${styles.table_4col}`}>
        <tbody>
          <tr>
            <td className={`${shared.doc_field_label}${!ro ? ` ${shared.doc_field_label_required}` : ''}`}>날짜</td>
            <td>
              {ro ? (
                <span className={shared.doc_field_value_text}>
                  {v(content, 'attend_start_date') || '-'} ~ {v(content, 'attend_end_date') || '-'}
                </span>
              ) : (
                <div className={styles.date_range_cell}>
                  <DateInput
                    value={v(content, 'attend_start_date')}
                    onChange={(val) => onChange!('attend_start_date', val)}
                  />
                  <span className={styles.date_sep}>~</span>
                  <DateInput
                    value={v(content, 'attend_end_date')}
                    onChange={(val) => onChange!('attend_end_date', val)}
                  />
                </div>
              )}
            </td>
            <td className={`${shared.doc_field_label}${!ro ? ` ${shared.doc_field_label_required}` : ''}`}>구분</td>
            <td>
              {ro ? (
                <span className={shared.doc_field_value_text}>{v(content, 'attend_type') || '-'}</span>
              ) : (
                <select className={shared.doc_body_select} value={v(content, 'attend_type')} onChange={(e) => onChange!('attend_type', e.target.value)}>
                  <option value="">선택</option>
                  <option value="지각">지각</option>
                  <option value="조퇴">조퇴</option>
                  <option value="외출">외출</option>
                  <option value="병가">병가</option>
                  <option value="기타">기타</option>
                </select>
              )}
            </td>
          </tr>
          <tr>
            <td className={`${shared.doc_field_label}${!ro ? ` ${shared.doc_field_label_required}` : ''}`}>사유</td>
            <td colSpan={3}>
              {ro ? (
                <span className={`${shared.doc_field_value_text} ${shared.doc_field_value_prewrap}`}>
                  {v(content, 'reason') || '-'}
                </span>
              ) : (
                <textarea
                  className={`${shared.doc_body_textarea} ${styles.textarea_large}`}
                  value={v(content, 'reason')}
                  placeholder="사유를 입력하세요"
                  onChange={(e) => onChange!('reason', e.target.value)}
                />
              )}
            </td>
          </tr>
        </tbody>
      </table>
      <p className={styles.note}>※ 사유가 병원 방문이라면 진료 확인서 또는 처방전을 첨부해 주세요</p>
    </>
  )
}
