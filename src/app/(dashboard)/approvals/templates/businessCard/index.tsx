import React from 'react'
import shared from '../../page.module.css'
import styles from './styles.module.css'
import type { DocBodyProps, FieldDef } from '../types'

export const BUSINESS_CARD_FIELDS: FieldDef[] = [
  { key: 'company_name', label: '부서명', type: 'text', required: true },
  { key: 'phone_main', label: '대표번호', type: 'text' },
  { key: 'department', label: '소속', type: 'text', required: true },
  { key: 'phone', label: '전화번호', type: 'text', required: true },
  { key: 'name', label: '성명', type: 'text', required: true },
  { key: 'email', label: '이메일', type: 'email', required: true },
  { key: 'position', label: '직급', type: 'text', required: true },
  { key: 'address', label: '주소', type: 'text', required: true },
]

type BizRow = [string, string, boolean, string, string, boolean]

const BIZ_ROWS: BizRow[] = [
  ['company_name', '부서명', true,  'phone_main', '대표번호', false],
  ['department',   '소속',   true,  'phone',      '전화번호', true],
  ['name',         '성명',   true,  'email',      '이메일',   true],
  ['position',     '직급',   true,  'address',    '주소',     true],
]

function v(content: Record<string, unknown>, key: string): string {
  return String(content[key] ?? '')
}

export function BusinessCardBody({ content, onChange }: DocBodyProps) {
  const ro = !onChange
  return (
    <>
      <table className={`${shared.doc_body_table} ${styles.table_biz}`}>
        <tbody>
          {BIZ_ROWS.map(([k1, l1, r1, k2, l2, r2]) => (
            <tr key={k1}>
              <td className={`${shared.doc_field_label}${!ro && r1 ? ` ${shared.doc_field_label_required}` : ''}`}>{l1}</td>
              <td>
                {ro ? (
                  <span className={shared.doc_field_value_text}>{v(content, k1) || '-'}</span>
                ) : (
                  <input type="text" className={`${shared.doc_body_input} ${styles.input_full}`} value={v(content, k1)} placeholder={`${l1} 입력`} onChange={(e) => onChange!(k1, e.target.value)} />
                )}
              </td>
              <td className={`${shared.doc_field_label}${!ro && r2 ? ` ${shared.doc_field_label_required}` : ''}`}>{l2}</td>
              <td>
                {ro ? (
                  <span className={shared.doc_field_value_text}>{v(content, k2) || '-'}</span>
                ) : (
                  <input type={k2 === 'email' ? 'email' : 'text'} className={`${shared.doc_body_input} ${styles.input_full}`} value={v(content, k2)} placeholder={`${l2} 입력`} onChange={(e) => onChange!(k2, e.target.value)} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.note}>※ 입사 후 2개월 차부터 신청이 가능합니다.</p>
      <p className={styles.note}>※ 명함 제작은 회사에서 1회만 지원합니다.</p>
    </>
  )
}
