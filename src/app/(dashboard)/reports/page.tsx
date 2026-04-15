'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react'
import * as XLSX from 'xlsx'
import dynamic from 'next/dynamic'
import type { DashboardData } from '@/lib/management/types'
import {
  formatAmount, formatAmountShort,
  getLastMonths, getThisMonth, getMonthLabel,
} from '@/lib/management/utils'
import styles from './page.module.css'

/* ── Ant Design Charts (SSR 비활성) ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Area = dynamic(() => import('@ant-design/charts').then(m => m.Area), { ssr: false }) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Pie = dynamic(() => import('@ant-design/charts').then(m => m.Pie), { ssr: false }) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Column = dynamic(() => import('@ant-design/charts').then(m => m.Column), { ssr: false }) as any

/* ── 색상 ── */
const SOURCE_COLORS: Record<string, string> = {
  '학점은행제': '#3182F6',
  '민간자격증': '#22C55E',
  '유학': '#8B5CF6',
  '올케어': '#EC4899',
  '계좌 입금': '#06B6D4',
}

/* ── KPI 카드 ── */
function KpiCard({ label, value, format = 'amount', color = 'default', diff, highlight }: {
  label: string; value: number; format?: 'amount' | 'percent'
  color?: 'blue' | 'red' | 'green' | 'default'; diff?: number | null; highlight?: boolean
}) {
  const colorCls = color === 'blue' ? styles.kpiBlue : color === 'red' ? styles.kpiRed : color === 'green' ? styles.kpiGreen : ''
  return (
    <div className={`${styles.kpiCard} ${highlight ? styles.kpiHighlight : ''}`}>
      <p className={`${styles.kpiLabel} ${highlight ? styles.kpiLabelLight : ''}`}>{label}</p>
      <p className={`${styles.kpiValue} ${highlight ? styles.kpiValueWhite : colorCls}`}>
        {format === 'percent' ? `${value}%` : formatAmount(value)}
      </p>
      {diff !== undefined && diff !== null && (
        <p className={styles.kpiDiff}>
          {diff >= 0
            ? <><TrendingUp size={12} className={styles.diffUp} /><span className={styles.diffUp}>+{diff}%</span></>
            : <><TrendingDown size={12} className={styles.diffDown} /><span className={styles.diffDown}>{diff}%</span></>
          }
          <span className={styles.diffLabel}>전월 대비</span>
        </p>
      )}
    </div>
  )
}

/* ── 접이식 섹션 ── */
function CollapseSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={styles.section}>
      <button className={styles.collapseBtn} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <span>{title}</span>
      </button>
      {open && <div className={styles.collapseInner}>{children}</div>}
    </div>
  )
}

