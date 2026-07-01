"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import styles from "./page.module.css";
import {
  calculateAttendance,
  CLOCK_OUT_CONFIRM,
  formatMinutes,
  getTodayKstDate,
  resolveWorkHours,
  type WorkHours,
} from "@/lib/attendance";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { createClient } from "@/lib/supabase/client";

// ─── 타입 ────────────────────────────────────────────────────────────────
interface AttendanceRec {
  id: number;
  date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  recognized_clock_in: string;
  recognized_clock_out: string | null;
  work_minutes: number;
  overtime_minutes: number;
  edited_by_admin: boolean;
  admin_note: string | null;
  is_invalid: boolean;
}

interface LeaveDay {
  date: string;
  leave_type: string;
  minutes: number;
}

interface LeaveUsage {
  start: string;
  end: string;
  type: string;
  days: number;
}

type RangeKey = "week" | "month" | "year";

// ─── 유틸 ────────────────────────────────────────────────────────────────
function formatTime(iso: string | null): string {
  if (!iso) return "— : —";
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

function formatNowKst(): string {
  return (
    new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Seoul",
    }) + " KST"
  );
}

function todayKstDateKo(): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

function getKstNow(): Date {
  const s = new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" });
  return new Date(s);
}

// 이번주 (월요일 시작) 날짜 7개
function thisWeekDates(): { date: string; weekday: number }[] {
  const kst = getKstNow();
  const dow = kst.getDay();
  const monOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(kst);
  monday.setDate(kst.getDate() + monOffset);
  const arr: { date: string; weekday: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    arr.push({ date: ymd(d), weekday: i });
  }
  return arr;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

// 휴가 기간 표기 — 시작=종료면 단일, 아니면 범위
function fmtLeaveRange(start: string, end: string): string {
  const fmt = (s: string) => {
    const [, m, d] = s.split("-").map(Number);
    return `${m}월 ${d}일`;
  };
  if (!end || end === start) return fmt(start);
  return `${fmt(start)} ~ ${fmt(end)}`;
}

// 이번 달 전체 일 (YYYY-MM-DD[])
function thisMonthDates(): string[] {
  const kst = getKstNow();
  const y = kst.getFullYear();
  const m = kst.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const arr: string[] = [];
  for (let i = 1; i <= lastDay; i++) {
    arr.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`);
  }
  return arr;
}

// 올해 12개월 (YYYY-MM[])
function thisYearMonths(): string[] {
  const y = getKstNow().getFullYear();
  return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
}

// 분 → "Xh Ym" 짧게
function shortHM(min: number): string {
  if (!min || min <= 0) return "0";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

// 분 → "Xh" / "Xh Ym" (0분이면 시만) — 달력 칩·주차 합계용
function hm(min: number): string {
  if (!min || min <= 0) return "0h";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// 달력용: 이번 달을 포함하는 월~일 주 단위 그리드 (앞뒤 달 넘침 포함)
function monthCalendarWeeks(
  today: string,
): { date: string; dayNum: number; inMonth: boolean; dow: number }[][] {
  const [y, m] = today.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const startDow = first.getDay(); // 0=일 … 6=토
  const startOffset = startDow === 0 ? -6 : 1 - startDow; // 그 주 월요일로
  const cur = new Date(y, m - 1, 1 + startOffset);
  const weeks: { date: string; dayNum: number; inMonth: boolean; dow: number }[][] = [];
  while (true) {
    const week: { date: string; dayNum: number; inMonth: boolean; dow: number }[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({
        date: ymd(cur),
        dayNum: cur.getDate(),
        inMonth: cur.getMonth() === m - 1,
        dow: cur.getDay(),
      });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    if (cur > last) break;
  }
  return weeks;
}

// 월 이동 — anchor(YYYY-MM-DD)를 delta개월 이동한 그 달 1일
function shiftMonth(anchor: string, delta: number): string {
  const [y, m] = anchor.split("-").map(Number);
  return ymd(new Date(y, m - 1 + delta, 1));
}

// anchor → "YYYY-MM"
function monthKey(anchor: string): string {
  const [y, m] = anchor.split("-");
  return `${y}-${m}`;
}

// 날짜 → 요일 한글
function weekdayKo(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
}

// CSV 다운로드 (BOM 포함 — 엑셀에서 한글 정상 표시)
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function hoursFromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${String(m).padStart(2, "0")}분`;
}

// 평균 출근 시각 (records 대상)
function avgClockInString(records: AttendanceRec[]): string {
  const valid = records.filter((r) => r.clock_in_at);
  if (valid.length === 0) return "—";
  let totalMin = 0;
  for (const r of valid) {
    const d = new Date(r.clock_in_at);
    const kstStr = d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Seoul",
    });
    const [h, m] = kstStr.split(":").map(Number);
    totalMin += h * 60 + m;
  }
  const avg = Math.floor(totalMin / valid.length);
  const h = Math.floor(avg / 60);
  const m = avg % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 지각 (부서·사용자별 정규 출근 시각 이후 출근) — 사업본부 09:00 / 그 외 10:00
function lateCount(
  records: AttendanceRec[],
  dept: { code?: string | null; name?: string | null } | null,
  userId: number | null,
): number {
  let count = 0;
  for (const r of records) {
    const d = new Date(r.clock_in_at);
    const kstStr = d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Seoul",
    });
    const [h, m] = kstStr.split(":").map(Number);
    const { startHour } = resolveWorkHours(dept, r.date, userId);
    if (h > startHour || (h === startHour && m > 0)) count += 1;
  }
  return count;
}

// 오늘 실시간 누적 근무 분
function liveWorkMinutes(
  today: AttendanceRec | null,
  todayDate: string,
  workHours: WorkHours,
): number {
  if (!today) return 0;
  if (today.clock_out_at) return today.work_minutes ?? 0;
  return calculateAttendance(
    today.clock_in_at,
    new Date().toISOString(),
    todayDate,
    workHours,
  ).workMinutes;
}

