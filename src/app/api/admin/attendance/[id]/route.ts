import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { calculateAttendance } from "@/lib/attendance";
import { resolveWorkHoursByUserId } from "@/lib/attendance-server";

// PATCH /api/admin/attendance/[id]
// body: { clock_in_at?: ISO, clock_out_at?: ISO | null, admin_note?: string }
// 관리자: 출퇴근 시각 수정 — 인정시간/근무분/야근분 자동 재계산
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { errorResponse } = await requireAdmin();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: "잘못된 id" }, { status: 400 });
  }

  const body = (await request.json()) as {
    clock_in_at?: string;
    clock_out_at?: string | null;
    admin_note?: string;
  };

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from("attendance_records")
    .select("id, user_id, date, clock_in_at, clock_out_at")
    .eq("id", numericId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return NextResponse.json(
      { error: "기록을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const newIn =
    typeof body.clock_in_at === "string" && body.clock_in_at
      ? body.clock_in_at
      : existing.clock_in_at;
  const newOut =
    body.clock_out_at === null
      ? null
      : typeof body.clock_out_at === "string" && body.clock_out_at
        ? body.clock_out_at
        : existing.clock_out_at;

  const workHours = await resolveWorkHoursByUserId(
    existing.user_id,
    existing.date,
  );
  const calc = calculateAttendance(newIn, newOut, existing.date, workHours);

  const update: Record<string, unknown> = {
    clock_in_at: newIn,
    clock_out_at: newOut,
    recognized_clock_in: calc.recognizedClockIn,
    recognized_clock_out: calc.recognizedClockOut,
    work_minutes: calc.workMinutes,
    overtime_minutes: calc.overtimeMinutes,
    edited_by_admin: true,
  };
  if (typeof body.admin_note === "string") {
    update.admin_note = body.admin_note;
  }

  const { data, error } = await supabaseAdmin
    .from("attendance_records")
    .update(update)
    .eq("id", numericId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/admin/attendance/[id]
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { errorResponse } = await requireAdmin();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: "잘못된 id" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("attendance_records")
    .delete()
    .eq("id", numericId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
