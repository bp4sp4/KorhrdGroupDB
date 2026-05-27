"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import styles from "./page.module.css";
import CustomSelect from "../marketing/CustomSelect";
import { DateInput } from "@/components/ui/Calendar/DateInput";
import { DateRangeCalendar, type DateRange } from "@/components/DateRangeCalendar";
import SalesHeaderAdmin from "../edu-sales/SalesHeaderAdmin";
import SalesHeaderManager from "../edu-sales/SalesHeaderManager";

type PaymentMethod = "bank_transfer" | "card";
type RefundStatus = "정상" | "당월 환불" | "환불" | "정산" | "보류";
type Category = "실습" | "후납";

const REFUND_ROW_COLORS: Partial<Record<RefundStatus, string>> = {
  환불: "#F3C8DE",
  정산: "#D2DBE9",
  보류: "#FDF3D1",
};

interface SalesRow {
  practice_application_id: string | null;
  sale_id: string | null;
  student_name: string;
  phone: string | null;
  manager_name: string | null;
  category: Category;
  total_amount: number | null;
  payment_method: PaymentMethod | null;
  payment_date: string | null;
  cohort: string | null;
  process_number: string | null;
  issue_date: string | null;
  is_published: boolean;
  refund_status: RefundStatus;
  refund_date: string | null;
  created_at: string;
}

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "card", label: "카드결제" },
  { value: "bank_transfer", label: "계좌이체" },
];

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "실습", label: "실습" },
  { value: "후납", label: "후납" },
];

function kstNow(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}
function defaultCohort(): string {
  const d = kstNow();
  return `${d.getMonth() + 1}월`;
}

const SALES_START_YEAR = 2026;
const SALES_START_MONTH = 2;

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

function cohortToMonth(cohort: string | null | undefined): number | null {
  if (!cohort) return null;
  const trimmed = cohort.trim();
  const ymd = trimmed.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (ymd) {
    const m = Number(ymd[2]);
    return m >= 1 && m <= 12 ? m : null;
  }
  const kr = trimmed.match(/(\d{4})년\s*(\d{1,2})월/);
  if (kr) {
    const m = Number(kr[2]);
    return m >= 1 && m <= 12 ? m : null;
  }
  const mo = trimmed.match(/^(\d{1,2})월$/);
  if (mo) {
    const m = Number(mo[1]);
    return m >= 1 && m <= 12 ? m : null;
  }
  return null;
}

function cohortToMonthLabel(cohort: string | null | undefined): string | null {
  const m = cohortToMonth(cohort);
  return m ? `${m}월` : null;
}

function cohortSortKey(c: string): number {
  const trimmed = c.trim();
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return Number(y) * 10000 + Number(m) * 100 + Number(d ?? "0");
  }
  const krFullMatch = trimmed.match(
    /(\d{4})년\s*(\d{1,2})월(?:\s*(\d{1,2})일)?/,
  );
  if (krFullMatch) {
    const [, y, m, d] = krFullMatch;
    return Number(y) * 10000 + Number(m) * 100 + Number(d ?? "0");
  }
  const monthOnlyMatch = trimmed.match(/^(\d{1,2})월$/);
  if (monthOnlyMatch) {
    return Number(monthOnlyMatch[1]);
  }
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
function autoHyphenPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

