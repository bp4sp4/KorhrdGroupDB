// 정량평가 자동 환산 — 목표 대비 매출 달성률 → 평가점수
//
// | 달성률      | 평가점수 |
// | 120% 이상  | 120점 |
// | 110~119% | 110점 |
// | 100~109% | 100점 |
// | 90~99%   | 90점  |
// | 80~89%   | 80점  |
// | 80% 미만  | 70점  |

export const ACHIEVEMENT_SCORE_BANDS: { min: number; score: number }[] = [
  { min: 120, score: 120 },
  { min: 110, score: 110 },
  { min: 100, score: 100 },
  { min: 90, score: 90 },
  { min: 80, score: 80 },
  { min: 0, score: 70 },
]

/** 달성률(%) → 평가점수 */
export function achievementScore(ratePct: number): number {
  for (const band of ACHIEVEMENT_SCORE_BANDS) {
    if (ratePct >= band.min) return band.score
  }
  return ACHIEVEMENT_SCORE_BANDS[ACHIEVEMENT_SCORE_BANDS.length - 1].score
}

/** 정량평가 자동 산출 대상 지표 종류 */
export type QuantIndicatorKind =
  | 'sales' // 목표 대비 실제 매출 달성률
  | 'registration' // 목표 대비 실제 등록률
  | 'assignedDb' // 배정 DB수
  | 'refund' // 환불 건수
  | 'attendance' // 근태관리

/** 지표 문구 → 자동 산출 종류 식별 (해당 없으면 null) */
export function quantIndicatorKind(text: string): QuantIndicatorKind | null {
  if (text.includes('매출') && text.includes('달성률')) return 'sales'
  if (text.includes('등록률')) return 'registration'
  if (text.includes('배정') && text.toUpperCase().includes('DB')) return 'assignedDb'
  if (text.includes('환불')) return 'refund'
  if (text.includes('근태')) return 'attendance'
  return null
}

export interface SalesQuantMetric {
  /** 이번달 목표 (만원) — 대시보드 목표 설정값, 미설정 시 null */
  goalTotal: number | null
  /** 실제 매출 (만원) */
  actualTotal: number
  /** 달성률 (%) — 목표 미설정/0이면 null */
  rate: number | null
  /** 환산 평가점수 — 달성률 산출 불가 시 null */
  score: number | null
}

export interface QuantMetrics {
  /** 집계 기간 라벨 (예: "2026년 2분기") */
  period: string
  /** 매출 달성률 (대시보드 목표 대비 매출파일 실적) */
  sales: SalesQuantMetric
  /** 등록률 — 배정 DB(학점은행 상담) 대비 등록완료 전환 */
  registration: {
    assigned: number
    registered: number
    /** % — 배정 0건이면 null */
    rate: number | null
  }
  /** 환불 건수 — 수강등록(edu_students) 중 환불/당월 환불 */
  refundCount: number
  /** 근태 — 출퇴근 기록 기준 */
  attendance: {
    workDays: number
    lateCount: number
  }
}
