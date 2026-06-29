// 서버 전용 — supabaseAdmin 사용
//
// 미퇴근(clock_out_at = NULL) 기록을 자정 이후 시점에 자동으로 마감 처리한다.
// 정책:
//   - 23:59 안에 퇴근을 누르면 야근(19:30 이후) 정상 인정 (기존 동작)
//   - 자정이 지나도록 퇴근을 누르지 않으면 해당 일자 19:00 KST 로 자동 퇴근 처리
//     → 19:00 < 19:30 이므로 야근 0
//
// 호출 지점:
//   - GET /api/attendance/me           — 본인 기록 조회 직전
//   - POST /api/attendance/clock-in    — 새 일자 출근 직전
//
// 단순성을 위해 본인 user_id 범위만 처리. (관리자 화면에서 다인 일괄 처리하려면
// 별도 admin 라우트에서 호출자가 user_id 목록을 전달해 호출.)

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  calculateAttendance,
  kstDateAt,
  resolveWorkHours,
  type WorkHours,
} from "@/lib/attendance";

interface StaleRecord {
  id: number;
  date: string;
  clock_in_at: string;
}

interface DeptRef {
  code: string | null;
  name: string | null;
}

// department_id → { code, name } 조회 (근무시간 프로필 판정용)
export async function getDepartmentById(
  departmentId: string | null | undefined,
): Promise<DeptRef | null> {
  if (!departmentId) return null;
  const { data } = await supabaseAdmin
    .from("departments")
    .select("code, name")
    .eq("id", departmentId)
    .maybeSingle();
  return data ?? null;
}

// department_id + 날짜(KST) (+ 사용자) → 적용 근무시간 프로필
export async function resolveWorkHoursByDepartmentId(
  departmentId: string | null | undefined,
  dateKst: string,
  userId?: number | null,
): Promise<WorkHours> {
  const dept = await getDepartmentById(departmentId);
  return resolveWorkHours(dept, dateKst, userId);
}

// user_id → 소속 부서 { code, name } 조회
export async function getDepartmentByUserId(
  userId: number,
): Promise<DeptRef | null> {
  const { data: u } = await supabaseAdmin
    .from("app_users")
    .select("department_id")
    .eq("id", userId)
    .maybeSingle();
  return getDepartmentById(u?.department_id ?? null);
}

// user_id + 날짜(KST) → 적용 근무시간 프로필
export async function resolveWorkHoursByUserId(
  userId: number,
  dateKst: string,
): Promise<WorkHours> {
  const dept = await getDepartmentByUserId(userId);
  return resolveWorkHours(dept, dateKst, userId);
}

const AUTO_CLOSE_NOTE = "자정 경과 — 자동 퇴근 처리 (정규 퇴근 시각, 야근 없음)";

// 특정 user_id 의 미퇴근 stale 기록을 19:00 KST 로 자동 마감
//   - dateKst <  todayKst  AND clock_out_at IS NULL  대상
//   - 이미 admin 이 편집한 기록(edited_by_admin = true)은 보호
export async function autoCloseStaleRecords(
  userId: number,
  todayKst: string,
): Promise<number> {
  const { data: stale } = await supabaseAdmin
    .from("attendance_records")
    .select("id, date, clock_in_at, edited_by_admin")
    .eq("user_id", userId)
    .lt("date", todayKst)
    .is("clock_out_at", null);

  if (!stale || stale.length === 0) return 0;

  // 사용자 소속 부서 1회 조회 (근무시간 프로필 판정용)
  const dept = await getDepartmentByUserId(userId);

  let closed = 0;
  for (const rec of stale as (StaleRecord & { edited_by_admin: boolean })[]) {
    // 관리자가 손댄 행은 자동으로 덮어쓰지 않음
    if (rec.edited_by_admin) continue;

    // 부서·날짜·사용자별 정규 퇴근 시각 (사업본부 18:00 / 나머지 19:00)
    const workHours = resolveWorkHours(dept, rec.date, userId);
    const autoOut = kstDateAt(rec.date, workHours.endHour, 0);
    const clockIn = new Date(rec.clock_in_at);
    // 엣지: 정규 퇴근 시각보다 늦게 출근한 경우 work_minutes 가 음수가 되지 않게 clock_in 으로 고정
    const effOut = autoOut.getTime() < clockIn.getTime() ? clockIn : autoOut;
    const effOutIso = effOut.toISOString();

    const calc = calculateAttendance(rec.clock_in_at, effOutIso, rec.date, workHours);

    const { error } = await supabaseAdmin
      .from("attendance_records")
      .update({
        clock_out_at: effOutIso,
        recognized_clock_out: calc.recognizedClockOut,
        work_minutes: calc.workMinutes,
        overtime_minutes: calc.overtimeMinutes,
        admin_note: AUTO_CLOSE_NOTE,
      })
      .eq("id", rec.id);

    if (!error) closed += 1;
  }

  return closed;
}
