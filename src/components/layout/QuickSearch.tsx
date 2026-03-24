'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, ArrowRight, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import styles from './QuickSearch.module.css'

interface SearchResult {
  category: string
  categoryLabel: string
  link: string
  tab?: string
  id: string | number
  name: string
  sub: string
  status?: string
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  '상담대기': { bg: '#EBF3FE', color: '#3182F6' },
  '상담중': { bg: '#FFF8E6', color: '#D97706' },
  '보류': { bg: '#F3F4F6', color: '#6B7684' },
  '등록대기': { bg: '#FEF3C7', color: '#B45309' },
  '등록완료': { bg: '#DCFCE7', color: '#16A34A' },
  '협약대기': { bg: '#EBF3FE', color: '#3182F6' },
  '협약중': { bg: '#FFF8E6', color: '#D97706' },
  '협약완료': { bg: '#DCFCE7', color: '#16A34A' },
  '취업추진중': { bg: '#FFF8E6', color: '#D97706' },
  '완료': { bg: '#DCFCE7', color: '#16A34A' },
  'paid': { bg: '#DCFCE7', color: '#16A34A' },
  'pending': { bg: '#FEF3C7', color: '#B45309' },
  'failed': { bg: '#FEE2E2', color: '#DC2626' },
}

const CATEGORY_FILTERS = [
  { value: '', label: '전체' },
  { value: 'hakjeom', label: '학점은행제' },
  { value: 'cert-consult', label: '민간자격증' },
  { value: 'agency', label: '기관협약' },
  { value: 'cert-app', label: '자격증신청' },
  { value: 'practice', label: '실습/취업' },
]

const RECENT_KEY = 'quicksearch_recent'
const MAX_RECENT = 5

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  } catch {
    return []
  }
}

function addRecent(q: string) {
  if (!q.trim()) return
  const prev = getRecent().filter(r => r !== q)
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)))
}

function removeRecent(q: string) {
  const prev = getRecent().filter(r => r !== q)
  localStorage.setItem(RECENT_KEY, JSON.stringify(prev))
}

export default function QuickSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const router = useRouter()

  // Ctrl+K 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 열릴 때 포커스 + 최근 검색어 로드
  useEffect(() => {
    if (open) {
      setRecent(getRecent())
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setResults([])
      setSelectedIdx(-1)
      setCategoryFilter('')
    }
  }, [open])

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const handleChange = (val: string) => {
    setQuery(val)
    setSelectedIdx(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 300)
  }

  const handleSelect = (r: SearchResult) => {
    addRecent(r.name)
    setOpen(false)
    const params = new URLSearchParams()
    params.set('highlight', String(r.id))
    if (r.tab) params.set('tab', r.tab)
    router.push(`${r.link}?${params.toString()}`)
  }

  const handleRecentClick = (q: string) => {
    setQuery(q)
    setSelectedIdx(-1)
    doSearch(q)
  }

  const handleRemoveRecent = (e: React.MouseEvent, q: string) => {
    e.stopPropagation()
    removeRecent(q)
    setRecent(getRecent())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(prev => Math.min(prev + 1, filteredResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && selectedIdx >= 0 && filteredResults[selectedIdx]) {
      handleSelect(filteredResults[selectedIdx])
    }
  }

  // 카테고리 필터 적용
  const filteredResults = categoryFilter
    ? results.filter(r => r.category === categoryFilter)
    : results

  // 카테고리별 그룹핑
  const grouped = filteredResults.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.categoryLabel]) acc[r.categoryLabel] = []
    acc[r.categoryLabel].push(r)
    return acc
  }, {})

  const hasResults = filteredResults.length > 0
  const showRecent = query.length < 2 && recent.length > 0

  if (!open) {
    return (
      <button
        className={styles.triggerBtn}
        onClick={() => setOpen(true)}
        title="빠른 검색 (Ctrl+K)"
      >
        <Search size={15} />
        <span className={styles.triggerText}>검색</span>
        <kbd className={styles.kbd}>Ctrl+K</kbd>
      </button>
    )
  }

  return (
    <div className={styles.overlay} onClick={() => setOpen(false)}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* 검색 입력 */}
        <div className={styles.inputWrap}>
          <Search size={18} className={styles.inputIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="이름, 연락처로 검색..."
            value={query}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              className={styles.clearBtn}
              onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus() }}
            >
              <X size={16} />
            </button>
          )}
          <button className={styles.escBtn} onClick={() => setOpen(false)}>
            ESC
          </button>
        </div>

        {/* 카테고리 필터 탭 */}
        {(hasResults || query.length >= 2) && (
          <div className={styles.filterTabs}>
            {CATEGORY_FILTERS.map(f => (
              <button
                key={f.value}
                className={`${styles.filterTab} ${categoryFilter === f.value ? styles.filterTabActive : ''}`}
                onClick={() => { setCategoryFilter(f.value); setSelectedIdx(-1) }}
              >
                {f.label}
                {f.value && results.filter(r => r.category === f.value).length > 0 && (
                  <span className={styles.filterTabCount}>
                    {results.filter(r => r.category === f.value).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* 결과 영역 */}
        <div className={styles.resultArea}>
          {loading && (
            <div className={styles.loadingWrap}>
              <div className={styles.spinner} />
              <span>검색 중...</span>
            </div>
          )}

          {!loading && query.length >= 2 && filteredResults.length === 0 && (
            <div className={styles.emptyWrap}>
              검색 결과가 없습니다
            </div>
          )}

          {/* 최근 검색어 */}
          {!loading && showRecent && (
            <div className={styles.recentWrap}>
              <div className={styles.recentHeader}>최근 검색</div>
              {recent.map(q => (
                <button
                  key={q}
                  className={styles.recentItem}
                  onClick={() => handleRecentClick(q)}
                >
                  <Clock size={13} className={styles.recentIcon} />
                  <span className={styles.recentText}>{q}</span>
                  <span
                    className={styles.recentRemove}
                    onClick={e => handleRemoveRecent(e, q)}
                  >
                    <X size={12} />
                  </span>
                </button>
              ))}
            </div>
          )}

          {!loading && !showRecent && query.length < 2 && (
            <div className={styles.hintWrap}>
              2글자 이상 입력하세요
            </div>
          )}

          {!loading && hasResults && (
            <div className={styles.resultList}>
              {Object.entries(grouped).map(([label, items]) => (
                <div key={label}>
                  <div className={styles.groupLabel}>{label}</div>
                  {items.map(r => {
                    const globalIdx = filteredResults.indexOf(r)
                    const statusStyle = r.status ? STATUS_COLORS[r.status] : undefined
                    return (
                      <button
                        key={`${r.category}-${r.id}`}
                        className={`${styles.resultItem} ${globalIdx === selectedIdx ? styles.resultItemActive : ''}`}
                        onClick={() => handleSelect(r)}
                        onMouseEnter={() => setSelectedIdx(globalIdx)}
                      >
                        <div className={styles.resultInfo}>
                          <span className={styles.resultName}>{r.name}</span>
                          <span className={styles.resultSub}>{r.sub}</span>
                        </div>
                        <div className={styles.resultRight}>
                          {r.status && statusStyle && (
                            <span
                              className={styles.resultStatus}
                              style={{ background: statusStyle.bg, color: statusStyle.color }}
                            >
                              {r.status}
                            </span>
                          )}
                          <ArrowRight size={14} className={styles.resultArrow} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
