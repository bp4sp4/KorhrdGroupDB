import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getTodayKstDate,
  isInvalidRecord,
  kstDateAt,
  WORK_START_HOUR,
} from "@/lib/attendance";

// GET /api/admin/attendance/summary?month=YYYY-MM
// 해당 월의 직원별 출퇴근 월간 요약 반환
export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAdmin();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const today = getTodayKstDate();

  // from/to (YYYY-MM-DD) 범위 우선 — 분기/기간 조회 지원. 없으면 month(YYYY-MM) 폴백
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;

  let from: string;
  let to: string;
  let monthParam: string | null = null;

  if (fromParam && toParam && dateRe.test(fromParam) && dateRe.test(toParam)) {
    from = fromParam;
    to = toParam;
  } else {
    monthParam = searchParams.get("month") || today.slice(0, 7); // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json(
        { error: "month는 YYYY-MM, 또는 from/to는 YYYY-MM-DD 형식이어야 합니다." },
        { status: 400 },
      );
    }
    const [yStr, mStr] = monthParam.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    from = `${monthParam}-01`;
    to = `${monthParam}-${String(lastDay).padStart(2, "0")}`;
  }

  const { data: records, error } = await supabaseAdmin
    .from("attendance_records")
    .select(
      "id, user_id, date, clock_in_at, clock_out_at, work_minutes, overtime_minutes",
    )
    .gte("date", from)
    .lte("date", to)
    .order("user_id", { ascending: true })
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 모든 활성 직원 조회 (기록 없는 직원도 0으로 표시)
  const { data: users } = await supabaseAdmin
    .from("app_users")
    .select("id, display_name, username, department_id, role")
    .eq("is_active", true)
    .neq("role", "mini-admin")
    .order("display_name", { ascending: true });

  // 부서 이름 매핑
  const deptIds = Array.from(
    new Set(
      (users ?? [])
        .map((u) => u.department_id)
        .filter((v): v is string => !!v),
    ),
  );
  const { data: depts } = deptIds.length
    ? await supabaseAdmin
        .from("departments")
        .select("id, name")
        .in("id", deptIds)
    : { data: [] as Array<{ id: string; name: string }> };
  const deptMap = new Map((depts ?? []).map((d) => [d.id, d.name]));

  // 사용자 ID 별로 집계
  const aggMap = new Map<
    number,
    {
      user_id: number;
      days_worked: number; // 출근 + 퇴근 완료된 일수
      total_work_minutes: number;
      total_overtime_minutes: number;
      late_count: number; // 10:00 이후 출근한 일수
      invalid_count: number; // 미체크(퇴근 안찍음, 과거 날짜) 일수
    }
  >();

  for (const r of records ?? []) {
    let agg = aggMap.get(r.user_id);
    if (!agg) {
      agg = {
        user_id: r.user_id,
        days_worked: 0,
        total_work_minutes: 0,
        total_overtime_minutes: 0,
        late_count: 0,
        invalid_count: 0,
      };
      aggMap.set(r.user_id, agg);
    }
    if (r.clock_out_at) agg.days_worked += 1;
    agg.total_work_minutes += r.work_minutes ?? 0;
    agg.total_overtime_minutes += r.overtime_minutes ?? 0;

    // 지각: 실제 clock_in_at 이 KST 10:00 이후인지
    const dayStart = kstDateAt(r.date, WORK_START_HOUR);
    if (new Date(r.clock_in_at) > dayStart) agg.late_count += 1;

    // 미체크 (퇴근 미체크 && 과거 날짜)
    if (isInvalidRecord(r.date, r.clock_out_at, today)) {
      agg.invalid_count += 1;
    }
  }

  const summaries = (users ?? []).map((u) => {
    const a = aggMap.get(u.id);
    return {
      user_id: u.id,
      user_name: u.display_name ?? u.username ?? `#${u.id}`,
      user_username: u.username ?? null,
      department_id: u.department_id ?? null,
      department_name: u.department_id
        ? (deptMap.get(u.department_id) ?? null)
        : null,
      role: u.role,
      days_worked: a?.days_worked ?? 0,
      total_work_minutes: a?.total_work_minutes ?? 0,
      total_overtime_minutes: a?.total_overtime_minutes ?? 0,
      late_count: a?.late_count ?? 0,
      invalid_count: a?.invalid_count ?? 0,
    };
  });

  return NextResponse.json({
    month: monthParam,
    from,
    to,
    today,
    summaries,
  });
}
