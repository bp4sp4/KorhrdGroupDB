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

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

export function BusinessCardBody({ content, onChange, departments = [] }: DocBodyProps) {
  const ro = !onChange
  const deptName = departments.find(d => d.id === v(content, 'company_name'))?.name ?? v(content, 'company_name')

  const renderCell = (key: string, label: string) => {
    if (ro) {
      const display = key === 'company_name' ? (deptName || '-') : (v(content, key) || '-')
      return <span className={shared.doc_field_value_text}>{display}</span>
    }
    if (key === 'company_name') {
      return (
        <select
          className={`${shared.doc_body_select} ${styles.input_full}`}
          value={v(content, key)}
          onChange={(e) => onChange!(key, e.target.value)}
        >
          <option value="">부서 선택</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      )
    }
    const isPhone = key === 'phone' || key === 'phone_main'
    return (
      <input
        type={key === 'email' ? 'email' : 'text'}
        className={`${shared.doc_body_input} ${styles.input_full}`}
        value={v(content, key)}
        placeholder={isPhone ? '010-0000-0000' : `${label} 입력`}
        onChange={(e) => onChange!(key, isPhone ? formatPhone(e.target.value) : e.target.value)}
      />
    )
  }

  return (
    <>
      <table className={`${shared.doc_body_table} ${styles.table_biz}`}>
        <tbody>
          {BIZ_ROWS.map(([k1, l1, r1, k2, l2, r2]) => (
            <tr key={k1}>
              <td className={`${shared.doc_field_label}${!ro && r1 ? ` ${shared.doc_field_label_required}` : ''}`}>{l1}</td>
              <td>{renderCell(k1, l1)}</td>
              <td className={`${shared.doc_field_label}${!ro && r2 ? ` ${shared.doc_field_label_required}` : ''}`}>{l2}</td>
              <td>{renderCell(k2, l2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.note}>※ 입사 후 2개월 차부터 신청이 가능합니다.</p>
      <p className={styles.note}>※ 명함 제작은 회사에서 1회만 지원합니다.</p>
    </>
  )
}
