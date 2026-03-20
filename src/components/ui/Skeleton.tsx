import styles from './Skeleton.module.css'

const BAR_HEIGHTS = [60, 90, 45, 110, 75, 130]

/** 테이블 스켈레톤 - cols: 컬럼 수, rows: 행 수 */
export function TableSkeleton({ cols = 6, rows = 8 }: { cols?: number; rows?: number }) {
  const widths = ['cellShort', 'cellLong', 'cellMed', 'cellFull', 'cellMed', 'cellLong', 'cellShort', 'cellMed', 'cellFull']
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri} className={styles.tableRow}>
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci}>
              <span className={`${styles.cell} ${styles[widths[ci % widths.length] as keyof typeof styles]}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/** 통계 카드 스켈레톤 */
export function StatsCardsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className={styles.statsGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.statsCard}>
          <span className={styles.statsCardLabel} />
          <span className={styles.statsCardValue} />
          <span className={styles.statsCardSub} />
        </div>
      ))}
    </div>
  )
}

/** 차트 패널 스켈레톤 */
export function ChartSkeleton() {
  return (
    <div className={styles.chartPanel}>
      <div className={styles.chartTitle} />
      <div className={styles.chartBars}>
        {BAR_HEIGHTS.map((h, i) => (
          <div key={i} className={styles.chartBar} style={{ height: `${h}px` }} />
        ))}
      </div>
    </div>
  )
}

/** 필터바 스켈레톤 - 총 건수 + 검색 영역 */
export function FilterBarSkeleton() {
  return (
    <div className={styles.filterBar}>
      <span className={styles.filterCount} />
      <span className={styles.filterSearch} />
    </div>
  )
}

/** 차트 2×2 그리드 스켈레톤 */
export function ChartsGridSkeleton() {
  return (
    <div className={styles.chartsGrid}>
      {Array.from({ length: 4 }).map((_, i) => (
        <ChartSkeleton key={i} />
      ))}
    </div>
  )
}
