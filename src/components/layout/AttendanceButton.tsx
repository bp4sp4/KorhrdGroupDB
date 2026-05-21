"use client";

import { useEffect, useState, useCallback } from "react";
import { LogIn, LogOut } from "lucide-react";
import styles from "./AttendanceButton.module.css";

interface TodayRecord {
  id: number;
  date: string;
  clock_in_at: string;
  clock_out_at: string | null;
}

function formatKstTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

export default function AttendanceButton() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [today, setToday] = useState<TodayRecord | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance/me", { cache: "no-store" });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setToday(data.todayRecord);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const t = setInterval(fetchStatus, 60_000);
    return () => clearInterval(t);
  }, [fetchStatus]);

  const handleClockIn = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/attendance/clock-in", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "출근 처리 실패");
      } else {
        await fetchStatus();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClockOut = async () => {
    if (submitting) return;
    if (!confirm("퇴근 처리하시겠습니까?")) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/attendance/clock-out", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "퇴근 처리 실패");
      } else {
        await fetchStatus();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.wrap}>
        <button className={`${styles.btn} ${styles.btnDisabled}`} disabled>
          ...
        </button>
      </div>
    );
  }

  // 케이스 1: 오늘 출근 안 함
  if (!today) {
    return (
      <div className={styles.wrap}>
        <button
          className={`${styles.btn} ${styles.btnIn}`}
          onClick={handleClockIn}
          disabled={submitting}
          title="출근하기"
        >
          <LogIn size={14} />
          출근하기
        </button>
      </div>
    );
  }

  // 케이스 2: 출근만 한 상태 → 퇴근 버튼
  if (!today.clock_out_at) {
    return (
      <div className={styles.wrap}>
        <span className={`${styles.statusChip} ${styles.statusChipActive}`}>
          <span className={styles.dot} />
          {formatKstTime(today.clock_in_at)} 출근
        </span>
        <button
          className={`${styles.btn} ${styles.btnOut}`}
          onClick={handleClockOut}
          disabled={submitting}
          title="퇴근하기"
        >
          <LogOut size={14} />
          퇴근하기
        </button>
      </div>
    );
  }

  // 케이스 3: 퇴근 완료
  return (
    <div className={styles.wrap}>
      <span className={styles.statusChip}>
        {formatKstTime(today.clock_in_at)} ~ {formatKstTime(today.clock_out_at)}
      </span>
    </div>
  );
}
