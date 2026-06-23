"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Printer,
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
  ArrowLeft,
  RotateCcw,
  Eye,
  Paperclip,
  Flag,
  Info,
} from "lucide-react";
import styles from "./page.module.css";
import {
  type AppraisalFormData,
  type AppraisalFormRow,
  type AppraisalSheet,
  type ScoreMatrix,
  combinedScore,
  createEmptyFormData,
  gradeOf,
  kpiCapGrade,
  lowerGrade,
  normalizeScores,
  totalScore,
} from "@/lib/appraisal/form";
import {
  quantIndicatorKind,
  type QuantMetrics,
} from "@/lib/appraisal/quantScore";
import {
  defaultPeriod,
  parsePeriod,
  periodLabel,
  periodOptions,
} from "@/lib/appraisal/period";
import { SheetView } from "./_components/SheetView";

type SheetKey = "team" | "personal";
type TabKey = "form" | "write" | "status";

interface EvaluationRow {
  id: string;
  form_id?: string;
  sheet_key: SheetKey;
  target_team_id: string | null;
  target_user_id: number | null;
  evaluator_id: number;
  scores: unknown;
  status: "draft" | "submitted";
  submitted_at: string | null;
  updated_at: string;
}

interface AppealRow {
  id: string;
  evaluation_id: string;
  user_id: number;
  content: string;
  attachments: { name: string; url: string }[];
  status: "pending" | "resolved";
  created_at: string;
  resolved_at: string | null;
  /** 항목별 이의제기 — 평가서 행 위치 (null = 평가 전체) */
  block_index?: number | null;
  indicator_index?: number | null;
  indicator_text?: string | null;
}

/** 이의제기 본문 — 길면 3줄 접고 더보기로 펼침 */
function ClampText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 160 || text.split("\n").length > 3;
  return (
    <div className={styles.appealItemContent}>
      <span className={!expanded && isLong ? styles.appealItemClamped : ""}>
        {text}
      </span>
      {isLong && (
        <button
          type="button"
          className={styles.appealMoreBtn}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "접기" : "더보기"}
        </button>
      )}
    </div>
  );
}

/** 항목별 이의제기 행 위치 추출 — SheetView 뱃지 표시용 */
function indicatorAppealMarks(appeals: AppealRow[], evaluationId?: string) {
  return appeals
    .filter(
      (a) =>
        (!evaluationId || a.evaluation_id === evaluationId) &&
        a.block_index != null &&
        a.indicator_index != null,
    )
    .map((a) => ({
      blockIndex: a.block_index as number,
      indicatorIndex: a.indicator_index as number,
      status: a.status,
      content: a.content,
      attachments: a.attachments ?? [],
      createdAt: a.created_at,
    }));
}

interface EvalContext {
  canEvaluate: boolean;
  canOverview: boolean;
  /** 평가 현황 관리(재오픈·삭제) 권한 — 경영실장/master-admin */
  canManageOverview?: boolean;
  isMaster: boolean;
  teamTargets: { teamId: string; teamName: string }[];
  personalTargets: {
    userId: number;
    name: string;
    teamId: string | null;
    teamName: string | null;
    isLeader: boolean;
  }[];
  evaluations: EvaluationRow[];
  appeals: AppealRow[];
}

interface OverviewRow extends EvaluationRow {
  target_name: string;
  evaluator_name: string;
  target_user_team_id: string | null;
  target_user_team_name: string | null;
  /** KPI 달성률(%) — 대시보드 월 목표 분기 합산 대비 매출 (목표 미설정 시 null) */
  target_kpi_rate?: number | null;
}

interface WriteTarget {
  sheetKey: SheetKey;
  teamId?: string;
  userId?: number;
  label: string;
  /** 이 대상에 적용되는 양식 (팀 전용 양식 자동 매칭) */
  formId?: string;
}

