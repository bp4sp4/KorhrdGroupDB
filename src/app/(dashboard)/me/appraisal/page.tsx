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
import {
  APPEAL_WINDOW_DAYS,
  appealDeadline,
  isAppealWindowOpen,
} from "@/lib/appraisal/appeal";
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
  /** 항목별 이의제기 — 평가서 행 위치 (null = 평가 전체) */
  block_index?: number | null;
  indicator_index?: number | null;
  indicator_text?: string | null;
}

/** 이의제기 대상 항목 (행에서 말풍선 클릭 시 지정) */
interface AppealTarget {
  blockIndex: number;
  indicatorIndex: number;
  text: string;
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

  // 이의제기 작성 (하단 폼 — 평가 전체)
  const [appealContent, setAppealContent] = useState("");
  const [appealFiles, setAppealFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 항목 이의제기 모달 — 행의 💬 버튼 클릭 시 그 자리에서 작성
  const [modalTarget, setModalTarget] = useState<AppealTarget | null>(null);
  const [modalContent, setModalContent] = useState("");
  const [modalFiles, setModalFiles] = useState<File[]>([]);
  const modalFileInputRef = useRef<HTMLInputElement | null>(null);

  const addAppealFiles = (list: File[]) => {
    if (list.length === 0) return;
    setAppealFiles((prev) => [...prev, ...list].slice(0, 10));
  };

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
    setModalTarget(null);
  };

  // 첨부 업로드 — 공용
  const uploadFiles = async (files: File[]): Promise<AppealAttachment[]> => {
    if (files.length === 0) return [];
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    const upRes = await fetch("/api/me/appraisal/appeals/upload", {
      method: "POST",
      body: fd,
    });
    if (!upRes.ok) {
      const d = await upRes.json().catch(() => ({}));
      throw new Error(d.error ?? "첨부파일 업로드에 실패했습니다.");
    }
    return ((await upRes.json()) as { files: AppealAttachment[] }).files;
  };

