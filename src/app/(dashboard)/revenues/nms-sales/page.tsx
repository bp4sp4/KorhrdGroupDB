'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, TrendingUp } from 'lucide-react'
import { getLastMonths, getThisMonth, formatAmount } from '@/lib/management/utils'
import styles from './page.module.css'

interface ManagerStat {
  manager: string
  paymentAmount: number
  commission: number
  totalCount: number
  completedCount: number
}

interface TeamStat {
  team: string
  paymentAmount: number
  commission: number
  totalCount: number
  completedCount: number
  managers: ManagerStat[]
}

interface SalesData {
  year: number
  month: number
  total: {
    paymentAmount: number
    commission: number
    totalCount: number
    completedCount: number
  }
  byTeam: TeamStat[]
}

// 조회할 팀 목록 (유지보수: 여기에 팀 추가/삭제)
const NMS_TEAMS = ['본사', '프리랜서', '1팀', '2팀', '3팀', '4팀']

export default function NmsSalesPage() {
  const months = getLastMonths(12)
  const thisMonth = getThisMonth()

  const [selectedYear, setSelectedYear] = useState(thisMonth.year)
  const [selectedMonth, setSelectedMonth] = useState(thisMonth.month)
  const [teamFilter, setTeamFilter] = useState('본사')
  const [data, setData] = useState<SalesData | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        year: String(selectedYear),
        month: String(selectedMonth),
      })
      if (teamFilter) params.set('team', teamFilter)

      const res = await fetch(`/api/management/nms-sales?${params}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
        // 기본으로 모든 팀 펼치기
        setExpandedTeams(new Set(json.byTeam?.map((t: TeamStat) => t.team) ?? []))
      }
    } finally {
      setLoading(false)
    }
  }, [selectedYear, selectedMonth, teamFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleTeam = (team: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev)
      if (next.has(team)) next.delete(team)
      else next.add(team)
      return next
    })
  }

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [y, m] = e.target.value.split('-').map(Number)
    setSelectedYear(y)
    setSelectedMonth(m)
  }

  return (
    <div className={styles.page_wrap}>
      {/* 헤더 */}
      <div className={styles.page_header}>
        <h1 className={styles.page_title}>NMS 팀별 매출 현황</h1>
      </div>

      {/* 필터 바 */}
      <div className={styles.filter_bar}>
        <div className={styles.filter_group}>
          <span className={styles.filter_label}>월</span>
          <select
            className={styles.filter_select}
            value={`${selectedYear}-${selectedMonth}`}
            onChange={handleMonthChange}
          >
            {months.map(m => (
              <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filter_group}>
          <span className={styles.filter_label}>팀</span>
          <select
            className={styles.filter_select}
            value={teamFilter}
            onChange={e => setTeamFilter(e.target.value)}
          >
            <option value="">전체 팀</option>
            {NMS_TEAMS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 합계 카드 */}
      {data && (
        <div className={styles.summary_grid}>
          <div className={styles.summary_card}>
            <span className={styles.summary_label}>총 매출</span>
            <span className={styles.summary_value}>{formatAmount(data.total.paymentAmount)}</span>
          </div>
          <div className={styles.summary_card}>
            <span className={styles.summary_label}>수수료 합계</span>
            <span className={styles.summary_value}>{formatAmount(data.total.commission)}</span>
          </div>
          <div className={styles.summary_card}>
            <span className={styles.summary_label}>등록완료</span>
            <span className={styles.summary_value}>{data.total.completedCount}건</span>
          </div>
          <div className={styles.summary_card}>
            <span className={styles.summary_label}>전체 건수</span>
            <span className={styles.summary_value}>{data.total.totalCount}건</span>
          </div>
        </div>
      )}

      {/* 팀별 테이블 */}
      {loading ? (
        <div className={styles.loading}>불러오는 중...</div>
      ) : !data || data.byTeam.length === 0 ? (
        <div className={styles.empty}>해당 기간에 데이터가 없습니다.</div>
      ) : (
        <div className={styles.teams_wrap}>
          {data.byTeam.map(team => (
            <div key={team.team} className={styles.team_block}>
              {/* 팀 헤더 행 (클릭으로 접기/펼치기) */}
              <button
                className={styles.team_header}
                onClick={() => toggleTeam(team.team)}
              >
                <span className={styles.team_toggle_icon}>
                  {expandedTeams.has(team.team) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
                <TrendingUp size={15} className={styles.team_icon} />
                <span className={styles.team_name}>{team.team}</span>
                <div className={styles.team_summary}>
                  <span>{formatAmount(team.paymentAmount)}</span>
                  <span className={styles.team_count}>등록완료 {team.completedCount}건 / 전체 {team.totalCount}건</span>
                </div>
              </button>

              {/* 담당자별 상세 */}
              {expandedTeams.has(team.team) && (
                <table className={styles.manager_table}>
                  <thead>
                    <tr>
                      <th>담당자</th>
                      <th>매출</th>
                      <th>수수료</th>
                      <th>등록완료</th>
                      <th>전체</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.managers.map(mgr => (
                      <tr key={mgr.manager}>
                        <td>{mgr.manager}</td>
                        <td className={styles.amount_cell}>{formatAmount(mgr.paymentAmount)}</td>
                        <td className={styles.amount_cell}>{formatAmount(mgr.commission)}</td>
                        <td>{mgr.completedCount}건</td>
                        <td>{mgr.totalCount}건</td>
                      </tr>
                    ))}
                    {/* 팀 소계 */}
                    <tr className={styles.team_subtotal}>
                      <td>소계</td>
                      <td className={styles.amount_cell}>{formatAmount(team.paymentAmount)}</td>
                      <td className={styles.amount_cell}>{formatAmount(team.commission)}</td>
                      <td>{team.completedCount}건</td>
                      <td>{team.totalCount}건</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
