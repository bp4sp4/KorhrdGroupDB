import { NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { calculateAttendance, getTodayKstDate } from "@/lib/attendance";

// POST /api/attendance/clock-in
// 오늘 출근 기록 생성. 이미 출근한 경우 409.
export async function POST() {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const today = getTodayKstDate();
  const nowIso = new Date().toISOString();

  // 이미 오늘 기록이 있으면 차단
  const { data: existing } = await supabaseAdmin
    .from("attendance_records")
    .select("id, clock_out_at")
    .eq("user_id", appUser.id)
    .eq("date", today)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error: existing.clock_out_at
          ? "이미 오늘 출퇴근을 마쳤습니다."
          : "이미 출근 처리되었습니다.",
      },
      { status: 409 },
    );
  }

  const calc = calculateAttendance(nowIso, null, today);

  const { data, error } = await supabaseAdmin
    .from("attendance_records")
    .insert({
      user_id: appUser.id,
      date: today,
      clock_in_at: nowIso,
      recognized_clock_in: calc.recognizedClockIn,
      work_minutes: 0,
      overtime_minutes: 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
