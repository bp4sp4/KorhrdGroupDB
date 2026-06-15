"use client";

import {
  type Dispatch,
  type SetStateAction,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Search, HelpCircle } from "lucide-react";
import { DateInput } from "@/components/ui/Calendar/DateInput";
import { DateRangeCalendar, type DateRange } from "@/components/DateRangeCalendar";
import styles from "./page.module.css";

// ─── 타입 ──────────────────────────────────────────────────────────
export interface Applicant {
  id: number;
  category: string;
  seq_no: number | null;
  name: string;
  contact: string | null;
  birth_date: string | null;
  address: string | null;
  desired_date: string | null;
  practice_type: string | null;
  desired_weekday: string | null;
  recognition_period: string | null;
  training_center: string | null;
  field_institution: string | null;
  status: string;
  counsel_content: string | null;
  certifications: string | null;
  amount: number | null;
  manager: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = ["입금완료", "확인필요", "추후진행예정", "재연계"] as const;

const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  입금완료: { background: "#E7F7EE", color: "#1A9E5E" },
  확인필요: { background: "#F2EAFE", color: "#8B5CF6" },
  추후진행예정: { background: "#FFF6E5", color: "#C77700" },
  재연계: { background: "#EAF2FF", color: "#2563EB" },
};

// 카테고리 (저장값 key → 표시 label) — 페이지 간 이동(완료/환불 처리)용
export const CATEGORIES: { key: string; label: string }[] = [
  { key: "타과정", label: "타과정 실습" },
  { key: "사회복지사", label: "사회복지사 실습" },
  { key: "완료", label: "실습 완료 건" },
  { key: "환불", label: "실습 환불 건" },
];

// 실습종류 (첨부 양식 기준)
const PRACTICE_TYPE_OPTIONS = [
  "사회복지사 실습 160시간",
  "사회복지사 실습 120시간",
  "보육교사 실습 240시간",
  "평생교육사 실습 160시간",
  "한국어교원 실습",
];
const WEEKDAY_OPTIONS = ["평일", "주말", "평일+주말"];

// 연락처 자동 하이픈 (010-XXXX-XXXX)
function formatPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// created_at(ISO) → KST 기준 'YYYY-MM-DD' (기간 필터용)
function createdKstDate(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const k = new Date(t.getTime() + 9 * 60 * 60 * 1000);
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, "0")}-${String(k.getUTCDate()).padStart(2, "0")}`;
}

function fmtAmount(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${v.toLocaleString("ko-KR")}원`;
}

const PAGE_SIZE = 10;

// 신규 추가용 빈 행 (id 0 = 신규)
function blankApplicant(category: string): Applicant {
  return {
    id: 0,
    category,
    seq_no: null,
    name: "",
    contact: null,
    birth_date: null,
    address: null,
    desired_date: null,
    practice_type: null,
    desired_weekday: null,
    recognition_period: null,
    training_center: null,
    field_institution: null,
    status: "추후진행예정",
    counsel_content: null,
    certifications: null,
    amount: 33000,
    manager: null,
    created_at: "",
    updated_at: "",
  };
}

