'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import type { DashboardResponse } from '@/app/api/marketing/dashboard-stats/route'
import styles from './DashboardTab.module.css'

interface DashboardTabProps {
  division?: 'nms' | 'cert' | 'abroad'
  divisionLabel?: string
}

// ── 유틸 ────────────────────────────────────────────────────
function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR')
}

function formatRate(num: number, den: number, digits = 1): string {
  if (den === 0) return '-'
  return `${((num / den) * 100).toFixed(digits)}%`
}

function calcGrowth(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return ((curr - prev) / prev) * 100
}

function formatChange(curr: number, prev: number): { text: string; cls: string } {
  const rate = calcGrowth(curr, prev)
  if (rate === null) return { text: '전월 대비 -', cls: styles.change_flat }
  if (rate > 0) return { text: `전월 대비 ▲ ${rate.toFixed(1)}%`, cls: styles.change_up }
  if (rate < 0) return { text: `전월 대비 ▼ ${Math.abs(rate).toFixed(1)}%`, cls: styles.change_down }
  return { text: '전월 대비 0.0%', cls: styles.change_flat }
}

function buildRange(preset: 'thisMonth' | 'lastMonth' | 'last7d' | 'last30d' | 'last90d'): { start: string; end: string } {
  const now = new Date()
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (preset === 'thisMonth') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { start: fmt(start), end: fmt(end) }
  }
  if (preset === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    return { start: fmt(start), end: fmt(end) }
  }
  const days = preset === 'last7d' ? 6 : preset === 'last30d' ? 29 : 89
  const end = now
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  return { start: fmt(start), end: fmt(end) }
}

