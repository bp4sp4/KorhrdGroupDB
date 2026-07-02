"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, Send, Clock } from "lucide-react";
import styles from "./PhoneOtpGate.module.css";

const OTP_LEN = 6;

interface Props {
  contractId: string;
  onVerifiedChange: (v: boolean) => void;
  onBack?: () => void;
  userName?: string;
  initialPhoneMasked?: string;
}

// 휴대폰 본인인증 — 발송(request) → 6칸 OTP 입력(verify)
export default function PhoneOtpGate({
  contractId,
  onVerifiedChange,
  onBack,
  userName,
  initialPhoneMasked = "",
}: Props) {
  const [step, setStep] = useState<"request" | "verify">("request");
  const [phoneMasked, setPhoneMasked] = useState(initialPhoneMasked);
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setPhoneMasked((p) => p || initialPhoneMasked);
  }, [initialPhoneMasked]);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const startCountdown = useCallback((sec: number) => {
    setSeconds(sec);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          if (timer.current) clearInterval(timer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  const requestCode = async () => {
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
      if (d.phoneMasked) setPhoneMasked(d.phoneMasked);
      setCode("");
      setVerified(false);
      setStep("verify");
      startCountdown(d.expiresInSec ?? 300);
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.length !== OTP_LEN || busy) return;
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
      setVerified(true);
      if (timer.current) clearInterval(timer.current);
      onVerifiedChange(true);
    } finally {
      setBusy(false);
    }
  };

  const ready = code.length === OTP_LEN;
  const low = seconds <= 60;
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className={styles.card}>
      {onBack && (
        <button type="button" className={styles.back} onClick={onBack}>
          ← 목록
        </button>
      )}

      {step === "request" ? (
        <>
          <div className={`${styles.badge} ${styles.badgeLg}`}>
            <ShieldCheck size={26} />
          </div>
          <h2 className={styles.reqTitle}>본인인증 후 서명</h2>
          <p className={styles.reqDesc}>
            {userName ? `${userName}님, ` : ""}계약서 서명 전 등록된 휴대폰으로 본인
            확인을 진행합니다.
          </p>
          <div className={styles.targetRow}>
            <span className={styles.targetLabel}>발송 대상</span>
            <span className={styles.targetPhone}>{phoneMasked || "등록된 휴대폰"}</span>
          </div>
          <button
            type="button"
            className={styles.reqBtn}
            onClick={requestCode}
            disabled={busy}
          >
            <Send size={17} /> {busy ? "발송 중…" : "인증번호 받기"}
          </button>
          {err && <div className={styles.err}>{err}</div>}
        </>
      ) : (
        <>
          <div className={styles.vHeader}>
            <div className={`${styles.badge} ${styles.badgeSm}`}>
              <ShieldCheck size={18} />
            </div>
            <div className={styles.vHeaderText}>
              <div className={styles.vTitle}>인증번호 입력</div>
              <div className={styles.vSub}>
                <b>{phoneMasked}</b>로 발송됨
              </div>
            </div>
            <span className={`${styles.timer} ${low ? styles.timerLow : ""}`}>
              <Clock size={14} />
              {time}
            </span>
          </div>

          <div className={styles.otpWrap}>
            <input
              ref={inputRef}
              className={styles.otpInput}
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LEN}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, OTP_LEN));
                setErr(null);
                setVerified(false);
              }}
            />
            <div className={styles.otpCells}>
              {Array.from({ length: OTP_LEN }, (_, i) => {
                const digit = code[i] ?? "";
                const active = i === code.length;
                const filled = !!digit;
                return (
                  <div
                    key={i}
                    className={`${styles.cell} ${active ? styles.cellActive : ""} ${filled ? styles.cellFilled : ""}`}
                  >
                    {digit}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className={`${styles.verifyBtn} ${ready ? styles.verifyBtnReady : ""}`}
            onClick={verify}
            disabled={!ready || busy}
          >
            {busy ? "확인 중…" : "확인"}
          </button>

          <div className={styles.footer}>
            {verified && (
              <span className={styles.verifiedMsg}>
                ✓ 본인인증이 완료되었습니다.
              </span>
            )}
            <button
              type="button"
              className={styles.resend}
              onClick={requestCode}
              disabled={busy}
            >
              인증번호 재발송
            </button>
          </div>
          {err && <div className={styles.err}>{err}</div>}
        </>
      )}
    </div>
  );
}
