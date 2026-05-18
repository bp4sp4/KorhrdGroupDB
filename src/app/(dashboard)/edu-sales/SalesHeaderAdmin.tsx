'use client'

import { useMemo } from 'react'
import styles from './SalesHeaderAdmin.module.css'

interface PersonStat {
  name: string
  count: number
  amount: number
}

interface MonthHistory {
  m: number
  revenue: number
}

interface Props {
  year?: number
  month: number
  totalRevenue: number
  totalCount: number
  refundCount: number
  people: PersonStat[]
  history: MonthHistory[]
  prevMonthRevenue?: number
  onExcelDownload?: () => void
  onGuide?: () => void
  onPersonClick?: (p: PersonStat) => void
  onMonthClick?: (m: number) => void
  onViewAllPeriod?: () => void
}

const fmtKRW = (n: number) => new Intl.NumberFormat('ko-KR').format(n)

export default function SalesHeaderAdmin({
  year = new Date().getFullYear(),
  month,
  totalRevenue,
  totalCount,
  refundCount,
  people,
  history,
  prevMonthRevenue = 0,
  onExcelDownload,
  onGuide,
  onPersonClick,
  onMonthClick,
  onViewAllPeriod,
}: Props) {
  const sorted = useMemo(
    () => [...people].sort((a, b) => b.amount - a.amount),
    [people],
  )
  const max = sorted[0]?.amount || 1
  const total = sorted.reduce((s, p) => s + p.amount, 0) || 1
  const histMax = Math.max(...history.map((h) => h.revenue), 1)
  const diff = totalRevenue - prevMonthRevenue
  const diffPct = prevMonthRevenue
    ? ((diff / prevMonthRevenue) * 100).toFixed(1)
    : '0'
  const up = diff > 0

  return (
    <div className={styles.wrap}>
      {/* Title bar */}
      <div className={styles.titleRow}>
        <div className={styles.titleLeft}>
          <div className={styles.title}>매출파일</div>
          <span className={styles.badgeAdmin}>ADMIN</span>
        </div>
        <ActionButtons onExcel={onExcelDownload} onGuide={onGuide} />
      </div>

      {/* Main 2-col layout */}
      <div className={styles.mainGrid}>
        {/* LEFT — hero + team breakdown */}
        <div className={styles.leftCard}>
          <div>
            <div className={styles.heroLabel}>
              {year}년 {month}월 · 팀 전체
            </div>
            <div className={styles.heroValueRow}>
              <div className={styles.heroValue}>{fmtKRW(totalRevenue)}</div>
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
                <b className={styles.metaStrong}>{totalCount}건</b> 결제
              </span>
              <Divider />
              <span>
                담당자{' '}
                <b className={styles.metaStrong}>{people.length}명</b>
              </span>
              <Divider />
              <span>
                환불 <b className={styles.metaFaint}>{refundCount}건</b>
              </span>
            </div>
          </div>

          <div className={styles.hr} />

          {/* Team breakdown bars */}
          <div className={styles.section}>
            <SectionLabel right="클릭해서 필터">담당자별</SectionLabel>
            <div className={styles.personList}>
              {sorted.map((p, i) => {
                const w = (p.amount / max) * 100
                const pct = ((p.amount / total) * 100).toFixed(0)
                const barClass =
                  i === 0
                    ? styles.personBarTop
                    : i < 3
                      ? styles.personBarMid
                      : styles.personBarLow
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => onPersonClick?.(p)}
                    className={styles.personRow}
                  >
                    <span className={styles.personName}>{p.name}</span>
                    <span className={styles.personCount}>{p.count}건</span>
                    <div className={styles.personBarTrack}>
                      <div
                        className={`${styles.personBarFill} ${barClass}`}
                        style={{ width: `${w}%` }}
                      />
                    </div>
                    <span className={styles.personAmount}>
                      {fmtKRW(p.amount)}
                    </span>
                    <span className={styles.personPct}>{pct}%</span>
                  </button>
                )
              })}
              {sorted.length === 0 && (
                <div className={styles.emptyHint}>
                  담당자별 매출 데이터가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — month rail */}
        <MonthRail
          title="월별 팀 매출"
          history={history}
          currentMonth={month}
          histMax={histMax}
          onMonthClick={onMonthClick}
          onViewAll={onViewAllPeriod}
        />
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

function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode
  right?: string
}) {
  return (
    <div className={styles.sectionLabel}>
      <div className={styles.sectionLabelText}>{children}</div>
      {right && <div className={styles.sectionLabelRight}>{right}</div>}
    </div>
  )
}

function MonthRail({
  title,
  history,
  currentMonth,
  histMax,
  onMonthClick,
  onViewAll,
}: {
  title: string
  history: MonthHistory[]
  currentMonth: number
  histMax: number
  onMonthClick?: (m: number) => void
  onViewAll?: () => void
}) {
  return (
    <div className={styles.railCard}>
      <div className={styles.railTitle}>{title}</div>
      {history.map((h) => {
        const active = h.m === currentMonth
        const w = h.revenue > 0 ? (h.revenue / histMax) * 100 : 0
        return (
          <button
            key={h.m}
            type="button"
            onClick={() => onMonthClick?.(h.m)}
            className={`${styles.railRow} ${active ? styles.railRowActive : ''}`}
          >
            <span
              className={`${styles.railMonth} ${active ? styles.railMonthActive : ''}`}
            >
              {h.m}월
            </span>
            <div className={styles.railBarTrack}>
              <div
                className={`${styles.railBarFill} ${active ? styles.railBarFillActive : ''}`}
                style={{ width: `${w}%` }}
              />
            </div>
            <span
              className={`${styles.railValue} ${active ? styles.railValueActive : ''}`}
            >
              {h.revenue > 0
                ? `${fmtKRW(Math.round(h.revenue / 10000))}만`
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
        onClick={onViewAll}
        className={styles.railViewAll}
      >
        전체 기간 보기 →
      </button>
    </div>
  )
}
