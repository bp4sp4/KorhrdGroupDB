// 휴가(연차/반차/경조/예비군/병가)를 근태 "근무 인정"으로 환산하는 유틸.
// - 근태관리에서 승인된 휴가일을 출근일수 / 정규근무시간으로 인정해 주기 위함.
// - 잔여 휴가 차감(applyVacationDeduction)과는 별개의 개념이다.
//   · 차감: 연차 1.0 / 반차 0.5 / 경조·예비군·병가 0 (휴가 잔여에서 빼는 양)
//   · 근무 인정: 연차·경조·예비군·병가 = 종일(1일/8h), 반차 = 0.5일/4h
//
// 정규 근무 8시간(=480분)은 attendance.ts 의 10:00~19:00 - 점심 1h 정의와 동일.

import {
  WORK_START_HOUR,
  WORK_END_HOUR,
  LUNCH_START_HOUR,
  LUNCH_END_HOUR,
} from "@/lib/attendance";

// 정규 근무 1일 분 (점심 제외) = (19-10-1) * 60 = 480분
export const FULL_DAY_WORK_MINUTES =
  (WORK_END_HOUR -
    WORK_START_HOUR -
    (LUNCH_END_HOUR - LUNCH_START_HOUR)) *
  60;
// 반차 = 정규의 절반 (240분)
export const HALF_DAY_WORK_MINUTES = FULL_DAY_WORK_MINUTES / 2;

export interface LeaveCreditDay {
  date: string; // YYYY-MM-DD (KST)
  days: number; // 출근일 인정 (1 또는 0.5)
  minutes: number; // 정규근무 인정 분
  leave_type?: string; // 휴가 종류 (연차/반차 등)
}

// "휴가신청서" document_type 정규화 비교용
export function isVacationDocType(docType: string | null | undefined): boolean {
  return (docType ?? "").replace(/\s/g, "") === "휴가신청서";
}

function isHalfDay(type: string): boolean {
  return type === "반차(오전)" || type === "반차(오후)";
}

// YYYY-MM-DD 문자열 → UTC 자정 Date (타임존 독립적으로 요일/날짜 계산용)
function ymdToUtc(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

function utcToYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function isWeekendUtc(d: Date): boolean {
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6; // 일(0), 토(6)
}

/**
 * 휴가 1건을 날짜별 근무 인정으로 펼친다. 주말(토/일)은 제외.
 * - 반차(오전/오후): 시작일 하루만 0.5일 / 4h
 * - 그 외(연차/경조휴가/예비군/병가 등 종일): 기간 내 각 평일 1일 / 8h
 * - 휴가 종류/시작일이 없으면 빈 배열
 */
export function expandLeaveCredit(
  vacationType: string | null | undefined,
  start: string | null | undefined,
  end: string | null | undefined,
): LeaveCreditDay[] {
  const type = (vacationType ?? "").trim();
  if (!type || !start) return [];

  if (isHalfDay(type)) {
    const s = ymdToUtc(start);
    if (!s || isWeekendUtc(s)) return [];
    return [
      { date: start, days: 0.5, minutes: HALF_DAY_WORK_MINUTES, leave_type: type },
    ];
  }

  const s = ymdToUtc(start);
  const e = end ? ymdToUtc(end) : s;
  if (!s || !e) return [];

  return weekdaysInclusive(start, end ?? start).map((date) => ({
    date,
    days: 1,
    minutes: FULL_DAY_WORK_MINUTES,
    leave_type: type,
  }));
}

// start~end(포함) 사이의 평일(월~금) 날짜 목록
function weekdaysInclusive(start: string, end: string): string[] {
  const s = ymdToUtc(start);
  const e = end ? ymdToUtc(end) : s;
  if (!s || !e) return [];
  const out: string[] = [];
  const cur = new Date(s.getTime());
  let guard = 0;
  while (cur.getTime() <= e.getTime() && guard < 366) {
    if (!isWeekendUtc(cur)) out.push(utcToYmd(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
    guard += 1;
  }
  return out;
}

// 사유 텍스트에서 휴가 종류 추정
function guessLeaveType(reason: string): string {
  if (reason.includes("반차(오전)")) return "반차(오전)";
  if (reason.includes("반차(오후)")) return "반차(오후)";
  if (reason.includes("반차")) return "반차";
  if (reason.includes("연차")) return "연차";
  if (reason.includes("경조")) return "경조휴가";
  if (reason.includes("예비군")) return "예비군";
  if (reason.includes("병가")) return "병가";
  return "휴가";
}

/**
 * leave_transactions 의 reason/created_at 으로부터 휴가 사용 날짜·종류 파싱.
 * 두 가지 형식 지원:
 *  A. "{종류} 사용 (YYYY-MM-DD~YYYY-MM-DD)"  — 결재/자동 차감 형식
 *  B. 자유 텍스트 "6월 1일, 6월 2일 연차"     — 관리자 수동 차감 (연도는 created_at 기준)
 * 날짜를 추출하지 못하면 null.
 */
export function parseLeaveTransaction(
  reason: string | null | undefined,
  createdAtIso: string | null | undefined,
): { type: string; dates: string[]; isHalf: boolean } | null {
  const r = reason ?? "";
  if (!r) return null;
  const type = guessLeaveType(r);
  const isHalf = type.startsWith("반차");

  // 형식 A: (YYYY-MM-DD~YYYY-MM-DD)
  const rangeM = r.match(
    /\((\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})\)/,
  );
  if (rangeM) {
    if (isHalf) return { type, dates: [rangeM[1]], isHalf };
    const dates = weekdaysInclusive(rangeM[1], rangeM[2]);
    return { type, dates, isHalf };
  }

  // 형식 B: 한글 "N월 N일" (복수 가능)
  const year = Number((createdAtIso ?? "").slice(0, 4));
  if (Number.isFinite(year) && year > 1900) {
    const kr = [...r.matchAll(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)];
    if (kr.length) {
      const dates = kr.map(
        (m) =>
          `${year}-${String(Number(m[1])).padStart(2, "0")}-${String(
            Number(m[2]),
          ).padStart(2, "0")}`,
      );
      if (isHalf) return { type, dates: [dates[0]], isHalf };
      return { type, dates, isHalf };
    }
  }
  return null;
}

/**
 * leave_transactions 한 건(reason)을 날짜별 근무 인정으로 변환.
 * - 반차: 0.5일 / 4h, 그 외: 1일 / 8h
 */
export function leaveCreditsFromTransaction(
  reason: string | null | undefined,
  createdAtIso: string | null | undefined,
): LeaveCreditDay[] {
  const parsed = parseLeaveTransaction(reason, createdAtIso);
  if (!parsed) return [];
  const minutes = parsed.isHalf
    ? HALF_DAY_WORK_MINUTES
    : FULL_DAY_WORK_MINUTES;
  const days = parsed.isHalf ? 0.5 : 1;
  return parsed.dates.map((date) => ({
    date,
    days,
    minutes,
    leave_type: parsed.type,
  }));
}
