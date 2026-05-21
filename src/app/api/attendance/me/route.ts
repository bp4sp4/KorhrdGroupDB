import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTodayKstDate, isInvalidRecord } from "@/lib/attendance";

// GET /api/attendance/me?from=YYYY-MM-DD&to=YYYY-MM-DD
// from~to 사이 본인 기록 + 오늘 상태 반환. 파라미터 생략 시 이번 달.
export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const today = getTodayKstDate();

  // 기본: 이번 달 1일 ~ 오늘
  const [yStr, mStr] = today.split("-");
  const defaultFrom = `${yStr}-${mStr}-01`;
  const from = searchParams.get("from") || defaultFrom;
  const to = searchParams.get("to") || today;

  const { data: list, error } = await supabaseAdmin
    .from("attendance_records")
    .select(
      "id, date, clock_in_at, clock_out_at, recognized_clock_in, recognized_clock_out, work_minutes, overtime_minutes, edited_by_admin, admin_note, created_at, updated_at",
    )
    .eq("user_id", appUser.id)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const records = (list ?? []).map((r) => ({
    ...r,
    is_invalid: isInvalidRecord(r.date, r.clock_out_at, today),
  }));

  const todayRecord = records.find((r) => r.date === today) ?? null;

  // 통계 (해당 범위)
  const totalWork = records.reduce(
    (sum, r) => sum + (r.work_minutes ?? 0),
    0,
  );
  const totalOvertime = records.reduce(
    (sum, r) => sum + (r.overtime_minutes ?? 0),
    0,
  );
  const invalidCount = records.filter((r) => r.is_invalid).length;

  return NextResponse.json({
    today,
    todayRecord,
    records,
    summary: {
      totalWorkMinutes: totalWork,
      totalOvertimeMinutes: totalOvertime,
      invalidCount,
      daysWorked: records.filter((r) => r.clock_out_at).length,
    },
  });
}
