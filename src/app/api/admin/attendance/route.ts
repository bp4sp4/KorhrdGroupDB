import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTodayKstDate, isInvalidRecord } from "@/lib/attendance";

// GET /api/admin/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD&user_id=...
// 관리자: 전체 출퇴근 기록 조회
export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAdmin();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const today = getTodayKstDate();
  const [yStr, mStr] = today.split("-");
  const defaultFrom = `${yStr}-${mStr}-01`;
  const from = searchParams.get("from") || defaultFrom;
  const to = searchParams.get("to") || today;
  const userIdParam = searchParams.get("user_id");

  let query = supabaseAdmin
    .from("attendance_records")
    .select(
      "id, user_id, date, clock_in_at, clock_out_at, recognized_clock_in, recognized_clock_out, work_minutes, overtime_minutes, edited_by_admin, admin_note, created_at, updated_at",
    )
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false })
    .order("user_id", { ascending: true });

  if (userIdParam) {
    const uid = Number(userIdParam);
    if (Number.isFinite(uid)) query = query.eq("user_id", uid);
  }

  const { data: list, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // user 정보 join (id → display_name)
  const userIds = Array.from(
    new Set((list ?? []).map((r) => r.user_id)),
  );
  const { data: users } = userIds.length
    ? await supabaseAdmin
        .from("app_users")
        .select("id, display_name, username, department_id")
        .in("id", userIds)
    : { data: [] as Array<{ id: number; display_name: string | null; username: string | null; department_id: string | null }> };

  const userMap = new Map(
    (users ?? []).map((u) => [u.id, u]),
  );

  const records = (list ?? []).map((r) => {
    const u = userMap.get(r.user_id);
    return {
      ...r,
      is_invalid: isInvalidRecord(r.date, r.clock_out_at, today),
      user_name: u?.display_name ?? u?.username ?? `#${r.user_id}`,
      user_username: u?.username ?? null,
      department_id: u?.department_id ?? null,
    };
  });

  return NextResponse.json({ records, today });
}
