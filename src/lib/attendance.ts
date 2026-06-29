// 출퇴근 계산 유틸리티
// 근무: 부서별 — 사업본부(BIZ) 09:00~18:00(점심 12:00~13:00) / 그 외 10:00~19:00(점심 13:00~14:00)
//   · 사업본부 09-18 기준은 2026-07-01 이후 기록부터 적용 (이전은 부서 무관 10-19 유지)
// 야근: 정규 퇴근 + 30분 이후 (사업본부 18:30 / 그 외 19:30)
// 인정 출근: clock_in_at < 정규출근 → 정규출근으로 캡 (그 외 실시각)
// 인정 퇴근: 실제 clock_out_at 그대로

// 퇴근 처리 confirm 다이얼로그 메시지 (근태현황/대시보드/헤더 공통)
// ConfirmDialog 컴포넌트에 그대로 spread 해서 사용
export const CLOCK_OUT_CONFIRM = {
  title: "퇴근 처리 후에는 다음 날 출근 전까지 수정 및 취소가 불가능합니다.",
  description:
    "승인되지 않은 조기 퇴근은 무단 조퇴로 처리될 수 있으며 인사평가에 반영될 수 있습니다.",
  confirmText: "퇴근하기",
  cancelText: "취소",
} as const;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 기본(개발/경영지원본부 등) 근무: 10:00 ~ 19:00
export const WORK_START_HOUR = 10;
export const WORK_END_HOUR = 19;
export const LUNCH_START_HOUR = 13;
export const LUNCH_END_HOUR = 14;
export const OVERTIME_START_HOUR = 19;
export const OVERTIME_START_MIN = 30;

// ── 부서별 근무시간 프로필 ────────────────────────────────────────────────
// 사업본부(BIZ): 09:00~18:00, 점심 12:00~13:00
// 나머지:        10:00~19:00, 점심 13:00~14:00
// 야근 시작 = 퇴근시각 + 30분 (사업본부 18:30 / 나머지 19:30)
export interface WorkHours {
  startHour: number; // 정규 출근 (인정 출근 캡)
  endHour: number; // 정규 퇴근 (정규 근무 종료)
  lunchStartHour: number; // 점심 시작 (근무 차감)
  lunchEndHour: number; // 점심 종료
}

export const DEFAULT_WORK_HOURS: WorkHours = {
  startHour: WORK_START_HOUR,
  endHour: WORK_END_HOUR,
  lunchStartHour: LUNCH_START_HOUR,
  lunchEndHour: LUNCH_END_HOUR,
};

export const BIZ_WORK_HOURS: WorkHours = {
  startHour: 9,
  endHour: 18,
  lunchStartHour: 12,
  lunchEndHour: 13,
};

// 사업본부 9-18 근무 정식 적용 시작일(KST). 이 날짜 이전 기록은 부서와 무관하게
// 기존 10-19 기준을 그대로 유지한다(과거 기록 재계산 왜곡 방지).
export const BIZ_WORK_HOURS_EFFECTIVE_FROM = "2026-07-01";

// 근무시간 개편 파일럿 — 지정 사용자는 정식 적용일보다 먼저 9-18 적용.
//   · 부계정2(test@naver.com, id 17): 2026-06-29부터 선행 테스트
// 정식 전환(2026-07-01) 후에는 이 목록과 무관하게 사업본부 전원에 적용된다.
export const WORK_HOURS_PILOT_USER_IDS: readonly number[] = [17];
export const WORK_HOURS_PILOT_EFFECTIVE_FROM = "2026-06-29";

// 야근 시작 분 (정규 퇴근 후 30분부터 야근 인정)
export const OVERTIME_GRACE_MIN = 30;

