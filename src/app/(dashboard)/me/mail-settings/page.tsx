"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

interface CredentialsInfo {
  email: string;
  imap_host: string;
  imap_port: number;
  smtp_host: string;
  smtp_port: number;
  use_tls: boolean;
  provider: string;
  created_at?: string;
  updated_at?: string;
}

export default function MailSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<CredentialsInfo | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // 폼 상태
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [imapHost, setImapHost] = useState("imap.daum.net");
  const [imapPort, setImapPort] = useState(993);
  const [smtpHost, setSmtpHost] = useState("smtp.daum.net");
  const [smtpPort, setSmtpPort] = useState(465);

  const loadCurrent = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mail-credentials/me", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.credentials) {
        const c = data.credentials as CredentialsInfo;
        setCurrent(c);
        setEmail(c.email);
        setImapHost(c.imap_host);
        setImapPort(c.imap_port);
        setSmtpHost(c.smtp_host);
        setSmtpPort(c.smtp_port);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrent();
  }, []);

  const handleSave = async () => {
    if (!email || !password) {
      setError("이메일과 앱 비밀번호를 입력해주세요.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/mail-credentials/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          imap_host: imapHost,
          imap_port: imapPort,
          smtp_host: smtpHost,
          smtp_port: smtpPort,
          use_tls: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          (data?.error ?? "저장 실패") +
            (data?.hint ? `\n💡 ${data.hint}` : ""),
        );
        return;
      }
      setSuccess(
        "✅ 연결 확인 완료! 자격증명이 저장되었습니다. 이제 메일 페이지에서 메일을 보내고 받을 수 있어요.",
      );
      setPassword("");
      await loadCurrent();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("저장된 메일 자격증명을 삭제하시겠습니까?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/mail-credentials/me", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "삭제 실패");
        return;
      }
      setCurrent(null);
      setEmail("");
      setPassword("");
      setSuccess("자격증명이 삭제되었습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.app}>
      <div className={styles.container}>
        <header className={styles.head}>
          <h1 className={styles.title}>메일 설정</h1>
          <p className={styles.sub}>
            다음 스마트워크 (또는 IMAP/SMTP 지원 메일 서비스) 자격증명을 등록하면
            사내 메일 페이지에서 메일을 보내고 받을 수 있어요.
          </p>
        </header>

        {/* 가이드 카드 */}
        <section className={styles.guideCard}>
          <div className={styles.guideText}>
            <div className={styles.guideTitle}>📘 메일 설정 가이드</div>
            <p className={styles.guideDesc}>
              앱 비밀번호 발급부터 IMAP/SMTP 설정까지 단계별로 안내된 PDF예요.
              처음 설정한다면 먼저 확인해보세요.
            </p>
          </div>
          <div className={styles.guideActions}>
            <a
              href="/guides/mail-setup-guide.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.guideBtnGhost}
            >
              새 창에서 보기
            </a>
            <a
              href="/guides/mail-setup-guide.pdf"
              download="메일_설정_가이드.pdf"
              className={styles.guideBtnPrimary}
            >
              PDF 다운로드
            </a>
          </div>
        </section>

        {/* 현재 상태 카드 */}
        {!loading && (
          <section className={styles.statusCard}>
            <div className={styles.statusRow}>
              <span className={styles.statusLabel}>현재 상태</span>
              {current ? (
                <span className={`${styles.statusBadge} ${styles.statusBadgeOn}`}>
                  ✅ 연결됨
                </span>
              ) : (
                <span className={`${styles.statusBadge} ${styles.statusBadgeOff}`}>
                  미설정
                </span>
              )}
            </div>
            {current && (
              <div className={styles.statusInfo}>
                <div>
                  <span className={styles.kv_k}>이메일</span>
                  <span className={styles.kv_v}>{current.email}</span>
                </div>
                <div>
                  <span className={styles.kv_k}>IMAP</span>
                  <span className={styles.kv_v}>
                    {current.imap_host}:{current.imap_port}
                  </span>
                </div>
                <div>
                  <span className={styles.kv_k}>SMTP</span>
                  <span className={styles.kv_v}>
                    {current.smtp_host}:{current.smtp_port}
                  </span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 등록/수정 폼 */}
        <section className={styles.formCard}>
          <h2 className={styles.formTitle}>
            {current ? "비밀번호 다시 등록 / 설정 변경" : "메일 자격증명 등록"}
          </h2>

          <div className={styles.field}>
            <label className={styles.label}>이메일 주소</label>
            <input
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@korhrdcorp.co.kr"
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              앱 비밀번호 <span className={styles.required}>*</span>
            </label>
            <input
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="다음 스마트워크에서 발급한 앱 비밀번호"
              autoComplete="new-password"
            />
            <p className={styles.help}>
              💡 다음 스마트워크 메일 → 설정 → 보안 → 앱 비밀번호에서 발급.
              본인 계정 비밀번호가 아닌 앱 전용 비밀번호를 사용하세요.
            </p>
          </div>

          {/* 고급 설정 (서버 변경) */}
          <button
            type="button"
            className={styles.advancedToggle}
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "▾ 고급 설정 닫기" : "▸ 고급 설정 (서버 변경)"}
          </button>

          {showAdvanced && (
            <div className={styles.advanced}>
              <div className={styles.field2col}>
                <div>
                  <label className={styles.label}>IMAP 서버</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                  />
                </div>
                <div>
                  <label className={styles.label}>IMAP 포트</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={imapPort}
                    onChange={(e) =>
                      setImapPort(parseInt(e.target.value, 10) || 993)
                    }
                  />
                </div>
              </div>
              <div className={styles.field2col}>
                <div>
                  <label className={styles.label}>SMTP 서버</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                  />
                </div>
                <div>
                  <label className={styles.label}>SMTP 포트</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={smtpPort}
                    onChange={(e) =>
                      setSmtpPort(parseInt(e.target.value, 10) || 465)
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className={styles.alertError}>{error}</div>
          )}
          {success && (
            <div className={styles.alertSuccess}>{success}</div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "확인 중..." : "저장 (연결 확인 후)"}
            </button>
            {current && (
              <button
                type="button"
                className={styles.btnDanger}
                onClick={handleDelete}
                disabled={saving}
              >
                자격증명 삭제
              </button>
            )}
            <Link href="/mail" className={styles.btnGhost}>
              메일 페이지로
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
