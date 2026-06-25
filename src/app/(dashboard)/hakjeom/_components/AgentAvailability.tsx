"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./AgentAvailability.module.css";

// 영업 직원 상담 가능 여부 — 수동 토글 (담당자 배정 참고용)
//   클릭하면 상담 가능 ↔ 상담 불가 전환 (관리자: 전체 / 일반: 본인만)

type Agent = { userId: number; name: string; available: boolean };

export default function AgentAvailability() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [canEditAll, setCanEditAll] = useState(false);
  const [myId, setMyId] = useState<number | null>(null);

  const load = useCallback(() => {
    fetch("/api/consult-availability", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !Array.isArray(d.roster)) return;
        setAgents(d.roster as Agent[]);
        setCanEditAll(!!d.canEditAll);
        setMyId(typeof d.myId === "number" ? d.myId : null);
      })
      .catch(() => {});
  }, []);

  // 실시간 — app_settings 변경(상담 가능/불가 토글) 구독 + 안전 폴링(구독 끊김 대비)
  useEffect(() => {
    load();

    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (debounce) return;
      debounce = setTimeout(() => {
        debounce = null;
        load();
      }, 600);
    };

    const supabase = createClient();
    const channel = supabase
      .channel("consult-availability-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        scheduleReload,
      )
      .subscribe();

    const t = setInterval(load, 60000);

    return () => {
      clearInterval(t);
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const toggle = (a: Agent) => {
    if (!(canEditAll || a.userId === myId)) return;
    const next = !a.available;
    setAgents((prev) =>
      prev.map((x) => (x.userId === a.userId ? { ...x, available: next } : x)),
    );
    fetch("/api/consult-availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: a.userId, available: next }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("fail");
      })
      .catch(() => {
        // 실패 시 롤백
        setAgents((prev) =>
          prev.map((x) =>
            x.userId === a.userId ? { ...x, available: a.available } : x,
          ),
        );
      });
  };

  if (agents.length === 0) return null;
  const availableCount = agents.filter((a) => a.available).length;

  return (
    <div className={styles.bar}>
      <div className={styles.head}>
        <span className={styles.title}>영업 상담 가능 현황</span>
        <span className={styles.summary}>
          상담 가능 <b>{availableCount}</b> / {agents.length}명
        </span>
      </div>
      <div className={styles.list}>
        {agents.map((a) => {
          const editable = canEditAll || a.userId === myId;
          return (
            <button
              key={a.userId}
              type="button"
              disabled={!editable}
              onClick={() => toggle(a)}
              title={editable ? "클릭해서 상담 가능/불가 변경" : undefined}
              className={`${styles.chip} ${
                a.available ? styles.chipOk : styles.chipNo
              } ${editable ? styles.chipEditable : ""}`}
            >
              <span className={styles.dot} />
              <span className={styles.name}>{a.name}</span>
              <span className={styles.statusLabel}>
                {a.available ? "상담 가능" : "상담 불가"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
