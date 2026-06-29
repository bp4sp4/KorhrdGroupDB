import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTodayKstDate, isInvalidRecord } from "@/lib/attendance";
import { autoCloseStaleRecords } from "@/lib/attendance-server";
import {
  expandLeaveCredit,
  isVacationDocType,
  leaveCreditsFromTransaction,
} from "@/lib/leave/workCredit";

// GET /api/attendance/me?from=YYYY-MM-DD&to=YYYY-MM-DD
// from~to 사이 본인 기록 + 오늘 상태 반환. 파라미터 생략 시 이번 달.
export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const today = getTodayKstDate();

  // 자정 경과한 미퇴근 기록을 정규 퇴근 시각(KST)으로 자동 마감 (조회 이전 처리)
  await autoCloseStaleRecords(appUser.id, today);

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

  // ── 승인된 휴가 → 근무 인정(날짜별) + 사용 내역(건별) ──────────────────
  // 연차/경조/예비군/병가 = 종일(8h), 반차 = 4h. 주말 제외.
  // 같은 날 실제 출퇴근 기록이 있으면 근무 인정은 중복 방지로 제외(사용 내역엔 표시).
  const recordedDays = new Set((list ?? []).map((r) => r.date));
  const { data: leaveApprovals } = await supabaseAdmin
    .from("approvals")
    .select("document_type, content")
    .eq("status", "APPROVED")
    .eq("applicant_id", appUser.id)
    .ilike("document_type", "%휴가%")
    .lte("content->>vacation_start", to)
    .gte("content->>vacation_end", from);

  const leaves: { date: string; leave_type: string; minutes: number }[] = [];
  const leaveUsages: {
    start: string;
    end: string;
    type: string;
    days: number;
  }[] = [];
  let leaveMinutes = 0;
  let leaveDays = 0;

  for (const lv of leaveApprovals ?? []) {
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
    let usageDays = 0;
    let inRange = false;
    for (const cr of credits) {
      if (cr.date < from || cr.date > to) continue;
      inRange = true;
      usageDays += cr.days;
      if (!recordedDays.has(cr.date)) {
        leaves.push({
          date: cr.date,
          leave_type: c.vacation_type ?? "휴가",
          minutes: cr.minutes,
        });
        leaveMinutes += cr.minutes;
        leaveDays += cr.days;
      }
    }
    if (inRange && c.vacation_start) {
      leaveUsages.push({
        start: c.vacation_start,
        end: c.vacation_end ?? c.vacation_start,
        type: c.vacation_type ?? "휴가",
        days: usageDays,
      });
    }
  }

  // 결재 없이 leave_transactions 에만 있는 차감(관리자 수동 차감 등)도 휴가로 인정.
  // reason 텍스트에서 날짜를 파싱한다. approvals 와 중복 방지.
  const creditedDates = new Set(leaves.map((l) => l.date));
  const { data: leaveTxs } = await supabaseAdmin
    .from("leave_transactions")
    .select("delta, reason, created_at")
    .eq("user_id", appUser.id)
    .is("approval_id", null)
    .lte("delta", 0)
    .order("created_at", { ascending: false })
    .limit(500);

  for (const tx of leaveTxs ?? []) {
    const credits = leaveCreditsFromTransaction(tx.reason, tx.created_at);
    if (!credits.length) continue;
    const dates = credits.map((c) => c.date).sort();
    let usageDays = 0;
    let inRange = false;
    let leaveType = "휴가";
    for (const cr of credits) {
      if (cr.date < from || cr.date > to) continue;
      inRange = true;
      usageDays += cr.days;
      leaveType = cr.leave_type ?? "휴가";
      if (!recordedDays.has(cr.date) && !creditedDates.has(cr.date)) {
        leaves.push({
          date: cr.date,
          leave_type: cr.leave_type ?? "휴가",
          minutes: cr.minutes,
        });
        leaveMinutes += cr.minutes;
        leaveDays += cr.days;
        creditedDates.add(cr.date);
      }
    }
    if (inRange) {
      leaveUsages.push({
        start: dates[0],
        end: dates[dates.length - 1],
        type: leaveType,
        days: usageDays,
      });
    }
  }
  leaveUsages.sort((a, b) => b.start.localeCompare(a.start));

  // 통계 (해당 범위) — 휴가 근무 인정 포함
  const totalWork =
    records.reduce((sum, r) => sum + (r.work_minutes ?? 0), 0) + leaveMinutes;
  const totalOvertime = records.reduce(
    (sum, r) => sum + (r.overtime_minutes ?? 0),
    0,
  );
  const invalidCount = records.filter((r) => r.is_invalid).length;

  return NextResponse.json({
    today,
    todayRecord,
    records,
    leaves,
    leave_usages: leaveUsages,
    summary: {
      totalWorkMinutes: totalWork,
      totalOvertimeMinutes: totalOvertime,
      invalidCount,
      daysWorked: records.filter((r) => r.clock_out_at).length + leaveDays,
    },
  });
}