export default function ApplicantsView({
  category,
  title,
}: {
  category: string;
  title: string;
}) {
  const [rows, setRows] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [fWeekday, setFWeekday] = useState<string[]>([]);
  const [fCenter, setFCenter] = useState<string[]>([]);
  const [fStatus, setFStatus] = useState<string[]>([]);
  const [fAmount, setFAmount] = useState<string[]>([]);
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [filterPos, setFilterPos] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [editing, setEditing] = useState<Applicant | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/practice-applicants?category=${encodeURIComponent(category)}`,
      );
      const d = await res.json();
      if (res.ok) setRows(d.rows ?? []);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [category]);

  const toggleOne = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // 다중 삭제
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}건을 삭제할까요?`)) return;
    const ids = [...selectedIds];
    const res = await fetch(`/api/practice-applicants?ids=${ids.join(",")}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "삭제 실패");
    }
  };

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // 헤더 필터 드롭다운 — 바깥 클릭 시 닫기
  useEffect(() => {
    if (!openFilter) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenFilter(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openFilter]);

  // 기간 선택 팝오버 — 바깥 클릭 닫기
  useEffect(() => {
    if (!dateOpen) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) {
        setDateOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [dateOpen]);

  const openCol = (e: ReactMouseEvent<HTMLButtonElement>, key: string) => {
    e.stopPropagation();
    if (openFilter === key) {
      setOpenFilter(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setFilterPos({ top: rect.bottom + 4, left: rect.left });
    setOpenFilter(key);
  };

  // 필터 옵션 (facet)
  const facets = useMemo(() => {
    const wk = new Set<string>();
    const ce = new Set<string>();
    const am = new Set<string>();
    let hasNullAmount = false;
    for (const r of rows) {
      if (r.desired_weekday) wk.add(r.desired_weekday);
      if (r.training_center) ce.add(r.training_center);
      if (r.amount === null || r.amount === undefined) hasNullAmount = true;
      else am.add(String(r.amount));
    }
    return {
      weekday: [...wk].sort((a, b) => a.localeCompare(b, "ko")),
      center: [...ce].sort((a, b) => a.localeCompare(b, "ko")),
      amount: [...am].sort((a, b) => Number(a) - Number(b)),
      hasNullAmount,
    };
  }, [rows]);

  // 검색 + 헤더 필터(다중선택)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (fStatus.length && !fStatus.includes(r.status)) return false;
      if (
        fWeekday.length &&
        !(r.desired_weekday && fWeekday.includes(r.desired_weekday))
      )
        return false;
      if (
        fCenter.length &&
        !(r.training_center && fCenter.includes(r.training_center))
      )
        return false;
      if (fAmount.length) {
        const av =
          r.amount === null || r.amount === undefined
            ? "__null__"
            : String(r.amount);
        if (!fAmount.includes(av)) return false;
      }
      if (dateFrom || dateTo) {
        const cd = createdKstDate(r.created_at);
        if (dateFrom && cd < dateFrom) return false;
        if (dateTo && cd > dateTo) return false;
      }
      if (!q) return true;
      const hay = [
        r.name,
        r.contact,
        r.field_institution,
        r.training_center,
        r.practice_type,
        r.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, fStatus, fWeekday, fCenter, fAmount, dateFrom, dateTo]);

  // 페이징
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    setPage(1);
  }, [query, fStatus, fWeekday, fCenter, fAmount, dateFrom, dateTo]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );
  const pageWindow = useMemo(() => {
    const win = 5;
    let start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + win - 1);
    start = Math.max(1, end - win + 1);
    const arr: number[] = [];
    for (let n = start; n <= end; n++) arr.push(n);
    return arr;
  }, [page, totalPages]);

  const allPagedSelected =
    paged.length > 0 && paged.every((r) => selectedIds.has(r.id));
  const toggleAllPaged = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPagedSelected) paged.forEach((r) => next.delete(r.id));
      else paged.forEach((r) => next.add(r.id));
      return next;
    });

  // 상태 빠른 변경
  const handleStatusChange = async (id: number, status: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    const res = await fetch("/api/practice-applicants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, patch: { status } }),
    });
    if (!res.ok) {
      await fetchRows();
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "상태 변경 실패");
    }
  };

  // 상세 저장(수정) / 신규 추가(id 0). 카테고리가 바뀌면 현재 페이지에서 제거
  const handleSave = async (id: number, patch: Partial<Applicant>) => {
    const isNew = id === 0;
    const res = await fetch("/api/practice-applicants", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? { patch } : { id, patch }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(d.error ?? "저장 실패");
      return false;
    }
    const saved = d.row as Applicant;
    setRows((prev) => {
      if (isNew) {
        return saved.category === category ? [saved, ...prev] : prev;
      }
      return saved.category !== category
        ? prev.filter((r) => r.id !== id)
        : prev.map((r) => (r.id === id ? saved : r));
    });
    return true;
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 신청자를 삭제할까요?")) return;
    const res = await fetch(`/api/practice-applicants?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      setEditing(null);
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "삭제 실패");
    }
  };

  return (
    <div className={styles.wrap}>
      {/* 헤더 */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{title}</h1>
          <span className={styles.subtitle}>
            전체 {rows.length}건
            {filtered.length !== rows.length && ` · 검색결과 ${filtered.length}건`}
          </span>
        </div>
      </div>

      {/* 검색/필터 바 (문의 DB 스타일) */}
      <div className={styles.filterRow}>
        <div className={styles.searchWrap}>
          <Search className={styles.searchIcon} size={16} />
          <input
            className={styles.searchInput}
            placeholder="이름, 연락처, 기관, 상담내용 검색..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div ref={dateRef} className={styles.dateRangeWrap}>
          <button
            type="button"
            className={styles.dateRangeBtn}
            onClick={() => setDateOpen((v) => !v)}
          >
            {dateFrom && dateTo
              ? `${dateFrom.replace(/-/g, ".")} ~ ${dateTo.replace(/-/g, ".")}`
              : "기간 선택"}
          </button>
          {dateOpen && (
            <div className={styles.dateRangePopover}>
              <DateRangeCalendar
                variant="quarter"
                value={{
                  from: dateFrom ? new Date(dateFrom) : undefined,
                  to: dateTo ? new Date(dateTo) : undefined,
                }}
                onChange={(r) => {
                  setDateFrom(r?.from ? ymd(r.from) : "");
                  setDateTo(r?.to ? ymd(r.to) : "");
                }}
                onConfirm={() => setDateOpen(false)}
                onReset={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              />
            </div>
          )}
        </div>

        <button
          type="button"
          className={styles.guideBtn}
          onClick={() => setGuideOpen(true)}
          title="실습신청자 사용법 보기"
        >
          <HelpCircle size={15} />
          <span>가이드</span>
        </button>

        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setEditing(blankApplicant(category))}
        >
          + 신청자 추가
        </button>
      </div>

      {/* 다중 선택 액션 바 */}
      {selectedIds.size > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selectedIds.size}건 선택됨</span>
          <button
            type="button"
            className={styles.bulkDeleteBtn}
            onClick={handleBulkDelete}
          >
            선택 삭제
          </button>
          <button
            type="button"
            className={styles.bulkClearBtn}
            onClick={() => setSelectedIds(new Set())}
          >
            선택 해제
          </button>
        </div>
      )}

      {/* 테이블 */}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.checkCol}>
                <input
                  type="checkbox"
                  checked={allPagedSelected}
                  onChange={toggleAllPaged}
                />
              </th>
              <th>번호</th>
              <th>이름</th>
              <th>연락처</th>
              <th>생년월일</th>
              <th>주소</th>
              <th>희망날짜</th>
              <th>실습종류</th>
              <th>
                <span className={styles.thInner}>
                  희망요일
                  <FilterBtn
                    active={fWeekday.length > 0}
                    onClick={(e) => openCol(e, "weekday")}
                  />
                </span>
              </th>
              <th>인정기간</th>
              <th>
                <span className={styles.thInner}>
                  실습교육원
                  <FilterBtn
                    active={fCenter.length > 0}
                    onClick={(e) => openCol(e, "center")}
                  />
                </span>
              </th>
              <th>현장실습기관</th>
              <th>
                <span className={styles.thInner}>
                  상태
                  <FilterBtn
                    active={fStatus.length > 0}
                    onClick={(e) => openCol(e, "status")}
                  />
                </span>
              </th>
              <th>
                <span className={styles.thInner}>
                  결제금액
                  <FilterBtn
                    active={fAmount.length > 0}
                    onClick={(e) => openCol(e, "amount")}
                  />
                </span>
              </th>
              <th>보유자격증</th>
              <th>상담내용</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={16} className={styles.empty}>
                  불러오는 중…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={16} className={styles.empty}>
                  데이터가 없습니다.
                </td>
              </tr>
            ) : (
              paged.map((r, i) => (
                <tr
                  key={r.id}
                  className={styles.row}
                  onClick={() => setEditing(r)}
                >
                  <td
                    className={styles.checkCol}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                    />
                  </td>
                  <td className={styles.cellNum}>
                    {r.seq_no ?? (page - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td className={styles.cellName} title={r.name}>
                    {r.name}
                  </td>
                  <td title={r.contact ?? ""}>{r.contact ?? "—"}</td>
                  <td title={r.birth_date ?? ""}>{r.birth_date ?? "—"}</td>
                  <td title={r.address ?? ""}>{r.address ?? "—"}</td>
                  <td title={r.desired_date ?? ""}>{r.desired_date ?? "—"}</td>
                  <td title={r.practice_type ?? ""}>{r.practice_type ?? "—"}</td>
                  <td title={r.desired_weekday ?? ""}>
                    {r.desired_weekday ?? "—"}
                  </td>
                  <td title={r.recognition_period ?? ""}>
                    {r.recognition_period ?? "—"}
                  </td>
                  <td title={r.training_center ?? ""}>
                    {r.training_center ?? "—"}
                  </td>
                  <td title={r.field_institution ?? ""}>
                    {r.field_institution ?? "—"}
                  </td>
                  <td
                    className={styles.cellStatus}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      className={styles.statusSelect}
                      value={r.status}
                      style={{
                        background: STATUS_STYLE[r.status]?.background,
                        color: STATUS_STYLE[r.status]?.color,
                      }}
                      onChange={(e) => handleStatusChange(r.id, e.target.value)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={styles.cellAmount}>{fmtAmount(r.amount)}</td>
                  <td title={r.certifications ?? ""}>
                    {r.certifications ?? "—"}
                  </td>
                  <td title={r.counsel_content ?? ""}>
                    {r.counsel_content ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이징 */}
      {!loading && totalPages > 1 && (
        <div className={styles.pager}>
          <button
            type="button"
            className={styles.pagerBtn}
            disabled={page === 1}
            onClick={() => setPage(1)}
          >
            «
          </button>
          <button
            type="button"
            className={styles.pagerBtn}
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            이전
          </button>
          {pageWindow.map((n) => (
            <button
              key={n}
              type="button"
              className={`${styles.pagerBtn} ${n === page ? styles.pagerBtnActive : ""}`}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className={styles.pagerBtn}
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            다음
          </button>
          <button
            type="button"
            className={styles.pagerBtn}
            disabled={page === totalPages}
            onClick={() => setPage(totalPages)}
          >
            »
          </button>
          <span className={styles.pagerInfo}>
            {page} / {totalPages}
          </span>
        </div>
      )}

      {/* 헤더 필터 드롭다운 패널 */}
      {openFilter && (
        <div
          ref={dropdownRef}
          className={styles.filterColumnDropdown}
          style={{ top: filterPos.top, left: filterPos.left }}
        >
          <FilterMenu
            selected={
              openFilter === "weekday"
                ? fWeekday
                : openFilter === "center"
                  ? fCenter
                  : openFilter === "status"
                    ? fStatus
                    : fAmount
            }
            setSelected={
              openFilter === "weekday"
                ? setFWeekday
                : openFilter === "center"
                  ? setFCenter
                  : openFilter === "status"
                    ? setFStatus
                    : setFAmount
            }
            options={
              openFilter === "weekday"
                ? facets.weekday.map((v) => ({ value: v, label: v }))
                : openFilter === "center"
                  ? facets.center.map((v) => ({ value: v, label: v }))
                  : openFilter === "status"
                    ? STATUS_OPTIONS.map((v) => ({ value: v, label: v }))
                    : [
                        ...facets.amount.map((v) => ({
                          value: v,
                          label: `${Number(v).toLocaleString("ko-KR")}원`,
                        })),
                        ...(facets.hasNullAmount
                          ? [{ value: "__null__", label: "미입력" }]
                          : []),
                      ]
            }
          />
        </div>
      )}

      {guideOpen && (
        <div className={styles.overlay} onClick={() => setGuideOpen(false)}>
          <div
            className={styles.guideModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <h2>실습신청자 사용법</h2>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setGuideOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className={styles.guideBody}>
              <ul>
                <li>
                  <b>검색</b> · 이름·연락처·기관·상담내용으로 즉시 검색
                </li>
                <li>
                  <b>기간 선택</b> · 등록(추가)일 기준 기간 필터
                </li>
                <li>
                  <b>헤더 필터</b> · 희망요일·실습교육원·상태·결제금액 컬럼 헤더의 ▼
                  버튼으로 다중 선택
                </li>
                <li>
                  <b>상태 변경</b> · 표 안 드롭다운에서 바로 변경
                  (입금완료/확인필요/추후진행예정/재연계)
                </li>
                <li>
                  <b>행 클릭</b> 상세 보기·편집, <b>+ 신청자 추가</b>로 신규 등록
                </li>
                <li>
                  <b>구분 이동</b> · 상세에서 구분을 바꾸면 해당
                  페이지(타과정/사회복지사/완료/환불)로 이동
                </li>
              </ul>
            </div>
            <div className={styles.modalFoot}>
              <span />
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => setGuideOpen(false)}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <DetailModal
          row={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ─── 헤더 필터 버튼/메뉴 ─────────────────────────────────────────────
function FilterBtn({
  active,
  onClick,
}: {
  active: boolean;
  onClick: (e: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.thFilterBtn} ${active ? styles.thFilterBtnActive : ""}`}
      onClick={onClick}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path
          d="M2 3.5L5 6.5L8 3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function FilterMenu({
  selected,
  setSelected,
  options,
}: {
  selected: string[];
  setSelected: Dispatch<SetStateAction<string[]>>;
  options: { value: string; label: string }[];
}) {
  return (
    <>
      <div
        className={`${styles.filterDropdownItem} ${selected.length === 0 ? styles.filterDropdownItemActive : ""}`}
        onClick={() => setSelected([])}
      >
        전체
      </div>
      {options.map((o) => (
        <div
          key={o.value}
          className={`${styles.filterDropdownItem} ${selected.includes(o.value) ? styles.filterDropdownItemActive : ""}`}
          onClick={() =>
            setSelected((prev) =>
              prev.includes(o.value)
                ? prev.filter((x) => x !== o.value)
                : [...prev, o.value],
            )
          }
        >
          {o.label}
        </div>
      ))}
    </>
  );
}

// ─── 인정기간 (기간 선택 — DateRangeCalendar 팝오버) ───────────────────
function RangeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const wrapRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo<DateRange | undefined>(() => {
    const m = value.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
    if (!m) return undefined;
    return { from: new Date(m[1]), to: new Date(m[2]) };
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = () => {
    if (!open && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        left: Math.min(rect.left, window.innerWidth - 680),
      });
    }
    setOpen((v) => !v);
  };

  const display = parsed?.from
    ? `${parsed.from ? ymd(parsed.from).replace(/-/g, ".") : ""} ~ ${parsed.to ? ymd(parsed.to).replace(/-/g, ".") : ""}`
    : "";

  return (
    <div ref={wrapRef} className={styles.rangeWrap}>
      <button
        type="button"
        className={`${styles.rangeTrigger} ${!display ? styles.rangePlaceholder : ""}`}
        onClick={toggle}
      >
        {display || "기간 선택"}
      </button>
      {open && (
        <div
          className={styles.rangePopover}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
        >
          <DateRangeCalendar
            value={parsed}
            maxRangeMonths={24}
            onConfirm={(range) => {
              if (range?.from && range?.to) {
                onChange(`${ymd(range.from)} ~ ${ymd(range.to)}`);
              }
              setOpen(false);
            }}
            onReset={() => {
              onChange("");
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── 상세/편집 모달 ─────────────────────────────────────────────────
function DetailModal({
  row,
  onClose,
  onSave,
  onDelete,
}: {
  row: Applicant;
  onClose: () => void;
  onSave: (id: number, patch: Partial<Applicant>) => Promise<boolean>;
  onDelete: (id: number) => void;
}) {
  const [form, setForm] = useState<Applicant>(row);
  const [saving, setSaving] = useState(false);
  const isNew = row.id === 0;

  const set = (key: keyof Applicant, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setSaving(true);
    try {
      const patch: Partial<Applicant> = {
        category: form.category,
        name: form.name,
        contact: form.contact,
        birth_date: form.birth_date,
        address: form.address,
        desired_date: form.desired_date,
        practice_type: form.practice_type,
        desired_weekday: form.desired_weekday,
        recognition_period: form.recognition_period,
        training_center: form.training_center,
        field_institution: form.field_institution,
        manager: form.manager,
        status: form.status,
        amount:
          form.amount === null || (form.amount as unknown as string) === ""
            ? null
            : Number(form.amount),
        certifications: form.certifications,
        counsel_content: form.counsel_content,
      };
      const ok = await onSave(row.id, patch);
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2>{isNew ? "신청자 추가" : `${form.name || "실습신청자"} 상세`}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.grid}>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>구분</span>
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>이름</span>
              <input
                value={form.name ?? ""}
                onChange={(e) => set("name", e.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>연락처</span>
              <input
                value={form.contact ?? ""}
                placeholder="010-0000-0000"
                inputMode="numeric"
                onChange={(e) => set("contact", formatPhone(e.target.value))}
              />
            </label>

            <label className={styles.field}>
              <span>생년월일</span>
              <input
                value={form.birth_date ?? ""}
                onChange={(e) => set("birth_date", e.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>주소</span>
              <input
                value={form.address ?? ""}
                onChange={(e) => set("address", e.target.value)}
              />
            </label>

            <div className={styles.field}>
              <span>희망날짜</span>
              <DateInput
                value={form.desired_date ?? ""}
                onChange={(v) => set("desired_date", v)}
                placeholder="날짜 선택"
                className={styles.dateWrap}
                triggerClassName={styles.dateTrigger}
              />
            </div>

            <label className={styles.field}>
              <span>실습종류</span>
              <select
                value={form.practice_type ?? ""}
                onChange={(e) => set("practice_type", e.target.value)}
              >
                <option value="">선택하세요</option>
                {PRACTICE_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
                {form.practice_type &&
                  !PRACTICE_TYPE_OPTIONS.includes(form.practice_type) && (
                    <option value={form.practice_type}>
                      {form.practice_type}
                    </option>
                  )}
              </select>
            </label>

            <label className={styles.field}>
              <span>희망요일</span>
              <select
                value={form.desired_weekday ?? ""}
                onChange={(e) => set("desired_weekday", e.target.value)}
              >
                <option value="">선택하세요</option>
                {WEEKDAY_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
                {form.desired_weekday &&
                  !WEEKDAY_OPTIONS.includes(form.desired_weekday) && (
                    <option value={form.desired_weekday}>
                      {form.desired_weekday}
                    </option>
                  )}
              </select>
            </label>

            <div className={styles.field}>
              <span>인정기간</span>
              <RangeField
                value={form.recognition_period ?? ""}
                onChange={(v) => set("recognition_period", v)}
              />
            </div>

            <label className={styles.field}>
              <span>실습교육원</span>
              <input
                value={form.training_center ?? ""}
                onChange={(e) => set("training_center", e.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>현장실습기관</span>
              <input
                value={form.field_institution ?? ""}
                onChange={(e) => set("field_institution", e.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>담당자</span>
              <input
                value={form.manager ?? ""}
                onChange={(e) => set("manager", e.target.value)}
              />
            </label>

            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span>보유 자격증</span>
              <input
                value={form.certifications ?? ""}
                onChange={(e) => set("certifications", e.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>상태</span>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>결제금액</span>
              <input
                type="number"
                value={form.amount ?? ""}
                onChange={(e) => set("amount", e.target.value)}
              />
            </label>
          </div>

          <label className={`${styles.field} ${styles.fieldFull}`}>
            <span>상담내용</span>
            <textarea
              rows={5}
              value={form.counsel_content ?? ""}
              onChange={(e) => set("counsel_content", e.target.value)}
            />
          </label>
        </div>

        <div className={styles.modalFoot}>
          {isNew ? (
            <span />
          ) : (
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => onDelete(row.id)}
            >
              삭제
            </button>
          )}
          <div className={styles.footRight}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              취소
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={submit}
              disabled={saving}
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
