"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  TrendingUp,
  Wallet,
  Mail,
  CalendarDays,
  Megaphone,
  Target,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import styles from "./page.module.css";
import { CLOCK_OUT_CONFIRM, getTodayKstDate } from "@/lib/attendance";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

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

  // 오늘의 문의 출처 — 탭 (mock 데이터로 디자인 우선, 추후 API 연결)
  const [sourceTab, setSourceTab] = useState<"me" | "company">("me");
  const sourceData =
    sourceTab === "me"
      ? [
          { name: "당근", count: 127, color: "#FF6B35" },
          { name: "지인소개", count: 124, color: "#6B7280" },
          { name: "맘카페", count: 27, color: "#22C55E" },
          { name: "기타", count: 8, color: "#3B82F6" },
        ]
      : [
          { name: "당근", count: 542, color: "#FF6B35" },
          { name: "지인소개", count: 318, color: "#6B7280" },
          { name: "맘카페", count: 224, color: "#22C55E" },
          { name: "네이버", count: 91, color: "#3B82F6" },
        ];
  const sourceTotal = sourceData.reduce((s, x) => s + x.count, 0);

  // 매초 갱신 (시계용)
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // 로그인 사용자 이름 (인사말용)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.displayName) setUserName(d.displayName);
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
      }
    } finally {
      setSubmitting(false);
    }
  };

  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);

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
          {/* 오늘 근무시간 + 진행 바 */}
          <div className={styles.attWeekBlock}>
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

            <div className={styles.attProgressWrap}>
              <div className={styles.attProgressBar}>
                <div
                  className={`${styles.attProgressFill} ${fillCls}`}
                  style={{
                    width: `${pctFill}%`,
                    minWidth: isWorking || isDone ? 56 : 0,
                  }}
                >
                  {(isWorking || isDone) && (
                    <video
                      key={isWorking ? "work" : "finish"}
                      className={styles.attBotVideo}
                      src={isDone ? "/finish.mp4" : "/work.mp4"}
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  )}
                </div>
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

        {/* 1행 중: 이번달 목표 현황 — mock 데이터 */}
        <section className={`${styles.card} ${styles.goalCard}`}>
          <div className={styles.goalHead}>
            <h3 className={styles.cardTitle}>이번달 목표 현황</h3>
            <button type="button" className={styles.goalSettingBtn}>
              <Target size={14} />
              <span>목표 설정</span>
            </button>
          </div>

          {(() => {
            const monthLabel = `${new Date().getMonth() + 1}월`;
            const goalTotal = 1500;
            const goalAchieved = 1024;
            const pct = Math.round((goalAchieved / goalTotal) * 100);
            const circumference = 2 * Math.PI * 44;
            const dashLen = (pct / 100) * circumference;
            const weekly = [
              { week: "1주차", value: 120, target: 200 },
              { week: "2주차", value: 160, target: 200 },
              { week: "3주차", value: 106, target: 200, current: true },
              { week: "4주차", value: 160, target: 200 },
              { week: "5주차", value: 160, target: 200 },
            ];
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
                        strokeDasharray={`${(pct / 100) * 2 * Math.PI * 32} ${2 * Math.PI * 32}`}
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
                    const wpct = Math.min(
                      100,
                      Math.round((w.value / w.target) * 100),
                    );
                    return (
                      <div
                        key={w.week}
                        className={`${styles.goalWeekRow} ${w.current ? styles.goalWeekRowCurrent : ""}`}
                      >
                        <div className={styles.goalWeekTopRow}>
                          <span className={styles.goalWeekLabel}>{w.week}</span>
                          <span className={styles.goalWeekPct}>{wpct}%</span>
                        </div>
                        <div className={styles.goalWeekBottomRow}>
                          <div className={styles.goalWeekBar}>
                            <span
                              className={styles.goalWeekFill}
                              style={{ width: `${wpct}%` }}
                            />
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
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </section>

        {/* 1행 우: 오늘의 문의 출처 */}
        <section className={`${styles.card} ${styles.sourceCard}`}>
          <div className={styles.sourceHead}>
            <h3 className={styles.cardTitle}>오늘의 문의 출처</h3>
            <div className={styles.sourceTabs}>
              <button
                type="button"
                className={`${styles.sourceTab} ${sourceTab === "me" ? styles.sourceTabActive : ""}`}
                onClick={() => setSourceTab("me")}
              >
                내 문의
              </button>
              <button
                type="button"
                className={`${styles.sourceTab} ${sourceTab === "company" ? styles.sourceTabActive : ""}`}
                onClick={() => setSourceTab("company")}
              >
                회사 문의
              </button>
            </div>
          </div>

          {/* TOP 1 강조 + 우측 오늘 총 건수 */}
          {sourceData[0] && (
            <div className={styles.sourceTopRow}>
              <div className={styles.sourceTopLabel}>
                <span
                  className={styles.sourceDot}
                  style={{ background: sourceData[0].color }}
                />
                <span className={styles.sourceTopName}>
                  {sourceData[0].name}
                </span>
                <span className={styles.sourceTopCount}>
                  {sourceData[0].count}건
                </span>
              </div>
              <span className={styles.sourceTotalChip}>
                오늘 총 {sourceTotal.toLocaleString()}건
              </span>
            </div>
          )}

          {/* 가로 누적 막대 */}
          <div className={styles.sourceBar}>
            {sourceData.map((s) => (
              <span
                key={s.name}
                className={styles.sourceBarSegment}
                style={{
                  width: `${(s.count / sourceTotal) * 100}%`,
                  background: s.color,
                }}
                title={`${s.name} ${s.count}건`}
              />
            ))}
          </div>

          {/* TOP 3 */}
          <div className={styles.sourceTop3Box}>
            <span className={styles.sourceTop3Title}>오늘의 TOP 3</span>
            <ul className={styles.sourceTop3List}>
              {sourceData.slice(0, 3).map((s) => {
                const pct =
                  sourceTotal > 0
                    ? Math.round((s.count / sourceTotal) * 100)
                    : 0;
                return (
                  <li key={s.name} className={styles.sourceTop3Item}>
                    <span
                      className={styles.sourceDot}
                      style={{ background: s.color }}
                    />
                    <span className={styles.sourceTop3Name}>{s.name}</span>
                    <span className={styles.sourceTop3Count}>{s.count}건</span>
                    <span className={styles.sourceTop3Pct}>· {pct}%</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* 2행: 통계 4개 (업무일지와 동일 디자인) */}
        <section className={styles.statsRow}>
          <div className={styles.statGroup}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <Users size={32} />
              </div>
              <span className={styles.statLabel}>전체문의</span>
              <span className={styles.statValue}>
                {(stats?.totalInquiries ?? 0).toLocaleString()}건
              </span>
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

        {/* 3행 좌: 메일 / 결재문서 */}
        <section className={`${styles.card} ${styles.mailCard}`}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>메일 / 결재문서</h3>
          </div>
          <ComingSoon icon={<Mail size={20} />} text="곧 연결 예정" />
        </section>

        {/* 3행 중: 캘린더 */}
        <section className={`${styles.card} ${styles.calendarCard}`}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>캘린더</h3>
            <span className={styles.cardSub}>
              연락예정/중요일정/연차/업무요청
            </span>
          </div>
          <ComingSoon icon={<CalendarDays size={20} />} text="곧 연결 예정" />
        </section>

        {/* 3행 우: 게시판 */}
        <section className={`${styles.card} ${styles.boardCard}`}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>게시판</h3>
            <span className={styles.cardSub}>공지 / 업무 / 회사 알림</span>
          </div>
          <ComingSoon icon={<Megaphone size={20} />} text="곧 연결 예정" />
        </section>

        {/* 4행: 전사 KPI 목표 */}
        <section className={`${styles.card} ${styles.kpiCard}`}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>전사 KPI 목표</h3>
          </div>
          <ComingSoon icon={<Sparkles size={20} />} text="곧 연결 예정" />
        </section>
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
