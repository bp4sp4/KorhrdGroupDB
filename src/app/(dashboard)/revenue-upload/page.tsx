'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, Download, X, FileSpreadsheet, Trash2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import styles from './page.module.css'
import type { Department } from '@/lib/management/types'
import type { UploadBatch } from '@/lib/management/types'

type RevenueType = 'CARD' | 'BANK_TRANSFER' | 'OTHER'

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
}

const REVENUE_TYPE_MAP: Record<string, RevenueType> = {
  '카드': 'CARD',
  '계좌': 'BANK_TRANSFER',
  '계좌입금': 'BANK_TRANSFER',
  '기타': 'OTHER',
}

const TEMPLATE_COLUMNS = ['발생일', '사업부', '매출구분', '거래처명', '금액', '상품/과정명', '담당자', '메모']

export default function RevenueUploadPage() {
  const [tab, setTab] = useState<'upload' | 'history'>('upload')
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<{ id: string; display_name: string }[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [batches, setBatches] = useState<UploadBatch[]>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/management/departments').then(r => r.json()).then(setDepartments).catch(() => {})
    fetch('/api/management/users').then(r => r.json()).then(setUsers).catch(() => {})
  }, [])

  useEffect(() => {
    if (tab === 'history') fetchBatches()
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBatches = async () => {
    setBatchLoading(true)
    try {
      const res = await fetch('/api/management/revenues/batches')
      const data = await res.json()
      setBatches(data.batches ?? [])
    } catch { /* */ }
    setBatchLoading(false)
  }

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
        const manager = users.find(u => u.display_name === r.manager_name)
        return {
          revenue_date: r.revenue_date,
          department_id: r.department_id || null,
          revenue_type: r.revenue_type,
          customer_name: r.customer_name,
          amount: r.amount,
          product_name: r.product_name || null,
          manager_id: manager?.id || null,
          memo: r.memo || null,
        }
      })

      const res = await fetch('/api/management/revenues/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      setResult({ success: data.success ?? 0, duplicate: data.duplicate ?? 0, error: data.error ?? 0 })
      setPreview([])
      setFile(null)
    } catch {
      alert('업로드 중 오류가 발생했습니다.')
    }
    setUploading(false)
  }

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm('이 배치의 모든 매출 데이터를 삭제하시겠습니까?')) return
    try {
      await fetch(`/api/management/revenues/batches/${batchId}`, { method: 'DELETE' })
      fetchBatches()
    } catch { /* */ }
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

  const fmtType = (types: string[]) => {
    return types.map(t => {
      if (t === 'CARD') return { label: '카드', cls: styles.typeBadgeCard }
      if (t === 'BANK_TRANSFER') return { label: '계좌', cls: styles.typeBadgeBank }
      return { label: '기타', cls: styles.typeBadgeOther }
    })
  }

  return (
    <div className={styles.pageWrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>매출 데이터 관리</h1>
          <p className={styles.pageSubtitle}>카드 매출, 계좌 입금 데이터를 엑셀로 업로드하여 관리합니다.</p>
        </div>
      </div>

      <div className={styles.tabRow}>
        <button className={`${styles.tabBtn} ${tab === 'upload' ? styles.tabBtnActive : ''}`} onClick={() => setTab('upload')}>업로드</button>
        <button className={`${styles.tabBtn} ${tab === 'history' ? styles.tabBtnActive : ''}`} onClick={() => setTab('history')}>업로드 이력</button>
      </div>

      {tab === 'upload' && (
        <>
          {result && (
            <div className={styles.resultWrap}>
              <p className={styles.resultTitle}>업로드 완료</p>
              <p className={styles.resultDetail}>
                성공 {result.success}건{result.duplicate > 0 && ` · 중복 ${result.duplicate}건`}{result.error > 0 && ` · 오류 ${result.error}건`}
              </p>
            </div>
          )}

          <div className={styles.card}>
            <div className={styles.cardHeaderRow}>
              <h2 className={styles.cardTitle}>1. 파일 업로드</h2>
              <button className={styles.templateBtn} onClick={downloadTemplate}>
                <Download size={14} />
                템플릿 다운로드
              </button>
            </div>
            <p className={styles.cardDesc}>
              필수 항목: 발생일, 사업부, 매출구분(카드/계좌/기타), 거래처명, 금액
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              hidden
            />
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
                <h2 className={styles.previewTitle}>2. 미리보기</h2>
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
                <p className={styles.previewCount} style={{ marginTop: '8px' }}>
                  상위 100건만 표시 (전체 {preview.length}건)
                </p>
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
      )}

      {tab === 'history' && (
        <>
          {batchLoading ? (
            <div className={styles.loadingWrap}>불러오는 중...</div>
          ) : batches.length === 0 ? (
            <div className={styles.emptyWrap}>
              <FileSpreadsheet size={32} />
              <p className={styles.emptyText}>업로드 이력이 없습니다.</p>
            </div>
          ) : (
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
                  <button className={styles.batchDeleteBtn} onClick={() => handleDeleteBatch(b.batch_id)}>
                    <Trash2 size={13} /> 삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
