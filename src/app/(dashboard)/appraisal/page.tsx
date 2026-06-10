"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Printer,
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
  Minus,
  ArrowLeft,
  Send,
  RotateCcw,
  Eye,
} from "lucide-react";
import styles from "./page.module.css";
import {
  type AppraisalFormData,
  type AppraisalFormRow,
  type AppraisalSheet,
  type ScoreMatrix,
  columnSubtotals,
  combinedScore,
  createEmptyFormData,
  gradeOf,
  normalizeScores,
  SCORE_SCALE,
  totalScore,
} from "@/lib/appraisal/form";

type SheetKey = "team" | "personal";
type TabKey = "form" | "write" | "status";

interface EvaluationRow {
  id: string;
  sheet_key: SheetKey;
  target_team_id: string | null;
  target_user_id: number | null;
  evaluator_id: number;
  scores: unknown;
  status: "draft" | "submitted";
  submitted_at: string | null;
  updated_at: string;
}

interface EvalContext {
  canEvaluate: boolean;
  canOverview: boolean;
  isMaster: boolean;
  teamTargets: { teamId: string; teamName: string }[];
  personalTargets: {
    userId: number;
    name: string;
    teamName: string | null;
    isLeader: boolean;
  }[];
  evaluations: EvaluationRow[];
}

interface OverviewRow extends EvaluationRow {
  target_name: string;
  evaluator_name: string;
  target_user_team_id: string | null;
  target_user_team_name: string | null;
}

interface WriteTarget {
  sheetKey: SheetKey;
  teamId?: string;
  userId?: number;
  label: string;
}

