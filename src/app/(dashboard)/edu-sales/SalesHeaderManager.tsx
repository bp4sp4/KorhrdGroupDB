'use client'

import { useState } from 'react'
import styles from './SalesHeaderManager.module.css'

interface DailyEntry {
  d: number
  amt: number
}

interface MonthHistory {
  m: number
  amount: number
}

interface Ranking {
  rank: number
  totalPeople: number
  teamShare?: number
}

interface Props {
  year?: number
  month: number
  managerName?: string
  myRevenue: number
  myCount: number
  myRefundCount: number
  prevMonthRevenue?: number
  target?: number
  ranking?: Ranking | null
  daily?: DailyEntry[]
  todayDay?: number | null
  totalDaysInMonth?: number
  history?: MonthHistory[]
  onExcelDownload?: () => void
  onGuide?: () => void
  onMonthClick?: (m: number) => void
  onViewAllPeriod?: () => void
}

const fmtKRW = (n: number) => new Intl.NumberFormat('ko-KR').format(n)

export default function SalesHeaderManager({
  year = new Date().getFullYear(),
  month,
  managerName = '',
  myRevenue,
  myCount,
  myRefundCount,
  prevMonthRevenue = 0,
  target = 0,
  ranking = null,
  daily = [],
  todayDay = null,
  totalDaysInMonth = 31,
  history = [],
  onExcelDownload,
  onGuide,
  onMonthClick,
  onViewAllPeriod,
}: Props) {
  const diff = myRevenue - prevMonthRevenue
  const diffPct = prevMonthRevenue
    ? ((diff / prevMonthRevenue) * 100).toFixed(1)
    : '0'
  const up = diff > 0
  const achievement = target ? (myRevenue / target) * 100 : 0
  const expectedPace = todayDay ? (todayDay / totalDaysInMonth) * 100 : 0
  const onPace = achievement >= expectedPace
  const dailyMax = Math.max(...daily.map((x) => x.amt), 1)
  const histMax = Math.max(...history.map((h) => h.amount), 1)
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)
  const hoveredEntry =
    hoveredDay != null ? daily.find((d) => d.d === hoveredDay) : null

  return (
    <div className={styles.wrap}>
      {/* Title bar */}
      <div className={styles.titleRow}>
        <div className={styles.titleLeft}>
          <div className={styles.title}>내 매출</div>
          <span className={styles.badgeManager}>담당자</span>
          {managerName && (
            <span className={styles.managerName}>· {managerName}</span>
          )}
        </div>
        <ActionButtons onExcel={onExcelDownload} onGuide={onGuide} />
      </div>

      {/* Main 2-col layout */}
      <div className={styles.mainGrid}>
        {/* LEFT — personal hero + target + daily */}
        <div className={styles.leftCard}>
          {/* Hero */}
          <div>
            <div className={styles.heroLabel}>
              {year}년 {month}월 · 내 매출
            </div>
            <div className={styles.heroValueRow}>
              <div className={styles.heroValue}>{fmtKRW(myRevenue)}</div>
              <div className={styles.heroUnit}>원</div>
            </div>
            <div className={styles.heroMeta}>
              {prevMonthRevenue > 0 && (
                <>
                  <span
                    className={`${styles.diff} ${up ? styles.diffUp : styles.diffDown}`}
                  >
                    {up ? '▲' : '▼'} {Math.abs(Number(diffPct))}% 전월비
                  </span>
                  <Divider />
                </>
              )}
              <span>
                <b className={styles.metaStrong}>{myCount}건</b> 결제
              </span>
              <Divider />
              <span>
                환불 <b className={styles.metaFaint}>{myRefundCount}건</b>
              </span>
            </div>
          </div>

          {/* Target progress */}
          {target > 0 && (
            <div className={styles.targetCard}>
              <div className={styles.targetRow}>
                <div className={styles.targetLabel}>이번 달 목표 달성</div>
                <div className={styles.targetValueWrap}>
                  <span className={styles.targetValue}>
                    {achievement.toFixed(0)}
                    <span className={styles.targetUnit}>%</span>
                  </span>
                  <span className={styles.targetSub}>
                    {fmtKRW(myRevenue)} / {fmtKRW(target)}
                  </span>
                </div>
              </div>
              <div className={styles.targetBarTrack}>
                <div
                  className={`${styles.targetBarFill} ${achievement >= 100 ? styles.targetBarFillDone : ''}`}
                  style={{ width: `${Math.min(achievement, 100)}%` }}
                />
                {todayDay && (
                  <div
                    className={styles.targetPaceMark}
                    style={{ left: `${expectedPace}%` }}
                  />
                )}
              </div>
              <div className={styles.targetFooter}>
                <span>
                  {todayDay &&
                    `오늘 기준 진행률 ${expectedPace.toFixed(0)}% · `}
                  페이스 {onPace ? '양호 ✓' : '뒤처짐'}
                </span>
                <span className={styles.targetRemain}>
                  잔여 {fmtKRW(Math.max(target - myRevenue, 0))}원
                </span>
              </div>
            </div>
          )}

          {/* Daily distribution */}
          {daily.length > 0 && (
            <div className={styles.dailyWrap}>
              <div className={styles.dailyHeader}>
                <div className={styles.dailyTitle}>일별 매출</div>
                <div className={styles.dailyRange}>
                  {month}/1 → {month}/{totalDaysInMonth}
                </div>
              </div>
              <div
                className={styles.dailyBars}
                onMouseLeave={() => setHoveredDay(null)}
              >
                {hoveredEntry && (
                  <div
                    className={styles.dailyTooltip}
                    style={{
                      left: `${((hoveredEntry.d - 0.5) / daily.length) * 100}%`,
                    }}
                  >
                    <div className={styles.dailyTooltipDate}>
                      {month}월 {hoveredEntry.d}일
                      {hoveredEntry.d === todayDay && (
                        <span className={styles.dailyTooltipTodayBadge}>
                          오늘
                        </span>
                      )}
                    </div>
                    <div className={styles.dailyTooltipAmount}>
                      {hoveredEntry.amt > 0
                        ? `${fmtKRW(hoveredEntry.amt)}원`
                        : "매출 없음"}
                    </div>
                  </div>
                )}
                {daily.map((day) => {
                  const h = day.amt > 0 ? (day.amt / dailyMax) * 100 : 0
                  const isToday = day.d === todayDay
                  const isPast = todayDay != null && day.d < todayDay
                  const isHovered = day.d === hoveredDay
                  return (
                    <div
                      key={day.d}
                      className={styles.dailyBarCol}
                      onMouseEnter={() => setHoveredDay(day.d)}
                      title={`${month}월 ${day.d}일 · ${day.amt > 0 ? fmtKRW(day.amt) + '원' : '매출 없음'}`}
                    >
                      <div
                        className={`${styles.dailyBar} ${
                          isToday
                            ? styles.dailyBarToday
                            : isPast
                              ? styles.dailyBarPast
                              : styles.dailyBarFuture
                        } ${isHovered ? styles.dailyBarHovered : ''}`}
                        style={{
                          height: `${h}%`,
                          minHeight: day.amt > 0 ? 3 : 0,
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className={styles.dailyAxis}>
                <span>1일</span>
                {todayDay && (
                  <span className={styles.dailyToday}>오늘 {todayDay}일</span>
                )}
                <span>{totalDaysInMonth}일</span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — rank card (optional) + my monthly history */}
        <div className={styles.rightCol}>
          {ranking && (
            <div className={styles.rankCard}>
              <div className={styles.rankLabel}>팀 내 순위</div>
              <div className={styles.rankValueRow}>
                <span className={styles.rankValue}>{ranking.rank}</span>
                <span className={styles.rankTotal}>
                  위 / {ranking.totalPeople}
                </span>
              </div>
              {ranking.teamShare != null && (
                <div className={styles.rankShare}>
                  팀 매출의{' '}
                  <b className={styles.rankShareStrong}>
                    {ranking.teamShare.toFixed(1)}%
                  </b>{' '}
                  기여
                </div>
              )}
            </div>
          )}

          <div className={styles.historyCard}>
            <div className={styles.historyTitle}>내 월별 매출</div>
            {history.map((h) => {
              const active = h.m === month
              const w = h.amount > 0 ? (h.amount / histMax) * 100 : 0
              return (
                <button
                  key={h.m}
                  type="button"
                  onClick={() => onMonthClick?.(h.m)}
                  className={`${styles.historyRow} ${active ? styles.historyRowActive : ''}`}
                >
                  <span
                    className={`${styles.historyMonth} ${active ? styles.historyMonthActive : ''}`}
                  >
                    {h.m}월
                  </span>
                  <div className={styles.historyBarTrack}>
                    <div
                      className={`${styles.historyBarFill} ${active ? styles.historyBarFillActive : ''}`}
                      style={{ width: `${w}%` }}
                    />
                  </div>
                  <span
                    className={`${styles.historyValue} ${active ? styles.historyValueActive : ''}`}
                  >
                    {h.amount > 0
                      ? `${fmtKRW(Math.round(h.amount / 10000))}만`
                      : '—'}
                  </span>
                </button>
              )
            })}
            {history.length === 0 && (
              <div className={styles.emptyHint}>월별 데이터가 없습니다.</div>
            )}
            <button
              type="button"
              onClick={onViewAllPeriod}
              className={styles.historyViewAll}
            >
              전체 기간 보기 →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── shared sub-components ─────────────────────────────────────────

function ActionButtons({
  onExcel,
  onGuide,
}: {
  onExcel?: () => void
  onGuide?: () => void
}) {
  return (
    <div className={styles.actions}>
      <button type="button" onClick={onExcel} className={styles.excelBtn}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 1v9m0 0l3-3m-3 3l-3-3M2 12h10"
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        엑셀 다운로드
      </button>
      <button type="button" onClick={onGuide} className={styles.guideBtn}>
        가이드
      </button>
    </div>
  )
}

function Divider() {
  return <span className={styles.divider}>|</span>
}
