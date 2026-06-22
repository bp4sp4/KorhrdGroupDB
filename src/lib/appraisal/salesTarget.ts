// 매출 목표 — 키 규칙 및 기본값 (페이지/ API / 정량산출 공용)
//
//  · 목표매출(메인 KPI 분모) = 기존 대시보드 월목표 재사용
//      key: dashboard.monthly_goal.{uid}.{YYYY-MM}  value: { total: number(만원) }
//  · 최소매출(기준 매출 달성률 분모) = 신규
//      key: appraisal.min_sales.{uid}.{YYYY-MM}      value: { total: number(만원) }
//
//  단위: 만원 / 기준: 월별 저장(분기 평가는 3개월 합산)

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 목표매출(대시보드 월목표) 설정 키 */
export function monthlyGoalKey(uid: number, year: number, month: number): string {
  return `dashboard.monthly_goal.${uid}.${year}-${pad2(month)}`
}

/** 최소매출 설정 키 */
export function minSalesKey(uid: number, year: number, month: number): string {
  return `appraisal.min_sales.${uid}.${year}-${pad2(month)}`
}

/** 최소매출 월 기본값 (만원) — 팀장 1000 / 그 외(사원) 600 */
export const DEFAULT_MIN_SALES_LEADER = 1000
export const DEFAULT_MIN_SALES_STAFF = 600

export function defaultMinSales(isLeader: boolean): number {
  return isLeader ? DEFAULT_MIN_SALES_LEADER : DEFAULT_MIN_SALES_STAFF
}

/** app_settings value({total}) → 숫자(만원). 없으면 null */
export function readTotal(value: unknown): number | null {
  if (value && typeof value === 'object' && 'total' in value) {
    const t = (value as { total?: unknown }).total
    if (typeof t === 'number' && Number.isFinite(t)) return t
  }
  return null
}

/** 주차 배열을 항상 길이 5(0 이상 정수)로 정규화 */
export function normalizeWeeks(weeks: unknown): number[] {
  const arr = Array.isArray(weeks) ? weeks : []
  return Array.from({ length: 5 }, (_, i) => {
    const n = Number(arr[i])
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  })
}

/** app_settings value → { total, weeks(5) }. 값 없으면 null */
export function readGoal(
  value: unknown,
): { total: number; weeks: number[] } | null {
  const total = readTotal(value)
  if (total == null) return null
  const weeks =
    value && typeof value === 'object' && 'weeks' in value
      ? normalizeWeeks((value as { weeks?: unknown }).weeks)
      : [0, 0, 0, 0, 0]
  return { total, weeks }
}
