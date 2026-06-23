"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./layout.module.css";

// 상담 가능 상태 — 헤더 표시(로컬 저장). 추후 배정 연동 가능.
const OPTIONS = ["상담가능", "상담불가"];

const SALES_TEAM_CODE = "KORHRD003"; // 사업본부 영업팀

export default function ConsultStatusSelect() {
  const [value, setValue] = useState("상담가능");
  const [open, setOpen] = useState(false);
  // 영업팀에게만 노출 (null=확인 전 → 렌더 안 함)
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setShow(d?.teamCode === SALES_TEAM_CODE);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem("consultStatus");
      if (v && OPTIONS.includes(v)) setValue(v);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pick = (v: string) => {
    setValue(v);
    try {
      localStorage.setItem("consultStatus", v);
    } catch {
      /* ignore */
    }
    setOpen(false);
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
