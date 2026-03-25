'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Copy, ChevronDown, ChevronUp, ExternalLink, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './page.module.css'

interface DuplicateEntry {
  table: string
  tableLabel: string
  link: string
  tab: string
  id: string | number
  name: string
  contact: string
  status: string | null
  manager?: string | null
  createdAt: string
}

interface DuplicateGroup {
  key: string
  name: string
  contact: string
  count: number
  tableCount: number
  entries: DuplicateEntry[]
}

const PAGE_SIZE = 20

const FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'hakjeom_consultations', label: '학점은행제' },
  { value: 'private_cert_consultations', label: '민간자격증' },
  { value: 'certificate_applications', label: '자격증 신청' },
  { value: 'agency_agreements', label: '기관협약' },
  { value: 'practice_consultations', label: '실습/취업' },
]

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(dateString))
}

export default function DuplicatePage() {
  const [loading, setLoading] = useState(true)
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
  const [error, setError] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)

  const fetchDuplicates = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/search/duplicate')
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '오류가 발생했습니다.'); return }
      setDuplicates(data.duplicates ?? [])
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDuplicates() }, [fetchDuplicates])

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const filtered = useMemo(() => {
    setPage(1)
    if (filter === 'all') return duplicates
    return duplicates.filter(g => g.entries.some(e => e.table === filter))
  }, [duplicates, filter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className={styles.container}>

      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.titleLeft}>
            <Copy size={18} color="var(--toss-text-secondary)" />
            <h2 className={styles.titleText}>중복 신청</h2>
            {!loading && filtered.length > 0 && (
              <span className={styles.totalBadge}>{filtered.length}명</span>
            )}
          </div>
          <button onClick={fetchDuplicates} className={styles.refreshBtn} disabled={loading}>
            <RefreshCw size={14} className={loading ? styles.spinning : ''} />
            새로고침
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className={styles.filterRow}>
        {FILTERS.map(f => {
          const count = f.value === 'all'
            ? duplicates.length
            : duplicates.filter(g => g.entries.some(e => e.table === f.value)).length
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`${styles.filterBtn} ${filter === f.value ? styles.filterBtnActive : ''}`}
            >
              {f.label}
              {count > 0 && (
                <span className={`${styles.filterCount} ${filter === f.value ? styles.filterCountActive : ''}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 결과 */}
      {loading ? (
        <div className={styles.loadingBox}>
          <RefreshCw size={24} className={styles.spinning} color="var(--toss-blue)" />
          <p>스캔 중...</p>
        </div>
      ) : error ? (
        <div className={styles.errorBox}>{error}</div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyBox}>
          <p>중복 신청 내역이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className={styles.tableCard}>
            <div className={styles.tableHead}>
              <span>이름</span>
              <span>연락처</span>
              <span>사업부</span>
              <span style={{ textAlign: 'right' }}>건수</span>
              <span />
            </div>

            {paginated.map(group => {
              const isExpanded = expandedKeys.has(group.key)
              const tableNames = [...new Set(group.entries.map(e => e.tableLabel))].join(' · ')
              return (
                <div key={group.key} className={styles.groupWrap}>
                  <button className={styles.row} onClick={() => toggleExpand(group.key)}>
                    <span className={styles.nameText}>{group.name}</span>
                    <span className={styles.colContact}>{group.contact}</span>
                    <span className={styles.tableNames}>{tableNames}</span>
                    <span style={{ textAlign: 'right' }}>
                      <span className={styles.countBadge}>{group.count}건</span>
                    </span>
                    <span className={styles.colToggle}>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className={styles.detail}>
                      <div className={styles.detailHead}>
                        <span>사업부</span>
                        <span>상태</span>
                        <span>담당자</span>
                        <span>신청일</span>
                        <span />
                      </div>
                      {group.entries.map((entry, idx) => (
                        <div key={`${entry.table}-${entry.id}-${idx}`} className={styles.detailRow}>
                          <span className={styles.detailLabel}>{entry.tableLabel}</span>
                          <span className={styles.detailStatus}>{entry.status ?? '—'}</span>
                          <span className={styles.detailManager}>{entry.manager ?? '—'}</span>
                          <span className={styles.detailDate}>{formatDate(entry.createdAt)}</span>
                          <Link
                            href={`${entry.link}?tab=${entry.tab}&highlight=${entry.id}`}
                            className={styles.linkBtn}
                            target="_blank"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink size={11} />
                            보기
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {totalPages > 0 && (
              <div className={styles.tableFooter}>
                <span className={styles.footerInfo}>
                  {filtered.length}명 중 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}
                </span>
                <div className={styles.pagination}>
                  <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                    .reduce<(number | '...')[]>((acc, n, i, arr) => {
                      if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('...')
                      acc.push(n)
                      return acc
                    }, [])
                    .map((n, i) =>
                      n === '...'
                        ? <span key={`e-${i}`} className={styles.pageEllipsis}>…</span>
                        : <button key={n} className={`${styles.pageBtn} ${page === n ? styles.pageBtnActive : ''}`} onClick={() => setPage(n as number)}>{n}</button>
                    )}
                  <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