// 오늘 실시간 누적 근무 초 (시:분:초 표시용)
function liveWorkSeconds(
  today: AttendanceRec | null,
  todayDate: string,
  workHours: WorkHours,
): number {
  if (!today) return 0;
  if (today.clock_out_at) return (today.work_minutes ?? 0) * 60;
  // 점심 시간 제외하면서 초 단위로
  const clockIn = new Date(today.clock_in_at);
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  const [y, m, d] = todayDate.split("-").map(Number);
  const dayStartUtcMs = Date.UTC(y, m - 1, d, workHours.startHour - 9, 0);
  const dayEndUtcMs = Date.UTC(y, m - 1, d, workHours.endHour - 9, 0);
  const lunchStartMs = Date.UTC(y, m - 1, d, workHours.lunchStartHour - 9, 0);
  const lunchEndMs = Date.UTC(y, m - 1, d, workHours.lunchEndHour - 9, 0);
  // recognized in: max(actual, 정규 출근)
  const recIn = Math.max(clockIn.getTime(), dayStartUtcMs);
  const nowMs = Date.now();
  const effStart = Math.max(recIn, dayStartUtcMs);
  const effEnd = Math.min(nowMs, dayEndUtcMs);
  let workMs = effEnd > effStart ? effEnd - effStart : 0;
  const lOverlapStart = Math.max(effStart, lunchStartMs);
  const lOverlapEnd = Math.min(effEnd, lunchEndMs);
  if (lOverlapEnd > lOverlapStart) workMs -= lOverlapEnd - lOverlapStart;
  void KST_OFFSET;
  return Math.max(0, Math.floor(workMs / 1000));
}

// 초 → "Xh Ym Zs"
function formatHMS(totalSec: number): string {
  if (totalSec <= 0) return "0초";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0)
    return `${h}시간 ${String(m).padStart(2, "0")}분 ${String(s).padStart(2, "0")}초`;
  if (m > 0) return `${m}분 ${String(s).padStart(2, "0")}초`;
  return `${s}초`;
}

function remainingUntilOff(workHours: WorkHours): string {
  const kst = getKstNow();
  const h = kst.getHours();
  const m = kst.getMinutes();
  const remainMin = workHours.endHour * 60 - (h * 60 + m);
  if (remainMin <= 0) return "정시 퇴근 시간 지남";
  return `${Math.floor(remainMin / 60)}시간 ${String(remainMin % 60).padStart(2, "0")}분 남음`;
}

