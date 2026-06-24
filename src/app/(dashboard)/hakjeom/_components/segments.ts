// ─── 세그먼트 공통 유틸 ───────────────────────────────────────────────────────
// 유입경로/학력/취득사유/반응포인트 정규화 + 태그 분해.
// ComboExplorer(조합 분석)·ManagerMatcher(담당자 배정 추천)에서 공유한다.

export interface SegmentRecord {
  status: string;
  manager?: string | null;
  click_source: string | null;
  education?: string | null;
  reason?: string | null;
  reaction_point?: string | null;
}

export type AxisKey = "source" | "education" | "reason" | "reaction";

export const AXES: {
  key: AxisKey;
  label: string;
  multi: boolean;
  note?: string;
}[] = [
  { key: "source", label: "유입경로", multi: false },
  { key: "education", label: "학력", multi: false },
  { key: "reason", label: "취득사유", multi: true, note: "복수 선택 항목" },
  {
    key: "reaction",
    label: "반응포인트",
    multi: true,
    note: "입력률 낮음·거절사유 위주",
  },
];

export const NO_VALUE = "미입력";
export const ETC = "기타";

// ── 유입경로 정규화 (page.tsx getMajorSrc 과 동일 규칙) ──
const META_CHANNEL_ALIASES = new Set([
  "메타",
  "meta",
  "인스타",
  "인스타그램",
  "페이스북",
  "페북",
  "인스타·페이스북",
  "인스타/페이스북",
  "페이스북·인스타",
  "인스타,페이스북",
]);
const ETC_CHANNEL_ALIASES = new Set(["주부"]);

export function normSource(source: string | null | undefined): string {
  if (!source) return "바로폼";
  const s = source.startsWith("바로폼_") ? source.slice(4) : source;
  const i = s.indexOf("_");
  const major = (i === -1 ? s : s.slice(0, i)).trim();
  // 메타 계열(인스타·페이스북) → 표준 라벨/아이콘 키와 일치시킴
  if (META_CHANNEL_ALIASES.has(major)) return "인스타·페이스북";
  if (ETC_CHANNEL_ALIASES.has(major)) return ETC;
  return major || "바로폼";
}

// ── 학력 버킷 ──
export function eduBucket(raw: string | null | undefined): string {
  const s = (raw ?? "").replace(/\s/g, "");
  if (!s) return NO_VALUE;
  if (s.includes("중퇴") || s.includes("재학")) return ETC;
  if (s.includes("대학원")) return "대학원";
  if (s.includes("전문대") || s.includes("2년제") || s.includes("3년제"))
    return "전문대졸";
  if (s.includes("고졸") || s.includes("고등학교") || s.includes("검정고시"))
    return "고졸";
  if (
    s.includes("대졸") ||
    s.includes("대학교") ||
    s.includes("4년제") ||
    s.includes("4년")
  )
    return "대졸";
  return ETC;
}

// ── 취득사유 태그 분해 ──
export function reasonTags(raw: string | null | undefined): string[] {
  const n = (raw ?? "").replace(/\s/g, "");
  if (!n) return [];
  const tags: string[] = [];
  if (n.includes("미래")) tags.push("미래준비");
  if (n.includes("즉시")) tags.push("즉시취업");
  if (n.includes("이직")) tags.push("이직");
  if (n.includes("취미")) tags.push("취미");
  if (n.includes("국비")) tags.push("국비지원");
  return tags;
}

// ── 반응포인트 태그 분해 ──
const REACTION_TAGS = [
  "무반응",
  "비싸다",
  "시간부족",
  "교육원의심",
  "비교중",
  "공부부담",
  "취업희망",
  "취업연계",
  "노후대비",
  "자격증효력",
  "거리부담",
  "시간부담",
  "섭외부담",
];
export function reactionTags(raw: string | null | undefined): string[] {
  const n = (raw ?? "").replace(/\s/g, "").replace(/노후준비/g, "노후대비");
  if (!n) return [];
  return REACTION_TAGS.filter((t) => n.includes(t));
}

// ── 레코드 → 축별 값 배열 ──
export function axisValues(rec: SegmentRecord, axis: AxisKey): string[] {
  switch (axis) {
    case "source":
      return [normSource(rec.click_source)];
    case "education":
      return [eduBucket(rec.education)];
    case "reason": {
      const t = reasonTags(rec.reason);
      return t.length ? t : [ETC];
    }
    case "reaction": {
      const t = reactionTags(rec.reaction_point);
      return t.length ? t : [NO_VALUE];
    }
  }
}

export function isRegistered(status: string): boolean {
  return status === "등록완료";
}