export default function AppraisalPage() {
  const [forms, setForms] = useState<AppraisalFormRow[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
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

  // 평가 분기 — 평가 작성·평가 현황 공용 (2026년 3분기부터, 분기가 지나면 자동 추가)
  const [period, setPeriod] = useState(defaultPeriod());

  // 평가 작성
  const [evalCtx, setEvalCtx] = useState<EvalContext | null>(null);
  const [writeTarget, setWriteTarget] = useState<WriteTarget | null>(null);
  const [writeScores, setWriteScores] = useState<ScoreMatrix>([]);
  const [writeLocked, setWriteLocked] = useState(false);
  // 제출 시도 시 빈칸 빨간 표시
  const [showMissingMarks, setShowMissingMarks] = useState(false);

  // 평가 현황 (경영실장)
  const [overviewRows, setOverviewRows] = useState<OverviewRow[] | null>(null);
  const [overviewAppeals, setOverviewAppeals] = useState<AppealRow[]>([]);
  const [overviewDetail, setOverviewDetail] = useState<OverviewRow | null>(
    null,
  );

  // 정량평가 자동 산출 (매출 달성률·등록률·배정 DB·환불·근태) — 개인 역량평가 대상자 기준
  const [quantMetric, setQuantMetric] = useState<QuantMetrics | null>(null);
  const quantUserId =
    writeTarget?.sheetKey === "personal" && writeTarget.userId != null
      ? writeTarget.userId
      : overviewDetail?.sheet_key === "personal" &&
          overviewDetail.target_user_id != null
        ? overviewDetail.target_user_id
        : null;

  useEffect(() => {
    setQuantMetric(null);
    if (quantUserId == null) return;
    let cancelled = false;
    const { year, quarter } = parsePeriod(period);
    fetch(
      `/api/appraisal-evaluations/quant-metrics?userId=${quantUserId}&year=${year}&quarter=${quarter}`,
      { cache: "no-store" },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setQuantMetric(data as QuantMetrics);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [quantUserId, period]);

  const loadForms = useCallback(async (selectId?: string) => {
    try {
      const res = await fetch("/api/appraisal-forms", { cache: "no-store" });
      if (!res.ok) throw new Error("불러오기 실패");
      const data = (await res.json()) as {
        forms: AppraisalFormRow[];
        canEdit: boolean;
        teams?: { id: string; name: string }[];
      };
      setForms(data.forms);
      setCanEdit(data.canEdit);
      setTeams(data.teams ?? []);
      setSelectedId((prev) => {
        if (selectId && data.forms.some((f) => f.id === selectId))
          return selectId;
        if (prev && data.forms.some((f) => f.id === prev)) return prev;
        return data.forms[0]?.id ?? null;
      });
    } catch {
      // 네트워크 오류 시 빈 상태 유지
    } finally {
      setLoading(false);
    }
  }, []);

  // 평가 작성용 — 분기 내 모든 양식의 평가를 한 번에 조회 (팀별 양식 자동 매칭)
  const loadEvaluations = useCallback(async (p: string) => {
    try {
      const res = await fetch(`/api/appraisal-evaluations?period=${p}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      setEvalCtx((await res.json()) as EvalContext);
    } catch {
      setEvalCtx(null);
    }
  }, []);

  const loadOverview = useCallback(async (formId: string, p: string) => {
    try {
      const res = await fetch(
        `/api/appraisal-evaluations/overview?formId=${formId}&period=${p}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        evaluations: OverviewRow[];
        appeals?: AppealRow[];
      };
      setOverviewRows(data.evaluations);
      setOverviewAppeals(data.appeals ?? []);
    } catch {
      setOverviewRows([]);
      setOverviewAppeals([]);
    }
  }, []);

  useEffect(() => {
    void loadForms();
  }, [loadForms]);

  // 평가 작성 — 분기 변경 시에만 재조회 (양식 선택과 무관하게 전체 대상 노출)
  useEffect(() => {
    setWriteTarget(null);
    void loadEvaluations(period);
  }, [period, loadEvaluations]);

  // 평가 현황 — 선택 양식/분기 기준
  useEffect(() => {
    setOverviewDetail(null);
    setOverviewRows(null);
  }, [selectedId, period]);

  useEffect(() => {
    if (tab === "status" && selectedId && overviewRows === null) {
      void loadOverview(selectedId, period);
    }
  }, [tab, selectedId, period, overviewRows, loadOverview]);

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

  // 평가 대상에 적용되는 양식 — 대상 팀 전용 양식 > 전사 공통 양식 > 현재 선택 양식
  const formIdForTarget = useCallback(
    (target: WriteTarget): string | null => {
      const teamId =
        target.sheetKey === "team"
          ? (target.teamId ?? null)
          : (evalCtx?.personalTargets.find((p) => p.userId === target.userId)
              ?.teamId ?? null);
      const teamForm = teamId
        ? forms.find((f) => f.team_id === teamId)
        : undefined;
      const commonForm = forms.find((f) => !f.team_id);
      return (teamForm ?? commonForm ?? selected)?.id ?? null;
    },
    [forms, evalCtx, selected],
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
    // 기존 양식 복사 — 현재 선택된 고과표를 기반으로 시작 (취소 = 빈 양식)
    const copyFrom =
      selected &&
      window.confirm(
        `현재 보고 있는 '${selected.title}' 양식을 복사해서 만들까요?\n(취소를 누르면 빈 양식으로 시작합니다)`,
      )
        ? structuredClone(selected.form_data)
        : createEmptyFormData();
    setSaving(true);
    try {
      const res = await fetch("/api/appraisal-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), form_data: copyFrom }),
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

  // 양식 적용 팀 지정 (경영실장) — null = 전사 공통
  const handleAssignTeam = async (teamId: string) => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/appraisal-forms/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: teamId || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "팀 지정에 실패했습니다.");
      }
      await loadForms(selected.id);
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
  // 대상 + 해당 대상에 적용되는 양식 기준으로 기존 평가를 찾는다
  const findEvaluation = useCallback(
    (target: WriteTarget): EvaluationRow | undefined => {
      const formId = formIdForTarget(target);
      return evalCtx?.evaluations.find(
        (ev) =>
          (!ev.form_id || !formId || ev.form_id === formId) &&
          (target.sheetKey === "team"
            ? ev.sheet_key === "team" && ev.target_team_id === target.teamId
            : ev.sheet_key === "personal" &&
              ev.target_user_id === target.userId),
      );
    },
    [evalCtx, formIdForTarget],
  );

  // 처리 대기 중 이의제기 — 있으면 제출된 평가도 재수정 가능
  const findPendingAppeal = useCallback(
    (evaluationId: string | undefined): AppealRow | undefined =>
      evaluationId
        ? evalCtx?.appeals?.find(
            (a) => a.evaluation_id === evaluationId && a.status === "pending",
          )
        : undefined,
    [evalCtx],
  );

  const openWrite = (target: WriteTarget) => {
    // 대상 팀 전용 양식 자동 매칭 — 영업팀원이면 영업팀 양식, 없으면 공통 양식
    const formId = formIdForTarget(target);
    const form = forms.find((f) => f.id === formId) ?? selected;
    if (!form) return;
    const sheet = form.form_data[target.sheetKey];
    const existing = findEvaluation(target);
    setWriteScores(normalizeScores(sheet, existing?.scores));
    setShowMissingMarks(false);
    setWriteLocked(
      existing?.status === "submitted" &&
        !(evalCtx?.isMaster ?? false) &&
        !findPendingAppeal(existing?.id),
    );
    setWriteTarget({ ...target, formId: form.id });
    // 상단 양식 선택도 동기화 (작성 화면이 닫히지 않도록 평가 재조회는 안 함)
    if (form.id !== selectedId) setSelectedId(form.id);
  };

  const handleWriteSave = async (submit: boolean) => {
    if (!selected || !writeTarget) return;
    const writeFormId = writeTarget.formId ?? selected.id;
    // 정량 지표(자동산출) 행은 산출 불가로 비어 있어도 제출 허용 (수동 입력 잠금 상태)
    const writeSheet = (forms.find((f) => f.id === writeFormId) ?? selected)
      .form_data[writeTarget.sheetKey];
    const isAutoQuantRow = (bi: number, ii: number) =>
      !!quantMetric &&
      quantIndicatorKind(
        writeSheet?.blocks?.[bi]?.indicators?.[ii]?.text ?? "",
      ) != null;
    // 제출 시 빈칸이 있으면 차단하고 해당 칸을 빨간색으로 표시
    if (
      submit &&
      writeScores.some((row, bi) =>
        row.some((v, ii) => v === null && !isAutoQuantRow(bi, ii)),
      )
    ) {
      setShowMissingMarks(true);
      alert(
        "체크되지 않은 항목이 있습니다. 빨간색으로 표시된 칸을 모두 체크한 뒤 제출해주세요.",
      );
      setTimeout(() => {
        document
          .querySelector('[data-score-missing="1"]')
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/appraisal-evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_id: writeFormId,
          sheet_key: writeTarget.sheetKey,
          target_team_id: writeTarget.teamId ?? null,
          target_user_id: writeTarget.userId ?? null,
          scores: writeScores,
          submit,
          period,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "저장에 실패했습니다.");
      }
      await loadEvaluations(period);
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
    if (
      !window.confirm(
        "평가자에게 재평가를 요청할까요?\n제출이 취소되고 평가자가 다시 수정할 수 있게 됩니다.",
      )
    )
      return;
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
      await Promise.all([
        loadOverview(selectedId, period),
        loadEvaluations(period),
      ]);
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
      await Promise.all([
        loadOverview(selectedId, period),
        loadEvaluations(period),
      ]);
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
                  {f.title} -{" "}
                  {f.team_id
                    ? (teams.find((t) => t.id === f.team_id)?.name ?? "팀 지정")
                    : "전사 공통"}
                </option>
              ))}
            </select>
          )}
          {editingSheet === null && tab !== "form" && (
            <select
              className={styles.formSelect}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {periodOptions().map((p) => (
                <option key={p} value={p}>
                  {periodLabel(p)}
                </option>
              ))}
            </select>
          )}
          {canEdit && (
            <span className={styles.editorBadge}>
              경영실장 · 양식 수정 가능
            </span>
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
              <button
                className={styles.btnGhost}
                onClick={handleCreate}
                disabled={saving}
              >
                <Plus size={15} /> 새 고과표
              </button>
              {selected && (
                <>
                  <select
                    className={styles.formSelect}
                    value={selected.team_id ?? ""}
                    onChange={(e) => void handleAssignTeam(e.target.value)}
                    disabled={saving}
                    title="이 양식을 사용할 팀 지정"
                  >
                    <option value="">적용: 전사 공통</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        적용: {t.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className={styles.btnGhost}
                    onClick={handleRename}
                    disabled={saving}
                  >
                    <Pencil size={15} /> 제목 수정
                  </button>
                  <button
                    className={styles.btnDanger}
                    onClick={handleDelete}
                    disabled={saving}
                  >
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
          {/* 평가 현황 — 경영실장·사업본부장 열람 */}
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
                    <span className={styles.lockedBadge}>
                      제출 완료 (읽기 전용)
                    </span>
                  ) : (
                    <>
                      <button
                        className={styles.btnGhost}
                        onClick={() => handleWriteSave(false)}
                        disabled={saving}
                      >
                        임시저장
                      </button>
                      <button
                        className={styles.btnPrimary}
                        onClick={() => handleWriteSave(true)}
                        disabled={saving}
                      >
                        제출
                      </button>
                    </>
                  )}
                </div>
              </div>
              {(() => {
                // 이의제기 전체 이력 — 처리 대기뿐 아니라 재평가 완료된 건도 평가자가 확인
                const evalId = findEvaluation(writeTarget)?.id;
                const rowAppeals = evalId
                  ? (evalCtx?.appeals ?? []).filter(
                      (a) => a.evaluation_id === evalId,
                    )
                  : [];
                if (rowAppeals.length === 0) return null;
                const pendingCount = rowAppeals.filter(
                  (a) => a.status === "pending",
                ).length;
                return (
                  <div className={styles.appealPanel}>
                    {/* 헤더 — 플래그 아이콘 + 제목 + 건수 + 전체 상태 */}
                    <div className={styles.appealPanelTitleRow}>
                      <div className={styles.appealPanelTitleCol}>
                        <span className={styles.appealPanelTitle}>
                          이의제기
                          <span className={styles.appealCountBadge}>
                            {rowAppeals.length}건
                          </span>
                        </span>
                        <span className={styles.appealPanelSub}>
                          평가 대상자가 점수에 이의를 제기했어요
                        </span>
                      </div>
                    </div>

                    {/* 건별 카드 */}
                    {rowAppeals.map((a) => (
                      <div key={a.id} className={styles.appealHistoryItem}>
                        <div className={styles.appealItemHead}>
                          <span className={styles.appealItemLabel}>
                            대상 항목
                          </span>
                          <span className={styles.appealItemTitle}>
                            {a.indicator_text ?? "평가 전체"}
                          </span>
                          <span className={styles.appealItemRight}>
                            <span className={styles.appealPanelDate}>
                              {new Date(a.created_at).toLocaleDateString(
                                "ko-KR",
                              )}
                            </span>
                            <span
                              className={
                                a.status === "pending"
                                  ? styles.appealStatusPillPending
                                  : styles.appealStatusPillDone
                              }
                            >
                              <i className={styles.appealStatusDot} />
                              {a.status === "pending"
                                ? "처리 대기"
                                : "처리 완료"}
                            </span>
                          </span>
                        </div>
                        <ClampText text={a.content} />
                        {a.attachments?.length > 0 && (
                          <div className={styles.appealPanelFiles}>
                            {a.attachments.map((f, i) => (
                              <a
                                key={i}
                                href={f.url}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.appealFileLink}
                              >
                                <Paperclip size={12} /> {f.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* 안내 — 재제출 시 자동 처리 */}
                    {pendingCount > 0 && (
                      <p className={styles.appealInfoBar}>
                        <Info size={14} /> 점수를 검토하고 다시 제출하면
                        이의제기가 자동으로 <b>처리 완료</b>돼요.
                      </p>
                    )}
                  </div>
                );
              })()}
              <SheetView
                sheet={
                  (forms.find((f) => f.id === writeTarget.formId) ?? selected)
                    .form_data[writeTarget.sheetKey]
                }
                editing={false}
                onChange={() => {}}
                salesMetric={quantMetric}
                highlightMissing={showMissingMarks}
                indicatorAppeals={indicatorAppealMarks(
                  evalCtx?.appeals ?? [],
                  findEvaluation(writeTarget)?.id,
                )}
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
      ) : /* ── 평가 현황 (경영실장) ── */
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
            {(() => {
              const rowAppeals = overviewAppeals.filter(
                (a) => a.evaluation_id === overviewDetail.id,
              );
              if (rowAppeals.length === 0) return null;
              return (
                <div className={styles.appealPanel}>
                  <div className={styles.appealPanelTitleRow}>
                    <span className={styles.appealPanelFlag}>
                      <Flag size={17} />
                    </span>
                    <div className={styles.appealPanelTitleCol}>
                      <span className={styles.appealPanelTitle}>
                        이의제기
                        <span className={styles.appealCountBadge}>
                          {rowAppeals.length}건
                        </span>
                      </span>
                      <span className={styles.appealPanelSub}>
                        평가 대상자가 점수에 이의를 제기했어요
                      </span>
                    </div>
                  </div>
                  {rowAppeals.map((a) => (
                    <div key={a.id} className={styles.appealHistoryItem}>
                      <div className={styles.appealItemHead}>
                        <span className={styles.appealItemLabel}>
                          대상 항목
                        </span>
                        <span className={styles.appealItemTitle}>
                          {a.indicator_text ?? "평가 전체"}
                        </span>
                        <span className={styles.appealItemRight}>
                          <span className={styles.appealPanelDate}>
                            {new Date(a.created_at).toLocaleDateString("ko-KR")}
                          </span>
                          <span
                            className={
                              a.status === "pending"
                                ? styles.appealStatusPillPending
                                : styles.appealStatusPillDone
                            }
                          >
                            <i className={styles.appealStatusDot} />
                            {a.status === "pending" ? "처리 대기" : "처리 완료"}
                          </span>
                        </span>
                      </div>
                      <ClampText text={a.content} />
                      {a.attachments?.length > 0 && (
                        <div className={styles.appealPanelFiles}>
                          {a.attachments.map((f, i) => (
                            <a
                              key={i}
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.appealFileLink}
                            >
                              <Paperclip size={12} /> {f.name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
            <SheetView
              sheet={selected.form_data[overviewDetail.sheet_key]}
              editing={false}
              onChange={() => {}}
              salesMetric={quantMetric}
              indicatorAppeals={indicatorAppealMarks(
                overviewAppeals,
                overviewDetail.id,
              )}
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
          appeals={overviewAppeals}
          sheet={selected.form_data}
          canManage={evalCtx?.canManageOverview ?? false}
          onView={setOverviewDetail}
          onReopen={handleReopen}
          onDelete={handleEvalDelete}
        />
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
        평가 작성 권한이 없습니다. 본부장은 어드민 → 사업부 탭, 팀장은 어드민 →
        팀 탭에서 지정합니다. (팀 역량평가: 본부장 / 개인 역량평가: 팀장·본부장)
      </div>
    );
  }

  const statusBadge = (ev?: EvaluationRow) => {
    if (!ev)
      return (
        <span className={`${styles.evStatus} ${styles.evStatusNone}`}>
          <i className={styles.evStatusDot} />
          미작성
        </span>
      );
    if (ev.status === "submitted")
      return (
        <span className={`${styles.evStatus} ${styles.evStatusDone}`}>
          <i className={styles.evStatusDot} />
          제출 완료
        </span>
      );
    return (
      <span className={`${styles.evStatus} ${styles.evStatusDraft}`}>
        <i className={styles.evStatusDot} />
        작성 중
      </span>
    );
  };

  return (
    <div className={styles.targetWrap}>
      {evalCtx.teamTargets.length > 0 && (
        <section className={styles.evCard}>
          <div className={styles.evCardHead}>
            <div className={styles.evCardHeadLeft}>
              <span className={styles.evCardTitle}>팀 역량평가</span>
              <span className={styles.evCardHint}>평가자 · 사업본부장</span>
            </div>
            <span className={styles.evCountPill}>
              총 {evalCtx.teamTargets.length}팀
            </span>
          </div>

          <div className={`${styles.evColHeader} ${styles.evGridTeam}`}>
            <span>팀명</span>
            <span>상태</span>
            <span />
          </div>

          {evalCtx.teamTargets.map((t) => {
            const target: WriteTarget = {
              sheetKey: "team",
              teamId: t.teamId,
              label: t.teamName,
            };
            const ev = findEvaluation(target);
            return (
              <div
                key={t.teamId}
                className={`${styles.evRow} ${styles.evGridTeam}`}
              >
                <span className={styles.evName}>{t.teamName}</span>
                <span className={styles.evStatusCell}>{statusBadge(ev)}</span>
                <button
                  className={styles.evWriteBtn}
                  onClick={() => onOpen(target)}
                >
                  {ev?.status === "submitted" ? (
                    <>
                      <Eye size={13} /> 보기
                    </>
                  ) : (
                    <>
                      <Pencil size={13} /> 작성
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </section>
      )}

      {evalCtx.personalTargets.length > 0 && (
        <section className={styles.evCard}>
          <div className={styles.evCardHead}>
            <div className={styles.evCardHeadLeft}>
              <span className={styles.evCardTitle}>개인 역량평가</span>
              <span className={styles.evCardHint}>
                팀원 → 팀장 작성 · 팀장 → 사업본부장 작성
              </span>
            </div>
            <span className={styles.evCountPill}>
              총 {evalCtx.personalTargets.length}명
            </span>
          </div>

          <div className={`${styles.evColHeader} ${styles.evGridPerson}`}>
            <span>이름</span>
            <span>소속팀</span>
            <span>상태</span>
            <span />
          </div>

          {evalCtx.personalTargets.map((p) => {
            const target: WriteTarget = {
              sheetKey: "personal",
              userId: p.userId,
              label: p.name,
            };
            const ev = findEvaluation(target);
            const hasPendingAppeal =
              !!ev &&
              (evalCtx.appeals ?? []).some(
                (a) => a.evaluation_id === ev.id && a.status === "pending",
              );
            return (
              <div
                key={p.userId}
                className={`${styles.evRow} ${styles.evGridPerson}`}
              >
                <span className={styles.evName}>
                  {p.name}
                  {p.isLeader && <span className={styles.leaderTag}>팀장</span>}
                </span>
                <span className={styles.evTeam}>{p.teamName ?? "-"}</span>
                <span className={styles.evStatusCell}>
                  {statusBadge(ev)}
                  {hasPendingAppeal && (
                    <span className={styles.badgeAppeal}>이의제기</span>
                  )}
                </span>
                <button
                  className={styles.evWriteBtn}
                  onClick={() => onOpen(target)}
                >
                  {hasPendingAppeal ? (
                    <>
                      <Pencil size={13} /> 재평가
                    </>
                  ) : ev?.status === "submitted" ? (
                    <>
                      <Eye size={13} /> 보기
                    </>
                  ) : (
                    <>
                      <Pencil size={13} /> 작성
                    </>
                  )}
                </button>
              </div>
            );
          })}
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
  appeals,
  sheet,
  canManage,
  onView,
  onReopen,
  onDelete,
}: {
  rows: OverviewRow[] | null;
  appeals: AppealRow[];
  sheet: AppraisalFormData;
  /** 재오픈·삭제 가능 여부 — 경영실장/master-admin (본부장은 열람 전용) */
  canManage: boolean;
  onView: (row: OverviewRow) => void;
  onReopen: (row: OverviewRow) => void;
  onDelete: (row: OverviewRow) => void;
}) {
  if (rows === null) {
    return <div className={styles.empty}>불러오는 중...</div>;
  }
  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        이 분기에 작성된 평가가 없습니다. 상단에서 분기를 변경해보세요.
      </div>
    );
  }

  const pendingAppealEvalIds = new Set(
    appeals.filter((a) => a.status === "pending").map((a) => a.evaluation_id),
  );

  // ── 요약 카드 ──────────────────────────────────────────────────────
  const submittedCount = rows.filter((r) => r.status === "submitted").length;
  const draftCount = rows.length - submittedCount;
  const appealCount = pendingAppealEvalIds.size;

  // ── 종합 등급 (규정 제7조) ──────────────────────────────────────────
  // ① 절대평가점수 = 팀 역량 50% + 개인 역량 50%
  // ② 상대평가점수 = 절대평가 순위 백분위를 권장비율로 등급 구간 보정
  // ③ 등급 조건 = KPI 달성률 100%↑ S / 90%↑ A / 미만 B (하향 하한 B)
  // ④ 최종점수·등급 = 상대평가점수를 확정 등급 구간으로 보정
  const teamEvalByTeam = new Map(
    rows
      .filter((r) => r.sheet_key === "team" && r.target_team_id)
      .map((r) => [r.target_team_id as string, r]),
  );
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const base = rows
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
        row: p,
        name: p.target_name,
        teamName: p.target_user_team_name,
        evaluatorName: p.evaluator_name,
        personalTotal,
        teamTotal,
        combined,
        kpiRate: p.target_kpi_rate ?? null,
        submitted: p.status === "submitted",
        hasAppeal: pendingAppealEvalIds.has(p.id),
      };
    });

  // 등급 = 절대평가 점수 기반 / 최종등급 = 절대등급에 KPI 상한 적용(하향만)
  const summary = base
    .map((s) => {
      if (s.combined === null) {
        return {
          ...s,
          grade: null as ReturnType<typeof gradeOf> | null,
          finalGrade: null as ReturnType<typeof gradeOf> | null,
        };
      }
      // 등급 — 절대평가 점수 구간 등급
      const grade = gradeOf(s.combined);
      // 최종등급 — KPI 허용 등급으로 하향(상한). KPI 없으면 절대등급 유지
      const finalGrade =
        s.kpiRate !== null
          ? lowerGrade(grade, kpiCapGrade(s.kpiRate))
          : grade;
      return { ...s, grade, finalGrade };
    })
    .sort((a, b) => (b.combined ?? -1) - (a.combined ?? -1));

  const teamRows = rows.filter((r) => r.sheet_key === "team");

  return (
    <div className={styles.overviewStack}>
      {/* 요약 카드 */}
      <div className={styles.statCards}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{submittedCount}</span>
          <span className={styles.statLabel}>제출 완료</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{draftCount}</span>
          <span className={styles.statLabel}>작성 중</span>
        </div>
        <div
          className={`${styles.statCard} ${appealCount > 0 ? styles.statCardAlert : ""}`}
        >
          <span className={styles.statValue}>{appealCount}</span>
          <span className={styles.statLabel}>이의제기 대기</span>
        </div>
      </div>

      {/* 직원별 종합 — 개인 평가 액션 포함 */}
      {summary.length > 0 && (
        <div className={styles.overviewWrap}>
          <h3 className={styles.overviewTitle}>직원별 종합</h3>
          <p className={styles.overviewHint}>
            절대평가 = 팀 역량 50% + 개인 역량 50% · 등급 = 절대평가 점수 구간
            (S 95~100 / A 85~94 / B 75~84 / C 65~74 / D 64 이하) · 최종등급 =
            등급에 KPI 달성률 상한 적용(KPI 100%↑ S / 90%↑ A / 미만 B,
            하향만 적용)
          </p>
          <table className={styles.overviewTable}>
            <thead>
              <tr>
                <th>직원</th>
                <th>소속 팀</th>
                <th>평가자</th>
                <th>팀 점수</th>
                <th>개인 점수</th>
                <th>절대평가</th>
                <th>등급</th>
                <th>KPI 달성률</th>
                <th>최종등급</th>
                <th>상태</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.row.id}>
                  <td>{s.name}</td>
                  <td>{s.teamName ?? "-"}</td>
                  <td>{s.evaluatorName}</td>
                  <td>
                    {s.teamTotal !== null ? `${fmt(s.teamTotal * 0.5)}점` : "-"}
                  </td>
                  <td>{fmt(s.personalTotal * 0.5)}점</td>
                  <td>{s.combined !== null ? `${fmt(s.combined)}점` : "-"}</td>
                  <td>
                    {s.grade ? (
                      <span className={styles.gradePlain}>{s.grade}</span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {s.kpiRate !== null ? `${fmt(s.kpiRate)}%` : "목표 없음"}
                  </td>
                  <td className={styles.overviewTotal}>
                    {s.finalGrade ? (
                      <span
                        className={`${styles.gradeBadge} ${styles[`grade${s.finalGrade}`]}`}
                      >
                        {s.finalGrade}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <span className={styles.statusCell}>
                      {s.submitted ? (
                        <span className={styles.badgeDone}>제출</span>
                      ) : (
                        <span className={styles.badgeDraft}>작성 중</span>
                      )}
                      {s.hasAppeal && (
                        <span className={styles.badgeAppeal}>이의제기</span>
                      )}
                    </span>
                  </td>
                  <td>
                    <div className={styles.overviewActions}>
                      <button
                        className={styles.btnGhost}
                        onClick={() => onView(s.row)}
                      >
                        <Eye size={13} /> 보기
                      </button>
                      {canManage && s.submitted && (
                        <button
                          className={styles.btnGhost}
                          onClick={() => onReopen(s.row)}
                          title="평가자가 다시 수정할 수 있게 잠금 해제"
                        >
                          <RotateCcw size={13} /> 재평가요청
                        </button>
                      )}
                      {canManage && (
                        <button
                          className={styles.btnDanger}
                          onClick={() => onDelete(s.row)}
                          title="평가 삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 팀 역량평가 */}
      {teamRows.length > 0 && (
        <div className={styles.overviewWrap}>
          <h3 className={styles.overviewTitle}>팀 역량평가</h3>
          <table className={styles.overviewTable}>
            <thead>
              <tr>
                <th>팀</th>
                <th>평가자</th>
                <th>총점</th>
                <th>상태</th>
                <th>제출일</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {teamRows.map((row) => {
                const total = totalScore(
                  normalizeScores(sheet.team, row.scores),
                );
                return (
                  <tr key={row.id}>
                    <td>{row.target_name}</td>
                    <td>{row.evaluator_name}</td>
                    <td className={styles.overviewTotal}>{total}점</td>
                    <td>
                      {row.status === "submitted" ? (
                        <span className={styles.badgeDone}>제출</span>
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
                        <button
                          className={styles.btnGhost}
                          onClick={() => onView(row)}
                        >
                          <Eye size={13} /> 보기
                        </button>
                        {canManage && row.status === "submitted" && (
                          <button
                            className={styles.btnGhost}
                            onClick={() => onReopen(row)}
                            title="평가자가 다시 수정할 수 있게 잠금 해제"
                          >
                            <RotateCcw size={13} /> 재평가요청
                          </button>
                        )}
                        {canManage && (
                          <button
                            className={styles.btnDanger}
                            onClick={() => onDelete(row)}
                            title="평가 삭제"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
