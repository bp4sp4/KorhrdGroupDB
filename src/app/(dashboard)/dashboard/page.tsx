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

  // 매초 갱신 (시계용)
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
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
          <h3 className={styles.attTitle}>근태</h3>

          <div className={styles.attDateRow}>
            <span className={styles.attDateText}>{formatNowFull()}</span>
            {isWorking ? (
              <span className={`${styles.attBadge} ${styles.attBadgeWorking}`}>
                근무중
              </span>
            ) : isDone ? (
              <span className={`${styles.attBadge} ${styles.attBadgeDone}`}>
                퇴근
              </span>
            ) : (
              <span className={`${styles.attBadge} ${styles.attBadgeOff}`}>
                출근전
              </span>
            )}
          </div>

          {/* 출근시간 → 퇴근시간 박스 */}
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
                {todayRec?.clock_out_at ? formatTime(todayRec.clock_out_at) : "-"}
              </span>
            </div>
          </div>

          {/* 주간 누적 + 진행 바 */}
          <div className={styles.attWeekBlock}>
            <div className={styles.attWeekTitleRow}>
              <span className={styles.attWeekLabel}>주간누적</span>
              <span className={styles.attWeekValue}>
                {weekH}h {String(weekM).padStart(2, "0")}m
              </span>
            </div>
            <span className={styles.attWeekHint}>{needText}</span>

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
              <div
                className={styles.attMarkerLabel}
                style={{ right: 0 }}
              >
                52h
              </div>
            </div>
          </div>

          {/* 출근/퇴근 버튼 */}
          <div className={styles.attActions}>
            <button
              type="button"
              className={styles.attActionBtn}
              onClick={handleClockIn}
              disabled={!!todayRec || submitting || loading}
            >
              출근하기
            </button>
            <button
              type="button"
              className={styles.attActionBtn}
              onClick={handleClockOut}
              disabled={!isWorking || submitting}
            >
              퇴근하기
            </button>
          </div>
        </section>

        {/* 1행 중: 이번달 목표 현황 */}
        <section className={`${styles.card} ${styles.goalCard}`}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>이번달 목표 현황</h3>
            <span className={styles.cardSub}>목표 설정</span>
          </div>
          <ComingSoon icon={<Target size={20} />} text="곧 연결 예정" />
        </section>

        {/* 1행 우: 오늘의 문의 출처 */}
        <section className={`${styles.card} ${styles.sourceCard}`}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>오늘의 문의 출처</h3>
            <span className={styles.cardSub}>내 문의 / 회사 문의</span>
          </div>
          <ComingSoon icon={<TrendingUp size={20} />} text="곧 연결 예정" />
        </section>

        {/* 2행: 통계 4개 카드 */}
        <section className={styles.statsRow}>
          <StatBox
            icon={<Users size={20} />}
            label="전체문의"
            value="— 건"
            sub="곧 연결 예정"
          />
          <StatBox
            icon={<UserPlus size={20} />}
            label="등록 건수"
            value="— 건"
            sub="전일 대비"
          />
          <StatBox
            icon={<TrendingUp size={20} />}
            label="등록률"
            value="—%"
            sub="전일 대비"
          />
          <StatBox
            icon={<Wallet size={20} />}
            label="매출"
            value="— 만원"
            sub="전일 대비"
          />
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
            <span className={styles.cardSub}>연락예정/중요일정/연차/업무요청</span>
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

function ComingSoon({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className={styles.comingSoon}>
      <div className={styles.comingSoonIcon}>{icon}</div>
      <div className={styles.comingSoonText}>{text}</div>
    </div>
  );
}
