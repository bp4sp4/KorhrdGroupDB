// 업무일지 양식 식별자 — DB(teams.journal_form) 와 동기화된 enum.
//
// 새 양식 추가 절차:
//   1) 여기에 식별자 추가 (예: 'engineering')
//   2) UI 분기 코드 (work-journal/page.tsx) 에 해당 조건 추가
//   3) DB UPDATE teams SET journal_form='engineering' WHERE code='ENG';

export const JOURNAL_FORM_TYPES = {
  DEFAULT: "default",
  ACADEMIC: "academic",
  PRACTICUM: "practicum",
} as const;

export type JournalFormType =
  (typeof JOURNAL_FORM_TYPES)[keyof typeof JOURNAL_FORM_TYPES];

// 미인식 양식이 DB 에 들어와도 안전하게 처리.
export function normalizeJournalForm(value: unknown): JournalFormType {
  if (value === JOURNAL_FORM_TYPES.ACADEMIC) return JOURNAL_FORM_TYPES.ACADEMIC;
  if (value === JOURNAL_FORM_TYPES.PRACTICUM)
    return JOURNAL_FORM_TYPES.PRACTICUM;
  return JOURNAL_FORM_TYPES.DEFAULT;
}
