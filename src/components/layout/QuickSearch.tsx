'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import styles from './QuickSearch.module.css'

interface SearchResult {
  category: string
  categoryLabel: string
  link: string
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

export default function QuickSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
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

  // 열릴 때 포커스
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setResults([])
      setSelectedIdx(-1)
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
    setOpen(false)
    router.push(r.link)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(prev => Math.max(prev - 1, -1))
    } else if (e.key === 'Enter' && selectedIdx >= 0 && results[selectedIdx]) {
      handleSelect(results[selectedIdx])
    }
  }

  // 카테고리별 그룹핑
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.categoryLabel]) acc[r.categoryLabel] = []
    acc[r.categoryLabel].push(r)
    return acc
  }, {})

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

        {/* 결과 영역 */}
        <div className={styles.resultArea}>
          {loading && (
            <div className={styles.loadingWrap}>
              <div className={styles.spinner} />
              <span>검색 중...</span>
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className={styles.emptyWrap}>
              검색 결과가 없습니다
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className={styles.hintWrap}>
              2글자 이상 입력하세요
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className={styles.resultList}>
              {Object.entries(grouped).map(([label, items]) => (
                <div key={label}>
                  <div className={styles.groupLabel}>{label}</div>
                  {items.map((r, idx) => {
                    const globalIdx = results.indexOf(r)
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
