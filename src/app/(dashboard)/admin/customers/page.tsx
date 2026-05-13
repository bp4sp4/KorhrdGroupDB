'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './page.module.css'
import CustomSelect from './CustomSelect'

interface CustomerRow {
  id: string
  education_center_name: string
  course_name: string | null
  class_start: string | null
  name: string
  learner_username: string | null
  phone: string | null
  cost: number
  paid_at: string | null
  unit_price: number | null
  unit_label: string | null
  subject_count: number | null
  manager_name: string | null
  memo: string | null
  status: string
}

type UnitFilter = 'all' | '4.5' | '3.8' | 'unknown'

const PAGE_SIZE = 20

function formatPhone(p: string | null): string {
  if (!p) return '-'
  return p.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')
}
function formatDate(d: string | null): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
function formatMoney(n: number): string {
  return n.toLocaleString('ko-KR')
}

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
    <rect x="1" y="1" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M4 7l2.5 2.5L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const DownAllIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
    <path d="M7 1v7M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 9.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

function Highlight({ text, query }: { text: string | null; query: string }) {
  const str = text ?? '-'
  if (!query.trim()) return <>{str}</>
  const regex = new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = str.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} style={{ background: '#ffe066', color: '#191f28', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
          : part
      )}
    </>
  )
}

