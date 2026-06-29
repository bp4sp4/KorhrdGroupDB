import { NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { calculateAttendance, getTodayKstDate } from "@/lib/attendance";
import { resolveWorkHoursByDepartmentId } from "@/lib/attendance-server";
import { syncConsultAvailability } from "@/lib/presence/consultAvailability";

// POST /api/attendance/clock-out
// 오늘 출근 기록에 퇴근 시각 + 계산값 업데이트
export async function POST() {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const today = getTodayKstDate();
  const nowIso = new Date().toISOString();

  const { data: existing } = await supabaseAdmin
    .from("attendance_records")
    .select("id, clock_in_at, clock_out_at, date")
    .eq("user_id", appUser.id)
    .eq("date", today)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { error: "오늘 출근 기록이 없습니다. 먼저 출근하기를 눌러주세요." },
      { status: 400 },
    );
  }
  if (existing.clock_out_at) {
    return NextResponse.json(
      { error: "이미 퇴근 처리되었습니다." },
      { status: 409 },
    );
  }

  const workHours = await resolveWorkHoursByDepartmentId(
    appUser.department_id,
    today,
    appUser.id,
  );
  const calc = calculateAttendance(
    existing.clock_in_at,
    nowIso,
    today,
    workHours,
  );

  const { data, error } = await supabaseAdmin
    .from("attendance_records")
    .update({
      clock_out_at: nowIso,
      recognized_clock_out: calc.recognizedClockOut,
      work_minutes: calc.workMinutes,
      overtime_minutes: calc.overtimeMinutes,
    })
    .eq("id", existing.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 퇴근 → 영업 상담 불가 자동 전환 (영업팀원만)
  await syncConsultAvailability(appUser.id, false);

  return NextResponse.json(data);
}
