"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import styles from "./AttendanceTab.module.css";
import { formatMinutes } from "@/lib/attendance";

// ─── 타입 ─────────────────────────────────────────────────────────────────
interface MonthlySummary {
  user_id: number;
  user_name: string;
  user_username: string | null;
  department_id: string | null;
  role: string;
  days_worked: number;
  total_work_minutes: number;
  total_overtime_minutes: number;
  late_count: number;
  invalid_count: number;
}

interface AttendanceRow {
  id: number;
  user_id: number;
  user_name: string;
  date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  recognized_clock_in: string;
  recognized_clock_out: string | null;
  work_minutes: number;
  overtime_minutes: number;
  edited_by_admin: boolean;
  admin_note: string | null;
  is_invalid: boolean;
}

type ViewMode = "monthly" | "daily";

// ─── 유틸 ─────────────────────────────────────────────────────────────────
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

function formatTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

function formatDateKo(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][dt.getDay()];
  return `${m}/${d} (${dow})`;
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const mo = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const da = String(kst.getUTCDate()).padStart(2, "0");
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${y}-${mo}-${da}T${hh}:${mm}`;
}

function localInputToIso(local: string): string {
  if (!local) return "";
  const [datePart, timePart] = local.split("T");
  const [y, mo, da] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  return new Date(Date.UTC(y, mo - 1, da, hh - 9, mm)).toISOString();
}

// CSV 다운로드 (BOM + 한글 지원)
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) =>
    r
      .map((c) => {
        const s = String(c ?? "");
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      })
      .join(","),
  ).join("\n");
  const blob = new Blob(["﻿" + csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── 컴포넌트 ────────────────────────────────────────────────────────────
interface EditModalState {
  row: AttendanceRow;
  clockInLocal: string;
  clockOutLocal: string;
  adminNote: string;
}

export default function AttendanceTab() {
  const [month, setMonth] = useState<string>(thisMonth());
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [dailyRows, setDailyRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // 직원 상세 팝업 (월간 요약 행 클릭 시)
  const [detailUser, setDetailUser] = useState<MonthlySummary | null>(null);
  const [detailRows, setDetailRows] = useState<AttendanceRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState<EditModalState | null>(null);
  const [saving, setSaving] = useState(false);

  // 월별 요약 로드
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/attendance/summary?month=${month}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setSummaries(data.summaries ?? []);
    } finally {
      setLoading(false);
    }
  }, [month]);

  // 일별 전체 기록 로드 (Daily 모드)
  const fetchDaily = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = monthRange(month);
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/admin/attendance?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setDailyRows(data.records ?? []);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    if (viewMode === "monthly") fetchSummary();
    else fetchDaily();
  }, [viewMode, fetchSummary, fetchDaily]);

  // 직원 행 클릭 → 그 달의 일별 상세 팝업
  const openDetail = async (user: MonthlySummary) => {
    setDetailUser(user);
    setDetailLoading(true);
    setDetailRows([]);
    try {
      const { from, to } = monthRange(month);
      const params = new URLSearchParams({
        from,
        to,
        user_id: String(user.user_id),
      });
      const res = await fetch(`/api/admin/attendance?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setDetailRows(data.records ?? []);
    } finally {
      setDetailLoading(false);
    }
  };

  const reloadDetail = async () => {
    if (!detailUser) return;
    const { from, to } = monthRange(month);
    const params = new URLSearchParams({
      from,
      to,
      user_id: String(detailUser.user_id),
    });
    const res = await fetch(`/api/admin/attendance?${params}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = await res.json();
    setDetailRows(data.records ?? []);
  };

  const openEdit = (row: AttendanceRow) => {
    setEditing({
      row,
      clockInLocal: isoToLocalInput(row.clock_in_at),
      clockOutLocal: isoToLocalInput(row.clock_out_at),
      adminNote: row.admin_note ?? "",
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const body: {
        clock_in_at?: string;
        clock_out_at?: string | null;
        admin_note?: string;
      } = { admin_note: editing.adminNote };
      if (editing.clockInLocal) {
        body.clock_in_at = localInputToIso(editing.clockInLocal);
      }
      body.clock_out_at = editing.clockOutLocal
        ? localInputToIso(editing.clockOutLocal)
        : null;
      const res = await fetch(`/api/admin/attendance/${editing.row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "수정 실패");
        return;
      }
      setEditing(null);
      // 보고 있는 모드 새로고침
      if (viewMode === "monthly") {
        await fetchSummary();
        if (detailUser && detailUser.user_id === editing.row.user_id) {
          await reloadDetail();
        }
      } else {
        await fetchDaily();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: AttendanceRow) => {
    if (
      !confirm(`${row.user_name} ${formatDateKo(row.date)} 기록을 삭제하시겠습니까?`)
    )
      return;
    const res = await fetch(`/api/admin/attendance/${row.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "삭제 실패");
      return;
    }
    if (viewMode === "monthly") {
      await fetchSummary();
      if (detailUser && detailUser.user_id === row.user_id) {
        await reloadDetail();
      }
    } else {
      await fetchDaily();
    }
  };

  const handleDownloadMonthly = () => {
    const rows: (string | number)[][] = [
      [
        "이름",
        "계정",
        "출근일수",
        "정규 근무 (분)",
        "정규 근무 (h:m)",
        "야근 (분)",
        "야근 (h:m)",
        "지각",
        "퇴근 미체크",
      ],
      ...filteredSummaries.map((s) => [
        s.user_name,
        s.user_username ?? "",
        s.days_worked,
        s.total_work_minutes,
        formatMinutes(s.total_work_minutes),
        s.total_overtime_minutes,
        formatMinutes(s.total_overtime_minutes),
        s.late_count,
        s.invalid_count,
      ]),
    ];
    downloadCsv(`attendance_summary_${month}.csv`, rows);
  };

  const handleDownloadDaily = () => {
    const rows: (string | number)[][] = [
      [
        "이름",
        "날짜",
        "출근",
        "퇴근",
        "인정 출근",
        "인정 퇴근",
        "정규 근무 (분)",
        "야근 (분)",
        "상태",
        "관리자 메모",
      ],
      ...filteredDaily.map((r) => [
        r.user_name,
        r.date,
        formatTime(r.clock_in_at),
        r.clock_out_at ? formatTime(r.clock_out_at) : "",
        formatTime(r.recognized_clock_in),
        formatTime(r.recognized_clock_out),
        r.work_minutes,
        r.overtime_minutes,
        r.is_invalid ? "퇴근 미체크" : r.edited_by_admin ? "수정됨" : "",
        r.admin_note ?? "",
      ]),
    ];
    downloadCsv(`attendance_daily_${month}.csv`, rows);
  };

  const filteredSummaries = search.trim()
    ? summaries.filter((s) =>
        `${s.user_name} ${s.user_username ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
    : summaries;

  const filteredDaily = search.trim()
    ? dailyRows.filter((r) =>
        r.user_name.toLowerCase().includes(search.toLowerCase()),
      )
    : dailyRows;

  return (
    <div className={styles.tab}>
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <div className={styles.monthNav}>
            <button
              type="button"
              className={styles.monthNavBtn}
              onClick={() => setMonth(shiftMonth(month, -1))}
              aria-label="이전 달"
            >
              <ChevronLeft size={16} />
            </button>
            <span className={styles.monthLabel}>{month.replace("-", ". ")}</span>
            <button
              type="button"
              className={styles.monthNavBtn}
              onClick={() => setMonth(shiftMonth(month, 1))}
              aria-label="다음 달"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => setMonth(thisMonth())}
          >
            이번 달
          </button>
          <div className={styles.tabBar}>
            <button
              className={`${styles.tabBtn} ${viewMode === "monthly" ? styles.tabBtnActive : ""}`}
              onClick={() => setViewMode("monthly")}
            >
              월간 요약
            </button>
            <button
              className={`${styles.tabBtn} ${viewMode === "daily" ? styles.tabBtnActive : ""}`}
              onClick={() => setViewMode("daily")}
            >
              일별 상세
            </button>
          </div>
        </div>
        <div className={styles.headerLeft}>
          <input
            type="text"
            placeholder="이름/계정 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={
              viewMode === "monthly" ? handleDownloadMonthly : handleDownloadDaily
            }
            title="Excel(CSV) 다운로드"
          >
            <Download size={14} />
            다운로드
          </button>
        </div>
      </div>

      {viewMode === "monthly" ? (
        // ─── 월간 요약 ──────────────────────────────────────────────────
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>이름</th>
                <th>출근일수</th>
                <th>정규 근무</th>
                <th>야근</th>
                <th>지각</th>
                <th>퇴근 미체크</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    불러오는 중...
                  </td>
                </tr>
              ) : filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((s) => (
                  <tr
                    key={s.user_id}
                    className={styles.rowClickable}
                    onClick={() => openDetail(s)}
                  >
                    <td>{s.user_name}</td>
                    <td className={styles.numCell}>{s.days_worked}일</td>
                    <td className={styles.numCell}>
                      {formatMinutes(s.total_work_minutes)}
                    </td>
                    <td className={styles.numCell}>
                      {s.total_overtime_minutes > 0 ? (
                        <span
                          className={`${styles.badge} ${styles.badgeOvertime}`}
                        >
                          {formatMinutes(s.total_overtime_minutes)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className={styles.numCell}>
                      {s.late_count > 0 ? (
                        <span
                          className={`${styles.badge} ${styles.badgeLate}`}
                        >
                          {s.late_count}회
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className={styles.numCell}>
                      {s.invalid_count > 0 ? (
                        <span
                          className={`${styles.badge} ${styles.badgeInvalid}`}
                        >
                          {s.invalid_count}일
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        // ─── 일별 상세 ──────────────────────────────────────────────────
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>이름</th>
                <th>날짜</th>
                <th>출근</th>
                <th>퇴근</th>
                <th>인정 출근</th>
                <th>인정 퇴근</th>
                <th>정규 근무</th>
                <th>야근</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className={styles.empty}>
                    불러오는 중...
                  </td>
                </tr>
              ) : filteredDaily.length === 0 ? (
                <tr>
                  <td colSpan={10} className={styles.empty}>
                    기록이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredDaily.map((r) => (
                  <tr key={r.id}>
                    <td>{r.user_name}</td>
                    <td>{formatDateKo(r.date)}</td>
                    <td className={styles.numCell}>
                      {formatTime(r.clock_in_at)}
                    </td>
                    <td className={styles.numCell}>
                      {r.clock_out_at ? formatTime(r.clock_out_at) : "-"}
                    </td>
                    <td className={styles.numCell}>
                      {formatTime(r.recognized_clock_in)}
                    </td>
                    <td className={styles.numCell}>
                      {formatTime(r.recognized_clock_out)}
                    </td>
                    <td className={styles.numCell}>
                      {formatMinutes(r.work_minutes)}
                    </td>
                    <td className={styles.numCell}>
                      {r.overtime_minutes > 0 ? (
                        <span
                          className={`${styles.badge} ${styles.badgeOvertime}`}
                        >
                          {formatMinutes(r.overtime_minutes)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {r.is_invalid && (
                        <span
                          className={`${styles.badge} ${styles.badgeInvalid}`}
                        >
                          퇴근 미체크
                        </span>
                      )}
                      {r.edited_by_admin && (
                        <span
                          className={`${styles.badge} ${styles.badgeEdited}`}
                          style={{ marginLeft: 4 }}
                          title={r.admin_note ?? ""}
                        >
                          수정됨
                        </span>
                      )}
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          className={styles.btnGhost}
                          style={{ height: 28, fontSize: 11 }}
                          onClick={() => openEdit(r)}
                        >
                          수정
                        </button>
                        <button
                          className={styles.btnDanger}
                          onClick={() => handleDelete(r)}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {detailUser && (
        <div
          className={styles.modalOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetailUser(null);
          }}
        >
          <div className={styles.detailModal}>
            <div className={styles.detailModalHeader}>
              <div>
                <h3 className={styles.detailModalTitle}>
                  {detailUser.user_name} · {month.replace("-", ". ")}
                </h3>
                <p className={styles.detailModalSub}>
                  {detailUser.user_username ?? ""}
                </p>
              </div>
              <button
                type="button"
                className={styles.detailCloseBtn}
                onClick={() => setDetailUser(null)}
                aria-label="닫기"
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.detailSummaryStrip}>
              <div className={styles.detailSummaryCard}>
                <div className={styles.detailSummaryLabel}>출근일수</div>
                <div className={styles.detailSummaryValue}>
                  {detailUser.days_worked}일
                </div>
              </div>
              <div className={styles.detailSummaryCard}>
                <div className={styles.detailSummaryLabel}>정규 근무</div>
                <div className={styles.detailSummaryValue}>
                  {formatMinutes(detailUser.total_work_minutes)}
                </div>
              </div>
              <div className={styles.detailSummaryCard}>
                <div className={styles.detailSummaryLabel}>야근</div>
                <div className={styles.detailSummaryValue}>
                  {formatMinutes(detailUser.total_overtime_minutes)}
                </div>
              </div>
              <div className={styles.detailSummaryCard}>
                <div className={styles.detailSummaryLabel}>지각 / 미체크</div>
                <div
                  className={`${styles.detailSummaryValue} ${detailUser.invalid_count > 0 ? styles.detailSummaryValueAlert : ""}`}
                >
                  {detailUser.late_count} / {detailUser.invalid_count}
                </div>
              </div>
            </div>

            {detailLoading ? (
              <div className={styles.empty}>불러오는 중...</div>
            ) : detailRows.length === 0 ? (
              <div className={styles.empty}>이 달의 기록이 없습니다.</div>
            ) : (
              <table className={styles.expandTable}>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>출근</th>
                    <th>퇴근</th>
                    <th>인정 출근</th>
                    <th>인정 퇴근</th>
                    <th>정규</th>
                    <th>야근</th>
                    <th>상태</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDateKo(r.date)}</td>
                      <td className={styles.numCell}>
                        {formatTime(r.clock_in_at)}
                      </td>
                      <td className={styles.numCell}>
                        {r.clock_out_at ? formatTime(r.clock_out_at) : "-"}
                      </td>
                      <td className={styles.numCell}>
                        {formatTime(r.recognized_clock_in)}
                      </td>
                      <td className={styles.numCell}>
                        {formatTime(r.recognized_clock_out)}
                      </td>
                      <td className={styles.numCell}>
                        {formatMinutes(r.work_minutes)}
                      </td>
                      <td className={styles.numCell}>
                        {r.overtime_minutes > 0
                          ? formatMinutes(r.overtime_minutes)
                          : "-"}
                      </td>
                      <td>
                        {r.is_invalid && (
                          <span
                            className={`${styles.badge} ${styles.badgeInvalid}`}
                          >
                            미체크
                          </span>
                        )}
                        {r.edited_by_admin && (
                          <span
                            className={`${styles.badge} ${styles.badgeEdited}`}
                            style={{ marginLeft: 4 }}
                            title={r.admin_note ?? ""}
                          >
                            수정됨
                          </span>
                        )}
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            className={styles.btnGhost}
                            style={{ height: 26, fontSize: 11 }}
                            onClick={() => openEdit(r)}
                          >
                            수정
                          </button>
                          <button
                            className={styles.btnDanger}
                            onClick={() => handleDelete(r)}
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {editing && (
        <div
          className={styles.modalOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditing(null);
          }}
        >
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>출퇴근 시각 수정</h3>
            <p className={styles.modalSub}>
              {editing.row.user_name} · {formatDateKo(editing.row.date)}
            </p>
            <div className={styles.field}>
              <label className={styles.label}>출근 시각 (KST)</label>
              <input
                type="datetime-local"
                value={editing.clockInLocal}
                onChange={(e) =>
                  setEditing({ ...editing, clockInLocal: e.target.value })
                }
                className={styles.input2}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                퇴근 시각 (KST) — 비우면 미퇴근
              </label>
              <input
                type="datetime-local"
                value={editing.clockOutLocal}
                onChange={(e) =>
                  setEditing({ ...editing, clockOutLocal: e.target.value })
                }
                className={styles.input2}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>관리자 메모 (선택)</label>
              <textarea
                value={editing.adminNote}
                onChange={(e) =>
                  setEditing({ ...editing, adminNote: e.target.value })
                }
                className={styles.textarea}
                placeholder="수정 사유 등"
              />
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.btnGhost}
                onClick={() => setEditing(null)}
                disabled={saving}
              >
                취소
              </button>
              <button
                className={styles.btn}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
