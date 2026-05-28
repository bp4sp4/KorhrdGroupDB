"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, UserPlus, TrendingUp, Wallet } from "lucide-react";
import styles from "./page.module.css";
import { JournalDetailModal } from "./_detail/JournalDetailModal";
import { DateInput } from "@/components/ui/Calendar/DateInput";

interface AdminRow {
  user_id: number;
  display_name: string;
  position_name: string | null;
  department_name: string | null;
  total_inquiries: number;
  registrations: number;
  registration_rate: number;
  sales: number;
  journal_status: "submitted" | "draft" | "none";
  journal_updated_after_submit: boolean;
}

interface AdminHeader {
  totalInquiries: number;
  registrations: number;
  registrationRate: number;
  sales: number;
  delta: {
    inquiries: number;
    registrations: number;
    rate: number;
    sales: number;
  };
}

function todayKstYmd(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateWithWeekday(ymd: string): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const week = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")} (${week})`;
}

function formatDeltaCount(n: number, unit: string): string {
  if (n === 0) return `0${unit}`;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString()}${unit}`;
}

function statusBadge(
  status: "submitted" | "draft" | "none",
  editedAfter: boolean,
) {
  if (status === "submitted") {
    return editedAfter
      ? { label: "제출 완료 - 수정됨", cls: styles.badgeEdited }
      : { label: "제출 완료", cls: styles.badgeSubmitted };
  }
  if (status === "draft") return { label: "임시저장", cls: styles.badgeDraft };
  return { label: "미제출", cls: styles.badgeNone };
}

export default function WorkJournalAdminPage() {
  const [date, setDate] = useState<string>(todayKstYmd());
  const [header, setHeader] = useState<AdminHeader | null>(null);
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalUserId, setModalUserId] = useState<number | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/work-journal/admin/list?date=${encodeURIComponent(date)}`,
        { cache: "no-store" },
      );
      if (res.status === 403) {
        setError("관리자 권한이 필요합니다.");
        setRows([]);
        setHeader(null);
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "데이터를 불러오지 못했습니다.");
        return;
      }
      const data = await res.json();
      setHeader(data.header);
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return (
    <div className={styles.page}>
      {/* 헤더 KPI 4개 */}
      <section className={styles.kpiRow}>
        <KpiCard
          icon={<Users size={28} />}
          label="전체문의"
          value={`${(header?.totalInquiries ?? 0).toLocaleString()}건`}
          delta={
            header
              ? formatDeltaCount(header.delta.inquiries, "건")
              : undefined
          }
        />
        <KpiCard
          icon={<UserPlus size={28} />}
          label="등록 건수"
          value={`${(header?.registrations ?? 0).toLocaleString()}건`}
          delta={
            header
              ? formatDeltaCount(header.delta.registrations, "건")
              : undefined
          }
        />
        <KpiCard
          icon={<TrendingUp size={28} />}
          label="등록률 평균"
          value={`${(header?.registrationRate ?? 0).toFixed(1)}%`}
          delta={
            header
              ? `${header.delta.rate > 0 ? "+" : ""}${header.delta.rate.toFixed(1)}%p`
              : undefined
          }
        />
        <KpiCard
          icon={<Wallet size={28} />}
          label="매출"
          value={`${Math.round((header?.sales ?? 0) / 10000).toLocaleString()}만원`}
          delta={
            header
              ? `${header.delta.sales > 0 ? "+" : ""}${Math.round(header.delta.sales / 10000).toLocaleString()}만원`
              : undefined
          }
        />
      </section>

      {/* 테이블 */}
      <section className={styles.tableCard}>
        <div className={styles.tableHead}>
          <h2 className={styles.tableTitle}>직원 업무일지 현황</h2>
          <div className={styles.dateWrap}>
            <DateInput
              value={date}
              onChange={(v) => v && setDate(v)}
              variant="input"
              placeholder={formatDateWithWeekday(date)}
              triggerClassName={styles.dateTrigger}
            />
          </div>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thLeft}>직원</th>
                <th>전체 문의 수</th>
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
                  <td colSpan={7} className={styles.tdEmpty}>
                    불러오는 중...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.tdEmpty}>
                    표시할 직원이 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const badge = statusBadge(
                    r.journal_status,
                    r.journal_updated_after_submit,
                  );
                  return (
                    <tr key={r.user_id}>
                      <td className={styles.tdEmployee}>
                        <span className={styles.avatar}>
                          {r.display_name.charAt(0)}
                        </span>
                        <div className={styles.empInfo}>
                          <span className={styles.empName}>
                            {r.display_name}
                          </span>
                          <span className={styles.empPos}>
                            {r.department_name ?? ""}
                          </span>
                        </div>
                      </td>
                      <td className={styles.tdNum}>
                        {r.total_inquiries.toLocaleString()}
                      </td>
                      <td className={styles.tdNum}>
                        {r.registrations.toLocaleString()}
                      </td>
                      <td className={styles.tdNum}>
                        {r.registration_rate.toFixed(1)}%
                      </td>
                      <td className={styles.tdNum}>
                        {Math.round(r.sales / 10000).toLocaleString()}만원
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
                          onClick={() => setModalUserId(r.user_id)}
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
      </section>

      {modalUserId != null && (
        <JournalDetailModal
          userId={modalUserId}
          date={date}
          onClose={() => setModalUserId(null)}
        />
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  delta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiIcon}>{icon}</div>
      <div className={styles.kpiBody}>
        <div className={styles.kpiTopRow}>
          <span className={styles.kpiLabel}>{label}</span>
          <span className={styles.kpiValue}>{value}</span>
        </div>
        {delta && (
          <div className={styles.kpiDeltaRow}>
            <span>전일대비</span>
            <span>{delta}</span>
          </div>
        )}
      </div>
    </div>
  );
}
