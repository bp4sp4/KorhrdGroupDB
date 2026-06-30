"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import styles from "./page.module.css";

// ─── Types ────────────────────────────────────────────────
interface TeamBreakdown {
  team_id: string;
  team_name: string;
  out_amount: number;
  in_amount: number;
}

interface DeptSummary {
  department_id: string;
  department_code: string | null;
  department_name: string;
  limit_amount: number;
  out_amount: number;
  in_amount: number;
  available_amount: number;
  can_edit_limit: boolean;
  memo: string | null;
  teams: TeamBreakdown[];
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
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth(); // 0-based
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return out;
}

const won = (n: number) => (n ?? 0).toLocaleString();

// 예산 반영 거래의 본부/팀별 기여 (체크 + 본부지정 시) — 출금/입금 분리
function budgetParts(t: Tx): {
  dept: string | null;
  team: string | null;
  out: number;
  in: number;
} {
  if (!t.is_budget || !t.department_id)
    return { dept: null, team: null, out: 0, in: 0 };
  return {
    dept: t.department_id,
    team: t.team_id,
    out: t.tx_type === "out" ? t.amount : 0,
    in: t.tx_type === "in" ? t.amount : 0,
  };
}

// 체크/본부·팀변경을 가용예산에 즉시 반영 (서버 재조회 없이 → 깜빡임 제거)
// 가용 = 한도 − 출금 + 입금
function applyBudgetDelta(
  summary: DeptSummary[],
  oldTx: Tx,
  newTx: Tx,
): DeptSummary[] {
  const before = budgetParts(oldTx);
  const after = budgetParts(newTx);
  if (
    before.dept === after.dept &&
    before.team === after.team &&
    before.out === after.out &&
    before.in === after.in
  )
    return summary;
  return summary.map((d) => {
    let out = d.out_amount;
    let inAmt = d.in_amount;
    let teams = d.teams;
    const adjustTeam = (teamId: string | null, dOut: number, dIn: number) => {
      if (!teamId || (dOut === 0 && dIn === 0)) return;
      const idx = teams.findIndex((t) => t.team_id === teamId);
      if (idx < 0) return;
      teams = teams.map((t, i) =>
        i === idx
          ? {
              ...t,
              out_amount: t.out_amount + dOut,
              in_amount: t.in_amount + dIn,
            }
          : t,
      );
    };
    if (before.dept === d.department_id) {
      out -= before.out;
      inAmt -= before.in;
      adjustTeam(before.team, -before.out, -before.in);
    }
    if (after.dept === d.department_id) {
      out += after.out;
      inAmt += after.in;
      adjustTeam(after.team, after.out, after.in);
    }
    if (out === d.out_amount && inAmt === d.in_amount && teams === d.teams)
      return d;
    return {
      ...d,
      out_amount: out,
      in_amount: inAmt,
      available_amount: d.limit_amount - out + inAmt,
      teams,
    };
  });
}

export default function BudgetPage() {
  return (
    <Suspense fallback={<div className={styles.container} />}>
      <BudgetPageInner />
    </Suspense>
  );
}

