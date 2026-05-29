"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  HelpCircle,
  Plus,
} from "lucide-react";
import styles from "./page.module.css";
import {
  JOURNAL_FORM_TYPES,
  normalizeJournalForm,
  type JournalFormType,
} from "@/lib/work-journal/formTypes";
import CategorySelect from "./_components/CategorySelect";
import { useGuide } from "@/components/guide/GuideProvider";

type Task = { id: string; text: string; done: boolean };
type JournalRow = { id: string; category: string; detail: string };
type Tomorrow = { id: string; text: string };
// 학사팀(academic 양식) 전용
type WeeklyGoal = { id: string; date: string; text: string; done: boolean };

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

// 사업본부(default 양식) 업무 분류 select 옵션
const BIZ_CATEGORY_OPTIONS = [
  "학습상담",
  "학습설계",
  "학습관리",
  "가망관리",
  "학습민원대응",
  "미팅/면담",
  "교육",
  "기타",
] as const;

// 주어진 날짜가 속한 주의 월요일을 YYYY-MM-DD 로 반환 (KST 로컬, 월~일 기준)
function weekMondayOf(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  const dow = d.getDay(); // 0=일, 1=월, ...
  // 월요일까지 빼야 할 일수: 일요일(0) 이면 -6, 월요일(1) 이면 0, 화요일(2) 이면 -1 ...
  const offset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + offset);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// 학사팀 이번주 목표 날짜 — YYYY-MM-DD → "-MM.DD(요일)" 포맷, 빈값/비ISO 는 원본 또는 "미정"
function formatGoalDate(value: string): string {
  const v = (value ?? "").trim();
  if (!v) return "미정";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return v; // 자유 입력값(레거시) 그대로
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `-${mm}.${dd}(${DOW[d.getDay()]})`;
}

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatPretty(iso: string) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const dow = DOW[d.getDay()];
  return `${yyyy}.${mm}.${dd} (${dow})`;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 호버 시 빨간 알약 + "삭제" 라벨 토글되는 삭제 버튼 */
function DeleteButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  if (disabled) return null;
  return (
    <button
      type="button"
      className={styles.journalDeleteBtn}
      onClick={onClick}
      aria-label="삭제"
    >
      <svg
        className={styles.journalDeleteIcon}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M11.3997 5.2666H4.60026V12.6663C4.60026 12.8608 4.67758 13.047 4.8151 13.1846C4.95263 13.3221 5.13884 13.3994 5.33333 13.3994H10.6667C10.8612 13.3994 11.0474 13.3221 11.1849 13.1846C11.3224 13.047 11.3997 12.8608 11.3997 12.6663V5.2666ZM6.06641 11.333V7.33301C6.06641 7.00164 6.3353 6.73275 6.66667 6.73275C6.99804 6.73275 7.26693 7.00164 7.26693 7.33301V11.333C7.26693 11.6644 6.99804 11.9333 6.66667 11.9333C6.3353 11.9333 6.06641 11.6644 6.06641 11.333ZM8.73307 11.333V7.33301C8.73307 7.00164 9.00196 6.73275 9.33333 6.73275C9.6647 6.73275 9.93359 7.00164 9.93359 7.33301V11.333C9.93359 11.6644 9.6647 11.9333 9.33333 11.9333C9.00196 11.9333 8.73307 11.6644 8.73307 11.333ZM5.63737 4.06608H10.3626L9.62956 2.59993H6.37044L5.63737 4.06608ZM12.6003 12.6663C12.6003 13.1791 12.3964 13.671 12.0339 14.0335C11.6713 14.3961 11.1794 14.5999 10.6667 14.5999H5.33333C4.82058 14.5999 4.32872 14.3961 3.96615 14.0335C3.60358 13.671 3.39974 13.1791 3.39974 12.6663V5.2666H2.66667C2.3353 5.2666 2.06641 4.99771 2.06641 4.66634C2.06641 4.33497 2.3353 4.06608 2.66667 4.06608H4.29622L5.46354 1.73145L5.50651 1.65853C5.61749 1.49793 5.80125 1.39941 6 1.39941H10L10.084 1.40527C10.2775 1.43258 10.4475 1.55352 10.5365 1.73145L11.7038 4.06608H13.3333C13.6647 4.06608 13.9336 4.33497 13.9336 4.66634C13.9336 4.99771 13.6647 5.2666 13.3333 5.2666H12.6003V12.6663Z"
          fill="currentColor"
        />
      </svg>
      <span className={styles.journalDeleteLabel}>삭제</span>
    </button>
  );
}