// range별 API fetch 범위
function rangeFetch(range: RangeKey, today: string): { from: string; to: string } {
  const [y, m] = today.split("-");
  if (range === "week") {
    const dates = thisWeekDates();
    return { from: dates[0].date, to: dates[6].date };
  }
  if (range === "month") {
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    return {
      from: `${y}-${m}-01`,
      to: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
    };
  }
  // year
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

// range별 라벨
function rangeRangeLabel(range: RangeKey, monthAnchor?: string): string {
  const today = getTodayKstDate();
  if (range === "week") {
    const dates = thisWeekDates();
    const [y1, m1, d1] = dates[0].date.split("-");
    const [y2, m2, d2] = dates[6].date.split("-");
    return `${y1}년 ${Number(m1)}월 ${Number(d1)}일 (월) ~ ${y2 !== y1 ? `${y2}년 ` : ""}${Number(m2)}월 ${Number(d2)}일 (일)`;
  }
  if (range === "month") {
    const [y, m] = (monthAnchor ?? today).split("-");
    return `${y}년 ${Number(m)}월`;
  }
  return `${today.slice(0, 4)}년`;
}

// ─── 메인 ────────────────────────────────────────────────────────────────
export default function MyAttendancePage() {
  const today = getTodayKstDate();

  // 근태현황은 월간 뷰만 사용 (주/년 뷰 제거)
  const range = "month" as RangeKey;
  // 월간 뷰에서 조회 중인 달 (해당 달의 임의 날짜) — 이전/다음 달 이동용
  const [monthAnchor, setMonthAnchor] = useState(today);
  const [records, setRecords] = useState<AttendanceRec[]>([]);
  const [leaves, setLeaves] = useState<LeaveDay[]>([]);
  const [leaveUsages, setLeaveUsages] = useState<LeaveUsage[]>([]);
  const [userName, setUserName] = useState("");
  // 소속 부서 (근무시간 프로필 판정용) — 사업본부는 09:00~18:00
  const [dept, setDept] = useState<{
    code: string | null;
    name: string | null;
  } | null>(null);
  // 본인 user id (근무시간 파일럿 판정용)
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);
  // 항상 "이번 주" 기준 누적 (range 와 무관) — 주 52시간 한도 표시용
  const [weekStat, setWeekStat] = useState<{ work: number; ot: number }>({
    work: 0,
    ot: 0,
  });

  // 실시간 시계 (1초마다 — 누적 근무시간 초 단위 갱신)
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const anchor = range === "month" ? monthAnchor : today;
      const { from, to } = rangeFetch(range, anchor);
      const weekDates = thisWeekDates();
      const weekFrom = weekDates[0].date;
      const weekTo = weekDates[6].date;
      const [meRes, attRes, weekRes] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch(`/api/attendance/me?from=${from}&to=${to}`, { cache: "no-store" }),
        // range 가 week 와 다르면 별도 fetch (week 이면 같은 데이터 재사용)
        range === "week"
          ? Promise.resolve(null)
          : fetch(`/api/attendance/me?from=${weekFrom}&to=${weekTo}`, {
              cache: "no-store",
            }),
      ]);
      if (meRes.ok) {
        const meData = await meRes.json();
        setUserName(meData.displayName ?? "");
        setDept({
          code: meData.departmentCode ?? null,
          name: meData.departmentName ?? null,
        });
        setUserId(typeof meData.id === "number" ? meData.id : null);
      }
      if (attRes.ok) {
        const data = await attRes.json();
        setRecords(data.records ?? []);
        setLeaves(data.leaves ?? []);
        setLeaveUsages(data.leave_usages ?? []);
        if (range === "week") {
          const rs = (data.records ?? []) as AttendanceRec[];
          setWeekStat({
            work: rs.reduce((s, r) => s + (r.work_minutes ?? 0), 0),
            ot: rs.reduce((s, r) => s + (r.overtime_minutes ?? 0), 0),
          });
        }
      }
      if (weekRes && weekRes.ok) {
        const wd = await weekRes.json();
        const rs = (wd.records ?? []) as AttendanceRec[];
        setWeekStat({
          work: rs.reduce((s, r) => s + (r.work_minutes ?? 0), 0),
          ot: rs.reduce((s, r) => s + (r.overtime_minutes ?? 0), 0),
        });
      }
    } finally {
      setLoading(false);
    }
  }, [range, today, monthAnchor]);

  useEffect(() => {
    fetchAll();
    // 같은 탭(헤더 출퇴근 버튼 등) 즉시 동기화
    const onChanged = () => fetchAll();
    window.addEventListener("attendance-changed", onChanged);
    return () => window.removeEventListener("attendance-changed", onChanged);
  }, [fetchAll]);

  // 30초마다 자동 데이터 갱신 (외부 변경 — 관리자 수정 등 — 감지 백업용)
  useEffect(() => {
    const t = setInterval(() => {
      fetchAll();
    }, 30_000);
    return () => clearInterval(t);
  }, [fetchAll]);

  // Supabase Realtime — attendance_records 변경 시 즉시 fetch
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("attendance-records-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        () => {
          fetchAll();
        },
      )
      .subscribe((status, err) => {
        if (err) console.log("[attendance] subscribe error:", err);
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const todayRecord = useMemo(
    () => records.find((r) => r.date === today) ?? null,
    [records, today],
  );

  // 휴가 인정(날짜별) 맵 + 범위 내 휴가 인정 총 분
  const leaveMap = useMemo(() => {
    const m = new Map<string, { type: string; minutes: number }>();
    for (const l of leaves) m.set(l.date, { type: l.leave_type, minutes: l.minutes });
    return m;
  }, [leaves]);
  const leaveMinutes = useMemo(
    () => leaves.reduce((s, l) => s + (l.minutes ?? 0), 0),
    [leaves],
  );

  const handleCheckIn = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/attendance/clock-in", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "출근 처리 실패");
      } else {
        await fetchAll();
        window.dispatchEvent(new Event("attendance-changed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = () => {
    if (submitting) return;
    setShowClockOutConfirm(true);
  };

  const confirmClockOut = async () => {
    setShowClockOutConfirm(false);
    setSubmitting(true);
    try {
      const res = await fetch("/api/attendance/clock-out", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "퇴근 처리 실패");
      } else {
        await fetchAll();
        window.dispatchEvent(new Event("attendance-changed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 현재 조회 범위의 일별 근무 내역을 CSV로 다운로드
  const handleDownload = () => {
    const dateSet = new Set<string>();
    records.forEach((r) => dateSet.add(r.date));
    leaves.forEach((l) => dateSet.add(l.date));
    const dates = [...dateSet].sort();
    const statusOf = (
      rec: AttendanceRec | undefined,
      lv: { type: string; minutes: number } | undefined,
    ): string => {
      if (!rec && lv) return lv.type;
      if (rec?.is_invalid) return "퇴근 미체크";
      if ((rec?.overtime_minutes ?? 0) > 0) return "야근";
      return "정상";
    };
    const rows: (string | number)[][] = [
      ["날짜", "요일", "출근", "퇴근", "인정 출근", "인정 퇴근", "정규", "야근", "상태"],
      ...dates.map((d) => {
        const rec = records.find((r) => r.date === d);
        const lv = leaveMap.get(d);
        const wd = weekdayKo(d);
        // 엑셀이 날짜/시간으로 자동 변환(→ ####)하지 않도록 텍스트로 고정
        const asText = (v: string) => (v ? `="${v}"` : "");
        if (!rec && lv) {
          return [asText(d), wd, "", "", "", "", hm(lv.minutes), "", statusOf(rec, lv)];
        }
        return [
          asText(d),
          wd,
          asText(rec ? formatTime(rec.clock_in_at) : ""),
          asText(rec?.clock_out_at ? formatTime(rec.clock_out_at) : ""),
          asText(rec ? formatTime(rec.recognized_clock_in) : ""),
          asText(rec?.recognized_clock_out ? formatTime(rec.recognized_clock_out) : ""),
          rec ? hm(rec.work_minutes ?? 0) : "",
          rec && (rec.overtime_minutes ?? 0) > 0 ? hm(rec.overtime_minutes) : "",
          statusOf(rec, lv),
        ];
      }),
    ];
    const periodKey =
      range === "month"
        ? monthKey(monthAnchor)
        : range === "year"
          ? monthAnchor.slice(0, 4)
          : thisWeekDates()[0].date;
    downloadCsv(`근태_${userName || "내근무"}_${periodKey}.csv`, rows);
  };

  // ─── 헤로 ─────────────────────────────────────────────────────────────
  // 오늘 적용 근무시간 프로필 (사업본부 09:00~18:00, 그 외 10:00~19:00)
  const todayWorkHours = resolveWorkHours(dept, today, userId);
  const liveMin = liveWorkMinutes(todayRecord, today, todayWorkHours);
  const liveSec = liveWorkSeconds(todayRecord, today, todayWorkHours);
  const isWorking = !!todayRecord && !todayRecord.clock_out_at;
  const checkInTime = todayRecord ? formatTime(todayRecord.clock_in_at) : null;
  const checkOutTime = todayRecord?.clock_out_at
    ? formatTime(todayRecord.clock_out_at)
    : null;
  const remainingText = remainingUntilOff(todayWorkHours);

  // ─── 통계 (range 적용) ──────────────────────────────────────────────
  // 근무시간: 실제 근무 + 휴가 근무 인정분
  const totalWork =
    records.reduce((s, r) => s + (r.work_minutes ?? 0), 0) + leaveMinutes;
  const totalOt = records.reduce((s, r) => s + (r.overtime_minutes ?? 0), 0);
  const avgIn = avgClockInString(records);
  const late = lateCount(records, dept, userId);

  // 주간 진행률 (week 모드에서만 의미있음)
  const weeklyGoalMin = 40 * 60;
  const weekProgress = Math.min(100, Math.round((totalWork / weeklyGoalMin) * 100));

  // 월간은 조회 중인 달 기준 라벨 (예: "3월") — 이전 달 조회 시 "이번 달" 오표기 방지
  const viewingCurrentMonth = monthKey(monthAnchor) === monthKey(today);
  const monthWord = viewingCurrentMonth
    ? "이번 달"
    : `${Number(monthAnchor.split("-")[1])}월`;
  // 지난달(마감된 달) 리포트 히어로용 값
  const monthNum = Number(monthAnchor.split("-")[1]);
  const daysWorked = records.filter((r) => r.clock_out_at).length;
  const avgWorkMin = daysWorked > 0 ? Math.round(totalWork / daysWorked) : 0;
  const rangeLabel: Record<RangeKey, string> = {
    week: "이번 주",
    month: monthWord,
    year: "올해",
  };

  // ─── 차트 데이터 빌드 ──────────────────────────────────────────────
  type Bar = {
    label: string;
    hoursLabel: string;
    workPct: number;
    otPct: number;
    breakPct: number;
    state: "today" | "off" | "planned" | "normal";
    tooltip?: string;
  };

  const dailyMax = 600; // 10시간 = 100%

  const buildDailyBar = (
    date: string,
    label: string,
    isWeekendFn?: boolean,
  ): Bar => {
    const rec = records.find((r) => r.date === date);
    const isFuture = date > today;
    const isWeekend = isWeekendFn ?? false;
    const isToday = date === today;

    if (!rec) {
      // 실제 기록이 없는 날 — 휴가 인정이 있으면 휴가 막대로 표시
      const lv = leaveMap.get(date);
      if (lv) {
        const workPct = Math.min(100, Math.round((lv.minutes / dailyMax) * 100));
        return {
          label,
          hoursLabel: lv.type.startsWith("반차") ? "반차" : lv.type,
          workPct,
          otPct: 0,
          breakPct: 0,
          state: isToday ? "today" : "normal",
          tooltip: `${lv.type} · ${shortHM(lv.minutes)} 인정`,
        };
      }
      if (isWeekend || isFuture) {
        return {
          label,
          hoursLabel: isWeekend ? "휴무" : "예정",
          workPct: isFuture && !isWeekend ? 78 : 0,
          otPct: 0,
          breakPct: isFuture && !isWeekend ? 8 : 0,
          state: isWeekend ? "off" : "planned",
        };
      }
      return {
        label,
        hoursLabel: "미출근",
        workPct: 0,
        otPct: 0,
        breakPct: 0,
        state: "off",
      };
    }

    const isCurrentlyWorking = isToday && !rec.clock_out_at;
    const displayWorkMin = isCurrentlyWorking ? liveMin : rec.work_minutes ?? 0;
    const displayOtMin = rec.overtime_minutes ?? 0;
    const displayTotal = isCurrentlyWorking
      ? liveMin
      : displayWorkMin + displayOtMin;

    const workPct = Math.min(100, Math.round((displayTotal / dailyMax) * 100));
    const otPct =
      displayTotal > 0 ? Math.round((displayOtMin / dailyMax) * 100) : 0;
    const breakPct = displayWorkMin > 0 ? 8 : 0;

    let hoursLabel: string;
    if (isCurrentlyWorking) hoursLabel = "진행중";
    else if (rec.is_invalid) hoursLabel = "미체크";
    else if (rec.clock_out_at) hoursLabel = shortHM(displayTotal);
    else hoursLabel = "—";

    return {
      label,
      hoursLabel,
      workPct,
      otPct,
      breakPct,
      state: isToday ? "today" : "normal",
      tooltip: rec.is_invalid
        ? "퇴근 미체크"
        : isCurrentlyWorking
          ? `진행 중 · ${shortHM(displayTotal)}`
          : `${shortHM(rec.work_minutes ?? 0)}${rec.overtime_minutes > 0 ? ` · ${shortHM(rec.overtime_minutes)} 야근` : ""}`,
    };
  };

  // range별 bars 빌드
  let bars: Bar[] = [];
  let smallLabel = false;

  if (range === "week") {
    const dates = thisWeekDates();
    const labels = ["월", "화", "수", "목", "금", "토", "일"];
    bars = dates.map(({ date, weekday }) =>
      buildDailyBar(date, labels[weekday], weekday >= 5),
    );
  } else if (range === "month") {
    smallLabel = true;
    const dates = thisMonthDates();
    bars = dates.map((d) => {
      const [, , da] = d.split("-");
      const dt = new Date(d);
      const dow = dt.getDay();
      return buildDailyBar(d, String(Number(da)), dow === 0 || dow === 6);
    });
  } else {
    // year: 12 monthly bars
    smallLabel = true;
    const months = thisYearMonths();
    const monthLabels = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
    bars = months.map((ym, i) => {
      const monthRecs = records.filter((r) => r.date.startsWith(ym));
      const monthLeaveMin = leaves
        .filter((l) => l.date.startsWith(ym))
        .reduce((s, l) => s + (l.minutes ?? 0), 0);
      const w =
        monthRecs.reduce((s, r) => s + (r.work_minutes ?? 0), 0) + monthLeaveMin;
      const ot = monthRecs.reduce((s, r) => s + (r.overtime_minutes ?? 0), 0);
      const totalMin = w + ot;
      // 월간 최대 = 30일 × 480 = 14400분
      const maxMin = 30 * 480;
      const workPct = Math.min(100, Math.round((totalMin / maxMin) * 100));
      const otPct = totalMin > 0 ? Math.round((ot / maxMin) * 100) : 0;
      const isCurrent = ym === today.slice(0, 7);
      const isFuture = ym > today.slice(0, 7);
      if (monthRecs.length === 0 && monthLeaveMin === 0) {
        return {
          label: monthLabels[i],
          hoursLabel: isFuture ? "예정" : "-",
          workPct: 0,
          otPct: 0,
          breakPct: 0,
          state: isFuture ? ("planned" as const) : ("off" as const),
        };
      }
      return {
        label: monthLabels[i],
        hoursLabel: `${Math.floor(totalMin / 60)}h`,
        workPct,
        otPct,
        breakPct: 0,
        state: isCurrent ? ("today" as const) : ("normal" as const),
        tooltip: `${shortHM(w)} 근무 · ${shortHM(ot)} 야근`,
      };
    });
  }

  const chartGridCls =
    range === "month" ? styles.chartMonth
    : range === "year" ? styles.chartYear
    : "";

  // 통계 카드 라벨 동적
  const workStatLabel =
    range === "week" ? "이번 주 근무"
    : range === "month" ? `${monthWord} 근무`
    : "올해 근무";
  const otStatLabel =
    range === "week" ? "이번 주 야근"
    : range === "month" ? `${monthWord} 야근`
    : "올해 야근";
  const lateStatUnit =
    range === "week" ? "회 / 이번 주"
    : range === "month" ? `회 / ${monthWord}`
    : "회 / 올해";

  return (
    <div className={styles.app}>
      <div className={styles.page}>
        <main className={styles.center}>
          {/* head */}
          <div className={styles.head}>
            <div>
              <h1>근태현황</h1>
              <div className={styles.sub}>
                <span className={styles.live} />
                {todayKstDateKo()} ·{" "}
                {isWorking
                  ? "지금 근무 중"
                  : todayRecord?.clock_out_at
                    ? "퇴근 완료"
                    : "출근 전"}
              </div>
            </div>
            <div className={styles.controls}>
              {range === "month" && (
                <div className={styles.monthNav}>
                  <button
                    className={styles.monthNavBtn}
                    onClick={() => setMonthAnchor((a) => shiftMonth(a, -1))}
                    aria-label="이전 달"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <span className={styles.monthNavLabel}>
                    {monthKey(monthAnchor)}
                  </span>
                  <button
                    className={styles.monthNavBtn}
                    onClick={() => setMonthAnchor((a) => shiftMonth(a, 1))}
                    aria-label="다음 달"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                  {monthKey(monthAnchor) !== monthKey(today) && (
                    <button
                      className={styles.monthNavToday}
                      onClick={() => setMonthAnchor(today)}
                    >
                      오늘
                    </button>
                  )}
                </div>
              )}
              <button className={styles.downloadBtn} onClick={handleDownload}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M7 10l5 5 5-5" />
                  <path d="M12 15V3" />
                </svg>
                {`${Number(monthAnchor.split("-")[1])}월 근무 다운받기`}
              </button>
            </div>
          </div>

          {/* HERO — 이번 달은 오늘 출퇴근, 지난달은 마감 리포트 */}
          {!viewingCurrentMonth ? (
            <section className={styles.hero}>
              <div className={styles.heroL}>
                <div className={styles.eyebrow}>
                  <span className={styles.liveDot} />
                  {monthNum}월 근무 리포트 · 마감됨
                </div>
                <div className={styles.greet}>
                  {userName ? `${userName}님, ` : ""}{monthNum}월 한 달 수고하셨어요.
                  <br />
                  {monthNum}월에 총 <em>{hoursFromMinutes(totalWork)}</em> 일하셨어요.
                </div>
                <div className={styles.nowLine}>
                  근무 {daysWorked}일 · 평균 출근 {avgIn} · 지각 {late}회
                </div>
              </div>

              <div className={styles.heroR}>
                <div className={styles.punchPair}>
                  <div className={styles.punch}>
                    <div className={styles.punchK}>총 근무시간</div>
                    <div className={styles.punchV}>
                      {Math.floor(totalWork / 60)}
                      <span className={styles.punchSm}>
                        시간 {String(totalWork % 60).padStart(2, "0")}분
                      </span>
                    </div>
                    <div className={styles.punchMeta}>{monthNum}월 합계</div>
                  </div>
                  <div className={styles.punch}>
                    <div className={styles.punchK}>평균 근무</div>
                    <div className={styles.punchV}>
                      {Math.floor(avgWorkMin / 60)}
                      <span className={styles.punchSm}>
                        시간 {String(avgWorkMin % 60).padStart(2, "0")}분
                      </span>
                    </div>
                    <div className={styles.punchMeta}>근무일 기준</div>
                  </div>
                </div>
                <div className={styles.status}>
                  <span className={styles.statusPip} />
                  <div className={styles.statusTxt}>
                    <em>마감된 달</em>이라 출퇴근 기록은 변경할 수 없어요. 수정이
                    필요하면 관리자에게 문의하세요.
                  </div>
                </div>
              </div>
            </section>
          ) : (
          <section className={styles.hero}>
            <div className={styles.heroL}>
              <div className={styles.eyebrow}>
                <span className={styles.liveDot} />
                {isWorking ? "근무 중" : "출근 대기"} · {formatNowKst()}
              </div>
              <div className={styles.greet}>
                {userName ? `${userName}님, ` : ""}오늘도 수고하고 계세요.
                <br />
                지금까지{" "}
                <em>
                  {todayRecord && !todayRecord.clock_out_at
                    ? formatHMS(liveSec)
                    : hoursFromMinutes(liveMin)}
                </em>{" "}
                일하셨어요.
              </div>
              <div className={styles.nowLine}>
                {todayKstDateKo().split(" ").pop()}
              </div>

              <div className={styles.actions}>
                {todayRecord ? (
                  <button
                    className={`${styles.secondary} ${styles.secondaryDone}`}
                    disabled
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                    출근 완료
                  </button>
                ) : (
                  <button
                    className={styles.secondary}
                    onClick={handleCheckIn}
                    disabled={submitting}
                  >
                    출근하기
                  </button>
                )}
                <button
                  className={styles.primary}
                  onClick={handleCheckOut}
                  disabled={!isWorking || submitting}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="m9 11 3 3 7-7" />
                    <path d="M3 12a9 9 0 1 0 9-9" />
                  </svg>
                  퇴근하기
                </button>
              </div>
            </div>

            <div className={styles.heroR}>
              <div className={styles.punchPair}>
                <div className={`${styles.punch} ${!checkInTime ? styles.punchPending : ""}`}>
                  <div className={styles.punchK}>출근</div>
                  <div className={styles.punchV}>{checkInTime ?? "— : —"}</div>
                  <div className={styles.punchMeta}>
                    {checkInTime && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    )}
                    {todayRecord
                      ? `인정 ${formatTime(todayRecord.recognized_clock_in)}`
                      : "출근 전"}
                  </div>
                </div>
                <div className={`${styles.punch} ${!checkOutTime ? styles.punchPending : ""}`}>
                  <div className={styles.punchK}>퇴근</div>
                  <div className={styles.punchV}>{checkOutTime ?? "— : —"}</div>
                  <div className={styles.punchMeta}>
                    {checkOutTime && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    )}
                    {checkOutTime
                      ? `근무 ${formatMinutes(todayRecord?.work_minutes ?? 0)}`
                      : `예정 ${String(todayWorkHours.endHour).padStart(2, "0")}:00 · ${remainingText}`}
                  </div>
                </div>
              </div>
              <div className={styles.status}>
                <span className={styles.statusPip} />
                <div className={styles.statusTxt}>
                  {isWorking ? (
                    <>
                      현재 <em>근무 중</em> · 정시 퇴근까지 {remainingText.replace(" 남음", "")} 남았어요
                    </>
                  ) : todayRecord?.clock_out_at ? (
                    <>
                      오늘 <em>퇴근 완료</em> · 정규 {formatMinutes(todayRecord.work_minutes)} / 야근 {formatMinutes(todayRecord.overtime_minutes)}
                    </>
                  ) : (
                    <>
                      아직 <em>출근 전</em>이에요. 출근 버튼을 눌러주세요.
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
          )}

          {/* STATS */}
          <section className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statTop}>
                <div className={styles.statK}>{workStatLabel}</div>
                <div className={`${styles.statIco} ${styles.statIcoBlue}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                  </svg>
                </div>
              </div>
              <div className={styles.statV}>
                {Math.floor(totalWork / 60)}
                <span className={styles.statUnit}>
                  시간 {String(totalWork % 60).padStart(2, "0")}분
                </span>
              </div>
              <div className={`${styles.statDelta} ${styles.statDeltaNeutral}`}>
                {range === "week" ? `목표 40시간 · ${weekProgress}%` : `${rangeLabel[range]} 합계`}
              </div>
            </div>

            <div className={styles.stat}>
              <div className={styles.statTop}>
                <div className={styles.statK}>평균 출근</div>
                <div className={`${styles.statIco} ${styles.statIcoGreen}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M3 12a9 9 0 1 0 9-9" /><path d="m9 11 3 3 7-7" />
                  </svg>
                </div>
              </div>
              <div className={styles.statV}>
                {avgIn}
                <span className={styles.statUnit}>{avgIn !== "—" && Number(avgIn.split(":")[0]) < 12 ? "AM" : avgIn === "—" ? "" : "PM"}</span>
              </div>
              <div className={`${styles.statDelta} ${styles.statDeltaNeutral}`}>
                {rangeLabel[range]} 평균
              </div>
            </div>

            <div className={styles.stat}>
              <div className={styles.statTop}>
                <div className={styles.statK}>지각</div>
                <div className={`${styles.statIco} ${styles.statIcoOrange}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v4l3 2" />
                  </svg>
                </div>
              </div>
              <div className={styles.statV}>
                {late}
                <span className={styles.statUnit}>{lateStatUnit}</span>
              </div>
              <div className={`${styles.statDelta} ${late > 0 ? styles.statDeltaDown : styles.statDeltaNeutral}`}>
                {late === 0 ? "정시 출근 유지 중" : "10:00 이후 출근"}
              </div>
            </div>

            <div className={styles.stat}>
              <div className={styles.statTop}>
                <div className={styles.statK}>{otStatLabel}</div>
                <div className={`${styles.statIco} ${styles.statIcoPurple}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
              </div>
              <div className={styles.statV}>
                {Math.floor(totalOt / 60)}
                <span className={styles.statUnit}>
                  시간 {String(totalOt % 60).padStart(2, "0")}분
                </span>
              </div>
              <div className={`${styles.statDelta} ${styles.statDeltaUp}`}>
                {rangeLabel[range]} 누적
              </div>
            </div>
          </section>

          {/* 주 52시간 한도 진행률 (항상 이번 주 기준) — 월간 뷰에서는 숨김 */}
          {range !== "month" && (() => {
            // 출근 중인 동안엔 DB에 work_minutes이 아직 0이므로 라이브 분을 더해
            // 출근 즉시 진행률(및 work.mp4)이 표시되도록 한다
            const weekTotalMin = weekStat.work + weekStat.ot + (isWorking ? liveMin : 0);
            const LEGAL_MAX = 52 * 60; // 3120분
            const NORMAL_MAX = 40 * 60; // 2400분
            // 막대 시각화: 0~LEGAL_MAX 를 100% 로 매핑, 초과분은 별도 빨간 strip
            const pctFill = Math.min(
              100,
              (weekTotalMin / LEGAL_MAX) * 100,
            );
            const isOver = weekTotalMin > LEGAL_MAX;
            const overPct = isOver
              ? Math.min(100, ((weekTotalMin - LEGAL_MAX) / LEGAL_MAX) * 100)
              : 0;
            const normalMarkerPct = (NORMAL_MAX / LEGAL_MAX) * 100; // 76.92%

            const status: "ok" | "warn" | "danger" =
              isOver
                ? "danger"
                : weekTotalMin >= NORMAL_MAX
                  ? "warn"
                  : "ok";
            const fillCls =
              status === "warn"
                ? styles.legalBarFillWarn
                : status === "danger"
                  ? styles.legalBarFillDanger
                  : "";
            const badgeCls =
              status === "warn"
                ? styles.legalRightBadgeWarn
                : status === "danger"
                  ? styles.legalRightBadgeDanger
                  : "";
            const statusText =
              status === "danger"
                ? `법정 한도 초과 +${formatMinutes(weekTotalMin - LEGAL_MAX)}`
                : status === "warn"
                  ? `야근 영역 · 한도까지 ${formatMinutes(LEGAL_MAX - weekTotalMin)}`
                  : `정규 진행 중 · 40h까지 ${formatMinutes(NORMAL_MAX - weekTotalMin)}`;

            return (
              <section className={styles.legalBanner}>
                <div className={styles.legalTop}>
                  <div>
                    <span className={styles.legalTitle}>주 52시간 한도</span>
                  </div>
                  <div className={styles.legalRight}>
                    <span className={`${styles.legalRightBadge} ${badgeCls}`}>
                      {statusText}
                    </span>
                  </div>
                </div>

                <div className={styles.legalBarWrap}>
                  <div className={styles.legalBar}>
                    <div
                      className={`${styles.legalBarFill} ${fillCls}`}
                      style={{
                        width: `${pctFill}%`,
                      }}
                    />
                  </div>
                  {(isWorking || todayRecord?.clock_out_at) && (
                    <video
                      key={isWorking ? "work" : "finish"}
                      className={styles.legalBarVideo}
                      src={isWorking ? "/work.mp4" : "/finish.mp4"}
                      style={{ left: `calc(${pctFill}% - 24px)` }}
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  )}
                  {isOver && (
                    <div
                      className={styles.legalBarOver}
                      style={{
                        left: `100%`,
                        width: `${overPct}%`,
                        marginLeft: -2,
                      }}
                    />
                  )}
                  <div
                    className={styles.legalMarker}
                    style={{ left: `${normalMarkerPct}%` }}
                  />
                  <div
                    className={styles.legalMarkerLabel}
                    style={{ left: `${normalMarkerPct}%` }}
                  >
                    40h 정규
                  </div>
                  <div
                    className={styles.legalMarker}
                    style={{ left: `100%` }}
                  />
                  <div
                    className={styles.legalMarkerLabelRight}
                    style={{ left: `100%` }}
                  >
                    52h 법정 한도
                  </div>
                </div>

                <div className={styles.legalBottom}>
                  <span className={styles.legalBottomLabel}>이번 주 누적</span>
                  <span className={styles.legalBottomStrong}>
                    {hoursFromMinutes(weekTotalMin)}
                  </span>
                </div>

                <div className={styles.legalMeta}>
                  <span>
                    <span
                      className={styles.legalMetaDot}
                      style={{ background: "#3182f6" }}
                    />
                    정규 {formatMinutes(weekStat.work)}
                  </span>
                  <span>
                    <span
                      className={styles.legalMetaDot}
                      style={{ background: "#ff9500" }}
                    />
                    야근 {formatMinutes(weekStat.ot)}
                  </span>
                  <span style={{ marginLeft: "auto", color: "#8b95a1" }}>
                    근로기준법 주 40h 정규 + 12h 야근 = 52h 한도
                  </span>
                </div>
              </section>
            );
          })()}

          {/* RANGE CHART */}
          <section className={styles.week}>
            <div className={styles.panelHead}>
              <div>
                <div className={styles.panelT}>
                  {range === "week"
                    ? "이번 주 근무 시간"
                    : range === "month"
                      ? "월간 근무 달력"
                      : "올해 월별 근무"}
                </div>
                <div className={styles.panelS}>
                  {rangeRangeLabel(range, monthAnchor)}
                </div>
              </div>
              {range === "month" && (
                <div className={styles.monthNav}>
                  <button
                    className={styles.monthNavBtn}
                    onClick={() => setMonthAnchor((a) => shiftMonth(a, -1))}
                    aria-label="이전 달"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <span className={styles.monthNavLabel}>
                    {monthKey(monthAnchor)}
                  </span>
                  <button
                    className={styles.monthNavBtn}
                    onClick={() => setMonthAnchor((a) => shiftMonth(a, 1))}
                    aria-label="다음 달"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                  {monthKey(monthAnchor) !== monthKey(today) && (
                    <button
                      className={styles.monthNavToday}
                      onClick={() => setMonthAnchor(today)}
                    >
                      오늘
                    </button>
                  )}
                </div>
              )}
            </div>

            {range === "month" ? (
              <>
                {/* 월간 달력 그리드 — 일별 출퇴근 시각·야근·주차별 합계 */}
                <div className={styles.cal}>
                  <div className={`${styles.calHead} ${styles.calHeadFirst}`}>
                    주차별 근로시간
                  </div>
                  {["월", "화", "수", "목", "금", "토", "일"].map((w, i) => (
                    <div
                      key={w}
                      className={`${styles.calHead} ${i === 6 ? styles.calHeadSun : ""} ${i === 5 ? styles.calHeadSat : ""}`}
                    >
                      {w}
                    </div>
                  ))}
                  {monthCalendarWeeks(monthAnchor).flatMap((week, wi) => {
                    let weekWork = 0;
                    let weekOt = 0;
                    for (const d of week) {
                      const rec = records.find((r) => r.date === d.date);
                      if (!rec) continue;
                      const isWorkingDay = d.date === today && !rec.clock_out_at;
                      weekWork += isWorkingDay
                        ? liveMin
                        : (rec.work_minutes ?? 0) + (rec.overtime_minutes ?? 0);
                      weekOt += rec.overtime_minutes ?? 0;
                    }
                    return [
                      <div key={`w${wi}`} className={styles.calWeekCell}>
                        <span className={styles.calWeekVal}>
                          {hm(weekWork)}
                        </span>
                        {weekOt > 0 && (
                          <span className={styles.calWeekOt}>
                            야근 {hm(weekOt)}
                          </span>
                        )}
                      </div>,
                      ...week.map((d) => {
                        const rec = records.find((r) => r.date === d.date);
                        const lv = leaveMap.get(d.date);
                        const isToday = d.date === today;
                        const isSun = d.dow === 0;
                        const isSat = d.dow === 6;
                        const isWeekend = isSun || isSat;
                        const isWorking = isToday && !!rec && !rec.clock_out_at;
                        const workMin = rec
                          ? isWorking
                            ? liveMin
                            : rec.work_minutes ?? 0
                          : 0;
                        const otMin = rec ? rec.overtime_minutes ?? 0 : 0;
                        return (
                          <div
                            key={d.date}
                            className={`${styles.calCell} ${!d.inMonth ? styles.calCellOut : ""} ${isToday ? styles.calCellToday : ""} ${isWeekend ? styles.calCellWeekend : ""}`}
                          >
                            <div className={styles.calCellTop}>
                              <span
                                className={`${styles.calDayNum} ${isSun ? styles.calDayNumSun : ""} ${isSat ? styles.calDayNumSat : ""}`}
                              >
                                {d.dayNum}
                              </span>
                              {isWeekend && !rec && !lv && (
                                <span className={styles.calHoliday}>휴일</span>
                              )}
                            </div>
                            {rec && (
                              <>
                                <span className={styles.calWorkChip}>
                                  {isWorking ? "진행중" : hm(workMin)}
                                </span>
                                <div className={styles.calTimes}>
                                  <span>출 {formatTime(rec.clock_in_at)}</span>
                                  {rec.clock_out_at && (
                                    <span>퇴 {formatTime(rec.clock_out_at)}</span>
                                  )}
                                </div>
                                {otMin > 0 && (
                                  <span className={styles.calOtChip}>
                                    야근 {hm(otMin)}
                                  </span>
                                )}
                              </>
                            )}
                            {!rec && lv && (
                              <span className={styles.calLeaveChip}>
                                {hm(lv.minutes)}{" "}
                                {lv.type.startsWith("반차") ? "반차" : lv.type}
                              </span>
                            )}
                          </div>
                        );
                      }),
                    ];
                  })}
                </div>

                <div className={styles.chartLegend}>
                  <div className={styles.lg}>
                    <span className={styles.lgSw} style={{ background: "#15803d" }} />
                    근무
                  </div>
                  <div className={styles.lg}>
                    <span className={styles.lgSw} style={{ background: "#7c3aed" }} />
                    야근
                  </div>
                  <div className={styles.lg}>
                    <span className={styles.lgSw} style={{ background: "#3182f6" }} />
                    휴가
                  </div>
                  <div className={styles.lg}>
                    <span className={styles.lgSw} style={{ background: "#c4ccd4" }} />
                    휴일
                  </div>
                  <div className={`${styles.lg} ${styles.lgGoal}`}>
                    {monthWord} 야근 {hm(totalOt)} 누적
                  </div>
                </div>
              </>
            ) : (
              <>
            <div className={`${styles.chart} ${chartGridCls}`}>
              {bars.map((d, i) => {
                const off = d.state === "off";
                const planned = d.state === "planned";
                const isToday = d.state === "today";
                const weekend = d.label === "토" || d.label === "일";

                if (off) {
                  return (
                    <div
                      key={i}
                      className={`${styles.barCol} ${styles.barColOff} ${weekend ? styles.barColWeekend : ""}`}
                    >
                      <div className={styles.bars} />
                      <div className={styles.barLabel}>
                        <div className={`${styles.barD} ${smallLabel ? styles.barDSm : ""}`}>
                          {d.label}
                        </div>
                        <div className={styles.barH}>{d.hoursLabel}</div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={i}
                    className={`${styles.barCol} ${isToday ? styles.barColToday : ""} ${weekend ? styles.barColWeekend : ""}`}
                  >
                    {d.tooltip && (
                      <div className={styles.barTooltip}>{d.tooltip}</div>
                    )}
                    <div
                      className={styles.bars}
                      style={{
                        height: `${d.workPct}%`,
                        opacity: planned ? 0.35 : 1,
                      }}
                    >
                      {d.otPct > 0 && (
                        <div
                          className={styles.segOt}
                          style={{ height: `${d.otPct}%` }}
                        />
                      )}
                      <div className={styles.segWork} style={{ flex: 1 }} />
                      {d.breakPct > 0 && (
                        <div
                          className={styles.segBreak}
                          style={{ height: `${d.breakPct}%` }}
                        />
                      )}
                    </div>
                    <div className={styles.barLabel}>
                      <div className={`${styles.barD} ${smallLabel ? styles.barDSm : ""}`}>
                        {d.label}
                      </div>
                      <div className={styles.barH}>{d.hoursLabel}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles.chartLegend}>
              <div className={styles.lg}>
                <span className={styles.lgSw} style={{ background: "#3182f6" }} />
                근무
              </div>
              <div className={styles.lg}>
                <span className={styles.lgSw} style={{ background: "#bcd9ff" }} />
                휴게
              </div>
              <div className={styles.lg}>
                <span className={styles.lgSw} style={{ background: "#8b5cf6" }} />
                초과근무
              </div>
              {range === "week" && (
                <div className={`${styles.lg} ${styles.lgGoal}`}>
                  목표 주 40시간 · 진행률 {weekProgress}%
                </div>
              )}
            </div>
              </>
            )}
          </section>

          {/* 휴가 사용 내역 — 해당 기간에 사용한 휴가 (근무 인정) */}
          {leaveUsages.length > 0 && (
            <section className={styles.week}>
              <div className={styles.panelHead}>
                <div>
                  <div className={styles.panelT}>휴가 사용 내역</div>
                  <div className={styles.panelS}>
                    {rangeRangeLabel(range)} · {leaveUsages.length}건 · 근무 인정 반영
                  </div>
                </div>
              </div>
              <div className={styles.leaveList}>
                {leaveUsages.map((u, i) => (
                  <div key={i} className={styles.leaveItem}>
                    <span className={styles.leaveDate}>
                      {fmtLeaveRange(u.start, u.end)}
                    </span>
                    <span className={styles.leaveType}>{u.type}</span>
                    <span className={styles.leaveDays}>{u.days}일 인정</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {loading && (
            <div style={{ textAlign: "center", color: "#6b7684", padding: 20 }}>
              불러오는 중...
            </div>
          )}
        </main>
      </div>
      <ConfirmDialog
        open={showClockOutConfirm}
        {...CLOCK_OUT_CONFIRM}
        onConfirm={confirmClockOut}
        onCancel={() => setShowClockOutConfirm(false)}
      />
    </div>
  );
}
