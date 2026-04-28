'use client'

import { useState, useEffect, useCallback, useRef, KeyboardEvent, useMemo } from 'react'
import * as XLSX from 'xlsx'
import type { ChannelStatItem } from '@/app/api/marketing/channel-stats/route'
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


function formatCostPer(adCost: number, denominator: number): string {
  if (adCost === 0 || denominator === 0) return '-'
  return `${formatNumber(Math.round(adCost / denominator))}원`
}

function calcGrowthRate(current: number, prev: number): number | null {
  if (prev === 0) return null
  return ((current - prev) / prev) * 100
}

function buildMonthOptions(): string[] {
  // 시작: 2026-03, 끝: 현재 월 (최신순 내림차순)
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

// ─── 합계 행 ─────────────────────────────────────────────────────────────────

interface TotalRow {
  inquiries: number
  registrations: number
  adCost: number
  prevInquiries: number
}

function calcTotal(stats: ChannelStatItem[]): TotalRow {
  return stats.reduce<TotalRow>(
    (acc, row) => ({
      inquiries: acc.inquiries + row.inquiries,
      registrations: acc.registrations + row.registrations,
      adCost: acc.adCost + row.adCost,
      prevInquiries: acc.prevInquiries + row.prevInquiries,
    }),
    { inquiries: 0, registrations: 0, adCost: 0, prevInquiries: 0 }
  )
}

// ─── 엑셀 다운로드 ────────────────────────────────────────────────────────────

function downloadExcel(stats: ChannelStatItem[], yearMonth: string) {
  const headers = ['대분류', '문의 수', '문의당 비용(원)', '등록수', '등록률(%)', '광고비(원)', '등록당 비용(원)', '전월 대비 증감률(%)']

  const rows = stats.map((row) => {
    const growthRate = calcGrowthRate(row.inquiries, row.prevInquiries)
    return [
      row.channel,
      row.inquiries,
      row.adCost > 0 && row.inquiries > 0 ? Math.round(row.adCost / row.inquiries) : '',
      row.registrations,
      row.inquiries > 0 ? Number(((row.registrations / row.inquiries) * 100).toFixed(1)) : '',
      row.adCost || '',
      row.adCost > 0 && row.registrations > 0 ? Math.round(row.adCost / row.registrations) : '',
      growthRate !== null ? Number(growthRate.toFixed(1)) : '',
    ]
  })

  const total = calcTotal(stats)
  const totalGrowth = calcGrowthRate(total.inquiries, total.prevInquiries)
  rows.push([
    '합계',
    total.inquiries,
    total.adCost > 0 && total.inquiries > 0 ? Math.round(total.adCost / total.inquiries) : '',
    total.registrations,
    total.inquiries > 0 ? Number(((total.registrations / total.inquiries) * 100).toFixed(1)) : '',
    total.adCost || '',
    total.adCost > 0 && total.registrations > 0 ? Math.round(total.adCost / total.registrations) : '',
    totalGrowth !== null ? Number(totalGrowth.toFixed(1)) : '',
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 18 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '채널별성과')
  XLSX.writeFile(wb, `채널별성과_${yearMonth}.xlsx`)
}

// ─── 광고비 셀 ────────────────────────────────────────────────────────────────

interface AdCostCellProps {
  channel: string
  yearMonth: string
  division: string
  value: number
  onSave: (channel: string, adCost: number) => void
}

function AdCostCell({ channel, yearMonth, division, value, onSave }: AdCostCellProps) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    setInputValue(String(value))
    setEditing(true)
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleSave = useCallback(async () => {
    const parsed = Number(inputValue.replace(/,/g, '').trim())
    if (isNaN(parsed) || parsed < 0) { setEditing(false); return }
    if (parsed === value) { setEditing(false); return }

    setSaving(true)
    onSave(channel, parsed)
    setEditing(false)
    setSaving(false)

    try {
      const res = await fetch('/api/marketing/ad-costs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, year_month: yearMonth, ad_cost: parsed, division }),
      })
      if (!res.ok) onSave(channel, value)
    } catch {
      onSave(channel, value)
    }
  }, [channel, yearMonth, division, inputValue, value, onSave])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave() }
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className={styles.ad_cost_input}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={saving}
        placeholder="0"
      />
    )
  }

  return (
    <button type="button" className={styles.ad_cost_btn} onClick={handleClick}>
      {value === 0 ? <span className={styles.ad_cost_empty}>입력</span> : `${formatNumber(value)}원`}
    </button>
  )
}

// ─── 증감률 셀 ────────────────────────────────────────────────────────────────

