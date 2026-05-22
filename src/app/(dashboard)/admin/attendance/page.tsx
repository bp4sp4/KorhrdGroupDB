"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { createClient } from "@/lib/supabase/client";

// ─── 타입 ────────────────────────────────────────────────────────────────
interface Employee {
  id: string;
  name: string;
  email: string;
  department?: string | null;
  workDays: number;
  regularMinutes: number;
  otMinutes: number;
  lateCount: number;
  missedCount: number;
}

type DayStatus = "normal" | "late" | "ot" | "miss" | "halfday" | "off";

interface DayRecord {
  recordId: number; // DB id
  employeeId: string;
  date: string;
  dayLabel: string;
  weekday: string;
  isWeekend?: boolean;
  in?: string;
  out?: string;
  recordedIn?: string;
  recordedOut?: string;
  regularLabel?: string;
  otLabel?: string;
  status: DayStatus;
}

// ─── 유틸 ────────────────────────────────────────────────────────────────
const fmtHM = (mins: number): string => {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

function thisMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function monthLabel(month: string): string {
  return month.replace("-", ". ");
}

function monthSubtitle(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  // 영업일 카운트 (월-금)
  let businessDays = 0;
  let elapsedBusinessDays = 0;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  for (let i = 1; i <= lastDay; i++) {
    const d = new Date(y, m - 1, i);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      businessDays += 1;
      const dStr = `${y}-${String(m).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      if (dStr <= todayStr) elapsedBusinessDays += 1;
    }
  }
  return `${m}월 1일 ~ ${m}월 ${lastDay}일 · ${businessDays}영업일 중 ${elapsedBusinessDays}일 경과`;
}

function formatTime(iso: string | null): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

function dayLabel(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}/${d}`;
}

function weekdayLabel(date: string): { name: string; isWeekend: boolean } {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  const names = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  return { name: names[dow], isWeekend: dow === 0 || dow === 6 };
}

// "HH:mm" (KST) + date(YYYY-MM-DD) → ISO UTC
function timeToIso(date: string, time: string): string {
  if (!time) return "";
  const [hh, mm] = time.split(":").map(Number);
  const [y, mo, da] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, da, hh - 9, mm)).toISOString();
}

// 지각 판정 (실제 출근 시각이 KST 10:00 이후)
function isLate(clockInIso: string): boolean {
  const kstStr = new Date(clockInIso).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul",
  });
  const [h, m] = kstStr.split(":").map(Number);
  return h > 10 || (h === 10 && m > 0);
}

// API DayRow → DayRecord 변환
interface ApiDayRow {
  id: number;
  user_id: number;
  date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  recognized_clock_in: string;
  recognized_clock_out: string | null;
  work_minutes: number;
  overtime_minutes: number;
  is_invalid: boolean;
  edited_by_admin: boolean;
  admin_note: string | null;
}

function toDayRecord(r: ApiDayRow): DayRecord {
  const { name: weekday, isWeekend } = weekdayLabel(r.date);
  let status: DayStatus = "normal";
  if (r.is_invalid) status = "miss";
  else if (r.overtime_minutes > 0) status = "ot";
  else if (isLate(r.clock_in_at)) status = "late";
  else if (r.work_minutes > 0 && r.work_minutes < 300) status = "halfday";

  return {
    recordId: r.id,
    employeeId: String(r.user_id),
    date: r.date,
    dayLabel: dayLabel(r.date),
    weekday,
    isWeekend,
    in: formatTime(r.clock_in_at),
    out: formatTime(r.clock_out_at) ?? undefined,
    recordedIn: formatTime(r.recognized_clock_in),
    recordedOut: formatTime(r.recognized_clock_out) ?? undefined,
    regularLabel: fmtHM(r.work_minutes),
    otLabel: r.overtime_minutes > 0 ? fmtHM(r.overtime_minutes) : undefined,
    status,
  };
}

// 다운로드 CSV
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const hasIssue = (e: Employee) => e.lateCount > 0 || e.missedCount > 0 || e.otMinutes > 0;
const hasRecord = (e: Employee) => e.workDays > 0;

