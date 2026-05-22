"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import styles from "./page.module.css";
import {
  calculateAttendance,
  formatMinutes,
  getTodayKstDate,
  WORK_END_HOUR,
} from "@/lib/attendance";
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

// 지각 (10:00 이후 출근)
function lateCount(records: AttendanceRec[]): number {
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
    if (h > 10 || (h === 10 && m > 0)) count += 1;
  }
  return count;
}

// 오늘 실시간 누적 근무 분
function liveWorkMinutes(today: AttendanceRec | null, todayDate: string): number {
  if (!today) return 0;
  if (today.clock_out_at) return today.work_minutes ?? 0;
  return calculateAttendance(
    today.clock_in_at,
    new Date().toISOString(),
    todayDate,
  ).workMinutes;
}

// 오늘 실시간 누적 근무 초 (시:분:초 표시용)
function liveWorkSeconds(today: AttendanceRec | null, todayDate: string): number {
  if (!today) return 0;
  if (today.clock_out_at) return (today.work_minutes ?? 0) * 60;
  // 점심 시간 제외하면서 초 단위로
  const clockIn = new Date(today.clock_in_at);
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  const [y, m, d] = todayDate.split("-").map(Number);
  const dayStartUtcMs = Date.UTC(y, m - 1, d, 10 - 9, 0);
  const dayEndUtcMs = Date.UTC(y, m - 1, d, 19 - 9, 0);
  const lunchStartMs = Date.UTC(y, m - 1, d, 13 - 9, 0);
  const lunchEndMs = Date.UTC(y, m - 1, d, 14 - 9, 0);
  // recognized in: max(actual, 10:00)
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

function remainingUntilOff(): string {
  const kst = getKstNow();
  const h = kst.getHours();
  const m = kst.getMinutes();
  const remainMin = WORK_END_HOUR * 60 - (h * 60 + m);
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
function rangeRangeLabel(range: RangeKey): string {
  const today = getTodayKstDate();
  if (range === "week") {
    const dates = thisWeekDates();
    const [y1, m1, d1] = dates[0].date.split("-");
    const [y2, m2, d2] = dates[6].date.split("-");
    return `${y1}년 ${Number(m1)}월 ${Number(d1)}일 (월) ~ ${y2 !== y1 ? `${y2}년 ` : ""}${Number(m2)}월 ${Number(d2)}일 (일)`;
  }
  if (range === "month") {
    const [y, m] = today.split("-");
    return `${y}년 ${Number(m)}월`;
  }
  return `${today.slice(0, 4)}년`;
}

// ─── 메인 ────────────────────────────────────────────────────────────────
export default function MyAttendancePage() {
  const today = getTodayKstDate();

  const [range, setRange] = useState<RangeKey>("week");
  const [records, setRecords] = useState<AttendanceRec[]>([]);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
      const { from, to } = rangeFetch(range, today);
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
      }
      if (attRes.ok) {
        const data = await attRes.json();
        setRecords(data.records ?? []);
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
  }, [range, today]);

  useEffect(() => {
    fetchAll();
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
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    if (submitting) return;
    if (!confirm("퇴근 처리하시겠습니까?")) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/attendance/clock-out", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "퇴근 처리 실패");
      } else {
        await fetchAll();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── 헤로 ─────────────────────────────────────────────────────────────
  const liveMin = liveWorkMinutes(todayRecord, today);
  const liveSec = liveWorkSeconds(todayRecord, today);
  const isWorking = !!todayRecord && !todayRecord.clock_out_at;
  const checkInTime = todayRecord ? formatTime(todayRecord.clock_in_at) : null;
  const checkOutTime = todayRecord?.clock_out_at
    ? formatTime(todayRecord.clock_out_at)
    : null;
  const remainingText = remainingUntilOff();

  // ─── 통계 (range 적용) ──────────────────────────────────────────────
  const totalWork = records.reduce((s, r) => s + (r.work_minutes ?? 0), 0);
  const totalOt = records.reduce((s, r) => s + (r.overtime_minutes ?? 0), 0);
  const avgIn = avgClockInString(records);
  const late = lateCount(records);

  // 주간 진행률 (week 모드에서만 의미있음)
  const weeklyGoalMin = 40 * 60;
  const weekProgress = Math.min(100, Math.round((totalWork / weeklyGoalMin) * 100));

  const rangeLabel: Record<RangeKey, string> = {
    week: "이번 주",
    month: "이번 달",
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
      const w = monthRecs.reduce((s, r) => s + (r.work_minutes ?? 0), 0);
      const ot = monthRecs.reduce((s, r) => s + (r.overtime_minutes ?? 0), 0);
      const totalMin = w + ot;
      // 월간 최대 = 30일 × 480 = 14400분
      const maxMin = 30 * 480;
      const workPct = Math.min(100, Math.round((totalMin / maxMin) * 100));
      const otPct = totalMin > 0 ? Math.round((ot / maxMin) * 100) : 0;
      const isCurrent = ym === today.slice(0, 7);
      const isFuture = ym > today.slice(0, 7);
      if (monthRecs.length === 0) {
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
    : range === "month" ? "이번 달 근무"
    : "올해 근무";
  const otStatLabel =
    range === "week" ? "이번 주 야근"
    : range === "month" ? "이번 달 야근"
    : "올해 야근";
  const lateStatUnit =
    range === "week" ? "회 / 이번 주"
    : range === "month" ? "회 / 이번 달"
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
              <div className={styles.seg}>
                {(["week", "month", "year"] as const).map((k) => (
                  <button
                    key={k}
                    className={range === k ? styles.segOn : ""}
                    onClick={() => setRange(k)}
                  >
                    {k === "week" ? "주" : k === "month" ? "월" : "년"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* TODAY HERO */}
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
                      : `예정 ${String(WORK_END_HOUR).padStart(2, "0")}:00 · ${remainingText}`}
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

          {/* 주 52시간 한도 진행률 (항상 이번 주 기준) */}
          {(() => {
            const weekTotalMin = weekStat.work + weekStat.ot;
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
                      style={{ width: `${pctFill}%` }}
                    >
                      {pctFill > 0 &&
                        (isWorking || todayRecord?.clock_out_at) && (
                          <video
                            key={isWorking ? "work" : "finish"}
                            className={styles.legalBarVideo}
                            src={isWorking ? "/work.mp4" : "/finish.mp4"}
                            autoPlay
                            loop
                            muted
                            playsInline
                          />
                        )}
                    </div>
                  </div>
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
                      ? "이번 달 일별 근무"
                      : "올해 월별 근무"}
                </div>
                <div className={styles.panelS}>{rangeRangeLabel(range)}</div>
              </div>
            </div>

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
          </section>

          {loading && (
            <div style={{ textAlign: "center", color: "#6b7684", padding: 20 }}>
              불러오는 중...
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
