'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from './page.module.css'

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

export default function AdminCustomersPage() {
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [unitFilter, setUnitFilter] = useState<UnitFilter>('all')
  const [centerFilter, setCenterFilter] = useState('all')
  const [managerFilter, setManagerFilter] = useState('all')

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
    return () => {
      cancelled = true
    }
  }, [])

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
      if (!q) return true
      const hay = [r.name, r.learner_username ?? '', r.phone ?? '', r.education_center_name, r.manager_name ?? '', r.course_name ?? '', r.memo ?? '']
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [rows, search, unitFilter, centerFilter, managerFilter])

  // 정산 합계
  const totals = useMemo(() => {
    let cost = 0
    let subjects = 0
    let unknown = 0
    for (const r of filtered) {
      cost += r.cost
      if (r.subject_count !== null) subjects += r.subject_count
      else unknown += 1
    }
    return { cost, subjects, unknown }
  }, [filtered])

  const handleExportCsv = () => {
    if (filtered.length === 0) return
    const headers = ['등록기관', '과정', '개강일', '학생명', '아이디', '연락처', '단가', '결제금액', '결제일', '과목수', '담당자', '특이사항']
    const lines = [headers.join(',')]
    for (const r of filtered) {
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
    const csv = '﻿' + lines.join('\n') // UTF-8 BOM (엑셀 한글)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.page_wrap}>
      <div className={styles.page_header}>
        <div>
          <h1 className={styles.page_title}>전체고객관리 — 정산</h1>
          <p className={styles.page_sub}>등록학생관리 데이터를 기반으로 단가/과목수를 자동 산출합니다. (4.5만원 우선, 미일치 시 3.8만원)</p>
        </div>
        <button className={styles.export_btn} onClick={handleExportCsv} disabled={filtered.length === 0}>
          CSV 다운로드
        </button>
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
        <select className={styles.select} value={centerFilter} onChange={(e) => setCenterFilter(e.target.value)}>
          <option value="all">전체 교육원</option>
          {centers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={styles.select} value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}>
          <option value="all">전체 담당자</option>
          {managers.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className={styles.select} value={unitFilter} onChange={(e) => setUnitFilter(e.target.value as UnitFilter)}>
          <option value="all">전체 단가</option>
          <option value="4.5">4.5만원</option>
          <option value="3.8">3.8만원</option>
          <option value="unknown">미판별</option>
        </select>
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
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.education_center_name || '-'}</td>
                  <td>{r.course_name ?? '-'}</td>
                  <td>{r.class_start ?? '-'}</td>
                  <td className={styles.cell_name}>{r.name}</td>
                  <td className={styles.cell_id}>{r.learner_username ?? '-'}</td>
                  <td>{formatPhone(r.phone)}</td>
                  <td>
                    {r.unit_label
                      ? <span className={r.unit_price === 38000 ? styles.tag_alt : styles.tag_main}>{r.unit_label}</span>
                      : <span className={styles.tag_unknown}>미판별</span>}
                  </td>
                  <td className={styles.cell_money}>{formatMoney(r.cost)}원</td>
                  <td>{formatDate(r.paid_at)}</td>
                  <td className={styles.cell_count}>{r.subject_count ?? '-'}</td>
                  <td>{r.manager_name ?? '-'}</td>
                  <td className={styles.cell_memo} title={r.memo ?? ''}>{r.memo ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
