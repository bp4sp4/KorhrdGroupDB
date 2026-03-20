'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './MemoTimeline.module.css'

interface MemoLog {
  id: string
  content: string
  author: string | null
  created_at: string
}

interface Props {
  tableName: string
  recordId: string
  legacyMemo?: string | null
  onCountChange?: (count: number) => void
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const DATE_REGEX = /(\d{4}[./]\d{1,2}[./]\d{1,2}|\d{1,2}[./]\d{1,2})/g

function renderWithDates(text: string) {
  const parts = text.split(DATE_REGEX)
  return parts.map((part, i) =>
    DATE_REGEX.test(part)
      ? <mark key={i} className={styles.dateMark}>{part}</mark>
      : part
  )
}

// DATE_REGEX는 split 후 lastIndex가 남아있어 리셋 필요
function renderContent(text: string) {
  const lines = text.split('\n')
  return lines.map((line, li) => {
    DATE_REGEX.lastIndex = 0
    const parts = line.split(DATE_REGEX)
    return (
      <span key={li}>
        {parts.map((part, i) => {
          DATE_REGEX.lastIndex = 0
          return DATE_REGEX.test(part)
            ? <mark key={i} className={styles.dateMark}>{part}</mark>
            : part
        })}
        {li < lines.length - 1 && '\n'}
      </span>
    )
  })
}

function fmtAuthor(email: string | null) {
  if (!email) return '담당자'
  return email.split('@')[0]
}

export default function MemoTimeline({ tableName, recordId, legacyMemo, onCountChange }: Props) {
  const [logs, setLogs] = useState<MemoLog[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const timelineRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(3)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/memo-logs?table=${tableName}&id=${recordId}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data)
        onCountChange?.(data.length)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, [tableName, recordId])

