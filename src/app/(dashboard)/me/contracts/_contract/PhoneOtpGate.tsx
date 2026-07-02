"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, Send } from "lucide-react";
import styles from "./PhoneOtpGate.module.css";

interface Props {
  contractId: string;
  onVerifiedChange: (v: boolean) => void;
}

// 서명 전 휴대폰 OTP 본인인증 게이트
export default function PhoneOtpGate({ contractId, onVerifiedChange }: Props) {
  const [phase, setPhase] = useState<"idle" | "sent" | "verified">("idle");
  const [phoneMasked, setPhoneMasked] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const startCountdown = useCallback((sec: number) => {
    setLeft(sec);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          if (timer.current) clearInterval(timer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const send = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/me/contracts/${contractId}/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(d.error ?? "인증번호 발송에 실패했습니다.");
        return;
      }
      setPhoneMasked(d.phoneMasked ?? "");
      setPhase("sent");
      setCode("");
      startCountdown(d.expiresInSec ?? 300);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/me/contracts/${contractId}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(d.error ?? "인증에 실패했습니다.");
        return;
      }
      setPhase("verified");
      onVerifiedChange(true);
      if (timer.current) clearInterval(timer.current);
    } finally {
      setBusy(false);
    }
  };

  const mmss = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;

  if (phase === "verified") {
    return (
      <div className={`${styles.gate} ${styles.gateOk}`}>
        <ShieldCheck size={16} />
        <span>휴대폰 본인인증 완료{phoneMasked ? ` · ${phoneMasked}` : ""}</span>
      </div>
    );
  }

  return (
    <div className={styles.gate}>
      <div className={styles.gateTitle}>
        <ShieldCheck size={15} /> 휴대폰 본인인증
      </div>
      <p className={styles.gateDesc}>
        서명 전 등록된 휴대폰으로 인증번호를 받아 본인 확인을 진행합니다.
      </p>

      {phase === "idle" ? (
        <button
          type="button"
          className={styles.sendBtn}
          onClick={send}
          disabled={busy}
        >
          <Send size={14} /> {busy ? "발송 중…" : "인증번호 받기"}
        </button>
      ) : (
        <>
          <div className={styles.sentInfo}>
            {phoneMasked}로 발송됨 {left > 0 && <b>· {mmss}</b>}
          </div>
          <div className={styles.codeRow}>
            <input
              className={styles.codeInput}
              value={code}
              inputMode="numeric"
              maxLength={6}
              placeholder="인증번호 6자리"
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
            />
            <button
              type="button"
              className={styles.verifyBtn}
              onClick={verify}
              disabled={busy || code.length !== 6}
            >
              확인
            </button>
          </div>
          <button
            type="button"
            className={styles.resendBtn}
            onClick={send}
            disabled={busy || left > 270}
          >
            인증번호 재발송
          </button>
        </>
      )}

      {err && <div className={styles.gateErr}>{err}</div>}
    </div>
  );
}
