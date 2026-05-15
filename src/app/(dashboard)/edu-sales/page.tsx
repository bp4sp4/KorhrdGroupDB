"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import styles from "./page.module.css";
import CustomSelect from "../marketing/CustomSelect";
import { DateInput } from "@/components/ui/Calendar/DateInput";

// ─── 타입 ─────────────────────────────────────────────────────────────
type PaymentMethod = "payapp_transfer" | "bank_transfer" | "card";

type RefundStatus = "정상" | "환불대기" | "환불완료";

// API GET 응답 — 학생 + 매출 머지된 행
interface SalesRow {
  student_id: string | null;
  sale_id: string | null;
  student_name: string;
  phone: string | null;
  manager_name: string | null;
  class_start: string | null;
  course_name: string | null;
  // 매출 (sale이 없으면 null/false)
  cohort: string | null;
  student_username: string | null;
  unit_price: number | null;
  total_amount: number | null;
  payment_method: PaymentMethod | null;
  payment_date: string | null;
  subject_count: number | null;
  notes: string | null;
  process_number: string | null;
  issue_date: string | null;
  is_published: boolean;
  refund_status: RefundStatus;
  refund_date: string | null;
  created_at: string;
}


const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "payapp_transfer", label: "페이앱 계좌이체" },
  { value: "bank_transfer", label: "계좌이체" },
  { value: "card", label: "카드결제" },
];

// ─── 한국시간(KST) 헬퍼 ────────────────────────────────────────────────
function kstNow(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}
function defaultCohort(): string {
  const d = kstNow();
  return `${d.getMonth() + 1}월`;
}

// 매출파일 시작 월 (2026년 2월부터)
const SALES_START_YEAR = 2026;
const SALES_START_MONTH = 2;

