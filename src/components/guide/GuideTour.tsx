"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { GuideStep } from "@/lib/guide/steps";
import styles from "./GuideTour.module.css";

interface Props {
  steps: GuideStep[];
  open: boolean;
  onClose: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOOLTIP_WIDTH = 360;
const TOOLTIP_GAP = 12;

export default function GuideTour({ steps, open, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const current = steps[index];

  // 타겟 위치 측정 — target 본체 + 열린 dropdown/포털 자식까지 포함한 union rect
  const measure = useCallback(() => {
    if (!current?.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(current.target);
    if (!el) {
      return;
    }
    const baseRect = el.getBoundingClientRect();
    const rects: DOMRect[] = [baseRect];
    el.querySelectorAll<HTMLElement>("*").forEach((child) => {
      const r = child.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      // 너무 크거나 화면 밖인 자식 (전역 backdrop 등) 은 무시
      if (r.width > window.innerWidth * 1.5) return;
      if (r.height > window.innerHeight * 1.5) return;
      rects.push(r);
    });
    const top = Math.min(...rects.map((r) => r.top));
    const left = Math.min(...rects.map((r) => r.left));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    const pad = 6;
    setRect({
      top: top - pad,
      left: left - pad,
      width: right - left + pad * 2,
      height: bottom - top + pad * 2,
    });
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [current]);

  // 단계 진입 시: clickSelector가 있으면 클릭 시뮬레이션 + fireEvent가 있으면 윈도우 이벤트 발행
  useEffect(() => {
    if (!open || !current) return;
    if (current.fireEvent) {
      // "eventName:type" 포맷이면 detail로 type 전달
      const [name, ...rest] = current.fireEvent.split(":");
      if (rest.length > 0) {
        window.dispatchEvent(
          new CustomEvent(name, { detail: { type: rest.join(":") } }),
        );
      } else {
        window.dispatchEvent(new CustomEvent(name));
      }
    }
    if (current.clickSelector) {
      const el = document.querySelector<HTMLElement>(current.clickSelector);
      if (el) {
        try {
          el.click();
        } catch {
          /* ignore */
        }
      }
    }
  }, [open, current]);

  // advanceOn 이벤트 발생 시 즉시 다음 단계로
  useEffect(() => {
    if (!open || !current?.advanceOn) return;
    const evt = current.advanceOn;
    const handler = () => {
      setIndex((i) => (i + 1 < steps.length ? i + 1 : i));
    };
    window.addEventListener(evt, handler);
    return () => window.removeEventListener(evt, handler);
  }, [open, current, steps.length]);

  // autoAdvanceMs — N ms 뒤 자동으로 다음 단계로 (시뮬레이션용)
  useEffect(() => {
    if (!open || !current?.autoAdvanceMs) return;
    const t = setTimeout(() => {
      setIndex((i) => (i + 1 < steps.length ? i + 1 : i));
    }, current.autoAdvanceMs);
    return () => clearTimeout(t);
  }, [open, current, steps.length]);

  // 타겟이 아직 DOM에 없을 수 있으니 짧게 폴링 + MutationObserver로 자식 변경 시 재측정
  useLayoutEffect(() => {
    if (!open) return;
    measure();
    let cancelled = false;
    const start = Date.now();
    const wait = current?.waitMs ?? 600;
    const poll = () => {
      if (cancelled || !current?.target) return;
      const found = document.querySelector(current.target);
      if (found) {
        measure();
        return;
      }
      if (Date.now() - start < wait) {
        setTimeout(poll, 60);
      }
    };
    setTimeout(poll, 60);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);

    // 타겟 안 변화 (dropdown 열림 등) 감지 → 재측정
    let observer: MutationObserver | null = null;
    const setupObserver = () => {
      if (!current?.target) return;
      const el = document.querySelector(current.target);
      if (!el) return;
      observer = new MutationObserver(() => measure());
      observer.observe(el, { childList: true, subtree: true, attributes: true });
    };
    setTimeout(setupObserver, 100);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      if (observer) observer.disconnect();
    };
  }, [open, measure, current]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  if (!open || !current) return null;

  const total = steps.length;
  const isLast = index >= total - 1;
  const isFirst = index === 0;

  function next() {
    if (isLast) {
      onClose();
    } else {
      setIndex((i) => Math.min(total - 1, i + 1));
    }
  }
  function prev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  // 툴팁 위치 계산 — 타겟이 있으면 placement 기반, 없으면 중앙 / compact면 코너
  let tooltipStyle: React.CSSProperties;
  let tooltipClass = styles.tooltip;
  const isCompact = !!current.compact;
  if (!rect) {
    tooltipClass = isCompact
      ? `${styles.tooltip} ${styles.tooltipCorner}`
      : `${styles.tooltip} ${styles.tooltipCenter}`;
    tooltipStyle = {};
  } else {
    const placement = current.placement ?? "bottom";
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;

    let top = 0;
    let left = 0;
    if (placement === "bottom") {
      top = rect.top + rect.height + TOOLTIP_GAP;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    } else if (placement === "top") {
      top = rect.top - TOOLTIP_GAP - 200;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    } else if (placement === "left") {
      top = rect.top + rect.height / 2 - 80;
      left = rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP;
    } else {
      // right
      top = rect.top + rect.height / 2 - 80;
      left = rect.left + rect.width + TOOLTIP_GAP;
    }
    // 화면 밖 보정
    left = Math.max(16, Math.min(vw - TOOLTIP_WIDTH - 16, left));
    top = Math.max(16, Math.min(vh - 200, top));
    tooltipStyle = { top, left };
  }

  // 외부 클릭 차단용 4-패널 (spotlight 영역은 비워두어 클릭 통과)
  const blockers = rect ? (
    <>
      <div
        className={styles.blocker}
        style={{ top: 0, left: 0, width: "100vw", height: rect.top }}
      />
      <div
        className={styles.blocker}
        style={{
          top: rect.top + rect.height,
          left: 0,
          width: "100vw",
          height: `calc(100vh - ${rect.top + rect.height}px)`,
        }}
      />
      <div
        className={styles.blocker}
        style={{
          top: rect.top,
          left: 0,
          width: rect.left,
          height: rect.height,
        }}
      />
      <div
        className={styles.blocker}
        style={{
          top: rect.top,
          left: rect.left + rect.width,
          width: `calc(100vw - ${rect.left + rect.width}px)`,
          height: rect.height,
        }}
      />
    </>
  ) : (
    // target 없는 단계(중앙 모달) — 전체 화면 차단
    <div className={styles.blockerFull} />
  );

  const overlay = (
    <div className={styles.overlay}>
      {!isCompact && <div className={styles.backdrop} />}
      {!isCompact && blockers}
      {rect && (
        <div
          className={styles.spotlight}
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />
      )}
      <div className={tooltipClass} style={tooltipStyle} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <h3 className={styles.title}>{current.title}</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="닫기">
            <X size={16} />
          </button>
        </div>
        <div className={styles.body}>{current.content}</div>
        <div className={styles.footer}>
          <span className={styles.progress}>
            {index + 1} / {total}
          </span>
          <div className={styles.actions}>
            {!isFirst && !current.hidePrev && (
              <button className={styles.btnGhost} onClick={prev}>
                이전
              </button>
            )}
            {!current.hideNext && (
              <button className={styles.btnPrimary} onClick={next}>
                {isLast ? "완료" : "다음"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(overlay, document.body)
    : null;
}
