import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTodayKstDate, isInvalidRecord } from "@/lib/attendance";
import {
  expandLeaveCredit,
  isVacationDocType,
  leaveCreditsFromTransaction,
  type LeaveCreditDay,
} from "@/lib/leave/workCredit";

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
      is_leave: false as boolean,
      leave_type: null as string | null,
      user_name: u?.display_name ?? u?.username ?? `#${r.user_id}`,
      user_username: u?.username ?? null,
      department_id: u?.department_id ?? null,
    };
  });

  // ── 승인된 휴가를 가상 "휴가" 행으로 추가 (특정 직원 조회 시) ───────────
  // 출근일수/정규시간 인정과 동일 기준.
  // 같은 날짜에 실제 출퇴근 기록이 있으면 가상 행 대신 해당 기록에 휴가 종류를 표시
  // (반차 후 출근한 날 등 — 근무시간 중복 인정은 하지 않음).
  const leaveRows: typeof records = [];
  if (userIdParam) {
    const uid = Number(userIdParam);
    if (Number.isFinite(uid)) {
      const recordedDays = new Set(
        (list ?? []).map((r) => r.date),
      );
      const u = userMap.get(uid);
      const creditedDates = new Set<string>();
      const leaveTypeByDate = new Map<string, string>();
      const pushLeaveRow = (cr: LeaveCreditDay) => {
        if (cr.date < from || cr.date > to) return;
        if (creditedDates.has(cr.date)) return;
        creditedDates.add(cr.date);
        leaveTypeByDate.set(cr.date, cr.leave_type ?? "휴가");
        if (recordedDays.has(cr.date)) return;
        leaveRows.push({
          id: -1,
          user_id: uid,
          date: cr.date,
          clock_in_at: null as unknown as string,
          clock_out_at: null,
          recognized_clock_in: null as unknown as string,
          recognized_clock_out: null,
          work_minutes: cr.minutes,
          overtime_minutes: 0,
          edited_by_admin: false,
          admin_note: null,
          created_at: null as unknown as string,
          updated_at: null as unknown as string,
          is_invalid: false,
          is_leave: true,
          leave_type: cr.leave_type ?? "휴가",
          user_name: u?.display_name ?? u?.username ?? `#${uid}`,
          user_username: u?.username ?? null,
          department_id: u?.department_id ?? null,
        });
      };

      // 1) 결재 승인 휴가 (approvals)
      const { data: leaves } = await supabaseAdmin
        .from("approvals")
        .select("document_type, content")
        .eq("status", "APPROVED")
        .eq("applicant_id", uid)
        .ilike("document_type", "%휴가%")
        .lte("content->>vacation_start", to)
        .gte("content->>vacation_end", from);

      for (const lv of leaves ?? []) {
        if (!isVacationDocType(lv.document_type)) continue;
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
        for (const cr of credits) pushLeaveRow(cr);
      }

      // 2) 결재 없이 leave_transactions 에만 있는 차감(관리자 수동 차감 등)
      const createdLb = new Date(`${from}T00:00:00Z`);
      createdLb.setUTCDate(createdLb.getUTCDate() - 90);
      const { data: leaveTxs } = await supabaseAdmin
        .from("leave_transactions")
        .select("delta, reason, created_at")
        .eq("user_id", uid)
        .is("approval_id", null)
        .lte("delta", 0)
        .gte("created_at", createdLb.toISOString())
        .limit(500);

      for (const tx of leaveTxs ?? []) {
        const credits = leaveCreditsFromTransaction(tx.reason, tx.created_at);
        for (const cr of credits) pushLeaveRow(cr);
      }

      // 실제 출퇴근 기록이 있는 날의 휴가는 해당 기록 행에 종류만 표시
      if (leaveTypeByDate.size) {
        for (const r of records) {
          const lt = leaveTypeByDate.get(r.date);
          if (lt) r.leave_type = lt;
        }
      }
    }
  }

  // 실제 기록 + 휴가 가상행 합쳐 날짜 내림차순 정렬
  const merged = [...records, ...leaveRows].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );

  return NextResponse.json({ records: merged, today });
}
