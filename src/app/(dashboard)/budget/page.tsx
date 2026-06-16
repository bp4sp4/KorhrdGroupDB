"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────
interface DeptSummary {
  department_id: string;
  department_code: string | null;
  department_name: string;
  limit_amount: number;
  used_amount: number;
  available_amount: number;
  memo: string | null;
}

interface RefDept {
  id: string;
  code: string | null;
  name: string;
}
interface RefTeam {
  id: string;
  name: string;
  department_id: string;
}
interface RefCategory {
  id: string;
  name: string;
}

interface Tx {
  tx_key: string;
  account_number: string;
  tx_date: string;
  tx_time: string;
  tx_type: "in" | "out";
  amount: number;
  balance: number;
  summary: string;
  department_id: string | null;
  team_id: string | null;
  content: string;
  expense_category_id: string | null;
  is_budget: boolean;
}

// ─── Helpers ──────────────────────────────────────────────
function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function recentMonths(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

const won = (n: number) => (n ?? 0).toLocaleString();

// 출금 거래가 예산 사용액에 기여하는 본부/금액 (예산체크 + 본부지정 시에만)
function budgetContribution(t: Tx): { dept: string | null; amount: number } {
  const dept =
    t.tx_type === "out" && t.is_budget && t.department_id
      ? t.department_id
      : null;
  return { dept, amount: dept ? t.amount : 0 };
}

// 체크/본부변경을 가용예산에 즉시 반영 (서버 재조회 없이 → 깜빡임 제거)
function applyBudgetDelta(
  summary: DeptSummary[],
  oldTx: Tx,
  newTx: Tx,
): DeptSummary[] {
  const before = budgetContribution(oldTx);
  const after = budgetContribution(newTx);
  if (before.dept === after.dept && before.amount === after.amount)
    return summary;
  return summary.map((d) => {
    let used = d.used_amount;
    if (before.dept === d.department_id) used -= before.amount;
    if (after.dept === d.department_id) used += after.amount;
    if (used === d.used_amount) return d;
    return { ...d, used_amount: used, available_amount: d.limit_amount - used };
  });
}

export default function BudgetPage() {
  const [month, setMonth] = useState(currentYearMonth());
  const [seeAll, setSeeAll] = useState(false);

  const [summary, setSummary] = useState<DeptSummary[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [meta, setMeta] = useState<{
    departments: RefDept[];
    teams: RefTeam[];
    categories: RefCategory[];
  }>({
    departments: [],
    teams: [],
    categories: [],
  });
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [txLoaded, setTxLoaded] = useState(false);
  const [txTab, setTxTab] = useState<"in" | "out">("out");
  const [deptFilter, setDeptFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const months = useMemo(() => recentMonths(12), []);

  // ─── 예산 요약 ──────────────────────────────────────────
  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setError(null);
    try {
      const res = await fetch(`/api/budget/overview?month=${month}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "예산 조회 실패");
      setSeeAll(!!json.seeAll);
      setSummary(json.departments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "예산 조회 실패");
    } finally {
      setLoadingSummary(false);
    }
  }, [month]);

  useEffect(() => {
    loadSummary();
    setTxs([]);
    setTxLoaded(false);
  }, [loadSummary]);

  // ─── 입출금 조회 (신한 실시간) ──────────────────────────
  const loadTransactions = useCallback(async () => {
    setLoadingTx(true);
    setError(null);
    try {
      const params = new URLSearchParams({ month });
      if (deptFilter) params.set("department_id", deptFilter);
      const res = await fetch(`/api/budget/transactions?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "입출금 조회 실패");
      setMeta({
        departments: json.departments ?? [],
        teams: json.teams ?? [],
        categories: json.categories ?? [],
      });
      setTxs(json.transactions ?? []);
      setTxLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "입출금 조회 실패");
    } finally {
      setLoadingTx(false);
    }
  }, [month, deptFilter]);

  // ─── 예산 한도 저장 ─────────────────────────────────────
  const saveLimit = async (departmentId: string, value: number) => {
    try {
      const res = await fetch("/api/budget/limit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_id: departmentId,
          year_month: month,
          limit_amount: value,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "예산 한도 저장 실패");
      loadSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : "예산 한도 저장 실패");
    }
  };

  // ─── 거래 분류 저장 ─────────────────────────────────────
  const patchTx = async (tx: Tx, changes: Partial<Tx>) => {
    const next = { ...tx, ...changes };
    setTxs((prev) => prev.map((t) => (t.tx_key === tx.tx_key ? next : t)));
    // 가용예산 즉시 반영 (서버 재조회 없이 → 깜빡임 없음)
    setSummary((prev) => applyBudgetDelta(prev, tx, next));
    try {
      const res = await fetch("/api/budget/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tx_key: next.tx_key,
          account_number: next.account_number,
          tx_date: next.tx_date,
          tx_type: next.tx_type,
          amount: next.amount,
          summary: next.summary,
          department_id: next.department_id,
          team_id: next.team_id,
          content: next.content,
          expense_category_id: next.expense_category_id,
          is_budget: next.is_budget,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "저장 실패");
    } catch (e) {
      // 실패 시 롤백
      setTxs((prev) => prev.map((t) => (t.tx_key === tx.tx_key ? tx : t)));
      setSummary((prev) => applyBudgetDelta(prev, next, tx));
      setError(e instanceof Error ? e.message : "저장 실패");
    }
  };

  const deposits = useMemo(() => txs.filter((t) => t.tx_type === "in"), [txs]);
  const withdrawals = useMemo(
    () => txs.filter((t) => t.tx_type === "out"),
    [txs],
  );

  const totals = useMemo(
    () => ({
      limit: summary.reduce((s, d) => s + d.limit_amount, 0),
      used: summary.reduce((s, d) => s + d.used_amount, 0),
      available: summary.reduce((s, d) => s + d.available_amount, 0),
    }),
    [summary],
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h1>예산현황</h1>
        </div>
        <div className={styles.headerActions}>
          <select
            className={styles.monthSelect}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m.replace("-", ".")}
              </option>
            ))}
          </select>
          <button
            className={styles.btnSecondary}
            onClick={loadSummary}
            disabled={loadingSummary}
          >
            <RefreshCw size={14} />
            새로고침
          </button>
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.layout}>
        {/* ─── 부서 가용 예산 ─── */}
        <section className={`${styles.section} ${styles.leftPane}`}>
          <h2 className={styles.sectionTitle}>부서 가용 예산</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>본부</th>
                  <th className={styles.colNum}>예산 한도</th>
                  <th className={styles.colNum}>사용액</th>
                  <th className={styles.colNum}>가용 예산</th>
                </tr>
              </thead>
              <tbody>
                {loadingSummary ? (
                  <tr>
                    <td colSpan={4} className={styles.emptyCell}>
                      불러오는 중...
                    </td>
                  </tr>
                ) : summary.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.emptyCell}>
                      표시할 본부가 없습니다.
                    </td>
                  </tr>
                ) : (
                  summary.map((d) => (
                    <tr key={d.department_id}>
                      <td>{d.department_name}</td>
                      <td className={styles.colNum}>
                        {seeAll ? (
                          <input
                            className={styles.limitInput}
                            type="number"
                            defaultValue={d.limit_amount || ""}
                            placeholder="0"
                            onBlur={(e) => {
                              const v = Math.max(
                                0,
                                Math.round(Number(e.target.value) || 0),
                              );
                              if (v !== d.limit_amount)
                                saveLimit(d.department_id, v);
                            }}
                          />
                        ) : (
                          won(d.limit_amount)
                        )}
                      </td>
                      <td className={`${styles.colNum} ${styles.used}`}>
                        {won(d.used_amount)}
                      </td>
                      <td
                        className={`${styles.colNum} ${d.available_amount < 0 ? styles.negative : styles.available}`}
                      >
                        {won(d.available_amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {summary.length > 1 && (
                <tfoot>
                  <tr>
                    <td>합계</td>
                    <td className={styles.colNum}>{won(totals.limit)}</td>
                    <td className={styles.colNum}>{won(totals.used)}</td>
                    <td className={styles.colNum}>{won(totals.available)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className={styles.hint}>
            가용 예산 = 예산 한도 − 사용액(예산 반영된 출금 합계).{" "}
            {seeAll
              ? "예산 한도 칸을 클릭해 수정할 수 있습니다."
              : "예산 한도 설정은 경영지원본부에서 관리합니다."}
          </p>
        </section>

        {/* ─── 입출금현황 ─── */}
        <section className={`${styles.section} ${styles.rightPane}`}>
          <div className={styles.txHeader}>
            <h2 className={styles.sectionTitle}>입금 · 출금현황</h2>
            <div className={styles.txControls}>
              {seeAll && (
                <select
                  className={styles.monthSelect}
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                >
                  <option value="">전체 본부</option>
                  {summary.map((d) => (
                    <option key={d.department_id} value={d.department_id}>
                      {d.department_name}
                    </option>
                  ))}
                </select>
              )}
              <button
                className={styles.btnPrimary}
                onClick={loadTransactions}
                disabled={loadingTx}
              >
                {loadingTx ? "신한 조회 중..." : "입출금 조회"}
              </button>
            </div>
          </div>

          {!txLoaded && !loadingTx && (
            <p className={styles.hint}>
              ‘입출금 조회’를 누르면 해당 월의 신한 거래내역을 실시간으로
              불러옵니다.
            </p>
          )}

          {txLoaded && (
            <>
              <div className={styles.tabBar}>
                <button
                  className={`${styles.tab} ${txTab === "out" ? styles.tabActive : ""}`}
                  onClick={() => setTxTab("out")}
                >
                  <ArrowUpFromLine size={15} />
                  출금현황
                  <span className={styles.tabCount}>{withdrawals.length}</span>
                </button>
                <button
                  className={`${styles.tab} ${txTab === "in" ? styles.tabActive : ""}`}
                  onClick={() => setTxTab("in")}
                >
                  <ArrowDownToLine size={15} />
                  입금현황
                  <span className={styles.tabCount}>{deposits.length}</span>
                </button>
              </div>
              <TxTable
                rows={txTab === "out" ? withdrawals : deposits}
                meta={meta}
                onPatch={patchTx}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── 입출금 테이블 ────────────────────────────────────────
function TxTable({
  rows,
  meta,
  onPatch,
}: {
  rows: Tx[];
  meta: { departments: RefDept[]; teams: RefTeam[]; categories: RefCategory[] };
  onPatch: (tx: Tx, changes: Partial<Tx>) => void;
}) {
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className={styles.txBlock}>
      <div className={styles.txTitleRow}>
        <span className={styles.txTotal}>
          합계 {rows.length}건 · {won(total)}원
        </span>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colCheck}>예산</th>
              <th>본부</th>
              <th>부서</th>
              <th className={styles.colDate}>일자</th>
              <th>계좌번호</th>
              <th className={styles.colNum}>금액</th>
              <th>적요</th>
              <th>내용</th>
              <th>계정과목</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className={styles.emptyCell}>
                  거래 없음
                </td>
              </tr>
            ) : (
              rows.map((t) => {
                const teamOptions = meta.teams.filter(
                  (tm) => tm.department_id === t.department_id,
                );
                return (
                  <tr key={t.tx_key}>
                    <td className={styles.colCheck}>
                      <input
                        type="checkbox"
                        checked={t.is_budget}
                        onChange={(e) =>
                          onPatch(t, { is_budget: e.target.checked })
                        }
                      />
                    </td>
                    <td>
                      <select
                        className={styles.cellSelect}
                        value={t.department_id ?? ""}
                        onChange={(e) =>
                          onPatch(t, {
                            department_id: e.target.value || null,
                            team_id: null,
                          })
                        }
                      >
                        <option value="">-</option>
                        {meta.departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className={styles.cellSelect}
                        value={t.team_id ?? ""}
                        onChange={(e) =>
                          onPatch(t, { team_id: e.target.value || null })
                        }
                        disabled={!t.department_id}
                      >
                        <option value="">-</option>
                        {teamOptions.map((tm) => (
                          <option key={tm.id} value={tm.id}>
                            {tm.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={styles.colDate}>{t.tx_date}</td>
                    <td className={styles.acctCell}>{t.account_number}</td>
                    <td
                      className={`${styles.colNum} ${t.tx_type === "in" ? styles.deposit : styles.withdraw}`}
                    >
                      {won(t.amount)}
                    </td>
                    <td className={styles.summaryCell}>{t.summary || "-"}</td>
                    <td>
                      <input
                        className={styles.cellInput}
                        type="text"
                        defaultValue={t.content}
                        placeholder="내용"
                        onBlur={(e) => {
                          if (e.target.value !== t.content)
                            onPatch(t, { content: e.target.value });
                        }}
                      />
                    </td>
                    <td>
                      <select
                        className={styles.cellSelect}
                        value={t.expense_category_id ?? ""}
                        onChange={(e) =>
                          onPatch(t, {
                            expense_category_id: e.target.value || null,
                          })
                        }
                      >
                        <option value="">-</option>
                        {meta.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