function shortDateLabel(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${m}/${d}`
}

const PIE_COLORS = ['#3182F6', '#10B981', '#F59E0B', '#8B5CF6', '#94A3B8', '#EC4899', '#06B6D4', '#F43F5E']
const RANK_EMOJI = ['🥇', '🥈', '🥉']

// ── 컴포넌트 ────────────────────────────────────────────────
export default function DashboardTab({ division = 'nms', divisionLabel }: DashboardTabProps = {}) {
  const [preset, setPreset] = useState<'thisMonth' | 'lastMonth' | 'last7d' | 'last30d' | 'last90d'>('thisMonth')
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { start, end } = buildRange(preset)
      const res = await fetch(`/api/marketing/dashboard-stats?division=${division}&start=${start}&end=${end}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? '데이터 조회 실패')
      }
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setLoading(false)
    }
  }, [preset, division])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const kpiSummary = useMemo(() => {
    if (!data) return null
    const { kpi } = data
    const dbCost = kpi.inquiries > 0 ? Math.round(kpi.adCost / kpi.inquiries) : 0
    const prevDbCost = kpi.prevInquiries > 0 ? Math.round(kpi.prevAdCost / kpi.prevInquiries) : 0
    const regRate = kpi.inquiries > 0 ? (kpi.registrations / kpi.inquiries) * 100 : 0
    const prevRegRate = kpi.prevInquiries > 0 ? (kpi.prevRegistrations / kpi.prevInquiries) * 100 : 0
    const regCost = kpi.registrations > 0 ? Math.round(kpi.adCost / kpi.registrations) : 0
    const prevRegCost = kpi.prevRegistrations > 0 ? Math.round(kpi.prevAdCost / kpi.prevRegistrations) : 0
    return { dbCost, prevDbCost, regRate, prevRegRate, regCost, prevRegCost }
  }, [data])

  const totalChannelInquiries = useMemo(() => {
    if (!data) return 0
    return data.channels.reduce((sum, c) => sum + c.inquiries, 0)
  }, [data])

  const dailyRegRateData = useMemo(() => {
    if (!data) return []
    return data.daily.map((p) => ({
      date: p.date,
      label: shortDateLabel(p.date),
      rate: p.inquiries > 0 ? (p.registrations / p.inquiries) * 100 : 0,
    }))
  }, [data])

  const dailyInquiryData = useMemo(() => {
    if (!data) return []
    return data.daily.map((p) => ({ date: p.date, label: shortDateLabel(p.date), value: p.inquiries }))
  }, [data])

  return (
    <div className={styles.wrap}>
      {/* 필터 바 */}
      <div className={styles.filter_bar}>
        <span className={styles.filter_label}>기간</span>
        <button type="button" className={`${styles.range_btn} ${preset === 'last7d' ? styles.range_btn_active : ''}`} onClick={() => setPreset('last7d')}>최근 7일</button>
        <button type="button" className={`${styles.range_btn} ${preset === 'last30d' ? styles.range_btn_active : ''}`} onClick={() => setPreset('last30d')}>최근 30일</button>
        <button type="button" className={`${styles.range_btn} ${preset === 'last90d' ? styles.range_btn_active : ''}`} onClick={() => setPreset('last90d')}>최근 90일</button>
        <button type="button" className={`${styles.range_btn} ${preset === 'thisMonth' ? styles.range_btn_active : ''}`} onClick={() => setPreset('thisMonth')}>당월</button>
        <button type="button" className={`${styles.range_btn} ${preset === 'lastMonth' ? styles.range_btn_active : ''}`} onClick={() => setPreset('lastMonth')}>전월</button>
        {loading && <span className={styles.loading_badge}>로딩 중...</span>}
        <div className={styles.spacer} />
      </div>

      {error && (
        <div className={styles.error_box}>
          <span className={styles.error_text}>{error}</span>
          <button type="button" className={styles.retry_btn} onClick={fetchStats}>다시 시도</button>
        </div>
      )}

      {!error && data && kpiSummary && (
        <>
          {/* KPI */}
          <div className={styles.kpi_grid}>
            <KpiCard label="문의 수" value={formatNumber(data.kpi.inquiries)} change={formatChange(data.kpi.inquiries, data.kpi.prevInquiries)} />
            <KpiCard label="DB당 비용" value={`${formatNumber(kpiSummary.dbCost)}원`} change={formatChange(kpiSummary.dbCost, kpiSummary.prevDbCost)} invertColor />
            <KpiCard label="등록률" value={`${kpiSummary.regRate.toFixed(1)}%`} change={formatChange(kpiSummary.regRate, kpiSummary.prevRegRate)} />
            <KpiCard label="광고비" value={`${formatNumber(data.kpi.adCost)}원`} change={formatChange(data.kpi.adCost, data.kpi.prevAdCost)} invertColor />
            <KpiCard label="등록당 비용" value={`${formatNumber(kpiSummary.regCost)}원`} change={formatChange(kpiSummary.regCost, kpiSummary.prevRegCost)} invertColor />
          </div>

          {/* 차트 영역 */}
          <div className={styles.chart_grid}>
            {/* DB 추이 */}
            <div className={styles.chart_card}>
              <div className={styles.chart_header}>
                <span className={styles.chart_title}>DB 추이 (문의 수)</span>
              </div>
              <div className={styles.chart_body}>
                {dailyInquiryData.length === 0 ? (
                  <div className={styles.chart_empty}>데이터가 없습니다</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyInquiryData}>
                      <defs>
                        <linearGradient id="g_inq" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3182F6" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#3182F6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f6" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8b95a1' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#8b95a1' }} axisLine={false} tickLine={false} width={32} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${formatNumber(Number(v) || 0)}건`, '문의']} />
                      <Area type="monotone" dataKey="value" stroke="#3182F6" strokeWidth={2} fill="url(#g_inq)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* 등록률 추이 */}
            <div className={styles.chart_card}>
              <div className={styles.chart_header}>
                <span className={styles.chart_title}>등록률 추이</span>
              </div>
              <div className={styles.chart_body}>
                {dailyRegRateData.length === 0 ? (
                  <div className={styles.chart_empty}>데이터가 없습니다</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyRegRateData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f6" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8b95a1' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#8b95a1' }} axisLine={false} tickLine={false} width={32} unit="%" />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${(Number(v) || 0).toFixed(1)}%`, '등록률']} />
                      <Line type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* 채널별 DB 비중 */}
            <div className={styles.chart_card}>
              <div className={styles.chart_header}>
                <span className={styles.chart_title}>채널별 DB 비중</span>
              </div>
              <div className={styles.chart_body}>
                {data.channels.length === 0 ? (
                  <div className={styles.chart_empty}>데이터가 없습니다</div>
                ) : (
                  <div className={styles.pie_wrap}>
                    <div className={styles.pie_chart}>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={data.channels} dataKey="inquiries" nameKey="channel" innerRadius={50} outerRadius={75} paddingAngle={2}>
                            {data.channels.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${formatNumber(Number(v) || 0)}건`, '문의']} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className={styles.pie_center}>
                        <span className={styles.pie_center_label}>전체</span>
                        <span className={styles.pie_center_value}>{formatNumber(totalChannelInquiries)}건</span>
                      </div>
                    </div>
                    <div className={styles.pie_legend}>
                      {data.channels.slice(0, 5).map((c, i) => (
                        <div key={c.channel} className={styles.pie_legend_item}>
                          <span className={styles.pie_legend_dot} style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className={styles.pie_legend_name}>{c.channel}</span>
                          <span className={styles.pie_legend_value}>{formatNumber(c.inquiries)}건</span>
                          <span className={styles.pie_legend_pct}>
                            ({totalChannelInquiries > 0 ? Math.round((c.inquiries / totalChannelInquiries) * 100) : 0}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* TOP 3 */}
          <div className={styles.top_grid}>
            {/* 채널별 TOP 3 */}
            <div className={styles.top_card}>
              <div className={styles.top_title}>채널별 TOP 3 (등록 수 기준)</div>
              {data.topChannels.length === 0 ? (
                <div className={styles.top_empty}>데이터가 없습니다</div>
              ) : (
                <table className={styles.top_table}>
                  <thead className={styles.top_thead}>
                    <tr>
                      <th className={styles.top_th}>순위</th>
                      <th className={styles.top_th}>채널</th>
                      <th className={`${styles.top_th} ${styles.top_th_num}`}>DB수</th>
                      <th className={`${styles.top_th} ${styles.top_th_num}`}>등록수</th>
                      <th className={`${styles.top_th} ${styles.top_th_num}`}>등록률</th>
                      <th className={`${styles.top_th} ${styles.top_th_num}`}>등록당 비용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topChannels.map((c, i) => (
                      <tr key={c.channel}>
                        <td className={`${styles.top_td} ${styles.top_rank}`}>{RANK_EMOJI[i] ?? i + 1}</td>
                        <td className={styles.top_td}>{c.channel}</td>
                        <td className={`${styles.top_td} ${styles.top_td_num}`}>{formatNumber(c.inquiries)}</td>
                        <td className={`${styles.top_td} ${styles.top_td_num}`}>{formatNumber(c.registrations)}</td>
                        <td className={`${styles.top_td} ${styles.top_td_num}`}>{formatRate(c.registrations, c.inquiries)}</td>
                        <td className={`${styles.top_td} ${styles.top_td_num}`}>
                          {c.registrations > 0 && c.adCost > 0 ? `${formatNumber(Math.round(c.adCost / c.registrations))}원` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 소재별 TOP 3 */}
            <div className={styles.top_card}>
              <div className={styles.top_title}>소재별 TOP 3 (등록당 비용 기준)</div>
              {data.topCreatives.length === 0 ? (
                <div className={styles.top_empty}>데이터가 없습니다</div>
              ) : (
                <table className={styles.top_table}>
                  <thead className={styles.top_thead}>
                    <tr>
                      <th className={styles.top_th}>순위</th>
                      <th className={styles.top_th}>소재</th>
                      <th className={styles.top_th}>채널</th>
                      <th className={`${styles.top_th} ${styles.top_th_num}`}>등록수</th>
                      <th className={`${styles.top_th} ${styles.top_th_num}`}>등록당 비용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topCreatives.map((c, i) => (
                      <tr key={c.id}>
                        <td className={`${styles.top_td} ${styles.top_rank}`}>{RANK_EMOJI[i] ?? i + 1}</td>
                        <td className={styles.top_td}>
                          <div className={styles.top_creative_cell}>
                            {c.thumbnailUrl ? (
                              <span className={styles.top_thumbnail} style={{ backgroundImage: `url(${c.thumbnailUrl})` }} />
                            ) : (
                              <span className={styles.top_thumbnail_empty}>🖼️</span>
                            )}
                            <span className={styles.top_creative_name}>{c.name}</span>
                          </div>
                        </td>
                        <td className={styles.top_td}>{c.channel}</td>
                        <td className={`${styles.top_td} ${styles.top_td_num}`}>{formatNumber(c.registrations)}</td>
                        <td className={`${styles.top_td} ${styles.top_td_num}`}>{c.costPerReg !== null ? `${formatNumber(c.costPerReg)}원` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {!error && !data && !loading && (
        <div className={styles.chart_empty}>{divisionLabel ?? ''} 데이터를 불러오는 중...</div>
      )}
    </div>
  )
}

// ── KPI 카드 ────────────────────────────────────────────────
interface KpiCardProps {
  label: string
  value: string
  change: { text: string; cls: string }
  invertColor?: boolean
}

function KpiCard({ label, value, change, invertColor }: KpiCardProps) {
  // invertColor: 비용 지표는 증가가 부정적 → 색상 의미 반전
  const changeCls = invertColor
    ? change.cls === styles.change_up ? styles.change_down
      : change.cls === styles.change_down ? styles.change_up
        : change.cls
    : change.cls
  return (
    <div className={styles.kpi_card}>
      <div className={styles.kpi_header}>
        <span className={styles.kpi_label}>{label}</span>
      </div>
      <span className={styles.kpi_value}>{value}</span>
      <span className={`${styles.kpi_change} ${changeCls}`}>{change.text}</span>
    </div>
  )
}
