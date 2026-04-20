'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Upload, Download, X, FileSpreadsheet, Trash2, Search, Pencil, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import * as XLSX from 'xlsx'
import styles from './page.module.css'
import type { Department, Revenue } from '@/lib/management/types'
import type { UploadBatch } from '@/lib/management/types'

type RevenueType = 'CARD' | 'BANK_TRANSFER' | 'OTHER'
type ViewMode = 'daily' | 'weekly' | 'monthly'

interface PreviewRow {
  revenue_date: string
  department_id: string
  department_name: string
  revenue_type: RevenueType
  revenue_type_label: string
  customer_name: string
  amount: number
  product_name: string
  manager_name: string
  memo: string
  error?: string
}

interface UploadResult {
  success: number
  duplicate: number
  error: number
  errors: string[]
}

const REVENUE_TYPE_MAP: Record<string, RevenueType> = {
  '카드': 'CARD',
  '계좌': 'BANK_TRANSFER',
  '계좌입금': 'BANK_TRANSFER',
  '기타': 'OTHER',
}

const TYPE_LABEL: Record<string, string> = {
  CARD: '카드',
  BANK_TRANSFER: '계좌',
  OTHER: '기타',
}

const TEMPLATE_COLUMNS = ['발생일', '사업부', '매출구분', '거래처명', '금액', '상품/과정명', '담당자', '메모']

