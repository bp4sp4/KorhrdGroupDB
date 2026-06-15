import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getTodayKstDate,
  isInvalidRecord,
  isHalfDayLeave,
  kstDateAt,
  WORK_START_HOUR,
} from "@/lib/attendance";
import {
  expandLeaveCredit,
  isVacationDocType,
  leaveCreditsFromTransaction,
  HALF_DAY_WORK_MINUTES,
  type LeaveCreditDay,
} from "@/lib/leave/workCredit";

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
      "id, user_id, date, clock_in_at, clock_out_at, recognized_clock_in, recognized_clock_out, work_minutes, overtime_minutes",
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

  // ── 승인된 휴가를 근무로 인정 (출근일수 + 정규근무시간) ────────────────
  // 연차/경조/예비군/병가 = 종일(1일·8h), 반차 = 0.5일·4h. 주말 제외.
  // 같은 날짜에 실제 출퇴근 기록이 있으면(반차 후 오후출근 등) 중복 방지로 skip.
  const recordedDays = new Set(
    (records ?? []).map((r) => `${r.user_id}|${r.date}`),
  );
  // (user|date) → 실제 기록 (오후반차 점심 인정 시 인정 출퇴근 참조용)
  const recByUserDate = new Map(
    (records ?? []).map((r) => [`${r.user_id}|${r.date}`, r]),
  );

  const ensureAgg = (userId: number) => {
    let agg = aggMap.get(userId);
    if (!agg) {
      agg = {
        user_id: userId,
        days_worked: 0,
        total_work_minutes: 0,
        total_overtime_minutes: 0,
        late_count: 0,
        invalid_count: 0,
      };
      aggMap.set(userId, agg);
    }
    return agg;
  };

  // 휴가 시작일이 to 이전이고 종료일이 from 이후인(겹치는) 승인 휴가신청서
  const { data: leaves } = await supabaseAdmin
    .from("approvals")
    .select("applicant_id, document_type, content")
    .eq("status", "APPROVED")
    .ilike("document_type", "%휴가%")
    .lte("content->>vacation_start", to)
    .gte("content->>vacation_end", from);

  // user별 휴가 인정 처리된 날짜 (중복 방지)
  const creditedByUser = new Map<number, Set<string>>();
  const creditLeaveDay = (userId: number, cr: LeaveCreditDay) => {
    if (cr.date < from || cr.date > to) return;
    let cset = creditedByUser.get(userId);
    if (!cset) {
      cset = new Set();
      creditedByUser.set(userId, cset);
    }
    if (cset.has(cr.date)) return;
    const key = `${userId}|${cr.date}`;
    if (recordedDays.has(key)) {
      // 실제 출퇴근 기록이 있는 날: 반차면 표준 4시간(240분)으로 보정,
      // 그 외(연차 등)는 기존대로 중복 인정하지 않음.
      if (isHalfDayLeave(cr.leave_type)) {
        const rec = recByUserDate.get(key);
        if (rec) {
          cset.add(cr.date);
          const actual = rec.work_minutes ?? 0;
          ensureAgg(userId).total_work_minutes +=
            HALF_DAY_WORK_MINUTES - actual;
        }
      }
      return;
    }
    cset.add(cr.date);
    const agg = ensureAgg(userId);
    agg.days_worked += cr.days;
    agg.total_work_minutes += cr.minutes;
  };

  for (const lv of leaves ?? []) {
    if (!isVacationDocType(lv.document_type)) continue;
    const applicantId = Number(lv.applicant_id);
    if (!Number.isFinite(applicantId)) continue;
    const c = (lv.content ?? {}) as {
      vacation_type?: string | null;
      vacation_start?: string | null;
      vacation_end?: string | null;
    };
    const credits = expandLeaveCredit(
      c.vacation_type,
      c.vacation_start,
      c.vacation_end,
    );
    for (const cr of credits) creditLeaveDay(applicantId, cr);
  }

  // 결재 없이 leave_transactions 에만 있는 차감(관리자 수동 차감 등)도 인정 — reason 파싱
  const createdLb = new Date(`${from}T00:00:00Z`);
  createdLb.setUTCDate(createdLb.getUTCDate() - 90);
  const { data: leaveTxs } = await supabaseAdmin
    .from("leave_transactions")
    .select("user_id, delta, reason, created_at")
    .is("approval_id", null)
    .lte("delta", 0)
    .gte("created_at", createdLb.toISOString())
    .limit(5000);

  for (const tx of leaveTxs ?? []) {
    const uid = Number(tx.user_id);
    if (!Number.isFinite(uid)) continue;
    const credits = leaveCreditsFromTransaction(tx.reason, tx.created_at);
    for (const cr of credits) creditLeaveDay(uid, cr);
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