// 기본 월 탭 (2026.2 ~ 현재월+1)
function getDefaultMonthTabs(): string[] {
  const now = kstNow();
  const tabs: string[] = [];
  let year = SALES_START_YEAR;
  let month = SALES_START_MONTH;
  const endMonth = now.getMonth() + 1 + 1;
  const endYear = now.getFullYear();
  while (year < endYear || (year === endYear && month <= endMonth)) {
    tabs.push(`${month}월`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return tabs;
}

// cohort 문자열에서 정렬 키 추출
// "5월" → 5, "2026년 5월" → 202605, "2026년 5월 4일" → 20260504, "2026-05-04" → 20260504
function cohortSortKey(c: string): number {
  const trimmed = c.trim();
  // YYYY-MM-DD 형식
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return Number(y) * 10000 + Number(m) * 100 + Number(d ?? "0");
  }
  // "YYYY년 M월 D일" / "YYYY년 M월"
  const krFullMatch = trimmed.match(
    /(\d{4})년\s*(\d{1,2})월(?:\s*(\d{1,2})일)?/,
  );
  if (krFullMatch) {
    const [, y, m, d] = krFullMatch;
    return Number(y) * 10000 + Number(m) * 100 + Number(d ?? "0");
  }
  // "M월" — 단독 월만 있는 형식 (정렬 시 연도 가정 없이 월만 비교)
  const monthOnlyMatch = trimmed.match(/^(\d{1,2})월$/);
  if (monthOnlyMatch) {
    return Number(monthOnlyMatch[1]);
  }
  // 마지막 fallback: 첫 번째 숫자
  const fallback = trimmed.match(/(\d+)/);
  return fallback ? Number(fallback[1]) : 999999;
}

function formatNumber(v: number | null | string): string {
  if (v === null || v === "" || v === undefined) return "";
  const num = typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : v;
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString();
}
function formatPhone(p: string | null): string {
  if (!p) return "-";
  const digits = p.replace(/\D/g, "");
  if (digits.length === 11)
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return p;
}

// 입력 중 자동 하이픈 (010-XXXX-XXXX 형식)
function autoHyphenPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
export default function EduSalesPage() {
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [canViewAll, setCanViewAll] = useState(false);

  // 월별 탭 — API에서 받은 cohorts + 기본 탭 머지 (정렬)
  const [apiCohorts, setApiCohorts] = useState<string[]>([]);
  const monthTabs = useMemo(() => {
    const set = new Set<string>([...getDefaultMonthTabs(), ...apiCohorts]);
    return Array.from(set).sort((a, b) => cohortSortKey(a) - cohortSortKey(b));
  }, [apiCohorts]);
  const [activeMonth, setActiveMonth] = useState<string>(() => defaultCohort());

  // 필터
  const [search, setSearch] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterPublished, setFilterPublished] = useState<
    "all" | "done" | "pending"
  >("all");
  const [filterManager, setFilterManager] = useState<string>("");
  const [filterRefund, setFilterRefund] = useState<
    "all" | "정상" | "환불대기" | "환불완료"
  >("all");

  // 모달
  // (구) 매출 등록/수정 모달 — 인라인 편집으로 대체됨

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      // '전체' 탭이 아니면 월별 필터 적용
      if (activeMonth && activeMonth !== "전체")
        params.set("cohort", activeMonth);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/edu-sales?${params.toString()}`);
      if (!res.ok) {
        setRows([]);
        return;
      }
      const data = await res.json();
      setRows(data.items ?? []);
      setCanViewAll(!!data.canViewAll);
      if (Array.isArray(data.cohorts)) setApiCohorts(data.cohorts);
    } finally {
      setLoading(false);
    }
  }, [activeMonth, filterFrom, filterTo, search]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // ─── 인라인 편집: 셀 변경 즉시 저장 ─────────────────────────────────
  const updateRow = async (
    row: SalesRow,
    patch: Partial<{
      cohort: string | null;
      student_username: string | null;
      unit_price: number | null;
      total_amount: number | null;
      payment_method: PaymentMethod | null;
      payment_date: string | null;
      subject_count: number | null;
      notes: string | null;
      process_number: string | null;
      issue_date: string | null;
      is_published: boolean;
      refund_status: RefundStatus;
      refund_date: string | null;
    }>,
  ) => {
    // 낙관적 업데이트
    setRows((prev) =>
      prev.map((r) =>
        (r.sale_id ?? r.student_id) === (row.sale_id ?? row.student_id)
          ? { ...r, ...patch }
          : r,
      ),
    );
    try {
      // sale_id 있으면 직접 UPDATE, 없으면 student_id로 UPSERT
      const payload: Record<string, unknown> = row.sale_id
        ? { sale_id: row.sale_id, ...patch }
        : row.student_id
          ? { student_id: row.student_id, ...patch }
          : {
              ...patch,
              student_name: row.student_name,
              phone: row.phone,
              manager_name: row.manager_name,
            };
      const res = await fetch("/api/edu-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "저장 실패");
        await fetchRows(); // 롤백
        return;
      }
      // 새 sale_id 받아서 row에 반영
      const saved = await res.json();
      if (saved?.id && !row.sale_id) {
        setRows((prev) =>
          prev.map((r) =>
            r.student_id === row.student_id ? { ...r, sale_id: saved.id } : r,
          ),
        );
      }
    } catch {
      await fetchRows();
    }
  };

  // ─── 특이사항 팝업 ───────────────────────────────────────────────
  const [notesPopup, setNotesPopup] = useState<{
    row: SalesRow;
    value: string;
  } | null>(null);
  const openNotes = (row: SalesRow) => {
    setNotesPopup({ row, value: row.notes ?? "" });
  };
  const saveNotes = async () => {
    if (!notesPopup) return;
    await updateRow(notesPopup.row, { notes: notesPopup.value.trim() || null });
    setNotesPopup(null);
  };

  const handleDelete = async (studentId: string) => {
    if (
      !confirm(
        "이 학생의 매출 기록을 삭제하시겠습니까? (학생 자체는 유지됩니다.)",
      )
    )
      return;
    const res = await fetch(
      `/api/edu-sales?student_id=${encodeURIComponent(studentId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "삭제 실패");
      return;
    }
    await fetchRows();
  };

  // orphan(student_id NULL) 매출 행 삭제
  const handleDeleteOrphan = async (saleId: string) => {
    if (!confirm("이 매출 기록을 삭제하시겠습니까?")) return;
    const res = await fetch(
      `/api/edu-sales?sale_id=${encodeURIComponent(saleId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "삭제 실패");
      return;
    }
    await fetchRows();
  };

  // 발행 상태 필터
  const filteredRows = useMemo(() => {
    let out = rows;
    if (filterPublished !== "all") {
      out = out.filter((r) =>
        filterPublished === "done" ? r.is_published : !r.is_published,
      );
    }
    if (filterManager) {
      out = out.filter((r) => (r.manager_name ?? "") === filterManager);
    }
    if (filterRefund !== "all") {
      out = out.filter((r) => r.refund_status === filterRefund);
    }
    return out;
  }, [rows, filterPublished, filterManager, filterRefund]);

  // 담당자 옵션 — 현재 월에 등장한 담당자만
  const managerOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.manager_name) set.add(r.manager_name);
    });
    return Array.from(set).sort();
  }, [rows]);

  // 월별 탭당 건수 (API의 cohort 기준, 전체 탭에서 계산 어려우니 별도 fetch 없이 현재 rows 기반으로 추정)
  // → 정확한 건수는 활성 월 변경 시 갱신
  const monthTabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      if (r.cohort) counts[r.cohort] = (counts[r.cohort] ?? 0) + 1;
    });
    return counts;
  }, [rows]);

  // 통계 (현재 월별 탭 + 필터링된 결과 기준)
  const totalAmount = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + (r.total_amount ?? 0), 0);
  }, [filteredRows]);

  // 환불 합계 (환불완료만)
  const refundAmount = useMemo(() => {
    return filteredRows
      .filter((r) => r.refund_status === "환불완료")
      .reduce((sum, r) => sum + (r.total_amount ?? 0), 0);
  }, [filteredRows]);


  // 담당자별 매출 집계 (환불 제외)
  const managerStats = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    filteredRows.forEach((r) => {
      if (r.refund_status === "환불완료") return; // 순매출 기준
      const key = r.manager_name ?? "미지정";
      const prev = map.get(key) ?? { count: 0, amount: 0 };
      map.set(key, {
        count: prev.count + 1,
        amount: prev.amount + (r.total_amount ?? 0),
      });
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredRows]);

  return (
    <div className={styles.wrap}>
      {/* 헤더 */}
      <div className={styles.header_row}>
        <div className={styles.header_left}>
          <h1 className={styles.title}>매출파일</h1>
        </div>
        <div className={styles.header_right}>
          <div className={styles.stat_row}>
            <div className={styles.stat_box}>
              <span className={styles.stat_label}>
                {activeMonth === "전체" ? "전체" : activeMonth} 매출
              </span>
              <span className={styles.stat_value}>
                {formatNumber(totalAmount)}원
              </span>
              <span className={styles.stat_sub}>{filteredRows.length}건</span>
            </div>
            <div className={`${styles.stat_box} ${styles.stat_box_refund}`}>
              <span className={styles.stat_label}>환불</span>
              <span className={styles.stat_value}>
                -{formatNumber(refundAmount)}원
              </span>
              <span className={styles.stat_sub}>
                {
                  filteredRows.filter((r) => r.refund_status === "환불완료")
                    .length
                }
                건
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 월별 탭 */}
      <div className={styles.month_tabs}>
        {monthTabs.map((m) => {
          const cnt = monthTabCounts[m];
          const isActive = activeMonth === m;
          return (
            <button
              key={m}
              className={`${styles.month_tab} ${isActive ? styles.month_tab_active : ""}`}
              onClick={() => setActiveMonth(m)}
            >
              <span>{m}</span>
              {isActive && cnt != null && (
                <span className={styles.month_tab_badge}>{cnt}</span>
              )}
            </button>
          );
        })}
        <button
          className={`${styles.month_tab} ${activeMonth === "전체" ? styles.month_tab_active : ""}`}
          onClick={() => setActiveMonth("전체")}
        >
          전체
        </button>
      </div>

      {/* 담당자별 매출 요약 (canViewAll일 때만) */}
      {canViewAll && managerStats.length > 0 && (
        <div className={styles.manager_stats}>
          {managerStats.map((s) => (
            <button
              type="button"
              key={s.name}
              className={`${styles.manager_chip} ${filterManager === s.name ? styles.manager_chip_active : ""}`}
              onClick={() =>
                setFilterManager(filterManager === s.name ? "" : s.name)
              }
              title={
                filterManager === s.name ? "필터 해제" : `${s.name} 담당만 보기`
              }
            >
              <span className={styles.manager_chip_name}>{s.name}</span>
              <span className={styles.manager_chip_count}>{s.count}건</span>
              <span className={styles.manager_chip_amount}>
                {formatNumber(s.amount)}원
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 필터 */}
      <div className={styles.filter_bar}>
        <input
          className={styles.filter_input}
          placeholder="이름·아이디·연락처·담당자·처리번호 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={styles.filter_select}
          value={filterManager}
          onChange={(e) => setFilterManager(e.target.value)}
        >
          <option value="">전체 담당자</option>
          {managerOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          className={styles.filter_select}
          value={filterPublished}
          onChange={(e) =>
            setFilterPublished(e.target.value as "all" | "done" | "pending")
          }
        >
          <option value="all">발행 전체</option>
          <option value="done">발행 완료</option>
          <option value="pending">발행 대기</option>
        </select>
        <select
          className={styles.filter_select}
          value={filterRefund}
          onChange={(e) =>
            setFilterRefund(
              e.target.value as "all" | "정상" | "환불대기" | "환불완료",
            )
          }
        >
          <option value="all">환불 전체</option>
          <option value="정상">정상</option>
          <option value="환불대기">환불대기</option>
          <option value="환불완료">환불완료</option>
        </select>
        <input
          type="date"
          className={styles.filter_date}
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
        />
        <span className={styles.date_sep}>~</span>
        <input
          type="date"
          className={styles.filter_date}
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
        />
        <button
          className={styles.reset_btn}
          onClick={() => {
            setSearch("");
            setFilterFrom("");
            setFilterTo("");
            setFilterPublished("all");
            setFilterManager("");
            setFilterRefund("all");
          }}
        >
          초기화
        </button>
      </div>

      {/* 테이블 */}
      <div className={styles.table_wrap}>
        {loading ? (
          <div className={styles.empty_state}>불러오는 중...</div>
        ) : filteredRows.length === 0 ? (
          <div className={styles.empty_state}>
            표시할 학생이 없습니다. <b>등록학생관리</b>에서 먼저 학생을
            등록해주세요.
          </div>
        ) : (
          <table className={styles.table}>
            <thead className={styles.table_head}>
              <tr>
                <th className={styles.th}>개강반</th>
                <th className={styles.th}>학생명</th>
                <th className={styles.th}>아이디</th>
                <th className={styles.th}>전화번호</th>
                <th className={`${styles.th} ${styles.th_right}`}>단가</th>
                <th className={`${styles.th} ${styles.th_right}`}>매출</th>
                <th className={styles.th}>결제방법</th>
                <th className={styles.th}>결제일</th>
                <th className={`${styles.th} ${styles.th_center}`}>과목수</th>
                <th className={styles.th}>담당자</th>
                <th className={styles.th}>특이사항</th>
                <th className={styles.th}>(현)처리번호</th>
                <th className={styles.th}>(현)발급일자</th>
                <th className={`${styles.th} ${styles.th_center}`}>
                  발행 완료
                </th>
                <th className={`${styles.th} ${styles.th_center}`}>
                  환불 상태
                </th>
                <th className={`${styles.th} ${styles.th_center}`}>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr
                  key={
                    r.sale_id ??
                    r.student_id ??
                    `row-${r.student_name}-${r.phone ?? ""}`
                  }
                  className={`${styles.tr} ${r.sale_id ? "" : styles.tr_empty} ${
                    // 환불 상태 우선
                    r.refund_status === "환불완료"
                      ? styles.tr_refunded
                      : r.refund_status === "환불대기"
                        ? styles.tr_refund_pending
                        : // 검색 결과 중 현재 월이 아닌 행은 노란색으로 강조
                          search.trim() &&
                            r.cohort &&
                            r.cohort !== activeMonth &&
                            activeMonth !== "전체"
                          ? styles.tr_search_match
                          : ""
                  }`}
                >
                  {/* 개강반 — 인라인 텍스트 */}
                  <td className={styles.td}>
                    <InlineText
                      value={r.cohort ?? ""}
                      placeholder="-"
                      onSave={(v) => updateRow(r, { cohort: v.trim() || null })}
                      width={56}
                    />
                  </td>
                  {/* 학생명 — 읽기전용 */}
                  <td className={`${styles.td} ${styles.td_strong}`}>
                    {r.student_name}
                  </td>
                  {/* 아이디 — 인라인 텍스트 */}
                  <td className={styles.td}>
                    <InlineText
                      value={r.student_username ?? ""}
                      placeholder="-"
                      onSave={(v) =>
                        updateRow(r, { student_username: v.trim() || null })
                      }
                      width={90}
                    />
                  </td>
                  <td className={styles.td}>{formatPhone(r.phone)}</td>
                  {/* 단가 — 인라인 숫자 */}
                  <td className={`${styles.td} ${styles.td_right}`}>
                    <InlineNumber
                      value={r.unit_price}
                      onSave={(v) => updateRow(r, { unit_price: v })}
                      align="right"
                      width={70}
                    />
                  </td>
                  {/* 매출 — 인라인 숫자 (환불완료 시 취소선) */}
                  <td
                    className={`${styles.td} ${styles.td_right} ${styles.td_strong} ${
                      r.refund_status === "환불완료"
                        ? styles.td_strikethrough
                        : ""
                    }`}
                  >
                    <InlineNumber
                      value={r.total_amount}
                      onSave={(v) => updateRow(r, { total_amount: v })}
                      align="right"
                      width={90}
                    />
                  </td>
                  {/* 결제방법 — 커스텀 select */}
                  <td className={styles.td}>
                    <CustomSelect
                      value={r.payment_method ?? ""}
                      placeholder="-"
                      size="sm"
                      minWidth={120}
                      options={[
                        { value: "", label: "-" },
                        ...PAYMENT_METHOD_OPTIONS,
                      ]}
                      onChange={(v) =>
                        updateRow(r, {
                          payment_method: (v || null) as PaymentMethod | null,
                        })
                      }
                    />
                  </td>
                  {/* 결제일 — 커스텀 달력 */}
                  <td className={styles.td}>
                    <DateInput
                      value={r.payment_date ?? ""}
                      onChange={(v) =>
                        updateRow(r, { payment_date: v || null })
                      }
                      placeholder="결제일"
                      triggerClassName={styles.inline_date_trigger}
                    />
                  </td>
                  {/* 과목수 — 인라인 숫자 */}
                  <td className={`${styles.td} ${styles.td_center}`}>
                    <InlineNumber
                      value={r.subject_count}
                      onSave={(v) => updateRow(r, { subject_count: v })}
                      align="center"
                      width={48}
                    />
                  </td>
                  <td className={styles.td}>
                    {r.manager_name ?? <span className={styles.td_dim}>-</span>}
                  </td>
                  {/* 특이사항 — 클릭하면 팝업 */}
                  <td className={`${styles.td} ${styles.td_notes}`}>
                    <button
                      type="button"
                      className={styles.notes_btn}
                      onClick={() => openNotes(r)}
                      title={r.notes ?? "클릭해 입력"}
                    >
                      {r.notes ? (
                        r.notes.length > 18 ? (
                          r.notes.slice(0, 18) + "…"
                        ) : (
                          r.notes
                        )
                      ) : (
                        <span className={styles.td_dim}>입력</span>
                      )}
                    </button>
                  </td>
                  {/* (현)처리번호 — 자동 하이픈 */}
                  <td className={styles.td}>
                    <InlinePhone
                      value={r.process_number ?? ""}
                      onSave={(v) =>
                        updateRow(r, { process_number: v.trim() || null })
                      }
                      width={130}
                    />
                  </td>
                  {/* (현)발급일자 — 커스텀 달력 */}
                  <td className={styles.td}>
                    <DateInput
                      value={r.issue_date ?? ""}
                      onChange={(v) => updateRow(r, { issue_date: v || null })}
                      placeholder="발급일"
                      triggerClassName={styles.inline_date_trigger}
                    />
                  </td>
                  {/* 발행 완료 — 체크박스 */}
                  <td className={`${styles.td} ${styles.td_center}`}>
                    <input
                      type="checkbox"
                      className={styles.inline_check}
                      checked={r.is_published}
                      onChange={(e) =>
                        updateRow(r, { is_published: e.target.checked })
                      }
                    />
                  </td>
                  {/* 환불 상태 + 환불일 — 인라인 편집 */}
                  <td className={`${styles.td} ${styles.td_center}`}>
                    <div className={styles.refund_cell}>
                      <CustomSelect
                        value={r.refund_status}
                        size="sm"
                        minWidth={92}
                        options={[
                          { value: "정상", label: "정상" },
                          { value: "환불대기", label: "환불대기" },
                          { value: "환불완료", label: "환불완료" },
                        ]}
                        onChange={(v) =>
                          updateRow(r, { refund_status: v as RefundStatus })
                        }
                      />
                      {r.refund_status === "환불완료" && (
                        <DateInput
                          value={r.refund_date ?? ""}
                          onChange={(v) =>
                            updateRow(r, { refund_date: v || null })
                          }
                          placeholder="환불일"
                          triggerClassName={styles.refund_date_trigger}
                        />
                      )}
                    </div>
                  </td>
                  {/* 관리 — 삭제만 */}
                  <td className={`${styles.td} ${styles.td_actions}`}>
                    {r.sale_id ? (
                      <button
                        className={styles.action_del_btn}
                        onClick={() =>
                          r.student_id
                            ? handleDelete(r.student_id)
                            : handleDeleteOrphan(r.sale_id!)
                        }
                      >
                        삭제
                      </button>
                    ) : (
                      <span className={styles.td_dim}>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 특이사항 팝업 */}
      {notesPopup && (
        <div
          className={styles.modal_overlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setNotesPopup(null);
          }}
        >
          <div className={styles.modal} style={{ maxWidth: 520 }}>
            <div className={styles.modal_header}>
              <h3 className={styles.modal_title}>
                특이사항 — {notesPopup.row.student_name}
              </h3>
              <button
                className={styles.modal_close}
                onClick={() => setNotesPopup(null)}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className={styles.modal_body}>
              <textarea
                className={styles.textarea}
                rows={6}
                autoFocus
                value={notesPopup.value}
                placeholder="예: 패키지, 분납 안내 등"
                onChange={(e) =>
                  setNotesPopup({ ...notesPopup, value: e.target.value })
                }
              />
            </div>
            <div className={styles.modal_footer}>
              <button
                className={styles.btn_secondary}
                onClick={() => setNotesPopup(null)}
              >
                취소
              </button>
              <button className={styles.btn_primary} onClick={saveNotes}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 인라인 텍스트 입력 ──────────────────────────────────────────────
function InlineText({
  value,
  placeholder,
  onSave,
  width,
}: {
  value: string;
  placeholder?: string;
  onSave: (v: string) => void;
  width?: number;
}) {
  const [local, setLocal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(value);
  }
  return (
    <input
      type="text"
      className={styles.inline_input}
      value={local}
      placeholder={placeholder}
      style={width ? { width } : undefined}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onSave(local);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

// ─── 인라인 전화번호 입력 (자동 하이픈) ──────────────────────────────
function InlinePhone({
  value,
  onSave,
  width,
}: {
  value: string;
  onSave: (v: string) => void;
  width?: number;
}) {
  const [local, setLocal] = useState(autoHyphenPhone(value));
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(autoHyphenPhone(value));
  }
  return (
    <input
      type="text"
      className={styles.inline_input}
      value={local}
      placeholder="010-XXXX-XXXX"
      inputMode="numeric"
      style={width ? { width } : undefined}
      onChange={(e) => setLocal(autoHyphenPhone(e.target.value))}
      onBlur={() => {
        const cleaned = local || "";
        if (cleaned !== value) onSave(cleaned);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

// ─── 인라인 숫자 입력 ──────────────────────────────────────────────
function InlineNumber({
  value,
  onSave,
  align = "left",
  width,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
  align?: "left" | "right" | "center";
  width?: number;
}) {
  const [local, setLocal] = useState(value != null ? String(value) : "");
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(value != null ? String(value) : "");
  }
  const display =
    local && /^\d+$/.test(local.replace(/,/g, ""))
      ? Number(local.replace(/,/g, "")).toLocaleString()
      : local;
  return (
    <input
      type="text"
      inputMode="numeric"
      className={styles.inline_input}
      value={display}
      style={{
        ...(width ? { width } : {}),
        textAlign: align,
      }}
      onChange={(e) => setLocal(e.target.value.replace(/[^\d]/g, ""))}
      onBlur={() => {
        const next = local ? Number(local.replace(/[^\d]/g, "")) : null;
        if (next !== value) onSave(Number.isFinite(next) ? next : null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
