'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, TrendingUp, TrendingDown } from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'
import type { PieLabelRenderProps } from 'recharts'
import type { Department, ReportData } from '@/lib/management/types'
import {
  formatAmount, formatAmountShort,
  getLastMonths, getThisMonth, getMonthLabel, getRevenueTypeLabel,
} from '@/lib/management/utils'
import styles from './page.module.css'

// ─── 차트 색상 상수 ───────────────────────────────────────────────────────────

const CHART_COLORS = ['#3182F6', '#F04452', '#22C55E', '#FFB020', '#8B5CF6', '#0EA5E9', '#F97316']

// ─── Tooltip 포매터 ───────────────────────────────────────────────────────────

function amountFormatter(value: number | string) {
  if (typeof value !== 'number') return String(value)
  return formatAmountShort(value)
}

// recharts Tooltip formatter: 금액 표시용
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tooltipFormatter(value: any): string {
  const num = typeof value === 'number' ? value : Number(value)
  return formatAmount(isNaN(num) ? 0 : num)
}

function renderPieLabel({ name, percent }: PieLabelRenderProps): string {
  return `${name ?? ''} ${(((percent ?? 0) as number) * 100).toFixed(0)}%`
}

// ─── 추이 라인 차트 ───────────────────────────────────────────────────────────

interface TrendDataItem {
  label: string
  revenue: number
  expense: number
}

interface TrendLineChartProps {
  data: TrendDataItem[]
}

