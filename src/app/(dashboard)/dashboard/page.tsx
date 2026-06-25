"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  TrendingUp,
  Wallet,
  Mail,
  MailOpen,
  ChevronRight,
  CalendarDays,
  Megaphone,
  Target,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";
import { CLOCK_OUT_CONFIRM, getTodayKstDate } from "@/lib/attendance";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import { getCalendarWeekIndex } from "@/lib/dashboard/weekOfMonth";

interface AttendanceRec {
  id: number;
  date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  work_minutes: number;
  overtime_minutes: number;
  is_invalid: boolean;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—:—";
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

// ─── 등록률 랭킹 ────────────────────────────────────────────────────
type RankItem = {
  name: string;
  rate: number;
  registrations: number;
  total: number;
  isMe?: boolean;
};

// 2026년 05월 22일 (금) 15:44:58 형식
function formatNowFull(): string {
  const d = new Date();
  const kst = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const da = String(kst.getDate()).padStart(2, "0");
  const hh = String(kst.getHours()).padStart(2, "0");
  const mm = String(kst.getMinutes()).padStart(2, "0");
  const ss = String(kst.getSeconds()).padStart(2, "0");
  const dow = ["일", "월", "화", "수", "목", "금", "토"][kst.getDay()];
  return `${y}년 ${m}월 ${da}일 (${dow}) ${hh}:${mm}:${ss}`;
}

// 인사말 옆 표시용 — 날짜 / 시각 분리
function formatNowDateLine(): string {
  const d = new Date();
  const kst = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const da = String(kst.getDate()).padStart(2, "0");
  const dow = ["일", "월", "화", "수", "목", "금", "토"][kst.getDay()];
  return `${y}년 ${m}월 ${da}일 (${dow})`;
}

function formatNowTimeLine(): string {
  const d = new Date();
  const kst = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const hh = String(kst.getHours()).padStart(2, "0");
  const mm = String(kst.getMinutes()).padStart(2, "0");
  const ss = String(kst.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function thisWeekDates(): string[] {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const dow = kst.getDay();
  const monOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(kst);
  monday.setDate(kst.getDate() + monOffset);
  const arr: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    arr.push(`${y}-${m}-${da}`);
  }
  return arr;
}

export default function DashboardPage() {
  const today = getTodayKstDate();
  const [todayRec, setTodayRec] = useState<AttendanceRec | null>(null);
  const [weekRecs, setWeekRecs] = useState<AttendanceRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [, setTick] = useState(0);
  const [userName, setUserName] = useState<string>("");
  const [leaveData, setLeaveData] = useState<{
    balance: number;
    total: number;
  } | null>(null);

  // 본인 담당 stats (work-journal 과 동일 API)
  const [stats, setStats] = useState<{
    totalInquiries: number;
    registrations: number;
    registrationRate: number;
    salesThisMonth: number;
    delta: {
      inquiries: number;
      registrations: number;
      rate: number;
      sales: number;
    };
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/work-journal/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setStats({
          totalInquiries: Number(d.totalInquiries ?? 0),
          registrations: Number(d.registrations ?? 0),
          registrationRate: Number(d.registrationRate ?? 0),
          salesThisMonth: Number(d.salesThisMonth ?? 0),
          delta: {
            inquiries: Number(d?.delta?.inquiries ?? 0),
            registrations: Number(d?.delta?.registrations ?? 0),
            rate: Number(d?.delta?.rate ?? 0),
            sales: Number(d?.delta?.sales ?? 0),
          },
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // 등록률 랭킹 — /api/dashboard/registration-ranking 응답 (당월 담당자별)
  const [ranking, setRanking] = useState<RankItem[]>([]);
  const [rankMonthLabel, setRankMonthLabel] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/registration-ranking", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        if (Array.isArray(d.ranking)) setRanking(d.ranking as RankItem[]);
        if (d.year && d.month) setRankMonthLabel(`${d.year}년 ${d.month}월`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // 매초 갱신 (시계용)
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // 로그인 사용자 이름 + id (인사말 + 사용자별 목표 key)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.displayName) setUserName(d.displayName);
        if (typeof d?.id === "number") setUserId(d.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // 본인 휴가 잔여
  useEffect(() => {
    let cancelled = false;
    fetch("/api/leave-balances/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const total =
          Number(d.auto_grant ?? 0) +
          Number(d.birthday_grant ?? 0) +
          Number(d.manual_grant ?? 0);
        setLeaveData({
          balance: Number(d.balance ?? 0),
          total,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const dates = thisWeekDates();
      const from = dates[0];
      const to = today;
      const res = await fetch(`/api/attendance/me?from=${from}&to=${to}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const recs = (data.records ?? []) as AttendanceRec[];
      setWeekRecs(recs);
      setTodayRec(recs.find((r) => r.date === today) ?? null);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    fetchAttendance();
    // 같은 탭(헤더의 출퇴근 버튼 등) 즉시 동기화
    const onChanged = () => fetchAttendance();
    window.addEventListener("attendance-changed", onChanged);
    // 다른 탭/기기 — Supabase 실시간
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-attendance-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        () => {
          fetchAttendance();
        },
      )
      .subscribe();
    return () => {
      window.removeEventListener("attendance-changed", onChanged);
      supabase.removeChannel(channel);
    };
  }, [fetchAttendance]);

  const handleClockIn = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/attendance/clock-in", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "출근 처리 실패");
      } else {
        await fetchAttendance();
        window.dispatchEvent(new Event("attendance-changed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);

  // ─── 이번달 목표 (사용자별, app_settings 기반) ────────────────────
  const monthKey = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1,
  ).padStart(2, "0")}`;
  const [userId, setUserId] = useState<number | null>(null);
  const [monthlyGoal, setMonthlyGoal] = useState<{
    total: number;
    weeks: number[];
  }>({ total: 0, weeks: [0, 0, 0, 0, 0] });
  const [monthlyAchieved, setMonthlyAchieved] = useState<{
    total: number;
    weeks: number[];
  }>({ total: 0, weeks: [0, 0, 0, 0, 0] });

  const goalKey =
    userId != null ? `dashboard.monthly_goal.${userId}.${monthKey}` : null;

  // 사용자별 목표 로드 (userId 확인 후)
  useEffect(() => {
    if (!goalKey) return;
    let cancelled = false;
    fetch(`/api/app-settings?key=${goalKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const v = data?.value;
        if (
          v &&
          typeof v.total === "number" &&
          Array.isArray(v.weeks) &&
          v.weeks.length === 5 &&
          v.weeks.every((n: unknown) => typeof n === "number")
        ) {
          setMonthlyGoal({ total: v.total, weeks: v.weeks });
        } else {
          setMonthlyGoal({ total: 0, weeks: [0, 0, 0, 0, 0] });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [goalKey]);

  // 본인 실 매출 로드 (이번 달 cert/edu/practice 합산, 주차별)
  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const params = new URLSearchParams({
      year: String(now.getFullYear()),
      month: String(now.getMonth() + 1),
    });
    fetch(`/api/dashboard/my-monthly-sales?${params.toString()}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const total = typeof data.total === "number" ? data.total : 0;
        const weeks =
          Array.isArray(data.weeks) && data.weeks.length === 5
            ? data.weeks.map((n: unknown) => (typeof n === "number" ? n : 0))
            : [0, 0, 0, 0, 0];
        setMonthlyAchieved({ total, weeks });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleClockOut = () => {
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
        await fetchAttendance();
        window.dispatchEvent(new Event("attendance-changed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 이번 주 통계
  const weekTotal = weekRecs.reduce((s, r) => s + (r.work_minutes ?? 0), 0);
  const weekOt = weekRecs.reduce((s, r) => s + (r.overtime_minutes ?? 0), 0);

  // 상태 결정
  const isWorking = !!todayRec && !todayRec.clock_out_at;
  const isDone = !!todayRec && !!todayRec.clock_out_at;

  // 출근 중일 때 오늘 라이브 분 (DB의 work_minutes은 퇴근 시점에야 채워지므로
  // 출근 즉시 progress bar / work.mp4 가 표시되도록 라이브 계산값을 더한다)
  const todayLiveMin = (() => {
    if (!isWorking || !todayRec?.clock_in_at) return 0;
    const start = new Date(todayRec.clock_in_at).getTime();
    return Math.max(0, Math.floor((Date.now() - start) / 60000));
  })();

  // 주간 누적 합산 (정규 + 야근 + 오늘 라이브, 분 단위)
  const weekTotalAll = weekTotal + weekOt + todayLiveMin;
  // 진행률 계산 (52h = 100%)
  const LEGAL_MAX = 52 * 60; // 3120분
  const NORMAL_MAX = 40 * 60; // 2400분
  const pctFill = Math.min(100, (weekTotalAll / LEGAL_MAX) * 100);
  const isOver = weekTotalAll > LEGAL_MAX;
  const overPct = isOver
    ? Math.min(100, ((weekTotalAll - LEGAL_MAX) / LEGAL_MAX) * 100)
    : 0;
  const normalMarkerPct = (NORMAL_MAX / LEGAL_MAX) * 100; // 76.92%

  const status: "ok" | "warn" | "danger" = isOver
    ? "danger"
    : weekTotalAll >= NORMAL_MAX
      ? "warn"
      : "ok";
  const fillCls =
    status === "warn"
      ? styles.attProgressFillWarn
      : status === "danger"
        ? styles.attProgressFillDanger
        : "";

  // "이번주 N 더 필요해요" — 40h 까지 부족분
  const needMin = Math.max(0, NORMAL_MAX - weekTotalAll);
  const needText =
    weekTotalAll === 0
      ? `이번주 ${Math.floor(NORMAL_MAX / 60)}h 0m 채워주세요.`
      : needMin > 0
        ? `이번주 ${Math.floor(needMin / 60)}h ${needMin % 60}m 더 필요해요.`
        : `이번주 목표 달성! 🎉`;

  // 주간 누적 표시용
  const weekH = Math.floor(weekTotalAll / 60);
  const weekM = weekTotalAll % 60;

  return (
    <div className={styles.app}>
      <div className={styles.layout}>
        {/* 1행 좌: 근태 */}
        <section className={`${styles.card} ${styles.attendanceCard}`}>
          <div className={styles.attGreetingRow}>
            <span className={styles.attGreetingDate}>
              {formatNowDateLine()} {formatNowTimeLine()}
            </span>
            <span
              className={`${styles.attStatusBadge} ${
                isDone
                  ? styles.attStatusBadgeDone
                  : isWorking
                    ? styles.attStatusBadgeWorking
                    : styles.attStatusBadgeBefore
              }`}
            >
              {isDone ? "퇴근" : isWorking ? "출근" : "출근전"}
            </span>
          </div>
          <h3 className={styles.attGreeting}>
            안녕하세요, {userName || "회원"}님!
          </h3>
          {/* 진행 바 + 오늘 근무시간(아래) */}
          <div className={styles.attWeekBlock}>
            <div className={styles.attProgressWrap}>
              <div className={styles.attProgressBar}>
                <div
                  className={`${styles.attProgressFill} ${fillCls}`}
                  style={{
                    width: `${pctFill}%`,
                  }}
                />
                {isOver && (
                  <div
                    className={styles.attProgressOver}
                    style={{
                      left: "100%",
                      width: `${overPct}%`,
                      marginLeft: -2,
                    }}
                  />
                )}
              </div>
              {(isWorking || isDone) && (
                <video
                  key={isWorking ? "work" : "finish"}
                  className={styles.attBotVideo}
                  src={isDone ? "/finish.mp4" : "/work.mp4"}
                  style={{ left: `calc(${pctFill}% - 32px)` }}
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              )}
              {/* 0h / 40h / 52h 라벨 */}
              <div className={styles.attMarkerLabel} style={{ left: 0 }}>
                0h
              </div>
              <div
                className={styles.attMarker}
                style={{ left: `${normalMarkerPct}%` }}
              />
              <div
                className={styles.attMarkerLabel}
                style={{
                  left: `${normalMarkerPct}%`,
                  transform: "translateX(-50%)",
                }}
              >
                40h
              </div>
              <div className={styles.attMarker} style={{ right: 0 }} />
              <div className={styles.attMarkerLabel} style={{ right: 0 }}>
                52h
              </div>
            </div>

            <div className={styles.attWeekTitleRow}>
              <span className={styles.attWeekLabel}>오늘 근무시간</span>
              <span className={styles.attWeekValue}>
                {(() => {
                  const todayMin = isWorking
                    ? todayLiveMin
                    : (todayRec?.work_minutes ?? 0);
                  const h = Math.floor(todayMin / 60);
                  const m = todayMin % 60;
                  return `${h}h ${String(m).padStart(2, "0")}m`;
                })()}
              </span>
            </div>
          </div>

          {/* 출근시간 → 퇴근시간 박스 (progress bar 밑) */}
          <div className={styles.attTimeBox}>
            <div className={styles.attTimeCol}>
              <span className={styles.attTimeLabel}>출근 시간</span>
              <span
                className={`${styles.attTimeValue} ${!todayRec ? styles.attTimeValueEmpty : ""}`}
              >
                {todayRec ? formatTime(todayRec.clock_in_at) : "-"}
              </span>
            </div>
            <div className={styles.attTimeArrow}>→</div>
            <div className={styles.attTimeCol}>
              <span className={styles.attTimeLabel}>퇴근 시간</span>
              <span
                className={`${styles.attTimeValue} ${!todayRec?.clock_out_at ? styles.attTimeValueEmpty : ""}`}
              >
                {todayRec?.clock_out_at
                  ? formatTime(todayRec.clock_out_at)
                  : "-"}
              </span>
            </div>
          </div>

          {/* 출근/퇴근 버튼 — 상태에 따라 한 개만 표시 */}
          <div className={styles.attActions}>
            {isWorking ? (
              <button
                type="button"
                className={styles.attActionBtn}
                onClick={handleClockOut}
                disabled={submitting}
              >
                퇴근하기
              </button>
            ) : (
              <button
                type="button"
                className={styles.attActionBtn}
                onClick={handleClockIn}
                disabled={!!todayRec || submitting || loading}
              >
                출근하기
              </button>
            )}
          </div>

          {/* 내 연차 카드 */}
          <div className={styles.attLeaveCard}>
            <div className={styles.attLeaveLeft}>
              <span className={styles.attLeaveIcon} aria-hidden="true">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="42"
                  height="42"
                  viewBox="0 0 42 42"
                  fill="none"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M27.9999 3.75C30.2849 3.75002 32.6827 4.36817 34.7216 5.9834C36.7679 7.60476 38.3191 10.1247 39.0907 13.6816C39.1961 14.1675 39.0537 14.6742 38.7108 15.0342C38.3679 15.3942 37.8683 15.5612 37.3778 15.4795L34.3915 14.9814C34.4945 15.4773 34.5847 16.0084 34.6376 16.5547C34.7896 18.125 34.666 19.9712 33.6855 21.7305C33.4635 22.1288 33.0717 22.4043 32.622 22.4795C32.1723 22.5546 31.7124 22.4206 31.373 22.1162C30.1684 21.0358 28.1076 19.6291 25.914 18.1914C24.6184 17.3423 23.277 16.4821 22.1073 15.7061C21.6213 19.4045 21.2797 25.1685 22.2177 30.0361C24.0074 30.1437 25.5122 30.5102 27.0136 31.293C28.7774 32.2126 30.444 33.6633 32.537 35.668C32.9793 36.0916 33.1197 36.7412 32.8915 37.3096C32.6632 37.878 32.1125 38.251 31.4999 38.251H10.4999C9.9366 38.2509 9.42035 37.9352 9.16397 37.4336C8.90772 36.932 8.9542 36.3286 9.28409 35.8721C10.2746 34.5015 11.9978 33.0536 14.0087 31.9502C15.5394 31.1104 17.3222 30.4237 19.1874 30.1406C18.3502 25.3831 18.5844 20.0555 19.0146 16.2812C18.0748 16.8962 17.0678 17.5479 16.0858 18.1914C13.8922 19.6291 11.8314 21.0358 10.6269 22.1162C10.2875 22.4207 9.82756 22.5546 9.37784 22.4795C8.92809 22.4044 8.53642 22.1287 8.31437 21.7305C7.33373 19.9715 7.21017 18.125 7.36222 16.5547C7.41512 16.0084 7.50435 15.4773 7.60733 14.9814L4.62198 15.4795C4.13149 15.5612 3.63198 15.3942 3.28897 15.0342C2.94611 14.6741 2.80369 14.1675 2.90909 13.6816C3.68038 10.1265 5.22509 7.60776 7.26944 5.98633C9.30645 4.37092 11.7042 3.75456 13.997 3.75098C16.6154 3.74674 19.141 4.54051 20.9999 5.35156C22.8596 4.54071 25.3813 3.75 27.9999 3.75ZM20.998 33.001C19.1339 32.9993 17.1725 33.6362 15.4521 34.5801C15.063 34.7936 14.6939 35.0199 14.3476 35.251H27.5673C26.8676 34.697 26.2421 34.2744 25.6259 33.9531C24.3462 33.2861 23.0241 33.003 20.998 33.001ZM14.0019 6.75C12.2387 6.75272 10.5371 7.22306 9.13272 8.33691C8.11152 9.14692 7.17631 10.3558 6.49015 12.126L9.37784 11.6455C9.8805 11.5618 10.3915 11.7392 10.7343 12.1162C11.0771 12.4933 11.2052 13.0183 11.0741 13.5107C10.8109 14.4995 10.4669 15.6112 10.3476 16.8438C10.2935 17.4019 10.2914 17.9527 10.3612 18.4873C11.5879 17.5751 13.0357 16.6038 14.4413 15.6826C16.6599 14.2285 18.7866 12.8868 20.1142 11.915C20.153 11.8877 20.1659 11.8795 20.1786 11.8711L20.2148 11.8467C20.3197 11.7822 20.4305 11.7316 20.5448 11.6953C20.5944 11.6807 20.6295 11.6712 20.665 11.6631C20.6799 11.6597 20.6948 11.6563 20.7099 11.6533C20.7403 11.6473 20.771 11.6427 20.8017 11.6387C20.8205 11.6362 20.8393 11.6336 20.8583 11.6318C20.8944 11.6284 20.9305 11.6268 20.9667 11.626C20.9807 11.6257 20.9947 11.6259 21.0087 11.626C21.0403 11.6262 21.0719 11.6267 21.1034 11.6289C21.12 11.6301 21.1366 11.6311 21.1532 11.6328C21.1957 11.6372 21.2381 11.6434 21.2802 11.6514C21.2935 11.6538 21.3011 11.6557 21.3085 11.6572C21.3423 11.6643 21.3758 11.6731 21.4091 11.6826C21.4272 11.6877 21.445 11.6935 21.4628 11.6992C21.487 11.7071 21.5112 11.7155 21.5351 11.7246C21.5534 11.7316 21.5718 11.7384 21.5898 11.7461C21.6247 11.7611 21.6593 11.7772 21.6933 11.7949L21.7108 11.8037C21.7303 11.8142 21.7486 11.8266 21.7675 11.8379C21.7779 11.8441 21.7885 11.85 21.7987 11.8564C21.8223 11.8713 21.8455 11.8863 21.8681 11.9023C21.8739 11.9065 21.8798 11.9108 21.8857 11.915C23.2133 12.8868 25.3399 14.2285 27.5585 15.6826C28.9637 16.6036 30.4112 17.5743 31.6376 18.4863C31.7074 17.9519 31.7063 17.4015 31.6523 16.8438C31.5329 15.6113 31.1889 14.4995 30.9257 13.5107C30.7946 13.0183 30.9227 12.4933 31.2655 12.1162C31.6084 11.7392 32.1193 11.5617 32.622 11.6455L35.5087 12.126C34.8212 10.3562 33.8829 9.14603 32.8593 8.33496C31.451 7.2192 29.7493 6.75002 27.9999 6.75C25.6852 6.75 23.3326 7.5517 21.6444 8.35449C21.2369 8.54834 20.763 8.54831 20.3554 8.35449C18.6655 7.55085 16.311 6.74627 14.0019 6.75Z"
                    fill="#0084FE"
                  />
                </svg>
              </span>
              <div className={styles.attLeaveTextBox}>
                <span className={styles.attLeaveLabel}>내 연차</span>
                <div className={styles.attLeaveValueRow}>
                  <span className={styles.attLeaveBalance}>
                    {leaveData?.balance ?? 0}일
                  </span>
                  <span className={styles.attLeaveTotal}>
                    /{leaveData?.total ?? 0}일
                  </span>
                </div>
              </div>
            </div>
            <Link href="/me/leave" className={styles.attLeaveBtn}>
              휴가 현황
            </Link>
          </div>
        </section>

        {/* 1행 중: 이번달 목표 현황 — 목표값은 app_settings, 실적값은 mock */}
        <section className={`${styles.card} ${styles.goalCard}`}>
          <div className={styles.goalHead}>
            <h3 className={styles.cardTitle}>이번달 목표 현황</h3>
            {/* 목표 설정은 팀장·본부장이 '매출 목표 관리'에서 지정 */}
          </div>

          {(() => {
            const monthLabel = `${new Date().getMonth() + 1}월`;
            const goalTotal = monthlyGoal.total;
            const goalAchieved = monthlyAchieved.total;
            const pct = goalTotal > 0
              ? Math.round((goalAchieved / goalTotal) * 100)
              : 0;
            const donutFill = Math.min(100, pct); // 도넛 시각은 100%까지, % 텍스트는 초과분 그대로
            // 오늘 날짜로 현재 주차 계산 (달력 주차: 월~일)
            const today = new Date();
            const currentWeekIdx = getCalendarWeekIndex(
              today.getFullYear(),
              today.getMonth() + 1,
              today.getDate(),
            );
            const weekly = monthlyGoal.weeks.map((target, i) => ({
              week: `${i + 1}주차`,
              value: monthlyAchieved.weeks[i] ?? 0,
              target,
              current: i === currentWeekIdx,
            }));
            return (
              <div className={styles.goalBody}>
                {/* 좌측: 도넛 + 매출 (세로 묶음) */}
                <div className={styles.goalLeftStack}>
                  <div className={styles.goalDonutBox}>
                    <span className={styles.goalBoxCaption}>
                      {monthLabel} 달성률
                    </span>
                    <svg
                      width="80"
                      height="80"
                      viewBox="0 0 80 80"
                      className={styles.goalDonut}
                    >
                      <circle
                        cx="40"
                        cy="40"
                        r="32"
                        fill="none"
                        stroke="#e8eef5"
                        strokeWidth="10"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r="32"
                        fill="none"
                        stroke="#0084fe"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${(donutFill / 100) * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
                        transform="rotate(-90 40 40)"
                      />
                      <text
                        x="40"
                        y="45"
                        textAnchor="middle"
                        className={styles.goalDonutText}
                      >
                        {pct}%
                      </text>
                    </svg>
                  </div>

                  {/* 가운데: 매출 + 미니 progress */}
                  <div className={styles.goalSalesBox}>
                    <span className={styles.goalBoxCaption}>
                      {monthLabel} 매출
                    </span>
                    <div className={styles.goalSalesInner}>
                      <div className={styles.goalSalesValue}>
                        {goalAchieved.toLocaleString()}만원
                      </div>
                      <div className={styles.goalSalesTarget}>
                        /목표 {goalTotal.toLocaleString()}만원
                      </div>
                    </div>
                  </div>
                </div>

                {/* 우측: 주차별 진행 (라벨+% / bar / 금액) */}
                <div className={styles.goalWeeksBox}>
                  {weekly.map((w) => {
                    const wpct =
                      w.target > 0
                        ? Math.round((w.value / w.target) * 100)
                        : 0;
                    const weekFill = Math.min(100, wpct); // 바는 100%까지, % 텍스트는 초과분 그대로
                    return (
                      <div
                        key={w.week}
                        className={`${styles.goalWeekRow} ${w.current ? styles.goalWeekRowCurrent : ""}`}
                      >
                        <div className={styles.goalWeekLeft}>
                          <div className={styles.goalWeekTopRow}>
                            <span className={styles.goalWeekLabel}>
                              {w.week}
                            </span>
                            <span className={styles.goalWeekPct}>
                              {wpct}%
                            </span>
                          </div>
                          <div className={styles.goalWeekBar}>
                            <span
                              className={styles.goalWeekFill}
                              style={{ width: `${weekFill}%` }}
                            />
                          </div>
                        </div>
                        <div className={styles.goalWeekAmountRow}>
                          <span className={styles.goalWeekAmountValue}>
                            {w.value.toLocaleString()}만원
                          </span>
                          <span className={styles.goalWeekAmountTarget}>
                            /{w.target.toLocaleString()}만원
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </section>

        {/* 1행 우: 등록률 랭킹 */}
        <RegistrationRanking monthLabel={rankMonthLabel} items={ranking} />

        {/* 2행: 통계 4개 (업무일지와 동일 디자인) */}
        <section className={styles.statsRow}>
          <div className={styles.statGroup}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <Users size={32} />
              </div>
              <div className={styles.statTexts}>
                <div className={styles.statValueRow}>
                  <span className={styles.statLabel}>전체문의</span>
                  <span className={styles.statValue}>
                    {(stats?.totalInquiries ?? 0).toLocaleString()}건
                  </span>
                </div>
                <div className={styles.statSub}>
                  <span>전일대비</span>
                  <span>
                    {(() => {
                      const n = stats?.delta.inquiries ?? 0;
                      return `${n > 0 ? "+" : ""}${n}건`;
                    })()}
                  </span>
                </div>
              </div>
            </div>

            <span className={styles.statDivider} aria-hidden="true" />

            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <UserPlus size={32} />
              </div>
              <div className={styles.statTexts}>
                <div className={styles.statValueRow}>
                  <span className={styles.statLabel}>등록 건수</span>
                  <span className={styles.statValue}>
                    {(stats?.registrations ?? 0).toLocaleString()}건
                  </span>
                </div>
                <div className={styles.statSub}>
                  <span>전일대비</span>
                  <span>
                    {(() => {
                      const n = stats?.delta.registrations ?? 0;
                      return `${n > 0 ? "+" : ""}${n}건`;
                    })()}
                  </span>
                </div>
              </div>
            </div>

            <span className={styles.statDivider} aria-hidden="true" />

            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <TrendingUp size={32} />
              </div>
              <div className={styles.statTexts}>
                <div className={styles.statValueRow}>
                  <span className={styles.statLabel}>등록률</span>
                  <span className={styles.statValue}>
                    {(stats?.registrationRate ?? 0).toFixed(1)}%
                  </span>
                </div>
                <div className={styles.statSub}>
                  <span>전일대비</span>
                  <span>
                    {(() => {
                      const n = stats?.delta.rate ?? 0;
                      return `${n > 0 ? "+" : ""}${n.toFixed(1)}%p`;
                    })()}
                  </span>
                </div>
              </div>
            </div>

            <span className={styles.statDivider} aria-hidden="true" />

            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <Wallet size={32} />
              </div>
              <div className={styles.statTexts}>
                <div className={styles.statValueRow}>
                  <span className={styles.statLabel}>매출</span>
                  <span className={styles.statValue}>
                    {Math.round(
                      (stats?.salesThisMonth ?? 0) / 10000,
                    ).toLocaleString()}
                    만원
                  </span>
                </div>
                <div className={styles.statSub}>
                  <span>전일대비</span>
                  <span>
                    {(() => {
                      const n = Math.round((stats?.delta.sales ?? 0) / 10000);
                      return `${n > 0 ? "+" : ""}${n.toLocaleString()}만원`;
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3행 좌: 메일 / 결재 / 업무 요청 */}
        <InboxCard />

        {/* (구) 메일 카드 자리는 InboxCard로 대체됨 */}

        {/* 3행 중: 캘린더 */}
        <DashboardCalendarCard />

        {/* 3행 우: KPI 목표 + 공지사항 (세로 스택) */}
        <div className={styles.rightStack}>
          <KpiCard />
          <NoticeCard />
        </div>
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

function StatBox({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className={styles.statBox}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statTexts}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{value}</span>
        <span className={styles.statSub}>{sub}</span>
      </div>
    </div>
  );
}

function ComingSoon({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className={styles.comingSoon}>
      <div className={styles.comingSoonIcon}>{icon}</div>
      <div className={styles.comingSoonText}>{text}</div>
    </div>
  );
}

// ─── KPI 목표 카드 ──────────────────────────────────────────────────
// 목표값: app_settings (dashboard.kpi_goal.{YYYY}-Q{n}) — 사업본부장이 분기별 설정
// 분기가 바뀌면 현재 분기 키를 자동 조회하므로 별도 갱신 작업이 필요 없다.
function KpiCard() {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  // 실적 — 분기 전사 매출 합산 (학점은행/수강등록 + 민간자격증 + 실습)
  const [achieved, setAchieved] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/dashboard/kpi-goal?year=${year}&quarter=${quarter}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            target: number | null;
            achieved: number | null;
            canEdit: boolean;
          } | null,
        ) => {
          if (!alive || !data) return;
          setTarget(data.target);
          setAchieved(data.achieved);
          setCanEdit(data.canEdit);
        },
      )
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [year, quarter]);

  const handleSave = async (nextTarget: number) => {
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/kpi-goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, quarter, target: nextTarget }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "KPI 목표 저장에 실패했습니다.");
        return;
      }
      setTarget(nextTarget);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  // 달성률 — 100% 초과분도 그대로 표시 (예: 112%), 바 너비만 100%로 제한
  const pct =
    achieved !== null && target !== null && target > 0
      ? Math.round((achieved / target) * 100)
      : 0;
  const isOver = pct > 100;

  return (
    <section className={`${styles.card} ${styles.kpiCard}`}>
      <div className={styles.kpiHead}>
        <h3 className={styles.cardTitle}>KPI 목표</h3>
        {canEdit && (
          <button
            type="button"
            className={styles.goalSettingBtn}
            onClick={() => setModalOpen(true)}
          >
            <Target size={14} />
            <span>목표 설정</span>
          </button>
        )}
      </div>
      <div className={styles.kpiRow}>
        <span className={styles.kpiTag}>
          {year}년 {quarter}분기 목표
        </span>
        <span className={styles.kpiTargetValue}>
          {target !== null ? `${target.toLocaleString()}원` : "목표 미설정"}
        </span>
      </div>
      <div className={styles.kpiBar}>
        <span
          className={`${styles.kpiBarFill} ${isOver ? styles.kpiBarFillOver : ""}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className={styles.kpiBottomRow}>
        <span className={styles.kpiAchieved}>
          {achieved !== null ? `${achieved.toLocaleString()}원` : "-"}
        </span>
        <span className={`${styles.kpiPct} ${isOver ? styles.kpiPctOver : ""}`}>
          {pct}%{isOver && ` (+${pct - 100}% 초과)`}
        </span>
      </div>

      {modalOpen && (
        <KpiGoalModal
          year={year}
          quarter={quarter}
          initial={target}
          saving={saving}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </section>
  );
}

// ─── KPI 목표 설정 모달 (사업본부장) ─────────────────────────────────
function KpiGoalModal({
  year,
  quarter,
  initial,
  saving,
  onClose,
  onSave,
}: {
  year: number;
  quarter: number;
  initial: number | null;
  saving: boolean;
  onClose: () => void;
  onSave: (target: number) => void;
}) {
  const [value, setValue] = useState<string>(
    initial !== null ? String(initial) : "",
  );

  const parsed = parseInt(value.replace(/,/g, ""), 10);
  const targetNum = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

  return (
    <div
      className={styles.goalModalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className={styles.goalModalBox}>
        <div className={styles.goalModalHeader}>
          <h3 className={styles.goalModalTitle}>KPI 목표 설정</h3>
          <span className={styles.goalModalSubtitle}>
            {year}년 {quarter}분기
          </span>
        </div>

        <div className={styles.goalModalBody}>
          <div className={styles.goalModalRow}>
            <label className={styles.goalModalLabel}>분기 목표</label>
            <div className={styles.goalModalInputWrap}>
              <input
                type="text"
                inputMode="numeric"
                value={value}
                onChange={(e) =>
                  setValue(e.target.value.replace(/[^0-9,]/g, ""))
                }
                placeholder="예) 1000000000"
                className={styles.goalModalInput}
              />
              <span className={styles.goalModalUnit}>원</span>
            </div>
          </div>
          <div className={styles.goalModalSummary}>
            <span>입력 금액</span>
            <span className={styles.goalModalSummaryMatch}>
              {targetNum > 0 ? `${targetNum.toLocaleString()}원` : "-"}
            </span>
          </div>
        </div>

        <div className={styles.goalModalFooter}>
          <button
            type="button"
            className={styles.goalModalCancel}
            onClick={onClose}
            disabled={saving}
          >
            취소
          </button>
          <button
            type="button"
            className={styles.goalModalSave}
            onClick={() => targetNum > 0 && onSave(targetNum)}
            disabled={saving || targetNum <= 0}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 공지사항 카드 ──────────────────────────────────────────────────
interface NoticeItem {
  id: number;
  title: string;
  is_pinned: boolean;
  created_at: string;
}

function NoticeCard() {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/board?page=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: { items?: NoticeItem[] }) => {
        if (!alive) return;
        setNotices((data.items ?? []).slice(0, 5));
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const fmtMd = (iso: string) => {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getMonth() + 1)}.${p(d.getDate())}`;
  };

  return (
    <section className={`${styles.card} ${styles.noticeCard}`}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>공지사항</h3>
      </div>
      <ul className={styles.noticeList}>
        {loaded && notices.length === 0 && (
          <li className={styles.noticeItem}>
            <span className={styles.noticeTitle}>등록된 공지가 없습니다.</span>
          </li>
        )}
        {notices.map((n) => (
          <li key={n.id} className={styles.noticeItem}>
            <Link href={`/board/${n.id}`} className={styles.noticeTitle}>
              {n.is_pinned && <span className={styles.noticePin}>공지</span>}
              {n.title}
            </Link>
            <span className={styles.noticeDate}>{fmtMd(n.created_at)}</span>
          </li>
        ))}
      </ul>
      <Link href="/board" className={styles.inboxMoreLink}>
        공지사항 바로가기
        <InboxMoreArrow />
      </Link>
    </section>
  );
}

// ─── 대시보드 캘린더 카드 ───────────────────────────────────────────
interface CalEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  time?: string;
  color?: string;
}

// 휴가 이벤트 API 응답 (반차의 경우 time 필드는 클라이언트에서 추론)
interface VacationEventDto {
  id: string;
  date: string;
  title: string;
  type: string;
  status: string;
  applicantName: string;
  color?: string;
}

function vacationTimeOf(type: string): string | undefined {
  if (type === "오전반차") return "09:00~13:00";
  if (type === "오후반차") return "14:00~18:00";
  return undefined;
}

function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dateToYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function sameYmd(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function DashboardCalendarCard() {
  const today = (() => {
    const now = new Date();
    return new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
    );
  })();

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1); // 1~12
  const [selected, setSelected] = useState<Date>(today);

  // 휴가 이벤트 (전자결재 휴가신청서 기반)
  const [vacationEvents, setVacationEvents] = useState<CalEvent[]>([]);
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      year: String(viewYear),
      month: String(viewMonth),
    });
    fetch(`/api/dashboard/vacation-events?${params}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: unknown) => {
        if (cancelled) return;
        if (!Array.isArray(rows)) {
          setVacationEvents([]);
          return;
        }
        const mapped: CalEvent[] = rows.map((r) => {
          const v = r as VacationEventDto;
          return {
            id: v.id,
            date: v.date,
            title: v.title,
            color: v.color ?? "#0084FE",
            time: vacationTimeOf(v.type),
          };
        });
        setVacationEvents(mapped);
      })
      .catch(() => {
        if (!cancelled) setVacationEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [viewYear, viewMonth]);

  const firstDay = new Date(viewYear, viewMonth - 1, 1);
  const startWeekday = firstDay.getDay(); // 0(일) ~ 6(토)
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

  // 캘린더 셀(6행 × 7열) 데이터
  const cells: { date: Date; inMonth: boolean }[] = [];
  // 시작 전 빈칸 (이전 달 날짜)
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = new Date(viewYear, viewMonth - 1, -i);
    cells.push({ date: d, inMonth: false });
  }
  // 이번 달
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(viewYear, viewMonth - 1, d), inMonth: true });
  }
  // 마지막 행 채우기 (다음 달 날짜)
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last);
    next.setDate(last.getDate() + 1);
    cells.push({ date: next, inMonth: false });
  }

  const goPrev = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const goNext = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // 날짜별 이벤트 카운트 + 대표 색상 (첫 이벤트의 색상)
  const eventCountByDate = vacationEvents.reduce<Record<string, number>>(
    (acc, e) => {
      acc[e.date] = (acc[e.date] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const eventColorByDate = vacationEvents.reduce<Record<string, string>>(
    (acc, e) => {
      if (!acc[e.date] && e.color) acc[e.date] = e.color;
      return acc;
    },
    {},
  );

  // 선택일 이벤트
  const selectedEvents = vacationEvents.filter(
    (e) => e.date === dateToYmd(selected),
  );

  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <section className={`${styles.card} ${styles.calendarCard}`}>
      {/* 월 네비게이션 */}
      <div className={styles.calNav}>
        <button
          type="button"
          className={styles.calNavBtn}
          onClick={goPrev}
          aria-label="이전 달"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M11.5357 1.6424C11.7231 1.82992 11.8284 2.08423 11.8284 2.3494C11.8284 2.61456 11.7231 2.86887 11.5357 3.0564L6.58566 8.0064L11.5357 12.9564C11.7178 13.145 11.8186 13.3976 11.8163 13.6598C11.8141 13.922 11.7089 14.1728 11.5235 14.3582C11.3381 14.5436 11.0873 14.6488 10.8251 14.6511C10.5629 14.6533 10.3103 14.5526 10.1217 14.3704L4.46466 8.7134C4.27719 8.52587 4.17188 8.27156 4.17188 8.0064C4.17187 7.74123 4.27719 7.48692 4.46466 7.2994L10.1217 1.6424C10.3092 1.45492 10.5635 1.34961 10.8287 1.34961C11.0938 1.34961 11.3481 1.45492 11.5357 1.6424Z"
              fill="#8D99A5"
            />
          </svg>
        </button>
        <span className={styles.calNavTitle}>
          {viewYear}.{String(viewMonth).padStart(2, "0")}
        </span>
        <button
          type="button"
          className={styles.calNavBtn}
          onClick={goNext}
          aria-label="다음 달"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M4.46466 1.6424C4.27719 1.82992 4.17188 2.08423 4.17188 2.3494C4.17187 2.61456 4.27719 2.86887 4.46466 3.0564L9.41466 8.0064L4.46466 12.9564C4.2825 13.145 4.18171 13.3976 4.18399 13.6598C4.18627 13.922 4.29143 14.1728 4.47684 14.3582C4.66225 14.5436 4.91306 14.6488 5.17526 14.6511C5.43746 14.6533 5.69006 14.5526 5.87866 14.3704L11.5357 8.7134C11.7231 8.52587 11.8284 8.27156 11.8284 8.0064C11.8284 7.74123 11.7231 7.48692 11.5357 7.2994L5.87866 1.6424C5.69113 1.45492 5.43683 1.34961 5.17166 1.34961C4.9065 1.34961 4.65219 1.45492 4.46466 1.6424Z"
              fill="#8D99A5"
            />
          </svg>
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className={styles.calWeekRow}>
        {WEEKDAYS.map((w, i) => (
          <span
            key={w}
            className={`${styles.calWeek} ${i === 0 ? styles.calWeekSun : ""} ${i === 6 ? styles.calWeekSat : ""}`}
          >
            {w}
          </span>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className={styles.calGrid}>
        {cells.map(({ date, inMonth }, i) => {
          const ymd = dateToYmd(date);
          const dayOfWeek = date.getDay();
          const isToday = sameYmd(date, today);
          const isSelected = sameYmd(date, selected);
          const eventCount = eventCountByDate[ymd] ?? 0;
          return (
            <button
              key={i}
              type="button"
              className={`${styles.calCell} ${!inMonth ? styles.calCellOut : ""} ${isSelected ? styles.calCellSelected : ""} ${isToday ? styles.calCellToday : ""}`}
              onClick={() => setSelected(date)}
            >
              <span
                className={`${styles.calCellNum} ${
                  dayOfWeek === 0
                    ? styles.calCellSun
                    : dayOfWeek === 6
                      ? styles.calCellSat
                      : ""
                } ${!inMonth ? styles.calCellDim : ""}`}
              >
                {date.getDate()}
              </span>
              {eventCount > 0 && (
                <span
                  className={styles.calCellDot}
                  style={
                    eventColorByDate[ymd]
                      ? {
                          background: eventColorByDate[ymd],
                          color: "#fff",
                        }
                      : undefined
                  }
                >
                  {eventCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 선택일 이벤트 리스트 */}
      <div className={styles.calEventsArea}>
        <div className={styles.calEventsDateCol}>
          <span className={styles.calEventsDateNum}>{selected.getDate()}</span>
          <span className={styles.calEventsDateWk}>
            {WEEKDAYS[selected.getDay()]}
          </span>
        </div>
        <div className={styles.calEventsList}>
          {selectedEvents.length === 0 ? (
            <span className={styles.calEventsEmpty}>일정 없음</span>
          ) : (
            selectedEvents.map((e) => (
              <div key={e.id} className={styles.calEventItem}>
                <div className={styles.calEventTitleRow}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="8"
                    height="8"
                    viewBox="0 0 8 8"
                    fill="none"
                    className={styles.calEventDot}
                  >
                    <circle cx="4" cy="4" r="4" fill={e.color ?? "#0084FE"} />
                  </svg>
                  <span className={styles.calEventTitle}>{e.title}</span>
                </div>
                {e.time && (
                  <span className={styles.calEventTime}>{e.time}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

// ─── 메일/결재/업무 요청 카드 (InboxCard) ──────────────────────────
// 안 읽은 메일 — 파란색 봉투(밀봉)
function MailSealedIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M13.3496 6.79688C13.3496 6.51316 13.3463 6.30342 13.3398 6.13672C12.665 6.63715 11.8416 7.25854 11.1436 7.78906C10.7266 8.10592 10.3551 8.38944 10.0879 8.59375C9.95436 8.69584 9.84656 8.77819 9.77246 8.83496C9.73553 8.86326 9.70691 8.88551 9.6875 8.90039C9.67784 8.9078 9.66999 8.91319 9.66504 8.91699C9.66256 8.91889 9.66042 8.92092 9.65918 8.92188L9.6582 8.92285L9.64648 8.93164C9.23846 9.23106 8.89455 9.49581 8.49609 9.59863C8.1704 9.68281 7.82861 9.68388 7.50293 9.59961C7.10467 9.49667 6.76136 9.23015 6.35547 8.93262C6.35232 8.9303 6.34979 8.92717 6.34668 8.9248V8.92578L2.65918 6.14063C2.65285 6.30719 2.65039 6.51706 2.65039 6.7998V11.8662C2.65039 12.25 2.65054 12.4988 2.66602 12.6885C2.6809 12.8706 2.70637 12.9407 2.72461 12.9766C2.77378 13.0729 2.84493 13.1557 2.93164 13.2188L3.02344 13.2744V13.2754C3.05864 13.2934 3.12797 13.3181 3.30957 13.333C3.49893 13.3485 3.74773 13.3496 4.13086 13.3496H11.8691C12.2521 13.3496 12.5003 13.3485 12.6895 13.333C12.8706 13.3182 12.9402 13.2934 12.9756 13.2754L12.9766 13.2744C13.1053 13.209 13.2098 13.1042 13.2754 12.9756C13.2937 12.9394 13.3192 12.8699 13.334 12.6895C13.3495 12.5004 13.3496 12.2523 13.3496 11.8691V6.79688ZM3.72656 5.31738L7.12988 7.88867C7.62297 8.25002 7.73197 8.31575 7.8291 8.34082C7.94129 8.3698 8.0597 8.36985 8.17188 8.34082C8.26857 8.31581 8.37763 8.24992 8.86621 7.8916H8.86719L8.86816 7.89063C8.86944 7.88965 8.87151 7.88767 8.87402 7.88574C8.87904 7.88189 8.88678 7.87658 8.89648 7.86914C8.91604 7.85415 8.94426 7.83123 8.98145 7.80273C9.0558 7.74577 9.16401 7.66385 9.29785 7.56152C9.56579 7.35668 9.93826 7.07172 10.3564 6.75391C10.9542 6.2996 11.6485 5.77633 12.2637 5.31738C12.1493 5.31633 12.0181 5.31641 11.8662 5.31641H4.13379C3.97754 5.31641 3.8432 5.31624 3.72656 5.31738ZM14.6504 11.8691C14.6504 12.2309 14.6507 12.5415 14.6299 12.7959C14.6138 12.9927 14.5826 13.1875 14.5146 13.3779L14.4336 13.5664C14.2432 13.9396 13.9398 14.2436 13.5664 14.4336L13.5654 14.4326C13.3164 14.5595 13.0577 14.6075 12.7959 14.6289C12.5414 14.6497 12.2309 14.6494 11.8691 14.6494H4.13086C3.76921 14.6494 3.45869 14.6497 3.2041 14.6289C2.94185 14.6075 2.68206 14.56 2.43262 14.4326C2.10629 14.2662 1.83305 14.0136 1.64258 13.7031L1.56641 13.5664C1.43936 13.317 1.39158 13.0574 1.37012 12.7949C1.34929 12.54 1.34961 12.2287 1.34961 11.8662V6.7998C1.34961 6.43737 1.34932 6.12597 1.37012 5.87109C1.39157 5.60854 1.43932 5.34815 1.56641 5.09863C1.75668 4.72525 2.05923 4.42269 2.43262 4.23242C2.68213 4.10533 2.94253 4.05759 3.20508 4.03613C3.45995 4.01533 3.77135 4.01563 4.13379 4.01563H11.8662C12.2287 4.01563 12.5401 4.01532 12.7949 4.03613C13.0572 4.05757 13.3171 4.10521 13.5664 4.23242L13.7031 4.30859C14.0136 4.4988 14.2668 4.77128 14.4336 5.09863L14.5146 5.28711C14.5828 5.4778 14.6138 5.67332 14.6299 5.87012C14.6507 6.1247 14.6504 6.43523 14.6504 6.79688V11.8691Z"
        fill="#0084FE"
      />
    </svg>
  );
}

// 읽은 메일 — 회색 봉투(열림)
function MailOpenedIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.49902 1.40025C7.82727 1.32943 8.17076 1.3305 8.49902 1.40123C8.90203 1.48795 9.25727 1.71346 9.71094 1.99107L9.72168 1.99888L9.72363 1.99986C9.72494 2.00069 9.72696 2.00214 9.72949 2.00377C9.73485 2.00719 9.74343 2.01269 9.75391 2.01939C9.77498 2.03286 9.80669 2.05244 9.84668 2.07798C9.9272 2.12943 10.0444 2.20426 10.1895 2.29673C10.4799 2.48191 10.8837 2.73905 11.3369 3.02623C12.2446 3.60146 13.3471 4.29592 14.1357 4.77818C14.1412 4.78155 14.146 4.7864 14.1514 4.7899C14.1712 4.80282 14.1895 4.8177 14.208 4.83287C14.2255 4.84723 14.2431 4.86096 14.2588 4.87681C14.2699 4.88811 14.2796 4.90072 14.29 4.91295C14.347 4.96442 14.3966 5.02607 14.4336 5.09849C14.5609 5.34781 14.6084 5.60786 14.6299 5.86998C14.6507 6.12468 14.6504 6.43581 14.6504 6.79771V11.869C14.6504 12.2308 14.6507 12.5413 14.6299 12.7958C14.6084 13.058 14.5605 13.3171 14.4336 13.5663C14.267 13.8927 14.0139 14.1669 13.7031 14.3573L13.5664 14.4335C13.3172 14.5606 13.0579 14.6083 12.7959 14.6297C12.5414 14.6506 12.2309 14.6493 11.8691 14.6493H4.13086C3.76922 14.6493 3.45868 14.6506 3.2041 14.6297C3.00732 14.6136 2.81177 14.5826 2.62109 14.5145L2.43262 14.4335C2.05972 14.2434 1.75652 13.9401 1.56641 13.5672C1.43944 13.3178 1.39156 13.0572 1.37012 12.7948C1.34931 12.5399 1.34961 12.2285 1.34961 11.8661V6.79966C1.34961 6.43711 1.34929 6.12586 1.37012 5.87095C1.39158 5.60848 1.43935 5.34891 1.56641 5.09947C1.60069 5.03219 1.64655 4.97497 1.69824 4.92564C1.70304 4.9197 1.70787 4.91385 1.71289 4.90806C1.72263 4.89683 1.73182 4.88529 1.74219 4.87486C1.7579 4.85909 1.77541 4.8452 1.79297 4.83091C1.80908 4.81779 1.82465 4.80425 1.8418 4.79283C1.84644 4.78973 1.85072 4.78606 1.85547 4.78306L6.28223 1.99595C6.28524 1.99404 6.28799 1.992 6.29102 1.99009C6.74229 1.71425 7.09635 1.48711 7.49902 1.40025ZM13.3477 6.37681C12.698 6.78135 11.9696 7.23855 11.3369 7.63951C10.8837 7.92671 10.4799 8.18381 10.1895 8.369C10.0443 8.4615 9.92722 8.5363 9.84668 8.58775C9.80664 8.61332 9.77499 8.63286 9.75391 8.64634C9.74339 8.65307 9.73487 8.65853 9.72949 8.66197C9.72692 8.66362 9.72495 8.66503 9.72363 8.66587L9.72168 8.66685L9.71094 8.67466C9.25722 8.9523 8.90206 9.17778 8.49902 9.26451C8.17075 9.33524 7.82728 9.33631 7.49902 9.26548C7.09637 9.17862 6.74228 8.95148 6.29102 8.67564C6.28803 8.67374 6.28521 8.6707 6.28223 8.6688L2.65137 6.38365C2.65021 6.50244 2.65039 6.63927 2.65039 6.79966V11.8661C2.65039 12.2501 2.65052 12.4996 2.66602 12.6893C2.68086 12.8708 2.70638 12.9405 2.72461 12.9764C2.79012 13.105 2.89488 13.2097 3.02344 13.2753L3.11133 13.3055C3.15574 13.316 3.2185 13.3264 3.30957 13.3338C3.49893 13.3493 3.74773 13.3495 4.13086 13.3495H11.8691C12.2521 13.3495 12.5003 13.3493 12.6895 13.3338C12.871 13.319 12.9403 13.2933 12.9756 13.2753C13.1042 13.2098 13.2098 13.105 13.2754 12.9764L13.3057 12.8876C13.3161 12.8431 13.3266 12.7806 13.334 12.6903C13.3495 12.5011 13.3496 12.2524 13.3496 11.869V6.79771C13.3496 6.63507 13.3489 6.49671 13.3477 6.37681ZM8.22559 2.67173C8.07789 2.6399 7.92112 2.63987 7.77344 2.67173L7.66504 2.70494C7.54414 2.75334 7.36704 2.85601 6.96875 3.09947L3.4209 5.33189L6.96875 7.56627C7.36696 7.80967 7.54414 7.91239 7.66504 7.9608L7.77344 7.994C7.92114 8.02587 8.07788 8.02584 8.22559 7.994C8.36168 7.96472 8.5005 7.89066 9.03223 7.56529C9.03749 7.56192 9.04486 7.55727 9.05371 7.55162C9.07494 7.53804 9.1062 7.51779 9.14648 7.49205C9.22734 7.44039 9.34465 7.36513 9.49023 7.27232C9.78145 7.08667 10.1862 6.82886 10.6406 6.54087C11.2426 6.15938 11.9344 5.72453 12.5645 5.33189C11.9346 4.9394 11.2423 4.50616 10.6406 4.12486C10.1862 3.8369 9.78143 3.57905 9.49023 3.39341C9.3447 3.30063 9.22732 3.22533 9.14648 3.17369C9.10624 3.14798 9.07493 3.12768 9.05371 3.11412C9.04491 3.10849 9.03748 3.1038 9.03223 3.10045C8.50057 2.77512 8.36167 2.70102 8.22559 2.67173Z"
        fill="#8D99A5"
      />
    </svg>
  );
}

// 메일함 바로가기 화살표
function InboxMoreArrow() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
    >
      <path
        d="M3.62754 1.33359C3.47522 1.48596 3.38965 1.69258 3.38965 1.90803C3.38965 2.12348 3.47522 2.3301 3.62754 2.48247L7.64941 6.50434L3.62754 10.5262C3.47953 10.6795 3.39764 10.8847 3.39949 11.0977C3.40134 11.3108 3.48679 11.5146 3.63743 11.6652C3.78808 11.8158 3.99186 11.9013 4.2049 11.9031C4.41793 11.905 4.62317 11.8231 4.77641 11.6751L9.37273 7.07878C9.52505 6.92641 9.61061 6.71979 9.61061 6.50434C9.61061 6.2889 9.52505 6.08227 9.37273 5.9299L4.77641 1.33359C4.62405 1.18127 4.41742 1.0957 4.20198 1.0957C3.98653 1.0957 3.7799 1.18127 3.62754 1.33359Z"
        fill="#1F2937"
      />
    </svg>
  );
}

type InboxTab = "mail" | "approval" | "task";

type ApprovalBadge = "pending" | "approved" | "rejected" | "cancelled";

interface InboxItem {
  id: string;
  title: string;
  sender: string;
  date: string;
  unread: boolean;
  urgent?: boolean;
  // 결재 탭에서 사용 — 결재 상태 뱃지 (대기/승인완료/반려/취소)
  approvalBadge?: ApprovalBadge;
}

interface MailListMessage {
  messageId: string;
  subject?: string;
  from?: {
    emailAddress?: {
      address?: string;
      name?: string;
    };
  };
  receivedTime?: string;
  sentTime?: string;
  isRead?: boolean;
}

// 받은 시각 → 'MM.DD' 형식 (KST)
function formatInboxDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const kst = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const day = String(kst.getDate()).padStart(2, "0");
  return `${m}.${day}`;
}

function InboxCard() {
  const [tab, setTab] = useState<InboxTab>("mail");

  // 메일 — 실제 API 연동
  const [mailItems, setMailItems] = useState<InboxItem[]>([]);
  const [mailLoading, setMailLoading] = useState(true);
  const [mailError, setMailError] = useState<string | null>(null);
  const [mailUnread, setMailUnread] = useState(0);
  const [mailCredsMissing, setMailCredsMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMailLoading(true);
    setMailError(null);
    setMailCredsMissing(false);
    fetch("/api/mail/list?folder=INBOX&count=6", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) {
          const data = await r.json().catch(() => ({}));
          if (data?.code === "MAIL_CREDENTIALS_REQUIRED") {
            if (!cancelled) setMailCredsMissing(true);
            return null;
          }
        }
        if (!r.ok) {
          throw new Error("메일을 불러오지 못했습니다.");
        }
        return r.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        const messages: MailListMessage[] = data.messages ?? [];
        const mapped: InboxItem[] = messages.map((m) => ({
          id: m.messageId,
          title: m.subject?.trim() || "(제목 없음)",
          sender:
            m.from?.emailAddress?.name ||
            m.from?.emailAddress?.address ||
            "이름",
          date: formatInboxDate(m.receivedTime ?? m.sentTime),
          unread: !m.isRead,
        }));
        setMailItems(mapped);
        setMailUnread(data.unreadCount ?? mapped.filter((m) => m.unread).length);
      })
      .catch((e: Error) => {
        if (!cancelled) setMailError(e.message);
      })
      .finally(() => {
        if (!cancelled) setMailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 결재 — 내 관련 결재문서 모두 (내가 신청한 것 + 내가 결재할 것)
  // tab=mine (모든 상태: 진행/완료/취소 등) + tab=pending (내가 결재할 PENDING)
  // 머지 후 중복 제거, 최신순 정렬, 상위 6건
  const [approvalItems, setApprovalItems] = useState<InboxItem[]>([]);
  const [approvalLoading, setApprovalLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setApprovalLoading(true);

    interface ApprovalRow {
      id: string;
      title?: string;
      document_type?: string;
      status?: string;
      created_at?: string;
      submitted_at?: string;
      applicant?: { display_name?: string };
    }
    const ACTIVE_STATUSES = new Set(["SUBMITTED", "IN_PROGRESS"]);

    Promise.all([
      fetch("/api/management/approvals?tab=mine", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      fetch("/api/management/approvals?tab=pending", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ])
      .then(([mineRaw, pendingRaw]) => {
        if (cancelled) return;
        const mine: ApprovalRow[] = Array.isArray(mineRaw) ? mineRaw : [];
        const pending: ApprovalRow[] = Array.isArray(pendingRaw)
          ? pendingRaw
          : [];

        // id 중복 제거 (mine 우선)
        const byId = new Map<string, ApprovalRow>();
        for (const r of mine) if (r?.id) byId.set(r.id, r);
        for (const r of pending) if (r?.id && !byId.has(r.id)) byId.set(r.id, r);

        const merged = Array.from(byId.values()).sort((a, b) => {
          const ta = new Date(a.submitted_at ?? a.created_at ?? 0).getTime();
          const tb = new Date(b.submitted_at ?? b.created_at ?? 0).getTime();
          return tb - ta;
        });

        const statusToBadge = (s: string | undefined): ApprovalBadge => {
          if (s === "APPROVED") return "approved";
          if (s === "REJECTED") return "rejected";
          if (s === "CANCELLED") return "cancelled";
          return "pending"; // SUBMITTED, IN_PROGRESS, DRAFT 등
        };

        const mapped: InboxItem[] = merged.slice(0, 6).map((r) => ({
          id: r.id,
          title: r.title?.trim() || r.document_type || "(제목 없음)",
          sender: r.applicant?.display_name ?? "-",
          date: formatInboxDate(r.submitted_at ?? r.created_at),
          // 활성 상태(진행 중/제출됨)면 강조 표시 — 완료/반려/취소는 일반 표시
          unread: ACTIVE_STATUSES.has(r.status ?? ""),
          approvalBadge: statusToBadge(r.status),
        }));
        setApprovalItems(mapped);
      })
      .finally(() => {
        if (!cancelled) setApprovalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const taskItems: InboxItem[] = [
    {
      id: "t1",
      title: "월간 보고 작성",
      sender: "팀장",
      date: "05.27",
      unread: true,
    },
  ];

  const counts = {
    mail: mailUnread,
    approval: approvalItems.filter((m) => m.unread).length,
    task: taskItems.filter((m) => m.unread).length,
  };
  const items =
    tab === "mail"
      ? mailItems
      : tab === "approval"
        ? approvalItems
        : taskItems;
  const hrefByTab: Record<InboxTab, string> = {
    mail: "/mail",
    approval: "/approvals",
    task: "/task-board",
  };
  const labelByTab: Record<InboxTab, string> = {
    mail: "메일함 바로가기",
    approval: "결재함 바로가기",
    task: "업무 요청 바로가기",
  };

  const renderBody = () => {
    if (tab === "mail") {
      if (mailLoading) {
        return <li className={styles.inboxEmpty}>메일 불러오는 중...</li>;
      }
      if (mailCredsMissing) {
        return (
          <li className={styles.inboxEmpty}>
            <Link href="/me/mail-settings" className={styles.inboxMoreLink}>
              메일 설정에서 자격증명을 등록해주세요
            </Link>
          </li>
        );
      }
      if (mailError) {
        return <li className={styles.inboxEmpty}>{mailError}</li>;
      }
    }
    if (tab === "approval" && approvalLoading) {
      return <li className={styles.inboxEmpty}>결재 문서 불러오는 중...</li>;
    }
    if (items.length === 0) {
      return <li className={styles.inboxEmpty}>표시할 항목이 없습니다.</li>;
    }
    return items.map((it) => {
      // 메일/결재 탭: 클릭 시 디테일 페이지 ?id= 로 진입
      // 업무 탭: 현재 mock 데이터 — 추후 디테일 경로 생기면 동일 패턴으로 확장
      const href =
        tab === "mail"
          ? `/mail?id=${encodeURIComponent(it.id)}`
          : tab === "approval"
            ? `/approvals?id=${encodeURIComponent(it.id)}`
            : null;
      const badgeMeta: Record<ApprovalBadge, { label: string; className: string }> = {
        pending: { label: "대기", className: styles.inboxItemBadgePending },
        approved: { label: "승인완료", className: styles.inboxItemBadgeApproved },
        rejected: { label: "반려", className: styles.inboxItemBadgeRejected },
        cancelled: { label: "취소", className: styles.inboxItemBadgeCancelled },
      };
      const badge = it.approvalBadge ? badgeMeta[it.approvalBadge] : null;

      const inner = (
        <>
          <span className={styles.inboxItemIcon}>
            {it.unread ? <MailSealedIcon /> : <MailOpenedIcon />}
          </span>
          <div className={styles.inboxItemBody}>
            <div className={styles.inboxItemTitleRow}>
              <span
                className={`${styles.inboxItemTitle} ${it.unread ? styles.inboxItemTitleUnread : ""}`}
              >
                {it.title}
              </span>
              {it.urgent && (
                <span className={styles.inboxItemUrgent}>긴급</span>
              )}
              {badge && (
                <span className={badge.className}>{badge.label}</span>
              )}
            </div>
            <span className={styles.inboxItemSender}>{it.sender}</span>
          </div>
          <span className={styles.inboxItemDate}>{it.date}</span>
        </>
      );
      return (
        <li key={it.id} className={styles.inboxItem}>
          {href ? (
            <Link href={href} className={styles.inboxItemLink}>
              {inner}
            </Link>
          ) : (
            inner
          )}
        </li>
      );
    });
  };

  return (
    <section className={styles.inboxCard}>
      <div className={styles.inboxTabs}>
        <button
          type="button"
          className={`${styles.inboxTab} ${tab === "mail" ? styles.inboxTabActive : ""}`}
          onClick={() => setTab("mail")}
        >
          메일 <span className={styles.inboxTabCount}>{counts.mail}</span>
        </button>
        <button
          type="button"
          className={`${styles.inboxTab} ${tab === "approval" ? styles.inboxTabActive : ""}`}
          onClick={() => setTab("approval")}
        >
          결재 <span className={styles.inboxTabCount}>{counts.approval}</span>
        </button>
        <button
          type="button"
          className={`${styles.inboxTab} ${tab === "task" ? styles.inboxTabActive : ""}`}
          onClick={() => setTab("task")}
        >
          업무 요청{" "}
          <span className={styles.inboxTabCount}>{counts.task}</span>
        </button>
      </div>

      <ul className={styles.inboxList}>{renderBody()}</ul>

      <Link href={hrefByTab[tab]} className={styles.inboxMoreLink}>
        {labelByTab[tab]}
        <InboxMoreArrow />
      </Link>
    </section>
  );
}

// 등록률 랭킹 카드 — 담당자별 당월 등록률 (1~3위 메달, 4위↓ 번호 배지)
const RANK_MEDALS = ["gold", "silver", "bronze"];

function RegistrationRanking({
  monthLabel,
  items,
}: {
  monthLabel: string;
  items: RankItem[];
}) {
  return (
    <section
      className={`${styles.card} ${styles.sourceCard} ${styles.rankCard}`}
    >
      <div className={styles.rankHead}>
        <h3 className={styles.rankTitle}>등록률 랭킹</h3>
        <span className={styles.rankMonth}>{monthLabel}</span>
      </div>
      <div className={styles.rankList}>
        {items.length === 0 ? (
          <div className={styles.rankEmpty}>이번 달 데이터가 없습니다</div>
        ) : (
          items.map((it, i) => {
            const pct = Math.round(it.rate);
            return (
              <div
                key={it.name}
                className={`${styles.rankRow}${it.isMe ? ` ${styles.rankRowMe}` : ""}`}
              >
                <div className={styles.rankRowTop}>
                  <div className={styles.rankWho}>
                    {i < 3 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className={styles.rankMedal}
                        src={`/${RANK_MEDALS[i]}.png`}
                        alt={`${i + 1}위`}
                        width={20}
                        height={20}
                      />
                    ) : (
                      <span className={styles.rankNum}>{i + 1}</span>
                    )}
                    <span className={styles.rankName}>{it.name}</span>
                  </div>
                  <span className={styles.rankPct}>{pct}%</span>
                </div>
                <div className={styles.rankBarRow}>
                  <div className={styles.rankTrack}>
                    <div
                      className={styles.rankFill}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
