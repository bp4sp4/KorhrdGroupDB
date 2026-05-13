"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

interface TaskItem {
  id: string;
  year: number;
  month: number;
  week_no: number;
  weekday: number;
  title: string;
  completed: boolean;
  sort_order: number;
  assignee_name: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  author: { id: number; display_name: string | null } | null;
}

interface Me {
  id: number | null;
  role: string | null;
  position_id: string | null;
  canWrite: boolean;
}

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금"];

function todayCell(): {
  year: number;
  month: number;
  week_no: number;
  weekday: number;
} | null {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const wd = now.getDay(); // 0=Sun..6=Sat
  if (wd === 0 || wd === 6) return null;
  const weekday = wd; // 1..5 = 월..금
  const day = now.getDate();
  const week_no = Math.min(4, Math.max(1, Math.ceil(day / 7)));
  return { year, month, week_no, weekday };
}

export default function TaskBoardPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);

  const [items, setItems] = useState<TaskItem[]>([]);
  const [me, setMe] = useState<Me>({
    id: null,
    role: null,
    position_id: null,
    canWrite: false,
  });
  const [loading, setLoading] = useState(false);

  // 추가/수정 모달
  const [modalState, setModalState] = useState<
    | { mode: "add"; week_no: number; weekday: number }
    | { mode: "edit"; item: TaskItem }
    | null
  >(null);
  const [formTitle, setFormTitle] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  const initialLoadRef = useRef(false);
  const fetchItems = useCallback(
    async (silent = false) => {
      if (!silent && !initialLoadRef.current) setLoading(true);
      try {
        const res = await fetch(`/api/task-board?year=${year}&month=${month}`);
        if (res.ok) {
          const json = await res.json();
          setItems(json.items ?? []);
        }
      } finally {
        if (!silent && !initialLoadRef.current) setLoading(false);
        initialLoadRef.current = true;
      }
    },
    [year, month],
  );

  // year/month 변경 시에만 첫 로드 표시
  useEffect(() => {
    initialLoadRef.current = false;
    fetchItems();
  }, [year, month, fetchItems]);

  // 작성 권한
  useEffect(() => {
    fetch("/api/task-board/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setMe({
          id: typeof d.id === "number" ? d.id : null,
          role: typeof d.role === "string" ? d.role : null,
          position_id: null,
          canWrite: !!d.canWrite,
        });
      })
      .catch(() => {});
  }, []);

  // Realtime 구독 — 다른 사용자의 추가/수정/삭제도 즉시 반영 (silent)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("task-board-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_board_items" },
        () => {
          fetchItems(true);
        },
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [fetchItems]);

  // 셀별로 항목 묶기
  const itemsByCell = useMemo(() => {
    const map: Record<string, TaskItem[]> = {};
    for (const it of items) {
      const key = `${it.week_no}-${it.weekday}`;
      (map[key] ||= []).push(it);
    }
    return map;
  }, [items]);

  const today = useMemo(() => todayCell(), []);

  const openAddModal = (week_no: number, weekday: number) => {
    if (!me.canWrite) return;
    setModalState({ mode: "add", week_no, weekday });
    setFormTitle("");
    setFormError("");
  };

  const canEditItem = (item: TaskItem) => {
    if (me.role === "admin" || me.role === "master-admin") return true;
    return me.id !== null && item.created_by === me.id;
  };

  const openEditModal = (item: TaskItem) => {
    const isOwner = me.id !== null && item.created_by === me.id;
    const isAdmin = me.role === "admin" || me.role === "master-admin";
    if (!isOwner && !isAdmin) return;
    setModalState({ mode: "edit", item });
    setFormTitle(item.title);
    setFormError("");
  };

  const closeModal = () => setModalState(null);

  const handleSubmit = async () => {
    if (!modalState) return;
    if (!formTitle.trim()) {
      setFormError("지시 내용을 입력하세요.");
      return;
    }
    setSubmitting(true);
    setFormError("");

    try {
      let res: Response;
      if (modalState.mode === "add") {
        res = await fetch("/api/task-board", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            year,
            month,
            week_no: modalState.week_no,
            weekday: modalState.weekday,
            title: formTitle.trim(),
          }),
        });
      } else {
        res = await fetch(`/api/task-board/${modalState.item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: formTitle.trim() }),
        });
      }
      if (res.ok) {
        closeModal();
        fetchItems(true);
      } else {
        const err = await res.json().catch(() => ({}));
        setFormError(err.error ?? "저장에 실패했습니다.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleComplete = async (item: TaskItem) => {
    if (!canEditItem(item)) return;
    // 낙관적 업데이트로 깜빡임 제거
    setItems((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, completed: !item.completed } : p)),
    );
    await fetch(`/api/task-board/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !item.completed }),
    });
    fetchItems(true);
  };

  const handleDelete = async (item: TaskItem) => {
    if (!canEditItem(item)) return;
    const ok = window.confirm(`"${item.title}"을(를) 삭제하시겠습니까?`);
    if (!ok) return;
    // 낙관적 제거
    setItems((prev) => prev.filter((p) => p.id !== item.id));
    await fetch(`/api/task-board/${item.id}`, { method: "DELETE" });
    fetchItems(true);
  };

  const goPrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };
  const goToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  };

  return (
    <div className={styles.pageWrap}>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>시스템 통합 업무보드</h2>
        </div>
        <div className={styles.monthNav}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={goPrevMonth}
            aria-label="이전 달"
          >
            <ChevronLeft size={16} />
          </button>
          <span className={styles.monthLabel}>
            {year}년 {month}월
          </span>
          <button
            type="button"
            className={styles.navBtn}
            onClick={goNextMonth}
            aria-label="다음 달"
          >
            <ChevronRight size={16} />
          </button>
          <button type="button" className={styles.todayBtn} onClick={goToday}>
            오늘
          </button>
        </div>
      </div>

      <div className={styles.boardWrap}>
        <div className={styles.boardGrid}>
          <div className={styles.headCell}></div>
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className={styles.headCell}>
              {d}
            </div>
          ))}
          {[1, 2, 3, 4].map((wk) => (
            <Row
              key={wk}
              wk={wk}
              year={year}
              month={month}
              itemsByCell={itemsByCell}
              today={today}
              canWrite={me.canWrite}
              meId={me.id}
              meRole={me.role}
              onAdd={openAddModal}
              onEdit={openEditModal}
              onToggleComplete={handleToggleComplete}
              onDelete={handleDelete}
            />
          ))}
        </div>
        {loading && <div className={styles.loadingState}>불러오는 중...</div>}
      </div>

      {modalState && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {modalState.mode === "add"
                  ? `${month}월 ${modalState.week_no}주차 ${WEEKDAY_LABELS[modalState.weekday - 1]} · 새 지시`
                  : `지시 수정`}
              </h3>
              <button className={styles.modalClose} onClick={closeModal}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div>
                <label className={styles.formLabel}>지시 내용</label>
                <textarea
                  className={styles.textarea}
                  placeholder={"예시\n- 학점은행제 신청 마감 처리\n- 미입금 학생 연락"}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  autoFocus
                />
              </div>
              {formError && <p className={styles.errorMsg}>{formError}</p>}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={closeModal}>
                취소
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? "저장 중..."
                  : modalState.mode === "add"
                    ? "추가"
                    : "수정"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  wk,
  year,
  month,
  itemsByCell,
  today,
  canWrite,
  meId,
  meRole,
  onAdd,
  onEdit,
  onToggleComplete,
  onDelete,
}: {
  wk: number;
  year: number;
  month: number;
  itemsByCell: Record<string, TaskItem[]>;
  today: {
    year: number;
    month: number;
    week_no: number;
    weekday: number;
  } | null;
  canWrite: boolean;
  meId: number | null;
  meRole: string | null;
  onAdd: (wk: number, wd: number) => void;
  onEdit: (item: TaskItem) => void;
  onToggleComplete: (item: TaskItem) => void;
  onDelete: (item: TaskItem) => void;
}) {
  const isAdmin = meRole === "admin" || meRole === "master-admin";
  return (
    <>
      <div className={styles.weekHead}>{wk}주차</div>
      {[1, 2, 3, 4, 5].map((wd) => {
        const cellItems = itemsByCell[`${wk}-${wd}`] ?? [];
        const isToday =
          today &&
          today.year === year &&
          today.month === month &&
          today.week_no === wk &&
          today.weekday === wd;
        return (
          <div
            key={wd}
            className={`${styles.cell} ${isToday ? styles.cellToday : ""}`}
          >
            {cellItems.map((it) => {
              const mine = meId !== null && it.created_by === meId;
              const canEdit = mine || isAdmin;
              return (
                <div
                  key={it.id}
                  className={`${styles.taskCard} ${it.completed ? styles.taskCardDone : ""}`}
                >
                  <input
                    type="checkbox"
                    className={styles.taskCheckbox}
                    checked={it.completed}
                    disabled={!canEdit}
                    title={canEdit ? "완료 토글" : "작성자만 체크할 수 있습니다"}
                    onChange={() => onToggleComplete(it)}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    className={styles.taskBody}
                    onClick={() => canEdit && onEdit(it)}
                    onKeyDown={(e) => {
                      if (canEdit && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onEdit(it);
                      }
                    }}
                    style={!canEdit ? { cursor: "default" } : undefined}
                  >
                    <span
                      className={`${styles.taskTitle} ${it.completed ? styles.taskTitleDone : ""}`}
                    >
                      {it.title}
                    </span>
                  </div>
                  {canEdit && (
                    <div className={styles.taskActions}>
                      <button
                        type="button"
                        className={styles.taskActionBtn}
                        onClick={() => onEdit(it)}
                        title="수정"
                        aria-label="수정"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        className={styles.taskDeleteBtn}
                        onClick={() => onDelete(it)}
                        title="삭제"
                        aria-label="삭제"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {canWrite && (
              <button
                type="button"
                className={styles.cellAddBtn}
                onClick={() => onAdd(wk, wd)}
                aria-label="지시 추가"
                title="지시 추가"
              >
                <Plus size={12} /> 추가
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
