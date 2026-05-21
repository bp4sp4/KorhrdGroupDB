// 출퇴근 계산 유틸리티
// 근무: 10:00 ~ 19:00 (점심 13:00 ~ 14:00 1시간 제외)
// 야근: 19:30 이후
// 인정 출근: clock_in_at < 10:00 → 10:00 으로 캡 (그 외 실시각)
// 인정 퇴근: 실제 clock_out_at 그대로

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export const WORK_START_HOUR = 10;
export const WORK_END_HOUR = 19;
export const LUNCH_START_HOUR = 13;
export const LUNCH_END_HOUR = 14;
export const OVERTIME_START_HOUR = 19;
export const OVERTIME_START_MIN = 30;

// 현재 KST 날짜 (YYYY-MM-DD)
export function getTodayKstDate(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 임의 timestamp의 KST 날짜
export function toKstDateStr(ts: Date | string): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  const kst = new Date(d.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const mo = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const da = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

// KST 날짜(YYYY-MM-DD) + KST 시각(시,분) → UTC Date
export function kstDateAt(dateStr: string, hour: number, minute = 0): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  // KST 시각을 UTC로 변환: UTC = KST - 9h
  return new Date(Date.UTC(y, m - 1, d, hour - 9, minute));
}

export interface AttendanceCalc {
  recognizedClockIn: string;       // ISO
  recognizedClockOut: string | null;
  workMinutes: number;             // 정규 근무 분 (점심 제외)
  overtimeMinutes: number;         // 야근 분 (19:30 이후)
}

// 출퇴근 시각으로부터 인정시간/근무분/야근분 계산
export function calculateAttendance(
  clockInIso: string,
  clockOutIso: string | null,
  dateKst: string,
): AttendanceCalc {
  const clockIn = new Date(clockInIso);
  const clockOut = clockOutIso ? new Date(clockOutIso) : null;

  const dayStart = kstDateAt(dateKst, WORK_START_HOUR);
  const dayEnd = kstDateAt(dateKst, WORK_END_HOUR);
  const lunchStart = kstDateAt(dateKst, LUNCH_START_HOUR);
  const lunchEnd = kstDateAt(dateKst, LUNCH_END_HOUR);
  const overtimeStart = kstDateAt(
    dateKst,
    OVERTIME_START_HOUR,
    OVERTIME_START_MIN,
  );

  // 인정 출근: 10:00 전이면 10:00 으로 캡
  const recognizedIn = clockIn < dayStart ? dayStart : clockIn;

  if (!clockOut) {
    return {
      recognizedClockIn: recognizedIn.toISOString(),
      recognizedClockOut: null,
      workMinutes: 0,
      overtimeMinutes: 0,
    };
  }

  // 정규 근무 (10:00 ~ 19:00 사이)
  const effStart = recognizedIn > dayStart ? recognizedIn : dayStart;
  const effEnd = clockOut < dayEnd ? clockOut : dayEnd;
  let workMs = effEnd.getTime() > effStart.getTime()
    ? effEnd.getTime() - effStart.getTime()
    : 0;

  // 점심 13:00~14:00 overlap 차감
  const lOverlapStart = effStart > lunchStart ? effStart : lunchStart;
  const lOverlapEnd = effEnd < lunchEnd ? effEnd : lunchEnd;
  if (lOverlapEnd.getTime() > lOverlapStart.getTime()) {
    workMs -= lOverlapEnd.getTime() - lOverlapStart.getTime();
  }
  const workMinutes = Math.max(0, Math.floor(workMs / 60000));

  // 야근 (19:30 이후만 인정)
  let overtimeMs = 0;
  if (clockOut.getTime() > overtimeStart.getTime()) {
    overtimeMs = clockOut.getTime() - overtimeStart.getTime();
  }
  const overtimeMinutes = Math.max(0, Math.floor(overtimeMs / 60000));

  return {
    recognizedClockIn: recognizedIn.toISOString(),
    recognizedClockOut: clockOut.toISOString(),
    workMinutes,
    overtimeMinutes,
  };
}

// 분 → "Xh Ym" 포맷
export function formatMinutes(min: number): string {
  if (!min || min <= 0) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// 퇴근 안 찍은 무효 기록 판정 (today_kst 이전이고 clock_out_at == null)
export function isInvalidRecord(
  dateKst: string,
  clockOutAt: string | null,
  todayKst: string,
): boolean {
  if (clockOutAt) return false;
  return dateKst < todayKst;
}
