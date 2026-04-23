'use client'

import { useState, useMemo } from 'react'
import styles from './page.module.css'
import type {
  ApprovalFormCategory,
  ApprovalFormTemplate,
  FieldBlock,
  FieldBlockType,
  FieldWidth,
  FormSchema,
  TableColumn,
  TableColumnType,
} from '@/types/approvalForm'
import { newFieldBlock } from '@/types/approvalForm'
import { makeSchemaBody } from '@/app/(dashboard)/approvals/templates/dynamic'
import type { ApprovalTemplate } from '@/lib/management/types'

const FIELD_TYPES: { type: FieldBlockType; label: string }[] = [
  { type: 'text', label: '텍스트' },
  { type: 'textarea', label: '멀티텍스트' },
  { type: 'number', label: '숫자' },
  { type: 'date', label: '날짜' },
  { type: 'select', label: '드롭다운' },
  { type: 'checkbox', label: '체크박스' },
  { type: 'table', label: '테이블' },
]

interface Props {
  template: ApprovalFormTemplate
  categories: ApprovalFormCategory[]
  approvalTemplates: ApprovalTemplate[]
  onSave: (updated: Partial<ApprovalFormTemplate>) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
  saving?: boolean
}

export function FormEditor({
  template,
  categories,
  approvalTemplates,
  onSave,
  onCancel,
  onDelete,
  saving,
}: Props) {
  const [name, setName] = useState(template.name)
  const [documentType, setDocumentType] = useState(template.document_type)
  const [categoryId, setCategoryId] = useState<string | null>(template.category_id)
  const [description, setDescription] = useState(template.description ?? '')
  const [supportsAttachments, setSupportsAttachments] = useState(template.supports_attachments)
  const [isActive, setIsActive] = useState(template.is_active)
  const [schema, setSchema] = useState<FormSchema>(template.schema ?? { blocks: [] })
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [defaultApprovalTemplateId, setDefaultApprovalTemplateId] = useState<string | null>(
    template.default_approval_template_id,
  )
  const [titlePlaceholder, setTitlePlaceholder] = useState(template.title_placeholder ?? '')
  const [previewOpen, setPreviewOpen] = useState(false)

  const selectedBlock = schema.blocks.find((b) => b.id === selectedBlockId) ?? null

  const addBlock = (type: FieldBlockType) => {
    const block = newFieldBlock(type, schema.blocks.length)
    setSchema({ blocks: [...schema.blocks, block] })
    setSelectedBlockId(block.id)
  }

  const updateBlock = (id: string, patch: Partial<FieldBlock>) => {
    setSchema({
      blocks: schema.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as FieldBlock) : b)),
    })
  }

  const moveBlock = (id: string, dir: -1 | 1) => {
    const idx = schema.blocks.findIndex((b) => b.id === id)
    if (idx === -1) return
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= schema.blocks.length) return
    const next = [...schema.blocks]
    const [item] = next.splice(idx, 1)
    next.splice(newIdx, 0, item)
    setSchema({ blocks: next })
  }

  const deleteBlock = (id: string) => {
    setSchema({ blocks: schema.blocks.filter((b) => b.id !== id) })
    if (selectedBlockId === id) setSelectedBlockId(null)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      alert('양식명을 입력하세요.')
      return
    }
    if (!documentType.trim()) {
      alert('문서 유형 코드를 입력하세요.')
      return
    }
    if (!defaultApprovalTemplateId) {
      alert('기본 결재선을 선택해야 저장할 수 있습니다.\n결재 작성 화면에서 이 양식이 노출되려면 결재선이 필요합니다.')
      return
    }
    await onSave({
      name: name.trim(),
      document_type: documentType.trim(),
      category_id: categoryId,
      description: description.trim() || null,
      supports_attachments: supportsAttachments,
      is_active: isActive,
      schema,
      default_approval_template_id: defaultApprovalTemplateId,
      title_placeholder: titlePlaceholder.trim() || null,
    })
  }

  const rows = groupBlocksIntoRows(schema.blocks)

  return (
    <div className={styles.editor}>
      <div className={styles.editorHead}>
        <div className={styles.editorHeadLeft}>
          <label className={styles.fieldInline}>
            양식명
            <input
              className={styles.inputInline}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 연차신청서"
            />
          </label>
          <label className={styles.fieldInline}>
            코드
            <input
              className={styles.inputInlineSm}
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              placeholder="예: custom_vacation_v1"
            />
          </label>
          <label className={styles.fieldInline}>
            카테고리
            <select
              className={styles.selectInline}
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(e.target.value || null)}
            >
              <option value="">(없음)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className={styles.fieldInline}>
            기본 결재선
            <select
              className={styles.selectInline}
              value={defaultApprovalTemplateId ?? ''}
              onChange={(e) => setDefaultApprovalTemplateId(e.target.value || null)}
            >
              <option value="">(없음)</option>
              {approvalTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.document_type} · {t.steps?.length ?? 0}단계
                </option>
              ))}
            </select>
          </label>
          <label className={styles.fieldInline}>
            <input
              type="checkbox"
              checked={supportsAttachments}
              onChange={(e) => setSupportsAttachments(e.target.checked)}
            />
            파일첨부 허용
          </label>
          <label className={styles.fieldInline}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            활성
          </label>
        </div>
        <div className={styles.editorHeadActions}>
          <button
            className={styles.btn}
            onClick={() => setPreviewOpen(true)}
            disabled={saving}
            type="button"
          >미리보기</button>
          <button className={styles.btn} onClick={onCancel} disabled={saving}>취소</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className={styles.editorBody}>
        <aside className={styles.palette}>
          <h3 className={styles.paletteTitle}>필드 추가</h3>
          <div className={styles.paletteGrid}>
            {FIELD_TYPES.map((f) => (
              <button
                key={f.type}
                className={styles.paletteBtn}
                onClick={() => addBlock(f.type)}
                type="button"
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className={styles.paletteHint}>
            필드를 클릭해 캔버스에 추가하세요. 블록을 클릭하면 우측에서 상세 속성을 편집할 수 있습니다.
          </p>
        </aside>

        <section className={styles.canvas}>
          <div className={styles.canvasInner}>
            <div className={styles.titleRow}>
              <div className={styles.titleLabel}>문서 제목</div>
              <input
                className={styles.titleInput}
                value={titlePlaceholder}
                onChange={(e) => setTitlePlaceholder(e.target.value)}
                placeholder="제목 placeholder (예: 휴가 신청서)"
              />
              <span className={styles.titleHint}>※ 실제 결재 작성 시 사용자가 입력한 값이 문서 제목이 됩니다</span>
            </div>

            {schema.blocks.length === 0 ? (
              <div className={styles.canvasEmpty}>
                왼쪽에서 필드를 추가해 양식을 구성하세요.
              </div>
            ) : (
              rows.map((row, rowIdx) => (
                <div key={rowIdx} className={styles.canvasRow}>
                  {row.map((b) => (
                    <BlockPreview
                      key={b.id}
                      block={b}
                      active={selectedBlockId === b.id}
                      onSelect={() => setSelectedBlockId(b.id)}
                      onMove={(dir) => moveBlock(b.id, dir)}
                      onDelete={() => deleteBlock(b.id)}
                      half={b.width === 'half' && b.type !== 'table' && b.type !== 'textarea'}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </section>

        <aside className={styles.props}>
          <h3 className={styles.propsTitle}>필드 속성</h3>
          {selectedBlock ? (
            <PropertyEditor
              block={selectedBlock}
              onChange={(patch) => updateBlock(selectedBlock.id, patch)}
            />
          ) : (
            <>
              <div className={styles.propsEmpty}>필드를 선택하세요</div>
              <div className={styles.propField}>
                <label className={styles.propLabel}>설명 (관리자용)</label>
                <textarea
                  className={styles.propInput}
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="양식 설명 (선택)"
                />
              </div>
              {onDelete && (
                <div className={styles.dangerZone}>
                  <button
                    className={`${styles.btn} ${styles.btnDanger}`}
                    onClick={() => {
                      if (confirm('정말 삭제하시겠습니까?')) onDelete()
                    }}
                    disabled={saving}
                    type="button"
                  >
                    이 양식 삭제
                  </button>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {previewOpen && (
        <PreviewModal
          name={name}
          schema={schema}
          titlePlaceholder={titlePlaceholder || null}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  )
}

function groupBlocksIntoRows(blocks: FieldBlock[]): FieldBlock[][] {
  const rows: FieldBlock[][] = []
  let i = 0
  while (i < blocks.length) {
    const b = blocks[i]
    if (b.type === 'table' || b.type === 'textarea') {
      rows.push([b])
      i += 1
      continue
    }
    if (b.width === 'half' && i + 1 < blocks.length
        && blocks[i + 1].width === 'half'
        && blocks[i + 1].type !== 'table'
        && blocks[i + 1].type !== 'textarea') {
      rows.push([b, blocks[i + 1]])
      i += 2
    } else {
      rows.push([b])
      i += 1
    }
  }
  return rows
}

function BlockPreview({
  block,
  active,
  onSelect,
  onMove,
  onDelete,
  half,
}: {
  block: FieldBlock
  active: boolean
  onSelect: () => void
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
  half: boolean
}) {
  return (
    <div
      className={`${styles.blockRow}${active ? ' ' + styles.blockRowActive : ''}${half ? ' ' + styles.blockRowHalf : ''}`}
      onClick={onSelect}
    >
      <div className={styles.blockPreview}>
        <div className={styles.blockLabel}>
          {block.required && <span className={styles.blockRequired}>*</span>}
          {block.label}
        </div>
        <div className={styles.blockPreviewInput}>
          {previewText(block)}
        </div>
      </div>
      <div className={styles.blockControls}>
        <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); onMove(-1) }} type="button" title="위로">↑</button>
        <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); onMove(1) }} type="button" title="아래로">↓</button>
        <button className={styles.iconBtn} onClick={(e) => { e.stopPropagation(); onDelete() }} type="button" title="삭제">×</button>
      </div>
    </div>
  )
}

function previewText(b: FieldBlock): string {
  switch (b.type) {
    case 'text': return b.placeholder || '텍스트 입력'
    case 'textarea': return b.placeholder || '여러 줄 텍스트'
    case 'number': return b.placeholder || '0'
    case 'date': return 'YYYY-MM-DD'
    case 'select': return b.options?.map((o) => o.label).join(' / ') || '옵션 없음'
    case 'checkbox': return b.placeholder || '☐ 동의'
    case 'table': return `[테이블] ${(b.columns ?? []).map((c) => c.label).join(', ') || '컬럼 없음'}`
  }
}

function PropertyEditor({ block, onChange }: {
  block: FieldBlock
  onChange: (patch: Partial<FieldBlock>) => void
}) {
  return (
    <>
      <div className={styles.propField}>
        <label className={styles.propLabel}>라벨</label>
        <input
          className={styles.propInput}
          value={block.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </div>
      <div className={styles.propField}>
        <label className={styles.propLabel}>키 (저장 필드명)</label>
        <input
          className={styles.propInput}
          value={block.key}
          onChange={(e) => onChange({ key: e.target.value })}
        />
      </div>
      <div className={styles.propField}>
        <label className={styles.propLabel}>타입</label>
        <div className={`${styles.propInput} ${styles.propInputReadonly}`}>
          {typeLabel(block.type)}
        </div>
      </div>
      {block.type !== 'table' && block.type !== 'textarea' && (
        <div className={styles.propField}>
          <label className={styles.propLabel}>너비</label>
          <select
            className={styles.propSelect}
            value={block.width ?? 'full'}
            onChange={(e) => onChange({ width: e.target.value as FieldWidth })}
          >
            <option value="full">전체 (한 행)</option>
            <option value="half">절반 (2열)</option>
          </select>
        </div>
      )}
      {(block.type === 'text' || block.type === 'textarea' || block.type === 'number' || block.type === 'checkbox') && (
        <div className={styles.propField}>
          <label className={styles.propLabel}>
            {block.type === 'checkbox' ? '체크박스 문구' : 'placeholder'}
          </label>
          <input
            className={styles.propInput}
            value={block.placeholder ?? ''}
            onChange={(e) => onChange({ placeholder: e.target.value })}
          />
        </div>
      )}
      <div className={styles.propField}>
        <label className={styles.propCheckbox}>
          <input
            type="checkbox"
            checked={block.required}
            onChange={(e) => onChange({ required: e.target.checked })}
          />
          필수 입력
        </label>
      </div>
      {block.type === 'select' && (
        <div className={styles.propField}>
          <label className={styles.propLabel}>옵션</label>
          <div className={styles.optionsList}>
            {(block.options ?? []).map((opt, idx) => (
              <div key={idx} className={styles.optionRow}>
                <input
                  className={styles.optionInput}
                  placeholder="label"
                  value={opt.label}
                  onChange={(e) => {
                    const next = [...(block.options ?? [])]
                    next[idx] = { ...next[idx], label: e.target.value }
                    onChange({ options: next })
                  }}
                />
                <input
                  className={styles.optionInput}
                  placeholder="value"
                  value={opt.value}
                  onChange={(e) => {
                    const next = [...(block.options ?? [])]
                    next[idx] = { ...next[idx], value: e.target.value }
                    onChange({ options: next })
                  }}
                />
                <button
                  className={styles.iconBtn}
                  type="button"
                  onClick={() => {
                    const next = (block.options ?? []).filter((_, i) => i !== idx)
                    onChange({ options: next })
                  }}
                >×</button>
              </div>
            ))}
            <button
              className={styles.btn}
              type="button"
              onClick={() => {
                const next = [...(block.options ?? []), { value: `option${(block.options?.length ?? 0) + 1}`, label: '새 옵션' }]
                onChange({ options: next })
              }}
            >+ 옵션 추가</button>
          </div>
        </div>
      )}
      {block.type === 'table' && (
        <div className={styles.propField}>
          <label className={styles.propLabel}>컬럼</label>
          <div className={styles.optionsList}>
            {(block.columns ?? []).map((col, idx) => (
              <div key={idx} className={styles.columnRow}>
                <div className={styles.columnRowTop}>
                  <input
                    className={styles.optionInput}
                    placeholder="라벨"
                    value={col.label}
                    onChange={(e) => {
                      const next = [...(block.columns ?? [])]
                      next[idx] = { ...next[idx], label: e.target.value }
                      onChange({ columns: next })
                    }}
                  />
                  <button
                    className={styles.iconBtn}
                    type="button"
                    onClick={() => {
                      const next = (block.columns ?? []).filter((_, i) => i !== idx)
                      onChange({ columns: next })
                    }}
                  >×</button>
                </div>
                <div className={styles.columnRowBottom}>
                  <input
                    className={styles.optionInput}
                    placeholder="key"
                    value={col.key}
                    onChange={(e) => {
                      const next = [...(block.columns ?? [])]
                      next[idx] = { ...next[idx], key: e.target.value }
                      onChange({ columns: next })
                    }}
                  />
                  <select
                    className={styles.optionInput}
                    value={col.type}
                    onChange={(e) => {
                      const next = [...(block.columns ?? [])]
                      next[idx] = { ...next[idx], type: e.target.value as TableColumnType }
                      onChange({ columns: next })
                    }}
                  >
                    <option value="text">텍스트</option>
                    <option value="number">숫자</option>
                    <option value="date">날짜</option>
                    <option value="select">드롭다운</option>
                  </select>
                </div>
              </div>
            ))}
            <button
              className={styles.btn}
              type="button"
              onClick={() => {
                const existing = block.columns ?? []
                const nextCol: TableColumn = {
                  key: `col${existing.length + 1}`,
                  label: `컬럼${existing.length + 1}`,
                  type: 'text',
                }
                onChange({ columns: [...existing, nextCol] })
              }}
            >+ 컬럼 추가</button>
          </div>
        </div>
      )}
    </>
  )
}

function typeLabel(type: FieldBlockType): string {
  const map: Record<FieldBlockType, string> = {
    text: '텍스트',
    textarea: '멀티텍스트',
    number: '숫자',
    date: '날짜',
    select: '드롭다운',
    checkbox: '체크박스',
    table: '테이블',
  }
  return map[type]
}

function PreviewModal({
  name,
  schema,
  titlePlaceholder,
  onClose,
}: {
  name: string
  schema: FormSchema
  titlePlaceholder: string | null
  onClose: () => void
}) {
  const [content, setContent] = useState<Record<string, unknown>>({})
  const Body = useMemo(
    () => makeSchemaBody(schema, { titlePlaceholder }),
    [schema, titlePlaceholder],
  )
  const handleChange = (key: string, value: string) => {
    setContent((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className={styles.previewOverlay} onClick={onClose}>
      <div className={styles.previewPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.previewHead}>
          <span className={styles.previewTitle}>미리보기 — {name || '(이름 없음)'}</span>
          <button className={styles.btn} onClick={onClose} type="button">닫기</button>
        </div>
        <div className={styles.previewBody}>
          <Body content={content} onChange={handleChange} />
        </div>
        <div className={styles.previewHint}>
          입력한 값은 저장되지 않습니다. 실제 결재 작성 화면과 동일한 스타일로 렌더링됩니다.
        </div>
      </div>
    </div>
  )
}
