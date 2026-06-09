"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronRight, ChevronsRight, X } from "lucide-react";
import styles from "./page.module.css";
import {
  DateRangeCalendar,
  type DateRange,
} from "@/components/DateRangeCalendar";

// ─────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────
interface Journal {
  id: number;
  date: string;
  tasks: unknown;
  morning: unknown;
  afternoon: unknown;
  tomorrow: unknown;
  weekly_goal: unknown;
  issues: unknown;
  practicum: unknown;
  status: "draft" | "submitted" | null;
  submitted_at: string | null;
  updated_at: string | null;
  inquiries: number;
  registrations: number;
  registrationRate: number;
  sales: number;
}

interface JournalRow {
  category: string;
  detail: string;
}

interface TaskItem {
  text: string;
  done: boolean;
}

const PAGE_SIZE = 10;

// ─────────────────────────────────────────────────────────────
// 정규화 유틸 (work_journals jsonb → 표시용)
// ─────────────────────────────────────────────────────────────
function toJournalRows(v: unknown): JournalRow[] {
  if (v == null) return [];
  if (typeof v === "string") {
    return v
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => ({ category: "", detail: s }));
  }
  if (!Array.isArray(v)) return [];
  return v
    .map((it): JournalRow | null => {
      if (it == null) return null;
      if (typeof it === "string") return { category: "", detail: it };
      if (typeof it === "object") {
        const o = it as Record<string, unknown>;
        const category =
          typeof o.category === "string" ? o.category.trim() : "";
        const detail =
          typeof o.detail === "string"
            ? o.detail.trim()
            : typeof o.text === "string"
              ? o.text.trim()
              : "";
        if (!category && !detail) return null;
        return { category, detail };
      }
      return null;
    })
    .filter((r): r is JournalRow => r !== null);
}

function toTasks(v: unknown): TaskItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((it): TaskItem | null => {
      if (!it || typeof it !== "object") return null;
      const o = it as Record<string, unknown>;
      const text = typeof o.text === "string" ? o.text.trim() : "";
      if (!text) return null;
      return { text, done: Boolean(o.done) };
    })
    .filter((t): t is TaskItem => t !== null);
}

function toLines(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === "string") {
    return v
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(v)) return [];
  return v
    .map((it) => {
      if (typeof it === "string") return it.trim();
      if (it && typeof it === "object") {
        const o = it as Record<string, unknown>;
        return (
          (typeof o.text === "string" ? o.text : null) ??
          (typeof o.detail === "string" ? o.detail : null) ??
          ""
        ).trim();
      }
      return "";
    })
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
// 날짜 / 상태 유틸
// ─────────────────────────────────────────────────────────────
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 26.06.20 형태
function formatShort(date: string): string {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return `${y.slice(2)}.${m}.${d}`;
}

// 2026.06.20 (금) 형태
function formatLong(date: string): string {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  const wk = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")} (${wk})`;
}

function statusBadge(status: Journal["status"]) {
  if (status === "submitted")
    return { label: "제출 완료", cls: styles.badgeSubmitted };
  if (status === "draft") return { label: "임시저장", cls: styles.badgeDraft };
  return { label: "미작성", cls: styles.badgeNone };
}

