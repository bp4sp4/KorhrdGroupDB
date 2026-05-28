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
  WORK_END_HOUR,
} from "@/lib/attendance";

interface StaleRecord {
  id: number;
  date: string;
  clock_in_at: string;
}

const AUTO_CLOSE_NOTE = "자정 경과 — 자동 퇴근 처리 (19:00, 야근 없음)";

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

  let closed = 0;
  for (const rec of stale as (StaleRecord & { edited_by_admin: boolean })[]) {
    // 관리자가 손댄 행은 자동으로 덮어쓰지 않음
    if (rec.edited_by_admin) continue;

    // 19:00 KST 시각 (해당 record 의 date 기준)
    const autoOut = kstDateAt(rec.date, WORK_END_HOUR, 0);
    const clockIn = new Date(rec.clock_in_at);
    // 엣지: 19:00 KST 보다 늦게 출근한 경우 work_minutes 가 음수가 되지 않게 clock_in 으로 고정
    const effOut = autoOut.getTime() < clockIn.getTime() ? clockIn : autoOut;
    const effOutIso = effOut.toISOString();

    const calc = calculateAttendance(rec.clock_in_at, effOutIso, rec.date);

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