// 부서가 사업본부(BIZ)인지 — code === 'BIZ' 또는 이름에 '사업본부' 포함
export function isBizDepartment(
  dept: { code?: string | null; name?: string | null } | null | undefined,
): boolean {
  if (!dept) return false;
  const code = (dept.code ?? "").toUpperCase().replace(/\s+/g, "");
  const name = (dept.name ?? "").replace(/\s+/g, "");
  return code === "BIZ" || name.includes("사업본부");
}

// 부서 + 날짜(KST) (+ 사용자) → 적용 근무시간 프로필
// 사업본부 한정. 정식 적용일(2026-07-01) 이후이거나, 파일럿 사용자가 파일럿
// 시작일 이후이면 9-18. 그 외에는 모두 10-19.
export function resolveWorkHours(
  dept: { code?: string | null; name?: string | null } | null | undefined,
  dateKst: string,
  userId?: number | null,
): WorkHours {
  if (!isBizDepartment(dept)) return DEFAULT_WORK_HOURS;
  const isPilot =
    userId != null &&
    WORK_HOURS_PILOT_USER_IDS.includes(userId) &&
    dateKst >= WORK_HOURS_PILOT_EFFECTIVE_FROM;
  if (dateKst >= BIZ_WORK_HOURS_EFFECTIVE_FROM || isPilot) {
    return BIZ_WORK_HOURS;
  }
  return DEFAULT_WORK_HOURS;
}

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
// workHours: 부서별 근무시간 프로필 (기본 10-19). resolveWorkHours()로 산출.
export function calculateAttendance(
  clockInIso: string,
  clockOutIso: string | null,
  dateKst: string,
  workHours: WorkHours = DEFAULT_WORK_HOURS,
): AttendanceCalc {
  const clockIn = new Date(clockInIso);
  const clockOut = clockOutIso ? new Date(clockOutIso) : null;

  const dayStart = kstDateAt(dateKst, workHours.startHour);
  const dayEnd = kstDateAt(dateKst, workHours.endHour);
  const lunchStart = kstDateAt(dateKst, workHours.lunchStartHour);
  const lunchEnd = kstDateAt(dateKst, workHours.lunchEndHour);
  const overtimeStart = kstDateAt(
    dateKst,
    workHours.endHour,
    OVERTIME_GRACE_MIN,
  );

  // 인정 출근: 정규 출근 시각 전이면 정규 출근으로 캡
  const recognizedIn = clockIn < dayStart ? dayStart : clockIn;

  if (!clockOut) {
    return {
      recognizedClockIn: recognizedIn.toISOString(),
      recognizedClockOut: null,
      workMinutes: 0,
      overtimeMinutes: 0,
    };
  }

  // 정규 근무 (정규 출근 ~ 정규 퇴근 사이)
  const effStart = recognizedIn > dayStart ? recognizedIn : dayStart;
  const effEnd = clockOut < dayEnd ? clockOut : dayEnd;
  let workMs = effEnd.getTime() > effStart.getTime()
    ? effEnd.getTime() - effStart.getTime()
    : 0;

  // 점심 overlap 차감 (부서별 — 사업본부 12~13 / 그 외 13~14)
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

// 반차 표준 근무창 — 점심을 근무로 인정한 4시간(240분) 기준. 시간대는 부서별:
//   · 오후 반차: 오전 근무 → 퇴근 (정규출근+4h)  (그 외 14:00 / 사업본부 13:00)
//   · 오전 반차: 오후 근무 → 출근 (정규퇴근-4h) ~ 퇴근 정규퇴근 (그 외 15:00~19:00 / 사업본부 14:00~18:00)
export function isAfternoonHalfDay(leaveType?: string | null): boolean {
  return (leaveType ?? "").replace(/\s/g, "") === "반차(오후)";
}

export function isMorningHalfDay(leaveType?: string | null): boolean {
  return (leaveType ?? "").replace(/\s/g, "") === "반차(오전)";
}

export function isHalfDayLeave(leaveType?: string | null): boolean {
  return isAfternoonHalfDay(leaveType) || isMorningHalfDay(leaveType);
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
