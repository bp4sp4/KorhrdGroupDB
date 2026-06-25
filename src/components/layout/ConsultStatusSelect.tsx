"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./layout.module.css";

// 상담 가능 상태 — 헤더 토글.
//   /api/consult-availability (app_settings: presence.consult_available.{uid}) 에 저장 →
//   "영업 상담 가능 현황" 바와 동일 데이터 공유 + Supabase Realtime 으로 양방향 실시간 반영.
const OPTIONS = ["상담가능", "상담불가"];

const SALES_TEAM_CODE = "KORHRD003"; // 사업본부 영업팀

export default function ConsultStatusSelect() {
  const [value, setValue] = useState("상담가능");
  const [open, setOpen] = useState(false);
  // 영업팀에게만 노출 (false=확인 전/대상 아님 → 렌더 안 함)
  const [show, setShow] = useState(false);
  const [myId, setMyId] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  // 영업팀 여부 + 본인 id 확인
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setShow(d.teamCode === SALES_TEAM_CODE);
        if (typeof d.id === "number") setMyId(d.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // DB에 저장된 현재 상태 로드 + 다른 화면(관리자 등)에서 바뀐 것 실시간 반영
  useEffect(() => {
    if (myId == null) return;
    let cancelled = false;

    const loadMine = () => {
      fetch("/api/consult-availability", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled || !d || !Array.isArray(d.roster)) return;
          const mine = (d.roster as { userId: number; available: boolean }[]).find(
            (x) => x.userId === myId,
          );
          if (mine) setValue(mine.available ? "상담가능" : "상담불가");
        })
        .catch(() => {});
    };
    loadMine();

    let debounce: ReturnType<typeof setTimeout> | null = null;
    const supabase = createClient();
    const channel = supabase
      .channel("consult-status-header")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        () => {
          if (debounce) return;
          debounce = setTimeout(() => {
            debounce = null;
            loadMine();
          }, 600);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [myId]);

  // 바깥 클릭 시 메뉴 닫기
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pick = (v: string) => {
    setOpen(false);
    if (v === value || myId == null) return;
    const prev = value;
    setValue(v); // 낙관적 업데이트
    fetch("/api/consult-availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: myId, available: v === "상담가능" }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("fail");
      })
      .catch(() => {
        setValue(prev); // 실패 시 롤백
      });
  };

  const off = value !== "상담가능";

  if (!show) return null;

  return (
    <>
      <div className={styles.statusWrap} ref={ref}>
        <button
          type="button"
          className={styles.statusTrigger}
          onClick={() => setOpen((o) => !o)}
        >
          <span
            className={`${styles.statusDot} ${off ? styles.statusDotOff : ""}`}
          />
          <span className={styles.statusLabel}>{value}</span>
          <ChevronDown size={14} className={styles.statusChev} />
        </button>
        {open && (
          <ul className={styles.statusMenu}>
            {OPTIONS.map((o) => (
              <li key={o}>
                <button
                  type="button"
                  className={`${styles.statusMenuItem} ${o === value ? styles.statusMenuItemOn : ""}`}
                  onClick={() => pick(o)}
                >
                  {o}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.headerDivider} />
    </>
  );
}
