'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Upload, Download, X, Search } from 'lucide-react'
import * as XLSX from 'xlsx'
import type { Revenue, Department } from '@/lib/management/types'
import {
  formatDate,
  formatAmount,
  getRevenueTypeLabel,
  getLastMonths,
  getMonthRange,
  getThisMonth,
} from '@/lib/management/utils'
import styles from './page.module.css'

const REVENUE_TYPES = [
  { value: '', label: '전체 구분' },
  { value: 'CARD', label: '카드' },
  { value: 'BANK_TRANSFER', label: '계좌이체' },
  { value: 'OTHER', label: '기타' },
]

interface RevenueForm {
  revenue_date: string
  department_id: string
  revenue_type: string
  customer_name: string
  amount: string
  product_name: string
  manager_id: string
  memo: string
}

const emptyForm: RevenueForm = {
  revenue_date: new Date().toISOString().slice(0, 10),
  department_id: '',
  revenue_type: 'CARD',
  customer_name: '',
  amount: '',
  product_name: '',
  manager_id: '',
  memo: '',
}

export default function RevenuesPage() {
  const months = getLastMonths(12)
  const thisMonth = getThisMonth()

  const [selectedYear, setSelectedYear] = useState(thisMonth.year)
  const [selectedMonth, setSelectedMonth] = useState(thisMonth.month)
  const [deptFilter, setDeptFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')

  const [revenues, setRevenues] = useState<Revenue[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<{ id: string; display_name: string }[]>([])

  const [showAddModal, setShowAddModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [form, setForm] = useState<RevenueForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadRows, setUploadRows] = useState<Record<string, unknown>[]>([])
  const [uploadResult, setUploadResult] = useState<{ success: number; duplicate: number; error: number } | null>(null)
  const [uploading, setUploading] = useState(false)

  const fetchRevenues = useCallback(async () => {
    setLoading(true)
    const { start, end } = getMonthRange(selectedYear, selectedMonth)
    const params = new URLSearchParams({
      date_start: start,
      date_end: end,
      page: String(page),
    })
    if (deptFilter) params.set('department_id', deptFilter)
    if (typeFilter) params.set('revenue_type', typeFilter)
    if (search) params.set('search', search)

    const res = await fetch(`/api/management/revenues?${params}`)
    if (res.ok) {
      const json = await res.json()
      setRevenues(json.data ?? [])
      setTotal(json.total ?? 0)
    }
    setLoading(false)
  }, [selectedYear, selectedMonth, deptFilter, typeFilter, search, page])

  useEffect(() => {
    fetchRevenues()
  }, [fetchRevenues])

  useEffect(() => {
    fetch('/api/management/departments').then(r => r.json()).then(setDepartments).catch(() => {})
    fetch('/api/management/users').then(r => r.json()).then(setUsers).catch(() => {})
  }, [])

  const totalAmount = revenues.reduce((s, r) => s + r.amount, 0)

  const handleSubmit = async () => {
    if (!form.customer_name || !form.amount || !form.revenue_date) {
      setFormError('날짜, 고객명, 금액은 필수입니다.')
      return
    }
    setSubmitting(true)
    setFormError('')
    const res = await fetch('/api/management/revenues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSubmitting(false)
    if (res.ok) {
      setShowAddModal(false)
      setForm(emptyForm)
      fetchRevenues()
    } else {
      const err = await res.json()
      if (err.duplicate) {
        setFormError('동일한 매출 데이터가 이미 존재합니다. 강제 등록하려면 다른 값을 입력해주세요.')
      } else {
        setFormError(err.error ?? '저장에 실패했습니다.')
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const data = evt.target?.result
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]
      // 컬럼 매핑: 날짜/일자→revenue_date, 고객명→customer_name, 금액→amount, 상품명→product_name, 구분→revenue_type
      const mapped = rows.map((row) => {
        const keys = Object.keys(row)
        const findKey = (...candidates: string[]) =>
          keys.find((k) => candidates.some((c) => k.includes(c))) ?? ''
        const dateKey = findKey('날짜', '일자', 'date')
        const nameKey = findKey('고객', '거래처', '이름', 'customer', 'name')
        const amountKey = findKey('금액', 'amount', '매출')
        const productKey = findKey('상품', '과정', 'product')
        const typeKey = findKey('구분', 'type', '유형')

        const rawDate = row[dateKey] as string | number
        let revenue_date = ''
        if (rawDate) {
          if (typeof rawDate === 'number') {
            const d = XLSX.SSF.parse_date_code(rawDate)
            revenue_date = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
          } else {
            revenue_date = String(rawDate).replace(/\./g, '-').replace(/[^0-9-]/g, '')
          }
        }

        const typeRaw = String(row[typeKey] ?? '').toLowerCase()
        const revenue_type = typeRaw.includes('카드') ? 'CARD'
          : typeRaw.includes('계좌') || typeRaw.includes('transfer') ? 'BANK_TRANSFER'
          : 'CARD'

        return {
          revenue_date,
          customer_name: String(row[nameKey] ?? ''),
          amount: Number(String(row[amountKey] ?? '0').replace(/,/g, '')),
          product_name: String(row[productKey] ?? ''),
          revenue_type,
        }
      }).filter((r) => r.customer_name && r.amount > 0)
      setUploadRows(mapped)
      setUploadResult(null)
    }
    reader.readAsArrayBuffer(file)
  }

  const handleUpload = async () => {
    setUploading(true)
    const res = await fetch('/api/management/revenues/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: uploadRows }),
    })
    const result = await res.json()
    setUploadResult(result)
    setUploading(false)
    if (result.success > 0) fetchRevenues()
  }

  const handleExport = () => {
    const data = revenues.map((r) => ({
      날짜: r.revenue_date,
      사업부: r.department?.name ?? '',
      고객명: r.customer_name,
      상품명: r.product_name ?? '',
      구분: getRevenueTypeLabel(r.revenue_type),
      금액: r.amount,
      담당자: r.manager?.display_name ?? '',
      메모: r.memo ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '매출목록')
    XLSX.writeFile(wb, `매출목록_${selectedYear}${String(selectedMonth).padStart(2, '0')}.xlsx`)
  }

  const totalPages = Math.ceil(total / 50)

  return (
    <div className={styles.page_wrap}>
      {/* 헤더 */}
      <div className={styles.page_header}>
        <h2 className={styles.page_title}>매출 관리</h2>
        <div className={styles.header_actions}>
          <button className={styles.btn_secondary} onClick={() => setShowUploadModal(true)}>
            <Upload size={14} /> 엑셀 업로드
          </button>
          <button className={styles.btn_secondary} onClick={handleExport}>
            <Download size={14} /> 엑셀 다운로드
          </button>
          <button className={styles.btn_primary} onClick={() => { setForm(emptyForm); setShowAddModal(true) }}>
            <Plus size={14} /> 매출 등록
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className={styles.filter_bar}>
        <div className={styles.filter_group}>
          <span className={styles.filter_label}>기간</span>
          <select
            className={styles.filter_select}
            value={`${selectedYear}-${selectedMonth}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number)
              setSelectedYear(y)
              setSelectedMonth(m)
              setPage(1)
            }}
          >
            {months.map((m) => (
              <option key={m.label} value={`${m.year}-${m.month}`}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.filter_divider} />

        <div className={styles.filter_group}>
          <span className={styles.filter_label}>사업부</span>
          <select
            className={styles.filter_select}
            value={deptFilter}
            onChange={(e) => { setDeptFilter(e.target.value); setPage(1) }}
          >
            <option value=''>전체</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className={styles.filter_group}>
          <span className={styles.filter_label}>구분</span>
          <select
            className={styles.filter_select}
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          >
            {REVENUE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.filter_divider} />

        <div className={styles.filter_group}>
          <Search size={14} color='var(--toss-text-tertiary)' />
          <input
            className={styles.filter_input}
            placeholder='고객명, 상품명 검색'
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      {/* 요약 */}
      <div className={styles.summary_bar}>
        <div className={styles.summary_card}>
          <p className={styles.summary_label}>조회 건수</p>
          <p className={styles.summary_value}>{total.toLocaleString()}건</p>
        </div>
        <div className={styles.summary_card}>
          <p className={styles.summary_label}>조회 매출 합계</p>
          <p className={`${styles.summary_value} ${styles.summary_value_blue}`}>{formatAmount(totalAmount)}</p>
        </div>
      </div>

      {/* 테이블 */}
      <div className={styles.table_wrap}>
        <div className={styles.table_header_row}>
          <span className={styles.table_count}>
            총 <strong>{total.toLocaleString()}</strong>건
          </span>
        </div>

        {loading ? (
          <div className={styles.empty_state}>불러오는 중...</div>
        ) : revenues.length === 0 ? (
          <div className={styles.empty_state}>조회된 매출 데이터가 없습니다.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>날짜</th>
                <th>사업부</th>
                <th>고객명</th>
                <th>상품/과정명</th>
                <th>구분</th>
                <th style={{ textAlign: 'right' }}>금액</th>
                <th>담당자</th>
                <th>메모</th>
              </tr>
            </thead>
            <tbody>
              {revenues.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.revenue_date)}</td>
                  <td className={styles.text_secondary}>{r.department?.name ?? '-'}</td>
                  <td><strong>{r.customer_name}</strong></td>
                  <td className={styles.text_secondary}>{r.product_name ?? '-'}</td>
                  <td>
                    <span className={`${styles.type_badge} ${
                      r.revenue_type === 'CARD' ? styles.type_card
                      : r.revenue_type === 'BANK_TRANSFER' ? styles.type_bank
                      : styles.type_other
                    }`}>
                      {getRevenueTypeLabel(r.revenue_type)}
                    </span>
                  </td>
                  <td className={styles.amount_cell}>{formatAmount(r.amount)}</td>
                  <td className={styles.text_secondary}>{r.manager?.display_name ?? '-'}</td>
                  <td className={styles.text_secondary}>{r.memo ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className={styles.pagination}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
              Math.max(0, page - 3),
              Math.min(totalPages, page + 2)
            ).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`${styles.page_btn} ${p === page ? styles.page_btn_active : ''}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 매출 등록 모달 */}
      {showAddModal && (
        <div className={styles.modal_overlay} onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className={styles.modal}>
            <div className={styles.modal_header}>
              <h3 className={styles.modal_title}>매출 등록</h3>
              <button className={styles.modal_close} onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modal_body}>
              <div className={styles.form_row_2}>
                <div className={styles.form_row}>
                  <label className={`${styles.form_label} ${styles.form_label_required}`}>발생일</label>
                  <input
                    type='date'
                    className={styles.form_input}
                    value={form.revenue_date}
                    onChange={(e) => setForm({ ...form, revenue_date: e.target.value })}
                  />
                </div>
                <div className={styles.form_row}>
                  <label className={styles.form_label}>사업부</label>
                  <select
                    className={styles.form_select}
                    value={form.department_id}
                    onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                  >
                    <option value=''>선택</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.form_row}>
                <label className={`${styles.form_label} ${styles.form_label_required}`}>고객명 / 거래처명</label>
                <input
                  className={styles.form_input}
                  placeholder='예: 홍길동'
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                />
              </div>

              <div className={styles.form_row_2}>
                <div className={styles.form_row}>
                  <label className={`${styles.form_label} ${styles.form_label_required}`}>금액 (원)</label>
                  <input
                    type='number'
                    className={styles.form_input}
                    placeholder='0'
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
                <div className={styles.form_row}>
                  <label className={styles.form_label}>매출 구분</label>
                  <select
                    className={styles.form_select}
                    value={form.revenue_type}
                    onChange={(e) => setForm({ ...form, revenue_type: e.target.value })}
                  >
                    <option value='CARD'>카드</option>
                    <option value='BANK_TRANSFER'>계좌이체</option>
                    <option value='OTHER'>기타</option>
                  </select>
                </div>
              </div>

              <div className={styles.form_row}>
                <label className={styles.form_label}>상품 / 과정명</label>
                <input
                  className={styles.form_input}
                  placeholder='예: 학점은행제 과정'
                  value={form.product_name}
                  onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                />
              </div>

              <div className={styles.form_row_2}>
                <div className={styles.form_row}>
                  <label className={styles.form_label}>담당자</label>
                  <select
                    className={styles.form_select}
                    value={form.manager_id}
                    onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
                  >
                    <option value=''>선택 (본인)</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.form_row}>
                <label className={styles.form_label}>메모</label>
                <textarea
                  className={styles.form_textarea}
                  placeholder='메모 (선택)'
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                />
              </div>

              {formError && <p className={styles.error_msg}>{formError}</p>}
            </div>
            <div className={styles.modal_footer}>
              <button className={styles.btn_secondary} onClick={() => setShowAddModal(false)}>취소</button>
              <button className={styles.btn_primary} onClick={handleSubmit} disabled={submitting}>
                {submitting ? '저장 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 엑셀 업로드 모달 */}
      {showUploadModal && (
        <div className={styles.modal_overlay} onClick={(e) => e.target === e.currentTarget && setShowUploadModal(false)}>
          <div className={styles.modal} style={{ maxWidth: 700 }}>
            <div className={styles.modal_header}>
              <h3 className={styles.modal_title}>엑셀 업로드</h3>
              <button className={styles.modal_close} onClick={() => { setShowUploadModal(false); setUploadRows([]); setUploadResult(null) }}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modal_body}>
              {!uploadRows.length && !uploadResult ? (
                <div
                  className={styles.upload_zone}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={32} color='var(--toss-text-tertiary)' />
                  <p className={styles.upload_zone_label}>엑셀 파일을 선택하세요</p>
                  <p className={styles.upload_zone_sub}>.xlsx, .xls 파일 지원 · 날짜, 고객명, 금액 컬럼 자동 인식</p>
                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='.xlsx,.xls'
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                </div>
              ) : uploadResult ? (
                <div className={styles.result_box}>
                  <div className={styles.result_item}>
                    <span className={styles.result_item_label}>성공</span>
                    <span className={`${styles.result_item_value} ${styles.result_success}`}>{uploadResult.success}건</span>
                  </div>
                  <div className={styles.result_item}>
                    <span className={styles.result_item_label}>중복 제외</span>
                    <span className={`${styles.result_item_value} ${styles.result_dup}`}>{uploadResult.duplicate}건</span>
                  </div>
                  <div className={styles.result_item}>
                    <span className={styles.result_item_label}>오류</span>
                    <span className={`${styles.result_item_value} ${styles.result_error}`}>{uploadResult.error}건</span>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: 'var(--toss-text-secondary)', margin: 0 }}>
                    {uploadRows.length}건 인식됨 — 등록을 진행하시겠습니까?
                  </p>
                  <div className={styles.preview_wrap}>
                    <table className={styles.preview_table}>
                      <thead>
                        <tr>
                          <th>날짜</th>
                          <th>고객명</th>
                          <th>상품명</th>
                          <th>구분</th>
                          <th>금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadRows.slice(0, 20).map((r, i) => (
                          <tr key={i} className={!r.customer_name ? styles.row_error : ''}>
                            <td>{String(r.revenue_date)}</td>
                            <td>{String(r.customer_name)}</td>
                            <td>{String(r.product_name ?? '')}</td>
                            <td>{getRevenueTypeLabel(String(r.revenue_type))}</td>
                            <td>{Number(r.amount).toLocaleString()}원</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {uploadRows.length > 20 && (
                    <p style={{ fontSize: 12, color: 'var(--toss-text-tertiary)', margin: 0 }}>
                      + {uploadRows.length - 20}건 더 있음
                    </p>
                  )}
                </>
              )}
            </div>
            <div className={styles.modal_footer}>
              <button className={styles.btn_secondary} onClick={() => { setUploadRows([]); setUploadResult(null) }}>
                {uploadResult ? '닫기' : '다시 선택'}
              </button>
              {uploadRows.length > 0 && !uploadResult && (
                <button className={styles.btn_primary} onClick={handleUpload} disabled={uploading}>
                  {uploading ? '등록 중...' : `${uploadRows.length}건 등록`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
