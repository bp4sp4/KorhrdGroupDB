"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CLOCK_OUT_CONFIRM } from "@/lib/attendance";
import styles from "./layout.module.css";

type CommuteState = "loading" | "in" | "working" | "done";

export default function CommuteButton() {
  const [state, setState] = useState<CommuteState>("loading");
  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/attendance/me", { cache: "no-store" });
      if (!res.ok) {
        setState("in");
        return;
      }
      const d = (await res.json()) as {
        todayRecord?: {
          clock_in_at?: string | null;
          clock_out_at?: string | null;
        } | null;
      };
      const t = d.todayRecord;
      if (!t || !t.clock_in_at) setState("in");
      else if (!t.clock_out_at) setState("working");
      else setState("done");
    } catch {
      setState("in");
    }
  };

  useEffect(() => {
    void load();
    // 같은 탭(헤더·대시보드·근태현황) 즉시 동기화 — 커스텀 이벤트
    const onChanged = () => void load();
    window.addEventListener("attendance-changed", onChanged);
    // 다른 탭/기기 — Supabase 실시간
    const supabase = createClient();
    const channel = supabase
      .channel("commute-attendance-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      window.removeEventListener("attendance-changed", onChanged);
      supabase.removeChannel(channel);
    };
  }, []);

  const act = async (path: "clock-in" | "clock-out") => {
    setBusy(true);
    try {
      const res = await fetch(`/api/attendance/${path}`, { method: "POST" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert((e as { error?: string }).error ?? "처리에 실패했습니다.");
      }
      await load();
      window.dispatchEvent(new Event("attendance-changed"));
    } catch {
      alert("처리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return null;

  if (state === "done") {
    return <span className={styles.commuteDone}>퇴근완료</span>;
  }

  if (state === "working") {
    return (
      <>
        <button
          type="button"
          className={styles.commuteOut}
          onClick={() => setConfirmOut(true)}
          disabled={busy}
        >
          <ArrowLeft size={12} /> 퇴근하기
        </button>
        <ConfirmDialog
          open={confirmOut}
          {...CLOCK_OUT_CONFIRM}
          onConfirm={() => {
            setConfirmOut(false);
            void act("clock-out");
          }}
          onCancel={() => setConfirmOut(false)}
        />
      </>
    );
  }

  return (
    <button
      type="button"
      className={styles.commuteIn}
      onClick={() => act("clock-in")}
      disabled={busy}
    >
      <ArrowRight size={12} /> 출근하기
    </button>
  );
}