export default function PracticeSalesPage() {
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [canViewAll, setCanViewAll] = useState(false);
  const [myDisplayName, setMyDisplayName] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const name = (data?.displayName ?? data?.display_name ?? "").trim();
        if (name) setMyDisplayName(name);
        const role = data?.role ?? "";
        setIsAdmin(role === "admin" || role === "master-admin");
      })
      .catch(() => {});
  }, []);

  const [apiCohorts, setApiCohorts] = useState<string[]>([]);
  const monthTabs = useMemo(() => {
    const set = new Set<string>(getDefaultMonthTabs());
    apiCohorts.forEach((c) => {
      const label = cohortToMonthLabel(c);
      if (label) set.add(label);
    });
    return Array.from(set).sort((a, b) => cohortSortKey(a) - cohortSortKey(b));
  }, [apiCohorts]);
  const [activeMonth, setActiveMonth] = useState<string>(() => defaultCohort());

  const [search, setSearch] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterPublished, setFilterPublished] = useState<
    "all" | "done" | "pending"
  >("all");
  const [filterManager, setFilterManager] = useState<string>("");
  const [filterRefund, setFilterRefund] = useState<
    "all" | "정상" | "당월 환불" | "환불" | "정산" | "보류"
  >("all");
  const [filterCategory, setFilterCategory] = useState<"all" | Category>("all");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRefundOpen, setBulkRefundOpen] = useState(false);

  // 매출 추가 모달
  const [addModalOpen, setAddModalOpen] = useState(false);

  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const dateRangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dateRangeOpen) return;
    function handleOutside(e: MouseEvent) {
      if (
        dateRangeRef.current &&
        !dateRangeRef.current.contains(e.target as Node)
      ) {
        setDateRangeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [dateRangeOpen]);

  function ymd(d: Date) {
    return d.toISOString().slice(0, 10);
  }

  const dateRangeValue: DateRange | undefined =
    filterFrom || filterTo
      ? {
          from: filterFrom ? new Date(filterFrom + "T00:00:00") : undefined,
          to: filterTo ? new Date(filterTo + "T00:00:00") : undefined,
        }
      : undefined;

  const dateRangeLabel = (() => {
    if (filterFrom && filterTo) return `${filterFrom} ~ ${filterTo}`;
    if (filterFrom) return `${filterFrom} ~`;
    if (filterTo) return `~ ${filterTo}`;
    return "결제일 기간 선택";
  })();

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/practice-sales?${params.toString()}`);
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
  }, [filterFrom, filterTo, search]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const updateRow = async (
    row: SalesRow,
    patch: Partial<{
      category: Category;
      total_amount: number | null;
      payment_method: PaymentMethod | null;
      payment_date: string | null;
      cohort: string | null;
      process_number: string | null;
      issue_date: string | null;
      is_published: boolean;
      refund_status: RefundStatus;
      refund_date: string | null;
      manager_name: string | null;
    }>,
  ) => {
    if (!canEdit) {
      alert(
        `${activeMonth} 데이터는 수정할 수 없습니다. (현재 월(${currentMonthLabel})만 수정 가능)`,
      );
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        (r.sale_id ?? r.practice_application_id) ===
        (row.sale_id ?? row.practice_application_id)
          ? { ...r, ...patch }
          : r,
      ),
    );
    try {
      const payload: Record<string, unknown> = row.sale_id
        ? { sale_id: row.sale_id, ...patch }
        : row.practice_application_id
          ? { practice_application_id: row.practice_application_id, ...patch }
          : {
              ...patch,
              student_name: row.student_name,
              phone: row.phone,
              manager_name: row.manager_name,
            };
      const res = await fetch("/api/practice-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "저장 실패");
        await fetchRows();
        return;
      }
      const saved = await res.json();
      if (saved?.id && !row.sale_id) {
        setRows((prev) =>
          prev.map((r) =>
            (r.practice_application_id ?? "") ===
            (row.practice_application_id ?? "")
              ? { ...r, sale_id: saved.id }
              : r,
          ),
        );
      }
    } catch {
      await fetchRows();
    }
  };

  const handleDeleteRow = async (row: SalesRow) => {
    if (!confirm("이 매출 기록을 삭제하시겠습니까?")) return;
    const params = row.sale_id
      ? `sale_id=${encodeURIComponent(row.sale_id)}`
      : row.practice_application_id
        ? `practice_application_id=${encodeURIComponent(row.practice_application_id)}`
        : null;
    if (!params) {
      alert("삭제할 수 없는 행입니다.");
      return;
    }
    const res = await fetch(`/api/practice-sales?${params}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "삭제 실패");
      return;
    }
    await fetchRows();
  };

  const rowKey = (r: SalesRow): string | null => {
    if (r.sale_id) return `sale:${r.sale_id}`;
    if (r.practice_application_id) return `app:${r.practice_application_id}`;
    return null;
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}건을 삭제하시겠습니까?`)) return;
    const ids = Array.from(selectedIds);
    await Promise.all(
      ids.map((key) => {
        const [type, id] = key.split(":");
        const params =
          type === "sale"
            ? `sale_id=${encodeURIComponent(id)}`
            : `practice_application_id=${encodeURIComponent(id)}`;
        return fetch(`/api/practice-sales?${params}`, { method: "DELETE" });
      }),
    );
    setSelectedIds(new Set());
    await fetchRows();
  };

  const bulkUpdateRefund = async (status: RefundStatus) => {
    if (selectedIds.size === 0) return;
    const targets = rows.filter((r) => {
      const key = rowKey(r);
      return key && selectedIds.has(key);
    });
    if (targets.length === 0) return;
    await Promise.all(
      targets.map((r) => updateRow(r, { refund_status: status })),
    );
    setSelectedIds(new Set());
    setBulkRefundOpen(false);
  };

  const rowToExportObject = (r: SalesRow) => ({
    분류: r.category,
    학생명: r.student_name,
    연락처: formatPhone(r.phone),
    결제금액: r.total_amount ?? "",
    결제방법: r.payment_method
      ? PAYMENT_METHOD_OPTIONS.find((o) => o.value === r.payment_method)
          ?.label ?? ""
      : "",
    결제일: r.payment_date ?? "",
    담당자: r.manager_name ?? "",
    "(현)처리번호": r.process_number ?? "",
    "(현)발급일자": r.issue_date ?? "",
    "발행 완료": r.is_published ? "Y" : "",
    환불: r.refund_status,
    환불일: r.refund_date ?? "",
  });

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const today = new Date()
      .toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })
      .replace(/\.\s?/g, "-")
      .replace(/-$/, "");

    if (activeMonth === "전체") {
      const groups = new Map<string, SalesRow[]>();
      filteredRows.forEach((r) => {
        const key = cohortToMonthLabel(r.cohort) ?? "기타";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      });
      const sortedCohorts = Array.from(groups.keys()).sort(
        (a, b) => cohortSortKey(a) - cohortSortKey(b),
      );
      for (const cohort of sortedCohorts) {
        const rowsForCohort = groups.get(cohort)!;
        const ws = XLSX.utils.json_to_sheet(rowsForCohort.map(rowToExportObject));
        const safeSheetName = cohort.replace(/[[\]:*?/\\]/g, "_").slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
      }
      XLSX.writeFile(wb, `실습_매출파일_전체_${today}.xlsx`);
    } else {
      const ws = XLSX.utils.json_to_sheet(filteredRows.map(rowToExportObject));
      XLSX.utils.book_append_sheet(wb, ws, `매출_${activeMonth}`);
      XLSX.writeFile(wb, `실습_매출파일_${activeMonth}_${today}.xlsx`);
    }
  };

  const filteredRows = useMemo(() => {
    let out = rows;
    if (activeMonth && activeMonth !== "전체") {
      out = out.filter((r) => cohortToMonthLabel(r.cohort) === activeMonth);
    }
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
    if (filterCategory !== "all") {
      out = out.filter((r) => r.category === filterCategory);
    }
    return out;
  }, [
    rows,
    activeMonth,
    filterPublished,
    filterManager,
    filterRefund,
    filterCategory,
  ]);

  const managerOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.manager_name) set.add(r.manager_name);
    });
    return Array.from(set).sort();
  }, [rows]);

  const monthTabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      const label = cohortToMonthLabel(r.cohort);
      if (label) counts[label] = (counts[label] ?? 0) + 1;
    });
    return counts;
  }, [rows]);

  const totalAmount = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + (r.total_amount ?? 0), 0);
  }, [filteredRows]);

  const managerStats = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    filteredRows.forEach((r) => {
      if (r.refund_status === "환불") return;
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

  const now = new Date();
  const activeMonthNum = useMemo(() => {
    const m = activeMonth.match(/^(\d+)월$/);
    if (m) return Number(m[1]);
    return now.getMonth() + 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth]);
  const activeYear = now.getFullYear();
  const isMonthTab = /^\d+월$/.test(activeMonth);
  const currentMonthLabel = `${kstNow().getMonth() + 1}월`;
  const canEdit = isAdmin || activeMonth === currentMonthLabel;
  const activeMonthRange = useMemo(() => {
    if (!isMonthTab) return null;
    const first = new Date(activeYear, activeMonthNum - 1, 1);
    const last = new Date(activeYear, activeMonthNum, 0);
    return { first, last };
  }, [isMonthTab, activeYear, activeMonthNum]);
  const refundCountFiltered = useMemo(
    () => filteredRows.filter((r) => r.refund_status === "환불").length,
    [filteredRows],
  );

  const myRows = useMemo(() => {
    if (!myDisplayName) return filteredRows;
    return filteredRows.filter((r) => r.manager_name === myDisplayName);
  }, [filteredRows, myDisplayName]);
  const myRevenue = useMemo(
    () =>
      myRows
        .filter((r) => r.refund_status !== "환불")
        .reduce((s, r) => s + (r.total_amount ?? 0), 0),
    [myRows],
  );
  const myCount = myRows.length;
  const myRefundCount = useMemo(
    () => myRows.filter((r) => r.refund_status === "환불").length,
    [myRows],
  );

  const dailyDistribution = useMemo(() => {
    const totalDays = new Date(activeYear, activeMonthNum, 0).getDate();
    const arr: { d: number; amt: number }[] = [];
    for (let d = 1; d <= totalDays; d++) arr.push({ d, amt: 0 });
    const source = canViewAll ? filteredRows : myRows;
    source.forEach((r) => {
      if (r.refund_status === "환불") return;
      if (!r.payment_date) return;
      const parts = r.payment_date.split("-");
      if (parts.length !== 3) return;
      const y = Number(parts[0]);
      const m = Number(parts[1]);
      const d = Number(parts[2]);
      if (y !== activeYear || m !== activeMonthNum) return;
      const idx = d - 1;
      if (idx >= 0 && idx < arr.length) arr[idx].amt += r.total_amount ?? 0;
    });
    return { daily: arr, totalDays };
  }, [filteredRows, myRows, canViewAll, activeYear, activeMonthNum]);

  const monthHistory = useMemo(() => {
    const target = canViewAll
      ? rows
      : rows.filter((r) => r.manager_name === myDisplayName);
    const monthly: Record<number, number> = {};
    target.forEach((r) => {
      if (r.refund_status === "환불") return;
      const num = cohortToMonth(r.cohort);
      if (!num) return;
      monthly[num] = (monthly[num] ?? 0) + (r.total_amount ?? 0);
    });
    const result: { m: number; revenue: number; amount: number }[] = [];
    for (let offset = 4; offset >= 0; offset--) {
      let mm = activeMonthNum - offset;
      if (mm <= 0) mm += 12;
      const v = monthly[mm] ?? 0;
      result.push({ m: mm, revenue: v, amount: v });
    }
    return result;
  }, [rows, canViewAll, myDisplayName, activeMonthNum]);

  const prevMonthRevenue = useMemo(() => {
    const prev = monthHistory[monthHistory.length - 2];
    return prev?.revenue ?? 0;
  }, [monthHistory]);

  const todayDay =
    now.getFullYear() === activeYear && now.getMonth() + 1 === activeMonthNum
      ? now.getDate()
      : null;

  return (
    <div className={styles.wrap}>
      <div>
        {canViewAll ? (
          <SalesHeaderAdmin
            year={activeYear}
            month={activeMonthNum}
            totalRevenue={totalAmount}
            totalCount={filteredRows.length}
            refundCount={refundCountFiltered}
            people={managerStats}
            history={monthHistory.map(({ m, revenue }) => ({ m, revenue }))}
            prevMonthRevenue={prevMonthRevenue}
            onExcelDownload={handleExportExcel}
            onPersonClick={(p) =>
              setFilterManager(filterManager === p.name ? "" : p.name)
            }
            onMonthClick={(m) => setActiveMonth(`${m}월`)}
            onViewAllPeriod={() => setActiveMonth("전체")}
          />
        ) : (
          <SalesHeaderManager
            year={activeYear}
            month={activeMonthNum}
            managerName={myDisplayName}
            myRevenue={myRevenue}
            myCount={myCount}
            myRefundCount={myRefundCount}
            prevMonthRevenue={prevMonthRevenue}
            daily={dailyDistribution.daily}
            todayDay={todayDay}
            totalDaysInMonth={dailyDistribution.totalDays}
            history={monthHistory.map(({ m, amount }) => ({ m, amount }))}
            onExcelDownload={handleExportExcel}
            onMonthClick={(m) => setActiveMonth(`${m}월`)}
            onViewAllPeriod={() => setActiveMonth("전체")}
          />
        )}
      </div>

      {!canEdit && (
        <div className={styles.readonly_notice}>
          🔒 {activeMonth} 데이터는 보기 전용입니다. 현재 월(
          {currentMonthLabel})만 수정 가능합니다.
        </div>
      )}

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

      <div className={styles.filter_bar}>
        <input
          className={styles.filter_input}
          placeholder="이름·연락처·담당자·처리번호 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {canViewAll && (
          <CustomSelect
            value={filterManager}
            onChange={setFilterManager}
            options={[
              { value: "", label: "전체 담당자" },
              ...managerOptions.map((m) => ({ value: m, label: m })),
            ]}
            ariaLabel="담당자 필터"
            minWidth={140}
          />
        )}
        <CustomSelect
          value={filterCategory}
          onChange={(v) => setFilterCategory(v as "all" | Category)}
          options={[
            { value: "all", label: "분류 전체" },
            { value: "실습", label: "실습" },
            { value: "후납", label: "후납" },
          ]}
          ariaLabel="분류 필터"
          minWidth={120}
        />
        {canViewAll && (
          <>
            <CustomSelect
              value={filterPublished}
              onChange={(v) =>
                setFilterPublished(v as "all" | "done" | "pending")
              }
              options={[
                { value: "all", label: "발행 전체" },
                { value: "done", label: "발행 완료" },
                { value: "pending", label: "발행 대기" },
              ]}
              ariaLabel="발행 상태 필터"
              minWidth={120}
            />
            <CustomSelect
              value={filterRefund}
              onChange={(v) =>
                setFilterRefund(
                  v as
                    | "all"
                    | "정상"
                    | "당월 환불"
                    | "환불"
                    | "정산"
                    | "보류",
                )
              }
              options={[
                { value: "all", label: "환불 전체" },
                { value: "정상", label: "정상" },
                { value: "당월 환불", label: "당월 환불" },
                { value: "환불", label: "환불" },
                { value: "정산", label: "정산" },
                { value: "보류", label: "보류" },
              ]}
              ariaLabel="환불 필터"
              minWidth={120}
            />
          </>
        )}
        <div ref={dateRangeRef} className={styles.dateRangeWrap}>
          <button
            type="button"
            className={`${styles.dateRangeBtn} ${(filterFrom || filterTo) ? styles.dateRangeBtn_active : ""}`}
            onClick={() => setDateRangeOpen((v) => !v)}
          >
            {dateRangeLabel}
          </button>
          {dateRangeOpen && (
            <div className={styles.dateRangePopover}>
              <DateRangeCalendar
                variant="month"
                value={dateRangeValue}
                onChange={(r) => {
                  setFilterFrom(r?.from ? ymd(r.from) : "");
                  setFilterTo(r?.to ? ymd(r.to) : "");
                }}
                onConfirm={() => setDateRangeOpen(false)}
                onReset={() => {
                  setFilterFrom("");
                  setFilterTo("");
                }}
              />
            </div>
          )}
        </div>
        <button
          className={styles.reset_btn}
          onClick={() => {
            setSearch("");
            setFilterFrom("");
            setFilterTo("");
            setFilterPublished("all");
            setFilterManager("");
            setFilterRefund("all");
            setFilterCategory("all");
          }}
        >
          초기화
        </button>
        {canEdit && (
          <button
            type="button"
            className={styles.add_btn}
            onClick={() => setAddModalOpen(true)}
          >
            + 매출 추가
          </button>
        )}
      </div>

      {canViewAll && selectedIds.size > 0 && (
        <div className={styles.bulk_action_bar}>
          <span className={styles.bulk_action_count}>
            <b>{selectedIds.size}</b>건 선택됨
          </span>
          <div className={styles.bulk_action_spacer} />
          <div className={styles.bulk_refund_wrap}>
            <button
              type="button"
              className={styles.bulk_refund_btn}
              onClick={() => setBulkRefundOpen((v) => !v)}
            >
              환불 일괄 변경 ▾
            </button>
            {bulkRefundOpen && (
              <div className={styles.bulk_refund_menu}>
                {(
                  ["정상", "당월 환불", "환불", "정산", "보류"] as RefundStatus[]
                ).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={styles.bulk_refund_item}
                    onClick={() => bulkUpdateRefund(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className={styles.action_del_btn}
            onClick={bulkDelete}
          >
            선택 삭제
          </button>
          <button
            type="button"
            className={styles.bulk_cancel_btn}
            onClick={() => setSelectedIds(new Set())}
          >
            선택 취소
          </button>
        </div>
      )}

      <div className={styles.table_wrap}>
        {loading ? (
          <div className={styles.empty_state}>불러오는 중...</div>
        ) : filteredRows.length === 0 ? (
          <div className={styles.empty_state}>
            표시할 매출이 없습니다. 실습 신청에서 결제완료 건이 자동으로
            추가됩니다.
          </div>
        ) : (
          <table className={styles.table}>
            <thead className={styles.table_head}>
              <tr>
                {canViewAll && (
                  <th
                    className={`${styles.th} ${styles.th_center}`}
                    style={{ width: 36 }}
                  >
                    <input
                      type="checkbox"
                      className={styles.inline_check}
                      checked={
                        filteredRows.length > 0 &&
                        filteredRows.every((r) => {
                          const k = rowKey(r);
                          return k != null && selectedIds.has(k);
                        })
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(
                            new Set(
                              filteredRows
                                .map((r) => rowKey(r))
                                .filter((k): k is string => k != null),
                            ),
                          );
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                    />
                  </th>
                )}
                <th className={`${styles.th} ${styles.th_center}`}>분류</th>
                <th className={`${styles.th} ${styles.th_center}`}>학생명</th>
                <th className={`${styles.th} ${styles.th_center}`}>연락처</th>
                <th className={`${styles.th} ${styles.th_center}`}>결제금액</th>
                <th className={`${styles.th} ${styles.th_center}`}>결제방법</th>
                <th className={`${styles.th} ${styles.th_center}`}>결제일</th>
                <th className={`${styles.th} ${styles.th_center}`}>담당자</th>
                <th className={`${styles.th} ${styles.th_center}`}>
                  (현)처리번호
                </th>
                {canViewAll && (
                  <>
                    <th className={`${styles.th} ${styles.th_center}`}>
                      (현)발급일자
                    </th>
                    <th className={`${styles.th} ${styles.th_center}`}>
                      발행 완료
                    </th>
                    <th className={`${styles.th} ${styles.th_center}`}>환불</th>
                    <th className={`${styles.th} ${styles.th_center}`}>관리</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const rowBg = REFUND_ROW_COLORS[r.refund_status];
                return (
                  <tr
                    key={
                      r.sale_id ??
                      r.practice_application_id ??
                      `row-${r.student_name}-${r.phone ?? ""}`
                    }
                    className={`${styles.tr} ${r.sale_id ? "" : styles.tr_empty} ${
                      r.refund_status === "환불" ? styles.tr_refunded : ""
                    }`}
                    style={rowBg ? { background: rowBg } : undefined}
                  >
                    {canViewAll && (
                      <td
                        className={`${styles.td} ${styles.td_center}`}
                        style={{ width: 36 }}
                      >
                        {(() => {
                          const k = rowKey(r);
                          if (!k) return null;
                          return (
                            <input
                              type="checkbox"
                              className={styles.inline_check}
                              checked={selectedIds.has(k)}
                              onChange={(e) => {
                                setSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(k);
                                  else next.delete(k);
                                  return next;
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          );
                        })()}
                      </td>
                    )}
                    {/* 분류 */}
                    <td className={`${styles.td} ${styles.td_center}`}>
                      <CustomSelect
                        value={r.category}
                        size="sm"
                        minWidth={100}
                        options={CATEGORY_OPTIONS}
                        onChange={(v) =>
                          updateRow(r, { category: v as Category })
                        }
                        disabled={!canEdit}
                      />
                    </td>
                    {/* 학생명 */}
                    <td
                      className={`${styles.td} ${styles.td_center} ${styles.td_strong}`}
                    >
                      {r.student_name}
                    </td>
                    {/* 연락처 */}
                    <td className={`${styles.td} ${styles.td_center}`}>
                      {formatPhone(r.phone)}
                    </td>
                    {/* 결제금액 */}
                    <td
                      className={`${styles.td} ${styles.td_center} ${styles.td_strong} ${
                        r.refund_status === "환불"
                          ? styles.td_strikethrough
                          : ""
                      }`}
                    >
                      <InlineNumber
                        value={r.total_amount}
                        onSave={(v) => updateRow(r, { total_amount: v })}
                        align="center"
                        width={90}
                        disabled={!canEdit}
                      />
                    </td>
                    {/* 결제방법 */}
                    <td className={`${styles.td} ${styles.td_center}`}>
                      <div
                        className={
                          !r.payment_method ? styles.cell_empty_hint : undefined
                        }
                      >
                        <CustomSelect
                          value={r.payment_method ?? ""}
                          placeholder="-"
                          size="sm"
                          minWidth={110}
                          options={[
                            { value: "", label: "-" },
                            ...PAYMENT_METHOD_OPTIONS,
                          ]}
                          onChange={(v) =>
                            updateRow(r, {
                              payment_method: (v || null) as PaymentMethod | null,
                            })
                          }
                          disabled={!canEdit}
                        />
                      </div>
                    </td>
                    {/* 결제일 */}
                    <td className={`${styles.td} ${styles.td_center}`}>
                      <div
                        className={
                          !r.payment_date ? styles.cell_empty_hint : undefined
                        }
                      >
                        <DateInput
                          value={r.payment_date ?? ""}
                          onChange={(v) => {
                            if (!v) {
                              updateRow(r, { payment_date: null });
                              return;
                            }
                            if (isMonthTab) {
                              const parts = v.split("-");
                              const m = Number(parts[1]);
                              if (m !== activeMonthNum) {
                                alert(
                                  `결제일은 ${activeMonth} 범위에서만 선택할 수 있습니다.`,
                                );
                                return;
                              }
                            }
                            updateRow(r, { payment_date: v, cohort: v });
                          }}
                          placeholder="결제일"
                          triggerClassName={styles.inline_date_trigger}
                          minDate={activeMonthRange?.first}
                          maxDate={activeMonthRange?.last}
                          disabled={!canEdit}
                        />
                      </div>
                    </td>
                    {/* 담당자 */}
                    <td className={`${styles.td} ${styles.td_center}`}>
                      <InlineText
                        value={r.manager_name ?? ""}
                        placeholder="이한선"
                        onSave={(v) =>
                          updateRow(r, {
                            manager_name: v.trim() || "이한선",
                          })
                        }
                        width={80}
                        disabled={!canEdit}
                      />
                    </td>
                    {/* (현)처리번호 */}
                    <td className={`${styles.td} ${styles.td_center}`}>
                      <InlinePhone
                        value={r.process_number ?? ""}
                        onSave={(v) =>
                          updateRow(r, { process_number: v.trim() || null })
                        }
                        width={130}
                        disabled={!canEdit}
                      />
                    </td>
                    {canViewAll && (
                      <>
                        {/* (현)발급일자 */}
                        <td className={`${styles.td} ${styles.td_center}`}>
                          <DateInput
                            value={r.issue_date ?? ""}
                            onChange={(v) =>
                              updateRow(r, { issue_date: v || null })
                            }
                            placeholder="발급일"
                            triggerClassName={styles.inline_date_trigger}
                            disabled={!canEdit}
                          />
                        </td>
                        {/* 발행 완료 */}
                        <td className={`${styles.td} ${styles.td_center}`}>
                          <input
                            type="checkbox"
                            className={styles.inline_check}
                            checked={r.is_published}
                            disabled={!canEdit}
                            onChange={(e) =>
                              updateRow(r, { is_published: e.target.checked })
                            }
                          />
                        </td>
                        {/* 환불 */}
                        <td className={`${styles.td} ${styles.td_center}`}>
                          <div className={styles.refund_cell}>
                            <CustomSelect
                              value={r.refund_status}
                              size="sm"
                              minWidth={110}
                              options={[
                                { value: "정상", label: "정상" },
                                { value: "당월 환불", label: "당월 환불" },
                                { value: "환불", label: "환불" },
                                { value: "정산", label: "정산" },
                                { value: "보류", label: "보류" },
                              ]}
                              onChange={(v) =>
                                updateRow(r, {
                                  refund_status: v as RefundStatus,
                                })
                              }
                              disabled={!canEdit}
                            />
                            {r.refund_status === "환불" && (
                              <DateInput
                                value={r.refund_date ?? ""}
                                onChange={(v) =>
                                  updateRow(r, { refund_date: v || null })
                                }
                                placeholder="환불일"
                                triggerClassName={styles.refund_date_trigger}
                                disabled={!canEdit}
                              />
                            )}
                          </div>
                        </td>
                        {/* 관리 */}
                        <td
                          className={`${styles.td} ${styles.td_center} ${styles.td_actions}`}
                        >
                          {canEdit ? (
                            <button
                              className={styles.action_del_btn}
                              onClick={() => handleDeleteRow(r)}
                            >
                              삭제
                            </button>
                          ) : (
                            <span className={styles.td_dim}>-</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 매출 추가 모달 */}
      {addModalOpen && (
        <AddPracticeSalesModal
          onClose={() => setAddModalOpen(false)}
          onCreated={() => {
            setAddModalOpen(false);
            fetchRows();
          }}
        />
      )}
    </div>
  );
}

// ─── 매출 추가 모달 ─────────────────────────────────────────────────
function AddPracticeSalesModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const todayKst = (() => {
    const d = kstNow();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();

  const [form, setForm] = useState({
    student_name: "",
    phone: "",
    manager_name: "이한선",
    category: "후납" as Category,
    payment_method: "card" as PaymentMethod,
    payment_date: todayKst,
    total_amount: "110000",
    process_number: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.student_name.trim()) {
      alert("학생명은 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        student_name: form.student_name.trim(),
        phone: form.phone.trim() || null,
        manager_name: form.manager_name.trim() || "이한선",
        category: form.category,
        payment_method: form.payment_method,
        payment_date: form.payment_date || null,
        cohort: form.payment_date || null,
        total_amount: form.total_amount
          ? Number(form.total_amount.replace(/[^\d]/g, ""))
          : null,
        process_number: form.process_number.trim() || null,
      };
      const res = await fetch("/api/practice-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "등록 실패");
        return;
      }
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={styles.modal_overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal} style={{ maxWidth: 520 }}>
        <div className={styles.modal_header}>
          <h3 className={styles.modal_title}>실습 매출 추가</h3>
          <button
            className={styles.modal_close}
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className={styles.modal_body}>
          <div className={styles.modal_field}>
            <label className={styles.modal_label}>학생명 *</label>
            <input
              className={styles.modal_input}
              autoFocus
              value={form.student_name}
              onChange={(e) =>
                setForm((p) => ({ ...p, student_name: e.target.value }))
              }
            />
          </div>
          <div className={styles.modal_field}>
            <label className={styles.modal_label}>연락처</label>
            <input
              className={styles.modal_input}
              value={form.phone}
              inputMode="numeric"
              onChange={(e) =>
                setForm((p) => ({ ...p, phone: autoHyphenPhone(e.target.value) }))
              }
              placeholder="010-XXXX-XXXX"
            />
          </div>
          <div className={styles.modal_field}>
            <label className={styles.modal_label}>분류</label>
            <CustomSelect
              value={form.category}
              options={[
                { value: "실습", label: "실습" },
                { value: "후납", label: "후납" },
              ]}
              onChange={(v) =>
                setForm((p) => ({ ...p, category: v as Category }))
              }
              minWidth={140}
            />
          </div>
          <div className={styles.modal_field}>
            <label className={styles.modal_label}>결제방법</label>
            <CustomSelect
              value={form.payment_method}
              options={[
                { value: "card", label: "카드결제" },
                { value: "bank_transfer", label: "계좌이체" },
              ]}
              onChange={(v) =>
                setForm((p) => ({
                  ...p,
                  payment_method: v as PaymentMethod,
                }))
              }
              minWidth={140}
            />
          </div>
          <div className={styles.modal_field}>
            <label className={styles.modal_label}>결제일</label>
            <input
              type="date"
              className={styles.modal_input}
              value={form.payment_date}
              onChange={(e) =>
                setForm((p) => ({ ...p, payment_date: e.target.value }))
              }
            />
          </div>
          <div className={styles.modal_field}>
            <label className={styles.modal_label}>결제금액</label>
            <input
              className={styles.modal_input}
              inputMode="numeric"
              value={form.total_amount}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  total_amount: e.target.value.replace(/[^\d]/g, ""),
                }))
              }
              placeholder="110000"
            />
          </div>
          <div className={styles.modal_field}>
            <label className={styles.modal_label}>담당자</label>
            <input
              className={styles.modal_input}
              value={form.manager_name}
              onChange={(e) =>
                setForm((p) => ({ ...p, manager_name: e.target.value }))
              }
            />
          </div>
          <div className={styles.modal_field}>
            <label className={styles.modal_label}>(현)처리번호</label>
            <input
              className={styles.modal_input}
              value={form.process_number}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  process_number: autoHyphenPhone(e.target.value),
                }))
              }
              placeholder="010-XXXX-XXXX"
            />
          </div>
        </div>
        <div className={styles.modal_footer}>
          <button className={styles.btn_secondary} onClick={onClose}>
            취소
          </button>
          <button
            className={styles.btn_primary}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "저장 중..." : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InlineText({
  value,
  placeholder,
  onSave,
  width,
  disabled,
}: {
  value: string;
  placeholder?: string;
  onSave: (v: string) => void;
  width?: number;
  disabled?: boolean;
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
      disabled={disabled}
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

function InlinePhone({
  value,
  onSave,
  width,
  disabled,
}: {
  value: string;
  onSave: (v: string) => void;
  width?: number;
  disabled?: boolean;
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
      disabled={disabled}
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

function InlineNumber({
  value,
  onSave,
  align = "left",
  width,
  disabled,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
  align?: "left" | "right" | "center";
  width?: number;
  disabled?: boolean;
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
      disabled={disabled}
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
