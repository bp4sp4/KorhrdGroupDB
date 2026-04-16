'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react'
import styles from '../hakjeom/page.module.css'
import { createClient } from '@/lib/supabase/client'

interface TrashItem {
  id: string | number
  source_table: string
  source_label: string
  name: string
  contact: string | null
  deleted_at: string
  delete_reason: string | null
}

const SOURCE_TABLES = [
  { value: 'all', label: '전체' },
  { value: 'hakjeom_consultations', label: '학점은행제 상담' },
  { value: 'private_cert_consultations', label: '민간자격증 상담' },
  { value: 'certificate_applications', label: '자격증 신청' },
  { value: 'agency_agreements', label: '기관협약' },
  { value: 'cert_students', label: '민간자격증 학생관리' },
]

function formatDateTime(dateString: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateString))
}

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterTable, setFilterTable] = useState('all')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [restoring, setRestoring] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [emptyingAll, setEmptyingAll] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const fetchTrash = useCallback(async () => {
    setLoading(true)
    setError('')
    setSelectedKeys(new Set())
    try {
      const res = await fetch('/api/trash')
      if (!res.ok) throw new Error('휴지통 데이터를 불러오는데 실패했습니다.')
      setItems(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTrash()

    const supabase = createClient()
    const tables = ['hakjeom_consultations', 'private_cert_consultations', 'certificate_applications', 'agency_agreements', 'cert_students']

    const channel = supabase.channel('trash-realtime')
    tables.forEach(table => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        fetchTrash()
      })
    })
    channel.subscribe()
    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [fetchTrash])

  // 필터링된 목록
  const filtered = filterTable === 'all'
    ? items
    : items.filter(i => i.source_table === filterTable)

  // 유니크 키: "table::id"
  const itemKey = (item: TrashItem) => `${item.source_table}::${item.id}`

  const toggleSelect = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedKeys.size === filtered.length) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(filtered.map(itemKey)))
    }
  }

  // 선택된 항목을 테이블별로 그룹화
  const groupSelected = () => {
    const groups: Record<string, (string | number)[]> = {}
    for (const key of selectedKeys) {
      const item = items.find(i => itemKey(i) === key)
      if (!item) continue
      if (!groups[item.source_table]) groups[item.source_table] = []
      groups[item.source_table].push(item.id)
    }
    return groups
  }

  // 복원
  const handleRestore = async () => {
    if (selectedKeys.size === 0) return
    setRestoring(true)
    try {
      const groups = groupSelected()
      await Promise.all(
        Object.entries(groups).map(([source_table, ids]) =>
          fetch('/api/trash', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_table, ids }),
          })
        )
      )
      await fetchTrash()
    } finally {
      setRestoring(false)
    }
  }

  // 선택 영구 삭제
  const handlePermanentDelete = async () => {
    if (selectedKeys.size === 0) return
    if (!confirm(`선택한 ${selectedKeys.size}건을 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return
    setDeleting(true)
    try {
      const groups = groupSelected()
      await Promise.all(
        Object.entries(groups).map(([source_table, ids]) =>
          fetch('/api/trash', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_table, ids }),
          })
        )
      )
      await fetchTrash()
    } finally {
      setDeleting(false)
    }
  }

  // 전체 비우기
  const handleEmptyAll = async () => {
    if (items.length === 0) return
    if (!confirm(`휴지통의 모든 항목(${items.length}건)을 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return
    setEmptyingAll(true)
    try {
      await fetch('/api/trash', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      await fetchTrash()
    } finally {
      setEmptyingAll(false)
    }
  }

  const allSelected = filtered.length > 0 && selectedKeys.size === filtered.length

  return (
    <div>
      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Trash2 size={20} color="var(--toss-text-secondary)" />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--toss-text-primary)', margin: 0 }}>삭제목록</h2>
          {items.length > 0 && (
            <span style={{
              fontSize: 12, fontWeight: 600,
              background: '#fee2e2', color: '#991b1b',
              padding: '2px 8px', borderRadius: 20,
            }}>
              {items.length}건
            </span>
          )}
        </div>
        <p style={{ fontSize: 14, color: 'var(--toss-text-secondary)', margin: 0 }}>
          삭제된 항목을 복원하거나 영구 삭제할 수 있습니다.
        </p>
      </div>

      {/* 안내 배너 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#fff7ed', border: '1px solid #fed7aa',
        borderRadius: 'var(--toss-radius-card)', padding: '10px 16px',
        marginBottom: 16, fontSize: 13, color: '#92400e',
      }}>
        <AlertTriangle size={15} />
        삭제목록 항목은 복원하거나 영구 삭제할 수 있습니다. 영구 삭제 후에는 복구가 불가능합니다.
      </div>

      {/* 필터 + 액션 */}
      <div className={styles.filterRow}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SOURCE_TABLES.map(t => (
            <button
              key={t.value}
              onClick={() => { setFilterTable(t.value); setSelectedKeys(new Set()) }}
              style={{
                padding: '6px 14px', fontSize: 13, fontWeight: filterTable === t.value ? 600 : 400,
                border: '1px solid var(--toss-border)', borderRadius: 20,
                background: filterTable === t.value ? 'var(--toss-blue)' : 'var(--toss-card-bg)',
                color: filterTable === t.value ? '#fff' : 'var(--toss-text-secondary)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          {selectedKeys.size > 0 && (
            <>
              <button
                onClick={handleRestore}
                disabled={restoring}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', fontSize: 13, fontWeight: 600,
                  border: '1px solid #3182f6', borderRadius: 8,
                  background: '#eff6ff', color: '#3182f6',
                  cursor: restoring ? 'not-allowed' : 'pointer',
                }}
              >
                <RotateCcw size={14} />
                {restoring ? '복원 중...' : `복원 (${selectedKeys.size})`}
              </button>
              <button
                onClick={handlePermanentDelete}
                disabled={deleting}
                className={styles.btnDanger}
              >
                {deleting ? '삭제 중...' : `영구 삭제 (${selectedKeys.size})`}
              </button>
            </>
          )}
          {items.length > 0 && (
            <button
              onClick={handleEmptyAll}
              disabled={emptyingAll}
              style={{
                padding: '8px 14px', fontSize: 13, fontWeight: 600,
                border: '1px solid #f87171', borderRadius: 8,
                background: 'transparent', color: '#dc2626',
                cursor: emptyingAll ? 'not-allowed' : 'pointer',
              }}
            >
              {emptyingAll ? '비우는 중...' : '휴지통 비우기'}
            </button>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div className={styles.tableCard}>
        <div className={styles.tableOverflow}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th} style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th className={styles.th}>이름</th>
                <th className={styles.th}>연락처</th>
                <th className={styles.th}>분류</th>
                <th className={styles.th}>삭제사유</th>
                <th className={styles.th}>삭제일</th>
                <th className={styles.th}>작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className={styles.td} style={{ textAlign: 'center', padding: 60, color: 'var(--toss-text-secondary)' }}>
                    불러오는 중...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className={styles.td} style={{ textAlign: 'center', padding: 40, color: '#dc2626' }}>
                    {error}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.td} style={{ textAlign: 'center', padding: 60 }}>
                    <Trash2 size={32} color="var(--toss-text-tertiary)" style={{ marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
                    <p style={{ color: 'var(--toss-text-secondary)', fontSize: 14, margin: 0 }}>휴지통이 비어 있습니다.</p>
                  </td>
                </tr>
              ) : filtered.map(item => {
                const key = itemKey(item)
                const isSelected = selectedKeys.has(key)
                return (
                  <tr
                    key={key}
                    className={styles.tr}
                    style={{ background: isSelected ? 'var(--toss-blue-subtle)' : undefined }}
                    onClick={() => toggleSelect(key)}
                  >
                    <td className={styles.td} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(key)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td className={styles.td} style={{ fontWeight: 600 }}>{item.name}</td>
                    <td className={styles.td}>{item.contact ?? '-'}</td>
                    <td className={styles.td}>
                      <span className={styles.statusBadge} style={{ background: '#f3f4f6', color: '#374151' }}>
                        {item.source_label}
                      </span>
                    </td>
                    <td className={styles.td} style={{ color: item.delete_reason ? 'var(--toss-text-primary)' : 'var(--toss-text-tertiary)' }}>
                      {item.delete_reason ?? '-'}
                    </td>
                    <td className={styles.td} style={{ color: 'var(--toss-text-secondary)' }}>
                      {formatDateTime(item.deleted_at)}
                    </td>
                    <td className={styles.td} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={async () => {
                            setRestoring(true)
                            try {
                              await fetch('/api/trash', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ source_table: item.source_table, ids: [item.id] }),
                              })
                              await fetchTrash()
                            } finally { setRestoring(false) }
                          }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 10px', fontSize: 12, fontWeight: 600,
                            border: '1px solid #3182f6', borderRadius: 6,
                            background: '#eff6ff', color: '#3182f6', cursor: 'pointer',
                          }}
                        >
                          <RotateCcw size={12} /> 복원
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`"${item.name}"을 영구 삭제할까요?`)) return
                            setDeleting(true)
                            try {
                              await fetch('/api/trash', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ source_table: item.source_table, ids: [item.id] }),
                              })
                              await fetchTrash()
                            } finally { setDeleting(false) }
                          }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 10px', fontSize: 12, fontWeight: 600,
                            border: '1px solid #f87171', borderRadius: 6,
                            background: '#fff1f1', color: '#dc2626', cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={12} /> 영구삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--toss-border)', fontSize: 13, color: 'var(--toss-text-secondary)' }}>
            {filterTable === 'all' ? `전체 ${items.length}건` : `${filtered.length}건`}
          </div>
        )}
      </div>
    </div>
  )
}