function GrowthCell({ current, prev }: { current: number; prev: number }) {
  const rate = calcGrowthRate(current, prev)
  if (rate === null) return <span className={styles.growth_neutral}>-</span>
  if (rate > 0) return <span className={styles.growth_up}>+{rate.toFixed(1)}%</span>
  if (rate < 0) return <span className={styles.growth_down}>{rate.toFixed(1)}%</span>
  return <span className={styles.growth_neutral}>0.0%</span>
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

interface DBMarketingTabProps {
  division?: 'nms' | 'cert' | 'abroad'
  divisionLabel?: string
}

export default function DBMarketingTab({ division = 'nms', divisionLabel }: DBMarketingTabProps = {}) {
  const monthOptions = buildMonthOptions()
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0])
  const [selectedChannel, setSelectedChannel] = useState('전체')
  const [stats, setStats] = useState<ChannelStatItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async (yearMonth: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/marketing/channel-stats?year_month=${yearMonth}&division=${division}`)
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
  }, [division])

  useEffect(() => {
    fetchStats(selectedMonth)
  }, [selectedMonth, fetchStats])

  // 채널 변경 시 필터 초기화
  useEffect(() => {
    setSelectedChannel('전체')
  }, [selectedMonth])

  const handleAdCostSave = useCallback((channel: string, adCost: number) => {
    setStats((prev) => prev.map((row) => row.channel === channel ? { ...row, adCost } : row))
  }, [])

  // 채널 목록 (필터 옵션)
  const channelOptions = useMemo(() => ['전체', ...stats.map((s) => s.channel)], [stats])

  // 필터 적용된 데이터
  const filteredStats = useMemo(
    () => selectedChannel === '전체' ? stats : stats.filter((s) => s.channel === selectedChannel),
    [stats, selectedChannel]
  )

  const total = calcTotal(filteredStats)

  return (
    <div className={styles.wrap}>
      {/* 필터 바 */}
      <div className={styles.filter_bar}>
        <div className={styles.filter_group}>
          <label className={styles.filter_label}>월</label>
          <CustomSelect
            ariaLabel="월 선택"
            value={selectedMonth}
            options={monthOptions}
            onChange={setSelectedMonth}
            minWidth={120}
          />
        </div>

        <div className={styles.filter_group}>
          <label className={styles.filter_label}>대분류</label>
          <CustomSelect
            ariaLabel="대분류 선택"
            value={selectedChannel}
            options={channelOptions}
            onChange={setSelectedChannel}
            minWidth={140}
          />
        </div>

        {loading && <span className={styles.loading_badge}>로딩 중...</span>}

        <div className={styles.filter_spacer} />

        <button
          type="button"
          className={styles.excel_btn}
          onClick={() => downloadExcel(filteredStats, selectedMonth)}
          disabled={filteredStats.length === 0 || loading}
        >
          엑셀 다운로드
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div className={styles.error_box}>
          <p className={styles.error_text}>{error}</p>
          <button type="button" className={styles.retry_btn} onClick={() => fetchStats(selectedMonth)}>
            다시 시도
          </button>
        </div>
      )}

      {/* 테이블 */}
      {!error && (
        <div className={styles.table_wrap}>
          <div className={styles.table_overflow}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.thead_row}>
                <th className={styles.th}>대분류</th>
                <th className={styles.th_num}>문의 수</th>
                <th className={styles.th_num}>문의당 비용</th>
                <th className={styles.th_num}>등록 수</th>
                <th className={styles.th_num}>등록률</th>
                <th className={styles.th_num}>광고비</th>
                <th className={styles.th_num}>등록당 비용</th>
                <th className={styles.th_num}>전월 대비 증감률</th>
              </tr>
            </thead>
            <tbody>
              {filteredStats.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className={styles.empty_cell}>
                    {divisionLabel ? `${divisionLabel} ` : ''}해당 월의 데이터가 없습니다.
                  </td>
                </tr>
              )}
              {filteredStats.map((row) => (
                <tr key={row.channel} className={styles.tbody_row}>
                  <td className={styles.td_channel}>{row.channel}</td>
                  <td className={styles.td_num}>{formatNumber(row.inquiries)}</td>
                  <td className={styles.td_num}>{formatCostPer(row.adCost, row.inquiries)}</td>
                  <td className={styles.td_num}>{formatNumber(row.registrations)}</td>
                  <td className={styles.td_num}>{formatRate(row.registrations, row.inquiries)}</td>
                  <td className={styles.td_num}>
                    <AdCostCell
                      channel={row.channel}
                      yearMonth={selectedMonth}
                      division={division}
                      value={row.adCost}
                      onSave={handleAdCostSave}
                    />
                  </td>
                  <td className={styles.td_num}>{formatCostPer(row.adCost, row.registrations)}</td>
                  <td className={styles.td_num}>
                    <GrowthCell current={row.inquiries} prev={row.prevInquiries} />
                  </td>
                </tr>
              ))}
            </tbody>
            {filteredStats.length > 0 && (
              <tfoot>
                <tr className={styles.tfoot_row}>
                  <td className={styles.td_total_label}>합계</td>
                  <td className={styles.td_total_num}>{formatNumber(total.inquiries)}</td>
                  <td className={styles.td_total_num}>{formatCostPer(total.adCost, total.inquiries)}</td>
                  <td className={styles.td_total_num}>{formatNumber(total.registrations)}</td>
                  <td className={styles.td_total_num}>{formatRate(total.registrations, total.inquiries)}</td>
                  <td className={styles.td_total_num}>{total.adCost > 0 ? `${formatNumber(total.adCost)}원` : '-'}</td>
                  <td className={styles.td_total_num}>{formatCostPer(total.adCost, total.registrations)}</td>
                  <td className={styles.td_total_num}>
                    <GrowthCell current={total.inquiries} prev={total.prevInquiries} />
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
          </div>
        </div>
      )}

      <p className={styles.hint}>
        * 광고비 셀을 클릭하면 수기 입력할 수 있습니다. Enter 또는 포커스 이탈 시 저장됩니다.
      </p>
    </div>
  )
}
