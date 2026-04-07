import React from 'react'
import shared from '../../page.module.css'
import styles from './styles.module.css'
import type { DocBodyProps, FieldDef } from '../types'

export const EMPLOYEE_ID_FIELDS: FieldDef[] = [
  { key: 'department', label: '부서명', type: 'text', required: true },
  { key: 'name', label: '이름', type: 'text', required: true },
  { key: 'name_en', label: '영문이름', type: 'text', required: true },
]

function v(content: Record<string, unknown>, key: string): string {
  return String(content[key] ?? '')
}

export function EmployeeIdBody({ content, onChange, departments = [] }: DocBodyProps) {
  const ro = !onChange
  const deptName = departments.find(d => d.id === v(content, 'department'))?.name ?? v(content, 'department')

  return (
    <>
      <table className={shared.doc_body_table}>
        <tbody>
          <tr>
            <td className={`${shared.doc_field_label} ${!ro ? shared.doc_field_label_required : ''}`}>부 서 명</td>
            <td>
              {ro ? (
                <span className={shared.doc_field_value_text}>{deptName || '-'}</span>
              ) : (
                <select
                  className={shared.doc_body_select}
                  value={v(content, 'department')}
                  onChange={(e) => onChange!('department', e.target.value)}
                >
                  <option value="">부서 선택</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}
            </td>
            <td className={`${shared.doc_field_label} ${!ro ? shared.doc_field_label_required : ''}`}>이 &nbsp; 름</td>
            <td>
              {ro ? (
                <span className={shared.doc_field_value_text}>{v(content, 'name') || '-'}</span>
              ) : (
                <input
                  type="text"
                  className={`${shared.doc_body_input} ${styles.input_full}`}
                  value={v(content, 'name')}
                  placeholder="이름 입력"
                  onChange={(e) => onChange!('name', e.target.value)}
                />
              )}
            </td>
          </tr>
          <tr>
            <td className={`${shared.doc_field_label} ${!ro ? shared.doc_field_label_required : ''}`}>영문이름</td>
            <td>
              {ro ? (
                <span className={shared.doc_field_value_text}>{v(content, 'name_en') || '-'}</span>
              ) : (
                <input
                  type="text"
                  className={`${shared.doc_body_input} ${styles.input_full}`}
                  value={v(content, 'name_en')}
                  placeholder="영문이름 입력 (예: Hong Gil Dong)"
                  onChange={(e) => onChange!('name_en', e.target.value)}
                />
              )}
            </td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <div className={styles.notes_section}>
        <p className={styles.notes_title}>※ 증명사진 첨부파일 제출 안내</p>
        <div className={styles.notes_group}>
          <p className={styles.notes_group_title}>1. 사진 제출 조건</p>
          <p className={styles.notes_item}>- 사진관에서 촬영한 파일 형태의 증명사진만 제출 가능합니다.</p>
          <p className={styles.notes_item}>- 핸드폰으로 찍은 증명사진은 제출이 불가합니다.</p>
        </div>
        <div className={styles.notes_group}>
          <p className={styles.notes_group_title}>2. 사진 배경조건</p>
          <p className={styles.notes_item}>- 사진의 뒷 배경은 반드시 흰색 바탕이어야 합니다.</p>
        </div>
      </div>

      <div className={styles.notes_footer}>
        <p>※ 일반부서는 입사 후 신청 가능합니다</p>
        <p>※ 사업부는 경력 사원 되기 직전에 신청이 가능합니다.(교육생 사원증은 반납해야 합니다.)</p>
      </div>
    </>
  )
}