/** 내용 길이에 따라 height 자동 조정되는 textarea */
function AutoSizeTextarea({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // value 가 바뀔 때마다 height 재계산 (초기 mount 포함)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // autoFocus 시 커서를 텍스트 끝으로
  useEffect(() => {
    if (autoFocus && ref.current) {
      const el = ref.current;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [autoFocus]);

  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
    />
  );
}

export default function WorkJournalPage() {
  const today = useMemo(() => toISODate(new Date()), []);
  const [date, setDate] = useState<string>(today);

  const [tasks, setTasks] = useState<Task[]>([]);

  const [morningOpen, setMorningOpen] = useState(true);
  const [afternoonOpen, setAfternoonOpen] = useState(true);

  const [morning, setMorning] = useState<JournalRow[]>([]);
  const [afternoon, setAfternoon] = useState<JournalRow[]>([]);
  const [tomorrow, setTomorrow] = useState<Tomorrow[]>([]);

  // 팀별 업무일지 양식 식별자 — teams.journal_form 기반
  const [journalForm, setJournalForm] = useState<JournalFormType>(
    JOURNAL_FORM_TYPES.DEFAULT,
  );
  const isAcademic = journalForm === JOURNAL_FORM_TYPES.ACADEMIC;
  const { startById } = useGuide();
  // 본인 user_id — 주 단위 weekly_goal key 구성에 사용
  const [userId, setUserId] = useState<number | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState<WeeklyGoal[]>([]);
  const [issues, setIssues] = useState<JournalRow[]>([]);
  const [issuesOpen, setIssuesOpen] = useState(true);

  // 학사팀 — 이번주 목표 설정 모달
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [tempGoals, setTempGoals] = useState<WeeklyGoal[]>([]);
  const [goalSaving, setGoalSaving] = useState(false);
  const openGoalModal = () => {
    // 깊은 복사 후 모달에서 편집
    setTempGoals(weeklyGoal.map((g) => ({ ...g })));
    setGoalModalOpen(true);
  };
  const closeGoalModal = () => setGoalModalOpen(false);

  // weeklyGoal 의 영속 key — 그 주의 월요일 기준 (월요일이 바뀌면 새 키 = 자동 리셋)
  const weeklyGoalKey =
    userId != null
      ? `user.${userId}.weekly_goal.${weekMondayOf(date)}`
      : null;

  const saveGoalModal = async () => {
    if (!weeklyGoalKey) {
      alert("사용자 정보를 불러오는 중입니다.");
      return;
    }
    // 빈 행 정리
    const cleaned = tempGoals.filter(
      (g) => g.date.trim() !== "" || g.text.trim() !== "",
    );
    setGoalSaving(true);
    try {
      const res = await fetch("/api/app-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: weeklyGoalKey, value: cleaned }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "저장에 실패했습니다.");
        return;
      }
      setWeeklyGoal(cleaned);
      setGoalModalOpen(false);
    } finally {
      setGoalSaving(false);
    }
  };
  const updateTempGoal = (id: string, patch: Partial<WeeklyGoal>) =>
    setTempGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    );
  const addTempGoal = () =>
    setTempGoals((prev) => [
      ...prev,
      { id: uid(), date: "", text: "", done: false },
    ]);
  const removeTempGoal = (id: string) =>
    setTempGoals((prev) => prev.filter((g) => g.id !== id));

  // 본인 팀 양식 + 사용자 id 조회
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setJournalForm(normalizeJournalForm(d?.teamJournalForm));
        if (typeof d?.id === "number") setUserId(d.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // 학사팀 — 이번주 목표 fetch (주 단위 key, 월요일 바뀌면 자동 새 키 = 자동 초기화)
  useEffect(() => {
    if (!isAcademic || !weeklyGoalKey) return;
    let cancelled = false;
    fetch(`/api/app-settings?key=${encodeURIComponent(weeklyGoalKey)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const v = data?.value;
        if (Array.isArray(v)) {
          // 안전 정규화
          const goals: WeeklyGoal[] = v
            .map((g) => {
              if (!g || typeof g !== "object") return null;
              const o = g as Record<string, unknown>;
              return {
                id: typeof o.id === "string" ? o.id : uid(),
                date: typeof o.date === "string" ? o.date : "",
                text: typeof o.text === "string" ? o.text : "",
                done: Boolean(o.done),
              };
            })
            .filter((g): g is WeeklyGoal => g !== null);
          setWeeklyGoal(goals);
        } else {
          setWeeklyGoal([]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAcademic, weeklyGoalKey]);

  // 체크 토글도 즉시 저장 (낙관적 UI + persist)
  useEffect(() => {
    if (!isAcademic || !weeklyGoalKey) return;
    // 초기 빈 상태에서 마운트 직후 저장 안 함
    if (weeklyGoal.length === 0) return;
    const t = setTimeout(() => {
      fetch("/api/app-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: weeklyGoalKey, value: weeklyGoal }),
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [isAcademic, weeklyGoalKey, weeklyGoal]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"draft" | "submitted" | null>(null);

  // 제출 완료된 일지의 수정 모드 — true 일 때만 form 편집 가능
  const [isEditing, setIsEditing] = useState(false);
  // 수정 후 저장(저장하기)했지만 아직 "다시 제출" 하지 않은 상태 — 빨간 [다시 제출] 노출
  const [hasEdits, setHasEdits] = useState(false);
  // 수정 시작 시점의 스냅샷 — 취소 시 복원에 사용
  const [snapshot, setSnapshot] = useState<{
    tasks: Task[];
    morning: JournalRow[];
    afternoon: JournalRow[];
    tomorrow: Tomorrow[];
    issues: JournalRow[];
  } | null>(null);

  // status === "submitted" 이면서 편집 중이 아니면 잠금
  const isLocked = status === "submitted" && !isEditing;

  const [stats, setStats] = useState<{
    totalInquiries: number;
    registrations: number;
    registrationRate: number;
    salesThisMonth: number;
    todayScheduledContacts: number;
    delta: {
      inquiries: number;
      registrations: number;
      rate: number;
      sales: number;
    };
  } | null>(null);

  // stats (본인 담당자 기준 누적/이번달)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/work-journal/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setStats({
          totalInquiries: Number(d.totalInquiries ?? 0),
          registrations: Number(d.registrations ?? 0),
          registrationRate: Number(d.registrationRate ?? 0),
          salesThisMonth: Number(d.salesThisMonth ?? 0),
          todayScheduledContacts: Number(d.todayScheduledContacts ?? 0),
          delta: {
            inquiries: Number(d?.delta?.inquiries ?? 0),
            registrations: Number(d?.delta?.registrations ?? 0),
            rate: Number(d?.delta?.rate ?? 0),
            sales: Number(d?.delta?.sales ?? 0),
          },
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // 날짜 변경 시 해당 일자 일지 로드
  useEffect(() => {
    let cancelled = false;
    // 날짜가 바뀌면 편집 모드/저장 직후 표시 초기화
    setIsEditing(false);
    setSnapshot(null);
    setHasEdits(false);
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/work-journal?date=${date}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const j = data?.journal;
        const carry = Array.isArray(data?.carryOverTasks)
          ? (data.carryOverTasks as Task[])
          : [];
        if (j) {
          // tasks가 비어있으면 직전 제출 일지의 tomorrow 자동 이월
          const existingTasks = Array.isArray(j.tasks)
            ? (j.tasks as Task[])
            : [];
          setTasks(existingTasks.length > 0 ? existingTasks : carry);
          setMorning(Array.isArray(j.morning) ? j.morning : []);
          setAfternoon(Array.isArray(j.afternoon) ? j.afternoon : []);
          setTomorrow(Array.isArray(j.tomorrow) ? j.tomorrow : []);
          // weeklyGoal 은 별도 app_settings 로 fetch (주 단위 key) — 여기선 처리하지 않음
          setIssues(Array.isArray(j.issues) ? (j.issues as JournalRow[]) : []);
          setStatus(j.status ?? "draft");
        } else {
          // 새 일지 — 이월 데이터로 시작
          setTasks(carry);
          setMorning([]);
          setAfternoon([]);
          setTomorrow([]);
          // weeklyGoal 은 별도 fetch
          setIssues([]);
          setStatus(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [date]);

  // ── 핸들러 ──────────────────────────────────────────────
  const toggleTask = (id: string) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );

  const updateTaskText = (id: string, text: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));
    // 빈 슬롯에서 첫 글자 입력 시 isEmpty 가 false 로 바뀌면서
    // 조건 `isEditing || isEmpty` 가 false 가 되어 textarea 가 div 로 교체되고
    // 커서가 풀리는 문제를 방지하기 위해 editing 상태를 명시적으로 유지한다.
    if (text.length > 0) setEditingTaskId(id);
  };

  const removeTask = (id: string) =>
    setTasks((prev) => prev.filter((t) => t.id !== id));

  const pickRowSetter = (section: "morning" | "afternoon" | "issues") => {
    if (section === "morning") return setMorning;
    if (section === "afternoon") return setAfternoon;
    return setIssues;
  };

  const updateRow = (
    section: "morning" | "afternoon" | "issues",
    id: string,
    patch: Partial<JournalRow>,
  ) => {
    const setter = pickRowSetter(section);
    setter((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = (section: "morning" | "afternoon" | "issues") => {
    const setter = pickRowSetter(section);
    setter((prev) => [...prev, { id: uid(), category: "", detail: "" }]);
  };

  const removeRow = (section: "morning" | "afternoon" | "issues", id: string) => {
    const setter = pickRowSetter(section);
    setter((prev) => prev.filter((r) => r.id !== id));
  };

  // ── 학사팀 — 이번주 목표 (체크박스만 카드에서 직접 토글, 나머지는 모달) ──
  const toggleWeeklyGoal = (id: string) =>
    setWeeklyGoal((prev) =>
      prev.map((g) => (g.id === id ? { ...g, done: !g.done } : g)),
    );

  const updateTomorrow = (id: string, text: string) =>
    setTomorrow((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));

  const removeTomorrow = (id: string) =>
    setTomorrow((prev) => prev.filter((t) => t.id !== id));

  // ── 자동 빈 슬롯 유지 (오늘의 업무 / 내일 예정 업무) ──
  // 마지막 항목이 비어있지 않으면 자동으로 빈 항목을 끝에 추가
  useEffect(() => {
    if (tasks.length === 0 || tasks[tasks.length - 1].text !== "") {
      setTasks((prev) => [...prev, { id: uid(), text: "", done: false }]);
    }
  }, [tasks]);

  useEffect(() => {
    if (tomorrow.length === 0 || tomorrow[tomorrow.length - 1].text !== "") {
      setTomorrow((prev) => [...prev, { id: uid(), text: "" }]);
    }
  }, [tomorrow]);

  // ── 임시저장 / 제출 (DB) ────────────────────────────────
  const persist = async (nextStatus: "draft" | "submitted") => {
    if (saving) return;
    setSaving(true);
    try {
      // 자동으로 추가된 마지막 빈 슬롯은 저장에서 제외
      const cleanedTasks = tasks.filter((t) => t.text.trim() !== "");
      const cleanedTomorrow = tomorrow.filter((t) => t.text.trim() !== "");
      // 학사팀 — 빈 issue 행 제외 (weekly_goal 은 별도 app_settings 로 저장)
      const cleanedIssues = issues.filter(
        (r) => r.category.trim() !== "" || r.detail.trim() !== "",
      );

      const res = await fetch("/api/work-journal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          tasks: cleanedTasks,
          morning,
          afternoon,
          tomorrow: cleanedTomorrow,
          // 학사팀이면 issues 함께 저장. weekly_goal 은 주 단위 별도 저장(app_settings)
          ...(isAcademic ? { issues: cleanedIssues } : {}),
          status: nextStatus,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? "저장에 실패했습니다.");
        return;
      }
      setStatus(data?.journal?.status ?? nextStatus);
      alert(nextStatus === "submitted" ? "제출 완료" : "임시저장 완료");
    } finally {
      setSaving(false);
    }
  };

  const handleDraft = () => persist("draft");
  const handleSubmit = () => {
    if (!confirm("업무일지를 제출하시겠습니까?")) return;
    persist("submitted");
  };

  // 수정하기 — 잠금 해제 + 현재 상태 스냅샷 (취소 시 복원용)
  const handleEdit = () => {
    setSnapshot({
      tasks: tasks.map((t) => ({ ...t })),
      morning: morning.map((r) => ({ ...r })),
      afternoon: afternoon.map((r) => ({ ...r })),
      tomorrow: tomorrow.map((t) => ({ ...t })),
      issues: issues.map((r) => ({ ...r })),
    });
    setIsEditing(true);
  };

  // 취소 — 스냅샷으로 복원 후 잠금 복귀
  const handleCancel = () => {
    if (snapshot) {
      setTasks(snapshot.tasks);
      setMorning(snapshot.morning);
      setAfternoon(snapshot.afternoon);
      setTomorrow(snapshot.tomorrow);
      setIssues(snapshot.issues);
    }
    setSnapshot(null);
    setIsEditing(false);
  };

  // 저장하기 — 제출 상태 유지하며 저장 후 잠금 복귀, "다시 제출" 노출용 hasEdits=true
  const handleSave = async () => {
    await persist("submitted");
    setSnapshot(null);
    setIsEditing(false);
    setHasEdits(true);
  };

  // 다시 제출 — 변경분을 확정 제출, hasEdits 리셋해서 단일 [수정하기] 로 복귀
  const handleResubmit = async () => {
    if (!confirm("수정한 내용을 다시 제출하시겠습니까?")) return;
    await persist("submitted");
    setHasEdits(false);
  };

  // 오늘의 업무 — 편집 중인 task id (편집 모드에서만 textarea 표시, 그 외엔 div 표시 → 어디서나 드래그 가능)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // 오늘의 업무 내 순서 변경(reorder) 전용 state
  const draggedTaskIndexRef = useRef<number | null>(null);
  const [dropTaskTarget, setDropTaskTarget] = useState<number | null>(null);

  const handleTaskGripDragStart =
    (index: number, row: HTMLElement | null) => (e: ReactDragEvent) => {
      draggedTaskIndexRef.current = index;
      e.dataTransfer.setData("text/plain", "__task_row__");
      e.dataTransfer.effectAllowed = "all";
      if (row) e.dataTransfer.setDragImage(row, 12, 12);
    };

  const handleTaskItemDragOver =
    (index: number) => (e: ReactDragEvent) => {
      // task 끼리 reorder 중일 때만 처리
      if (draggedTaskIndexRef.current === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const isAbove = e.clientY - rect.top < rect.height / 2;
      const insertAt = isAbove ? index : index + 1;
      setDropTaskTarget((prev) => (prev === insertAt ? prev : insertAt));
    };

  const handleTaskItemDrop = (e: ReactDragEvent) => {
    const srcIndex = draggedTaskIndexRef.current;
    if (srcIndex === null) return;
    e.preventDefault();
    e.stopPropagation();
    const insertAt = dropTaskTarget ?? -1;
    draggedTaskIndexRef.current = null;
    setDropTaskTarget(null);
    setTasks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(srcIndex, 1);
      const target =
        insertAt < 0
          ? next.length
          : insertAt > srcIndex
            ? insertAt - 1
            : insertAt;
      next.splice(Math.min(target, next.length), 0, moved);
      return next;
    });
  };

  const handleTaskListDragLeave = (e: ReactDragEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget instanceof Node && e.currentTarget.contains(next))
      return;
    setDropTaskTarget(null);
  };

  // ── 드래그 앤 드롭: 오늘의 업무 → 업무 일지 (복사) ─────────
  // dropTarget: 드롭 시 어느 섹션의 몇 번째 위치에 삽입할지
  const [dropTarget, setDropTarget] = useState<{
    section: "morning" | "afternoon";
    insertAt: number;
  } | null>(null);
  const dragTextRef = useRef<string>("");

  const handleTaskDragStart = (e: ReactDragEvent, text: string) => {
    dragTextRef.current = text;
    e.dataTransfer.setData("text/plain", text);
    e.dataTransfer.effectAllowed = "copy";
    // grip 만 잡아도 행 전체가 미리보기로 따라오도록
    const handle = e.currentTarget as HTMLElement;
    const row = handle.closest(`.${styles.taskItem}`) as HTMLElement | null;
    if (row) e.dataTransfer.setDragImage(row, 12, 12);
  };

  // row 위/아래 절반 기준으로 insertAt 결정
  const handleRowDragOver =
    (section: "morning" | "afternoon", index: number) =>
    (e: ReactDragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // row 끼리 이동(reorder/섹션이동)은 'move', 외부 task 추가는 'copy'
      e.dataTransfer.dropEffect = draggedRowRef.current ? "move" : "copy";
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const isAbove = e.clientY - rect.top < rect.height / 2;
      const insertAt = isAbove ? index : index + 1;
      setDropTarget((prev) =>
        prev && prev.section === section && prev.insertAt === insertAt
          ? prev
          : { section, insertAt },
      );
    };

  // 섹션 전체 dragOver: row 가 없을 때(빈 섹션) 또는 row 사이가 아닌 영역
  const handleSectionDragOver =
    (section: "morning" | "afternoon", total: number) =>
    (e: ReactDragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      // row 가 비어있으면 항상 index 0, 그 외엔 row 핸들러가 이미 setDropTarget 했을 것
      if (total === 0) {
        setDropTarget((prev) =>
          prev && prev.section === section && prev.insertAt === 0
            ? prev
            : { section, insertAt: 0 },
        );
      }
    };

  const handleSectionDragLeave = (e: ReactDragEvent) => {
    const next = e.relatedTarget as Node | null;
    if (
      next &&
      e.currentTarget instanceof Node &&
      e.currentTarget.contains(next)
    ) {
      return;
    }
    setDropTarget(null);
  };

  // 일지 row 드래그 정보를 ref 로 전달 (dataTransfer custom MIME 은 브라우저별 차이 있음)
  const draggedRowRef = useRef<{
    section: "morning" | "afternoon";
    index: number;
    row: JournalRow;
  } | null>(null);

  // 일지 row 드래그 시작 (같은 섹션 내 reorder 또는 다른 섹션으로 이동용)
  const handleJournalRowDragStart =
    (section: "morning" | "afternoon", index: number, row: JournalRow) =>
    (e: ReactDragEvent) => {
      // textarea/input 안에서 시작된 드래그는 텍스트 편집 우선 → 차단
      const target = e.target as HTMLElement;
      if (target.closest("textarea, input")) {
        e.preventDefault();
        return;
      }
      draggedRowRef.current = { section, index, row };
      // Firefox 는 dataTransfer 가 비어있으면 dragstart 가 작동 안 함
      e.dataTransfer.setData("text/plain", "__journal_row__");
      // 'all' 로 두어 dragOver 의 dropEffect 와 mismatch 로 인한 drop 차단 회피
      e.dataTransfer.effectAllowed = "all";
    };

  // dragEnd 에서 ref 를 null 로 만들지 않음 (drop 보다 먼저 호출되는 브라우저 케이스 회피)
  // drop 핸들러에서 사용 직후 null 처리 + 다음 dragStart 가 자연스레 덮어씀

  const handleSectionDrop =
    (section: "morning" | "afternoon") => (e: ReactDragEvent) => {
      e.preventDefault();
      // row에서 drop이 발생한 경우 부모(sectionDropZone)로 버블되어 두 번 호출되는 것을 막음
      e.stopPropagation();
      const insertAt =
        dropTarget?.section === section ? dropTarget.insertAt : -1;
      setDropTarget(null);

      // 1) 일지 row 자체를 옮기는 경우 (reorder 또는 섹션 이동) — ref 로 확인
      const dragged = draggedRowRef.current;
      if (dragged) {
        const { section: srcSection, index: srcIndex, row } = dragged;
        draggedRowRef.current = null;

        if (srcSection === section) {
          // 같은 섹션 내 reorder
          const setter = section === "morning" ? setMorning : setAfternoon;
          setter((prev) => {
            const next = [...prev];
            const [moved] = next.splice(srcIndex, 1);
            const target =
              insertAt < 0
                ? next.length
                : insertAt > srcIndex
                  ? insertAt - 1
                  : insertAt;
            next.splice(Math.min(target, next.length), 0, moved);
            return next;
          });
        } else {
          // 다른 섹션으로 이동 (오전 ↔ 오후)
          const srcSetter =
            srcSection === "morning" ? setMorning : setAfternoon;
          const destSetter = section === "morning" ? setMorning : setAfternoon;
          srcSetter((prev) => prev.filter((_, i) => i !== srcIndex));
          destSetter((prev) => {
            const next = [...prev];
            const target =
              insertAt < 0 || insertAt > next.length ? next.length : insertAt;
            next.splice(target, 0, row);
            return next;
          });
        }
        if (section === "morning") setMorningOpen(true);
        else setAfternoonOpen(true);
        return;
      }

      // 2) 외부(오늘의 업무) 에서 텍스트 추가
      const text =
        dragTextRef.current || e.dataTransfer.getData("text/plain") || "";
      dragTextRef.current = "";
      if (!text.trim()) return;
      const newRow: JournalRow = { id: uid(), category: "", detail: text };
      const setter = section === "morning" ? setMorning : setAfternoon;
      setter((prev) => {
        const idx =
          insertAt < 0 || insertAt > prev.length ? prev.length : insertAt;
        const next = [...prev];
        next.splice(idx, 0, newRow);
        return next;
      });
      if (section === "morning") setMorningOpen(true);
      else setAfternoonOpen(true);
    };

  // ── 카운트 ──────────────────────────────────────────────
  const doneCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length;

  return (
    <div className={styles.app}>
      <div className={styles.container}>
        {/* ── 상단 행 (학사팀은 stats 자리에 이번주 목표 바 표시) ─── */}
        <div className={styles.topRow}>
          {/* 날짜 카드 */}
          <div className={styles.dateCard} data-guide="wj-date">
            <label className={styles.dateSelectWrap}>
              <span className={styles.dateSelectText}>
                {formatPretty(date)}
              </span>
              <ChevronDown className={styles.dateSelectIcon} size={16} />
              <input
                type="date"
                className={styles.dateInputOverlay}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            <div className={styles.dateRow}>
              <span className={styles.dateLabel}>오늘 연락 예정</span>
              <div className={styles.dateRowRight}>
                <span className={styles.dateValue}>
                  {(stats?.todayScheduledContacts ?? 0).toLocaleString()}건
                </span>
                <ChevronRight className={styles.dateRowIcon} size={16} />
              </div>
            </div>
          </div>

          {/* 학사팀 — 이번주 목표 바 (stats 자리) */}
          {isAcademic && (
            <div className={styles.weeklyGoalBar}>
              {/* 좌측 — 제목 + 목표 설정 버튼 */}
              <div className={styles.weeklyGoalLeft}>
                <span className={styles.weeklyGoalTitle}>이번주 목표</span>
                <button
                  type="button"
                  className={styles.weeklyGoalSettingBtn}
                  onClick={openGoalModal}
                  title="목표 설정"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M13.2663 8.4396C13.1594 8.31795 13.1004 8.16154 13.1004 7.9996C13.1004 7.83767 13.1594 7.68126 13.2663 7.5596L14.1196 6.5996C14.2136 6.49472 14.272 6.36274 14.2864 6.22261C14.3008 6.08248 14.2704 5.9414 14.1996 5.8196L12.8663 3.51294C12.7962 3.39129 12.6895 3.29486 12.5614 3.2374C12.4333 3.17993 12.2904 3.16438 12.1529 3.19294L10.8996 3.44627C10.7401 3.47922 10.5741 3.45266 10.4329 3.3716C10.2916 3.29055 10.1849 3.16059 10.1329 3.00627L9.72627 1.78627C9.68155 1.65386 9.59634 1.53885 9.48269 1.4575C9.36904 1.37615 9.2327 1.33258 9.09294 1.33294H6.42627C6.28089 1.32535 6.13703 1.36556 6.01665 1.44741C5.89627 1.52927 5.80599 1.64828 5.7596 1.78627L5.38627 3.00627C5.33427 3.16059 5.22759 3.29055 5.08635 3.3716C4.94511 3.45266 4.77908 3.47922 4.6196 3.44627L3.33294 3.19294C3.20264 3.17453 3.06981 3.19509 2.95117 3.25203C2.83254 3.30898 2.73341 3.39976 2.66627 3.51294L1.33294 5.8196C1.26038 5.94004 1.22775 6.08033 1.23973 6.22042C1.2517 6.36051 1.30766 6.49323 1.39961 6.5996L2.24627 7.5596C2.35315 7.68126 2.41209 7.83767 2.41209 7.9996C2.41209 8.16154 2.35315 8.31795 2.24627 8.4396L1.39961 9.3996C1.30766 9.50598 1.2517 9.6387 1.23973 9.77879C1.22775 9.91888 1.26038 10.0592 1.33294 10.1796L2.66627 12.4863C2.73634 12.6079 2.84302 12.7044 2.97111 12.7618C3.0992 12.8193 3.24215 12.8348 3.37961 12.8063L4.63294 12.5529C4.79242 12.52 4.95844 12.5465 5.09968 12.6276C5.24092 12.7087 5.34761 12.8386 5.39961 12.9929L5.80627 14.2129C5.85266 14.3509 5.94294 14.4699 6.06332 14.5518C6.1837 14.6337 6.32756 14.6739 6.47294 14.6663H9.1396C9.27937 14.6666 9.41571 14.6231 9.52936 14.5417C9.64301 14.4604 9.72821 14.3454 9.77294 14.2129L10.1796 12.9929C10.2316 12.8386 10.3383 12.7087 10.4795 12.6276C10.6208 12.5465 10.7868 12.52 10.9463 12.5529L12.1996 12.8063C12.3371 12.8348 12.48 12.8193 12.6081 12.7618C12.7362 12.7044 12.8429 12.6079 12.9129 12.4863L14.2463 10.1796C14.3171 10.0578 14.3474 9.91673 14.3331 9.7766C14.3187 9.63647 14.2603 9.50449 14.1663 9.3996L13.2663 8.4396ZM12.2729 9.33294L12.8063 9.93294L11.9529 11.4129L11.1663 11.2529C10.6861 11.1548 10.1867 11.2364 9.76267 11.4821C9.33868 11.7279 9.0197 12.1208 8.86627 12.5863L8.61294 13.3329H6.90627L6.66627 12.5729C6.51284 12.1075 6.19386 11.7146 5.76988 11.4688C5.34589 11.223 4.84642 11.1415 4.36627 11.2396L3.57961 11.3996L2.71294 9.92627L3.24627 9.32627C3.57424 8.95959 3.75556 8.48489 3.75556 7.99294C3.75556 7.50098 3.57424 7.02629 3.24627 6.6596L2.71294 6.0596L3.56627 4.59294L4.35294 4.75294C4.83309 4.85109 5.33256 4.76953 5.75654 4.52374C6.18053 4.27795 6.49951 3.88504 6.65294 3.4196L6.90627 2.66627H8.61294L8.86627 3.42627C9.0197 3.89171 9.33868 4.28462 9.76267 4.5304C10.1867 4.77619 10.6861 4.85775 11.1663 4.7596L11.9529 4.5996L12.8063 6.0796L12.2729 6.67961C11.9486 7.04544 11.7696 7.51739 11.7696 8.00627C11.7696 8.49515 11.9486 8.9671 12.2729 9.33294ZM7.7596 5.33294C7.23219 5.33294 6.71662 5.48934 6.27808 5.78235C5.83955 6.07537 5.49776 6.49185 5.29593 6.97912C5.09409 7.46638 5.04128 8.00256 5.14418 8.51985C5.24707 9.03713 5.50105 9.51228 5.87399 9.88522C6.24693 10.2582 6.72208 10.5121 7.23936 10.615C7.75665 10.7179 8.29282 10.6651 8.78009 10.4633C9.26736 10.2614 9.68384 9.91966 9.97686 9.48112C10.2699 9.04259 10.4263 8.52702 10.4263 7.9996C10.4263 7.29236 10.1453 6.61408 9.64522 6.11399C9.14513 5.61389 8.46685 5.33294 7.7596 5.33294ZM7.7596 9.33294C7.4959 9.33294 7.23811 9.25474 7.01884 9.10823C6.79958 8.96172 6.62868 8.75348 6.52777 8.50985C6.42685 8.26621 6.40044 7.99813 6.45189 7.73948C6.50334 7.48084 6.63033 7.24327 6.8168 7.0568C7.00327 6.87033 7.24084 6.74334 7.49948 6.69189C7.75813 6.64044 8.02621 6.66685 8.26985 6.76777C8.51348 6.86868 8.72172 7.03958 8.86823 7.25884C9.01474 7.47811 9.09294 7.7359 9.09294 7.9996C9.09294 8.35323 8.95246 8.69237 8.70241 8.94241C8.45237 9.19246 8.11323 9.33294 7.7596 9.33294Z"
                      fill="#8D99A5"
                    />
                  </svg>
                  <span>목표 설정</span>
                </button>
              </div>

              {/* 우측 — 목표 카드 리스트 (읽기 전용, 체크박스만 인터랙티브) */}
              <div className={styles.weeklyGoalList}>
                {weeklyGoal.length === 0 ? (
                  <span className={styles.weeklyGoalEmpty}>
                    이번주 목표가 없습니다. &quot;목표 설정&quot; 버튼으로 시작하세요.
                  </span>
                ) : (
                  weeklyGoal.map((g) => (
                    <div
                      key={g.id}
                      className={`${styles.weeklyGoalCard} ${g.done ? styles.weeklyGoalCardDone : ""}`}
                    >
                      <div className={styles.weeklyGoalCardTop}>
                        <span className={styles.weeklyGoalDateText}>
                          {formatGoalDate(g.date)}
                        </span>
                        <button
                          type="button"
                          className={`${styles.weeklyGoalCheckBtn} ${g.done ? styles.weeklyGoalCheckBtnOn : ""}`}
                          onClick={() => toggleWeeklyGoal(g.id)}
                          aria-pressed={g.done}
                          aria-label="완료 토글"
                        >
                          {g.done && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="11"
                              height="11"
                              viewBox="0 0 11 11"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                clipRule="evenodd"
                                d="M9.69591 2.30039C9.82245 2.42698 9.89354 2.59863 9.89354 2.77762C9.89354 2.95661 9.82245 3.12826 9.69591 3.25484L4.63656 8.3142C4.5697 8.38107 4.49032 8.43412 4.40295 8.47031C4.31559 8.50651 4.22195 8.52514 4.12738 8.52514C4.03282 8.52514 3.93918 8.50651 3.85181 8.47031C3.76445 8.43412 3.68507 8.38107 3.61821 8.3142L1.10451 5.80095C1.04004 5.73868 0.988615 5.6642 0.953239 5.58184C0.917863 5.49949 0.899242 5.41092 0.898463 5.32129C0.897684 5.23166 0.914763 5.14278 0.948702 5.05983C0.982642 4.97687 1.03276 4.90151 1.09614 4.83813C1.15952 4.77475 1.23488 4.72463 1.31784 4.69069C1.40079 4.65675 1.48968 4.63967 1.5793 4.64045C1.66893 4.64123 1.7575 4.65985 1.83986 4.69523C1.92221 4.7306 1.99669 4.78203 2.05896 4.8465L4.12716 6.9147L8.74101 2.30039C8.80369 2.23767 8.87812 2.18791 8.96005 2.15396C9.04197 2.12001 9.12978 2.10254 9.21846 2.10254C9.30714 2.10254 9.39495 2.12001 9.47687 2.15396C9.55879 2.18791 9.63322 2.23767 9.69591 2.30039Z"
                                fill="white"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                      <span className={styles.weeklyGoalText}>{g.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 4 stat 합쳐진 하나의 카드 (mock 데이터) — 학사팀은 stats 숨김 */}
          {!isAcademic && (
          <div className={styles.statGroup}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="42"
                  height="42"
                  viewBox="0 0 42 42"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M28.8747 10.7619C30.3489 10.763 31.7916 11.1919 33.0267 11.9966C34.2617 12.8014 35.2364 13.9478 35.8329 15.2958C36.4293 16.644 36.6218 18.1369 36.3866 19.5922C36.1513 21.0474 35.4983 22.4031 34.5075 23.4946L34.2743 23.7519L34.5853 23.9065C36.1519 24.6826 37.5443 25.7702 38.6766 27.1023C39.8088 28.4344 40.6574 29.9839 41.1709 31.6551L41.1717 31.6568C41.2618 31.9433 41.2744 32.249 41.2085 32.542C41.1424 32.8351 41.0001 33.1061 40.7958 33.3264C40.5914 33.5467 40.3319 33.7085 40.0447 33.7964C39.7572 33.8843 39.4512 33.8947 39.1585 33.8263C38.866 33.7586 38.5959 33.6145 38.3767 33.4093C38.1574 33.204 37.9961 32.9441 37.9093 32.6565L37.9084 32.6548C37.4238 31.0901 36.5416 29.6772 35.3484 28.555C34.1551 27.4328 32.6913 26.639 31.0998 26.2512C30.7273 26.1613 30.3951 25.9484 30.1582 25.6471C29.9214 25.3459 29.7928 24.9733 29.7933 24.5901V23.6655C29.7932 23.3481 29.8817 23.0366 30.0488 22.7666C30.216 22.4967 30.4558 22.2783 30.7401 22.1369C31.5885 21.7161 32.2701 21.0205 32.6738 20.1638C33.0773 19.3071 33.1794 18.3388 32.9635 17.4166C32.7474 16.4944 32.2257 15.6716 31.4835 15.083C30.7413 14.4946 29.8219 14.174 28.8747 14.1738C28.4222 14.1738 27.9882 13.994 27.6682 13.674C27.3483 13.354 27.1683 12.9199 27.1683 12.4674C27.1685 12.0151 27.3484 11.5807 27.6682 11.2609C27.9881 10.9412 28.4224 10.7619 28.8747 10.7619Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M13.6639 5.54433C15.1373 5.41622 16.6197 5.65578 17.9774 6.24245C19.3352 6.82929 20.5267 7.74476 21.4432 8.9059C22.3596 10.067 22.9729 11.4386 23.2282 12.8955C23.4834 14.3524 23.3722 15.8501 22.9052 17.2534C22.4381 18.6569 21.6294 19.9228 20.552 20.9363L20.2743 21.1978L20.6169 21.3635C22.6702 22.3604 24.4536 23.838 25.8148 25.6702C27.1758 27.5022 28.0747 29.6358 28.4364 31.8892C28.4715 32.1104 28.463 32.337 28.4107 32.5548C28.3585 32.7726 28.2638 32.9785 28.1322 33.1598C28.0006 33.341 27.8343 33.4947 27.6434 33.6118C27.4523 33.729 27.2393 33.8074 27.0179 33.8426C26.7967 33.8776 26.5709 33.8683 26.3531 33.8161C26.1352 33.7638 25.9295 33.6692 25.7481 33.5375C25.5668 33.4058 25.4124 33.2398 25.2953 33.0487C25.1783 32.8578 25.1005 32.6452 25.0654 32.4241C24.6617 29.896 23.3696 27.5932 21.4218 25.9317C19.474 24.2702 16.9974 23.3571 14.4372 23.3571C11.8771 23.3571 9.40043 24.2703 7.45259 25.9317C5.50486 27.5932 4.21273 29.8952 3.80904 32.4232C3.7738 32.6445 3.69552 32.8578 3.57832 33.0487C3.46108 33.2397 3.3068 33.4059 3.12544 33.5375C2.94411 33.669 2.73829 33.7631 2.52046 33.8152C2.30246 33.8674 2.07617 33.8761 1.85481 33.8408C1.6335 33.8056 1.42118 33.7274 1.23018 33.6101C1.03917 33.4928 0.873004 33.3387 0.741409 33.1572C0.609886 32.9758 0.514972 32.7702 0.462844 32.5523C0.410776 32.3344 0.401975 32.1079 0.43721 31.8866C0.797508 29.6333 1.69669 27.4999 3.05794 25.6685C4.41928 23.837 6.20281 22.3607 8.25667 21.3661L8.60018 21.2003L8.32247 20.9389C7.43523 20.1043 6.7276 19.097 6.24434 17.9789C5.76114 16.8607 5.51184 15.6543 5.51204 14.4362C5.51196 12.9571 5.87977 11.5006 6.58187 10.1987C7.28405 8.89693 8.29897 7.78975 9.53499 6.97731C10.7711 6.16488 12.1903 5.67253 13.6639 5.54433ZM14.4432 8.92385C13.7092 8.90725 12.9788 9.03735 12.2959 9.30666C11.613 9.57599 10.9906 9.97967 10.4655 10.4927C9.94053 11.0058 9.52258 11.6191 9.23763 12.2957C8.95274 12.9723 8.80636 13.6995 8.80611 14.4336C8.80593 15.1677 8.9523 15.8948 9.23678 16.5716C9.52134 17.2483 9.93825 17.8619 10.463 18.3754C10.9878 18.8889 11.6104 19.2925 12.2933 19.5623C12.9762 19.832 13.7066 19.9622 14.4406 19.9459C15.8808 19.914 17.2511 19.3196 18.2585 18.2899C19.2658 17.2602 19.8304 15.8767 19.8308 14.4362C19.831 12.9958 19.267 11.6125 18.2602 10.5824C17.2533 9.5523 15.8833 8.95649 14.4432 8.92385Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div className={styles.statTexts}>
                <div className={styles.statValueRow}>
                  <span className={styles.statLabel}>전체문의</span>
                  <span className={styles.statValue}>
                    {(stats?.totalInquiries ?? 0).toLocaleString()}건
                  </span>
                </div>
                <div className={styles.statSub}>
                  <span>전일대비</span>
                  <span>
                    {(() => {
                      const n = stats?.delta.inquiries ?? 0;
                      return `${n > 0 ? "+" : ""}${n}건`;
                    })()}
                  </span>
                </div>
              </div>
            </div>

            <span className={styles.statDivider} aria-hidden="true" />

            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="42"
                  height="42"
                  viewBox="0 0 42 42"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M14.4393 6.91308C16.2097 6.91308 17.9393 7.44466 19.4039 8.43921C20.8686 9.43385 22.0015 10.8455 22.6544 12.4912C23.3073 14.1369 23.4507 15.9412 23.0663 17.6694C22.6818 19.3975 21.7865 20.9709 20.4977 22.1846L20.1285 22.5315L20.5848 22.7537C22.8502 23.8569 24.7772 25.545 26.1732 27.6431C27.5691 29.741 28.3805 32.1734 28.5231 34.6892C28.5352 34.9013 28.5058 35.114 28.4359 35.3147C28.3659 35.5154 28.2578 35.7012 28.1163 35.8598C27.975 36.0183 27.8033 36.1468 27.6122 36.2392C27.4209 36.3317 27.2124 36.3859 27.0004 36.3982C26.788 36.4104 26.574 36.381 26.3732 36.311C26.1726 36.241 25.9883 36.1311 25.8297 35.9897C25.671 35.8482 25.5411 35.677 25.4486 35.4856C25.3562 35.2942 25.3018 35.0859 25.2897 34.8738C25.1388 32.0973 23.9306 29.4843 21.9127 27.5713C19.8943 25.6578 17.2188 24.5896 14.4376 24.5874C11.6566 24.5896 8.98251 25.658 6.96422 27.5713C4.94623 29.4843 3.73644 32.0972 3.58556 34.8738C3.57352 35.0858 3.5205 35.2942 3.42833 35.4856C3.33595 35.6771 3.20587 35.8498 3.04722 35.9914C2.88886 36.1327 2.70407 36.241 2.50377 36.311C2.30321 36.3811 2.09037 36.4118 1.87828 36.3999C1.66607 36.3878 1.45793 36.3332 1.26646 36.241C1.07493 36.1486 0.902209 36.0202 0.760604 35.8616C0.619049 35.7029 0.511123 35.5171 0.441023 35.3164C0.370952 35.1157 0.340113 34.9031 0.352156 34.6909C0.49426 32.1746 1.30606 29.7415 2.70201 27.6431C4.09789 25.5449 6.02813 23.8571 8.29381 22.7537L8.75011 22.5315L8.38097 22.1846C7.09214 20.9709 6.19681 19.3975 5.81236 17.6694C5.42799 15.9413 5.57141 14.1368 6.22423 12.4912C6.87714 10.8455 8.01003 9.43385 9.47472 8.43921C10.9394 7.4446 12.6689 6.91311 14.4393 6.91308ZM14.4462 10.1499C13.7006 10.133 12.9592 10.266 12.2655 10.5395C11.5716 10.8132 10.9379 11.223 10.4044 11.7444C9.8712 12.2657 9.44794 12.8892 9.15855 13.5764C8.86931 14.2635 8.71962 15.0013 8.71935 15.7468C8.71916 16.4925 8.86789 17.2315 9.15685 17.9189C9.44587 18.6063 9.8698 19.2294 10.4027 19.751C10.9359 20.2726 11.5683 20.6835 12.2621 20.9575C12.9557 21.2315 13.6972 21.3636 14.4427 21.3472C15.9058 21.3148 17.2987 20.7115 18.3221 19.6655C19.3456 18.6194 19.9197 17.2138 19.92 15.7502C19.9204 14.2867 19.3468 12.8816 18.3238 11.835C17.3009 10.7884 15.9093 10.183 14.4462 10.1499Z"
                    fill="currentColor"
                  />
                  <path
                    d="M33.0314 0.350586C33.4606 0.350586 33.8728 0.520568 34.1764 0.823974C34.48 1.12755 34.6515 1.53967 34.6515 1.96899V5.60058H38.2814C38.7106 5.60058 39.1228 5.77057 39.4264 6.07397C39.73 6.37755 39.9015 6.78967 39.9015 7.21899C39.9015 7.64831 39.73 8.06044 39.4264 8.36401C39.1228 8.66742 38.7106 8.8374 38.2814 8.8374H34.6515V12.469C34.6515 12.8983 34.48 13.3104 34.1764 13.614C33.8728 13.9174 33.4606 14.0874 33.0314 14.0874C32.6025 14.0873 32.1914 13.9171 31.8881 13.614C31.5845 13.3104 31.413 12.8983 31.413 12.469V8.8374H27.7814C27.3525 8.83726 26.9414 8.66709 26.638 8.36401C26.3345 8.06044 26.163 7.64831 26.163 7.21899C26.163 6.78967 26.3345 6.37755 26.638 6.07397C26.9414 5.77089 27.3525 5.60073 27.7814 5.60058H31.413V1.96899C31.413 1.53967 31.5845 1.12755 31.8881 0.823974C32.1914 0.520892 32.6025 0.350728 33.0314 0.350586Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div className={styles.statTexts}>
                <div className={styles.statValueRow}>
                  <span className={styles.statLabel}>등록 건수</span>
                  <span className={styles.statValue}>
                    {(stats?.registrations ?? 0).toLocaleString()}건
                  </span>
                </div>
                <div className={styles.statSub}>
                  <span>전일대비</span>
                  <span>
                    {(() => {
                      const n = stats?.delta.registrations ?? 0;
                      return `${n > 0 ? "+" : ""}${n}건`;
                    })()}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={styles.statSubArrow}
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M1.01172 2.00317C1.01172 2.20201 1.09089 2.39281 1.23145 2.53345L5.47437 6.77637C5.615 6.91692 5.80581 6.99609 6.00464 6.99609C6.20339 6.99601 6.39434 6.91689 6.53491 6.77637L10.7771 2.53345C10.9137 2.392 10.9897 2.20273 10.988 2.0061C10.9863 1.80953 10.9073 1.62145 10.7683 1.48242C10.6293 1.34343 10.4412 1.26447 10.2446 1.26269C10.048 1.26099 9.858 1.33631 9.71655 1.4729L6.00464 5.18555L2.29199 1.4729C2.15139 1.33239 1.96049 1.25395 1.76172 1.25391C1.56296 1.25391 1.37207 1.33245 1.23145 1.4729C1.09092 1.61347 1.01181 1.80442 1.01172 2.00317Z"
                      fill="#8F8F8F"
                    />
                    <path
                      d="M1.01172 5.75317C1.01172 5.95201 1.09089 6.14281 1.23145 6.28345L5.47437 10.5264C5.615 10.6669 5.80581 10.7461 6.00464 10.7461C6.20339 10.746 6.39434 10.6669 6.53491 10.5264L10.7771 6.28345C10.9137 6.142 10.9897 5.95273 10.988 5.7561C10.9863 5.55953 10.9073 5.37145 10.7683 5.23242C10.6293 5.09343 10.4412 5.01447 10.2446 5.01269C10.048 5.01099 9.858 5.08631 9.71655 5.2229L6.00464 8.93555L2.29199 5.2229C2.15139 5.08239 1.96049 5.00395 1.76172 5.00391C1.56296 5.00391 1.37207 5.08245 1.23145 5.2229C1.09092 5.36347 1.01181 5.55442 1.01172 5.75317Z"
                      fill="#8F8F8F"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <span className={styles.statDivider} aria-hidden="true" />

            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="42"
                  height="42"
                  viewBox="0 0 42 42"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M21.0002 4.1377C25.5309 4.1377 29.6437 5.92495 32.6735 8.83228C32.6849 8.84329 32.6962 8.85455 32.7076 8.8656C32.7898 8.94491 32.8715 9.02476 32.952 9.10571C33.002 9.15596 33.0513 9.20691 33.1007 9.25781C33.1522 9.31086 33.2037 9.36388 33.2545 9.4176C33.2672 9.43107 33.2803 9.44425 33.293 9.45776C33.2973 9.46234 33.3007 9.46768 33.3049 9.47229C36.1311 12.4877 37.8628 16.5414 37.8628 21.0002C37.8628 30.3132 30.3132 37.8628 21.0002 37.8628C11.6873 37.8628 4.1377 30.3132 4.1377 21.0002C4.1377 11.6873 11.6873 4.1377 21.0002 4.1377ZM19.469 7.28479C12.5681 8.04662 7.2002 13.8963 7.2002 21.0002C7.2002 28.6218 13.3787 34.8003 21.0002 34.8003C28.6218 34.8003 34.8003 28.6218 34.8003 21.0002C34.8003 17.8968 33.7763 15.0323 32.0471 12.7271L22.0487 22.1162C21.6036 22.5342 20.9522 22.6484 20.3918 22.4059C19.8315 22.1634 19.469 21.6108 19.469 21.0002V7.28479ZM22.5315 17.4618L29.9493 10.496C28.909 9.6096 27.7405 8.88092 26.481 8.33582C25.2212 7.79062 23.89 7.43735 22.5315 7.28564V17.4618Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div className={styles.statTexts}>
                <div className={styles.statValueRow}>
                  <span className={styles.statLabel}>등록률</span>
                  <span className={styles.statValue}>
                    {(stats?.registrationRate ?? 0).toFixed(1)}%
                  </span>
                </div>
                <div className={styles.statSub}>
                  <span>전일대비</span>
                  <span>
                    {(() => {
                      const n = stats?.delta.rate ?? 0;
                      return `${n > 0 ? "+" : ""}${n.toFixed(1)}%p`;
                    })()}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={styles.statSubArrow}
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M1.01172 9.99683C1.01172 9.79799 1.09089 9.60719 1.23145 9.46655L5.47437 5.22363C5.615 5.08308 5.80581 5.00391 6.00464 5.00391C6.20339 5.00399 6.39434 5.08311 6.53491 5.22363L10.7771 9.46655C10.9137 9.608 10.9897 9.79727 10.988 9.9939C10.9863 10.1905 10.9073 10.3786 10.7683 10.5176C10.6293 10.6566 10.4412 10.7355 10.2446 10.7373C10.048 10.739 9.858 10.6637 9.71655 10.5271L6.00464 6.81445L2.29199 10.5271C2.15139 10.6676 1.96049 10.7461 1.76172 10.7461C1.56296 10.7461 1.37207 10.6676 1.23145 10.5271C1.09092 10.3865 1.01181 10.1956 1.01172 9.99683Z"
                      fill="#00CE56"
                    />
                    <path
                      d="M1.01172 6.24683C1.01172 6.04799 1.09089 5.85719 1.23145 5.71655L5.47436 1.47363C5.615 1.33308 5.80581 1.25391 6.00464 1.25391C6.20339 1.25399 6.39434 1.33311 6.53491 1.47363L10.7771 5.71655C10.9137 5.858 10.9897 6.04727 10.988 6.2439C10.9863 6.44047 10.9073 6.62855 10.7683 6.76758C10.6293 6.90657 10.4412 6.98553 10.2446 6.9873C10.048 6.98901 9.858 6.91369 9.71655 6.7771L6.00464 3.06445L2.29199 6.7771C2.15139 6.91761 1.96049 6.99605 1.76172 6.99609C1.56296 6.99609 1.37207 6.91755 1.23145 6.7771C1.09092 6.63653 1.01181 6.44558 1.01172 6.24683Z"
                      fill="#00CE56"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <span className={styles.statDivider} aria-hidden="true" />

            <div className={styles.statCard}>
              <div className={styles.statIcon}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="42"
                  height="42"
                  viewBox="0 0 42 42"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M24.9025 19.9652C25.474 19.342 26.4428 19.2998 27.0661 19.8712C27.6893 20.4427 27.7314 21.4114 27.1601 22.0348L20.7429 29.0348C20.1812 29.6474 19.2328 29.7001 18.6066 29.1536L15.3997 26.3534C14.7627 25.7973 14.6967 24.8303 15.2527 24.1932C15.8088 23.5564 16.7758 23.4905 17.4129 24.0463L19.4944 25.8638L24.9025 19.9652Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M21.0001 1.96875C22.7986 1.96875 24.5237 2.68286 25.7955 3.95459C27.0672 5.22632 27.7813 6.9515 27.7813 8.75V9.12598C27.9635 9.14331 28.1413 9.16097 28.3145 9.18237C30.1039 9.40347 31.6073 9.87105 32.8886 10.9349C34.1707 11.9989 34.9081 13.3907 35.4555 15.1091C35.99 16.7873 36.3923 18.9447 36.897 21.6366L37.3986 24.3376C37.8633 26.8955 38.2019 29.0321 38.2796 30.8104C38.3851 33.2239 38.0282 35.2658 36.6313 36.9491C35.2343 38.6312 33.2925 39.3586 30.9011 39.6997C28.5513 40.0348 25.4903 40.0312 21.6298 40.0312H20.3694C16.5093 40.0312 13.4492 40.0348 11.0999 39.6997C8.70883 39.3586 6.76746 38.6319 5.37054 36.95L5.36968 36.9491C3.97295 35.2659 3.61589 33.2237 3.72136 30.8104C3.82503 28.4393 4.39338 25.4313 5.10479 21.6366L5.46709 19.7174C5.81798 17.8962 6.14406 16.3677 6.54461 15.1091C7.09148 13.3908 7.82842 11.9991 9.11065 10.9349C10.3927 9.87099 11.8966 9.40354 13.6865 9.18237C13.8594 9.16101 14.037 9.14328 14.2188 9.12598V8.75C14.2188 6.9515 14.9329 5.22632 16.2046 3.95459C17.4764 2.68286 19.2016 1.96875 21.0001 1.96875ZM20.3677 12.0312C17.5511 12.0312 15.5782 12.0344 14.0616 12.2218C12.5872 12.404 11.7286 12.7423 11.0666 13.2916C10.4047 13.8409 9.91328 14.6222 9.4627 16.038C8.99926 17.4942 8.63333 19.4325 8.11431 22.2006C7.38549 26.0882 6.87321 28.8419 6.7813 30.9437C6.69128 33.0028 7.02357 34.1461 7.72637 34.9932L7.86224 35.1478C8.56565 35.9056 9.61911 36.395 11.5323 36.668C13.6146 36.965 16.415 36.9688 20.3694 36.9688H21.6298C25.5846 36.9688 28.3858 36.965 30.4687 36.668C32.5094 36.3769 33.5717 35.8394 34.2746 34.9932C34.9776 34.146 35.3106 33.0031 35.2205 30.9437C35.1286 28.8419 34.6155 26.0882 33.8867 22.2006C33.3677 19.4329 33.0012 17.4948 32.5374 16.0388C32.0865 14.6231 31.5956 13.8411 30.9335 13.2916C30.2726 12.7427 29.4136 12.404 27.9385 12.2218C26.4216 12.0344 24.4482 12.0312 21.6315 12.0312H20.3677ZM21.0001 5.03125C20.0138 5.03125 19.0682 5.42333 18.3708 6.12073C17.6734 6.81813 17.2813 7.76373 17.2813 8.75V8.98242C18.224 8.96822 19.2506 8.96875 20.3677 8.96875H21.6315C22.7488 8.96875 23.7759 8.96823 24.7188 8.98242V8.75C24.7188 7.76373 24.3267 6.81813 23.6293 6.12073C22.9319 5.42333 21.9863 5.03125 21.0001 5.03125Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div className={styles.statTexts}>
                <div className={styles.statValueRow}>
                  <span className={styles.statLabel}>매출</span>
                  <span className={styles.statValue}>
                    {Math.round(
                      (stats?.salesThisMonth ?? 0) / 10000,
                    ).toLocaleString()}
                    만원
                  </span>
                </div>
                <div className={styles.statSub}>
                  <span>전일대비</span>
                  <span>
                    {(() => {
                      const n = Math.round((stats?.delta.sales ?? 0) / 10000);
                      return `${n > 0 ? "+" : ""}${n.toLocaleString()}만원`;
                    })()}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={styles.statSubArrow}
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M1.01172 9.99683C1.01172 9.79799 1.09089 9.60719 1.23145 9.46655L5.47437 5.22363C5.615 5.08308 5.80581 5.00391 6.00464 5.00391C6.20339 5.00399 6.39434 5.08311 6.53491 5.22363L10.7771 9.46655C10.9137 9.608 10.9897 9.79727 10.988 9.9939C10.9863 10.1905 10.9073 10.3786 10.7683 10.5176C10.6293 10.6566 10.4412 10.7355 10.2446 10.7373C10.048 10.739 9.858 10.6637 9.71655 10.5271L6.00464 6.81445L2.29199 10.5271C2.15139 10.6676 1.96049 10.7461 1.76172 10.7461C1.56296 10.7461 1.37207 10.6676 1.23145 10.5271C1.09092 10.3865 1.01181 10.1956 1.01172 9.99683Z"
                      fill="#00CE56"
                    />
                    <path
                      d="M1.01172 6.24683C1.01172 6.04799 1.09089 5.85719 1.23145 5.71655L5.47436 1.47363C5.615 1.33308 5.80581 1.25391 6.00464 1.25391C6.20339 1.25399 6.39434 1.33311 6.53491 1.47363L10.7771 5.71655C10.9137 5.858 10.9897 6.04727 10.988 6.2439C10.9863 6.44047 10.9073 6.62855 10.7683 6.76758C10.6293 6.90657 10.4412 6.98553 10.2446 6.9873C10.048 6.98901 9.858 6.91369 9.71655 6.7771L6.00464 3.06445L2.29199 6.7771C2.15139 6.91761 1.96049 6.99605 1.76172 6.99609C1.56296 6.99609 1.37207 6.91755 1.23145 6.7771C1.09092 6.63653 1.01181 6.44558 1.01172 6.24683Z"
                      fill="#00CE56"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* ── 3컬럼 본문 — 제출 완료 후 잠금 ───────────────────── */}
        <div
          className={`${styles.bodyRow} ${isLocked ? styles.bodyRowLocked : ""}`}
        >
          {/* 좌: 오늘의 업무 */}
          <section className={styles.col} data-guide="wj-today-tasks">
            <h3 className={styles.colTitle}>오늘의 업무</h3>
            <div className={styles.taskList}>
              {tasks.map((t, idx) => {
                const isEditing = editingTaskId === t.id;
                const isEmpty = t.text.trim() === "";
                const canDrag = !isEmpty && !isEditing;
                const isDropAbove = dropTaskTarget === idx;
                const isDropBelowLast =
                  idx === tasks.length - 1 && dropTaskTarget === tasks.length;
                return (
                  <div
                    key={t.id}
                    className={`${styles.taskItem} ${isDropAbove ? styles.taskItemDropAbove : ""} ${isDropBelowLast ? styles.taskItemDropBelow : ""}`}
                    onDragOver={handleTaskItemDragOver(idx)}
                    onDrop={handleTaskItemDrop}
                    onDragLeave={handleTaskListDragLeave}
                  >
                    <input
                      type="checkbox"
                      className={styles.taskCheckbox}
                      checked={t.done}
                      onChange={() => toggleTask(t.id)}
                    />
                    {isEditing || isEmpty ? (
                      <AutoSizeTextarea
                        value={t.text}
                        placeholder="할 일을 입력하세요"
                        className={`${styles.taskInput} ${t.done ? styles.taskTextDone : ""}`}
                        onChange={(v) => updateTaskText(t.id, v)}
                        autoFocus={isEditing}
                        onBlur={() => setEditingTaskId(null)}
                      />
                    ) : (
                      <div
                        className={`${styles.taskInput} ${styles.taskTextDisplay} ${t.done ? styles.taskTextDone : ""}`}
                        onClick={() => setEditingTaskId(t.id)}
                      >
                        {t.text}
                      </div>
                    )}
                    {canDrag ? (
                      <span
                        className={styles.taskDragHandle}
                        draggable
                        onDragStart={(e) =>
                          handleTaskGripDragStart(
                            idx,
                            (e.currentTarget as HTMLElement).closest(
                              `.${styles.taskItem}`,
                            ) as HTMLElement | null,
                          )(e)
                        }
                        title="잡고 위/아래로 끌어 순서를 바꿀 수 있어요"
                        aria-label="순서 변경 핸들"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="6"
                          height="10"
                          viewBox="0 0 6 10"
                          fill="none"
                        >
                          <path
                            d="M1 0C1.26522 0 1.51957 0.105357 1.70711 0.292893C1.89464 0.480429 2 0.734784 2 1C2 1.26522 1.89464 1.51957 1.70711 1.70711C1.51957 1.89464 1.26522 2 1 2C0.734784 2 0.480429 1.89464 0.292893 1.70711C0.105357 1.51957 0 1.26522 0 1C0 0.734784 0.105357 0.480429 0.292893 0.292893C0.480429 0.105357 0.734784 0 1 0ZM2 5C2 4.73478 1.89464 4.48043 1.70711 4.29289C1.51957 4.10536 1.26522 4 1 4C0.734784 4 0.480429 4.10536 0.292893 4.29289C0.105357 4.48043 0 4.73478 0 5C0 5.26522 0.105357 5.51957 0.292893 5.70711C0.480429 5.89464 0.734784 6 1 6C1.26522 6 1.51957 5.89464 1.70711 5.70711C1.89464 5.51957 2 5.26522 2 5ZM2 9C2 8.73478 1.89464 8.48043 1.70711 8.29289C1.51957 8.10536 1.26522 8 1 8C0.734784 8 0.480429 8.10536 0.292893 8.29289C0.105357 8.48043 0 8.73478 0 9C0 9.26522 0.105357 9.51957 0.292893 9.70711C0.480429 9.89464 0.734784 10 1 10C1.26522 10 1.51957 9.89464 1.70711 9.70711C1.89464 9.51957 2 9.26522 2 9ZM6 5C6 4.73478 5.89464 4.48043 5.70711 4.29289C5.51957 4.10536 5.26522 4 5 4C4.73478 4 4.48043 4.10536 4.29289 4.29289C4.10536 4.48043 4 4.73478 4 5C4 5.26522 4.10536 5.51957 4.29289 5.70711C4.48043 5.89464 4.73478 6 5 6C5.26522 6 5.51957 5.89464 5.70711 5.70711C5.89464 5.51957 6 5.26522 6 5ZM5 8C5.26522 8 5.51957 8.10536 5.70711 8.29289C5.89464 8.48043 6 8.73478 6 9C6 9.26522 5.89464 9.51957 5.70711 9.70711C5.51957 9.89464 5.26522 10 5 10C4.73478 10 4.48043 9.89464 4.29289 9.70711C4.10536 9.51957 4 9.26522 4 9C4 8.73478 4.10536 8.48043 4.29289 8.29289C4.48043 8.10536 4.73478 8 5 8ZM6 1C6 0.734784 5.89464 0.480429 5.70711 0.292893C5.51957 0.105357 5.26522 0 5 0C4.73478 0 4.48043 0.105357 4.29289 0.292893C4.10536 0.480429 4 0.734784 4 1C4 1.26522 4.10536 1.51957 4.29289 1.70711C4.48043 1.89464 4.73478 2 5 2C5.26522 2 5.51957 1.89464 5.70711 1.70711C5.89464 1.51957 6 1.26522 6 1Z"
                            fill="#7A8086"
                          />
                        </svg>
                      </span>
                    ) : (
                      <span
                        className={styles.taskDragHandlePlaceholder}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 중: 업무 일지 */}
          <section
            className={`${styles.col} ${styles.colJournal}`}
            data-guide="wj-journal"
          >
            <div className={styles.colTitleRow}>
              <h3 className={styles.colTitle}>업무 일지</h3>
              <button
                type="button"
                className={styles.guideBtn}
                onClick={() => startById("work-journal-basics")}
                data-guide="wj-guide-btn"
              >
                <HelpCircle size={14} /> 가이드
              </button>
            </div>
            <div className={styles.journalScroll}>
              {/* 오전·오후 — 학사팀은 숨김 (이슈 및 요청사항만 사용) */}
              {!isAcademic && (
                <>
              {/* 오전 */}
              <div
                className={`${styles.sectionDropZone} ${dropTarget?.section === "morning" ? styles.sectionDropZoneActive : ""}`}
                onDragOver={handleSectionDragOver("morning", morning.length)}
                onDragLeave={handleSectionDragLeave}
                onDrop={handleSectionDrop("morning")}
              >
                <div
                  className={styles.sectionTitle}
                  onClick={() => setMorningOpen((v) => !v)}
                >
                  <span>오전 업무 (10:00 ~ 13:00)</span>
                  <span className={styles.sectionTitleArrow}>
                    {morningOpen ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </span>
                </div>
                {morningOpen && (
                  <>
                    {morning.map((row, i) => {
                      const isDropAbove =
                        dropTarget?.section === "morning" &&
                        dropTarget.insertAt === i;
                      const isDropBelowLast =
                        i === morning.length - 1 &&
                        dropTarget?.section === "morning" &&
                        dropTarget.insertAt === morning.length;
                      return (
                        <div
                          key={row.id}
                          className={`${styles.journalRow} ${isDropAbove ? styles.journalRowDropAbove : ""} ${isDropBelowLast ? styles.journalRowDropBelow : ""}`}
                          draggable
                          onDragStart={(e) => {
                            // input 안에서 시작된 드래그는 텍스트 편집 우선 → 차단
                            const target = e.target as HTMLElement;
                            if (target.closest("textarea, input, [data-no-drag]")) {
                              e.preventDefault();
                              return;
                            }
                            draggedRowRef.current = {
                              section: "morning",
                              index: i,
                              row,
                            };
                            e.dataTransfer.setData(
                              "text/plain",
                              "__journal_row__",
                            );
                            e.dataTransfer.effectAllowed = "all";
                          }}
                          onDragOver={handleRowDragOver("morning", i)}
                          onDrop={handleSectionDrop("morning")}
                        >
                          <div className={styles.journalRowMain}>
                            <div
                              className={styles.journalCategoryBox}
                              data-guide={i === 0 ? "wj-category" : undefined}
                            >
                              {isAcademic ? (
                                <input
                                  type="text"
                                  className={styles.journalCategoryInput}
                                  placeholder="업무 분류를 작성해주세요."
                                  value={row.category}
                                  onChange={(e) =>
                                    updateRow("morning", row.id, {
                                      category: e.target.value,
                                    })
                                  }
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => e.preventDefault()}
                                />
                              ) : (
                                <CategorySelect
                                  value={row.category}
                                  options={BIZ_CATEGORY_OPTIONS}
                                  onChange={(v) =>
                                    updateRow("morning", row.id, {
                                      category: v,
                                    })
                                  }
                                />
                              )}
                            </div>
                            <input
                              type="text"
                              className={styles.journalDetailInput}
                              placeholder="세부 업무 내용을 작성해주세요."
                              value={row.detail}
                              data-guide={i === 0 ? "wj-detail" : undefined}
                              onChange={(e) =>
                                updateRow("morning", row.id, {
                                  detail: e.target.value,
                                })
                              }
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => e.preventDefault()}
                            />
                          </div>
                          <DeleteButton
                            onClick={() => removeRow("morning", row.id)}
                          />
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      className={styles.addBtn}
                      onClick={() => addRow("morning")}
                    >
                      <Plus size={12} /> 추가
                    </button>
                  </>
                )}
              </div>

              {/* 오후 */}
              <div
                className={`${styles.sectionDropZone} ${dropTarget?.section === "afternoon" ? styles.sectionDropZoneActive : ""}`}
                onDragOver={handleSectionDragOver(
                  "afternoon",
                  afternoon.length,
                )}
                onDragLeave={handleSectionDragLeave}
                onDrop={handleSectionDrop("afternoon")}
              >
                <div
                  className={styles.sectionTitle}
                  onClick={() => setAfternoonOpen((v) => !v)}
                >
                  <span>오후 업무 (14:00 ~ 19:00)</span>
                  <span className={styles.sectionTitleArrow}>
                    {afternoonOpen ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </span>
                </div>
                {afternoonOpen && (
                  <>
                    {afternoon.map((row, i) => {
                      const isDropAbove =
                        dropTarget?.section === "afternoon" &&
                        dropTarget.insertAt === i;
                      const isDropBelowLast =
                        i === afternoon.length - 1 &&
                        dropTarget?.section === "afternoon" &&
                        dropTarget.insertAt === afternoon.length;
                      return (
                        <div
                          key={row.id}
                          className={`${styles.journalRow} ${isDropAbove ? styles.journalRowDropAbove : ""} ${isDropBelowLast ? styles.journalRowDropBelow : ""}`}
                          draggable
                          onDragStart={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest("textarea, input, [data-no-drag]")) {
                              e.preventDefault();
                              return;
                            }
                            draggedRowRef.current = {
                              section: "afternoon",
                              index: i,
                              row,
                            };
                            e.dataTransfer.setData(
                              "text/plain",
                              "__journal_row__",
                            );
                            e.dataTransfer.effectAllowed = "all";
                          }}
                          onDragOver={handleRowDragOver("afternoon", i)}
                          onDrop={handleSectionDrop("afternoon")}
                        >
                          <div className={styles.journalRowMain}>
                            <div className={styles.journalCategoryBox}>
                              {isAcademic ? (
                                <input
                                  type="text"
                                  className={styles.journalCategoryInput}
                                  placeholder="업무 분류를 작성해주세요."
                                  value={row.category}
                                  onChange={(e) =>
                                    updateRow("afternoon", row.id, {
                                      category: e.target.value,
                                    })
                                  }
                                />
                              ) : (
                                <CategorySelect
                                  value={row.category}
                                  options={BIZ_CATEGORY_OPTIONS}
                                  onChange={(v) =>
                                    updateRow("afternoon", row.id, {
                                      category: v,
                                    })
                                  }
                                />
                              )}
                            </div>
                            <input
                              type="text"
                              className={styles.journalDetailInput}
                              placeholder="세부 업무 내용을 작성해주세요."
                              value={row.detail}
                              onChange={(e) =>
                                updateRow("afternoon", row.id, {
                                  detail: e.target.value,
                                })
                              }
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => e.preventDefault()}
                            />
                          </div>
                          <DeleteButton
                            onClick={() => removeRow("afternoon", row.id)}
                          />
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      className={styles.addBtn}
                      onClick={() => addRow("afternoon")}
                    >
                      <Plus size={12} /> 추가
                    </button>
                  </>
                )}
              </div>
                </>
              )}

              {/* 이슈 및 요청사항 — 학사팀 전용 */}
              {isAcademic && (
                <div className={styles.sectionDropZone}>
                  <div
                    className={styles.sectionTitle}
                    onClick={() => setIssuesOpen((v) => !v)}
                  >
                    <span>이슈 및 요청사항</span>
                    <span className={styles.sectionTitleArrow}>
                      {issuesOpen ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </span>
                  </div>
                  {issuesOpen && (
                    <>
                      {issues.map((row) => (
                        <div key={row.id} className={styles.issueRow}>
                          <div className={styles.issueRowMain}>
                            <div className={styles.issueField}>
                              <input
                                type="text"
                                className={styles.issueFieldInput}
                                placeholder="이슈 내용을 작성해주세요."
                                value={row.category}
                                onChange={(e) =>
                                  updateRow("issues", row.id, {
                                    category: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className={`${styles.issueField} ${styles.issueFieldBorderless}`}>
                              <input
                                type="text"
                                className={styles.issueFieldInput}
                                placeholder="조치·요청 사항을 작성해주세요."
                                value={row.detail}
                                onChange={(e) =>
                                  updateRow("issues", row.id, {
                                    detail: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <DeleteButton
                            onClick={() => removeRow("issues", row.id)}
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        className={styles.addBtn}
                        onClick={() => addRow("issues")}
                      >
                        <Plus size={12} /> 추가
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* 우: 내일 예정 업무 (박스 + 푸터 wrapper) */}
          <div className={styles.colRight}>
            <section className={styles.col} data-guide="wj-tomorrow">
              <h3 className={styles.colTitle}>내일 예정 업무</h3>
              <div className={styles.tomorrowList}>
                {tomorrow.map((t, idx) => (
                  <div key={t.id} className={styles.tomorrowItem}>
                    <span className={styles.tomorrowNum}>{idx + 1}.</span>
                    <AutoSizeTextarea
                      value={t.text}
                      placeholder="내일 할 일을 입력하세요"
                      className={styles.tomorrowInput}
                      onChange={(v) => updateTomorrow(t.id, v)}
                    />
                    <DeleteButton
                      onClick={() => removeTomorrow(t.id)}
                      disabled={t.text.trim() === ""}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* 박스 바깥 푸터 — 상태별 분기
                 1) submitted + 잠금 + 저장후         → [수정하기] [다시 제출]
                 2) submitted + 잠금 + 저장후 아님    → [수정하기]
                 3) submitted + 편집중                → [취소] [저장하기]
                 4) draft/null                        → [임시저장] [제출하기] */}
            <div className={styles.footer} data-guide="wj-footer">
              {status === "submitted" && !isEditing ? (
                <>
                <button
                  type="button"
                  className={styles.btnEdit}
                  onClick={handleEdit}
                  disabled={saving || loading}
                >
                  <svg
                    className={styles.btnIcon}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M13.9997 13.3338C14.3679 13.3338 14.6663 13.6323 14.6663 14.0005C14.6663 14.3686 14.3678 14.6672 13.9997 14.6672H1.99967C1.63154 14.6672 1.3331 14.3686 1.33301 14.0005C1.33301 13.6323 1.63148 13.3338 1.99967 13.3338H13.9997Z"
                      fill="white"
                    />
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M10.9124 1.48357C11.1743 1.27 11.5603 1.28506 11.8044 1.52914L14.471 4.19581C14.7313 4.45616 14.7314 4.87819 14.471 5.13852L7.80436 11.8052C7.67935 11.9302 7.50978 12.0005 7.33301 12.0005H4.66634C4.2982 12.0005 3.99976 11.7019 3.99967 11.3338V8.66716C3.99967 8.49039 4.07001 8.32082 4.19499 8.19581L10.8617 1.52914L10.9124 1.48357ZM5.33301 8.9432V10.6672H7.05697L11.057 6.66716L9.33301 4.9432L5.33301 8.9432ZM10.2757 4.00049L11.9997 5.72445L13.057 4.66716L11.333 2.9432L10.2757 4.00049Z"
                      fill="white"
                    />
                  </svg>
                  수정하기
                </button>
                {hasEdits && (
                  <button
                    type="button"
                    className={styles.btnResubmit}
                    onClick={handleResubmit}
                    disabled={saving || loading}
                  >
                    다시 제출
                    <svg
                      className={styles.btnIcon}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M1.4033 7.10263H12.3215L8.27595 3.24975C7.90793 2.89925 7.90793 2.33113 8.27595 1.98064C8.64397 1.63015 9.2405 1.63015 9.60851 1.98064L15.2627 7.36557L15.3271 7.43393C15.629 7.78644 15.6077 8.30609 15.2627 8.63467L9.60851 14.0196C9.2405 14.3701 8.64397 14.3701 8.27595 14.0196C7.90793 13.6691 7.90793 13.101 8.27595 12.7505L12.3215 8.89761L1.4033 8.89761C0.882849 8.89761 0.460937 8.49579 0.460938 8.00012C0.460938 7.50445 0.882849 7.10263 1.4033 7.10263Z"
                        fill="white"
                      />
                    </svg>
                  </button>
                )}
                </>
              ) : status === "submitted" && isEditing ? (
                <>
                  <button
                    type="button"
                    className={styles.btnCancel}
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className={styles.btnSave}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <svg
                      className={styles.btnIcon}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M14.3692 3.40738C14.5567 3.59491 14.662 3.84921 14.662 4.11438C14.662 4.37954 14.5567 4.63385 14.3692 4.82138L6.87389 12.3167C6.77484 12.4158 6.65724 12.4944 6.52781 12.548C6.39838 12.6016 6.25966 12.6292 6.11956 12.6292C5.97946 12.6292 5.84074 12.6016 5.71131 12.548C5.58188 12.4944 5.46428 12.4158 5.36523 12.3167L1.64123 8.59338C1.54572 8.50113 1.46953 8.39079 1.41712 8.26878C1.36472 8.14678 1.33713 8.01556 1.33598 7.88278C1.33482 7.75 1.36012 7.61832 1.4104 7.49542C1.46069 7.37253 1.53494 7.26088 1.62883 7.16698C1.72272 7.07309 1.83438 6.99884 1.95727 6.94856C2.08017 6.89828 2.21185 6.87297 2.34463 6.87413C2.47741 6.87528 2.60863 6.90287 2.73063 6.95528C2.85263 7.00769 2.96298 7.08387 3.05523 7.17938L6.11923 10.2434L12.9546 3.40738C13.0474 3.31445 13.1577 3.24073 13.2791 3.19044C13.4004 3.14014 13.5305 3.11426 13.6619 3.11426C13.7933 3.11426 13.9234 3.14014 14.0447 3.19044C14.1661 3.24073 14.2764 3.31445 14.3692 3.40738Z"
                        fill="white"
                      />
                    </svg>
                    저장하기
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.btnDraft}
                    onClick={handleDraft}
                    disabled={saving || loading}
                  >
                    <svg
                      className={styles.btnIcon}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M14.3702 3.40738C14.5577 3.59491 14.663 3.84921 14.663 4.11438C14.663 4.37954 14.5577 4.63385 14.3702 4.82138L6.87487 12.3167C6.77582 12.4158 6.65822 12.4944 6.52879 12.548C6.39936 12.6016 6.26063 12.6292 6.12054 12.6292C5.98044 12.6292 5.84171 12.6016 5.71228 12.548C5.58285 12.4944 5.46526 12.4158 5.3662 12.3167L1.6422 8.59338C1.54669 8.50113 1.47051 8.39079 1.4181 8.26878C1.36569 8.14678 1.33811 8.01556 1.33695 7.88278C1.3358 7.75 1.3611 7.61832 1.41138 7.49542C1.46166 7.37253 1.53591 7.26088 1.62981 7.16698C1.7237 7.07309 1.83535 6.99884 1.95825 6.94856C2.08114 6.89828 2.21282 6.87297 2.3456 6.87413C2.47838 6.87528 2.6096 6.90287 2.73161 6.95528C2.85361 7.00769 2.96396 7.08387 3.0562 7.17938L6.1202 10.2434L12.9555 3.40738C13.0484 3.31445 13.1587 3.24073 13.28 3.19044C13.4014 3.14014 13.5315 3.11426 13.6629 3.11426C13.7942 3.11426 13.9243 3.14014 14.0457 3.19044C14.1671 3.24073 14.2773 3.31445 14.3702 3.40738Z"
                        fill="#565656"
                      />
                    </svg>
                    임시저장
                  </button>
                  <button
                    type="button"
                    className={styles.btnSubmit}
                    onClick={handleSubmit}
                    disabled={saving || loading}
                  >
                    <svg
                      className={styles.btnIcon}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M1.4033 7.10263H12.3215L8.27595 3.24975C7.90793 2.89925 7.90793 2.33113 8.27595 1.98064C8.64397 1.63015 9.2405 1.63015 9.60851 1.98064L15.2627 7.36557L15.3271 7.43393C15.629 7.78644 15.6077 8.30609 15.2627 8.63467L9.60851 14.0196C9.2405 14.3701 8.64397 14.3701 8.27595 14.0196C7.90793 13.6691 7.90793 13.101 8.27595 12.7505L12.3215 8.89761L1.4033 8.89761C0.882849 8.89761 0.460937 8.49579 0.460938 8.00012C0.460938 7.50445 0.882849 7.10263 1.4033 7.10263Z"
                        fill="white"
                      />
                    </svg>
                    제출하기
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 학사팀 — 이번주 목표 설정 모달 */}
      {goalModalOpen && (
        <div
          className={styles.goalModalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeGoalModal();
          }}
        >
          <div className={styles.goalModal}>
            <div className={styles.goalModalHeader}>
              <h3 className={styles.goalModalTitle}>이번주 목표 설정</h3>
              <button
                type="button"
                className={styles.goalModalClose}
                onClick={closeGoalModal}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <div className={styles.goalModalBody}>
              {tempGoals.length === 0 ? (
                <div className={styles.goalModalEmpty}>
                  추가된 목표가 없습니다. 아래 &quot;+ 목표 추가&quot;
                  버튼으로 시작하세요.
                </div>
              ) : (
                tempGoals.map((g, i) => {
                  const isUndefined = g.date === "미정";
                  const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(g.date);
                  return (
                    <div key={g.id} className={styles.goalModalRow}>
                      <span className={styles.goalModalRowIndex}>{i + 1}</span>
                      <input
                        type="date"
                        className={styles.goalModalDateInput}
                        // YYYY-MM-DD 만 input[type=date] 가 받음
                        value={isIsoDate ? g.date : ""}
                        onChange={(e) =>
                          updateTempGoal(g.id, { date: e.target.value })
                        }
                        disabled={isUndefined}
                      />
                      <button
                        type="button"
                        className={`${styles.goalModalUndefinedBtn} ${isUndefined ? styles.goalModalUndefinedBtnOn : ""}`}
                        onClick={() =>
                          updateTempGoal(g.id, {
                            date: isUndefined ? "" : "미정",
                          })
                        }
                        title="날짜 미정"
                      >
                        미정
                      </button>
                      <input
                        type="text"
                        className={styles.goalModalTextInput}
                        placeholder="목표 내용"
                        value={g.text}
                        onChange={(e) =>
                          updateTempGoal(g.id, { text: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        className={styles.goalModalRowRemove}
                        onClick={() => removeTempGoal(g.id)}
                        aria-label="삭제"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              )}

              <button
                type="button"
                className={styles.goalModalAddBtn}
                onClick={addTempGoal}
              >
                <Plus size={14} /> 목표 추가
              </button>
            </div>

            <div className={styles.goalModalFooter}>
              <button
                type="button"
                className={styles.goalModalCancel}
                onClick={closeGoalModal}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.goalModalSave}
                onClick={saveGoalModal}
                disabled={goalSaving}
              >
                {goalSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
