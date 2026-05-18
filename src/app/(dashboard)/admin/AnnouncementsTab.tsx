'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Trash2, Plus, X, Paperclip, FileText, Pencil } from 'lucide-react'
import styles from './AnnouncementsTab.module.css'

interface AnnouncementAttachment {
  name: string
  url: string
  type?: string
  size?: number
}

interface Announcement {
  id: number
  date: string
  title: string
  items: string[]
  attachments?: AnnouncementAttachment[] | null
  created_at?: string
}

function formatFileSize(bytes?: number): string {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function AnnouncementsTab() {
  const [list, setList] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  // 폼 상태
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formDate, setFormDate] = useState<string>(todayStr())
  const [formTitle, setFormTitle] = useState<string>('')
  const [formItems, setFormItems] = useState<string[]>([''])
  const [formAtts, setFormAtts] = useState<AnnouncementAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/announcements')
      if (!res.ok) {
        setList([])
        return
      }
      const data = await res.json()
      setList(Array.isArray(data.items) ? data.items : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const resetForm = () => {
    setEditingId(null)
    setFormDate(todayStr())
    setFormTitle('')
    setFormItems([''])
    setFormAtts([])
  }

  const handleEditStart = (a: Announcement) => {
    setEditingId(a.id)
    setFormDate(a.date)
    setFormTitle(a.title)
    setFormItems(a.items.length > 0 ? [...a.items] : [''])
    setFormAtts(a.attachments ?? [])
  }

  const handleItemChange = (i: number, value: string) => {
    setFormItems((prev) => prev.map((v, idx) => (idx === i ? value : v)))
  }

  const handleItemAdd = () => {
    setFormItems((prev) => [...prev, ''])
  }

  const handleItemRemove = (i: number) => {
    setFormItems((prev) =>
      prev.length === 1 ? [''] : prev.filter((_, idx) => idx !== i),
    )
  }

  const handleFilesPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const fd = new FormData()
      Array.from(files).forEach((f) => fd.append('files', f))
      const res = await fetch('/api/admin/announcements/upload', {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '업로드 실패' }))
        alert(err.error ?? '업로드 실패')
        return
      }
      const data = (await res.json()) as { files: AnnouncementAttachment[] }
      setFormAtts((prev) => [...prev, ...data.files])
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAttRemove = (i: number) => {
    setFormAtts((prev) => prev.filter((_, idx) => idx !== i))
  }

  const handleSubmit = async () => {
    const title = formTitle.trim()
    if (!title) {
      alert('제목을 입력해주세요.')
      return
    }
    const items = formItems.map((s) => s.trim()).filter(Boolean)

    setSaving(true)
    try {
      const url = editingId
        ? `/api/admin/announcements/${editingId}`
        : '/api/admin/announcements'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formDate,
          title,
          items,
          attachments: formAtts,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '저장 실패' }))
        alert(err.error ?? '저장 실패')
        return
      }
      resetForm()
      await fetchList()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('이 공지를 삭제하시겠습니까? 첨부파일도 함께 삭제됩니다.')) {
      return
    }
    const res = await fetch(`/api/admin/announcements/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '삭제 실패' }))
      alert(err.error ?? '삭제 실패')
      return
    }
    if (editingId === id) resetForm()
    await fetchList()
  }

  return (
    <div className={styles.wrap}>
      {/* 작성/수정 폼 */}
      <section className={styles.formCard}>
        <header className={styles.formHeader}>
          <h3 className={styles.formTitle}>
            {editingId ? '공지 수정' : '새 공지 작성'}
          </h3>
          {editingId && (
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={resetForm}
            >
              취소
            </button>
          )}
        </header>

        <div className={styles.formRow}>
          <label className={styles.label}>날짜</label>
          <input
            type="date"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.label}>제목</label>
          <input
            type="text"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="예) 12월 업무 일정 안내"
            className={styles.input}
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.label}>내용 (불릿)</label>
          <div className={styles.itemList}>
            {formItems.map((v, i) => (
              <div key={i} className={styles.itemRow}>
                <input
                  type="text"
                  value={v}
                  onChange={(e) => handleItemChange(i, e.target.value)}
                  placeholder={`${i + 1}번째 항목`}
                  className={styles.input}
                />
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => handleItemRemove(i)}
                  aria-label="항목 삭제"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.addRowBtn}
              onClick={handleItemAdd}
            >
              <Plus size={14} /> 항목 추가
            </button>
          </div>
        </div>

        <div className={styles.formRow}>
          <label className={styles.label}>첨부파일</label>
          <div className={styles.attachWrap}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFilesPick}
              className={styles.fileInput}
              disabled={uploading}
            />
            <button
              type="button"
              className={styles.attachBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Paperclip size={14} />
              {uploading ? '업로드 중...' : '파일 선택'}
            </button>

            {formAtts.length > 0 && (
              <ul className={styles.attachList}>
                {formAtts.map((a, i) => (
                  <li key={i} className={styles.attachItem}>
                    <FileText size={14} />
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.attachLink}
                    >
                      {a.name}
                    </a>
                    {a.size != null && (
                      <span className={styles.attachSize}>
                        {formatFileSize(a.size)}
                      </span>
                    )}
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => handleAttRemove(i)}
                      aria-label="첨부 제거"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className={styles.formFooter}>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={saving || uploading}
          >
            {saving ? '저장 중...' : editingId ? '공지 수정' : '공지 등록'}
          </button>
        </div>
      </section>

      {/* 목록 */}
      <section className={styles.listCard}>
        <header className={styles.listHeader}>
          <h3 className={styles.listTitle}>등록된 공지</h3>
          <span className={styles.listCount}>{list.length}건</span>
        </header>

        {loading ? (
          <div className={styles.emptyState}>불러오는 중...</div>
        ) : list.length === 0 ? (
          <div className={styles.emptyState}>등록된 공지가 없습니다.</div>
        ) : (
          <ul className={styles.list}>
            {list.map((a) => (
              <li key={a.id} className={styles.listItem}>
                <div className={styles.listItemHeader}>
                  <span className={styles.listItemDate}>{a.date}</span>
                  <span className={styles.listItemTitle}>{a.title}</span>
                  <div className={styles.listItemActions}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => handleEditStart(a)}
                    >
                      <Pencil size={13} /> 수정
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => handleDelete(a.id)}
                    >
                      <Trash2 size={13} /> 삭제
                    </button>
                  </div>
                </div>
                {a.items.length > 0 && (
                  <ul className={styles.listItemBody}>
                    {a.items.map((it, i) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ul>
                )}
                {a.attachments && a.attachments.length > 0 && (
                  <ul className={styles.listAttachList}>
                    {a.attachments.map((att, i) => (
                      <li key={i} className={styles.listAttachItem}>
                        <FileText size={13} />
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {att.name}
                        </a>
                        {att.size != null && (
                          <span className={styles.attachSize}>
                            {formatFileSize(att.size)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