/* ── 메인 페이지 ── */
export default function ReportsPage() {
  const months = getLastMonths(12)
  const thisMonth = getThisMonth()

  const [selectedYear, setSelectedYear] = useState(thisMonth.year)
  const [selectedMonth, setSelectedMonth] = useState(thisMonth.month)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ year: String(selectedYear), month: String(selectedMonth) })
      const res = await fetch(`/api/management/reports/dashboard?${params}`)
      if (res.ok) setData(await res.json())
    } catch { /* */ }
    setLoading(false)
  }, [selectedYear, selectedMonth])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const revDiff = data && data.prev_month.revenue > 0
    ? Math.round(((data.total_revenue - data.prev_month.revenue) / data.prev_month.revenue) * 1000) / 10
    : null
  const expDiff = data && data.prev_month.expense > 0
    ? Math.round(((data.total_expense - data.prev_month.expense) / data.prev_month.expense) * 1000) / 10
    : null

  /* 차트 데이터 */
  const trendData = data?.trend.flatMap(t => [
    { month: t.label, value: t.revenue, type: '매출' },
    { month: t.label, value: t.expense, type: '지출' },
    { month: t.label, value: t.profit, type: '순이익' },
  ]) ?? []

  const revenueDonut = data?.revenue_by_source.map(s => ({ source: s.source, amount: s.amount })) ?? []
  const expenseDonut = data?.expense_by_category.map(e => ({ category: e.category, amount: e.amount })) ?? []

  const deptColumnData = data ? (() => {
    const depts = Array.from(new Set([
      ...data.revenue_by_dept.map(r => r.dept),
      ...data.expense_by_dept.map(e => e.dept),
    ]))
    return depts.flatMap(dept => [
      { dept, value: data.revenue_by_dept.find(r => r.dept === dept)?.amount ?? 0, type: '매출' },
      { dept, value: data.expense_by_dept.find(e => e.dept === dept)?.amount ?? 0, type: '지출' },
    ])
  })() : []

  const handleExport = () => {
    if (!data) return
    const rows = [
      ['구분', '항목', '금액'],
      ['매출', '학점은행제', data.nms_sales],
      ['매출', '민간자격증', data.cert_sales],
      ['매출', '유학', data.abroad_sales],
      ['매출', '올케어', data.allcare_sales],
      ['매출', '계좌 입금', data.uploaded_revenue.bank_transfer],
      ['', '', ''],
      ['지출', '수동 등록', data.manual_expenses],
      ['지출', '전자결재 승인', data.approved_expenses],
      ['지출', '카드 지출', data.uploaded_revenue.card],
      ['', '', ''],
      ['합계', '총 매출', data.total_revenue],
      ['합계', '총 지출', data.total_expense],
      ['합계', '순이익', data.profit],
      ['합계', '이익률', `${data.profit_rate}%`],
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '손익리포트')
    XLSX.writeFile(wb, `손익리포트_${data.month}.xlsx`)
  }

  return (
    <div className={styles.page_wrap}>
      {/* Header */}
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
          <button className={styles.btn_secondary} onClick={handleExport} disabled={!data}>
            <Download size={14} /> 엑셀 다운로드
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading_state}>데이터를 불러오는 중...</div>
      ) : !data ? null : (
        <>
          {/* ① KPI Cards */}
          <div className={styles.kpiGrid}>
            <KpiCard label="총 매출" value={data.total_revenue} color="blue" diff={revDiff} />
            <KpiCard label="총 지출" value={data.total_expense} color="red" diff={expDiff} />
            <KpiCard label="순이익" value={data.profit} highlight={data.profit >= 0} color={data.profit >= 0 ? 'default' : 'red'} />
            <KpiCard label="이익률" value={data.profit_rate} format="percent" color={data.profit_rate >= 0 ? 'green' : 'red'} />
          </div>

          {/* ② 간이 손익계산서 */}
          <div className={styles.section}>
            <div className={styles.section_header}>
              <h3 className={styles.section_title}>
                간이 손익계산서 — {getMonthLabel(selectedYear, selectedMonth)}
              </h3>
            </div>
            <table className={styles.pnl_table}>
              <tbody>
                <tr className={styles.pnl_row_total}>
                  <td>[ 총 매출 ]</td>
                  <td>{formatAmount(data.total_revenue)}</td>
                </tr>
                {data.nms_sales > 0 && <tr><td className={styles.pnl_indent}>└ 학점은행제</td><td>{formatAmount(data.nms_sales)}</td></tr>}
                {data.cert_sales > 0 && <tr><td className={styles.pnl_indent}>└ 민간자격증</td><td>{formatAmount(data.cert_sales)}</td></tr>}
                {data.abroad_sales > 0 && <tr><td className={styles.pnl_indent}>└ 유학</td><td>{formatAmount(data.abroad_sales)}</td></tr>}
                {data.allcare_sales > 0 && <tr><td className={styles.pnl_indent}>└ 올케어</td><td>{formatAmount(data.allcare_sales)}</td></tr>}
                {data.uploaded_revenue.bank_transfer > 0 && <tr><td className={styles.pnl_indent}>└ 계좌 입금</td><td>{formatAmount(data.uploaded_revenue.bank_transfer)}</td></tr>}

                <tr className={styles.pnl_row_total}>
                  <td>[ 총 지출 ]</td>
                  <td>{formatAmount(data.total_expense)}</td>
                </tr>
                {data.manual_expenses > 0 && <tr><td className={styles.pnl_indent}>└ 수동 등록 지출</td><td>{formatAmount(data.manual_expenses)}</td></tr>}
                {data.approved_expenses > 0 && <tr><td className={styles.pnl_indent}>└ 전자결재 승인 지출</td><td>{formatAmount(data.approved_expenses)}</td></tr>}
                {data.uploaded_revenue.card > 0 && <tr><td className={styles.pnl_indent}>└ 카드 지출</td><td>{formatAmount(data.uploaded_revenue.card)}</td></tr>}

                <tr className={data.profit >= 0 ? styles.pnl_row_total_blue : styles.pnl_row_total_red}>
                  <td>[ 매출 총이익 ]</td>
                  <td>{formatAmount(data.profit)}</td>
                </tr>
                <tr className={data.profit >= 0 ? styles.pnl_row_total_blue : styles.pnl_row_total_red}>
                  <td>[ 이익률 ]</td>
                  <td>{data.profit_rate}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ③ 전월 비교 */}
          <div className={styles.prevMonthWrap}>
            <div className={styles.prevMonthCard}>
              <span className={styles.prevMonthLabel}>전월 매출</span>
              <span className={styles.prevMonthValue}>{formatAmount(data.prev_month.revenue)}</span>
            </div>
            <div className={styles.prevMonthCard}>
              <span className={styles.prevMonthLabel}>전월 지출</span>
              <span className={styles.prevMonthValue}>{formatAmount(data.prev_month.expense)}</span>
            </div>
            <div className={styles.prevMonthCard}>
              <span className={styles.prevMonthLabel}>전월 순이익</span>
              <span className={`${styles.prevMonthValue} ${data.prev_month.profit >= 0 ? styles.profit_positive : styles.profit_negative}`}>
                {formatAmount(data.prev_month.profit)}
              </span>
            </div>
          </div>

          {/* ④ 추이 + 매출 구성 (2열) */}
          <div className={styles.chartGrid2}>
            {trendData.length > 0 && (
              <div className={styles.miniSection}>
                <p className={styles.miniTitle}>매출/지출 추이 (6개월)</p>
                <Area
                  data={trendData}
                  xField="month"
                  yField="value"
                  colorField="type"
                  height={240}
                  smooth
                  style={{ fillOpacity: 0.12 }}
                  scale={{ color: { range: ['#3182F6', '#F04452', '#22C55E'] } }}
                  axis={{ y: { labelFormatter: (v: number) => formatAmountShort(v) } }}
                  tooltip={{ items: [{ field: 'value', name: 'type', valueFormatter: (v: number) => formatAmount(v) }] }}
                  legend={{ color: { position: 'top', layout: { justifyContent: 'center' } } }}
                />
              </div>
            )}
            {revenueDonut.length > 0 && (
              <div className={styles.miniSection}>
                <p className={styles.miniTitle}>매출 구성</p>
                <Pie
                  data={revenueDonut}
                  angleField="amount"
                  colorField="source"
                  innerRadius={0.55}
                  radius={0.85}
                  height={240}
                  color={revenueDonut.map((d: { source: string }) => SOURCE_COLORS[d.source] ?? '#3182F6')}
                  label={{
                    text: (d: { source: string; amount: number }) => {
                      const total = revenueDonut.reduce((s: number, i: { amount: number }) => s + i.amount, 0)
                      const pct = total > 0 ? Math.round((d.amount / total) * 100) : 0
                      return pct >= 8 ? `${d.source} ${pct}%` : ''
                    },
                    style: { fontSize: 11, fontWeight: 500 },
                  }}
                  legend={{ color: { position: 'bottom', layout: { justifyContent: 'center' } } }}
                  tooltip={{ title: 'source', items: [{ field: 'amount', name: '금액', valueFormatter: (v: number) => formatAmount(v) }] }}
                  style={{ stroke: '#fff', lineWidth: 2 }}
                />
              </div>
            )}
          </div>

          {/* ⑤ 지출 구성 + 사업부별 (2열) */}
          <div className={styles.chartGrid2}>
            {expenseDonut.length > 0 && (
              <div className={styles.miniSection}>
                <p className={styles.miniTitle}>지출 구성</p>
                <Pie
                  data={expenseDonut}
                  angleField="amount"
                  colorField="category"
                  innerRadius={0.55}
                  radius={0.85}
                  height={240}
                  label={{
                    text: (d: { category: string; amount: number }) => {
                      const total = expenseDonut.reduce((s: number, i: { amount: number }) => s + i.amount, 0)
                      const pct = total > 0 ? Math.round((d.amount / total) * 100) : 0
                      return pct >= 8 ? `${d.category} ${pct}%` : ''
                    },
                    style: { fontSize: 11, fontWeight: 500 },
                  }}
                  legend={{ color: { position: 'bottom', layout: { justifyContent: 'center' } } }}
                  tooltip={{ title: 'category', items: [{ field: 'amount', name: '금액', valueFormatter: (v: number) => formatAmount(v) }] }}
                  style={{ stroke: '#fff', lineWidth: 2 }}
                />
              </div>
            )}
            {deptColumnData.length > 0 && (
              <div className={styles.miniSection}>
                <p className={styles.miniTitle}>사업부별 매출/지출</p>
                <Column
                  data={deptColumnData}
                  xField="dept"
                  yField="value"
                  colorField="type"
                  group
                  height={240}
                  scale={{ color: { range: ['#3182F6', '#F04452'] } }}
                  axis={{ y: { labelFormatter: (v: number) => formatAmountShort(v) } }}
                  tooltip={{ items: [{ field: 'value', name: 'type', valueFormatter: (v: number) => formatAmount(v) }] }}
                  legend={{ color: { position: 'top', layout: { justifyContent: 'center' } } }}
                  style={{ radiusTopLeft: 3, radiusTopRight: 3 }}
                />
              </div>
            )}
          </div>

          {/* ⑥ 매출/지출 상세 (접이식) */}
          <CollapseSection title="매출/지출 상세 내역">
            <div className={styles.detailGrid}>
              <div className={styles.detailSection}>
                <h4 className={styles.detailTitle}>매출 상세</h4>
                <table className={styles.pnl_table}>
                  <tbody>
                    {data.revenue_by_source.map(s => (
                      <tr key={s.source}>
                        <td>
                          <span className={styles.compDotInline} style={{ background: SOURCE_COLORS[s.source] ?? '#3182F6' }} />
                          {s.source}
                        </td>
                        <td>{formatAmount(s.amount)}</td>
                      </tr>
                    ))}
                    <tr className={styles.pnl_row_total}>
                      <td>매출 합계</td>
                      <td>{formatAmount(data.total_revenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className={styles.detailSection}>
                <h4 className={styles.detailTitle}>지출 상세</h4>
                <table className={styles.pnl_table}>
                  <tbody>
                    {data.expense_by_category.map(e => (
                      <tr key={e.category}>
                        <td>{e.category}</td>
                        <td>{formatAmount(e.amount)}</td>
                      </tr>
                    ))}
                    <tr className={styles.pnl_row_total}>
                      <td>지출 합계</td>
                      <td>{formatAmount(data.total_expense)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </CollapseSection>
        </>
      )}
    </div>
  )
}
