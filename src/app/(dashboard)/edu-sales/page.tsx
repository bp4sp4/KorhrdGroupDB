"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import styles from "./page.module.css";
import CustomSelect from "../marketing/CustomSelect";
import { DateInput } from "@/components/ui/Calendar/DateInput";
import { DateRangeCalendar, type DateRange } from "@/components/DateRangeCalendar";
import { useGuide } from "@/components/guide/GuideProvider";
import SalesHeaderAdmin from "./SalesHeaderAdmin";
import SalesHeaderManager from "./SalesHeaderManager";
import { createClient } from "@/lib/supabase/client";

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
  education_center_name: string | null;
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
  { value: "card", label: "카드결제" },
  { value: "payapp_transfer", label: "페이앱 계좌이체" },
  { value: "bank_transfer", label: "계좌이체" },
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
  const { startById } = useGuide();
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [canViewAll, setCanViewAll] = useState(false);
  const [myDisplayName, setMyDisplayName] = useState<string>("");

  // 현재 로그인 사용자 이름 (담당자 헤더용)
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const name = (data?.displayName ?? data?.display_name ?? "").trim();
        if (name) setMyDisplayName(name);
      })
      .catch(() => {});
  }, []);

  // 교육원 마스터 목록 (edu_education_centers 테이블)
  const [centersFromDB, setCentersFromDB] = useState<string[]>([]);
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("edu_education_centers")
      .select("name")
      .order("id")
      .then(({ data }) => {
        const list = (data ?? [])
          .map((c) => c.name as string)
          .filter((n): n is string => Boolean(n));
        setCentersFromDB(list);
      });
  }, []);

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

  // 기간 선택 (DateRangeCalendar)
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

  // 모달
  // (구) 매출 등록/수정 모달 — 인라인 편집으로 대체됨

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      // '전체' 탭이 아니면 월별 필터 적용
      // cohort 파라미터는 클라이언트에서 필터링 (월별 추이 차트가 항상 모든 월을 보여주려면 전체 데이터 필요)
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
  }, [filterFrom, filterTo, search]);

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
      // 학생 row 필드 (edu_students 업데이트)
      education_center_name: string | null;
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

  // 행을 엑셀용 객체로 변환
  const rowToExportObject = (r: SalesRow) => ({
    교육원: r.education_center_name ?? "",
    개강반: r.cohort ?? "",
    학생명: r.student_name,
    아이디: r.student_username ?? "",
    전화번호: formatPhone(r.phone),
    단가: r.unit_price ?? "",
    매출: r.total_amount ?? "",
    결제방법: r.payment_method
      ? PAYMENT_METHOD_OPTIONS.find((o) => o.value === r.payment_method)?.label ?? ""
      : "",
    결제일: r.payment_date ?? "",
    과목수: r.subject_count ?? "",
    담당자: r.manager_name ?? "",
    특이사항: r.notes ?? "",
    "(현)처리번호": r.process_number ?? "",
    "(현)발급일자": r.issue_date ?? "",
    "발행 완료": r.is_published ? "Y" : "",
    "환불 상태": r.refund_status,
    "환불일": r.refund_date ?? "",
  });

  // ─── 엑셀 다운로드 ─────────────────────────────────────────────────
  // 전체 탭: 월별 시트로 분리 다운로드 / 특정 월: 단일 시트
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const today = new Date()
      .toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })
      .replace(/\.\s?/g, "-")
      .replace(/-$/, "");

    if (activeMonth === "전체") {
      // 월별 그룹핑 (cohortSortKey 순으로 정렬)
      const groups = new Map<string, SalesRow[]>();
      filteredRows.forEach((r) => {
        const key = r.cohort ?? "기타";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      });
      const sortedCohorts = Array.from(groups.keys()).sort(
        (a, b) => cohortSortKey(a) - cohortSortKey(b),
      );

      for (const cohort of sortedCohorts) {
        const rowsForCohort = groups.get(cohort)!;
        const ws = XLSX.utils.json_to_sheet(rowsForCohort.map(rowToExportObject));
        // 시트명 제한: 31자 + 금지문자 [ ] : * ? / \
        const safeSheetName = cohort.replace(/[[\]:*?/\\]/g, "_").slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
      }
      XLSX.writeFile(wb, `매출파일_전체_${today}.xlsx`);
    } else {
      // 특정 월 탭 — 단일 시트
      const ws = XLSX.utils.json_to_sheet(filteredRows.map(rowToExportObject));
      XLSX.utils.book_append_sheet(wb, ws, `매출_${activeMonth}`);
      XLSX.writeFile(wb, `매출파일_${activeMonth}_${today}.xlsx`);
    }
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
    // 활성 월 필터 (서버 cohort 파라미터 제거 → 클라이언트 필터)
    if (activeMonth && activeMonth !== "전체") {
      out = out.filter((r) => r.cohort === activeMonth);
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
    return out;
  }, [rows, activeMonth, filterPublished, filterManager, filterRefund]);

  // 교육원 옵션 — DB의 마스터 목록 + 현재 rows에 등장한 교육원 (학생 등록 시 입력된 신규 교육원 자동 포함)
  const centerOptions = useMemo(() => {
    const set = new Set<string>();
    centersFromDB.forEach((n) => set.add(n));
    rows.forEach((r) => {
      if (r.education_center_name) set.add(r.education_center_name);
    });
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
    return [
      { value: "", label: "-" },
      ...sorted.map((n) => ({ value: n, label: n })),
    ];
  }, [centersFromDB, rows]);

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

  // 현재 활성 월의 숫자 (활성 탭이 '전체'면 오늘 월)
  const now = new Date();
  const activeMonthNum = useMemo(() => {
    const m = activeMonth.match(/^(\d+)월$/);
    if (m) return Number(m[1]);
    return now.getMonth() + 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMonth]);
  const activeYear = now.getFullYear();
  const refundCountFiltered = useMemo(
    () => filteredRows.filter((r) => r.refund_status === "환불완료").length,
    [filteredRows],
  );

  // 본인 매출 (Manager 헤더 — own scope이거나 일치하는 manager_name 행만)
  const myRows = useMemo(() => {
    if (!myDisplayName) return filteredRows;
    return filteredRows.filter((r) => r.manager_name === myDisplayName);
  }, [filteredRows, myDisplayName]);
  const myRevenue = useMemo(
    () =>
      myRows
        .filter((r) => r.refund_status !== "환불완료")
        .reduce((s, r) => s + (r.total_amount ?? 0), 0),
    [myRows],
  );
  const myCount = myRows.length;
  const myRefundCount = useMemo(
    () => myRows.filter((r) => r.refund_status === "환불완료").length,
    [myRows],
  );

  // 일별 매출 분포 (활성 월 + 결제일 기준)
  const dailyDistribution = useMemo(() => {
    const totalDays = new Date(activeYear, activeMonthNum, 0).getDate();
    const arr: { d: number; amt: number }[] = [];
    for (let d = 1; d <= totalDays; d++) arr.push({ d, amt: 0 });
    const source = canViewAll ? filteredRows : myRows;
    source.forEach((r) => {
      if (r.refund_status === "환불완료") return;
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

  // 월별 히스토리 (현재 보유한 rows의 cohort 기준, 최대 5개월 — 활성 월 포함 직전 4개월)
  const monthHistory = useMemo(() => {
    const target = canViewAll ? rows : rows.filter((r) => r.manager_name === myDisplayName);
    const monthly: Record<number, number> = {};
    target.forEach((r) => {
      if (r.refund_status === "환불완료") return;
      const m = r.cohort?.match(/^(\d+)월$/);
      if (!m) return;
      const num = Number(m[1]);
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

  const handleGuideClick = () => startById("edu-sales-basics");

  return (
    <div className={styles.wrap}>
      {/* 헤더 — 권한별 분기 */}
      <div data-guide="edu-sales-stats">
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
            onGuide={handleGuideClick}
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
            onGuide={handleGuideClick}
            onMonthClick={(m) => setActiveMonth(`${m}월`)}
            onViewAllPeriod={() => setActiveMonth("전체")}
          />
        )}
      </div>

      {/* 월별 탭 */}
      <div className={styles.month_tabs} data-guide="edu-sales-month-tabs">
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
                setFilterRefund(v as "all" | "정상" | "환불대기" | "환불완료")
              }
              options={[
                { value: "all", label: "환불 전체" },
                { value: "정상", label: "정상" },
                { value: "환불대기", label: "환불대기" },
                { value: "환불완료", label: "환불완료" },
              ]}
              ariaLabel="환불 상태 필터"
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
          }}
        >
          초기화
        </button>
      </div>

      {/* 테이블 */}
      <div className={styles.table_wrap} data-guide="edu-sales-table">
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
                <th className={`${styles.th} ${styles.th_center}`}>교육원</th>
                <th className={`${styles.th} ${styles.th_center}`}>개강반</th>
                <th className={`${styles.th} ${styles.th_center}`}>학생명</th>
                <th className={`${styles.th} ${styles.th_center}`}>아이디</th>
                <th className={`${styles.th} ${styles.th_center}`}>전화번호</th>
                <th className={`${styles.th} ${styles.th_center}`}>단가</th>
                <th className={`${styles.th} ${styles.th_center}`}>매출</th>
                <th className={`${styles.th} ${styles.th_center}`}>결제방법</th>
                <th className={`${styles.th} ${styles.th_center}`}>결제일</th>
                <th className={`${styles.th} ${styles.th_center}`}>과목수</th>
                <th className={`${styles.th} ${styles.th_center}`}>담당자</th>
                <th className={`${styles.th} ${styles.th_center}`}>특이사항</th>
                <th className={`${styles.th} ${styles.th_center}`}>(현)처리번호</th>
                {canViewAll && (
                  <>
                    <th className={`${styles.th} ${styles.th_center}`}>(현)발급일자</th>
                    <th className={`${styles.th} ${styles.th_center}`}>발행 완료</th>
                    <th className={`${styles.th} ${styles.th_center}`}>환불 상태</th>
                    <th className={`${styles.th} ${styles.th_center}`}>관리</th>
                  </>
                )}
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
                    r.refund_status === "환불완료"
                      ? styles.tr_refunded
                      : r.refund_status === "환불대기"
                        ? styles.tr_refund_pending
                        : ""
                  }`}
                >
                  {/* 교육원 — 인라인 셀렉트 (학생 있으면 edu_students, orphan이면 edu_sales) */}
                  <td className={`${styles.td} ${styles.td_center}`}>
                    <div
                      className={
                        !r.education_center_name
                          ? styles.cell_empty_hint
                          : undefined
                      }
                    >
                      <CustomSelect
                        value={r.education_center_name ?? ""}
                        placeholder="-"
                        size="sm"
                        minWidth={110}
                        options={
                          centerOptions.length > 0
                            ? centerOptions
                            : [{ value: "", label: "-" }]
                        }
                        onChange={(v) =>
                          updateRow(r, {
                            education_center_name: v || null,
                          })
                        }
                      />
                    </div>
                  </td>
                  {/* 개강반 — 인라인 텍스트 */}
                  <td className={`${styles.td} ${styles.td_center}`}>
                    <InlineText
                      value={r.cohort ?? ""}
                      placeholder="-"
                      onSave={(v) => updateRow(r, { cohort: v.trim() || null })}
                      width={56}
                    />
                  </td>
                  {/* 학생명 — 읽기전용 */}
                  <td className={`${styles.td} ${styles.td_center} ${styles.td_strong}`}>
                    {r.student_name}
                  </td>
                  {/* 아이디 — 인라인 텍스트 */}
                  <td className={`${styles.td} ${styles.td_center}`}>
                    <InlineText
                      value={r.student_username ?? ""}
                      placeholder="-"
                      onSave={(v) =>
                        updateRow(r, { student_username: v.trim() || null })
                      }
                      width={90}
                    />
                  </td>
                  <td className={`${styles.td} ${styles.td_center}`}>{formatPhone(r.phone)}</td>
                  {/* 단가 — 인라인 숫자 */}
                  <td className={`${styles.td} ${styles.td_center}`}>
                    <InlineNumber
                      value={r.unit_price}
                      onSave={(v) => updateRow(r, { unit_price: v })}
                      align="center"
                      width={70}
                    />
                  </td>
                  {/* 매출 — 인라인 숫자 (환불완료 시 취소선) */}
                  <td
                    className={`${styles.td} ${styles.td_center} ${styles.td_strong} ${
                      r.refund_status === "환불완료"
                        ? styles.td_strikethrough
                        : ""
                    }`}
                  >
                    <InlineNumber
                      value={r.total_amount}
                      onSave={(v) => updateRow(r, { total_amount: v })}
                      align="center"
                      width={90}
                    />
                  </td>
                  {/* 결제방법 — 커스텀 select */}
                  <td className={`${styles.td} ${styles.td_center}`}>
                    <div className={!r.payment_method ? styles.cell_empty_hint : undefined}>
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
                    </div>
                  </td>
                  {/* 결제일 — 커스텀 달력 */}
                  <td className={`${styles.td} ${styles.td_center}`}>
                    <div className={!r.payment_date ? styles.cell_empty_hint : undefined}>
                      <DateInput
                        value={r.payment_date ?? ""}
                        onChange={(v) =>
                          updateRow(r, { payment_date: v || null })
                        }
                        placeholder="결제일"
                        triggerClassName={styles.inline_date_trigger}
                      />
                    </div>
                  </td>
                  {/* 과목수 — 인라인 숫자 */}
                  <td className={`${styles.td} ${styles.td_center}`}>
                    <div className={r.subject_count == null ? styles.cell_empty_hint : undefined}>
                      <InlineNumber
                        value={r.subject_count}
                        onSave={(v) => updateRow(r, { subject_count: v })}
                        align="center"
                        width={48}
                      />
                    </div>
                  </td>
                  <td className={`${styles.td} ${styles.td_center}`}>
                    {r.manager_name ?? <span className={styles.td_dim}>-</span>}
                  </td>
                  {/* 특이사항 — 클릭하면 팝업 */}
                  <td className={`${styles.td} ${styles.td_center} ${styles.td_notes}`}>
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
                  {/* (현)처리번호 — 자동 하이픈 (모두 노출, 본인 행만 편집 가능) */}
                  <td className={`${styles.td} ${styles.td_center}`}>
                    <InlinePhone
                      value={r.process_number ?? ""}
                      onSave={(v) =>
                        updateRow(r, { process_number: v.trim() || null })
                      }
                      width={130}
                    />
                  </td>
                  {canViewAll && (
                    <>
                      {/* (현)발급일자 — 커스텀 달력 */}
                      <td className={`${styles.td} ${styles.td_center}`}>
                        <DateInput
                          value={r.issue_date ?? ""}
                          onChange={(v) =>
                            updateRow(r, { issue_date: v || null })
                          }
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
                              updateRow(r, {
                                refund_status: v as RefundStatus,
                              })
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
                      <td className={`${styles.td} ${styles.td_center} ${styles.td_actions}`}>
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
                    </>
                  )}
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
