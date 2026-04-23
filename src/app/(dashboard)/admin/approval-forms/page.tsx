'use client'

import { useEffect, useState, useCallback } from 'react'
import styles from './page.module.css'
import { FormEditor } from './FormEditor'
import type { ApprovalFormCategory, ApprovalFormTemplate } from '@/types/approvalForm'
import { emptySchema } from '@/types/approvalForm'
import type { ApprovalTemplate } from '@/lib/management/types'

export default function ApprovalFormsAdminPage() {
  const [categories, setCategories] = useState<ApprovalFormCategory[]>([])
  const [templates, setTemplates] = useState<ApprovalFormTemplate[]>([])
  const [approvalTemplates, setApprovalTemplates] = useState<ApprovalTemplate[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ApprovalFormTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadCategories = useCallback(async () => {
    const res = await fetch('/api/admin/approval-form-categories')
    if (!res.ok) return
    const data = (await res.json()) as ApprovalFormCategory[]
    setCategories(data)
  }, [])

  const loadTemplates = useCallback(async (categoryId: string | null) => {
    const url = categoryId
      ? `/api/admin/approval-form-templates?category_id=${categoryId}`
      : '/api/admin/approval-form-templates'
    const res = await fetch(url)
    if (!res.ok) return
    const data = (await res.json()) as ApprovalFormTemplate[]
    setTemplates(data)
  }, [])

  useEffect(() => {
    (async () => {
      setLoading(true)
      await loadCategories()
      await loadTemplates(null)
      // 결재선 템플릿 목록 (기본 결재선 드롭다운용)
      try {
        const res = await fetch('/api/admin/approval-templates')
        if (res.ok) {
          const data = (await res.json()) as ApprovalTemplate[]
          setApprovalTemplates(data.filter((t) => t.is_active))
        }
      } catch {}
      setLoading(false)
    })()
  }, [loadCategories, loadTemplates])

  useEffect(() => {
    loadTemplates(selectedCategoryId)
  }, [selectedCategoryId, loadTemplates])

  // ────────── 카테고리 CRUD ──────────
  const addCategory = async () => {
    const name = prompt('카테고리명')
    if (!name || !name.trim()) return
    const res = await fetch('/api/admin/approval-form-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(`카테고리 추가 실패: ${err.error ?? res.statusText}`)
      return
    }
    await loadCategories()
  }

  const renameCategory = async (cat: ApprovalFormCategory) => {
    const name = prompt('새 카테고리명', cat.name)
    if (!name || !name.trim() || name === cat.name) return
    await fetch(`/api/admin/approval-form-categories/${cat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    await loadCategories()
  }

  const deleteCategory = async (cat: ApprovalFormCategory) => {
    if (!confirm(`"${cat.name}" 카테고리를 삭제하시겠습니까?\n하위 양식의 카테고리는 (없음)으로 이동합니다.`)) return
    await fetch(`/api/admin/approval-form-categories/${cat.id}`, { method: 'DELETE' })
    if (selectedCategoryId === cat.id) setSelectedCategoryId(null)
    await loadCategories()
  }

  // ────────── 양식 CRUD ──────────
  const createNewTemplate = () => {
    const now = new Date().toISOString()
    const draft: ApprovalFormTemplate = {
      id: '',
      category_id: selectedCategoryId,
      name: '',
      document_type: `custom_${Date.now()}`,
      description: null,
      schema: emptySchema(),
      supports_attachments: false,
      is_active: true,
      sort_order: 0,
      default_approval_template_id: null,
      title_placeholder: null,
      synced_template_id: null,
      created_at: now,
      updated_at: now,
    }
    setEditing(draft)
  }

  const openTemplate = (tmpl: ApprovalFormTemplate) => {
    setEditing(tmpl)
  }

  const saveTemplate = async (patch: Partial<ApprovalFormTemplate>) => {
    if (!editing) return
    setSaving(true)
    try {
      const isNew = !editing.id
      const url = isNew
        ? '/api/admin/approval-form-templates'
        : `/api/admin/approval-form-templates/${editing.id}`
      const method = isNew ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(`저장 실패: ${err.error ?? res.statusText}`)
        return
      }
      await loadTemplates(selectedCategoryId)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  const deleteTemplate = async () => {
    if (!editing?.id) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/approval-form-templates/${editing.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        alert('삭제 실패')
        return
      }
      await loadTemplates(selectedCategoryId)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  // ────────── 렌더 ──────────
  if (editing) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>결재 양식 편집</h1>
          <span className={styles.breadcrumb}>
            {editing.id ? editing.name || '(이름 없음)' : '새 양식'}
          </span>
        </div>
        <FormEditor
          template={editing}
          categories={categories}
          approvalTemplates={approvalTemplates}
          onSave={saveTemplate}
          onCancel={() => setEditing(null)}
          onDelete={editing.id ? deleteTemplate : undefined}
          saving={saving}
        />
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>결재 양식 관리</h1>
        <span className={styles.breadcrumb}>관리자 / 전자결재 / 결재 양식</span>
      </div>

      {loading ? (
        <div className={styles.loading}>불러오는 중...</div>
      ) : (
        <div className={styles.body}>
          {/* 좌: 카테고리 */}
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHead}>
              <span>카테고리</span>
              <button className={styles.iconBtn} onClick={addCategory} type="button">+ 추가</button>
            </div>
            <div className={styles.sidebarBody}>
              <div
                className={`${styles.catItem}${selectedCategoryId === null ? ' ' + styles.catItemActive : ''}`}
                onClick={() => setSelectedCategoryId(null)}
              >
                <span>전체</span>
              </div>
              {categories.map((c) => (
                <div
                  key={c.id}
                  className={`${styles.catItem}${selectedCategoryId === c.id ? ' ' + styles.catItemActive : ''}`}
                  onClick={() => setSelectedCategoryId(c.id)}
                >
                  <span>{c.name}</span>
                  <span className={styles.catActions}>
                    <button
                      className={styles.iconBtn}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); renameCategory(c) }}
                    >수정</button>
                    <button
                      className={styles.iconBtn}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteCategory(c) }}
                    >삭제</button>
                  </span>
                </div>
              ))}
            </div>
          </aside>

          {/* 중: 양식 목록 */}
          <main className={styles.main}>
            <div className={styles.mainHead}>
              <h2 className={styles.mainTitle}>
                {selectedCategoryId
                  ? categories.find((c) => c.id === selectedCategoryId)?.name ?? '양식'
                  : '전체 양식'}
              </h2>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={createNewTemplate}
                type="button"
              >+ 양식 추가</button>
            </div>
            <div className={styles.mainBody}>
              {templates.length === 0 ? (
                <div className={styles.emptyState}>등록된 양식이 없습니다.</div>
              ) : (
                <table className={styles.formTable}>
                  <thead>
                    <tr>
                      <th>양식명</th>
                      <th>문서 코드</th>
                      <th>필드 수</th>
                      <th>상태</th>
                      <th>수정일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => (
                      <tr key={t.id} onClick={() => openTemplate(t)}>
                        <td>{t.name}</td>
                        <td style={{ color: '#6b7280', fontFamily: 'monospace' }}>{t.document_type}</td>
                        <td>{t.schema?.blocks?.length ?? 0}</td>
                        <td>
                          <span className={`${styles.statusBadge} ${t.is_active ? styles.statusActive : styles.statusInactive}`}>
                            {t.is_active ? '활성' : '비활성'}
                          </span>
                        </td>
                        <td style={{ color: '#6b7280', fontSize: 12 }}>
                          {new Date(t.updated_at).toLocaleDateString('ko-KR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </main>
        </div>
      )}
    </div>
  )
}