function BudgetPageInner() {
  const searchParams = useSearchParams();
  const scopeKey = searchParams.get("scope") ?? "";

  const [month, setMonth] = useState(currentYearMonth());
  const [scopeLabel, setScopeLabel] = useState<string>("");

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
  // 활성 본부(사업부) 탭
  const [deptTab, setDeptTab] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const months = useMemo(() => recentMonths(12), []);

  // ─── 예산 요약 ──────────────────────────────────────────
  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setError(null);
    try {
      const params = new URLSearchParams({ month });
      if (scopeKey) params.set("scope", scopeKey);
      const res = await fetch(`/api/budget/overview?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "예산 조회 실패");
      setSummary(json.departments ?? []);
      setScopeLabel(json.scope?.label ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "예산 조회 실패");
    } finally {
      setLoadingSummary(false);
    }
  }, [month, scopeKey]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // 본부 목록 변하면 활성 탭 보정 (없거나 사라진 본부면 첫 본부로)
  useEffect(() => {
    if (summary.length === 0) return;
    if (!summary.some((d) => d.department_id === deptTab)) {
      setDeptTab(summary[0].department_id);
    }
  }, [summary, deptTab]);

  // 본부 탭/월 바뀌면 입출금 결과 초기화 (본부별로 신한 재조회)
  useEffect(() => {
    setTxs([]);
    setTxLoaded(false);
  }, [deptTab, month]);

  // ─── 입출금 조회 (신한 실시간) ──────────────────────────
  const loadTransactions = useCallback(async () => {
    if (!deptTab) return;
    setLoadingTx(true);
    setError(null);
    try {
      const params = new URLSearchParams({ month });
      if (scopeKey) params.set("scope", scopeKey);
      else params.set("department_id", deptTab);
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
  }, [month, deptTab, scopeKey]);

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

  const scoped = !!scopeKey;
  const activeDept = summary.find((d) => d.department_id === deptTab) ?? null;

  // 전체 보기(경영지원본부)용 합계
  const totals = useMemo(
    () => ({
      limit: summary.reduce((s, d) => s + d.limit_amount, 0),
      out: summary.reduce((s, d) => s + d.out_amount, 0),
      in: summary.reduce((s, d) => s + d.in_amount, 0),
      available: summary.reduce((s, d) => s + d.available_amount, 0),
    }),
    [summary],
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h1>{scopeLabel ? `${scopeLabel} 운용 예산` : "운용 예산"}</h1>
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
        {/* ─── 좌측: 예산 (스코프=단일 사업부 / 전체=모든 본부) ─── */}
        <section className={`${styles.section} ${styles.leftPane}`}>
          {loadingSummary ? (
            <p className={styles.hint}>불러오는 중...</p>
          ) : summary.length === 0 ? (
            <p className={styles.hint}>표시할 본부가 없습니다.</p>
          ) : scoped && activeDept ? (
            // ── 단일 사업부 (스코프) ──
            <>
              <h2 className={styles.sectionTitle}>
                {scopeLabel || activeDept.department_name} 운용 예산
              </h2>
              <div className={styles.budgetCard}>
                <div className={styles.budgetRow}>
                  <span className={styles.budgetLabel}>예산 한도</span>
                  <span className={styles.budgetValue}>
                    {activeDept.can_edit_limit ? (
                      <input
                        key={`${activeDept.department_id}-${month}`}
                        className={styles.limitInput}
                        type="number"
                        defaultValue={activeDept.limit_amount || ""}
                        placeholder="0"
                        onBlur={(e) => {
                          const v = Math.max(
                            0,
                            Math.round(Number(e.target.value) || 0),
                          );
                          if (v !== activeDept.limit_amount)
                            saveLimit(activeDept.department_id, v);
                        }}
                      />
                    ) : (
                      won(activeDept.limit_amount)
                    )}
                  </span>
                </div>
                <div className={styles.budgetRow}>
                  <span className={styles.budgetLabel}>출금 (−)</span>
                  <span className={`${styles.budgetValue} ${styles.used}`}>
                    {activeDept.out_amount
                      ? `−${won(activeDept.out_amount)}`
                      : "0"}
                  </span>
                </div>
                <div className={styles.budgetRow}>
                  <span className={styles.budgetLabel}>입금 (+)</span>
                  <span className={`${styles.budgetValue} ${styles.deposit}`}>
                    {activeDept.in_amount
                      ? `+${won(activeDept.in_amount)}`
                      : "0"}
                  </span>
                </div>
                <div className={`${styles.budgetRow} ${styles.budgetRowTotal}`}>
                  <span className={styles.budgetLabel}>가용 예산</span>
                  <span
                    className={`${styles.budgetValue} ${activeDept.available_amount < 0 ? styles.negative : styles.available}`}
                  >
                    {won(activeDept.available_amount)}
                  </span>
                </div>
              </div>

              <p className={styles.hint}>
                이 사업부 통장 기준 · 가용 예산 = 예산 한도 − 예산 반영 출금 +
                예산 반영 입금.{" "}
                {activeDept.can_edit_limit
                  ? "예산 한도 칸을 클릭해 수정할 수 있습니다."
                  : "예산 한도는 어드민·경영지원본부·본부장만 수정할 수 있습니다."}
              </p>
            </>
          ) : (
            // ── 전체 보기 (경영지원본부): 모든 본부 + 팀 ──
            <>
              <h2 className={styles.sectionTitle}>부서 가용 예산</h2>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>본부</th>
                      <th className={styles.colNum}>예산 한도</th>
                      <th className={styles.colNum}>출금 (−)</th>
                      <th className={styles.colNum}>입금 (+)</th>
                      <th className={styles.colNum}>가용 예산</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((d) => (
                      <tr key={d.department_id}>
                        <td>{d.department_name}</td>
                        <td className={styles.colNum}>
                          {d.can_edit_limit ? (
                            <input
                              key={`${d.department_id}-${month}`}
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
                          {d.out_amount ? `−${won(d.out_amount)}` : "0"}
                        </td>
                        <td className={`${styles.colNum} ${styles.deposit}`}>
                          {d.in_amount ? `+${won(d.in_amount)}` : "0"}
                        </td>
                        <td
                          className={`${styles.colNum} ${d.available_amount < 0 ? styles.negative : styles.available}`}
                        >
                          {won(d.available_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {summary.length > 1 && (
                    <tfoot>
                      <tr>
                        <td>합계</td>
                        <td className={styles.colNum}>{won(totals.limit)}</td>
                        <td className={styles.colNum}>
                          {totals.out ? `−${won(totals.out)}` : "0"}
                        </td>
                        <td className={styles.colNum}>
                          {totals.in ? `+${won(totals.in)}` : "0"}
                        </td>
                        <td className={styles.colNum}>
                          {won(totals.available)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              <h3 className={styles.subTitle}>팀별 사용내역</h3>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>본부</th>
                      <th>팀</th>
                      <th className={styles.colNum}>출금 (−)</th>
                      <th className={styles.colNum}>입금 (+)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.flatMap((d) => d.teams).length === 0 ? (
                      <tr>
                        <td colSpan={4} className={styles.emptyCell}>
                          팀이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      summary.flatMap((d) =>
                        d.teams.map((t) => (
                          <tr key={`${d.department_id}-${t.team_id}`}>
                            <td>{d.department_name}</td>
                            <td>{t.team_name}</td>
                            <td className={`${styles.colNum} ${styles.used}`}>
                              {t.out_amount ? `−${won(t.out_amount)}` : "0"}
                            </td>
                            <td
                              className={`${styles.colNum} ${styles.deposit}`}
                            >
                              {t.in_amount ? `+${won(t.in_amount)}` : "0"}
                            </td>
                          </tr>
                        )),
                      )
                    )}
                  </tbody>
                </table>
              </div>
              <p className={styles.hint}>
                가용 예산 = 예산 한도 − 예산 반영 출금 + 예산 반영 입금.
              </p>
            </>
          )}
        </section>

        {/* ─── 입출금현황 (활성 본부) ─── */}
        <section className={`${styles.section} ${styles.rightPane}`}>
          <div className={styles.txHeader}>
            <h2 className={styles.sectionTitle}>
              {scopeLabel || (activeDept ? activeDept.department_name : "")}{" "}
              입금 · 출금현황
            </h2>
            <div className={styles.txControls}>
              {!scoped && summary.length > 1 && (
                <select
                  className={styles.monthSelect}
                  value={deptTab}
                  onChange={(e) => setDeptTab(e.target.value)}
                >
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
                disabled={loadingTx || !deptTab}
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