// ─────────────────────────────────────────────────────────────
// 페이지
// ─────────────────────────────────────────────────────────────
export default function WorkJournalArchivePage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Journal | null>(null);
  const [page, setPage] = useState(1);

  // 기본: 최근 30일
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return ymd(d);
  });
  const [endDate, setEndDate] = useState<string>(() => ymd(new Date()));
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const dateRangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dateRangeOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dateRangeRef.current &&
        !dateRangeRef.current.contains(e.target as Node)
      ) {
        setDateRangeOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dateRangeOpen]);

  const dateRangeValue: DateRange | undefined =
    startDate || endDate
      ? {
          from: startDate ? new Date(startDate + "T00:00:00") : undefined,
          to: endDate ? new Date(endDate + "T00:00:00") : undefined,
        }
      : undefined;

  const dateRangeLabel =
    startDate && endDate
      ? `${startDate} ~ ${endDate}`
      : startDate
        ? `${startDate} ~`
        : endDate
          ? `~ ${endDate}`
          : "전체 기간";

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("from", startDate);
      if (endDate) params.set("to", endDate);
      const res = await fetch(
        `/api/work-journal/my-list?${params.toString()}`,
        {
          cache: "no-store",
        },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "작업일지를 불러오지 못했습니다.");
      }
      const data = await res.json();
      setJournals(Array.isArray(data.journals) ? data.journals : []);
      setPage(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const totalPages = Math.max(1, Math.ceil(journals.length / PAGE_SIZE));
  const pageRows = journals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // 표시할 페이지 번호 (현재 기준 최대 5개)
  const pageNumbers = useMemo(() => {
    const max = 5;
    let start = Math.max(1, page - Math.floor(max / 2));
    const end = Math.min(totalPages, start + max - 1);
    start = Math.max(1, end - max + 1);
    const arr: number[] = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [page, totalPages]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* 헤더 */}
        <div className={styles.cardHead}>
          <h1 className={styles.title}>업무일지 모음</h1>
          <div ref={dateRangeRef} className={styles.dateRangeWrap}>
            <button
              type="button"
              className={styles.dateRangeBtn}
              onClick={() => setDateRangeOpen((v) => !v)}
            >
              <CalendarDays size={15} />
              <span>{dateRangeLabel}</span>
            </button>
            {dateRangeOpen && (
              <div className={styles.dateRangePopover}>
                <DateRangeCalendar
                  variant="month"
                  value={dateRangeValue}
                  onChange={(r) => {
                    setStartDate(r?.from ? ymd(r.from) : "");
                    setEndDate(r?.to ? ymd(r.to) : "");
                  }}
                  onConfirm={() => setDateRangeOpen(false)}
                  onReset={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        {/* 표 */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thDate}>날짜</th>
                <th>등록 건수</th>
                <th>등록률</th>
                <th>매출</th>
                <th>업무일지 상태</th>
                <th>업무일지</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className={styles.tdState}>
                    불러오는 중...
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.tdState}>
                    선택한 기간에 작성된 업무일지가 없습니다.
                  </td>
                </tr>
              ) : (
                pageRows.map((j) => {
                  const badge = statusBadge(j.status);
                  return (
                    <tr key={j.id}>
                      <td className={styles.tdDate}>{formatShort(j.date)}</td>
                      <td className={styles.tdNum}>
                        {j.registrations.toLocaleString()}
                      </td>
                      <td className={styles.tdNum}>
                        {j.registrationRate.toFixed(1)}%
                      </td>
                      <td className={styles.tdNum}>
                        {Math.round(j.sales / 10000).toLocaleString()}만원
                      </td>
                      <td className={styles.tdCenter}>
                        <span className={`${styles.badge} ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className={styles.tdCenter}>
                        <button
                          type="button"
                          className={styles.viewBtn}
                          onClick={() => setSelected(j)}
                        >
                          보기
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {!loading && totalPages > 1 && (
          <div className={styles.pagination}>
            {pageNumbers.map((n) => (
              <button
                key={n}
                type="button"
                className={`${styles.pageBtn} ${n === page ? styles.pageBtnActive : ""}`}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className={styles.pageNavBtn}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="다음"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className={styles.pageNavBtn}
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              aria-label="마지막"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        )}
      </div>

      {selected && (
        <JournalViewer journal={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 읽기 전용 보기 모달 (워크스페이스 모음 전용 — 좌측 내용만, 통계 없음)
// ─────────────────────────────────────────────────────────────
function JournalViewer({
  journal,
  onClose,
}: {
  journal: Journal;
  onClose: () => void;
}) {
  const tasks = useMemo(() => toTasks(journal.tasks), [journal.tasks]);
  const morning = useMemo(
    () => toJournalRows(journal.morning),
    [journal.morning],
  );
  const afternoon = useMemo(
    () => toJournalRows(journal.afternoon),
    [journal.afternoon],
  );
  const tomorrow = useMemo(() => toLines(journal.tomorrow), [journal.tomorrow]);
  const issues = useMemo(() => toJournalRows(journal.issues), [journal.issues]);

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <span className={styles.modalDate}>{formatLong(journal.date)}</span>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <ViewerTasks title="오늘의 업무" tasks={tasks} />
          <ViewerRows title="오전 업무" rows={morning} />
          <ViewerRows title="오후 업무" rows={afternoon} />
          <ViewerLines title="내일 예정 업무" items={tomorrow} ordered />
          {issues.length > 0 && (
            <ViewerRows title="이슈 및 조치사항" rows={issues} />
          )}
        </div>
      </div>
    </div>
  );
}

function ViewerTasks({ title, tasks }: { title: string; tasks: TaskItem[] }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      {tasks.length === 0 ? (
        <div className={styles.sectionEmpty}>입력된 내용이 없습니다.</div>
      ) : (
        <ul className={styles.taskList}>
          {tasks.map((t, i) => (
            <li
              key={i}
              className={`${styles.taskItem} ${t.done ? styles.taskItemDone : ""}`}
            >
              <span className={styles.taskCheck}>{t.done ? "✓" : ""}</span>
              <span className={styles.taskText}>{t.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ViewerRows({ title, rows }: { title: string; rows: JournalRow[] }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      {rows.length === 0 ? (
        <div className={styles.sectionEmpty}>입력된 내용이 없습니다.</div>
      ) : (
        <ul className={styles.rowList}>
          {rows.map((r, i) => (
            <li key={i} className={styles.rowItem}>
              <span className={styles.rowBullet}>•</span>
              {r.category && (
                <span className={styles.rowCategory}>{r.category}</span>
              )}
              {r.detail && <span className={styles.rowDetail}>{r.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ViewerLines({
  title,
  items,
  ordered,
}: {
  title: string;
  items: string[];
  ordered?: boolean;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
      {items.length === 0 ? (
        <div className={styles.sectionEmpty}>입력된 내용이 없습니다.</div>
      ) : (
        <ol className={styles.rowList}>
          {items.map((it, i) => (
            <li key={i} className={styles.rowItem}>
              <span className={styles.rowBullet}>
                {ordered ? `${i + 1}.` : "•"}
              </span>
              <span className={styles.rowDetail}>{it}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
