'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, ChevronLeft, TrendingUp, Users, CheckCircle, CalendarDays, Award, Plane, BarChart2 } from 'lucide-react'
import { getThisMonth, formatAmount } from '@/lib/management/utils'
import {
  ComposedChart, PieChart, Pie, Cell, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import styles from './page.module.css'

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface ManagerStat {
  manager: string
  paymentAmount: number
  totalCount: number
  completedCount: number
}

interface TeamStat {
  team: string
  paymentAmount: number
  totalCount: number
  completedCount: number
  managers: ManagerStat[]
}

interface NmsSalesData {
  total: { paymentAmount: number; totalCount: number; completedCount: number }
  byTeam: TeamStat[]
}

interface CertDayStat {
  day: number
  count: number
  amount: number
}

interface CertSalesData {
  total: { paymentAmount: number; count: number; avgAmount: number }
  byDay: CertDayStat[]
}

interface AbroadPaymentRow {
  id: string
  name: string | null
  email: string | null
  program: string
  amount: number
  created_at: string
}

interface AbroadSalesData {
  total: { paymentAmount: number; count: number; avgAmount: number }
  byDay: CertDayStat[]
  rows: AbroadPaymentRow[]
}

const NMS_TEAMS = ['본사', '프리랜서']
const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
type TabKey = 'nms' | 'cert' | 'abroad' | 'stats'
type RevenueDivision = 'nms' | 'cert' | 'abroad'
const VALID_TABS: TabKey[] = ['stats', 'nms', 'cert', 'abroad']

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

// ─── 월 피커 ─────────────────────────────────────────────────────────────────

function MonthPicker({ year, month, onChange }: {
  year: number; month: number; onChange: (y: number, m: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(year)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className={styles.month_picker_wrap} ref={wrapRef}>
      <button className={styles.month_picker_btn} onClick={() => { setPickerYear(year); setOpen(v => !v) }}>
        <CalendarDays size={14} />
        {year}년 {month}월
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className={styles.month_picker_dropdown}>
          <div className={styles.month_picker_year_row}>
            <button className={styles.month_picker_year_btn} onClick={() => setPickerYear(y => y - 1)}>
              <ChevronLeft size={14} />
            </button>
            <span className={styles.month_picker_year_label}>{pickerYear}년</span>
            <button className={styles.month_picker_year_btn} onClick={() => setPickerYear(y => y + 1)}>
              <ChevronRight size={14} />
            </button>
          </div>
          <div className={styles.month_picker_grid}>
            {MONTH_LABELS.map((label, i) => {
              const m = i + 1
              return (
                <button
                  key={m}
                  className={`${styles.month_cell} ${pickerYear === year && m === month ? styles.month_cell_active : ''}`}
                  onClick={() => { onChange(pickerYear, m); setOpen(false) }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── NMS 탭 콘텐츠 ───────────────────────────────────────────────────────────

interface AllcarePaymentRow {
  id: string
  type: string
  order_id: string
  good_name: string | null
  amount: number
  payment_method: string | null
  approved_at: string | null
  user_name: string | null
  user_email: string | null
}

interface AllcareSalesData {
  totalRevenue: number
  count: number
  byType: Record<string, { count: number; revenue: number }>
  payments: AllcarePaymentRow[]
}

const ALLCARE_PAGE_SIZE = 20

const toKSTDate = (s: string | null) => {
  if (!s) return '-'
  return new Date(s).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
}

function NmsTab({ year, month }: { year: number; month: number }) {
  const [teamFilter, setTeamFilter] = useState('')
  const [data, setData] = useState<NmsSalesData | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())
  const [allcareData, setAllcareData] = useState<AllcareSalesData | null>(null)
  const [allcarePage, setAllcarePage] = useState(1)
  const [allcareTypeFilter, setAllcareTypeFilter] = useState<Set<string>>(new Set())
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)
  const typeDropdownRef = useRef<HTMLDivElement>(null)
  const typeFilterBtnRef = useRef<HTMLButtonElement>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month) })
      if (teamFilter && teamFilter !== 'allcare') params.set('team', teamFilter)
      const [nmsRes, allcareRes] = await Promise.all([
        teamFilter === 'allcare' ? Promise.resolve(null) : fetch(`/api/management/nms-sales?${params}`),
        fetch(`/api/management/allcare-sales?year=${year}&month=${month}`),
      ])
      setAllcarePage(1)
      setAllcareTypeFilter(new Set())
      if (nmsRes && nmsRes.ok) {
        const json = await nmsRes.json()
        setData(json)
        setExpandedTeams(new Set())
      } else if (teamFilter === 'allcare') {
        setData(null)
      }
      if (allcareRes.ok) {
        setAllcareData(await allcareRes.json())
      }
    } finally {
      setLoading(false)
    }
  }, [year, month, teamFilter])

  useEffect(() => { fetch_() }, [fetch_])

  const toggleTeam = (team: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev)
      if (next.has(team)) { next.delete(team) } else { next.add(team) }
      return next
    })
  }

  useEffect(() => {
    if (!typeDropdownOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (typeDropdownRef.current?.contains(target)) return
      if (typeFilterBtnRef.current?.contains(target)) return
      setTypeDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [typeDropdownOpen])


  return (
    <div className={styles.tab_content}>
      <div className={styles.filter_panel}>
        <div className={styles.team_tabs}>
          <button className={`${styles.team_tab} ${teamFilter === '' ? styles.team_tab_active : ''}`} onClick={() => setTeamFilter('')}>전체 팀</button>
          {NMS_TEAMS.map(t => (
            <button key={t} className={`${styles.team_tab} ${teamFilter === t ? styles.team_tab_active : ''}`} onClick={() => setTeamFilter(t)}>{t}</button>
          ))}
          <button className={`${styles.team_tab} ${teamFilter === 'allcare' ? styles.team_tab_active : ''}`} onClick={() => setTeamFilter('allcare')}>올케어</button>
        </div>
      </div>

      {/* 요약 카드 */}
      {data && (
        <div className={styles.summary_grid}>
          <div className={`${styles.summary_card} ${styles.card_indigo}`}>
            <div className={styles.card_icon_wrap}><TrendingUp size={18} /></div>
            <span className={styles.summary_label}>총 매출</span>
            <span className={styles.summary_value}>{formatAmount((data.total.paymentAmount) + (allcareData?.totalRevenue ?? 0))}</span>
            <span className={styles.summary_sub}>학점은행제 + 올케어 합산</span>
          </div>
          <div className={`${styles.summary_card} ${styles.card_blue}`}>
            <div className={styles.card_icon_wrap}><TrendingUp size={18} /></div>
            <span className={styles.summary_label}>학점은행제 매출</span>
            <span className={styles.summary_value}>{formatAmount(data.total.paymentAmount)}</span>
            <span className={styles.summary_sub}>학점은행제 등록 합산</span>
          </div>
          <div className={`${styles.summary_card} ${styles.card_green}`}>
            <div className={styles.card_icon_wrap}><TrendingUp size={18} /></div>
            <span className={styles.summary_label}>올케어 매출</span>
            <span className={styles.summary_value}>{formatAmount(allcareData?.totalRevenue ?? 0)}</span>
            <span className={styles.summary_sub}>{allcareData?.count ?? 0}건 결제완료</span>
          </div>
        </div>
      )}

      {/* 팀별 목록 */}
      {loading ? (
        <div className={styles.loading}><div className={styles.spinner} /><span>불러오는 중...</span></div>
      ) : teamFilter === 'allcare' ? (
        <div className={styles.allcare_wrap}>
          {(() => {
            const typeKeys = Object.keys(allcareData?.byType ?? {})
            const isAll = allcareTypeFilter.size === 0
            const toggleType = (type: string) => {
              setAllcareTypeFilter(prev => {
                const next = new Set(prev)
                if (next.has(type)) next.delete(type)
                else next.add(type)
                return next
              })
              setAllcarePage(1)
            }
            const toggleAll = () => {
              if (isAll) return
              setAllcareTypeFilter(new Set())
              setAllcarePage(1)
            }
            const allPayments = (allcareData?.payments ?? []).filter(p => isAll || allcareTypeFilter.has(p.type))
            const totalPages = Math.ceil(allPayments.length / ALLCARE_PAGE_SIZE)
            const paginated = allPayments.slice((allcarePage - 1) * ALLCARE_PAGE_SIZE, allcarePage * ALLCARE_PAGE_SIZE)
            return (
              <>
                <div className={styles.allcare_table_card}>
                  <table className={styles.allcare_table}>
                    <thead>
                      <tr>
                        <th className={styles.allcare_thFilterable}>
                          <div className={styles.allcare_thInner}>
                            유형
                            <button
                              ref={typeFilterBtnRef}
                              className={`${styles.allcare_thFilterBtn}${!isAll ? ` ${styles.allcare_thFilterBtnActive}` : ''}`}
                              onClick={e => { e.stopPropagation(); setTypeDropdownOpen(v => !v) }}
                            >
                              <ChevronDown size={10} />
                            </button>
                          </div>
                          {typeDropdownOpen && (() => {
                            const rect = typeFilterBtnRef.current?.getBoundingClientRect()
                            return (
                              <div
                                ref={typeDropdownRef}
                                className={styles.allcare_filterDropdown}
                                style={rect ? { top: rect.bottom + 4, left: rect.left } : undefined}
                                onMouseDown={e => e.stopPropagation()}
                              >
                                <div className={styles.allcare_checkItem} onClick={toggleAll}>
                                  <span className={`${styles.allcare_checkbox}${isAll ? ` ${styles.allcare_checkboxChecked}` : ''}`}>
                                    {isAll && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                  </span>
                                  전체
                                </div>
                                {typeKeys.map(type => {
                                  const checked = allcareTypeFilter.has(type)
                                  return (
                                    <div key={type} className={styles.allcare_checkItem} onClick={() => toggleType(type)}>
                                      <span className={`${styles.allcare_checkbox}${checked ? ` ${styles.allcare_checkboxChecked}` : ''}`}>
                                        {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                      </span>
                                      {type}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })()}
                        </th>
                        <th className={styles.allcare_th}>이름</th>
                        <th className={styles.allcare_th}>이메일</th>
                        <th className={styles.allcare_th}>상품명</th>
                        <th className={`${styles.allcare_th} ${styles.th_right}`}>금액</th>
                        <th className={`${styles.allcare_th} ${styles.th_center}`}>결제수단</th>
                        <th className={`${styles.allcare_th} ${styles.th_center}`}>결제일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.length === 0 ? (
                        <tr><td colSpan={7} className={styles.allcare_empty_td}>데이터 없음</td></tr>
                      ) : paginated.map(p => (
                        <tr key={p.id} className={styles.allcare_tr}>
                          <td className={styles.allcare_td}><span className={`${styles.allcare_type_chip} ${styles[`chip_${p.type}`]}`}>{p.type}</span></td>
                          <td className={`${styles.allcare_td} ${styles.manager_name}`}>{p.user_name ?? '-'}</td>
                          <td className={styles.allcare_td}>{p.user_email ?? '-'}</td>
                          <td className={styles.allcare_td}>{p.good_name ?? '-'}</td>
                          <td className={`${styles.allcare_td} ${styles.td_right}`}>{formatAmount(p.amount)}</td>
                          <td className={`${styles.allcare_td} ${styles.td_center}`}>{p.payment_method ?? '-'}</td>
                          <td className={`${styles.allcare_td} ${styles.td_center}`}>{toKSTDate(p.approved_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className={styles.allcare_pagination}>
                    <button className={styles.page_btn} disabled={allcarePage === 1} onClick={() => setAllcarePage(p => p - 1)}>
                      <ChevronLeft size={14} />
                    </button>
                    <span className={styles.page_info}>{allcarePage} / {totalPages}</span>
                    <button className={styles.page_btn} disabled={allcarePage === totalPages} onClick={() => setAllcarePage(p => p + 1)}>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      ) : !data || data.byTeam.length === 0 ? (
        <div className={styles.empty}>해당 기간에 데이터가 없습니다.</div>
      ) : (
        <div className={styles.teams_wrap}>
          <div className={styles.section_heading}>
            <strong className={styles.section_title}>팀별 상세 현황</strong>
          </div>
          {data.byTeam.map(team => {
            const isExpanded = expandedTeams.has(team.team)
            return (
              <div key={team.team} className={styles.team_block}>
                <button className={styles.team_header} onClick={() => toggleTeam(team.team)}>
                  <span className={styles.team_toggle_icon}>{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                  <div className={styles.team_heading}>
                    <span className={styles.team_badge}>{team.team}</span>
                  </div>
                  <div className={styles.team_meta}>
                    <span className={styles.team_amount}>{formatAmount(team.paymentAmount)}</span>
                  </div>
                </button>
                {isExpanded && (
                  <table className={styles.manager_table}>
                    <thead>
                      <tr>
                        <th>담당자</th>
                        <th className={styles.th_right}>매출</th>
                        <th className={styles.th_center}>등록완료</th>
                        <th className={styles.th_center}>전체</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.managers.map(mgr => (
                        <tr key={mgr.manager}>
                          <td className={styles.manager_name}>{mgr.manager}</td>
                          <td className={styles.td_right}>{formatAmount(mgr.paymentAmount)}</td>
                          <td className={styles.td_center}>{mgr.completedCount}건</td>
                          <td className={styles.td_center}>{mgr.totalCount}건</td>
                        </tr>
                      ))}
                      <tr className={styles.team_subtotal}>
                        <td>소계</td>
                        <td className={styles.td_right}>{formatAmount(team.paymentAmount)}</td>
                        <td className={styles.td_center}>{team.completedCount}건</td>
                        <td className={styles.td_center}>{team.totalCount}건</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── 민간자격증 탭 콘텐츠 ───────────────────────────────────────────────────

function CertTab({ year, month }: { year: number; month: number }) {
  const [data, setData] = useState<CertSalesData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month) })
      const res = await fetch(`/api/management/cert-sales?${params}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetch_() }, [fetch_])

  if (loading) return <div className={styles.loading}><div className={styles.spinner} /><span>불러오는 중...</span></div>
  if (!data) return null

  const maxAmount = Math.max(...(data.byDay.map(d => d.amount)), 1)

  return (
    <div className={styles.tab_content}>
      {/* 요약 카드 3개 */}
      <div className={styles.cert_summary_grid}>
        <div className={`${styles.summary_card} ${styles.card_blue}`}>
          <div className={styles.card_icon_wrap}><TrendingUp size={18} /></div>
          <span className={styles.summary_label}>총 매출</span>
          <span className={styles.summary_value}>{formatAmount(data.total.paymentAmount)}</span>
          <span className={styles.summary_sub}>학점연계신청 결제완료 기준</span>
        </div>
        <div className={`${styles.summary_card} ${styles.card_green}`}>
          <div className={styles.card_icon_wrap}><CheckCircle size={18} /></div>
          <span className={styles.summary_label}>결제완료 건수</span>
          <span className={styles.summary_value}>{data.total.count}<span className={styles.unit}>건</span></span>
          <span className={styles.summary_sub}>{month}월 전체</span>
        </div>
        <div className={`${styles.summary_card} ${styles.card_purple}`}>
          <div className={styles.card_icon_wrap}><Users size={18} /></div>
          <span className={styles.summary_label}>건당 평균 결제액</span>
          <span className={styles.summary_value}>{formatAmount(data.total.avgAmount)}</span>
          <span className={styles.summary_sub}>총 매출 ÷ 건수</span>
        </div>
      </div>

      {/* 일별 결제 현황 */}
      {data.byDay.length === 0 ? (
        <div className={styles.empty}>해당 기간에 결제완료 데이터가 없습니다.</div>
      ) : (
        <div className={styles.team_block}>
          <div className={styles.cert_chart_header}>
            <span className={styles.cert_chart_title}>일별 결제 현황</span>
            <span className={styles.cert_chart_sub}>{data.byDay.length}일 결제 발생</span>
          </div>
          <div className={styles.cert_chart_body}>
            {data.byDay.map(d => (
              <div key={d.day} className={styles.cert_day_row}>
                <span className={styles.cert_day_label}>{d.day}일</span>
                <div className={styles.cert_bar_wrap}>
                  <div
                    className={styles.cert_bar}
                    style={{ width: `${Math.round((d.amount / maxAmount) * 100)}%` }}
                  />
                </div>
                <span className={styles.cert_day_amount}>{formatAmount(d.amount)}</span>
                <span className={styles.cert_day_count}>{d.count}건</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 유학 사업부 탭 콘텐츠 ──────────────────────────────────────────────────

function AbroadTab({ year, month }: { year: number; month: number }) {
  const [data, setData] = useState<AbroadSalesData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month) })
      const res = await fetch(`/api/management/abroad-sales?${params}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetch_() }, [fetch_])

  if (loading) return <div className={styles.loading}><div className={styles.spinner} /><span>불러오는 중...</span></div>
  if (!data) return null

  const maxAmount = Math.max(...(data.byDay.map(d => d.amount)), 1)

  return (
    <div className={styles.tab_content}>
      <div className={styles.cert_summary_grid}>
        <div className={`${styles.summary_card} ${styles.card_blue}`}>
          <div className={styles.card_icon_wrap}><TrendingUp size={18} /></div>
          <span className={styles.summary_label}>총 매출</span>
          <span className={styles.summary_value}>{formatAmount(data.total.paymentAmount)}</span>
          <span className={styles.summary_sub}>결제완료 기준</span>
        </div>
        <div className={`${styles.summary_card} ${styles.card_green}`}>
          <div className={styles.card_icon_wrap}><CheckCircle size={18} /></div>
          <span className={styles.summary_label}>결제완료 건수</span>
          <span className={styles.summary_value}>{data.total.count}<span className={styles.unit}>건</span></span>
          <span className={styles.summary_sub}>{month}월 전체</span>
        </div>
        <div className={`${styles.summary_card} ${styles.card_purple}`}>
          <div className={styles.card_icon_wrap}><Users size={18} /></div>
          <span className={styles.summary_label}>건당 평균 결제액</span>
          <span className={styles.summary_value}>{formatAmount(data.total.avgAmount)}</span>
          <span className={styles.summary_sub}>총 매출 ÷ 건수</span>
        </div>
      </div>

      {data.byDay.length === 0 ? (
        <div className={styles.empty}>해당 기간에 결제완료 데이터가 없습니다.</div>
      ) : (
        <div className={styles.team_block}>
          <div className={styles.cert_chart_header}>
            <span className={styles.cert_chart_title}>일별 결제 현황</span>
            <span className={styles.cert_chart_sub}>{data.byDay.length}일 결제 발생</span>
          </div>
          <div className={styles.cert_chart_body}>
            {data.byDay.map(d => (
              <div key={d.day} className={styles.cert_day_row}>
                <span className={styles.cert_day_label}>{d.day}일</span>
                <div className={styles.cert_bar_wrap}>
                  <div className={styles.cert_bar} style={{ width: `${Math.round((d.amount / maxAmount) * 100)}%` }} />
                </div>
                <span className={styles.cert_day_amount}>{formatAmount(d.amount)}</span>
                <span className={styles.cert_day_count}>{d.count}건</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 결제 내역 검색 */}
      <div className={styles.team_block}>
        <div className={styles.cert_chart_header}>
          <span className={styles.cert_chart_title}>결제 내역</span>
          <span className={styles.cert_chart_sub}>{data.rows.length}건</span>
        </div>
        {data.rows.length === 0 ? (
          <div className={styles.empty}>결제 내역이 없습니다.</div>
        ) : (
          <table className={styles.manager_table}>
            <thead>
              <tr>
                <th>이름</th>
                <th>이메일</th>
                <th>프로그램</th>
                <th className={styles.th_right}>금액</th>
                <th className={styles.th_center}>결제일</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(r => (
                <tr key={r.id}>
                  <td className={styles.manager_name}>{r.name ?? '-'}</td>
                  <td>{r.email ?? '-'}</td>
                  <td>{r.program}</td>
                  <td className={styles.td_right}>{formatAmount(r.amount)}</td>
                  <td className={styles.td_center}>{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── 통계 탭 ─────────────────────────────────────────────────────────────────

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

function StatsTab() {
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
      const res = await fetch(`/api/management/sales-stats?months=${months}`)
      if (res.ok) { const j = await res.json(); setData(j.months ?? []) }
    } finally { setLoading(false) }
  }, [months])

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

function TopRevenueHero({
  year,
  month,
  activeTab,
  onChangeMonth,
}: {
  year: number
  month: number
  activeTab: TabKey
  onChangeMonth: (y: number, m: number) => void
}) {
  const [summary, setSummary] = useState<HeroSummary | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    const fetchSummary = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ year: String(year), month: String(month) })

        if (activeTab === 'nms') {
          const [nmsRes, allcareRes] = await Promise.all([
            fetch(`/api/management/nms-sales?${params}`),
            fetch(`/api/management/allcare-sales?year=${year}&month=${month}`),
          ])
          if (!nmsRes.ok || !allcareRes.ok) return
          const [nms, allcare] = await Promise.all([nmsRes.json(), allcareRes.json()])
          if (cancelled) return
          setSummary({
            amount: (nms.total?.paymentAmount ?? 0) + (allcare.totalRevenue ?? 0),
            label: '이번 달 총 매출',
            sublabel: '학점은행제 + 올케어 합산',
          })
          return
        }

        if (activeTab === 'cert') {
          const res = await fetch(`/api/management/cert-sales?${params}`)
          if (!res.ok) return
          const data = await res.json()
          if (cancelled) return
          setSummary({
            amount: data.total?.paymentAmount ?? 0,
            label: '이번 달 민간자격증 매출',
            sublabel: '결제완료 기준',
          })
          return
        }

        if (activeTab === 'abroad') {
          const res = await fetch(`/api/management/abroad-sales?${params}`)
          if (!res.ok) return
          const data = await res.json()
          if (cancelled) return
          setSummary({
            amount: data.total?.paymentAmount ?? 0,
            label: '이번 달 유학 매출',
            sublabel: '결제완료 기준',
          })
          return
        }

        const [nmsRes, certRes, abroadRes, allcareRes] = await Promise.all([
          fetch(`/api/management/nms-sales?${params}`),
          fetch(`/api/management/cert-sales?${params}`),
          fetch(`/api/management/abroad-sales?${params}`),
          fetch(`/api/management/allcare-sales?year=${year}&month=${month}`),
        ])
        if (!nmsRes.ok || !certRes.ok || !abroadRes.ok || !allcareRes.ok) return
        const [nms, cert, abroad, allcare] = await Promise.all([nmsRes.json(), certRes.json(), abroadRes.json(), allcareRes.json()])
        if (cancelled) return
        setSummary({
          amount: (nms.total?.paymentAmount ?? 0) + (allcare.totalRevenue ?? 0) + (cert.total?.paymentAmount ?? 0) + (abroad.total?.paymentAmount ?? 0),
          label: '이번 달 통합 매출',
          sublabel: '학점은행제 + 민간자격증 + 유학 합산',
        })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchSummary()
    return () => { cancelled = true }
  }, [year, month, activeTab])

  return (
    <>
      <div className={styles.hero_amount_block}>
        <span className={styles.hero_amount_label}>{summary?.label ?? '이번 달 매출'}</span>
        <strong className={styles.hero_amount_value}>
          {loading && !summary ? '불러오는 중...' : formatAmount(summary?.amount ?? 0)}
        </strong>
        <span className={styles.hero_amount_sub}>
          {summary?.sublabel ?? `${year}년 ${month}월 기준`}
        </span>
      </div>
      <div className={styles.page_header}>
        <div className={styles.page_heading}>
          <h1 className={styles.page_title}>팀별 매출 관리</h1>
          <p className={styles.page_subtitle}>{year}년 {month}월 기준 사업부별·담당자별 월 매출 현황</p>
        </div>
        <div className={styles.page_header_side}>
          <MonthPicker
            year={year}
            month={month}
            onChange={onChangeMonth}
          />
        </div>
      </div>
    </>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function NmsSalesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlTab = searchParams.get('tab') as TabKey | null
  const [availableTabs, setAvailableTabs] = useState<TabKey[]>(VALID_TABS)

  const thisMonth = getThisMonth()
  const [selectedYear, setSelectedYear] = useState(thisMonth.year)
  const [selectedMonth, setSelectedMonth] = useState(thisMonth.month)
  const activeTab: TabKey = urlTab && availableTabs.includes(urlTab) ? urlTab : (availableTabs[0] ?? 'stats')

  useEffect(() => {
    let cancelled = false

    const fetchTabs = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return

        const revenueScope = Array.isArray(data.permissions)
          ? data.permissions.find((permission: { section?: string; scope?: string }) => permission.section === 'revenues')?.scope
          : null

        if (revenueScope !== 'own') {
          setAvailableTabs(VALID_TABS)
          return
        }

        const ownDivisions = Array.isArray(data.revenueOwnDivisions)
          ? data.revenueOwnDivisions.filter((division: string): division is RevenueDivision => (
              division === 'nms' || division === 'cert' || division === 'abroad'
            ))
          : []

        const nextTabs: TabKey[] = ownDivisions.length > 1 ? ['stats', ...ownDivisions] : ownDivisions
        setAvailableTabs(nextTabs.length > 0 ? Array.from(new Set(nextTabs)) : ['stats'])
      } catch {
        // keep defaults
      }
    }

    void fetchTabs()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      router.replace(`/revenues/nms-sales?tab=${availableTabs[0] ?? 'stats'}`, { scroll: false })
    }
  }, [activeTab, availableTabs, router])

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'stats',  label: '통합 통계',         icon: <BarChart2 size={15} /> },
    { key: 'nms',    label: '학점은행제 사업부', icon: <TrendingUp size={15} /> },
    { key: 'cert',   label: '민간자격증 사업부', icon: <Award size={15} /> },
    { key: 'abroad', label: '유학 사업부',       icon: <Plane size={15} /> },
  ]

  return (
    <div className={styles.page_wrap}>
      <div className={styles.hero_card}>
        <TopRevenueHero
          year={selectedYear}
          month={selectedMonth}
          activeTab={activeTab}
          onChangeMonth={(y, m) => { setSelectedYear(y); setSelectedMonth(m) }}
        />
      </div>

      <div className={styles.div_tabs_shell}>
        <div className={styles.div_tabs}>
          {TABS.filter(tab => availableTabs.includes(tab.key)).map(tab => (
            <button
              key={tab.key}
              className={`${styles.div_tab} ${activeTab === tab.key ? styles.div_tab_active : ''}`}
              onClick={() => { router.replace(`/revenues/nms-sales?tab=${tab.key}`, { scroll: false }) }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'nms' && <NmsTab year={selectedYear} month={selectedMonth} />}
      {activeTab === 'cert' && <CertTab year={selectedYear} month={selectedMonth} />}
      {activeTab === 'abroad' && <AbroadTab year={selectedYear} month={selectedMonth} />}
      {activeTab === 'stats' && <StatsTab />}
    </div>
  )
}
