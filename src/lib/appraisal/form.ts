// 인사고과표 양식 데이터 구조 (appraisal_forms.form_data)
// 고과 양식 xlsx 의 팀역량평가서 / 개인역량평가서 2단 구성을 그대로 따른다.

export interface AppraisalIndicator {
  text: string;
  /** 절대평가 / 상대평가 — 개인역량 정량평가 항목에만 사용 */
  evalType?: string;
}

export interface AppraisalBlock {
  no: number;
  /** 분야 (예: 팀 역할1, 정량평가) */
  category: string;
  /** 평가자 (예: 본부장(사업부총괄)) */
  evaluator: string;
  indicators: AppraisalIndicator[];
}

export interface AppraisalSheet {
  /** 평가서 제목 (팀역량평가서 / 개인역량평가서) */
  title: string;
  managingDept: string;
  indicatorName: string;
  /** 측정방법 (멀티라인) */
  method: string;
  blocks: AppraisalBlock[];
  unit: string;
  cycle: string;
  registerCycle: string;
  evidence: string;
  target: string;
  usage: string;
  note: string;
}

export interface AppraisalFormData {
  team: AppraisalSheet;
  personal: AppraisalSheet;
}

export interface AppraisalFormRow {
  id: string;
  title: string;
  form_data: AppraisalFormData;
  /** 적용 팀 (null = 전사 공통) */
  team_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** 점수 척도 (1~5) */
export const SCORE_SCALE = [1, 2, 3, 4, 5] as const;

/** 평가 점수 — blocks/indicators 순서와 동일한 2차원 배열 */
export type ScoreMatrix = (number | null)[][];

/** 시트 구조에 맞춘 빈 점수표 생성 (기존 점수는 위치 보존) */
export function normalizeScores(
  sheet: AppraisalSheet,
  raw?: unknown,
): ScoreMatrix {
  const source = Array.isArray(raw) ? (raw as unknown[][]) : [];
  return (sheet.blocks ?? []).map((block, bi) =>
    (block.indicators ?? []).map((_, ii) => {
      const v = Array.isArray(source[bi]) ? source[bi][ii] : null;
      return typeof v === "number" && v >= 1 && v <= 5 ? v : null;
    }),
  );
}

/** 점수 열(1~5)별 소계 — 해당 열에 표시된 점수의 합 */
export function columnSubtotals(scores: ScoreMatrix): Record<number, number> {
  const subtotals: Record<number, number> = {};
  for (const n of SCORE_SCALE) subtotals[n] = 0;
  for (const row of scores) {
    for (const v of row) {
      if (typeof v === "number") subtotals[v] += v;
    }
  }
  return subtotals;
}

/** 총계 — 모든 점수의 합 */
export function totalScore(scores: ScoreMatrix): number {
  return scores.flat().reduce<number>((sum, v) => sum + (v ?? 0), 0);
}

/** 평가 등급 (규정 제7조) — 절대평가 점수 기준 */
export type AppraisalGrade = "S" | "A" | "B" | "C" | "D";

export const GRADE_BANDS: { grade: AppraisalGrade; min: number; label: string }[] = [
  { grade: "S", min: 95, label: "탁월" },
  { grade: "A", min: 85, label: "우수" },
  { grade: "B", min: 75, label: "양호" },
  { grade: "C", min: 65, label: "개선 필요" },
  { grade: "D", min: 0, label: "미흡" },
];

export function gradeOf(score: number): AppraisalGrade {
  for (const band of GRADE_BANDS) {
    if (score >= band.min) return band.grade;
  }
  return "D";
}

/** 등급 구간 상한 (S 100 / A 94 / B 84 / C 74 / D 64) */
const GRADE_MAX: Record<AppraisalGrade, number> = {
  S: 100,
  A: 94,
  B: 84,
  C: 74,
  D: 64,
};

const GRADE_ORDER: Record<AppraisalGrade, number> = {
  S: 4,
  A: 3,
  B: 2,
  C: 1,
  D: 0,
};

/** 두 등급 중 낮은 등급 */
export function lowerGrade(
  a: AppraisalGrade,
  b: AppraisalGrade,
): AppraisalGrade {
  return GRADE_ORDER[a] <= GRADE_ORDER[b] ? a : b;
}

/**
 * 상대평가 등급 — 절대평가 점수 순위 백분위를 권장비율(중간값)에 매핑
 * S 5% / A 20% / B 45% / C 20% / D 10% → 누적 5 / 25 / 70 / 90 / 100%
 * rank: 1위 = 최고 점수 (동점은 같은 순위)
 */
export function relativeGradeOf(rank: number, total: number): AppraisalGrade {
  const p = rank / total;
  if (p <= 0.05) return "S";
  if (p <= 0.25) return "A";
  if (p <= 0.7) return "B";
  if (p <= 0.9) return "C";
  return "D";
}

/** 점수를 등급 구간 안으로 보정 (구간 안이면 그대로) */
export function clampToGrade(score: number, grade: AppraisalGrade): number {
  const min = GRADE_BANDS.find((b) => b.grade === grade)?.min ?? 0;
  return Math.min(Math.max(score, min), GRADE_MAX[grade]);
}

/**
 * KPI 달성률 → 허용 최대 등급 (규정 제7조 등급 조건)
 * 100% 이상 S / 90% 이상 A / 그 미만은 B (KPI로 인한 하향은 B가 하한)
 */
export function kpiCapGrade(kpiRate: number): AppraisalGrade {
  if (kpiRate >= 100) return "S";
  if (kpiRate >= 90) return "A";
  return "B";
}

/**
 * 종합 점수 (규정 제4조 배점: 팀 역량 50점 + 개인 역량 50점)
 * 각 평가서는 100점 만점이므로 50% 가중치로 환산해 합산한다.
 */
export function combinedScore(teamTotal: number, personalTotal: number): number {
  return teamTotal * 0.5 + personalTotal * 0.5;
}

function emptySheet(title: string, target: string): AppraisalSheet {
  return {
    title,
    managingDept: "경영지원본부",
    indicatorName: title,
    method: "[측정산식]\n",
    blocks: [1, 2, 3, 4].map((no) => ({
      no,
      category: "",
      evaluator: "",
      indicators: Array.from({ length: 5 }, () => ({ text: "" })),
    })),
    unit: "점",
    cycle: "분기별",
    registerCycle: "년 4회",
    evidence: "",
    target,
    usage: "성과급 반영 및 개별 승진 점수환산 반영",
    note: "",
  };
}

/** '새 고과표' 생성용 빈 양식 */
export function createEmptyFormData(): AppraisalFormData {
  return {
    team: emptySheet("팀역량평가서", ""),
    personal: emptySheet("개인역량평가서", "한평생그룹 전직원 대상"),
  };
}
