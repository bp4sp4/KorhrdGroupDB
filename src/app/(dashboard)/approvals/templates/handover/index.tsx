import React from 'react'
import styles from './styles.module.css'
import type { DocBodyProps, FieldDef } from '../types'

export const HANDOVER_FIELDS: FieldDef[] = [
  { key: 'receiver_name',  label: '인수자 이름',    type: 'text', required: true },
  { key: 'receiver_dept',  label: '인수자 부서/직급', type: 'text', required: true },
  { key: 'receiver_task',  label: '인수자 업무내용', type: 'text', required: true },
  { key: 'giver_name',     label: '인계자 이름',    type: 'text', required: true },
  { key: 'giver_dept',     label: '인계자 부서/직급', type: 'text', required: true },
  { key: 'giver_task',     label: '인계자 업무내용', type: 'text', required: true },
]

function v(content: Record<string, unknown>, key: string): string {
  return String(content[key] ?? '')
}

export function HandoverBody({ content, onChange }: DocBodyProps) {
  const ro = !onChange

  const cell = (key: string, placeholder: string) =>
    ro ? (
      <span>{v(content, key) || '-'}</span>
    ) : (
      <input
        type="text"
        className={styles.input_full}
        value={v(content, key)}
        placeholder={placeholder}
        onChange={(e) => onChange!(key, e.target.value)}
      />
    )

  return (
    <>
      {/* 섹션 헤더 */}
      <table className={styles.section_header}>
        <tbody>
          <tr><td>인수인계 인적사항</td></tr>
        </tbody>
      </table>

      {/* 인수자 / 인계자 테이블 */}
      <table className={styles.table_handover}>
        <tbody>
          <tr>
            <td className={styles.role_cell} rowSpan={3}>인수자</td>
            <td className={styles.label_cell}>이름</td>
            <td className={styles.value_cell}>{cell('receiver_name', '이름 입력')}</td>
            <td className={styles.role_cell} rowSpan={3}>인계자</td>
            <td className={styles.label_cell}>이름</td>
            <td className={styles.value_cell}>{cell('giver_name', '이름 입력')}</td>
          </tr>
          <tr>
            <td className={styles.label_cell}>부서/직급</td>
            <td className={styles.value_cell}>{cell('receiver_dept', '예: 영업1팀/사원')}</td>
            <td className={styles.label_cell}>부서/직급</td>
            <td className={styles.value_cell}>{cell('giver_dept', '예: 영업2팀/대리')}</td>
          </tr>
          <tr>
            <td className={styles.label_cell}>업무내용</td>
            <td className={styles.value_cell}>{cell('receiver_task', '업무내용 입력')}</td>
            <td className={styles.label_cell}>업무내용</td>
            <td className={styles.value_cell}>{cell('giver_task', '업무내용 입력')}</td>
          </tr>
        </tbody>
      </table>

      {/* 안내 문구 */}
      <div className={styles.notes_section}>
        <p className={styles.notes_title}>※ 인수인계 요청서 승인 시 아래 목록을 참고하여 완료 후 퇴사확정 요청서를 상신할 수 있습니다.</p>
        <p className={styles.notes_item}>- 학생관리파일</p>
        <p className={styles.notes_item}>- 영업 및 상담용 DB관리파일</p>
        <p className={styles.notes_item}>- 학습플랜 (인계자 점검 후 인수자 재점검)</p>
        <p className={styles.notes_item}>- 근무 중 모든 매출파일</p>
        <p className={styles.notes_item}>- 전 학생 카톡 캡처본(이미지별 이름 정리)</p>
        <p className={styles.notes_item}>- 인수인계 내용 확인서명</p>
      </div>
    </>
  )
}
