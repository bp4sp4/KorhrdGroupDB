"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

interface RosterRow {
  userId: number;
  name: string;
  team: string | null;
  status: "active" | "away" | "offline";
  lastSeen: string | null;
}

const STATUS_LABEL: Record<RosterRow["status"], string> = {
  active: "활동 중",
  away: "자리 비움",
  offline: "오프라인",
};

function relTime(iso: string | null): string {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function PresenceBoard() {
  const [rows, setRows] = useState<RosterRow[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/presence?roster=1", { cache: "no-store" });
      if (!res.ok) return;
      const d = (await res.json()) as { roster?: RosterRow[] };
      setRows(d.roster ?? []);
      setUpdatedAt(new Date().toLocaleTimeString("ko-KR"));
    } catch {
      /* ignore */
    }
  }, []);

  // 실시간 — user_presence 변경(하트비트) 구독 + 안전 폴링(자리비움 staleness 갱신)
  useEffect(() => {
    void load();

    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (debounce) return;
      debounce = setTimeout(() => {
        debounce = null;
        void load();
      }, 5000);
    };

    const supabase = createClient();
    const channel = supabase
      .channel("user-presence-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        scheduleReload,
      )
      .subscribe();

    timer.current = setInterval(load, 30000);

    return () => {
      if (timer.current) clearInterval(timer.current);
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const count = (s: RosterRow["status"]) =>
    rows?.filter((r) => r.status === s).length ?? 0;

  return (
    <div className={styles.board}>
      <div className={styles.header}>
        <div>
          <p className={styles.hint}>
            자리 비움은 보조 신호입니다(4분 이상 무입력·탭 닫힘 → 자리 비움 /
            로그인 기록 없으면 오프라인). 자동 갱신.
            {updatedAt && ` · 갱신 ${updatedAt}`}
          </p>
        </div>
        <div className={styles.summary}>
          <span className={`${styles.sumItem} ${styles.sActive}`}>
            <i className={styles.dot} /> 활동 중 {count("active")}
          </span>
          <span className={`${styles.sumItem} ${styles.sAway}`}>
            <i className={styles.dot} /> 자리 비움 {count("away")}
          </span>
          <span className={`${styles.sumItem} ${styles.sOffline}`}>
            <i className={styles.dot} /> 오프라인 {count("offline")}
          </span>
        </div>
      </div>

      {rows === null ? (
        <div className={styles.empty}>불러오는 중...</div>
      ) : rows.length === 0 ? (
        <div className={styles.empty}>표시할 직원이 없습니다.</div>
      ) : (
        <div className={styles.grid}>
          {rows.map((r) => (
            <div key={r.userId} className={styles.card}>
              <span className={`${styles.statusDot} ${styles[r.status]}`} />
              <div className={styles.cardMain}>
                <span className={styles.name}>{r.name}</span>
                <span className={styles.team}>{r.team ?? "-"}</span>
              </div>
              <div className={styles.cardRight}>
                <span className={`${styles.badge} ${styles[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
                <span className={styles.last}>{relTime(r.lastSeen)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