function buildCsv(target: CustomerRow[]): string {
  const headers = ['등록기관', '과정', '개강일', '학생명', '아이디', '연락처', '단가', '결제금액', '결제일', '과목수', '담당자', '특이사항']
  const lines = [headers.join(',')]
  for (const r of target) {
    const cols = [
      r.education_center_name,
      r.course_name ?? '',
      r.class_start ?? '',
      r.name,
      r.learner_username ?? '',
      r.phone ?? '',
      r.unit_label ?? '',
      formatMoney(r.cost),
      formatDate(r.paid_at),
      r.subject_count !== null ? String(r.subject_count) : '',
      r.manager_name ?? '',
      (r.memo ?? '').replace(/\n/g, ' '),
    ]
    lines.push(cols.map((v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(','))
  }
  return '﻿' + lines.join('\n')
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminCustomersPage() {
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [unitFilter, setUnitFilter] = useState<UnitFilter>('all')
  const [centerFilter, setCenterFilter] = useState('all')
  const [managerFilter, setManagerFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('')
  const [page, setPage] = useState(1)

  // 체크박스 선택
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())


  // 다운로드 드롭다운
  const [dlOpen, setDlOpen] = useState(false)
  const dlRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dlRef.current && !dlRef.current.contains(e.target as Node)) setDlOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/customers')
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? `HTTP ${res.status}`)
        }
        const data = (await res.json()) as CustomerRow[]
        if (!cancelled) setRows(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // 필터 변경 시 1페이지로 리셋
  useEffect(() => { setPage(1) }, [search, unitFilter, centerFilter, managerFilter, monthFilter])

  const centers = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((r) => r.education_center_name && set.add(r.education_center_name))
    return Array.from(set).sort()
  }, [rows])

  const managers = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((r) => r.manager_name && set.add(r.manager_name))
    return Array.from(set).sort()
  }, [rows])

  const months = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((r) => { if (r.paid_at) set.add(r.paid_at.slice(0, 7)) })
    return Array.from(set).sort().reverse()
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (centerFilter !== 'all' && r.education_center_name !== centerFilter) return false
      if (managerFilter !== 'all' && r.manager_name !== managerFilter) return false
      if (unitFilter !== 'all') {
        if (unitFilter === 'unknown' && r.unit_price !== null) return false
        if (unitFilter === '4.5' && r.unit_price !== 45000) return false
        if (unitFilter === '3.8' && r.unit_price !== 38000) return false
      }
      if (monthFilter && r.paid_at?.slice(0, 7) !== monthFilter) return false
      if (!q) return true
      const hay = [r.name, r.learner_username ?? '', r.phone ?? '', r.education_center_name, r.manager_name ?? '', r.course_name ?? '', r.memo ?? '']
        .join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [rows, search, unitFilter, centerFilter, managerFilter, monthFilter])

  const totals = useMemo(() => {
    let cost = 0, subjects = 0, unknown = 0
    for (const r of filtered) {
      cost += r.cost
      if (r.subject_count !== null) subjects += r.subject_count
      else unknown++
    }
    return { cost, subjects, unknown }
  }, [filtered])

  // 월 선택 시 페이징 없이 전체 표시
  const usePaging = !monthFilter
  const totalPages = usePaging ? Math.ceil(filtered.length / PAGE_SIZE) : 1
  const paginated = usePaging ? filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : filtered

  const pageNumbers = useMemo((): (number | '...')[] => {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
      .reduce<(number | '...')[]>((acc, p, i, arr) => {
        if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1) acc.push('...')
        acc.push(p)
        return acc
      }, [])
  }, [totalPages, page])

  // 전체선택 체크박스 상태
  const allPageChecked = paginated.length > 0 && paginated.every((r) => selectedIds.has(r.id))
  const somePageChecked = paginated.some((r) => selectedIds.has(r.id))

  const toggleAll = () => {
    if (allPageChecked) {
      // 현재 페이지 전체 해제
      setSelectedIds((prev) => {
        const next = new Set(prev)
        paginated.forEach((r) => next.delete(r.id))
        return next
      })
    } else {
      // 현재 페이지 전체 선택
      setSelectedIds((prev) => {
        const next = new Set(prev)
        paginated.forEach((r) => next.add(r.id))
        return next
      })
    }
  }

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // 다운로드
  const today = new Date().toISOString().slice(0, 10)
  const suffix = monthFilter || today

  const handleDownload = (type: 'selected' | 10 | 20 | 50 | 'all') => {
    setDlOpen(false)
    let target: CustomerRow[]
    let label: string
    if (type === 'selected') {
      target = filtered.filter((r) => selectedIds.has(r.id))
      label = `선택_${target.length}건`
    } else if (type === 'all') {
      target = filtered
      label = `전체_${filtered.length}건`
    } else {
      target = filtered.slice(0, type)
      label = `상위_${type}건`
    }
    if (target.length === 0) return
    downloadCsv(buildCsv(target), `customers_${suffix}_${label}.csv`)
  }

  const hasFilter = !!(search || monthFilter || centerFilter !== 'all' || managerFilter !== 'all' || unitFilter !== 'all')

  return (
    <div className={styles.page_wrap}>
      <div className={styles.page_header}>
        <div>
          <h1 className={styles.page_title}>전체고객관리 — 정산</h1>
          <p className={styles.page_sub}>등록학생관리 데이터를 기반으로 단가/과목수를 자동 산출합니다. (4.5만원 우선, 미일치 시 3.8만원)</p>
        </div>

        {/* 다운로드 드롭다운 */}
        <div className={styles.dl_wrap} ref={dlRef}>
          <button
            className={styles.export_btn}
            onClick={() => setDlOpen((v) => !v)}
            disabled={filtered.length === 0}
          >
            CSV 다운로드
            <svg style={{ marginLeft: 6 }} width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {dlOpen && (
            <div className={styles.dl_dropdown}>
              <button
                className={styles.dl_option}
                onClick={() => handleDownload('selected')}
                disabled={selectedIds.size === 0}
              >
                <CheckIcon />
                선택 다운로드
                {selectedIds.size > 0 && <span className={styles.dl_count}>{selectedIds.size}건</span>}
              </button>
              <div className={styles.dl_divider} />
              <button
                className={`${styles.dl_option} ${styles.dl_option_all}`}
                onClick={() => handleDownload('all')}
                disabled={filtered.length === 0}
              >
                <DownAllIcon />
                전체 다운로드
                <span className={styles.dl_count}>{filtered.length}건</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className={styles.summary_row}>
        <div className={styles.summary_card}>
          <div className={styles.summary_label}>대상 학생</div>
          <div className={styles.summary_value}>{filtered.length.toLocaleString()}<span className={styles.summary_unit}>명</span></div>
        </div>
        <div className={styles.summary_card}>
          <div className={styles.summary_label}>총 결제금액</div>
          <div className={styles.summary_value}>{formatMoney(totals.cost)}<span className={styles.summary_unit}>원</span></div>
        </div>
        <div className={styles.summary_card}>
          <div className={styles.summary_label}>총 과목수</div>
          <div className={styles.summary_value}>{totals.subjects.toLocaleString()}<span className={styles.summary_unit}>과목</span></div>
        </div>
        <div className={styles.summary_card}>
          <div className={styles.summary_label}>단가 미판별</div>
          <div className={`${styles.summary_value} ${totals.unknown > 0 ? styles.summary_warn : ''}`}>
            {totals.unknown.toLocaleString()}<span className={styles.summary_unit}>건</span>
          </div>
        </div>
      </div>

      {/* 필터 바 */}
      <div className={styles.filter_bar}>
        <input
          className={styles.search_input}
          type="text"
          placeholder="학생명 / 아이디 / 연락처 / 메모 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <CustomSelect
          value={monthFilter}
          onChange={setMonthFilter}
          placeholder="전체 월"
          minWidth={130}
          options={[
            { value: '', label: '전체 월' },
            ...months.map((m) => {
              const [y, mo] = m.split('-')
              return { value: m, label: `${y}년 ${parseInt(mo)}월` }
            }),
          ]}
        />
        <CustomSelect
          value={centerFilter}
          onChange={setCenterFilter}
          placeholder="전체 교육원"
          minWidth={150}
          options={[
            { value: 'all', label: '전체 교육원' },
            ...centers.map((c) => ({ value: c, label: c })),
          ]}
        />
        <CustomSelect
          value={managerFilter}
          onChange={setManagerFilter}
          placeholder="전체 담당자"
          minWidth={130}
          options={[
            { value: 'all', label: '전체 담당자' },
            ...managers.map((m) => ({ value: m, label: m })),
          ]}
        />
        <CustomSelect
          value={unitFilter}
          onChange={(v) => setUnitFilter(v as UnitFilter)}
          placeholder="전체 단가"
          minWidth={110}
          options={[
            { value: 'all', label: '전체 단가' },
            { value: '4.5', label: '4.5만원' },
            { value: '3.8', label: '3.8만원' },
            { value: 'unknown', label: '미판별' },
          ]}
        />
        {hasFilter && (
          <button
            className={styles.reset_btn}
            onClick={() => {
              setSearch('')
              setMonthFilter('')
              setCenterFilter('all')
              setManagerFilter('all')
              setUnitFilter('all')
            }}
          >
            초기화
          </button>
        )}
      </div>


      {/* 표 */}
      <div className={styles.table_wrap}>
        {loading ? (
          <div className={styles.empty}>불러오는 중...</div>
        ) : error ? (
          <div className={styles.empty_error}>오류: {error}</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>표시할 학생이 없습니다.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th_check}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={allPageChecked}
                    ref={(el) => { if (el) el.indeterminate = !allPageChecked && somePageChecked }}
                    onChange={toggleAll}
                  />
                </th>
                <th>등록기관</th>
                <th>과정</th>
                <th>개강일</th>
                <th>학생명</th>
                <th>아이디</th>
                <th>연락처</th>
                <th>단가</th>
                <th>결제금액</th>
                <th>결제일</th>
                <th>과목수</th>
                <th>담당자</th>
                <th>특이사항</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((r) => (
                <tr
                  key={r.id}
                  className={selectedIds.has(r.id) ? styles.row_selected : ''}
                  onClick={() => toggleRow(r.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className={styles.th_check} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleRow(r.id)}
                    />
                  </td>
                  <td><Highlight text={r.education_center_name} query={search} /></td>
                  <td><Highlight text={r.course_name} query={search} /></td>
                  <td>{r.class_start ?? '-'}</td>
                  <td className={styles.cell_name}><Highlight text={r.name} query={search} /></td>
                  <td className={styles.cell_id}><Highlight text={r.learner_username} query={search} /></td>
                  <td><Highlight text={formatPhone(r.phone)} query={search} /></td>
                  <td>{r.unit_price !== null ? r.unit_price.toLocaleString('ko-KR') : '-'}</td>
                  <td className={styles.cell_money}>{formatMoney(r.cost)}원</td>
                  <td>{formatDate(r.paid_at)}</td>
                  <td className={styles.cell_count}>{r.subject_count ?? '-'}</td>
                  <td><Highlight text={r.manager_name} query={search} /></td>
                  <td className={styles.cell_memo} title={r.memo ?? ''}><Highlight text={r.memo} query={search} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 페이지네이션 — 월 선택 시 숨김 */}
      {usePaging && totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.page_btn}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >이전</button>
          {pageNumbers.map((p, i) =>
            p === '...'
              ? <span key={`dots-${i}`} className={styles.page_dots}>···</span>
              : <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={`${styles.page_btn} ${page === p ? styles.page_btn_active : ''}`}
                >{p}</button>
          )}
          <button
            className={styles.page_btn}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >다음</button>
        </div>
      )}
    </div>
  )
}
