// 이의제기 기간 — 평가 제출 후 5일 이내에만 접수
// (재작성 허용 → 재제출되면 submitted_at 이 갱신되므로 기간이 다시 열린다)

export const APPEAL_WINDOW_DAYS = 5

/** 이의제기 마감 시각 (제출 시각 + 5일) — submitted_at 없으면 null */
export function appealDeadline(submittedAt: string | null): Date | null {
  if (!submittedAt) return null
  const d = new Date(submittedAt)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + APPEAL_WINDOW_DAYS)
  return d
}

/** 이의제기 가능 여부 */
export function isAppealWindowOpen(
  submittedAt: string | null,
  now: Date = new Date(),
): boolean {
  const deadline = appealDeadline(submittedAt)
  return deadline !== null && now <= deadline
}