function TrendLineChart({ data }: TrendLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={amountFormatter} tick={{ fontSize: 11 }} width={60} />
        <Tooltip formatter={tooltipFormatter} />
        <Legend />
        <Line
          type="monotone"
          dataKey="revenue"
          name="매출"
          stroke="#3182F6"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="expense"
          name="지출"
          stroke="#F04452"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── 지출 도넛 차트 ───────────────────────────────────────────────────────────

interface DonutDataItem {
  name: string
  value: number
}

interface ExpenseDonutChartProps {
  data: DonutDataItem[]
}

function ExpenseDonutChart({ data }: ExpenseDonutChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          dataKey="value"
          nameKey="name"
          label={renderPieLabel}
          labelLine={false}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={tooltipFormatter} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ─── 사업부별 그룹 바 차트 ────────────────────────────────────────────────────

interface DeptBarDataItem {
  dept: string
  revenue: number
  expense: number
}

interface DeptBarChartProps {
  data: DeptBarDataItem[]
}

function DeptBarChart({ data }: DeptBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <XAxis dataKey="dept" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={amountFormatter} tick={{ fontSize: 11 }} width={60} />
        <Tooltip formatter={tooltipFormatter} />
        <Legend />
        <Bar dataKey="revenue" name="매출" fill="#3182F6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" name="지출" fill="#F04452" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const months = getLastMonths(12)
  const thisMonth = getThisMonth()

  const [selectedYear, setSelectedYear] = useState(thisMonth.year)
  const [selectedMonth, setSelectedMonth] = useState(thisMonth.month)
  const [deptFilter, setDeptFilter] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  // 최근 6개월 추이 데이터
  const [trendData, setTrendData] = useState<TrendDataItem[]>([])
  const [trendLoading, setTrendLoading] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ year: String(selectedYear), month: String(selectedMonth) })
    if (deptFilter) params.set('department_id', deptFilter)
    const res = await fetch(`/api/management/reports?${params}`)
    if (res.ok) setReport(await res.json())
    setLoading(false)
  }, [selectedYear, selectedMonth, deptFilter])

  // 최근 6개월 추이 데이터 수집
  const fetchTrendData = useCallback(async () => {
    setTrendLoading(true)
    try {
      const last6 = getLastMonths(6).reverse()
      const results = await Promise.all(
        last6.map(async ({ year, month }) => {
          const params = new URLSearchParams({ year: String(year), month: String(month) })
          if (deptFilter) params.set('department_id', deptFilter)
          const res = await fetch(`/api/management/reports?${params}`)
          if (!res.ok) return null
          const data: ReportData = await res.json()
          return {
            label: `${String(month).padStart(2, '0')}월`,
            revenue: data.total_revenue,
            expense: data.total_expense,
          }
        })
      )
      setTrendData(results.filter((r): r is TrendDataItem => r !== null))
    } catch {
      // 추이 데이터 로드 실패 시 무시
    } finally {
      setTrendLoading(false)
    }
  }, [deptFilter])

  useEffect(() => { fetchReport() }, [fetchReport])
  useEffect(() => { fetchTrendData() }, [fetchTrendData])
  useEffect(() => {
    fetch('/api/management/departments').then(r => r.json()).then(setDepartments).catch(() => {})
  }, [])

  const prevDiff = report
    ? report.prev_month_revenue > 0
      ? Math.round(((report.total_revenue - report.prev_month_revenue) / report.prev_month_revenue) * 1000) / 10
      : null
    : null

  const maxExpense = report
    ? Math.max(...report.expense_by_category.map((e) => e.amount), 1)
    : 1

  // 차트용 데이터 변환
  const expenseDonutData: DonutDataItem[] = report
    ? report.expense_by_category.map((e) => ({ name: e.category, value: e.amount }))
    : []

  const deptBarData: DeptBarDataItem[] = report
    ? Array.from(new Set([
        ...report.revenue_by_dept.map((r) => r.dept),
        ...report.expense_by_dept.map((e) => e.dept),
      ])).map((dept) => ({
        dept,
        revenue: report.revenue_by_dept.find((r) => r.dept === dept)?.amount ?? 0,
        expense: report.expense_by_dept.find((e) => e.dept === dept)?.amount ?? 0,
      }))
    : []

  const handleExport = () => {
    if (!report) return
    const rows = [
      ['구분', '항목', '금액'],
      ['총매출', '', report.total_revenue],
      ...report.revenue_by_type.map((r) => ['매출구분', getRevenueTypeLabel(r.type), r.amount]),
      ['총지출', '', report.total_expense],
      ...report.expense_by_category.map((e) => ['지출항목', e.category, e.amount]),
      ['추정 수익', '', report.profit],
      ['이익률', '', `${report.profit_rate}%`],
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '손익계산서')
    XLSX.writeFile(wb, `손익계산서_${report.month}.xlsx`)
  }

  return (
    <div className={styles.page_wrap}>
      {/* 헤더 */}
      <div className={styles.page_header}>
        <h2 className={styles.page_title}>손익 리포트</h2>
        <div className={styles.header_filters}>
          <select
            className={styles.filter_select}
            value={`${selectedYear}-${selectedMonth}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number)
              setSelectedYear(y); setSelectedMonth(m)
            }}
          >
            {months.map((m) => (
              <option key={m.label} value={`${m.year}-${m.month}`}>{m.label}</option>
            ))}
          </select>
          <select
            className={styles.filter_select}
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value=''>전체 사업부</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button className={styles.btn_secondary} onClick={handleExport} disabled={!report}>
            <Download size={14} /> 엑셀 다운로드
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading_state}>데이터를 불러오는 중...</div>
      ) : !report ? null : (
        <>
          {/* 요약 카드 */}
          <div className={styles.summary_grid}>
            <div className={styles.summary_card}>
              <p className={styles.summary_label}>이번달 누적 매출</p>
              <p className={`${styles.summary_value} ${styles.summary_value_blue}`}>
                {formatAmount(report.total_revenue)}
              </p>
              {prevDiff !== null && (
                <p className={styles.summary_sub}>
                  {prevDiff >= 0
                    ? <><TrendingUp size={12} className={styles.sub_up} /><span className={styles.sub_up}>+{prevDiff}%</span> 전월 대비</>
                    : <><TrendingDown size={12} className={styles.sub_down} /><span className={styles.sub_down}>{prevDiff}%</span> 전월 대비</>
                  }
                </p>
              )}
            </div>

            <div className={styles.summary_card}>
              <p className={styles.summary_label}>이번달 누적 지출</p>
              <p className={`${styles.summary_value} ${styles.summary_value_red}`}>
                {formatAmount(report.total_expense)}
              </p>
            </div>

            <div className={`${styles.summary_card} ${report.profit >= 0 ? styles.summary_card_profit : ''}`}>
              <p className={`${styles.summary_label} ${report.profit >= 0 ? styles.summary_label_white : ''}`}>
                추정 수익
              </p>
              <p className={`${styles.summary_value} ${report.profit >= 0 ? styles.summary_value_white : styles.summary_value_red}`}>
                {formatAmount(report.profit)}
              </p>
            </div>

            <div className={styles.summary_card}>
              <p className={styles.summary_label}>이익률</p>
              <p className={`${styles.summary_value} ${report.profit_rate >= 0 ? styles.summary_value_green : styles.summary_value_red}`}>
                {report.profit_rate}%
              </p>
            </div>

            <div className={styles.summary_card}>
              <p className={styles.summary_label}>전월 매출</p>
              <p className={styles.summary_value}>{formatAmount(report.prev_month_revenue)}</p>
            </div>
          </div>

          {/* ─── 차트 영역 ─────────────────────────────────────────────────── */}

          {/* 매출/지출 추이 라인 차트 */}
          <div className={styles.section}>
            <div className={styles.section_header}>
              <h3 className={styles.section_title}>매출/지출 추이 (최근 6개월)</h3>
            </div>
            <div className={styles.chart_body}>
              {trendLoading ? (
                <div className={styles.chart_loading}>차트 데이터 로딩 중...</div>
              ) : trendData.length === 0 ? (
                <div className={styles.empty_state}>추이 데이터가 없습니다.</div>
              ) : (
                <TrendLineChart data={trendData} />
              )}
            </div>
          </div>

          {/* 차트 2개 가로 배치: 지출 도넛 + 사업부별 바 차트 */}
          <div className={styles.chart_grid}>
            {/* 지출 비중 도넛 차트 */}
            <div className={styles.section}>
              <div className={styles.section_header}>
                <h3 className={styles.section_title}>지출 항목별 비중</h3>
              </div>
              <div className={styles.chart_body}>
                {expenseDonutData.length === 0 ? (
                  <div className={styles.empty_state}>지출 데이터가 없습니다.</div>
                ) : (
                  <ExpenseDonutChart data={expenseDonutData} />
                )}
              </div>
            </div>

            {/* 사업부별 매출/지출 바 차트 */}
            <div className={styles.section}>
              <div className={styles.section_header}>
                <h3 className={styles.section_title}>사업부별 매출/지출</h3>
              </div>
              <div className={styles.chart_body}>
                {deptBarData.length === 0 ? (
                  <div className={styles.empty_state}>사업부 데이터가 없습니다.</div>
                ) : (
                  <DeptBarChart data={deptBarData} />
                )}
              </div>
            </div>
          </div>

          {/* ─── 기존 상세 테이블 영역 ─────────────────────────────────────── */}

          {/* 매출/지출 상세 */}
          <div className={styles.content_grid}>
            {/* 매출 상세 */}
            <div className={styles.section}>
              <div className={styles.section_header}>
                <h3 className={styles.section_title}>총 매출</h3>
                <span className={styles.section_total}>{formatAmount(report.total_revenue)}</span>
              </div>
              {report.revenue_by_type.length === 0 ? (
                <div className={styles.empty_state}>매출 데이터가 없습니다.</div>
              ) : (
                <table className={styles.pnl_table}>
                  <tbody>
                    {report.revenue_by_type.map((r) => (
                      <tr key={r.type}>
                        <td>{getRevenueTypeLabel(r.type)} 매출</td>
                        <td>{formatAmount(r.amount)}</td>
                      </tr>
                    ))}
                    <tr className={styles.pnl_row_total}>
                      <td>매출 합계</td>
                      <td>{formatAmount(report.total_revenue)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* 지출 상세 */}
            <div className={styles.section}>
              <div className={styles.section_header}>
                <h3 className={styles.section_title}>총 지출</h3>
                <span className={styles.section_total_expense}>{formatAmount(report.total_expense)}</span>
              </div>
              {report.expense_by_category.length === 0 ? (
                <div className={styles.empty_state}>지출 데이터가 없습니다.</div>
              ) : (
                <table className={styles.pnl_table}>
                  <tbody>
                    {report.expense_by_category.map((e) => {
                      const pct = Math.round((e.amount / maxExpense) * 100)
                      return (
                        <tr key={e.category}>
                          <td>
                            <div className={styles.pnl_bar_wrap}>
                              <span className={styles.pnl_bar_label}>{e.category}</span>
                              <div className={styles.pnl_bar}>
                                <div
                                  className={`${styles.pnl_bar_fill} ${styles.pnl_bar_fill_expense}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td>{formatAmount(e.amount)}</td>
                        </tr>
                      )
                    })}
                    <tr className={styles.pnl_row_total}>
                      <td>지출 합계</td>
                      <td>{formatAmount(report.total_expense)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 간이 손익계산서 */}
          <div className={styles.section}>
            <div className={styles.section_header}>
              <h3 className={styles.section_title}>
                간이 손익계산서 — {getMonthLabel(selectedYear, selectedMonth)}
                {deptFilter ? ` · ${departments.find(d => d.id === deptFilter)?.name}` : ' · 전체'}
              </h3>
            </div>
            <table className={styles.pnl_table}>
              <tbody>
                <tr className={styles.pnl_row_total}>
                  <td>[ 총 매출 ]</td>
                  <td>{formatAmount(report.total_revenue)}</td>
                </tr>
                {report.revenue_by_type.map((r) => (
                  <tr key={r.type}>
                    <td className={styles.pnl_indent}>└ {getRevenueTypeLabel(r.type)}</td>
                    <td>{formatAmount(r.amount)}</td>
                  </tr>
                ))}
                <tr className={styles.pnl_row_total}>
                  <td>[ 총 지출 ]</td>
                  <td>{formatAmount(report.total_expense)}</td>
                </tr>
                {report.expense_by_category.map((e) => (
                  <tr key={e.category}>
                    <td className={styles.pnl_indent}>└ {e.category}</td>
                    <td>{formatAmount(e.amount)}</td>
                  </tr>
                ))}
                <tr className={report.profit >= 0 ? styles.pnl_row_total_blue : styles.pnl_row_total_red}>
                  <td>[ 매출 총이익 ]</td>
                  <td>{formatAmount(report.profit)}</td>
                </tr>
                <tr className={report.profit >= 0 ? styles.pnl_row_total_blue : styles.pnl_row_total_red}>
                  <td>[ 이익률 ]</td>
                  <td>{report.profit_rate}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 사업부별 현황 테이블 */}
          {(report.revenue_by_dept.length > 0 || report.expense_by_dept.length > 0) && (
            <div className={styles.section}>
              <div className={styles.section_header}>
                <h3 className={styles.section_title}>사업부별 현황</h3>
              </div>
              <table className={styles.dept_table}>
                <thead>
                  <tr>
                    <th>사업부</th>
                    <th>매출</th>
                    <th>지출</th>
                    <th>수익</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(new Set([
                    ...report.revenue_by_dept.map(r => r.dept),
                    ...report.expense_by_dept.map(e => e.dept),
                  ])).map((dept) => {
                    const rev = report.revenue_by_dept.find(r => r.dept === dept)?.amount ?? 0
                    const exp = report.expense_by_dept.find(e => e.dept === dept)?.amount ?? 0
                    const profit = rev - exp
                    return (
                      <tr key={dept}>
                        <td>{dept}</td>
                        <td>{formatAmount(rev)}</td>
                        <td>{formatAmount(exp)}</td>
                        <td className={profit >= 0 ? styles.profit_positive : styles.profit_negative}>
                          {formatAmount(profit)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
