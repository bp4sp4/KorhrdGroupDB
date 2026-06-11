"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Paperclip, Send, X } from "lucide-react";
import styles from "./page.module.css";
import {
  type AppraisalSheet,
  normalizeScores,
  totalScore,
} from "@/lib/appraisal/form";
import { type QuantMetrics } from "@/lib/appraisal/quantScore";
import { periodLabel } from "@/lib/appraisal/period";
import { SheetView } from "../../appraisal/_components/SheetView";

interface AppealAttachment {
  name: string;
  url: string;
  type: string | null;
  size: number | null;
}

interface AppealRow {
  id: string;
  content: string;
  attachments: AppealAttachment[];
  status: "pending" | "resolved";
  created_at: string;
  resolved_at: string | null;
}

interface MyEvaluation {
  evaluationId: string;
  formTitle: string;
  sheet: AppraisalSheet;
  scores: unknown;
  submittedAt: string | null;
  period: string;
  evaluatorName: string;
  appeals: AppealRow[];
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("ko-KR") : "-";

export default function MyAppraisalPage() {
  const [items, setItems] = useState<MyEvaluation[] | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [quantMetric, setQuantMetric] = useState<QuantMetrics | null>(null);

  // 이의제기 작성
  const [appealContent, setAppealContent] = useState("");
  const [appealFiles, setAppealFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/me/appraisal", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { items: MyEvaluation[] };
      setItems(data.items);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 본인 정량 지표 (자동산출 배지)
  useEffect(() => {
    fetch("/api/appraisal-evaluations/quant-metrics", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setQuantMetric(data as QuantMetrics);
      })
      .catch(() => {});
  }, []);

  const detail = items?.find((it) => it.evaluationId === detailId) ?? null;

  const openDetail = (id: string) => {
    setDetailId(id);
    setAppealContent("");
    setAppealFiles([]);
  };

  const handleAppealSubmit = async () => {
    if (!detail) return;
    const content = appealContent.trim();
    if (!content) {
      alert("이의제기 내용을 입력해주세요.");
      return;
    }
    if (!window.confirm("이의제기를 제출할까요? 제출 후 평가자가 재검토합니다.")) {
      return;
    }
    setSubmitting(true);
    try {
      // 1) 첨부 업로드
      let attachments: AppealAttachment[] = [];
      if (appealFiles.length > 0) {
        const fd = new FormData();
        appealFiles.forEach((f) => fd.append("files", f));
        const upRes = await fetch("/api/me/appraisal/appeals/upload", {
          method: "POST",
          body: fd,
        });
        if (!upRes.ok) {
          const d = await upRes.json().catch(() => ({}));
          throw new Error(d.error ?? "첨부파일 업로드에 실패했습니다.");
        }
        attachments = ((await upRes.json()) as { files: AppealAttachment[] })
          .files;
      }

      // 2) 이의제기 등록
      const res = await fetch("/api/me/appraisal/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluation_id: detail.evaluationId,
          content,
          attachments,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "이의제기 제출에 실패했습니다.");
      }
      setAppealContent("");
      setAppealFiles([]);
      await load();
      alert("이의제기가 제출되었습니다. 평가자가 확인 후 재평가합니다.");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (items === null) {
    return <div className={styles.empty}>불러오는 중...</div>;
  }

  // ── 상세 보기 ──────────────────────────────────────────────────────
  if (detail) {
    const scores = normalizeScores(detail.sheet, detail.scores);
    const pendingAppeal = detail.appeals.find((a) => a.status === "pending");

    return (
      <div className={styles.page}>
        <div className={styles.detailHeader}>
          <button className={styles.btnGhost} onClick={() => setDetailId(null)}>
            <ArrowLeft size={15} /> 목록으로
          </button>
          <h1 className={styles.pageTitle}>
            {detail.formTitle}
            <span className={styles.titleSub}>
              {" "}
              — {periodLabel(detail.period)} 개인 역량평가 · 평가자:{" "}
              {detail.evaluatorName}
            </span>
          </h1>
        </div>

        <div className={styles.docWrap}>
          <div className={styles.doc}>
            <SheetView
              sheet={detail.sheet}
              editing={false}
              onChange={() => {}}
              scores={scores}
              salesMetric={quantMetric}
            />
          </div>
        </div>

        {/* ── 이의제기 ── */}
        <section className={styles.appealSection}>
          <h2 className={styles.appealTitle}>이의제기</h2>
          <p className={styles.appealHint}>
            평가 결과에 이의가 있으면 사유와 근거 자료를 제출하세요. 평가자가
            확인 후 재평가하며, 재제출되면 처리 완료로 표시됩니다.
          </p>

          {detail.appeals.length > 0 && (
            <ul className={styles.appealList}>
              {detail.appeals.map((a) => (
                <li key={a.id} className={styles.appealCard}>
                  <div className={styles.appealCardHead}>
                    <span
                      className={
                        a.status === "pending"
                          ? styles.badgePending
                          : styles.badgeResolved
                      }
                    >
                      {a.status === "pending" ? "처리 대기" : "재평가 완료"}
                    </span>
                    <span className={styles.appealDate}>
                      {fmtDate(a.created_at)} 제출
                      {a.resolved_at && ` · ${fmtDate(a.resolved_at)} 처리`}
                    </span>
                  </div>
                  <p className={styles.appealContent}>{a.content}</p>
                  {a.attachments.length > 0 && (
                    <div className={styles.attachList}>
                      {a.attachments.map((f, i) => (
                        <a
                          key={i}
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.attachLink}
                        >
                          <Paperclip size={12} /> {f.name}
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {pendingAppeal ? (
            <div className={styles.appealLocked}>
              처리 대기 중인 이의제기가 있습니다. 평가자가 재평가하면 다시
              제출할 수 있습니다.
            </div>
          ) : (
            <div className={styles.appealForm}>
              <textarea
                className={styles.appealTextarea}
                placeholder="이의제기 사유를 구체적으로 작성해주세요. (예: 5월 매출 실적 누락 — 첨부 자료 참고)"
                rows={4}
                value={appealContent}
                onChange={(e) => setAppealContent(e.target.value)}
                disabled={submitting}
              />
              <div className={styles.appealFormFoot}>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className={styles.fileInput}
                  onChange={(e) => {
                    const list = Array.from(e.target.files ?? []);
                    if (list.length > 0) {
                      setAppealFiles((prev) => [...prev, ...list].slice(0, 10));
                    }
                    e.target.value = "";
                  }}
                />
                <button
                  className={styles.btnGhost}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                >
                  <Paperclip size={14} /> 자료 첨부
                </button>
                <div className={styles.fileChips}>
                  {appealFiles.map((f, i) => (
                    <span key={i} className={styles.fileChip}>
                      {f.name}
                      <button
                        className={styles.fileChipRemove}
                        onClick={() =>
                          setAppealFiles((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                        disabled={submitting}
                        aria-label="첨부 제거"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <button
                  className={styles.btnPrimary}
                  onClick={handleAppealSubmit}
                  disabled={submitting}
                >
                  <Send size={14} />{" "}
                  {submitting ? "제출 중..." : "이의제기 제출"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

  // ── 목록 ───────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>내 인사고과</h1>
      <p className={styles.pageHint}>
        제출 완료된 내 개인 역량평가 결과입니다. 이의가 있으면 상세 화면에서
        자료와 함께 이의제기할 수 있습니다.
      </p>

      {items.length === 0 ? (
        <div className={styles.empty}>아직 제출 완료된 평가가 없습니다.</div>
      ) : (
        <ul className={styles.cardList}>
          {items.map((it) => {
            const total = totalScore(normalizeScores(it.sheet, it.scores));
            const pending = it.appeals.some((a) => a.status === "pending");
            return (
              <li key={it.evaluationId}>
                <button
                  className={styles.card}
                  onClick={() => openDetail(it.evaluationId)}
                >
                  <div className={styles.cardMain}>
                    <span className={styles.cardTitle}>
                      {periodLabel(it.period)} · {it.formTitle}
                    </span>
                    <span className={styles.cardSub}>
                      개인 역량평가 · 평가자 {it.evaluatorName} ·{" "}
                      {fmtDate(it.submittedAt)} 제출
                    </span>
                  </div>
                  <div className={styles.cardRight}>
                    {pending && (
                      <span className={styles.badgePending}>
                        이의제기 처리 대기
                      </span>
                    )}
                    <span className={styles.cardScore}>{total}점</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