  const handleAdd = async () => {
    if (!input.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/memo-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_name: tableName, record_id: recordId, content: input.trim() }),
      })
      if (res.ok) {
        setInput('')
        setVisibleCount(3)
        await fetchLogs()
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('메모를 삭제하시겠습니까?')) return
    await fetch(`/api/memo-logs?id=${id}`, { method: 'DELETE' })
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  const handleEditStart = (log: MemoLog) => {
    setEditingId(log.id)
    setEditValue(log.content)
  }

  const handleEditCancel = () => {
    setEditingId(null)
    setEditValue('')
  }

  const handleEditSave = async (id: string) => {
    if (!editValue.trim() || editSaving) return
    setEditSaving(true)
    try {
      const res = await fetch('/api/memo-logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content: editValue.trim() }),
      })
      if (res.ok) {
        const updated = await res.json()
        setLogs(prev => prev.map(l => l.id === id ? { ...l, content: updated.content } : l))
        setEditingId(null)
        setEditValue('')
      }
    } finally {
      setEditSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd()
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, id: string) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleEditSave(id)
    if (e.key === 'Escape') handleEditCancel()
  }

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  const autoResizeEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  const [legacyEditing, setLegacyEditing] = useState(false)
  const [legacyEditValue, setLegacyEditValue] = useState('')
  const [legacySaving, setLegacySaving] = useState(false)

  const handleLegacyEditStart = () => {
    setLegacyEditValue(legacyMemo ?? '')
    setLegacyEditing(true)
  }

  const handleLegacyEditCancel = () => {
    setLegacyEditing(false)
    setLegacyEditValue('')
  }

  const handleLegacyEditSave = async () => {
    if (!legacyEditValue.trim() || legacySaving) return
    setLegacySaving(true)
    try {
      const res = await fetch('/api/memo-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_name: tableName, record_id: recordId, content: legacyEditValue.trim() }),
      })
      if (res.ok) {
        setLegacyEditing(false)
        setLegacyEditValue('')
        await fetchLogs()
      }
    } finally {
      setLegacySaving(false)
    }
  }

  const handleLegacyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleLegacyEditSave()
    if (e.key === 'Escape') handleLegacyEditCancel()
  }

  const showLegacy = legacyMemo && logs.length === 0 && !loading
  const visibleLogs = logs.slice(0, visibleCount)
  const hiddenCount = logs.length - visibleCount

  return (
    <div className={styles.wrap}>
      {/* 타임라인 */}
      <div className={styles.timeline} ref={timelineRef}>
        {loading && (
          <>
            {[1, 2].map(i => (
              <div key={i} className={styles.logItem}>
                <div className={`${styles.logDot} ${styles.skelDot}`} />
                <div className={styles.logBody}>
                  <div className={styles.logHeader}>
                    <span className={`${styles.skel} ${styles.skelName}`} />
                    <span className={`${styles.skel} ${styles.skelTime}`} />
                  </div>
                  <div className={`${styles.skel} ${styles.skelContent}`} />
                </div>
              </div>
            ))}
          </>
        )}

        {!loading && logs.length === 0 && !legacyMemo && (
          <p className={styles.empty}>작성된 메모가 없습니다.</p>
        )}

        {/* 더 보기 */}
        {hiddenCount > 0 && (
          <button className={styles.loadMoreBtn} onClick={() => setVisibleCount(c => c + 3)}>
            이전 메모 {hiddenCount}개 더 보기
          </button>
        )}

        {/* 신규 메모 로그 */}
        {visibleLogs.map(log => (
          <div key={log.id} className={styles.logItem}>
            <div className={styles.logDot} />
            <div className={styles.logBody}>
              <div className={styles.logHeader}>
                <span className={styles.logAuthor}>{fmtAuthor(log.author)}</span>
                <span className={styles.logTime}>{fmtDateTime(log.created_at)}</span>
                {editingId !== log.id && (
                  <>
                    <button className={styles.editBtn} onClick={() => handleEditStart(log)}>수정</button>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(log.id)}>삭제</button>
                  </>
                )}
              </div>
              {editingId === log.id ? (
                <div className={styles.editWrap}>
                  <textarea
                    className={styles.editTextarea}
                    value={editValue}
                    onChange={autoResizeEdit}
                    onKeyDown={e => handleEditKeyDown(e, log.id)}
                    autoFocus
                  />
                  <div className={styles.editActions}>
                    <span className={styles.inputHint}>Cmd+Enter로 저장 · Esc로 취소</span>
                    <div className={styles.editBtns}>
                      <button className={styles.cancelBtn} onClick={handleEditCancel}>취소</button>
                      <button
                        className={styles.addBtn}
                        onClick={() => handleEditSave(log.id)}
                        disabled={!editValue.trim() || editSaving}
                      >
                        {editSaving ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <pre className={styles.logContent}>{renderContent(log.content)}</pre>
              )}
            </div>
          </div>
        ))}

        {/* 기존 메모 (마이그레이션 전 레거시) */}
        {showLegacy && (
          <div className={`${styles.logItem} ${styles.logItemLegacy}`}>
            <div className={styles.logDot} />
            <div className={styles.logBody}>
              <div className={styles.logHeader}>
                <span className={styles.logAuthor}>이전 메모</span>
                <span className={`${styles.logTime} ${styles.logTimeLegacy}`}>기존 저장</span>
                {!legacyEditing && (
                  <button className={styles.editBtn} onClick={handleLegacyEditStart}>수정</button>
                )}
              </div>
              {legacyEditing ? (
                <div className={styles.editWrap}>
                  <textarea
                    className={styles.editTextarea}
                    value={legacyEditValue}
                    onChange={e => {
                      setLegacyEditValue(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = `${e.target.scrollHeight}px`
                    }}
                    onKeyDown={handleLegacyKeyDown}
                    autoFocus
                  />
                  <div className={styles.editActions}>
                    <span className={styles.inputHint}>Cmd+Enter로 저장 · Esc로 취소</span>
                    <div className={styles.editBtns}>
                      <button className={styles.cancelBtn} onClick={handleLegacyEditCancel}>취소</button>
                      <button
                        className={styles.addBtn}
                        onClick={handleLegacyEditSave}
                        disabled={!legacyEditValue.trim() || legacySaving}
                      >
                        {legacySaving ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <pre className={styles.logContent}>{renderContent(legacyMemo ?? '')}</pre>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 입력창 */}
      <div className={styles.inputWrap}>
        <textarea
          ref={textareaRef}
          className={styles.input}
          placeholder={`메모 내용을 입력하세요\n(Cmd+Enter 또는 Ctrl+Enter로 저장)`}
          value={input}
          onChange={autoResize}
          onKeyDown={handleKeyDown}
          rows={3}
        />
        <div className={styles.inputFooter}>
          <span className={styles.inputHint}>Cmd+Enter로 저장</span>
          <button
            className={styles.addBtn}
            onClick={handleAdd}
            disabled={!input.trim() || saving}
          >
            {saving ? '저장 중...' : '메모 추가'}
          </button>
        </div>
      </div>
    </div>
  )
}