/* ── 날짜 유틸 ── */
function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function getMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { start: formatDate(start), end: formatDate(end) }
}
function getWeekLabel(dateStr: string) {
  const d = new Date(dateStr)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return `${formatDate(monday)} ~ ${formatDate(sunday)}`
}
function getMonthGroupLabel(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`
}

/* ══════════════════════════════════════════════════════════
   메인 페이지
   ══════════════════════════════════════════════════════════ */
export default function RevenueUploadPage() {
  const [tab, setTab] = useState<'data' | 'upload' | 'history'>('data')
  const [departments, setDepartments] = useState<Department[]>([])

  useEffect(() => {
    fetch('/api/management/departments').then(r => r.json()).then(setDepartments).catch(() => {})
  }, [])

  return (
    <div className={styles.pageWrap}>
      <div className={styles.tabRow}>
        <button className={`${styles.tabBtn} ${tab === 'data' ? styles.tabBtnActive : ''}`} onClick={() => setTab('data')}>데이터 조회</button>
        <button className={`${styles.tabBtn} ${tab === 'upload' ? styles.tabBtnActive : ''}`} onClick={() => setTab('upload')}>업로드</button>
        <button className={`${styles.tabBtn} ${tab === 'history' ? styles.tabBtnActive : ''}`} onClick={() => setTab('history')}>업로드 이력</button>
      </div>

      {tab === 'data' && <DataTab departments={departments} />}
      {tab === 'upload' && <UploadTab departments={departments} onUploadDone={() => setTab('data')} />}
      {tab === 'history' && <HistoryTab />}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   데이터 조회 탭
   ══════════════════════════════════════════════════════════ */
function DataTab({ departments }: { departments: Department[] }) {
  const defaultRange = getMonthRange()
  const [viewMode, setViewMode] = useState<ViewMode>('daily')
  const [dateStart, setDateStart] = useState(defaultRange.start)
  const [dateEnd, setDateEnd] = useState(defaultRange.end)
  const [deptFilter, setDeptFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [revenues, setRevenues] = useState<Revenue[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Revenue>>({})
  const pageSize = 50

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (dateStart) params.set('date_start', dateStart)
    if (dateEnd) params.set('date_end', dateEnd)
    if (deptFilter) params.set('department_id', deptFilter)
    if (typeFilter) params.set('revenue_type', typeFilter)
    if (search) params.set('search', search)
    params.set('page', String(page))
    try {
      const res = await fetch(`/api/management/revenues?${params}`)
      const json = await res.json()
      setRevenues(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch { /* */ }
    setLoading(false)
  }, [dateStart, dateEnd, deptFilter, typeFilter, search, page])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchData])

  const totalPages = Math.ceil(total / pageSize)
  const filteredAmount = revenues.reduce((s, r) => s + (r.amount || 0), 0)
  const cardCount = revenues.filter(r => r.revenue_type === 'CARD').length
  const bankCount = revenues.filter(r => r.revenue_type === 'BANK_TRANSFER').length
  const otherCount = revenues.filter(r => r.revenue_type === 'OTHER').length
  const currentRangeLabel =
    viewMode === 'daily'
      ? '일별 기준'
      : viewMode === 'weekly'
        ? '주별 묶음 기준'
        : '월별 묶음 기준'

  /* 그룹핑 */
  const grouped = (() => {
    if (viewMode === 'daily') return null
    const groups: Record<string, { label: string; rows: Revenue[]; total: number }> = {}
    for (const r of revenues) {
      const key = viewMode === 'weekly' ? getWeekLabel(r.revenue_date) : getMonthGroupLabel(r.revenue_date)
      if (!groups[key]) groups[key] = { label: key, rows: [], total: 0 }
      groups[key].rows.push(r)
      groups[key].total += r.amount || 0
    }
    return Object.values(groups)
  })()

  /* 인라인 수정 */
  const startEdit = (r: Revenue) => {
    setEditingId(r.id)
    setEditData({
      revenue_date: r.revenue_date,
      department_id: r.department_id,
      revenue_type: r.revenue_type,
      customer_name: r.customer_name,
      amount: r.amount,
      product_name: r.product_name ?? '',
      manager_id: r.manager_id,
      memo: r.memo ?? '',
    })
  }

  const saveEdit = async () => {
    if (!editingId) return
    try {
      const res = await fetch(`/api/management/revenues/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })
      if (res.ok) {
        setEditingId(null)
        fetchData()
      } else {
        const err = await res.json()
        alert(err.error || '수정 실패')
      }
    } catch { alert('수정 중 오류') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 매출 데이터를 삭제하시겠습니까?')) return
    try {
      await fetch(`/api/management/revenues/${id}`, { method: 'DELETE' })
      fetchData()
    } catch { /* */ }
  }

  const renderRow = (r: Revenue) => {
    const isEditing = editingId === r.id
    if (isEditing) {
      return (
        <tr key={r.id} className={styles.editRow}>
          <td><input type="date" value={editData.revenue_date ?? ''} onChange={e => setEditData(p => ({ ...p, revenue_date: e.target.value }))} className={styles.editInput} /></td>
          <td>
            <select value={editData.department_id ?? ''} onChange={e => setEditData(p => ({ ...p, department_id: e.target.value }))} className={styles.editInput}>
              <option value="">선택</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </td>
          <td>
            <select value={editData.revenue_type ?? ''} onChange={e => setEditData(p => ({ ...p, revenue_type: e.target.value as RevenueType }))} className={styles.editInput}>
              <option value="CARD">카드</option>
              <option value="BANK_TRANSFER">계좌</option>
              <option value="OTHER">기타</option>
            </select>
          </td>
          <td><input value={editData.customer_name ?? ''} onChange={e => setEditData(p => ({ ...p, customer_name: e.target.value }))} className={styles.editInput} /></td>
          <td><input type="number" value={editData.amount ?? 0} onChange={e => setEditData(p => ({ ...p, amount: Number(e.target.value) }))} className={`${styles.editInput} ${styles.tdRight}`} /></td>
          <td><input value={editData.product_name ?? ''} onChange={e => setEditData(p => ({ ...p, product_name: e.target.value }))} className={styles.editInput} /></td>
          <td><input value={editData.memo ?? ''} onChange={e => setEditData(p => ({ ...p, memo: e.target.value }))} className={styles.editInput} /></td>
          <td className={styles.tdActions}>
            <button className={styles.actionBtnSave} onClick={saveEdit}><Check size={14} /></button>
            <button className={styles.actionBtnCancel} onClick={() => setEditingId(null)}><X size={14} /></button>
          </td>
        </tr>
      )
    }
    return (
      <tr key={r.id}>
        <td>{r.revenue_date}</td>
        <td>{r.department?.name ?? '-'}</td>
        <td><span className={`${styles.typeBadge} ${r.revenue_type === 'CARD' ? styles.typeBadgeCard : r.revenue_type === 'BANK_TRANSFER' ? styles.typeBadgeBank : styles.typeBadgeOther}`}>{TYPE_LABEL[r.revenue_type] ?? r.revenue_type}</span></td>
        <td>{r.customer_name}</td>
        <td className={styles.tdRight}>{(r.amount || 0).toLocaleString()}</td>
        <td>{r.product_name ?? '-'}</td>
        <td>{r.memo ?? '-'}</td>
        <td className={styles.tdActions}>
          <button className={styles.actionBtn} onClick={() => startEdit(r)} title="수정"><Pencil size={13} /></button>
          <button className={styles.actionBtnDanger} onClick={() => handleDelete(r.id)} title="삭제"><Trash2 size={13} /></button>
        </td>
      </tr>
    )
  }

  return (
    <>
      <div className={styles.dataIntroCard}>
        <div className={styles.dataIntroTop}>
          <div>
            <strong className={styles.dataIntroTitle}>조회 결과 요약</strong>
            <span className={styles.dataIntroSubtitle}>{dateStart} ~ {dateEnd} · {currentRangeLabel}</span>
          </div>
          <div className={styles.viewToggle}>
            {(['daily', 'weekly', 'monthly'] as ViewMode[]).map(m => (
              <button key={m} className={`${styles.viewBtn} ${viewMode === m ? styles.viewBtnActive : ''}`} onClick={() => setViewMode(m)}>
                {{ daily: '일별', weekly: '주별', monthly: '월별' }[m]}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>현재 페이지 합계</span>
            <strong className={styles.summaryValue}>{filteredAmount.toLocaleString()}원</strong>
            <span className={styles.summarySub}>{revenues.length}건 표시 중</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>전체 조회 건수</span>
            <strong className={styles.summaryValue}>{total.toLocaleString()}건</strong>
            <span className={styles.summarySub}>검색/필터 반영 결과</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>매출 구분 현황</span>
            <strong className={styles.summaryValue}>{cardCount}/{bankCount}/{otherCount}</strong>
            <span className={styles.summarySub}>카드 · 계좌 · 기타</span>
          </div>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterHeader}>
          <strong className={styles.filterTitle}>조회 조건</strong>
          <span className={styles.filterCaption}>필요한 조건만 선택해서 바로 좁혀볼 수 있어요.</span>
        </div>
        <div className={styles.filterInputs}>
          <input type="date" value={dateStart} onChange={e => { setDateStart(e.target.value); setPage(1) }} className={styles.filterInput} />
          <span className={styles.filterDash}>~</span>
          <input type="date" value={dateEnd} onChange={e => { setDateEnd(e.target.value); setPage(1) }} className={styles.filterInput} />
          <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1) }} className={styles.filterSelect}>
            <option value="">전체 사업부</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }} className={styles.filterSelect}>
            <option value="">전체 구분</option>
            <option value="CARD">카드</option>
            <option value="BANK_TRANSFER">계좌</option>
            <option value="OTHER">기타</option>
          </select>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="거래처명, 상품명 검색" className={styles.searchInput} />
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.tableHeader}>
          <div>
            <strong className={styles.tableTitle}>매출 데이터</strong>
            <span className={styles.tableSubtitle}>정렬된 결과를 바로 수정하거나 삭제할 수 있습니다.</span>
          </div>
        </div>
        {loading ? (
          <div className={styles.loadingWrap}>불러오는 중...</div>
        ) : revenues.length === 0 ? (
          <div className={styles.emptyWrap}>
            <FileSpreadsheet size={32} />
            <p className={styles.emptyText}>해당 기간의 매출 데이터가 없습니다.</p>
          </div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>발생일</th>
                    <th>사업부</th>
                    <th>매출구분</th>
                    <th>거래처명</th>
                    <th>금액</th>
                    <th>상품/과정명</th>
                    <th>메모</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {grouped ? (
                    grouped.map(g => (
                      <Fragment key={g.label}>
                        <tr className={styles.groupHeader}>
                          <td colSpan={4}>{g.label}</td>
                          <td className={styles.tdRight}>{g.total.toLocaleString()}</td>
                          <td colSpan={3}>{g.rows.length}건</td>
                        </tr>
                        {g.rows.map(r => renderRow(r))}
                      </Fragment>
                    ))
                  ) : (
                    revenues.map(r => renderRow(r))
                  )}
                </tbody>
                <tfoot>
                  <tr className={styles.totalRow}>
                    <td colSpan={4}>합계 ({total}건)</td>
                    <td className={styles.tdRight}>{filteredAmount.toLocaleString()}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft size={14} />
                </button>
                <span className={styles.pageInfo}>{page} / {totalPages}</span>
                <button className={styles.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════════════════
   업로드 탭
   ══════════════════════════════════════════════════════════ */
function UploadTab({ departments, onUploadDone }: { departments: Department[]; onUploadDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_COLUMNS,
      ['2026-04-01', '(사업부명)', '카드', '홍길동', '100000', '사회복지사', '김담당', ''],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '매출데이터')
    XLSX.writeFile(wb, '매출_업로드_템플릿.xlsx')
  }

  const parseFile = useCallback((f: File) => {
    setFile(f)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: TEMPLATE_COLUMNS, range: 1 })

        const rows: PreviewRow[] = raw.map((r) => {
          const deptName = String(r['사업부'] ?? '').trim()
          const dept = departments.find(d => d.name === deptName)
          const managerName = String(r['담당자'] ?? '').trim()
          const rawDate = r['발생일']
          let dateStr = ''
          if (typeof rawDate === 'number') {
            const d = XLSX.SSF.parse_date_code(rawDate)
            dateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
          } else {
            dateStr = String(rawDate ?? '').trim()
          }
          const amount = Number(r['금액']) || 0
          const typeLabel = String(r['매출구분'] ?? '').trim()
          const revType = REVENUE_TYPE_MAP[typeLabel]

          const errors: string[] = []
          if (!dateStr) errors.push('발생일 누락')
          if (!deptName) errors.push('사업부 누락')
          if (!dept && deptName) errors.push(`사업부 "${deptName}" 없음`)
          if (!revType) errors.push(typeLabel ? `매출구분 "${typeLabel}" 오류 (카드/계좌/기타)` : '매출구분 누락')
          if (!String(r['거래처명'] ?? '').trim()) errors.push('거래처명 누락')
          if (!amount) errors.push('금액 누락')

          return {
            revenue_date: dateStr,
            department_id: dept?.id ?? '',
            department_name: deptName,
            revenue_type: revType ?? 'OTHER',
            revenue_type_label: typeLabel,
            customer_name: String(r['거래처명'] ?? '').trim(),
            amount,
            product_name: String(r['상품/과정명'] ?? '').trim(),
            manager_name: managerName,
            memo: String(r['메모'] ?? '').trim(),
            error: errors.length > 0 ? errors.join(', ') : undefined,
          }
        })
        setPreview(rows)
      } catch {
        alert('파일을 읽을 수 없습니다.')
      }
    }
    reader.readAsArrayBuffer(f)
  }, [departments])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files[0]
    if (f) parseFile(f)
  }, [parseFile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) parseFile(f)
  }

  const handleUpload = async () => {
    const validRows = preview.filter(r => !r.error)
    if (!validRows.length) return

    setUploading(true)
    try {
      const rows = validRows.map(r => {
        return {
          revenue_date: r.revenue_date,
          department_id: r.department_id || null,
          revenue_type: r.revenue_type,
          customer_name: r.customer_name,
          amount: r.amount,
          product_name: r.product_name || null,
          manager_id: null,
          memo: r.memo || null,
        }
      })

      const res = await fetch('/api/management/revenues/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      setResult({ success: data.success ?? 0, duplicate: data.duplicate ?? 0, error: data.error ?? 0, errors: data.errors ?? [] })
      if (data.success > 0) {
        setPreview([])
        setFile(null)
      }
    } catch {
      alert('업로드 중 오류가 발생했습니다.')
    }
    setUploading(false)
  }

  const clearFile = () => {
    setFile(null)
    setPreview([])
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const validCount = preview.filter(r => !r.error).length
  const errorCount = preview.filter(r => r.error).length
  const totalAmount = preview.filter(r => !r.error).reduce((s, r) => s + r.amount, 0)

  return (
    <>
      {result && (
        <div className={result.success > 0 ? styles.resultWrap : styles.resultWrapError}>
          <p className={styles.resultTitle}>{result.success > 0 ? '업로드 완료' : '업로드 실패'}</p>
          <p className={styles.resultDetail}>
            성공 {result.success}건{result.duplicate > 0 && ` · 중복 ${result.duplicate}건`}{result.error > 0 && ` · 오류 ${result.error}건`}
          </p>
          {result.errors.length > 0 && (
            <div className={styles.resultErrors}>
              {[...new Set(result.errors)].slice(0, 5).map((err, i) => (
                <p key={i} className={styles.resultErrorItem}>{err}</p>
              ))}
            </div>
          )}
          {result.success > 0 && (
            <button className={styles.btnSecondary} onClick={onUploadDone} style={{ alignSelf: 'flex-start', marginTop: '4px' }}>
              데이터 조회로 이동
            </button>
          )}
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardHeaderRow}>
          <h2 className={styles.cardTitle}>파일 업로드</h2>
          <button className={styles.templateBtn} onClick={downloadTemplate}>
            <Download size={14} /> 템플릿 다운로드
          </button>
        </div>
        <p className={styles.cardDesc}>필수 항목: 발생일, 사업부, 매출구분(카드/계좌/기타), 거래처명, 금액</p>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} hidden />
        <div
          className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <Upload size={28} className={styles.dropzoneIcon} />
          <p className={styles.dropzoneText}>파일을 드래그하거나 클릭하여 선택하세요</p>
          <p className={styles.dropzoneHint}>.xlsx, .xls, .csv 파일 지원</p>
        </div>

        {file && (
          <div className={styles.fileInfo}>
            <FileSpreadsheet size={16} />
            <span className={styles.fileName}>{file.name}</span>
            <button className={styles.fileRemoveBtn} onClick={clearFile}><X size={14} /></button>
          </div>
        )}
      </div>

      {preview.length > 0 && (
        <div className={styles.card}>
          <div className={styles.previewHeader}>
            <h2 className={styles.previewTitle}>미리보기</h2>
            <span className={styles.previewCount}>
              총 {preview.length}건 · 유효 {validCount}건
              {errorCount > 0 && <> · <span style={{ color: 'var(--toss-red)' }}>오류 {errorCount}건</span></>}
              {validCount > 0 && <> · 합계 {totalAmount.toLocaleString()}원</>}
            </span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>발생일</th>
                  <th>사업부</th>
                  <th>매출구분</th>
                  <th>거래처명</th>
                  <th>금액</th>
                  <th>상품/과정명</th>
                  <th>담당자</th>
                  <th>메모</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 100).map((row, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{row.revenue_date}</td>
                    <td>{row.department_name}</td>
                    <td>{row.revenue_type_label}</td>
                    <td>{row.customer_name}</td>
                    <td className={styles.tdRight}>{row.amount.toLocaleString()}</td>
                    <td>{row.product_name}</td>
                    <td>{row.manager_name}</td>
                    <td>{row.memo}</td>
                    <td>{row.error ? <span className={styles.tdError}>{row.error}</span> : '✓'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.length > 100 && (
            <p className={styles.previewCount} style={{ marginTop: '8px' }}>상위 100건만 표시 (전체 {preview.length}건)</p>
          )}

          <div className={styles.actionRow}>
            <button className={styles.btnSecondary} onClick={clearFile}>취소</button>
            <button className={styles.btnPrimary} onClick={handleUpload} disabled={uploading || validCount === 0}>
              <Upload size={16} />
              {uploading ? '업로드 중...' : `${validCount}건 업로드`}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════════════
   업로드 이력 탭
   ══════════════════════════════════════════════════════════ */
function HistoryTab() {
  const [batches, setBatches] = useState<UploadBatch[]>([])
  const [loading, setLoading] = useState(false)

  const fetchBatches = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/management/revenues/batches')
      const data = await res.json()
      setBatches(data.batches ?? [])
    } catch { /* */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchBatches()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchBatches])

  const handleDelete = async (batchId: string) => {
    if (!confirm('이 배치의 모든 매출 데이터를 삭제하시겠습니까?')) return
    try {
      await fetch(`/api/management/revenues/batches/${batchId}`, { method: 'DELETE' })
      fetchBatches()
    } catch { /* */ }
  }

  const fmtType = (types: string[]) => {
    return types.map(t => {
      if (t === 'CARD') return { label: '카드', cls: styles.typeBadgeCard }
      if (t === 'BANK_TRANSFER') return { label: '계좌', cls: styles.typeBadgeBank }
      return { label: '기타', cls: styles.typeBadgeOther }
    })
  }

  if (loading) return <div className={styles.loadingWrap}>불러오는 중...</div>
  if (batches.length === 0) return (
    <div className={styles.emptyWrap}>
      <FileSpreadsheet size={32} />
      <p className={styles.emptyText}>업로드 이력이 없습니다.</p>
    </div>
  )

  return (
    <div className={styles.batchList}>
      {batches.map(b => (
        <div key={b.batch_id} className={styles.batchCard}>
          <div className={styles.batchInfo}>
            <span className={styles.batchDate}>
              {new Date(b.uploaded_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
              {' '}
              {new Date(b.uploaded_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className={styles.batchMeta}>
              <span>{b.count}건</span>
              {fmtType(b.revenue_types).map((t, i) => (
                <span key={i} className={`${styles.typeBadge} ${t.cls}`}>{t.label}</span>
              ))}
            </span>
          </div>
          <span className={styles.batchAmount}>{b.total_amount.toLocaleString()}원</span>
          <button className={styles.batchDeleteBtn} onClick={() => handleDelete(b.batch_id)}>
            <Trash2 size={13} /> 삭제
          </button>
        </div>
      ))}
    </div>
  )
}