export default function AppraisalPage() {
  const [forms, setForms] = useState<AppraisalFormRow[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 기본 화면은 평가 작성 (팀장·본부장) — 양식 관리는 경영실장 전용 탭
  const [tab, setTab] = useState<TabKey>("write");

  // 양식 탭 — 팀역량/개인역량 평가서를 한 장씩 나눠서 표시·수정
  const [formSheet, setFormSheet] = useState<SheetKey>("team");
  const [editingSheet, setEditingSheet] = useState<SheetKey | null>(null);
  const [draftSheet, setDraftSheet] = useState<AppraisalSheet | null>(null);
  const [saving, setSaving] = useState(false);

  // 평가 작성
  const [evalCtx, setEvalCtx] = useState<EvalContext | null>(null);
  const [writeTarget, setWriteTarget] = useState<WriteTarget | null>(null);
  const [writeScores, setWriteScores] = useState<ScoreMatrix>([]);
  const [writeLocked, setWriteLocked] = useState(false);

  // 평가 현황 (경영실장)
  const [overviewRows, setOverviewRows] = useState<OverviewRow[] | null>(null);
  const [overviewDetail, setOverviewDetail] = useState<OverviewRow | null>(null);

  const loadForms = useCallback(async (selectId?: string) => {
    try {
      const res = await fetch("/api/appraisal-forms", { cache: "no-store" });
      if (!res.ok) throw new Error("불러오기 실패");
      const data = (await res.json()) as {
        forms: AppraisalFormRow[];
        canEdit: boolean;
      };
      setForms(data.forms);
      setCanEdit(data.canEdit);
      setSelectedId((prev) => {
        if (selectId && data.forms.some((f) => f.id === selectId)) return selectId;
        if (prev && data.forms.some((f) => f.id === prev)) return prev;
        return data.forms[0]?.id ?? null;
      });
    } catch {
      // 네트워크 오류 시 빈 상태 유지
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEvaluations = useCallback(async (formId: string) => {
    try {
      const res = await fetch(`/api/appraisal-evaluations?formId=${formId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      setEvalCtx((await res.json()) as EvalContext);
    } catch {
      setEvalCtx(null);
    }
  }, []);

  const loadOverview = useCallback(async (formId: string) => {
    try {
      const res = await fetch(
        `/api/appraisal-evaluations/overview?formId=${formId}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { evaluations: OverviewRow[] };
      setOverviewRows(data.evaluations);
    } catch {
      setOverviewRows([]);
    }
  }, []);

  useEffect(() => {
    void loadForms();
  }, [loadForms]);

  useEffect(() => {
    setWriteTarget(null);
    setOverviewDetail(null);
    setOverviewRows(null);
    if (selectedId) void loadEvaluations(selectedId);
    else setEvalCtx(null);
  }, [selectedId, loadEvaluations]);

  useEffect(() => {
    if (tab === "status" && selectedId && overviewRows === null) {
      void loadOverview(selectedId);
    }
  }, [tab, selectedId, overviewRows, loadOverview]);

  // 권한에 맞는 탭으로 보정 — 평가자는 평가 작성, 경영실장은 양식 관리부터
  useEffect(() => {
    if (!evalCtx) return;
    setTab((prev) => {
      const allowed: TabKey[] = [];
      if (evalCtx.canEvaluate) allowed.push("write");
      if (canEdit) allowed.push("form");
      if (evalCtx.canOverview) allowed.push("status");
      if (allowed.length === 0) return "write";
      return allowed.includes(prev) ? prev : allowed[0];
    });
  }, [evalCtx, canEdit]);

  const selected = useMemo(
    () => forms.find((f) => f.id === selectedId) ?? null,
    [forms, selectedId],
  );

  // ── 양식 수정 (평가서별) ──────────────────────────────────────────
  const startSheetEdit = (key: SheetKey) => {
    if (!selected) return;
    setDraftSheet(structuredClone(selected.form_data[key]));
    setEditingSheet(key);
  };

  const cancelSheetEdit = () => {
    setEditingSheet(null);
    setDraftSheet(null);
  };

  const saveSheet = async () => {
    if (!selected || !editingSheet || !draftSheet) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/appraisal-forms/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_data: { ...selected.form_data, [editingSheet]: draftSheet },
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "저장에 실패했습니다.");
      }
      setEditingSheet(null);
      setDraftSheet(null);
      await loadForms(selected.id);
      alert("저장되었습니다.");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // 고과표 제목 수정
  const handleRename = async () => {
    if (!selected) return;
    const title = window.prompt("고과표 제목", selected.title);
    if (!title?.trim() || title.trim() === selected.title) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/appraisal-forms/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "저장에 실패했습니다.");
      }
      await loadForms(selected.id);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    const year = new Date().getFullYear();
    const title = window.prompt("새 인사고과표 제목", `${year}년 인사고과표`);
    if (!title?.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/appraisal-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), form_data: createEmptyFormData() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "생성에 실패했습니다.");
      }
      const { id } = (await res.json()) as { id: string };
      cancelSheetEdit();
      await loadForms(id);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm(`'${selected.title}'을(를) 삭제할까요?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/appraisal-forms/${selected.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "삭제에 실패했습니다.");
      }
      cancelSheetEdit();
      setSelectedId(null);
      await loadForms();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const mutateDraftSheet = (fn: (sheet: AppraisalSheet) => void) => {
    setDraftSheet((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  };

  // ── 평가 작성 ─────────────────────────────────────────────────────
  const findEvaluation = useCallback(
    (target: WriteTarget): EvaluationRow | undefined =>
      evalCtx?.evaluations.find((ev) =>
        target.sheetKey === "team"
          ? ev.sheet_key === "team" && ev.target_team_id === target.teamId
          : ev.sheet_key === "personal" && ev.target_user_id === target.userId,
      ),
    [evalCtx],
  );

  const openWrite = (target: WriteTarget) => {
    if (!selected) return;
    const sheet = selected.form_data[target.sheetKey];
    const existing = findEvaluation(target);
    setWriteScores(normalizeScores(sheet, existing?.scores));
    setWriteLocked(
      existing?.status === "submitted" && !(evalCtx?.isMaster ?? false),
    );
    setWriteTarget(target);
  };

  const handleWriteSave = async (submit: boolean) => {
    if (!selected || !writeTarget) return;
    if (
      submit &&
      writeScores.some((row) => row.some((v) => v === null)) &&
      !window.confirm("점수가 비어있는 항목이 있습니다. 그래도 제출할까요?")
    ) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/appraisal-evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_id: selected.id,
          sheet_key: writeTarget.sheetKey,
          target_team_id: writeTarget.teamId ?? null,
          target_user_id: writeTarget.userId ?? null,
          scores: writeScores,
          submit,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "저장에 실패했습니다.");
      }
      await loadEvaluations(selected.id);
      setOverviewRows(null);
      if (submit) {
        setWriteTarget(null);
        alert("제출되었습니다.");
      } else {
        alert("임시 저장되었습니다.");
      }
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── 평가 현황 (경영실장) ──────────────────────────────────────────
  const handleReopen = async (row: OverviewRow) => {
    if (!window.confirm("이 평가를 재작성(임시저장) 상태로 되돌릴까요?")) return;
    const res = await fetch(`/api/appraisal-evaluations/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "처리에 실패했습니다.");
      return;
    }
    if (selectedId) {
      await Promise.all([loadOverview(selectedId), loadEvaluations(selectedId)]);
    }
  };

  const handleEvalDelete = async (row: OverviewRow) => {
    if (!window.confirm(`'${row.target_name}' 평가를 삭제할까요?`)) return;
    const res = await fetch(`/api/appraisal-evaluations/${row.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "삭제에 실패했습니다.");
      return;
    }
    setOverviewDetail(null);
    if (selectedId) {
      await Promise.all([loadOverview(selectedId), loadEvaluations(selectedId)]);
    }
  };

  const viewData = selected?.form_data ?? null;

  if (loading) {
    return <div className={styles.empty}>불러오는 중...</div>;
  }

  // 권한 없는 일반 직원 — 안내만 표시
  const noAccess =
    !!evalCtx && !evalCtx.canEvaluate && !evalCtx.canOverview && !canEdit;
  const visibleTabs = [
    evalCtx?.canEvaluate ? "write" : null,
    canEdit ? "form" : null,
    evalCtx?.canOverview ? "status" : null,
  ].filter(Boolean) as TabKey[];
  const showTabs = visibleTabs.length > 1 && editingSheet === null;

  return (
    <div className={styles.page}>
      {/* 툴바 */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h1 className={styles.pageTitle}>인사고과표</h1>
          {forms.length > 0 && editingSheet === null && (
            <select
              className={styles.formSelect}
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          )}
          {canEdit && (
            <span className={styles.editorBadge}>경영실장 · 양식 수정 가능</span>
          )}
        </div>
        <div className={styles.toolbarRight}>
          {tab === "form" && editingSheet === null && selected && (
            <button className={styles.btnGhost} onClick={() => window.print()}>
              <Printer size={15} /> 인쇄
            </button>
          )}
          {tab === "form" && canEdit && editingSheet === null && (
            <>
              <button className={styles.btnGhost} onClick={handleCreate} disabled={saving}>
                <Plus size={15} /> 새 고과표
              </button>
              {selected && (
                <>
                  <button className={styles.btnGhost} onClick={handleRename} disabled={saving}>
                    <Pencil size={15} /> 제목 수정
                  </button>
                  <button className={styles.btnDanger} onClick={handleDelete} disabled={saving}>
                    <Trash2 size={15} /> 삭제
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* 탭 — 평가 작성(팀장·본부장) / 고과표 양식·평가 현황(경영실장) */}
      {showTabs && (
        <div className={styles.tabs}>
          {evalCtx?.canEvaluate && (
            <button
              className={`${styles.tabBtn} ${tab === "write" ? styles.tabBtnActive : ""}`}
              onClick={() => setTab("write")}
            >
              평가 작성
            </button>
          )}
          {canEdit && (
            <button
              className={`${styles.tabBtn} ${tab === "form" ? styles.tabBtnActive : ""}`}
              onClick={() => setTab("form")}
            >
              고과표 양식
            </button>
          )}
          {evalCtx?.canOverview && (
            <button
              className={`${styles.tabBtn} ${tab === "status" ? styles.tabBtnActive : ""}`}
              onClick={() => setTab("status")}
            >
              평가 현황
            </button>
          )}
        </div>
      )}

      {noAccess ? (
        <div className={styles.empty}>
          인사고과 평가 권한이 없습니다. 평가는 지정된 팀장·본부장이 작성합니다.
        </div>
      ) : !selected || !viewData ? (
        <div className={styles.empty}>
          등록된 인사고과표가 없습니다.
          {canEdit && " 우측 상단 '새 고과표'로 작성을 시작하세요."}
        </div>
      ) : tab === "form" ? (
        /* ── 고과표 양식 — 평가서를 한 장씩 나눠서 표시 ── */
        <>
          <div className={styles.sheetSwitch}>
            {(["team", "personal"] as SheetKey[]).map((key) => (
              <button
                key={key}
                className={`${styles.sheetSwitchBtn} ${formSheet === key ? styles.sheetSwitchBtnActive : ""}`}
                onClick={() => setFormSheet(key)}
                disabled={editingSheet !== null && editingSheet !== key}
              >
                {key === "team" ? "팀역량평가서" : "개인역량평가서"}
              </button>
            ))}
          </div>
          <div className={styles.docWrap}>
            <div className={styles.doc} id="appraisal-doc">
              <h2 className={styles.docTitle}>{selected.title}</h2>
              {(() => {
                const key = formSheet;
                const isEditing = editingSheet === key;
                const sheet =
                  isEditing && draftSheet ? draftSheet : viewData[key];
                return (
                  <div className={styles.sheetBlock}>
                    {canEdit && (
                      <div className={styles.sheetActions}>
                        {isEditing ? (
                          <>
                            <button
                              className={styles.btnGhost}
                              onClick={cancelSheetEdit}
                              disabled={saving}
                            >
                              <X size={14} /> 취소
                            </button>
                            <button
                              className={styles.btnPrimary}
                              onClick={saveSheet}
                              disabled={saving}
                            >
                              <Save size={14} />{" "}
                              {saving ? "저장 중..." : "저장"}
                            </button>
                          </>
                        ) : (
                          <button
                            className={styles.btnPrimary}
                            onClick={() => startSheetEdit(key)}
                            disabled={saving}
                          >
                            <Pencil size={14} />{" "}
                            {key === "team"
                              ? "팀역량평가서 수정"
                              : "개인역량평가서 수정"}
                          </button>
                        )}
                      </div>
                    )}
                    <SheetView
                      sheet={sheet}
                      editing={isEditing}
                      onChange={mutateDraftSheet}
                    />
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      ) : tab === "write" ? (
        /* ── 평가 작성 ── */
        writeTarget ? (
          <div className={styles.docWrap}>
            <div className={styles.doc}>
              <div className={styles.writeHeader}>
                <button
                  className={styles.btnGhost}
                  onClick={() => setWriteTarget(null)}
                >
                  <ArrowLeft size={15} /> 목록으로
                </button>
                <h2 className={styles.writeTitle}>
                  {writeTarget.label}
                  <span className={styles.writeSheetName}>
                    {writeTarget.sheetKey === "team"
                      ? " — 팀 역량평가"
                      : " — 개인 역량평가"}
                  </span>
                </h2>
                <div className={styles.writeActions}>
                  {writeLocked ? (
                    <span className={styles.lockedBadge}>제출 완료 (읽기 전용)</span>
                  ) : (
                    <>
                      <button
                        className={styles.btnGhost}
                        onClick={() => handleWriteSave(false)}
                        disabled={saving}
                      >
                        <Save size={15} /> 임시저장
                      </button>
                      <button
                        className={styles.btnPrimary}
                        onClick={() => handleWriteSave(true)}
                        disabled={saving}
                      >
                        <Send size={15} /> 제출
                      </button>
                    </>
                  )}
                </div>
              </div>
              <SheetView
                sheet={selected.form_data[writeTarget.sheetKey]}
                editing={false}
                onChange={() => {}}
                scores={writeScores}
                onScore={
                  writeLocked
                    ? undefined
                    : (bi, ii, value) =>
                        setWriteScores((prev) => {
                          const next = prev.map((row) => [...row]);
                          if (next[bi]) next[bi][ii] = value;
                          return next;
                        })
                }
              />
            </div>
          </div>
        ) : (
          <TargetList
            evalCtx={evalCtx}
            findEvaluation={findEvaluation}
            onOpen={openWrite}
          />
        )
      ) : (
        /* ── 평가 현황 (경영실장) ── */
        overviewDetail ? (
          <div className={styles.docWrap}>
            <div className={styles.doc}>
              <div className={styles.writeHeader}>
                <button
                  className={styles.btnGhost}
                  onClick={() => setOverviewDetail(null)}
                >
                  <ArrowLeft size={15} /> 목록으로
                </button>
                <h2 className={styles.writeTitle}>
                  {overviewDetail.target_name}
                  <span className={styles.writeSheetName}>
                    {overviewDetail.sheet_key === "team"
                      ? " — 팀 역량평가"
                      : " — 개인 역량평가"}
                    {" · 평가자: "}
                    {overviewDetail.evaluator_name}
                  </span>
                </h2>
                <div />
              </div>
              <SheetView
                sheet={selected.form_data[overviewDetail.sheet_key]}
                editing={false}
                onChange={() => {}}
                scores={normalizeScores(
                  selected.form_data[overviewDetail.sheet_key],
                  overviewDetail.scores,
                )}
              />
            </div>
          </div>
        ) : (
          <OverviewList
            rows={overviewRows}
            sheet={selected.form_data}
            onView={setOverviewDetail}
            onReopen={handleReopen}
            onDelete={handleEvalDelete}
          />
        )
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 평가 대상 목록 (평가 작성 탭)
// ─────────────────────────────────────────────────────────────────────
function TargetList({
  evalCtx,
  findEvaluation,
  onOpen,
}: {
  evalCtx: EvalContext | null;
  findEvaluation: (target: WriteTarget) => EvaluationRow | undefined;
  onOpen: (target: WriteTarget) => void;
}) {
  if (!evalCtx?.canEvaluate) {
    return (
      <div className={styles.empty}>
        평가 작성 권한이 없습니다. 본부장은 어드민 → 사업부 탭, 팀장은 어드민 → 팀
        탭에서 지정합니다. (팀 역량평가: 본부장 / 개인 역량평가: 팀장·본부장)
      </div>
    );
  }

  const statusBadge = (ev?: EvaluationRow) => {
    if (!ev) return <span className={styles.badgeNone}>미작성</span>;
    if (ev.status === "submitted")
      return <span className={styles.badgeDone}>제출 완료</span>;
    return <span className={styles.badgeDraft}>작성 중</span>;
  };

  return (
    <div className={styles.targetWrap}>
      {evalCtx.teamTargets.length > 0 && (
        <section className={styles.targetSection}>
          <h3 className={styles.targetSectionTitle}>
            팀 역량평가 <span className={styles.targetHint}>평가자: 사업본부장</span>
          </h3>
          <ul className={styles.targetList}>
            {evalCtx.teamTargets.map((t) => {
              const target: WriteTarget = {
                sheetKey: "team",
                teamId: t.teamId,
                label: t.teamName,
              };
              const ev = findEvaluation(target);
              return (
                <li key={t.teamId} className={styles.targetRow}>
                  <span className={styles.targetName}>{t.teamName}</span>
                  {statusBadge(ev)}
                  <button
                    className={styles.btnGhost}
                    onClick={() => onOpen(target)}
                  >
                    {ev?.status === "submitted" ? (
                      <>
                        <Eye size={14} /> 보기
                      </>
                    ) : (
                      <>
                        <Pencil size={14} /> 작성
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {evalCtx.personalTargets.length > 0 && (
        <section className={styles.targetSection}>
          <h3 className={styles.targetSectionTitle}>
            개인 역량평가{" "}
            <span className={styles.targetHint}>
              팀원 → 팀장 작성 / 팀장 → 사업본부장 작성
            </span>
          </h3>
          <ul className={styles.targetList}>
            {evalCtx.personalTargets.map((p) => {
              const target: WriteTarget = {
                sheetKey: "personal",
                userId: p.userId,
                label: p.name,
              };
              const ev = findEvaluation(target);
              return (
                <li key={p.userId} className={styles.targetRow}>
                  <span className={styles.targetName}>
                    {p.name}
                    {p.isLeader && <span className={styles.leaderTag}>팀장</span>}
                  </span>
                  <span className={styles.targetTeam}>{p.teamName ?? "-"}</span>
                  {statusBadge(ev)}
                  <button
                    className={styles.btnGhost}
                    onClick={() => onOpen(target)}
                  >
                    {ev?.status === "submitted" ? (
                      <>
                        <Eye size={14} /> 보기
                      </>
                    ) : (
                      <>
                        <Pencil size={14} /> 작성
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 평가 현황 목록 (경영실장)
// ─────────────────────────────────────────────────────────────────────
function OverviewList({
  rows,
  sheet,
  onView,
  onReopen,
  onDelete,
}: {
  rows: OverviewRow[] | null;
  sheet: AppraisalFormData;
  onView: (row: OverviewRow) => void;
  onReopen: (row: OverviewRow) => void;
  onDelete: (row: OverviewRow) => void;
}) {
  if (rows === null) {
    return <div className={styles.empty}>불러오는 중...</div>;
  }
  if (rows.length === 0) {
    return <div className={styles.empty}>작성된 평가가 없습니다.</div>;
  }

  // ── 종합 등급 (규정 제7조: 팀 50% + 개인 50% 합산 → 절대평가 등급) ──
  const teamEvalByTeam = new Map(
    rows
      .filter((r) => r.sheet_key === "team" && r.target_team_id)
      .map((r) => [r.target_team_id as string, r]),
  );
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const summary = rows
    .filter((r) => r.sheet_key === "personal")
    .map((p) => {
      const personalTotal = totalScore(
        normalizeScores(sheet.personal, p.scores),
      );
      const teamEval = p.target_user_team_id
        ? teamEvalByTeam.get(p.target_user_team_id)
        : undefined;
      const teamTotal = teamEval
        ? totalScore(normalizeScores(sheet.team, teamEval.scores))
        : null;
      const combined =
        teamTotal !== null ? combinedScore(teamTotal, personalTotal) : null;
      return {
        id: p.id,
        name: p.target_name,
        teamName: p.target_user_team_name,
        personalTotal,
        teamTotal,
        combined,
        grade: combined !== null ? gradeOf(combined) : null,
        confirmed:
          p.status === "submitted" && teamEval?.status === "submitted",
      };
    })
    .sort((a, b) => (b.combined ?? -1) - (a.combined ?? -1));

  return (
    <div className={styles.overviewStack}>
      {summary.length > 0 && (
        <div className={styles.overviewWrap}>
          <h3 className={styles.overviewTitle}>종합 등급</h3>
          <p className={styles.overviewHint}>
            팀 역량 50% + 개인 역량 50% 합산 · S 95~100 / A 85~94 / B 75~84 /
            C 65~74 / D 64 이하 — 상대평가(권장비율)·KPI 등급조건 적용 전
            절대평가 기준
          </p>
          <table className={styles.overviewTable}>
            <thead>
              <tr>
                <th>직원</th>
                <th>소속 팀</th>
                <th>팀 점수 (50%)</th>
                <th>개인 점수 (50%)</th>
                <th>종합 점수</th>
                <th>등급</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.teamName ?? "-"}</td>
                  <td>
                    {s.teamTotal !== null
                      ? `${fmt(s.teamTotal * 0.5)}점`
                      : "팀 평가 없음"}
                  </td>
                  <td>{fmt(s.personalTotal * 0.5)}점</td>
                  <td className={styles.overviewTotal}>
                    {s.combined !== null ? `${fmt(s.combined)}점` : "-"}
                  </td>
                  <td>
                    {s.grade ? (
                      <span
                        className={`${styles.gradeBadge} ${styles[`grade${s.grade}`]}`}
                      >
                        {s.grade}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {s.confirmed ? (
                      <span className={styles.badgeDone}>제출 완료</span>
                    ) : (
                      <span className={styles.badgeDraft}>집계 중</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.overviewWrap}>
        <h3 className={styles.overviewTitle}>평가 목록</h3>
        <table className={styles.overviewTable}>
        <thead>
          <tr>
            <th>구분</th>
            <th>대상</th>
            <th>평가자</th>
            <th>총점</th>
            <th>상태</th>
            <th>제출일</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const total = totalScore(
              normalizeScores(sheet[row.sheet_key], row.scores),
            );
            return (
              <tr key={row.id}>
                <td>{row.sheet_key === "team" ? "팀 역량" : "개인 역량"}</td>
                <td>{row.target_name}</td>
                <td>{row.evaluator_name}</td>
                <td className={styles.overviewTotal}>{total}점</td>
                <td>
                  {row.status === "submitted" ? (
                    <span className={styles.badgeDone}>제출 완료</span>
                  ) : (
                    <span className={styles.badgeDraft}>작성 중</span>
                  )}
                </td>
                <td>
                  {row.submitted_at
                    ? new Date(row.submitted_at).toLocaleDateString("ko-KR")
                    : "-"}
                </td>
                <td>
                  <div className={styles.overviewActions}>
                    <button className={styles.btnGhost} onClick={() => onView(row)}>
                      <Eye size={13} /> 보기
                    </button>
                    {row.status === "submitted" && (
                      <button
                        className={styles.btnGhost}
                        onClick={() => onReopen(row)}
                      >
                        <RotateCcw size={13} /> 재작성 허용
                      </button>
                    )}
                    <button
                      className={styles.btnDanger}
                      onClick={() => onDelete(row)}
                    >
                      <Trash2 size={13} /> 삭제
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 평가서 1장 (양식 보기/수정 + 점수 입력 겸용)
// ─────────────────────────────────────────────────────────────────────
function SheetView({
  sheet,
  editing,
  onChange,
  scores,
  onScore,
}: {
  sheet: AppraisalSheet;
  editing: boolean;
  onChange: (fn: (sheet: AppraisalSheet) => void) => void;
  /** 점수표 — 있으면 점수 표시(평가 모드) */
  scores?: ScoreMatrix;
  /** 점수 클릭 핸들러 — 있으면 점수 입력 가능 */
  onScore?: (blockIdx: number, indicatorIdx: number, value: number | null) => void;
}) {
  const blocks = sheet.blocks ?? [];
  const hasEvalType =
    editing || blocks.some((b) => b.indicators?.some((i) => i.evalType));
  const scoreCols = SCORE_SCALE.length;
  const totalCols = 4 + (hasEvalType ? 1 : 0) + scoreCols;
  const subtotals = scores ? columnSubtotals(scores) : null;
  const total = scores ? totalScore(scores) : null;

  return (
    <section className={styles.sheet}>
      {/* 상단 정보 */}
      <table className={styles.metaTable}>
        <tbody>
          <tr>
            <th className={styles.metaLabel}>평가서</th>
            <td className={styles.sheetName}>
              <EditableText
                value={sheet.title}
                editing={editing}
                onChange={(v) => onChange((s) => void (s.title = v))}
              />
            </td>
          </tr>
          <tr>
            <th className={styles.metaLabel}>관리부서</th>
            <td>
              <EditableText
                value={sheet.managingDept}
                editing={editing}
                onChange={(v) => onChange((s) => void (s.managingDept = v))}
              />
            </td>
          </tr>
          <tr>
            <th className={styles.metaLabel}>지표명</th>
            <td>
              <EditableText
                value={sheet.indicatorName}
                editing={editing}
                onChange={(v) => onChange((s) => void (s.indicatorName = v))}
              />
            </td>
          </tr>
          <tr>
            <th className={styles.metaLabel}>측정방법</th>
            <td>
              <EditableText
                value={sheet.method}
                editing={editing}
                multiline
                onChange={(v) => onChange((s) => void (s.method = v))}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* 평가 항목 */}
      <table className={styles.mainTable}>
        <thead>
          <tr>
            <th className={styles.colNo}>번호</th>
            <th className={styles.colCategory}>분야</th>
            <th className={styles.colEvaluator}>평가자</th>
            <th>세부지표</th>
            {hasEvalType && <th className={styles.colEvalType}>구분</th>}
            {SCORE_SCALE.map((n) => (
              <th key={n} className={styles.colScore}>
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {blocks.map((block, bi) =>
            (block.indicators ?? []).map((indicator, ii) => (
              <tr key={`${bi}-${ii}`}>
                {ii === 0 && (
                  <>
                    <td rowSpan={block.indicators.length} className={styles.colNo}>
                      {block.no}
                      {editing && blocks.length > 1 && (
                        <button
                          type="button"
                          className={styles.miniBtn}
                          title="분야 삭제"
                          onClick={() =>
                            onChange((s) => {
                              s.blocks.splice(bi, 1);
                              s.blocks.forEach((b, i) => (b.no = i + 1));
                            })
                          }
                        >
                          <Minus size={11} />
                        </button>
                      )}
                    </td>
                    <td rowSpan={block.indicators.length} className={styles.colCategory}>
                      <EditableText
                        value={block.category}
                        editing={editing}
                        multiline
                        center
                        onChange={(v) =>
                          onChange((s) => void (s.blocks[bi].category = v))
                        }
                      />
                    </td>
                    <td rowSpan={block.indicators.length} className={styles.colEvaluator}>
                      <EditableText
                        value={block.evaluator}
                        editing={editing}
                        multiline
                        center
                        onChange={(v) =>
                          onChange((s) => void (s.blocks[bi].evaluator = v))
                        }
                      />
                    </td>
                  </>
                )}
                <td className={styles.indicatorCell}>
                  <div className={styles.indicatorInner}>
                    <EditableText
                      value={indicator.text}
                      editing={editing}
                      onChange={(v) =>
                        onChange((s) => void (s.blocks[bi].indicators[ii].text = v))
                      }
                    />
                    {editing && block.indicators.length > 1 && (
                      <button
                        type="button"
                        className={styles.miniBtn}
                        title="행 삭제"
                        onClick={() =>
                          onChange((s) => void s.blocks[bi].indicators.splice(ii, 1))
                        }
                      >
                        <Minus size={11} />
                      </button>
                    )}
                    {editing && ii === block.indicators.length - 1 && (
                      <button
                        type="button"
                        className={styles.miniBtn}
                        title="행 추가"
                        onClick={() =>
                          onChange((s) =>
                            void s.blocks[bi].indicators.push({ text: "" }),
                          )
                        }
                      >
                        <Plus size={11} />
                      </button>
                    )}
                  </div>
                </td>
                {hasEvalType && (
                  <td className={styles.colEvalType}>
                    <EditableText
                      value={indicator.evalType ?? ""}
                      editing={editing}
                      center
                      placeholder="-"
                      onChange={(v) =>
                        onChange(
                          (s) =>
                            void (s.blocks[bi].indicators[ii].evalType =
                              v.trim() || undefined),
                        )
                      }
                    />
                  </td>
                )}
                {SCORE_SCALE.map((n) => {
                  const marked = scores?.[bi]?.[ii] === n;
                  if (onScore) {
                    return (
                      <td
                        key={n}
                        className={`${styles.scoreCell} ${styles.scoreCellClickable} ${marked ? styles.scoreCellMarked : ""}`}
                        onClick={() => onScore(bi, ii, marked ? null : n)}
                      >
                        {marked ? n : ""}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={n}
                      className={`${styles.scoreCell} ${marked ? styles.scoreCellMarked : ""}`}
                    >
                      {marked ? n : ""}
                    </td>
                  );
                })}
              </tr>
            )),
          )}
          {editing && (
            <tr>
              <td colSpan={totalCols} className={styles.addBlockRow}>
                <button
                  type="button"
                  className={styles.addBlockBtn}
                  onClick={() =>
                    onChange((s) =>
                      void s.blocks.push({
                        no: s.blocks.length + 1,
                        category: "",
                        evaluator: "",
                        indicators: [{ text: "" }],
                      }),
                    )
                  }
                >
                  <Plus size={13} /> 분야 추가
                </button>
              </td>
            </tr>
          )}
          <tr className={styles.subtotalRow}>
            <td colSpan={totalCols - scoreCols}>소 계</td>
            {SCORE_SCALE.map((n) => (
              <td key={n} className={styles.scoreCell}>
                {subtotals ? subtotals[n] : ""}
              </td>
            ))}
          </tr>
          <tr className={styles.totalRow}>
            <td colSpan={totalCols - scoreCols}>총 계</td>
            <td colSpan={scoreCols} className={styles.totalCell}>
              {total !== null ? `${total}점` : ""}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 측정 정보 */}
      <table className={styles.footTable}>
        <thead>
          <tr>
            <th>측정단위</th>
            <th>평가주기</th>
            <th>성과측정/등록주기</th>
            <th>근거자료 및 출처</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <EditableText
                value={sheet.unit}
                editing={editing}
                center
                onChange={(v) => onChange((s) => void (s.unit = v))}
              />
            </td>
            <td>
              <EditableText
                value={sheet.cycle}
                editing={editing}
                center
                onChange={(v) => onChange((s) => void (s.cycle = v))}
              />
            </td>
            <td>
              <EditableText
                value={sheet.registerCycle}
                editing={editing}
                center
                onChange={(v) => onChange((s) => void (s.registerCycle = v))}
              />
            </td>
            <td>
              <EditableText
                value={sheet.evidence}
                editing={editing}
                center
                onChange={(v) => onChange((s) => void (s.evidence = v))}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* 적용대상 / 사용분야 / 유의사항 */}
      <table className={styles.metaTable}>
        <tbody>
          <tr>
            <th className={styles.metaLabel}>적용대상</th>
            <td>
              <EditableText
                value={sheet.target}
                editing={editing}
                onChange={(v) => onChange((s) => void (s.target = v))}
              />
            </td>
          </tr>
          <tr>
            <th className={styles.metaLabel}>사용분야</th>
            <td>
              <EditableText
                value={sheet.usage}
                editing={editing}
                onChange={(v) => onChange((s) => void (s.usage = v))}
              />
            </td>
          </tr>
          <tr>
            <th className={styles.metaLabel}>유의사항</th>
            <td>
              <EditableText
                value={sheet.note}
                editing={editing}
                multiline
                onChange={(v) => onChange((s) => void (s.note = v))}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 보기/수정 겸용 텍스트
// ─────────────────────────────────────────────────────────────────────
function EditableText({
  value,
  editing,
  onChange,
  multiline = false,
  center = false,
  placeholder,
}: {
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  multiline?: boolean;
  center?: boolean;
  placeholder?: string;
}) {
  if (!editing) {
    return (
      <span className={`${styles.text}${center ? ` ${styles.textCenter}` : ""}`}>
        {value || (placeholder ?? "")}
      </span>
    );
  }
  if (multiline) {
    return (
      <textarea
        className={`${styles.cellTextarea}${center ? ` ${styles.textCenter}` : ""}`}
        value={value}
        rows={Math.max(2, value.split("\n").length)}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      className={`${styles.cellInput}${center ? ` ${styles.textCenter}` : ""}`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
