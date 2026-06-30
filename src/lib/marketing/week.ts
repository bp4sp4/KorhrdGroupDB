// 마케팅 채널별 성과 — 주간(월요일 시작) 집계 공용 유틸
// week_start: 해당 주 월요일의 'YYYY-MM-DD' (로컬 기준, 월별 집계와 동일하게 로컬 Date 사용)
// 주간 데이터 시작: 2026-03 첫 월요일

// 주차 데이터 최소 시작 월요일 (2026-03 첫 월요일)
export const WEEK_START_FLOOR = "2026-03-02";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// 임의 날짜가 속한 주의 월요일(YYYY-MM-DD)
export function mondayOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay(); // 0=일 ~ 6=토
  const offset = dow === 0 ? -6 : 1 - dow; // 월요일까지의 보정
  d.setDate(d.getDate() + offset);
  return toYmd(d);
}

// week_start 형식 검증 (YYYY-MM-DD)
export function isValidWeekStart(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d
  );
}

// week_start(월요일) → [start, end) ISO 범위 (end = 다음 주 월요일, exclusive)
export function getWeekRange(weekStart: string): { start: string; end: string } {
  const [y, m, d] = weekStart.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 7);
  return { start: start.toISOString(), end: end.toISOString() };
}

// 직전 주 월요일(YYYY-MM-DD)
export function getPrevWeekStart(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const prev = new Date(y, m - 1, d - 7);
  return toYmd(prev);
}

// 주차 라벨: "M월 N주차" (주 시작 월요일이 그 달의 몇 번째 월요일인지로 산정)
//   · 1~7일 월요일 = 1주차, 8~14일 = 2주차 … (예: 6/29 월요일 → 6월 5주차)
export function formatWeekLabel(weekStart: string): string {
  const [, m, d] = weekStart.split("-").map(Number);
  const weekOfMonth = Math.floor((d - 1) / 7) + 1;
  return `${m}월 ${weekOfMonth}주차`;
}

// 선택 가능한 주차 목록 (이번 주 → 과거, 내림차순). value=week_start, label=표시용
export function buildWeekOptions(): { value: string; label: string }[] {
  const current = mondayOf(new Date());
  const options: { value: string; label: string }[] = [];
  let cursor = current;
  let guard = 0;
  while (cursor >= WEEK_START_FLOOR && guard < 520) {
    options.push({ value: cursor, label: formatWeekLabel(cursor) });
    cursor = getPrevWeekStart(cursor);
    guard += 1;
  }
  return options;
}
