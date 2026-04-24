import type { FormSchema, FieldBlock } from '@/types/approvalForm'
import type { FieldDef } from '@/app/(dashboard)/approvals/templates/types'

export function v(content: Record<string, unknown>, key: string): string {
  return String(content[key] ?? '')
}

export function vBool(content: Record<string, unknown>, key: string): boolean {
  const raw = content[key]
  return raw === true || raw === 'true'
}

export type TableRow = Record<string, string>

export function toRows(raw: unknown): TableRow[] {
  let arr: unknown = raw
  if (typeof raw === 'string') {
    if (!raw.trim()) return []
    try {
      arr = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(arr)) return []
  return arr.map((r) => (r && typeof r === 'object' ? (r as TableRow) : {}))
}

/** 인접한 half-width 블록을 한 행으로 묶는다. table/textarea는 항상 단독. */
export function groupRows(blocks: FieldBlock[]): FieldBlock[][] {
  const rows: FieldBlock[][] = []
  let i = 0
  while (i < blocks.length) {
    const b = blocks[i]
    if (b.type === 'table' || b.type === 'textarea') {
      rows.push([b])
      i += 1
      continue
    }
    if (
      b.width === 'half' &&
      i + 1 < blocks.length &&
      blocks[i + 1].width === 'half' &&
      blocks[i + 1].type !== 'table' &&
      blocks[i + 1].type !== 'textarea'
    ) {
      rows.push([b, blocks[i + 1]])
      i += 2
    } else {
      rows.push([b])
      i += 1
    }
  }
  return rows
}

export function schemaToFieldDefs(schema: FormSchema): FieldDef[] {
  return schema.blocks.filter((b) => b.type !== 'table').map((b) => blockToFieldDef(b))
}

function blockToFieldDef(b: FieldBlock): FieldDef {
  const base = { key: b.key, label: b.label, required: b.required }
  switch (b.type) {
    case 'text':
      return { ...base, type: 'text' }
    case 'textarea':
      return { ...base, type: 'textarea' }
    case 'number':
      return { ...base, type: 'number' }
    case 'date':
      return { ...base, type: 'date' }
    case 'select':
      return { ...base, type: 'select', options: b.options ?? [] }
    case 'checkbox':
    case 'table':
      return { ...base, type: 'text' }
  }
}
