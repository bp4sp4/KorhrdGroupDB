'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ChevronDown, ChevronRight, ChevronLeft, TrendingUp, CheckCircle, CalendarDays, Award, Plane, BarChart2, Users } from 'lucide-react'
import { getThisMonth, formatAmount } from '@/lib/management/utils'
import styles from './page.module.css'

const StatsTab = dynamic(() => import('./StatsTab'), {
  ssr: false,
  loading: () => <div className={styles.loading}><div className={styles.spinner} /><span>불러오는 중...</span></div>,
})

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

function NmsTab({ year, month, onSummary }: { year: number; month: number; onSummary: (s: HeroSummary) => void }) {
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
      let nmsTotal = 0
      let allcareTotal = 0
      if (nmsRes && nmsRes.ok) {
        const json = (await nmsRes.json()) as NmsSalesData
        setData(json)
        setExpandedTeams(new Set())
        nmsTotal = json.total?.paymentAmount ?? 0
      } else if (teamFilter === 'allcare') {
        setData(null)
      }
      if (allcareRes.ok) {
        const json = (await allcareRes.json()) as AllcareSalesData
        setAllcareData(json)
        allcareTotal = json.totalRevenue ?? 0
      }
      onSummary({
        amount: nmsTotal + allcareTotal,
        label: '이번 달 총 매출',
        sublabel: '학점은행제 + 올케어 합산',
      })
    } finally {
      setLoading(false)
    }
  }, [year, month, teamFilter, onSummary])

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

function CertTab({ year, month, onSummary }: { year: number; month: number; onSummary: (s: HeroSummary) => void }) {
  const [data, setData] = useState<CertSalesData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month) })
      const res = await fetch(`/api/management/cert-sales?${params}`)
      if (res.ok) {
        const json = (await res.json()) as CertSalesData
        setData(json)
        onSummary({
          amount: json.total?.paymentAmount ?? 0,
          label: '이번 달 민간자격증 매출',
          sublabel: '결제완료 기준',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [year, month, onSummary])

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

function AbroadTab({ year, month, onSummary }: { year: number; month: number; onSummary: (s: HeroSummary) => void }) {
  const [data, setData] = useState<AbroadSalesData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month) })
      const res = await fetch(`/api/management/abroad-sales?${params}`)
      if (res.ok) {
        const json = (await res.json()) as AbroadSalesData
        setData(json)
        onSummary({
          amount: json.total?.paymentAmount ?? 0,
          label: '이번 달 유학 매출',
          sublabel: '결제완료 기준',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [year, month, onSummary])

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


function TopRevenueHero({
  year,
  month,
  summary,
  onChangeMonth,
}: {
  year: number
  month: number
  summary: HeroSummary | null
  onChangeMonth: (y: number, m: number) => void
}) {
  return (
    <>
      <div className={styles.hero_amount_block}>
        <span className={styles.hero_amount_label}>{summary?.label ?? '이번 달 매출'}</span>
        <strong className={styles.hero_amount_value}>
          {summary ? formatAmount(summary.amount) : '불러오는 중...'}
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
  const [heroSummary, setHeroSummary] = useState<HeroSummary | null>(null)
  const activeTab: TabKey = urlTab && availableTabs.includes(urlTab) ? urlTab : (availableTabs[0] ?? 'stats')

  // 탭/월 전환 시 헤로 카드 초기화 (탭이 새로 fetch 후 setHeroSummary 호출)
  useEffect(() => {
    setHeroSummary(null)
  }, [activeTab, selectedYear, selectedMonth])

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
          summary={heroSummary}
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
      {activeTab === 'nms' && <NmsTab year={selectedYear} month={selectedMonth} onSummary={setHeroSummary} />}
      {activeTab === 'cert' && <CertTab year={selectedYear} month={selectedMonth} onSummary={setHeroSummary} />}
      {activeTab === 'abroad' && <AbroadTab year={selectedYear} month={selectedMonth} onSummary={setHeroSummary} />}
      {activeTab === 'stats' && <StatsTab year={selectedYear} month={selectedMonth} onSummary={setHeroSummary} />}
    </div>
  )
}
