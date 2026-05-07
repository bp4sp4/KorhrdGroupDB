'use client'

import { useState, useEffect } from 'react'
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

/* ── section 스타일 + 접이식 헤더 ── */
function FoldableSection({
  eyebrow, title, caption, headerExtra, defaultOpen = false, children,
}: {
  eyebrow?: string
  title: string
  caption?: React.ReactNode
  headerExtra?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={styles.section}>
      <div
        className={styles.section_header}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(v => !v)}
      >
        <div>
          {eyebrow && <span className={styles.section_eyebrow}>{eyebrow}</span>}
          <h3 className={styles.section_title}>{title}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} onClick={(e) => e.stopPropagation()}>
          {caption && <span className={styles.section_caption}>{caption}</span>}
          {headerExtra}
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-label={open ? '접기' : '펼치기'}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, border: '1px solid #e5e8eb', borderRadius: 8,
              background: '#fff', cursor: 'pointer', color: '#4e5968',
            }}
          >
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>
      {open && <div>{children}</div>}
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

  // 고정비 매칭 데이터
  interface FixedCostItem {
    date: string
    time: string
    amount: number
    remarks: string
    account: string
    fixedCost: { description: string; amount: number; note: string; company: string }
  }
  interface FixedCostCategory { description: string; count: number; total: number }
  interface FixedCostAccountSummary { account: string; count: number; total: number }
  interface FixedCostResponse {
    month: string
    total: number
    count: number
    items: FixedCostItem[]
    categories: FixedCostCategory[]
    accountSummary: FixedCostAccountSummary[]
    totalTransactions: number
    errors: { account: string; error: string }[]
  }
  const [fixedCostsData, setFixedCostsData] = useState<FixedCostResponse | null>(null)
  const [fixedCostsLoading, setFixedCostsLoading] = useState(false)
  const [fixedCostsError, setFixedCostsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadDashboard = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ year: String(selectedYear), month: String(selectedMonth) })
        const res = await fetch(`/api/management/reports/dashboard?${params}`)
        if (!cancelled && res.ok) setData(await res.json())
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadDashboard()

    return () => {
      cancelled = true
    }
  }, [selectedYear, selectedMonth])

  const loadFixedCosts = async () => {
    setFixedCostsLoading(true)
    setFixedCostsError(null)
    try {
      const params = new URLSearchParams({ year: String(selectedYear), month: String(selectedMonth) })
      const res = await fetch(`/api/management/reports/fixed-costs?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '고정비 조회 실패')
      }
      setFixedCostsData(await res.json())
    } catch (e) {
      setFixedCostsError(e instanceof Error ? e.message : '오류')
    } finally {
      setFixedCostsLoading(false)
    }
  }

  // 월 변경 시 고정비 자동 로드
  useEffect(() => {
    let cancelled = false
    setFixedCostsData(null)
    setFixedCostsError(null)
    setFixedCostsLoading(true)
    const params = new URLSearchParams({ year: String(selectedYear), month: String(selectedMonth) })
    fetch(`/api/management/reports/fixed-costs?${params}`)
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || '고정비 조회 실패')
        }
        const json = await res.json()
        if (!cancelled) setFixedCostsData(json)
      })
      .catch((e) => {
        if (!cancelled) setFixedCostsError(e instanceof Error ? e.message : '오류')
      })
      .finally(() => {
        if (!cancelled) setFixedCostsLoading(false)
      })
    return () => { cancelled = true }
  }, [selectedYear, selectedMonth])

  // 고정비를 지출에 합산한 조정값
  const fixedTotal = fixedCostsData?.total ?? 0
  const adjExpense = (data?.total_expense ?? 0) + fixedTotal
  const adjProfit = (data?.total_revenue ?? 0) - adjExpense
  const adjProfitRate = data && data.total_revenue > 0
    ? Math.round((adjProfit / data.total_revenue) * 1000) / 10
    : 0
  const adjExpDiff = data && data.prev_month.expense > 0
    ? Math.round(((adjExpense - data.prev_month.expense) / data.prev_month.expense) * 1000) / 10
    : null

  const revDiff = data && data.prev_month.revenue > 0
    ? Math.round(((data.total_revenue - data.prev_month.revenue) / data.prev_month.revenue) * 1000) / 10
    : null
  const expDiff = data && data.prev_month.expense > 0
    ? Math.round(((data.total_expense - data.prev_month.expense) / data.prev_month.expense) * 1000) / 10
    : null
  const profitDiff = data && data.prev_month.profit !== 0
    ? Math.round(((data.profit - data.prev_month.profit) / Math.abs(data.prev_month.profit)) * 1000) / 10
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
      ['지출', '고정비 (신한 자동)', fixedTotal],
      ['', '', ''],
      ['합계', '총 매출', data.total_revenue],
      ['합계', '총 지출', adjExpense],
      ['합계', '순이익', adjProfit],
      ['합계', '이익률', `${adjProfitRate}%`],
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '손익리포트')
    XLSX.writeFile(wb, `손익리포트_${data.month}.xlsx`)
  }

  const selectedLabel = getMonthLabel(selectedYear, selectedMonth)
  const headlineText = !data
    ? ''
    : adjProfit >= 0
      ? `${selectedLabel} 기준 순이익은 ${formatAmount(adjProfit)}입니다.`
      : `${selectedLabel} 기준 손실은 ${formatAmount(Math.abs(adjProfit))}입니다.`
  const summaryText = !data
    ? ''
    : `매출 ${formatAmount(data.total_revenue)} · 지출 ${formatAmount(adjExpense)} · 이익률 ${adjProfitRate}%`

  return (
    <div className={styles.page_wrap}>
      <section className={styles.heroSection}>
        <div className={styles.heroCard}>
          <div className={styles.page_header}>
            <div>
              <span className={styles.heroEyebrow}>한평생그룹 재무현황</span>
              <h2 className={styles.page_title}>한평생그룹 손익리포트</h2>
            </div>
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

          <div className={styles.heroContent}>
            <div className={styles.heroTextBlock}>
              <div className={styles.periodBadge}>분석 기준 {selectedLabel}</div>
              <p className={styles.heroHeadline}>{headlineText || '손익 데이터를 불러오고 있어요.'}</p>
              <p className={styles.heroDescription}>
                {summaryText || '매출, 지출, 순이익 흐름을 한 화면에서 확인할 수 있어요.'}
              </p>
            </div>
          </div>

          {data && (
            <div className={styles.heroMetaRow}>
              <div className={styles.heroMetaItem}>
                <span>전월 매출</span>
                <strong>{formatAmount(data.prev_month.revenue)}</strong>
              </div>
              <div className={styles.heroMetaItem}>
                <span>전월 지출</span>
                <strong>{formatAmount(data.prev_month.expense)}</strong>
              </div>
              <div className={styles.heroMetaItem}>
                <span>전월 순이익</span>
                <strong className={data.prev_month.profit >= 0 ? styles.profit_positive : styles.profit_negative}>
                  {formatAmount(data.prev_month.profit)}
                </strong>
              </div>
              <div className={styles.heroMetaItem}>
                <span>순이익 증감</span>
                <strong>{profitDiff === null ? '-' : `${profitDiff > 0 ? '+' : ''}${profitDiff}%`}</strong>
              </div>
            </div>
          )}
        </div>
      </section>

      {loading ? (
        <div className={styles.loading_state}>데이터를 불러오는 중...</div>
      ) : !data ? null : (
        <>
          {/* ① KPI Cards */}
          <div className={styles.kpiGrid}>
            <KpiCard label="순이익" value={adjProfit} highlight={adjProfit >= 0} color={adjProfit >= 0 ? 'default' : 'red'} />
            <KpiCard label="총 매출" value={data.total_revenue} color="blue" diff={revDiff} />
            <KpiCard label={fixedTotal > 0 ? '총 지출 (고정비 포함)' : '총 지출'} value={adjExpense} color="red" diff={adjExpDiff ?? expDiff} />
            <KpiCard label="이익률" value={adjProfitRate} format="percent" color={adjProfitRate >= 0 ? 'green' : 'red'} />
          </div>

          {/* ② 간이 손익계산서 */}
          <FoldableSection eyebrow="손익 요약" title="간이 손익계산서" caption={selectedLabel}>
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
                  <td>{formatAmount(adjExpense)}</td>
                </tr>
                {data.manual_expenses > 0 && <tr><td className={styles.pnl_indent}>└ 수동 등록 지출</td><td>{formatAmount(data.manual_expenses)}</td></tr>}
                {data.approved_expenses > 0 && <tr><td className={styles.pnl_indent}>└ 전자결재 승인 지출</td><td>{formatAmount(data.approved_expenses)}</td></tr>}
                {data.uploaded_revenue.card > 0 && <tr><td className={styles.pnl_indent}>└ 카드 지출</td><td>{formatAmount(data.uploaded_revenue.card)}</td></tr>}
                {fixedTotal > 0 && <tr><td className={styles.pnl_indent}>└ 고정비 (신한 자동분류)</td><td>{formatAmount(fixedTotal)}</td></tr>}

                <tr className={adjProfit >= 0 ? styles.pnl_row_total_blue : styles.pnl_row_total_red}>
                  <td>[ 매출 총이익 ]</td>
                  <td>{formatAmount(adjProfit)}</td>
                </tr>
                <tr className={adjProfit >= 0 ? styles.pnl_row_total_blue : styles.pnl_row_total_red}>
                  <td>[ 이익률 ]</td>
                  <td>{adjProfitRate}%</td>
                </tr>
              </tbody>
            </table>
          </FoldableSection>

          {/* ②-2 고정비 매칭 (신한 거래내역 기반) */}
          <FoldableSection
            eyebrow="📌 고정비 추적"
            title="신한 거래내역 자동 분류"
            caption={fixedCostsData ? `${fixedCostsData.count}건 · ${formatAmount(fixedCostsData.total)}` : (fixedCostsLoading ? '불러오는 중...' : null)}
            headerExtra={
              <button
                onClick={loadFixedCosts}
                disabled={fixedCostsLoading}
                className={styles.btn_secondary}
              >
                {fixedCostsLoading ? '갱신 중...' : '↻ 새로고침'}
              </button>
            }
          >
            {fixedCostsError && (
              <div style={{ margin: '14px 22px', padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 8, fontSize: 13 }}>
                ⚠️ {fixedCostsError}
              </div>
            )}

            {fixedCostsLoading && !fixedCostsData && (
              <div style={{ padding: '32px 22px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                신한 거래내역 불러오는 중...
              </div>
            )}

            {fixedCostsData && (
              <>
                {/* 한 줄 요약 */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 12,
                  padding: '16px 22px',
                  borderBottom: '1px solid rgba(229, 232, 235, 0.9)',
                  fontSize: 13,
                }}>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: '#4e5968' }}>
                    <span>매칭 건수 <strong style={{ color: '#191f28' }}>{fixedCostsData.count}건</strong></span>
                    <span style={{ color: '#e5e8eb' }}>|</span>
                    <span>분류 항목 <strong style={{ color: '#191f28' }}>{fixedCostsData.categories.length}개</strong></span>
                    <span style={{ color: '#e5e8eb' }}>|</span>
                    <span style={{ color: '#8b95a1', fontSize: 12 }}>전체 거래 {fixedCostsData.totalTransactions}건 중</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', letterSpacing: '-0.02em' }}>
                    {formatAmount(fixedCostsData.total)}
                  </div>
                </div>

                {fixedCostsData.errors.length > 0 && (
                  <div style={{ margin: '14px 22px 0', padding: 10, background: '#fef3c7', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                    ⚠️ {fixedCostsData.errors.length}개 계좌 조회 실패: {fixedCostsData.errors.map(e => e.account).join(', ')}
                  </div>
                )}

                {/* 계좌별 요약 */}
                {fixedCostsData.accountSummary.length > 0 && (
                  <div style={{ padding: '20px 22px 16px' }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: '#4e5968', marginBottom: 10, marginTop: 0 }}>계좌별</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                      {fixedCostsData.accountSummary.map((a) => (
                        <div key={a.account} style={{
                          padding: '12px 14px',
                          background: a.total > 0 ? '#ffffff' : '#f9fafb',
                          border: '1px solid rgba(229, 232, 235, 0.9)',
                          borderRadius: 8, fontSize: 12,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                            <span style={{ color: '#6b7684', fontFamily: 'monospace', fontSize: 11 }}>{a.account}</span>
                            <span style={{ color: '#8b95a1', fontSize: 11 }}>{a.count}건</span>
                          </div>
                          <div style={{ marginTop: 6, textAlign: 'right' }}>
                            <strong style={{ color: a.total > 0 ? '#dc2626' : '#cbd5e1', fontSize: 14, fontWeight: 700 }}>
                              {a.total > 0 ? formatAmount(a.total) : '없음'}
                            </strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {fixedCostsData.categories.length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(229, 232, 235, 0.9)' }}>
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: '#4e5968', margin: 0, padding: '16px 22px 8px' }}>고정비 항목별</h4>
                    <table className={styles.pnl_table}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '10px 22px', fontSize: 12, fontWeight: 600, color: '#8b95a1', background: '#fafbfc', borderBottom: '1px solid rgba(229, 232, 235, 0.9)' }}>분류</th>
                          <th style={{ textAlign: 'center', padding: '10px 22px', fontSize: 12, fontWeight: 600, color: '#8b95a1', background: '#fafbfc', borderBottom: '1px solid rgba(229, 232, 235, 0.9)' }}>건수</th>
                          <th style={{ textAlign: 'right', padding: '10px 22px', fontSize: 12, fontWeight: 600, color: '#8b95a1', background: '#fafbfc', borderBottom: '1px solid rgba(229, 232, 235, 0.9)' }}>총액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fixedCostsData.categories.map((c) => (
                          <tr key={c.description}>
                            <td>{c.description}</td>
                            <td style={{ textAlign: 'center', color: '#6b7684' }}>{c.count}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatAmount(c.total)}</td>
                          </tr>
                        ))}
                        <tr className={styles.pnl_row_total}>
                          <td>[ 합계 ]</td>
                          <td style={{ textAlign: 'center' }}>{fixedCostsData.count}</td>
                          <td style={{ textAlign: 'right' }}>{formatAmount(fixedCostsData.total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </FoldableSection>

          {/* ③ 추이 + 매출 구성 (2열) */}
          <FoldableSection eyebrow="추세" title="매출 추이 · 구성">
          <div className={styles.chartGrid2} style={{ padding: 22 }}>
            {trendData.length > 0 && (
              <div className={styles.miniSection}>
                <div className={styles.miniHeader}>
                  <span className={styles.section_eyebrow}>추이</span>
                  <p className={styles.miniTitle}>매출/지출 추이</p>
                </div>
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
                <div className={styles.miniHeader}>
                  <span className={styles.section_eyebrow}>비중</span>
                  <p className={styles.miniTitle}>매출 구성</p>
                </div>
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
          </FoldableSection>

          {/* ⑤ 지출 구성 + 사업부별 (2열) */}
          <FoldableSection eyebrow="지출 분석" title="지출 구성 · 사업부별">
          <div className={styles.chartGrid2} style={{ padding: 22 }}>
            {expenseDonut.length > 0 && (
              <div className={styles.miniSection}>
                <div className={styles.miniHeader}>
                  <span className={styles.section_eyebrow}>비중</span>
                  <p className={styles.miniTitle}>지출 구성</p>
                </div>
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
                <div className={styles.miniHeader}>
                  <span className={styles.section_eyebrow}>부서 비교</span>
                  <p className={styles.miniTitle}>사업부별 매출/지출</p>
                </div>
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
          </FoldableSection>

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