  // 항목 이의제기 제출 (모달)
  const handleItemAppealSubmit = async () => {
    if (!detail || !modalTarget) return;
    const content = modalContent.trim();
    if (!content) {
      alert("이의제기 내용을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const attachments = await uploadFiles(modalFiles);
      const res = await fetch("/api/me/appraisal/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluation_id: detail.evaluationId,
          content,
          attachments,
          block_index: modalTarget.blockIndex,
          indicator_index: modalTarget.indicatorIndex,
          indicator_text: modalTarget.text,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "이의제기 제출에 실패했습니다.");
      }
      setModalTarget(null);
      setModalContent("");
      setModalFiles([]);
      await load();
      alert("이의제기가 제출되었습니다. 평가자가 확인 후 재평가합니다.");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppealSubmit = async () => {
    if (!detail) return;
    const content = appealContent.trim();
    if (!content) {
      alert("이의제기 내용을 입력해주세요.");
      return;
    }
    if (
      !window.confirm("이의제기를 제출할까요? 제출 후 평가자가 재검토합니다.")
    ) {
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

      // 2) 이의제기 등록 (평가 전체)
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
    // 처리 대기 — 전체 이의제기 / 항목별 이의제기 위치 (같은 대상 중복 제기 방지)
    const pendingWholeAppeal = detail.appeals.find(
      (a) => a.status === "pending" && a.block_index == null,
    );
    const pendingItemKeys = new Set(
      detail.appeals
        .filter(
          (a) =>
            a.status === "pending" &&
            a.block_index != null &&
            a.indicator_index != null,
        )
        .map((a) => `${a.block_index}-${a.indicator_index}`),
    );
    // 이의제기 기간 — 평가 제출 후 5일 이내
    const windowOpen = isAppealWindowOpen(detail.submittedAt);
    const deadline = appealDeadline(detail.submittedAt);

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
              indicatorAppeals={detail.appeals
                .filter(
                  (a) => a.block_index != null && a.indicator_index != null,
                )
                .map((a) => ({
                  blockIndex: a.block_index as number,
                  indicatorIndex: a.indicator_index as number,
                  status: a.status,
                  content: a.content,
                  attachments: a.attachments ?? [],
                  createdAt: a.created_at,
                }))}
              onIndicatorAppeal={
                windowOpen
                  ? (bi, ii, text) => {
                      if (pendingItemKeys.has(`${bi}-${ii}`)) {
                        alert(
                          "이 항목에 이미 처리 대기 중인 이의제기가 있습니다.",
                        );
                        return;
                      }
                      // 행에서 바로 작성 — 모달 오픈
                      setModalContent("");
                      setModalFiles([]);
                      setModalTarget({
                        blockIndex: bi,
                        indicatorIndex: ii,
                        text,
                      });
                    }
                  : undefined
              }
            />
          </div>
        </div>

        {/* ── 이의제기 ── */}
        <section className={styles.appealSection}>
          <h2 className={styles.appealTitle}>이의제기</h2>
          <p className={styles.appealHint}>
            평가 결과에 이의가 있으면 사유와 근거 자료를 제출하세요. 자료는
            아래 영역에 드래그해서 놓아도 첨부됩니다. 평가자가 확인 후
            재평가하며, 재제출되면 처리 완료로 표시됩니다.
            {windowOpen && deadline && (
              <>
                {" "}
                <b>
                  이의제기는 {fmtDate(deadline.toISOString())}까지 가능합니다.
                  (평가 제출 후 {APPEAL_WINDOW_DAYS}일)
                </b>
              </>
            )}
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
                  {a.indicator_text && (
                    <span className={styles.appealTargetChip}>
                      대상 항목: {a.indicator_text}
                    </span>
                  )}
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

          {!windowOpen ? (
            <div className={styles.appealLocked}>
              이의제기 기간이 종료되었습니다. (평가 제출 후{" "}
              {APPEAL_WINDOW_DAYS}일 이내 가능)
            </div>
          ) : pendingWholeAppeal ? (
            <div className={styles.appealLocked}>
              평가 전체 이의제기가 처리 대기 중입니다. 특정 항목에 대한
              이의제기는 위 평가표의 항목 행에서 💬 버튼으로 추가 제기할 수
              있습니다.
            </div>
          ) : (
            <div
              className={`${styles.appealForm} ${dragOver ? styles.appealFormDragOver : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (!submitting) setDragOver(true);
              }}
              onDragLeave={(e) => {
                // 자식 요소로 이동할 때는 무시
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOver(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (submitting) return;
                addAppealFiles(Array.from(e.dataTransfer.files ?? []));
              }}
            >
              <textarea
                className={styles.appealTextarea}
                placeholder="평가 전체에 대한 이의제기 사유를 작성해주세요. 특정 항목에 대한 이의제기는 위 평가표의 항목 행에서 💬 버튼으로 작성할 수 있습니다."
                rows={4}
                value={appealContent}
                onChange={(e) => setAppealContent(e.target.value)}
                disabled={submitting}
              />
              {dragOver && (
                <div className={styles.dropHint}>
                  여기에 놓으면 자료가 첨부됩니다
                </div>
              )}
              <div className={styles.appealFormFoot}>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className={styles.fileInput}
                  onChange={(e) => {
                    addAppealFiles(Array.from(e.target.files ?? []));
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

        {/* ── 항목 이의제기 모달 — 행에서 바로 작성 ── */}
        {modalTarget && (
          <div
            className={styles.appealModalOverlay}
            onClick={(e) => {
              if (e.target === e.currentTarget && !submitting)
                setModalTarget(null);
            }}
          >
            <div
              className={styles.appealModalBox}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (submitting) return;
                const files = Array.from(e.dataTransfer.files ?? []);
                setModalFiles((prev) => [...prev, ...files].slice(0, 10));
              }}
            >
              <div className={styles.appealModalHead}>
                <h3 className={styles.appealModalTitle}>항목 이의제기</h3>
                <button
                  type="button"
                  className={styles.appealTargetClear}
                  onClick={() => setModalTarget(null)}
                  disabled={submitting}
                  aria-label="닫기"
                >
                  <X size={15} />
                </button>
              </div>
              <span className={styles.appealTargetChip}>
                {modalTarget.text}
              </span>
              <textarea
                className={styles.appealTextarea}
                placeholder="이 항목에 대한 이의제기 사유를 구체적으로 작성해주세요. 파일은 이 창에 끌어다 놓아도 첨부됩니다."
                rows={4}
                value={modalContent}
                onChange={(e) => setModalContent(e.target.value)}
                disabled={submitting}
                autoFocus
              />
              {/* 첨부된 파일 — 전용 영역으로 또렷하게 표시 */}
              {modalFiles.length > 0 && (
                <div className={styles.modalFileList}>
                  <span className={styles.modalFileListLabel}>
                    첨부된 자료 {modalFiles.length}개
                  </span>
                  {modalFiles.map((f, i) => (
                    <span key={i} className={styles.modalFileItem}>
                      <Paperclip size={12} />
                      <span className={styles.modalFileName}>{f.name}</span>
                      <span className={styles.modalFileSize}>
                        {f.size >= 1024 * 1024
                          ? `${(f.size / 1024 / 1024).toFixed(1)}MB`
                          : `${Math.max(1, Math.round(f.size / 1024))}KB`}
                      </span>
                      <button
                        className={styles.fileChipRemove}
                        onClick={() =>
                          setModalFiles((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                        disabled={submitting}
                        aria-label="첨부 제거"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className={styles.appealFormFoot}>
                <input
                  ref={modalFileInputRef}
                  type="file"
                  multiple
                  className={styles.fileInput}
                  onChange={(e) => {
                    // value 초기화 전에 파일 목록을 먼저 복사해야 함
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    setModalFiles((prev) => [...prev, ...files].slice(0, 10));
                  }}
                />
                <button
                  className={styles.btnGhost}
                  onClick={() => modalFileInputRef.current?.click()}
                  disabled={submitting}
                >
                  <Paperclip size={14} /> 자료 첨부
                </button>
                <span className={styles.modalFootSpacer} />
                <button
                  className={styles.btnPrimary}
                  onClick={handleItemAppealSubmit}
                  disabled={submitting}
                >
                  <Send size={14} />{" "}
                  {submitting ? "제출 중..." : "이의제기 제출"}
                </button>
              </div>
            </div>
          </div>
        )}
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
                      개인 역량평가 ·&nbsp;{fmtDate(it.submittedAt)} 제출
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
