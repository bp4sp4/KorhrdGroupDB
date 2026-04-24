import React from 'react'
import shared from '../../page.module.css'
import styles from './styles.module.css'
import type { DocBodyProps } from '../types'
import type { FormSchema, FieldBlock, TableColumn } from '@/types/approvalForm'
import { TITLE_CONTENT_KEY } from '@/types/approvalForm'
import { DateInput } from '@/components/ui/Calendar/DateInput'
import {
  v,
  vBool,
  toRows,
  groupRows,
  schemaToFieldDefs,
  type TableRow,
} from '@/lib/approvals/fieldRenderer'

export { schemaToFieldDefs }

function renderFieldInput(
  b: FieldBlock,
  content: Record<string, unknown>,
  onChange: (key: string, value: string) => void,
): React.ReactNode {
  switch (b.type) {
    case 'text':
      return (
        <input
          type="text"
          className={`${shared.doc_body_input} ${styles.input_full}`}
          value={v(content, b.key)}
          placeholder={b.placeholder ?? `${b.label} 입력`}
          onChange={(e) => onChange(b.key, e.target.value)}
        />
      )
    case 'number':
      return (
        <input
          type="number"
          className={`${shared.doc_body_input} ${styles.input_full}`}
          value={v(content, b.key)}
          placeholder={b.placeholder ?? `${b.label} 입력`}
          onChange={(e) => onChange(b.key, e.target.value)}
        />
      )
    case 'textarea':
      return (
        <textarea
          className={`${shared.doc_body_textarea} ${styles.textarea_large}`}
          value={v(content, b.key)}
          placeholder={b.placeholder ?? `${b.label} 입력`}
          onChange={(e) => onChange(b.key, e.target.value)}
        />
      )
    case 'date':
      return (
        <DateInput
          value={v(content, b.key)}
          onChange={(val) => onChange(b.key, val)}
        />
      )
    case 'select':
      return (
        <select
          className={shared.doc_body_select}
          value={v(content, b.key)}
          onChange={(e) => onChange(b.key, e.target.value)}
        >
          <option value="">선택</option>
          {b.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )
    case 'checkbox':
      return (
        <label className={styles.checkbox_row}>
          <input
            type="checkbox"
            checked={vBool(content, b.key)}
            onChange={(e) => onChange(b.key, e.target.checked ? 'true' : 'false')}
          />
          <span>{b.placeholder ?? '동의'}</span>
        </label>
      )
    case 'table':
      return null
  }
}

function renderFieldReadOnly(b: FieldBlock, content: Record<string, unknown>): React.ReactNode {
  if (b.type === 'checkbox') {
    return <span className={shared.doc_field_value_text}>{vBool(content, b.key) ? '✓' : '-'}</span>
  }
  if (b.type === 'select') {
    const raw = v(content, b.key)
    const opt = b.options?.find((o) => o.value === raw)
    return <span className={shared.doc_field_value_text}>{opt?.label || raw || '-'}</span>
  }
  if (b.type === 'textarea') {
    const raw = v(content, b.key)
    return (
      <span className={`${shared.doc_field_value_text} ${shared.doc_field_value_prewrap}`}>
        {raw || '-'}
      </span>
    )
  }
  return <span className={shared.doc_field_value_text}>{v(content, b.key) || '-'}</span>
}

function TableField({
  block,
  content,
  onChange,
  readOnly,
}: {
  block: FieldBlock
  content: Record<string, unknown>
  onChange?: (key: string, value: string) => void
  readOnly: boolean
}) {
  const columns: TableColumn[] = block.columns ?? []
  const rows = toRows(content[block.key])

  const setRows = (next: TableRow[]) => {
    if (!onChange) return
    onChange(block.key, JSON.stringify(next))
  }

  const updateCell = (ri: number, ck: string, val: string) => {
    const next = rows.map((r, i) => (i === ri ? { ...r, [ck]: val } : r))
    setRows(next)
  }

  const addRow = () => {
    const blank: TableRow = {}
    columns.forEach((c) => { blank[c.key] = '' })
    setRows([...rows, blank])
  }

  const removeRow = (ri: number) => {
    setRows(rows.filter((_, i) => i !== ri))
  }

  const totalCols = columns.length + (readOnly ? 0 : 1)

  return (
    <div className={styles.table_wrapper}>
      <table className={styles.nested_table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={styles.nested_th}>{c.label}</th>
            ))}
            {!readOnly && <th className={styles.nested_th_action}>-</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={styles.nested_empty} colSpan={totalCols}>
                {readOnly ? '-' : '행이 없습니다. 아래 + 행 추가 버튼을 눌러 행을 추가하세요.'}
              </td>
            </tr>
          ) : (
            rows.map((r, ri) => (
              <tr key={ri}>
                {columns.map((c) => (
                  <td key={c.key} className={styles.nested_td}>
                    {readOnly ? (
                      <span>{String(r[c.key] ?? '') || '-'}</span>
                    ) : c.type === 'select' ? (
                      <select
                        className={shared.doc_body_select}
                        value={String(r[c.key] ?? '')}
                        onChange={(e) => updateCell(ri, c.key, e.target.value)}
                      >
                        <option value="">선택</option>
                        {c.options?.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : c.type === 'date' ? (
                      <DateInput
                        value={String(r[c.key] ?? '')}
                        onChange={(val) => updateCell(ri, c.key, val)}
                      />
                    ) : (
                      <input
                        type={c.type}
                        className={`${shared.doc_body_input} ${styles.input_full}`}
                        value={String(r[c.key] ?? '')}
                        onChange={(e) => updateCell(ri, c.key, e.target.value)}
                      />
                    )}
                  </td>
                ))}
                {!readOnly && (
                  <td className={styles.nested_td_action}>
                    <button
                      type="button"
                      className={styles.nested_remove_btn}
                      onClick={() => removeRow(ri)}
                    >×</button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {!readOnly && (
        <button type="button" className={styles.nested_add_btn} onClick={addRow}>
          + 행 추가
        </button>
      )}
    </div>
  )
}

export interface SchemaBodyOptions {
  titlePlaceholder?: string | null
}

export function makeSchemaBody(
  schema: FormSchema,
  options?: SchemaBodyOptions,
): React.FC<DocBodyProps> {
  const titlePlaceholder = options?.titlePlaceholder ?? '문서 제목을 입력하세요'

  return function DynamicBody({ content, onChange }: DocBodyProps) {
    const ro = !onChange
    const rows = groupRows(schema.blocks)
    const title = v(content, TITLE_CONTENT_KEY)

    return (
      <table className={shared.doc_body_table}>
        <tbody>
          {/* 문서 제목 행 (고정) */}
          <tr>
            <td
              className={`${shared.doc_field_label}${!ro ? ` ${shared.doc_field_label_required}` : ''}`}
            >
              문서 제목
            </td>
            <td colSpan={3}>
              {ro ? (
                <span className={shared.doc_field_value_text}>{title || '-'}</span>
              ) : (
                <input
                  type="text"
                  className={`${shared.doc_body_input} ${styles.input_full}`}
                  value={title}
                  placeholder={titlePlaceholder}
                  onChange={(e) => onChange!(TITLE_CONTENT_KEY, e.target.value)}
                />
              )}
            </td>
          </tr>

          {/* 일반 필드 */}
          {rows.map((row, idx) => {
            // table/textarea 단독 행
            if (row.length === 1 && row[0].type === 'table') {
              const b = row[0]
              return (
                <tr key={idx}>
                  <td
                    className={`${shared.doc_field_label}${!ro && b.required ? ` ${shared.doc_field_label_required}` : ''}`}
                  >
                    {b.label}
                  </td>
                  <td colSpan={3}>
                    <TableField block={b} content={content} onChange={onChange} readOnly={ro} />
                  </td>
                </tr>
              )
            }
            if (row.length === 2) {
              const [a, bb] = row
              return (
                <tr key={idx}>
                  <td
                    className={`${shared.doc_field_label}${!ro && a.required ? ` ${shared.doc_field_label_required}` : ''}`}
                  >
                    {a.label}
                  </td>
                  <td>
                    {ro
                      ? renderFieldReadOnly(a, content)
                      : renderFieldInput(a, content, onChange!)}
                  </td>
                  <td
                    className={`${shared.doc_field_label}${!ro && bb.required ? ` ${shared.doc_field_label_required}` : ''}`}
                  >
                    {bb.label}
                  </td>
                  <td>
                    {ro
                      ? renderFieldReadOnly(bb, content)
                      : renderFieldInput(bb, content, onChange!)}
                  </td>
                </tr>
              )
            }
            const b = row[0]
            return (
              <tr key={idx}>
                <td
                  className={`${shared.doc_field_label}${!ro && b.required ? ` ${shared.doc_field_label_required}` : ''}`}
                >
                  {b.label}
                </td>
                <td colSpan={3}>
                  {ro
                    ? renderFieldReadOnly(b, content)
                    : renderFieldInput(b, content, onChange!)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }
}
