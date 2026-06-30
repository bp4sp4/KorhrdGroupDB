'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import * as XLSX from 'xlsx'
import type { ValidDBItem } from '@/app/api/marketing/valid-db/route'
import styles from './DBMarketingTab.module.css'

// ─── 커스텀 Select ────────────────────────────────────────────────────────────
interface CustomSelectProps {
  value: string
  options: string[]
  onChange: (value: string) => void
  ariaLabel?: string
  minWidth?: number
}

function CustomSelect({ value, options, onChange, ariaLabel, minWidth }: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className={styles.select_wrap} style={minWidth ? { minWidth: `${minWidth}px` } : undefined}>
      <button
        type="button"
        className={`${styles.select_btn} ${open ? styles.select_btn_open : ''}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.select_value}>{value}</span>
        <span className={`${styles.select_chevron} ${open ? styles.select_chevron_open : ''}`} aria-hidden>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <ul className={styles.select_panel} role="listbox">
          {options.map((opt) => {
            const isSelected = opt === value
            return (
              <li key={opt} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  className={`${styles.select_option} ${isSelected ? styles.select_option_active : ''}`}
                  onClick={() => { onChange(opt); setOpen(false) }}
                >
                  <span>{opt}</span>
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                      <path d="M3 7.5L5.5 10L11 4.5" stroke="#3182F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────
function formatNumber(value: number): string {
  return value.toLocaleString('ko-KR')
}

function formatRate(numerator: number, denominator: number, digits = 1): string {
  if (denominator === 0) return '-'
  return `${((numerator / denominator) * 100).toFixed(digits)}%`
}

function buildMonthOptions(): string[] {
  const startYear = 2026
  const startMonth = 3
  const now = new Date()
  const endYear = now.getFullYear()
  const endMonth = now.getMonth() + 1

  const options: string[] = []
  let y = endYear
  let m = endMonth
  while (y > startYear || (y === startYear && m >= startMonth)) {
    options.push(`${y}-${String(m).padStart(2, '0')}`)
    m -= 1
    if (m === 0) { m = 12; y -= 1 }
  }
  return options
}

// ─── 합계 ─────────────────────────────────────────────────────────────────────
interface TotalRow {
  validDB: number
  completed: number
  registrations: number
}

function calcTotal(stats: ValidDBItem[]): TotalRow {
  return stats.reduce<TotalRow>(
    (acc, row) => ({
      validDB: acc.validDB + row.validDB,
      completed: acc.completed + row.completed,
      registrations: acc.registrations + row.registrations,
    }),
    { validDB: 0, completed: 0, registrations: 0 },
  )
}

// ─── 엑셀 다운로드 ────────────────────────────────────────────────────────────
function downloadExcel(stats: ValidDBItem[], yearMonth: string) {
  const headers = ['대분류', '유효DB', '상담완료', '상담완료율(%)', '등록', '등록률(%)']
  const rows = stats.map((row) => [
    row.channel,
    row.validDB,
    row.completed,
    row.validDB > 0 ? Number(((row.completed / row.validDB) * 100).toFixed(1)) : '',
    row.registrations,
    row.validDB > 0 ? Number(((row.registrations / row.validDB) * 100).toFixed(1)) : '',
  ])

  const total = calcTotal(stats)
  rows.push([
    '합계',
    total.validDB,
    total.completed,
    total.validDB > 0 ? Number(((total.completed / total.validDB) * 100).toFixed(1)) : '',
    total.registrations,
    total.validDB > 0 ? Number(((total.registrations / total.validDB) * 100).toFixed(1)) : '',
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '유효DB')
  XLSX.writeFile(wb, `유효DB_${yearMonth}.xlsx`)
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
interface ValidDBTabProps {
  division?: 'nms' | 'cert' | 'abroad'
  divisionLabel?: string
  controlledMonth?: string // 채널별 성과 등 상위에서 월을 제어할 때 (월 선택 UI 숨김)
  controlledWeek?: string  // 상위에서 주간(week_start, 월요일)을 제어할 때 (선택 UI 숨김)
}

export default function ValidDBTab({ division = 'nms', divisionLabel, controlledMonth, controlledWeek }: ValidDBTabProps = {}) {
  const monthOptions = buildMonthOptions()
  const [internalMonth, setInternalMonth] = useState(monthOptions[0])
  const selectedMonth = controlledMonth ?? internalMonth
  // 상위에서 기간을 제어하면 월 선택 UI 숨김 (월 또는 주간)
  const isControlled = !!controlledMonth || !!controlledWeek
  // 조회 기간 식별자/쿼리: 주간 우선
  const periodKey = controlledWeek ?? selectedMonth
  const periodQuery = controlledWeek
    ? `week_start=${controlledWeek}`
    : `year_month=${selectedMonth}`
  const [selectedChannel, setSelectedChannel] = useState('전체')
  const [stats, setStats] = useState<ValidDBItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/marketing/valid-db?${periodQuery}&division=${division}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? '데이터 조회 실패')
      }
      setStats(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setLoading(false)
    }
  }, [periodQuery, division])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    setSelectedChannel('전체')
  }, [periodKey])

  const channelOptions = useMemo(() => ['전체', ...stats.map((s) => s.channel)], [stats])
  const filteredStats = useMemo(
    () => selectedChannel === '전체' ? stats : stats.filter((s) => s.channel === selectedChannel),
    [stats, selectedChannel],
  )
  const total = calcTotal(filteredStats)

  return (
    <div className={styles.wrap}>
      {/* 필터 바 */}
      <div className={styles.filter_bar}>
        {!isControlled && (
          <div className={styles.filter_group}>
            <label className={styles.filter_label}>월</label>
            <CustomSelect ariaLabel="월 선택" value={selectedMonth} options={monthOptions} onChange={setInternalMonth} minWidth={120} />
          </div>
        )}
        <div className={styles.filter_group}>
          <label className={styles.filter_label}>대분류</label>
          <CustomSelect ariaLabel="대분류 선택" value={selectedChannel} options={channelOptions} onChange={setSelectedChannel} minWidth={140} />
        </div>
        {loading && <span className={styles.loading_badge}>로딩 중...</span>}
        <div className={styles.filter_spacer} />
        <button
          type="button"
          className={styles.excel_btn}
          onClick={() => downloadExcel(filteredStats, periodKey)}
          disabled={filteredStats.length === 0 || loading}
        >
          엑셀 다운로드
        </button>
      </div>

      {error && (
        <div className={styles.error_box}>
          <p className={styles.error_text}>{error}</p>
          <button type="button" className={styles.retry_btn} onClick={() => fetchStats()}>
            다시 시도
          </button>
        </div>
      )}

      {!error && (
        <div className={styles.table_wrap}>
          <div className={styles.table_overflow}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.thead_row}>
                  <th className={styles.th}>대분류</th>
                  <th className={styles.th_num}>유효DB</th>
                  <th className={styles.th_num}>상담완료</th>
                  <th className={styles.th_num}>상담완료율</th>
                  <th className={styles.th_num}>등록</th>
                  <th className={styles.th_num}>등록률</th>
                </tr>
              </thead>
              <tbody>
                {filteredStats.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className={styles.empty_cell}>
                      {divisionLabel ? `${divisionLabel} ` : ''}해당 월의 데이터가 없습니다.
                    </td>
                  </tr>
                )}
                {filteredStats.map((row) => (
                  <tr key={row.channel} className={styles.tbody_row}>
                    <td className={styles.td_channel}>{row.channel}</td>
                    <td className={styles.td_num}>{formatNumber(row.validDB)}</td>
                    <td className={styles.td_num}>{formatNumber(row.completed)}</td>
                    <td className={styles.td_num}>{formatRate(row.completed, row.validDB)}</td>
                    <td className={styles.td_num}>{formatNumber(row.registrations)}</td>
                    <td className={styles.td_num}>{formatRate(row.registrations, row.validDB)}</td>
                  </tr>
                ))}
              </tbody>
              {filteredStats.length > 0 && (
                <tfoot>
                  <tr className={styles.tfoot_row}>
                    <td className={styles.td_total_label}>합계</td>
                    <td className={styles.td_total_num}>{formatNumber(total.validDB)}</td>
                    <td className={styles.td_total_num}>{formatNumber(total.completed)}</td>
                    <td className={styles.td_total_num}>{formatRate(total.completed, total.validDB)}</td>
                    <td className={styles.td_total_num}>{formatNumber(total.registrations)}</td>
                    <td className={styles.td_total_num}>{formatRate(total.registrations, total.validDB)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      <p className={styles.hint}>
        * 유효DB = 활성 문의에서 수신거부·잘못된 번호 제외, 이름+전화번호 중복은 1건만 집계한 값입니다.
        상담완료 = 상담완료(높음/중간/낮음) + 등록완료.
      </p>
    </div>
  )
}
