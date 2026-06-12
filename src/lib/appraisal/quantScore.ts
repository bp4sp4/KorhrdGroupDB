// 정량평가 자동 환산 — 1~5점 척도
//
// 전분기 평균 대비 당분기 평균 비율 (매출·등록률 공통)
// | 비율            | 점수 |
// | 150% 이상       | 5점 |
// | 120~150% 미만   | 4점 |
// | 80~120% 미만    | 3점 |
// | 60~80% 미만     | 2점 |
// | 60% 미만        | 1점 |
//
// 환불 건수
// | 0~3회 5점 | 4~6회 4점 | 7~9회 3점 | 10~12회 2점 | 13회 이상 1점 |
//
// 근태관리 (지각·결근)
// | 지각 0회·결근 0회 5점 | 지각 1~2회 4점 | 지각 3~4회 3점 |
// | 지각 5~6회 또는 결근 1회 2점 | 지각 7회 이상 또는 결근 2회 이상 1점 |

/** 전분기 평균 대비 당분기 평균 비율(%) → 1~5점 */
export function quarterRatioScore(ratePct: number): number {
  if (ratePct >= 150) return 5
  if (ratePct >= 120) return 4
  if (ratePct >= 80) return 3
  if (ratePct >= 60) return 2
  return 1
}

/** 환불 건수 → 1~5점 */
export function refundScore(count: number): number {
  if (count <= 3) return 5
  if (count <= 6) return 4
  if (count <= 9) return 3
  if (count <= 12) return 2
  return 1
}

/** 근태(지각·결근 횟수) → 1~5점 */
export function attendanceScore(
  lateCount: number,
  absentCount: number,
): number {
  if (absentCount >= 2 || lateCount >= 7) return 1
  if (absentCount === 1 || lateCount >= 5) return 2
  if (lateCount >= 3) return 3
  if (lateCount >= 1) return 4
  return 5
}

/**
 * 상대평가(배정 DB수) — 그룹 내 순위 → 1~5점
 * | 상위 20% 5점 | 상위 40% 4점 | 중위 40% 3점 | 하위 20% 2점 | 최하위 1점 |
 * - rank: 1위 = 최다 배정 (동점은 같은 순위)
 * - isLowest: 그룹 내 최소 건수와 동일하면 최하위(1점)
 * - 비교 대상이 본인뿐이면 산출 불가(null)
 */
export function relativeRankScore(
  rank: number,
  total: number,
  isLowest: boolean,
): number | null {
  if (total <= 1) return null
  if (isLowest) return 1
  const p = rank / total
  if (p <= 0.2) return 5
  if (p <= 0.4) return 4
  if (p <= 0.8) return 3
  return 2
}

/** 정량평가 자동 산출 대상 지표 종류 */
export type QuantIndicatorKind =
  | 'sales' // 전분기 평균 매출 대비 당분기 평균 매출
  | 'registration' // 전분기 평균 등록률 대비 당분기 평균 등록률
  | 'assignedDb' // 배정 DB수
  | 'refund' // 환불 건수
  | 'attendance' // 근태관리

/** 지표 문구 → 자동 산출 종류 식별 (해당 없으면 null) */
export function quantIndicatorKind(text: string): QuantIndicatorKind | null {
  if (text.includes('등록률')) return 'registration'
  if (text.includes('매출') && (text.includes('대비') || text.includes('달성률')))
    return 'sales'
  if (text.includes('배정') && text.toUpperCase().includes('DB')) return 'assignedDb'
  if (text.includes('환불')) return 'refund'
  if (text.includes('근태')) return 'attendance'
  return null
}

/** 전분기 대비 당분기 비교 지표 */
export interface QuarterCompareMetric {
  /** 전분기 월평균 — 전분기 데이터 없으면 null */
  prevAvg: number | null
  /** 당분기 월평균 */
  currAvg: number
  /** 당분기/전분기 비율(%) — 전분기 0/미산출이면 null */
  rate: number | null
  /** 환산 점수 1~5 — 비율 산출 불가 시 null */
  score: number | null
}

export interface QuantMetrics {
  /** 집계 기간 라벨 (예: "2026년 2분기") */
  period: string
  /** 비교 대상 전분기 라벨 (예: "2026년 1분기") */
  prevPeriod: string
  /** 매출 — 전분기 평균 매출 대비 당분기 평균 매출 (만원) */
  sales: QuarterCompareMetric
  /** 등록률 — 전분기 평균 등록률 대비 당분기 평균 등록률 */
  registration: {
    /** 당분기 배정 DB(학점은행 상담) */
    assigned: number
    /** 당분기 등록완료 */
    registered: number
    /** 당분기 등록률 % — 배정 0건이면 null */
    rate: number | null
    /** 전분기 등록률 % — 배정 0건이면 null */
    prevRate: number | null
    /** 당분기/전분기 등록률 비율 % */
    compareRate: number | null
    /** 환산 점수 1~5 */
    score: number | null
  }
  /** 배정 DB수 — 같은 부서 담당자 간 상대평가 */
  assignedDb: {
    /** 당분기 배정 건수 */
    count: number
    /** 부서 내 순위 (1위 = 최다, 동점은 같은 순위) — 비교 불가 시 null */
    rank: number | null
    /** 비교 대상 인원 (배정 이력 있는 같은 부서 담당자 + 본인) */
    groupSize: number
    /** 환산 점수 1~5 — 비교 대상 없으면 null */
    score: number | null
  }
  /** 환불 — 수강등록(edu_students) 중 환불/당월 환불 */
  refund: {
    count: number
    score: number
  }
  /** 근태 — 출퇴근 기록 기준 */
  attendance: {
    workDays: number
    lateCount: number
    /** 결근 — 분기 내 지난 평일 중 출근 기록·승인 휴가 모두 없는 날 */
    absentCount: number
    score: number
  }
}
