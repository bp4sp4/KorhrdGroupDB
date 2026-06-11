// 인사고과 평가 분기 (YYYY-Qn) 유틸

export const PERIOD_RE = /^(\d{4})-Q([1-4])$/

export function isValidPeriod(value: unknown): value is string {
  return typeof value === 'string' && PERIOD_RE.test(value)
}

/** 현재 분기 — 예: "2026-Q2" */
export function currentPeriod(now = new Date()): string {
  return `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`
}

/** "2026-Q2" → { year: 2026, quarter: 2 } */
export function parsePeriod(period: string): { year: number; quarter: number } {
  const m = period.match(PERIOD_RE)
  if (!m) {
    const now = new Date()
    return { year: now.getFullYear(), quarter: Math.floor(now.getMonth() / 3) + 1 }
  }
  return { year: parseInt(m[1], 10), quarter: parseInt(m[2], 10) }
}

/** "2026-Q2" → "2026년 2분기" */
export function periodLabel(period: string): string {
  const { year, quarter } = parsePeriod(period)
  return `${year}년 ${quarter}분기`
}

/** 인사고과 운영 시작 분기 — 이전 분기는 선택기에 노출하지 않는다 */
export const APPRAISAL_START_PERIOD = '2026-Q3'

/** 기본 선택 분기 — 현재 분기, 단 시작 분기 이전이면 시작 분기 */
export function defaultPeriod(now = new Date()): string {
  const cur = currentPeriod(now)
  return cur < APPRAISAL_START_PERIOD ? APPRAISAL_START_PERIOD : cur
}

/** 시작 분기(2026-Q3)부터 현재 분기까지 자동 생성 (최신순) — 분기가 지나면 자동 추가 */
export function periodOptions(now = new Date()): string[] {
  const out: string[] = []
  let { year, quarter } = parsePeriod(defaultPeriod(now))
  const { year: startYear, quarter: startQuarter } = parsePeriod(
    APPRAISAL_START_PERIOD,
  )
  while (year > startYear || (year === startYear && quarter >= startQuarter)) {
    out.push(`${year}-Q${quarter}`)
    quarter -= 1
    if (quarter === 0) {
      quarter = 4
      year -= 1
    }
  }
  return out
}
