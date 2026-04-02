'use client'

import { useEffect, useState, useCallback } from 'react'
import styles from './page.module.css'

interface ManagerStat {
  manager: string
  count: number
}

interface StatsResult {
  month: string
  data: ManagerStat[]
  total: number
  unassigned: number
  grandTotal: number
}

function getDefaultMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getMonthLabel(month: string) {
  const [year, mo] = month.split('-')
  return `${year}년 ${parseInt(mo)}월`
}

// 최근 12개월 목록
function getMonthOptions() {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    options.push({ value, label: getMonthLabel(value) })
  }
  return options
}

export default function AssignmentPage() {
  const [month, setMonth] = useState(getDefaultMonth)
  const [result, setResult] = useState<StatsResult | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async (m: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/hakjeom/manager-stats?month=${m}`)
      if (!res.ok) return
      const json = await res.json()
      setResult(json)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats(month)
  }, [fetchStats, month])

  const options = getMonthOptions()
  const maxCount = result?.data[0]?.count ?? 1

  return (
    <div className={styles.wrap}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>담당자 배정 현황</h2>
          <p className={styles.subtitle}>학점은행제 상담 담당자 배정 건수 (월별 집계)</p>
        </div>
        <select
          className={styles.monthSelect}
          value={month}
          onChange={e => setMonth(e.target.value)}
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* 요약 카드 */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>이달 총 유입</span>
          <span className={styles.summaryValue}>
            {loading ? '-' : `${result?.grandTotal?.toLocaleString() ?? 0}건`}
          </span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>배정 완료</span>
          <span className={styles.summaryValueBlue}>
            {loading ? '-' : `${result?.total?.toLocaleString() ?? 0}건`}
          </span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>미배정</span>
          <span className={result?.unassigned ? styles.summaryValueRed : styles.summaryValue}>
            {loading ? '-' : `${result?.unassigned?.toLocaleString() ?? 0}건`}
          </span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>배정 담당자 수</span>
          <span className={styles.summaryValue}>
            {loading ? '-' : `${result?.data?.length ?? 0}명`}
          </span>
        </div>
      </div>

      {/* 테이블 */}
      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingWrap}>불러오는 중...</div>
        ) : !result || result.data.length === 0 ? (
          <div className={styles.emptyWrap}>
            <p className={styles.emptyText}>{getMonthLabel(month)}에 배정된 내역이 없습니다.</p>
            <p className={styles.emptyHint}>담당자를 배정하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead className={styles.thead}>
              <tr>
                <th className={styles.th} style={{ width: 48 }}>순위</th>
                <th className={styles.th}>담당자</th>
                <th className={styles.th}>배정 건수</th>
                <th className={styles.th}>비율</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((row, idx) => {
                const pct = result.grandTotal > 0 ? (row.count / result.grandTotal) * 100 : 0
                const barPct = maxCount > 0 ? (row.count / maxCount) * 100 : 0
                return (
                  <tr key={row.manager} className={styles.tr}>
                    <td className={styles.td}>
                      <span className={idx === 0 ? styles.rank1 : idx === 1 ? styles.rank2 : idx === 2 ? styles.rank3 : styles.rankN}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.managerName}>{row.manager}</span>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.barWrap}>
                        <div
                          className={styles.bar}
                          style={{ width: `${barPct}%` }}
                        />
                        <span className={styles.countText}>{row.count.toLocaleString()}건</span>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.pctText}>{pct.toFixed(1)}%</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className={styles.footNote}>
        * 해당 월에 등록된 상담 건 기준으로 집계됩니다. 매달 1일 자동 초기화됩니다.
      </p>
    </div>
  )
}
