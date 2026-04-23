export type FieldBlockType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'table'

export interface SelectOption {
  value: string
  label: string
}

export type FieldWidth = 'full' | 'half'

export type TableColumnType = 'text' | 'number' | 'date' | 'select'

export interface TableColumn {
  key: string
  label: string
  type: TableColumnType
  options?: SelectOption[]
  width?: string
}

export interface FieldBlock {
  id: string
  type: FieldBlockType
  key: string
  label: string
  required: boolean
  placeholder?: string
  options?: SelectOption[]
  width?: FieldWidth
  columns?: TableColumn[]
}

export interface FormSchema {
  blocks: FieldBlock[]
}

export interface ApprovalFormCategory {
  id: string
  name: string
  parent_id: string | null
  sort_order: number
  created_at: string
}

export interface ApprovalFormTemplate {
  id: string
  category_id: string | null
  name: string
  document_type: string
  description: string | null
  schema: FormSchema
  supports_attachments: boolean
  is_active: boolean
  sort_order: number
  default_approval_template_id: string | null
  title_placeholder: string | null
  synced_template_id: string | null
  created_at: string
  updated_at: string
}

/** 동적 양식에서 문서 제목을 content에 저장할 때 사용하는 예약 키 */
export const TITLE_CONTENT_KEY = '__title__'

export function emptySchema(): FormSchema {
  return { blocks: [] }
}

export function newFieldBlock(type: FieldBlockType, index: number): FieldBlock {
  const base: Omit<FieldBlock, 'type'> = {
    id: crypto.randomUUID(),
    key: `field_${index + 1}`,
    label: defaultLabel(type, index),
    required: false,
    width: 'full',
  }
  if (type === 'select') {
    return { ...base, type, options: [{ value: 'option1', label: '옵션1' }] }
  }
  if (type === 'table') {
    return {
      ...base,
      type,
      width: 'full',
      columns: [
        { key: 'col1', label: '항목', type: 'text' },
        { key: 'col2', label: '내용', type: 'text' },
      ],
    }
  }
  return { ...base, type }
}

function defaultLabel(type: FieldBlockType, index: number): string {
  const names: Record<FieldBlockType, string> = {
    text: '텍스트',
    textarea: '멀티텍스트',
    number: '숫자',
    date: '날짜',
    select: '드롭다운',
    checkbox: '체크박스',
    table: '테이블',
  }
  return `${names[type]}${index + 1}`
}
