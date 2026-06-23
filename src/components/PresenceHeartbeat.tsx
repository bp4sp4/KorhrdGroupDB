"use client";

import { useEffect, useRef } from "react";

// 자리비움(보조 신호) — 활동 감지 + (권한 허용 시) Idle Detection API
//  · 탭이 열려 있으면 활동 중 — 탭 닫기 / 3분간 입력 없음 / 시스템 유휴 → 'away'
//    (백그라운드 탭은 활동 중 유지: document.hidden은 자리비움으로 보지 않음)
//  · 45초마다, 상태 변할 때 즉시 서버로 하트비트
const IDLE_MS = 3 * 60 * 1000;
const HEARTBEAT_MS = 45 * 1000;

interface IdleDetectorLike {
  userState: string;
  screenState: string;
  addEventListener: (t: string, cb: () => void) => void;
  start: (opts: { threshold: number }) => Promise<void>;
  stop?: () => void;
}

export default function PresenceHeartbeat() {
  const lastActivity = useRef(Date.now());
  const lastSent = useRef<string>("");
  const idleApiAway = useRef(false);

  useEffect(() => {
    const computeState = (): "active" | "away" => {
      // 탭 숨김(다른 탭/창)은 자리비움으로 보지 않음 — 탭만 열려 있으면 활동 중
      if (idleApiAway.current) return "away";
      if (Date.now() - lastActivity.current > IDLE_MS) return "away";
      return "active";
    };

    const send = (force: boolean) => {
      const state = computeState();
      if (!force && state === lastSent.current) return;
      lastSent.current = state;
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
        keepalive: true,
      }).catch(() => {});
    };

    const onActivity = () => {
      lastActivity.current = Date.now();
      if (lastSent.current !== "active" && !idleApiAway.current) {
        send(true);
      }
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];
    events.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true }),
    );
    const onVisibility = () => send(true);
    document.addEventListener("visibilitychange", onVisibility);

    send(true);
    const interval = setInterval(() => send(false), HEARTBEAT_MS);

    // Idle Detection API — 권한이 이미 허용된 경우에만 사용(프롬프트 미표시)
    let idleDetector: IdleDetectorLike | null = null;
    (async () => {
      try {
        const w = window as unknown as { IdleDetector?: new () => IdleDetectorLike };
        if (!w.IdleDetector) return;
        const perm = await (
          navigator as unknown as {
            permissions?: { query?: (d: { name: string }) => Promise<{ state: string }> };
          }
        ).permissions?.query?.({ name: "idle-detection" });
        if (perm?.state !== "granted") return;
        const det = new w.IdleDetector();
        det.addEventListener("change", () => {
          idleApiAway.current =
            det.userState === "idle" || det.screenState === "locked";
          send(true);
        });
        await det.start({ threshold: 60000 });
        idleDetector = det;
      } catch {
        /* 미지원/거부 — 활동 감지로만 동작 */
      }
    })();

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
      try {
        idleDetector?.stop?.();
      } catch {
        /* ignore */
      }
      fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "away" }),
        keepalive: true,
      }).catch(() => {});
    };
  }, []);

  return null;
}