// ─── 메인 ────────────────────────────────────────────────────────────────
export default function AdminAttendancePage() {
  const [month, setMonth] = useState<string>(thisMonth());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "issue" | "empty">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // 직원 목록 (월간 요약) 로드
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/attendance/summary?month=${month}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const list: Employee[] = (data.summaries ?? []).map((s: {
        user_id: number; user_name: string; user_username: string | null;
        department_name: string | null;
        days_worked: number; total_work_minutes: number; total_overtime_minutes: number;
        late_count: number; invalid_count: number;
      }) => ({
        id: String(s.user_id),
        name: s.user_name,
        email: s.user_username ?? "",
        department: s.department_name ?? null,
        workDays: s.days_worked,
        regularMinutes: s.total_work_minutes,
        otMinutes: s.total_overtime_minutes,
        lateCount: s.late_count,
        missedCount: s.invalid_count,
      }));
      setEmployees(list);
      // 첫 직원 자동 선택 (기존 선택이 없거나 목록에 없을 경우)
      if (list.length > 0 && (!selectedId || !list.find((e) => e.id === selectedId))) {
        setSelectedId(list[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [month, selectedId]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // 선택된 직원의 일별 기록 로드
  const fetchRecords = useCallback(async (userId: string) => {
    if (!userId) return;
    setRecordsLoading(true);
    setEditingDate(null);
    try {
      const { from, to } = monthRange(month);
      const params = new URLSearchParams({ from, to, user_id: userId });
      const res = await fetch(`/api/admin/attendance?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setRecords([]);
        return;
      }
      const data = await res.json();
      const list = ((data.records ?? []) as ApiDayRow[]).map(toDayRecord);
      setRecords(list);
    } finally {
      setRecordsLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchRecords(selectedId);
  }, [selectedId, fetchRecords]);

  // Supabase Realtime — 변경 시 요약 + 상세 동시 새로고침
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-attendance-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        () => {
          fetchEmployees();
          if (selectedId) fetchRecords(selectedId);
        },
      )
      .subscribe((status, err) => {
        if (err) console.log("[admin attendance] subscribe error:", err);
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEmployees, fetchRecords, selectedId]);

  // ─── 필터 / 통계 ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (filter === "issue" && !hasIssue(e)) return false;
      if (filter === "empty" && hasRecord(e)) return false;
      if (q && !e.name.toLowerCase().includes(q) && !e.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [employees, filter, query]);

  const counts = useMemo(() => ({
    all: employees.length,
    issue: employees.filter(hasIssue).length,
    empty: employees.filter((e) => !hasRecord(e)).length,
  }), [employees]);

  const totals = useMemo(() => {
    const totalRegular = employees.reduce((s, e) => s + e.regularMinutes, 0);
    const totalOt = employees.reduce((s, e) => s + e.otMinutes, 0);
    const totalLate = employees.reduce((s, e) => s + e.lateCount, 0);
    const totalMiss = employees.reduce((s, e) => s + e.missedCount, 0);
    const recorded = employees.filter(hasRecord).length;
    return {
      totalCount: employees.length,
      recordedCount: recorded,
      avgRegular: recorded
        ? Math.round((totalRegular / employees.length / 60) * 10) / 10
        : 0,
      otLabel: fmtHM(totalOt),
      otPeople: employees.filter((e) => e.otMinutes > 0).length,
      late: totalLate,
      latePeople: employees.filter((e) => e.lateCount > 0).length,
      miss: totalMiss,
      missTopName: employees.find((e) => e.missedCount > 0)?.name,
    };
  }, [employees]);

  const selected = employees.find((e) => e.id === selectedId);

  // ─── 액션 ─────────────────────────────────────────────────────────────
  const handleSelect = (id: string) => {
    setSelectedId(id);
    setEditingDate(null);
  };

  const handleSave = async (record: DayRecord, patch: Partial<DayRecord>) => {
    setSavingEdit(true);
    try {
      const body: { clock_in_at?: string; clock_out_at?: string | null } = {};
      if (patch.in !== undefined) {
        body.clock_in_at = timeToIso(record.date, patch.in);
      }
      if (patch.out !== undefined) {
        body.clock_out_at = patch.out ? timeToIso(record.date, patch.out) : null;
      }
      const res = await fetch(`/api/admin/attendance/${record.recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "저장 실패");
        return;
      }
      setEditingDate(null);
      // 요약 + 상세 모두 새로고침
      await Promise.all([fetchEmployees(), fetchRecords(selectedId)]);
    } finally {
      setSavingEdit(false);
    }
  };

  // 이전/다음 직원 (필터된 리스트 기준)
  const moveSelection = (delta: number) => {
    const idx = filtered.findIndex((e) => e.id === selectedId);
    if (idx === -1) return;
    const next = filtered[idx + delta];
    if (next) handleSelect(next.id);
  };

  // 다운로드
  const handleDownload = () => {
    const rows: (string | number)[][] = [
      [
        "이름", "계정", "출근일수", "정규 근무 (분)", "정규 근무 (h:m)",
        "야근 (분)", "야근 (h:m)", "지각", "퇴근 미체크",
      ],
      ...filtered.map((e) => [
        e.name, e.email, e.workDays, e.regularMinutes, fmtHM(e.regularMinutes),
        e.otMinutes, fmtHM(e.otMinutes), e.lateCount, e.missedCount,
      ]),
    ];
    downloadCsv(`attendance_summary_${month}.csv`, rows);
  };

  const handleDownloadPersonal = () => {
    if (!selected) return;
    const statusKo: Record<DayStatus, string> = {
      normal: "정상",
      late: "지각",
      ot: "야근",
      miss: "퇴근 미체크",
      halfday: "조퇴/반차",
      off: "휴무",
    };
    const rows: (string | number)[][] = [
      ["날짜", "요일", "출근", "퇴근", "인정 출근", "인정 퇴근", "정규", "야근", "상태"],
      ...records.map((r) => [
        r.date, r.weekday, r.in ?? "", r.out ?? "",
        r.recordedIn ?? "", r.recordedOut ?? "",
        r.regularLabel ?? "", r.otLabel ?? "", statusKo[r.status],
      ]),
    ];
    downloadCsv(`attendance_${selected.name}_${month}.csv`, rows);
  };

  return (
    <div className={styles.app}>
      <main className={styles.main}>
        {/* HEAD */}
        <div className={styles.pageHead}>
          <div>
            <h1>근태관리</h1>
            <div className={styles.ps}>
              전체 {totals.totalCount}명 · 이번 달 {monthSubtitle(month)}
            </div>
          </div>
          <div className={styles.headActions}>
            <div className={styles.monthPicker}>
              <button
                className={styles.monthNav}
                onClick={() => setMonth(shiftMonth(month, -1))}
              >
                ‹
              </button>
              <span className={styles.monthV}>{monthLabel(month)}</span>
              <button
                className={styles.monthNav}
                onClick={() => setMonth(shiftMonth(month, 1))}
              >
                ›
              </button>
            </div>
            <button className={styles.ghost} onClick={() => setMonth(thisMonth())}>
              이번 달
            </button>
            <button className={styles.ghost} onClick={handleDownload}>
              <DownloadIcon /> 다운로드
            </button>
          </div>
        </div>

        {/* SUMMARY */}
        <section className={styles.summary}>
          <SummaryCard
            k="전체 직원" v={String(totals.totalCount)} unit="명"
            desc={<>기록 있음 <b>{totals.recordedCount}명</b> · 미기록 <b>{totals.totalCount - totals.recordedCount}명</b></>}
            iconBg="#e8f3ff" iconFg="#3182f6" active
            icon={<UsersIcon />}
          />
          <SummaryCard
            k="평균 정규 근무" v={String(totals.avgRegular)} unit="시간 / 인"
            desc={<>기록 있음 {totals.recordedCount}명 기준</>}
            iconBg="#e6f9ee" iconFg="#15803d"
            icon={<ClockIcon />}
          />
          <SummaryCard
            k="야근 누적" v={totals.otLabel}
            desc={<>야근자 <b>{totals.otPeople}명</b></>}
            iconBg="#fff4e0" iconFg="#c2570c"
            icon={<BoltIcon />}
          />
          <SummaryCard
            k="지각" v={String(totals.late)} unit="회"
            desc={<>지각 직원 <b>{totals.latePeople}명</b></>}
            iconBg="#ffeef0" iconFg="#f04452"
            icon={<LateIcon />}
          />
          <SummaryCard
            k="퇴근 미체크" v={String(totals.miss)} unit="일"
            desc={
              totals.missTopName
                ? <>{totals.missTopName} 외 <b>{Math.max(0, employees.filter((e) => e.missedCount > 0).length - 1)}명</b></>
                : <>없음</>
            }
            iconBg="#f1ecff" iconFg="#6d28d9"
            icon={<AlertIcon />}
          />
        </section>

        {/* SPLIT */}
        <div className={styles.split}>
          {/* LIST */}
          <section className={styles.listCard}>
            <div className={styles.listToolbar}>
              <div className={styles.search}>
                <SearchIcon />
                <input
                  placeholder="이름, 계정으로 검색"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <FilterChip on={filter === "all"} onClick={() => setFilter("all")} label="전체" n={counts.all} />
              <FilterChip on={filter === "issue"} onClick={() => setFilter("issue")} label="이슈 있음" n={counts.issue} />
              <FilterChip on={filter === "empty"} onClick={() => setFilter("empty")} label="미기록" n={counts.empty} />
            </div>

            <div className={styles.tblHead}>
              <div>이름 / 계정</div>
              <div>출근일</div>
              <div>정규 근무</div>
              <div>야근</div>
              <div>이슈</div>
            </div>

            <div className={styles.tblBody}>
              {loading ? (
                <div className={styles.empty}>
                  <div className={styles.emptyT}>불러오는 중...</div>
                </div>
              ) : filtered.length === 0 ? (
                <div className={styles.empty}>
                  <div className={styles.emptyT}>결과가 없어요</div>
                  <div className={styles.emptyS}>다른 검색어나 필터를 시도해 보세요.</div>
                </div>
              ) : (
                filtered.map((emp) => (
                  <EmployeeRow
                    key={emp.id}
                    emp={emp}
                    selected={emp.id === selectedId}
                    onSelect={() => handleSelect(emp.id)}
                  />
                ))
              )}
            </div>

            <div className={styles.pager}>
              <div className={styles.pagerInfo}>
                총 <b>{filtered.length}명</b> {filter !== "all" ? `(전체 ${counts.all}명)` : ""}
              </div>
            </div>
          </section>

          {/* DETAIL */}
          <section className={styles.detail}>
            {selected ? (
              <DetailPanel
                emp={selected}
                records={records}
                recordsLoading={recordsLoading}
                month={month}
                editingDate={editingDate}
                onStartEdit={(date) => setEditingDate(date)}
                onCancelEdit={() => setEditingDate(null)}
                onSave={handleSave}
                onPrev={() => moveSelection(-1)}
                onNext={() => moveSelection(1)}
                onDownloadPersonal={handleDownloadPersonal}
                saving={savingEdit}
              />
            ) : (
              <div className={styles.empty} style={{ padding: 80 }}>
                <div className={styles.emptyT}>직원을 선택해 주세요</div>
                <div className={styles.emptyS}>좌측 리스트에서 직원을 클릭하면 일별 기록이 표시됩니다.</div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────
function SummaryCard({
  k, v, unit, desc, iconBg, iconFg, icon, active,
}: {
  k: string; v: string; unit?: string;
  desc: React.ReactNode;
  iconBg: string; iconFg: string;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div className={`${styles.sc} ${active ? styles.scActive : ""}`}>
      <div className={styles.scTop}>
        <div className={styles.scK}>{k}</div>
        <div className={styles.scIco} style={{ background: iconBg, color: iconFg }}>
          {icon}
        </div>
      </div>
      <div className={styles.scV}>
        {v}
        {unit && <span className={styles.scU}>{unit}</span>}
      </div>
      <div className={styles.scD}>{desc}</div>
    </div>
  );
}

// ─── Filter Chip ─────────────────────────────────────────────────────
function FilterChip({
  on, label, n, onClick,
}: {
  on?: boolean; label: string; n: number; onClick?: () => void;
}) {
  return (
    <button
      className={`${styles.filterChip} ${on ? styles.filterChipOn : ""}`}
      onClick={onClick}
    >
      {label} <span className="n">{n}</span>
    </button>
  );
}

// ─── Employee Row ────────────────────────────────────────────────────
function EmployeeRow({
  emp, selected, onSelect,
}: {
  emp: Employee; selected: boolean; onSelect: () => void;
}) {
  const recorded = hasRecord(emp);
  return (
    <div
      className={`${styles.row} ${selected ? styles.rowSel : ""}`}
      onClick={onSelect}
    >
      <div className={styles.who}>
        <div className="n">{emp.name}</div>
        <div className="m">{emp.email}</div>
      </div>
      <div className={`${styles.col} ${!recorded ? styles.colZero : ""}`}>
        {emp.workDays}일
      </div>
      <div className={`${styles.col} ${!recorded ? styles.colMuted : ""}`}>
        {recorded ? fmtHM(emp.regularMinutes) : "—"}
      </div>
      <div className={`${styles.col} ${!emp.otMinutes ? styles.colMuted : ""}`}>
        {emp.otMinutes ? (
          <span className={`${styles.chip} ${styles.chipOt}`}>
            {fmtHM(emp.otMinutes)}
          </span>
        ) : (
          "—"
        )}
      </div>
      <div className={styles.colIssue}>
        {emp.lateCount > 0 && (
          <span className={`${styles.chip} ${styles.chipLate}`}>지각 {emp.lateCount}</span>
        )}
        {emp.missedCount > 0 && (
          <span className={`${styles.chip} ${styles.chipMiss}`}>미체크 {emp.missedCount}</span>
        )}
      </div>
    </div>
  );
}

// ─── Detail Panel ────────────────────────────────────────────────────
interface DetailPanelProps {
  emp: Employee;
  records: DayRecord[];
  recordsLoading: boolean;
  month: string;
  editingDate: string | null;
  onStartEdit: (date: string) => void;
  onCancelEdit: () => void;
  onSave: (record: DayRecord, patch: Partial<DayRecord>) => void;
  onPrev: () => void;
  onNext: () => void;
  onDownloadPersonal: () => void;
  saving: boolean;
}

function DetailPanel({
  emp, records, recordsLoading, month, editingDate,
  onStartEdit, onCancelEdit, onSave, onPrev, onNext, onDownloadPersonal, saving,
}: DetailPanelProps) {
  const [tab, setTab] = useState<"all" | "issue">("all");
  const list =
    tab === "all"
      ? records
      : records.filter((r) => r.status === "late" || r.status === "miss" || r.status === "ot");

  const [y, m] = month.split("-");

  return (
    <>
      <div className={styles.dHead}>
        <div className={styles.dWho}>
          <div className={styles.dInfo}>
            <div className="n">
              {emp.name}
              {emp.department && <span className="dept">{emp.department}</span>}
            </div>
            <div className="m">{emp.email} · {y}년 {Number(m)}월</div>
          </div>
        </div>
        <div className={styles.dControls}>
          <button title="이전 직원" onClick={onPrev}><ChevronLeftIcon /></button>
          <button title="다음 직원" onClick={onNext}><ChevronRightIcon /></button>
        </div>
      </div>

      <div className={styles.dStats}>
        <DetailStat k="출근일" v={`${emp.workDays}일`} />
        <DetailStat k="정규 근무" v={fmtHM(emp.regularMinutes)} />
        <DetailStat k="야근" v={fmtHM(emp.otMinutes)} tone={emp.otMinutes ? "warn" : undefined} />
        <DetailStat
          k="지각 / 미체크"
          v={`${emp.lateCount} / ${emp.missedCount}`}
          tone={emp.lateCount || emp.missedCount ? "bad" : undefined}
        />
      </div>

      <div className={styles.dListH}>
        <div className="t">일별 기록</div>
        <div className={styles.dListHActions}>
          <button
            className={tab === "all" ? styles.onTab : ""}
            onClick={() => setTab("all")}
          >
            전체
          </button>
          <button
            className={tab === "issue" ? styles.onTab : ""}
            onClick={() => setTab("issue")}
          >
            이슈만
          </button>
        </div>
      </div>

      <div className={styles.dList}>
        {recordsLoading ? (
          <div className={styles.empty}>
            <div className={styles.emptyT}>불러오는 중...</div>
          </div>
        ) : list.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyT}>기록이 없어요</div>
            <div className={styles.emptyS}>
              이번 달 해당 조건의 기록이 없습니다.
            </div>
          </div>
        ) : (
          list.map((r) => (
            <React.Fragment key={r.date}>
              {editingDate === r.date && (
                <EditBar
                  record={r}
                  onCancel={onCancelEdit}
                  onSave={(patch) => onSave(r, patch)}
                  saving={saving}
                />
              )}
              <DayRow
                record={r}
                editing={editingDate === r.date}
                onClick={() => onStartEdit(r.date)}
              />
            </React.Fragment>
          ))
        )}
      </div>

      <div className={styles.dFoot}>
        <button className={styles.ghostFoot} onClick={onDownloadPersonal}>
          <DownloadIcon /> 개인별 CSV
        </button>
      </div>
    </>
  );
}

function DetailStat({
  k, v, tone,
}: {
  k: string; v: string; tone?: "warn" | "bad";
}) {
  return (
    <div className={`${styles.ds} ${tone === "warn" ? styles.dsWarn : tone === "bad" ? styles.dsBad : ""}`}>
      <div className={styles.dsK}>{k}</div>
      <div className={styles.dsV}>{v}</div>
    </div>
  );
}

// ─── Day Row ─────────────────────────────────────────────────────────
const STATUS_LABEL: Record<DayStatus, { label: string; cls: string }> = {
  normal: { label: "정상", cls: "chipOk" },
  late: { label: "지각", cls: "chipLate" },
  ot: { label: "야근", cls: "chipOt" },
  miss: { label: "미체크", cls: "chipMiss" },
  halfday: { label: "조퇴/반차", cls: "chipMutedBg" },
  off: { label: "휴무", cls: "chipMutedBg" },
};

function DayRow({
  record, editing, onClick,
}: {
  record: DayRecord; editing: boolean; onClick: () => void;
}) {
  const s = STATUS_LABEL[record.status];
  return (
    <div
      className={`${styles.dayRow} ${editing ? styles.dayRowEditing : ""} ${record.isWeekend ? styles.dayRowWeekend : ""}`}
      onClick={onClick}
    >
      <div className="date">
        <div className="d">{record.dayLabel}</div>
        <div className="w">{record.weekday}</div>
      </div>
      <div className={`time ${styles.timeIn ?? ""}`}>{record.in ?? "—"}</div>
      <div className={`time ${record.out ? styles.timeOut : styles.timeMissing}`}>
        {record.out ?? "—"}
      </div>
      <div className={`work ${!record.regularLabel || record.regularLabel === "0m" ? styles.workEmpty : ""}`}>
        {record.regularLabel ?? "0m"}
      </div>
      <div className={`ot ${record.otLabel ? "" : styles.otEmpty}`}>
        {record.otLabel ?? "—"}
      </div>
      <div className="status">
        {editing ? (
          <span className={`${styles.chip} ${styles.chipEditing}`}>수정중</span>
        ) : (
          <span className={`${styles.chip} ${styles[s.cls as keyof typeof styles] as string}`}>
            {s.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Edit Bar ────────────────────────────────────────────────────────
function EditBar({
  record, onCancel, onSave, saving,
}: {
  record: DayRecord; onCancel: () => void;
  onSave: (patch: Partial<DayRecord>) => void;
  saving: boolean;
}) {
  const [inT, setIn] = useState(record.in ?? "");
  const [outT, setOut] = useState(record.out ?? "");
  const [rIn, setRIn] = useState(record.recordedIn ?? "");
  const [rOut, setROut] = useState(record.recordedOut ?? "");

  return (
    <div className={styles.editBar}>
      <div className={styles.ebTopRow}>
        <div className={styles.ebT}>
          {record.dayLabel} ({record.weekday.charAt(0)}) 기록 수정
        </div>
        <div className={styles.ebActions}>
          <button className={styles.ebCancel} onClick={onCancel} disabled={saving}>
            취소
          </button>
          <button
            className={styles.ebSave}
            onClick={() => onSave({ in: inT, out: outT, recordedIn: rIn, recordedOut: rOut })}
            disabled={saving}
          >
            <CheckIcon /> {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
      <div className={styles.ebFields}>
        <EditField label="출근" value={inT} onChange={setIn} />
        <EditField label="퇴근" value={outT} onChange={setOut} />
        <EditField label="인정 출근 (참고)" value={rIn} onChange={setRIn} disabled />
        <EditField label="인정 퇴근 (참고)" value={rOut} onChange={setROut} disabled />
      </div>
    </div>
  );
}

function EditField({
  label, value, onChange, disabled,
}: {
  label: string; value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.ei}>
      <div className={styles.eiLbl}>{label}</div>
      <input
        className={styles.eiInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="HH:mm"
        disabled={disabled}
      />
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);
const ChevronLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);
const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);
const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);
const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
    <path d="m5 12 5 5 9-11" />
  </svg>
);
const UsersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <circle cx="9" cy="7" r="3" />
    <path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M16 3a4 4 0 0 1 0 8M21 21v-2a4 4 0 0 0-3-3.9" />
  </svg>
);
const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  </svg>
);
const BoltIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);
const LateIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  </svg>
);
const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
  </svg>
);
