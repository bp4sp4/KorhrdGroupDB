'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ComposedChart, PieChart, Pie, Cell, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatAmount } from '@/lib/management/utils'
import styles from './page.module.css'

interface StatMonth {
  key: string
  label: string
  nms: number
  cert: number
  abroad: number
  total: number
}

interface HeroSummary {
  amount: number
  label: string
  sublabel: string
}

const DC = { nms: '#3182F6', cert: '#7C3AED', abroad: '#12B76A', total: '#F59E0B' }
const DL = { nms: '학점은행제', cert: '민간자격증', abroad: '유학' }

function fmt(n: number) {
  return formatAmount(n)
}

function growthColor(r: number) { return r > 0 ? '#12B76A' : r < 0 ? '#F04438' : '#6B7280' }
function growthIcon(r: number)  { return r > 0 ? '▲' : r < 0 ? '▼' : '─' }

function GrowthBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const up = pct >= 0
  return <span className={up ? styles.ac_badge_up : styles.ac_badge_down}>{up ? '▲' : '▼'} {Math.abs(pct)}%</span>
}

function SalesBarTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string; dataKey: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const bars = payload.filter(p => p.dataKey !== 'total' && p.value > 0)
  return (
    <div className={styles.ac_tip}>
      <p className={styles.ac_tip_label}>{label}</p>
      {bars.map(p => (
        <p key={p.dataKey} className={styles.ac_tip_row} style={{ color: p.color }}>
          {DL[p.dataKey as keyof typeof DL] ?? p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

const DIV_KEYS = ['nms', 'cert', 'abroad'] as const
type DivKey = typeof DIV_KEYS[number]

export default function StatsTab({ year, month, onSummary }: { year: number; month: number; onSummary: (s: HeroSummary) => void }) {
  const [data, setData] = useState<StatMonth[]>([])
  const [loading, setLoading] = useState(false)
  const [months, setMonths] = useState(1)
  const [activeDivs, setActiveDivs] = useState<Set<DivKey>>(new Set(DIV_KEYS))

  const toggleDiv = (div: DivKey) => {
    setActiveDivs(prev => {
      const next = new Set(prev)
      if (next.has(div)) { next.delete(div) } else { next.add(div) }
      return next
    })
  }

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/management/sales-stats?months=${months}&year=${year}&month=${month}`)
      if (res.ok) {
        const j = await res.json()
        const months_: StatMonth[] = j.months ?? []
        setData(months_)
        const latest = months_[months_.length - 1]
        if (latest) {
          onSummary({
            amount: latest.total,
            label: '이번 달 통합 매출',
            sublabel: '학점은행제 + 민간자격증 + 유학 합산',
          })
        }
      }
    } finally { setLoading(false) }
  }, [months, year, month, onSummary])

  useEffect(() => { fetch_() }, [fetch_])

  if (loading) return <div className={styles.loading}><div className={styles.spinner} /><span>불러오는 중...</span></div>
  if (!data.length) return <div className={styles.empty}>데이터가 없습니다.</div>

  const latest  = data[data.length - 1]
  const prev    = data[data.length - 2]

  const totalAll  = data.reduce((s, m) => s + m.total,  0)
  const nmsAll    = data.reduce((s, m) => s + m.nms,    0)
  const certAll   = data.reduce((s, m) => s + m.cert,   0)
  const abroadAll = data.reduce((s, m) => s + m.abroad, 0)

  const momRate    = (prev?.total  ?? 0) > 0 ? Math.round(((latest.total  - prev.total)  / prev.total)  * 100) : null
  const nmsRate    = (prev?.nms    ?? 0) > 0 ? Math.round(((latest.nms    - prev.nms)    / prev.nms)    * 100) : null
  const certRate   = (prev?.cert   ?? 0) > 0 ? Math.round(((latest.cert   - prev.cert)   / prev.cert)   * 100) : null
  const abroadRate = (prev?.abroad ?? 0) > 0 ? Math.round(((latest.abroad - prev.abroad) / prev.abroad) * 100) : null

  const shareData = [
    { key: 'nms'    as DivKey, name: '학점은행제', value: nmsAll,    color: DC.nms },
    { key: 'cert'   as DivKey, name: '민간자격증', value: certAll,   color: DC.cert },
    { key: 'abroad' as DivKey, name: '유학',       value: abroadAll, color: DC.abroad },
  ].filter(d => d.value > 0)

  const visibleShareData = shareData.filter(d => activeDivs.has(d.key))
  const visibleTotal = visibleShareData.reduce((s, d) => s + d.value, 0)

  const revPcts = [
    totalAll > 0 ? Math.round(nmsAll    / totalAll * 100) : 0,
    totalAll > 0 ? Math.round(certAll   / totalAll * 100) : 0,
    totalAll > 0 ? Math.round(abroadAll / totalAll * 100) : 0,
  ]

  return (
    <div className={styles.ac_container}>

      {/* 기간 선택 */}
      <div className={styles.ac_period_row}>
        <div>
          <span className={styles.stats_title}>통합 매출 통계</span>
          <span className={styles.stats_title_sub}>3개 사업부 합산 기준</span>
        </div>
        <div className={styles.stats_period_tabs}>
          {[1, 3, 6].map(m => (
            <button key={m} className={`${styles.period_tab} ${months === m ? styles.period_tab_active : ''}`} onClick={() => setMonths(m)}>
              {m}개월
            </button>
          ))}
        </div>
      </div>

      {/* 4개 요약 카드 */}
      <div className={styles.ac_grid4}>

        {/* 총 매출 */}
        <div className={styles.ac_card}>
          <p className={styles.ac_card_label}>총 매출</p>
          <p className={styles.ac_card_value}>{fmt(totalAll)}</p>
          <div className={styles.ac_card_sub}>
            <span>최근 {months}개월 합산</span>
            <GrowthBadge pct={momRate} />
          </div>
          {prev && <p className={styles.ac_card_hint}>전달 {fmt(prev.total)}</p>}
          <div className={styles.ac_rev_bar}>
            {revPcts[0] > 0 && <div className={styles.ac_rev_bar_seg} style={{ width: `${revPcts[0]}%`, background: DC.nms }} />}
            {revPcts[1] > 0 && <div className={styles.ac_rev_bar_seg} style={{ width: `${revPcts[1]}%`, background: DC.cert }} />}
            {revPcts[2] > 0 && <div className={styles.ac_rev_bar_seg} style={{ width: `${revPcts[2]}%`, background: DC.abroad }} />}
          </div>
          <div className={styles.ac_rev_legend}>
            {revPcts[0] > 0 && <span className={styles.ac_rev_legend_item}><span className={styles.ac_rev_dot} style={{ background: DC.nms }} />학점은행제 {revPcts[0]}%</span>}
            {revPcts[1] > 0 && <span className={styles.ac_rev_legend_item}><span className={styles.ac_rev_dot} style={{ background: DC.cert }} />민간자격증 {revPcts[1]}%</span>}
            {revPcts[2] > 0 && <span className={styles.ac_rev_legend_item}><span className={styles.ac_rev_dot} style={{ background: DC.abroad }} />유학 {revPcts[2]}%</span>}
          </div>
        </div>

        {/* 학점은행제 */}
        <div className={styles.ac_card}>
          <p className={styles.ac_card_label}>학점은행제</p>
          <p className={styles.ac_card_value} style={{ color: DC.nms }}>{fmt(nmsAll)}</p>
          <div className={styles.ac_card_sub}>
            <span>전체의 <b>{revPcts[0]}%</b></span>
            <GrowthBadge pct={nmsRate} />
          </div>
          {prev && <p className={styles.ac_card_hint}>전달 {fmt(prev.nms)}</p>}
        </div>

        {/* 민간자격증 */}
        <div className={styles.ac_card}>
          <p className={styles.ac_card_label}>민간자격증</p>
          <p className={styles.ac_card_value} style={{ color: DC.cert }}>{fmt(certAll)}</p>
          <div className={styles.ac_card_sub}>
            <span>전체의 <b>{revPcts[1]}%</b></span>
            <GrowthBadge pct={certRate} />
          </div>
          {prev && <p className={styles.ac_card_hint}>전달 {fmt(prev.cert)}</p>}
        </div>

        {/* 유학 */}
        <div className={styles.ac_card}>
          <p className={styles.ac_card_label}>유학</p>
          <p className={styles.ac_card_value} style={{ color: DC.abroad }}>{fmt(abroadAll)}</p>
          <div className={styles.ac_card_sub}>
            <span>전체의 <b>{revPcts[2]}%</b></span>
            <GrowthBadge pct={abroadRate} />
          </div>
          {prev && <p className={styles.ac_card_hint}>전달 {fmt(prev.abroad)}</p>}
        </div>

      </div>

      {/* 2열 차트: 월별 매출 + 사업부 비중 */}
      <div className={styles.ac_row2}>

        {/* 월별 매출 ComposedChart */}
        <div className={styles.ac_panel}>
          <div className={styles.ac_panel_header}>
            <p className={styles.ac_panel_title}>월별 매출</p>
            <div className={styles.ac_chart_legend}>
              {([
                { key: 'nms'    as DivKey, label: '학점은행제', color: DC.nms },
                { key: 'cert'   as DivKey, label: '민간자격증', color: DC.cert },
                { key: 'abroad' as DivKey, label: '유학',       color: DC.abroad },
              ]).map(d => (
                <button
                  key={d.key}
                  className={`${styles.ac_legend_btn} ${!activeDivs.has(d.key) ? styles.ac_legend_btn_off : ''}`}
                  onClick={() => toggleDiv(d.key)}
                >
                  <span className={styles.ac_legend_dot} style={{ background: activeDivs.has(d.key) ? d.color : 'var(--toss-border)' }} />
                  <span className={styles.ac_legend_text}>{d.label}</span>
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--toss-border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--toss-text-secondary)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: 'var(--toss-text-secondary)' }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<SalesBarTooltip />} />
              <Bar dataKey="nms"    name="학점은행제" fill={DC.nms}    radius={[3,3,0,0]} barSize={14} hide={!activeDivs.has('nms')} />
              <Bar dataKey="cert"   name="민간자격증" fill={DC.cert}   radius={[3,3,0,0]} barSize={14} hide={!activeDivs.has('cert')} />
              <Bar dataKey="abroad" name="유학"       fill={DC.abroad} radius={[3,3,0,0]} barSize={14} hide={!activeDivs.has('abroad')} />
              <Line dataKey="total" name="합계" type="monotone" stroke={DC.total} strokeWidth={2} dot={{ r: 3, fill: DC.total }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* 사업부 비중 PieChart */}
        <div className={styles.ac_panel}>
          <p className={styles.ac_panel_title}>사업부 비중</p>
          <div className={styles.ac_pie_wrap}>
            <div className={styles.ac_pie_relative}>
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie data={visibleShareData} cx="50%" cy="50%" innerRadius={58} outerRadius={88} dataKey="value" paddingAngle={3}>
                    {visibleShareData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [fmt(v as number), '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.ac_pie_center}>
                <p className={styles.ac_pie_center_val}>{fmt(visibleTotal)}</p>
                <p className={styles.ac_pie_center_label}>합계</p>
              </div>
            </div>
            <div className={styles.ac_pie_legend}>
              {shareData.map(d => (
                <button
                  key={d.name}
                  className={`${styles.ac_pie_legend_item} ${styles.ac_pie_legend_btn} ${!activeDivs.has(d.key) ? styles.ac_pie_legend_btn_off : ''}`}
                  onClick={() => toggleDiv(d.key)}
                >
                  <span className={styles.ac_pie_legend_dot} style={{ background: activeDivs.has(d.key) ? d.color : 'var(--toss-border)' }} />
                  <div>
                    <div className={styles.ac_pie_legend_name}>{d.name}</div>
                    <div className={styles.ac_pie_legend_detail}>
                      <span className={styles.ac_pie_legend_val}>{fmt(d.value)}</span>
                      <span className={styles.ac_pie_legend_pct}>{totalAll > 0 ? Math.round(d.value / totalAll * 100) : 0}%</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* 월별 상세 테이블 */}
      <div className={styles.chart_card}>
        <div className={styles.chart_card_header}>
          <span className={styles.chart_card_title}>월별 상세</span>
          <span className={styles.chart_card_sub}>최근 {months}개월</span>
        </div>
        <table className={styles.manager_table}>
          <thead>
            <tr>
              <th>월</th>
              <th className={styles.th_right} style={{ color: DC.nms }}>학점은행제</th>
              <th className={styles.th_right} style={{ color: DC.cert }}>민간자격증</th>
              <th className={styles.th_right} style={{ color: DC.abroad }}>유학</th>
              <th className={styles.th_right}>합계</th>
              <th className={styles.th_center}>전월比</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((m, i, arr) => {
              const p = arr[i + 1]
              const r = p && p.total > 0 ? Math.round(((m.total - p.total) / p.total) * 100) : null
              return (
                <tr key={m.key}>
                  <td className={styles.manager_name}>{m.key.replace('-', '년 ')}월</td>
                  <td className={styles.td_right}>{fmt(m.nms)}</td>
                  <td className={styles.td_right}>{fmt(m.cert)}</td>
                  <td className={styles.td_right}>{fmt(m.abroad)}</td>
                  <td className={`${styles.td_right} ${styles.manager_name}`}>{fmt(m.total)}</td>
                  <td className={styles.td_center}>
                    {r !== null && (
                      <span className={styles.rate_chip} style={{ background: r >= 0 ? 'var(--color-green-bg)' : 'var(--color-red-bg)', color: growthColor(r) }}>
                        {growthIcon(r)} {Math.abs(r)}%
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

    </div>
  )
}
