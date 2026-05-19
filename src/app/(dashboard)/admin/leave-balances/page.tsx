"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Minus, Search, History } from "lucide-react";
import styles from "./page.module.css";

interface UsageEntry {
  date: string;
  type_short: string;
  type_full: string;
  delta: number;
}

interface BalanceItem {
  user_id: number;
  username: string | null;
  display_name: string | null;
  role: string | null;
  position_name: string | null;
  department_name: string | null;
  joined_at: string | null;
  auto_grant: number;
  manual_grant: number;
  granted: number; // 발생 (자동 + 수동)
  used: number;
  balance: number;
  usage_list: UsageEntry[];
}

interface Transaction {
  id: string;
  delta: number;
  reason: string;
  approval_id: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
}

export default function AdminLeaveBalancesPage() {
  const [items, setItems] = useState<BalanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateSearch, setDateSearch] = useState(""); // YYYY-MM-DD
  const [adjusting, setAdjusting] = useState<BalanceItem | null>(null);
  const [historyTarget, setHistoryTarget] = useState<BalanceItem | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/leave-balances");
      if (!res.ok) {
        setItems([]);
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filtered = items.filter((it) => {
    // 이름/이메일/부서 검색
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchText =
        (it.display_name ?? "").toLowerCase().includes(q) ||
        (it.username ?? "").toLowerCase().includes(q) ||
        (it.department_name ?? "").toLowerCase().includes(q);
      if (!matchText) return false;
    }
    // 날짜 검색 — 사용일자에 해당 날짜(prefix 일치)가 있는 사람만 표시
    // - 완전한 날짜(YYYY-MM-DD) 입력 시: 정확히 그 날짜
    // - 부분 입력(예: 2026-05) 시: 해당 월 전체 매칭
    if (dateSearch.trim()) {
      const q = dateSearch.trim();
      const matchDate = it.usage_list.some((u) => u.date.startsWith(q));
      if (!matchDate) return false;
    }
    return true;
  });

  // 0.5 단위 일수 → "X.X일" 또는 "X일" (정수면 소수점 생략)
  function formatDays(n: number): string {
    if (Number.isInteger(n)) return `${n}개`;
    return `${n.toFixed(1)}개`;
  }
  function formatDaysWithSign(n: number): string {
    if (Number.isInteger(n)) return `${n}`;
    return `${n.toFixed(1)}`;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h2 className={styles.title}>휴가 잔여 관리</h2>
        <p className={styles.subtitle}>
          사용자별 휴가 일수를 부여/차감합니다. 결재 승인 시 자동 차감되는 이력도
          여기서 확인할 수 있습니다.
        </p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="이름 / 이메일 / 부서 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.dateSearchWrap}>
          <input
            type="text"
            className={styles.dateSearchInput}
            placeholder="사용일자 검색 (YYYY-MM-DD 또는 YYYY-MM)"
            value={dateSearch}
            onChange={(e) => setDateSearch(e.target.value)}
          />
          {dateSearch && (
            <button
              type="button"
              className={styles.dateSearchClear}
              onClick={() => setDateSearch("")}
              aria-label="검색 초기화"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingWrap}>
          <Loader2 className={styles.spinner} size={20} /> 불러오는 중...
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>표시할 사용자가 없습니다.</div>
      ) : (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>이름</th>
                <th>입사일</th>
                <th>발생</th>
                <th>사용</th>
                <th>잔여</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.user_id}>
                  <td className={styles.nameCell}>{r.display_name ?? "-"}</td>
                  <td className={styles.dim}>{r.joined_at ?? "-"}</td>
                  <td className={styles.grantedCell}>
                    {formatDays(r.granted)}
                    {r.manual_grant !== 0 && (
                      <span className={styles.manualHint}>
                        {" "}
                        ({formatDaysWithSign(r.auto_grant)}+
                        {formatDaysWithSign(r.manual_grant)})
                      </span>
                    )}
                  </td>
                  <td className={styles.usedCell}>{formatDays(r.used)}</td>
                  <td
                    className={`${styles.balanceCell} ${
                      r.balance < 0
                        ? styles.balanceNegative
                        : r.balance === 0
                          ? styles.balanceZero
                          : ""
                    }`}
                  >
                    {formatDays(r.balance)}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.btnAdjust}
                        onClick={() => setAdjusting(r)}
                      >
                        <Plus size={12} /> 조정
                      </button>
                      <button
                        type="button"
                        className={styles.btnHistory}
                        onClick={() => setHistoryTarget(r)}
                      >
                        <History size={12} /> 이력
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adjusting && (
        <AdjustModal
          target={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={async () => {
            await fetchItems();
            setAdjusting(null);
          }}
        />
      )}

      {historyTarget && (
        <HistoryModal
          target={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}

// ─── 조정 모달 ──────────────────────────────────────────────────────────

function AdjustModal({
  target,
  onClose,
  onDone,
}: {
  target: BalanceItem;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"add" | "sub">("add");
  const [amount, setAmount] = useState<string>("1");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      alert("양수를 입력해주세요.");
      return;
    }
    if (Math.round(num * 2) !== num * 2) {
      alert("0.5 단위로 입력해주세요. (예: 1, 1.5, 2)");
      return;
    }
    if (!reason.trim()) {
      alert("사유를 입력해주세요.");
      return;
    }
    const delta = mode === "add" ? num : -num;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/leave-balances/${target.user_id}/adjust`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delta, reason: reason.trim() }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "처리 실패" }));
        alert(err.error ?? "처리 실패");
        return;
      }
      await onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {target.display_name ?? "-"} 휴가 조정
          </h3>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.field}>
            <label className={styles.label}>현재 잔여</label>
            <div className={styles.currentBalance}>
              {target.balance.toFixed(1)} 일
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>변경</label>
            <div className={styles.modeRow}>
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === "add" ? styles.modeBtnActive : ""}`}
                onClick={() => setMode("add")}
              >
                <Plus size={12} /> 부여
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${mode === "sub" ? styles.modeBtnActive : ""}`}
                onClick={() => setMode("sub")}
              >
                <Minus size={12} /> 차감
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>일수 (0.5 단위)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              className={styles.input}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>사유</label>
            <textarea
              className={styles.textarea}
              rows={3}
              placeholder="예) 2026년 연차 부여 / 무단결근 차감 등"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className={styles.previewBox}>
            변경 후 잔여:{" "}
            <strong>
              {(
                target.balance +
                (mode === "add" ? Number(amount || 0) : -Number(amount || 0))
              ).toFixed(1)}{" "}
              일
            </strong>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onClose}
            disabled={saving}
          >
            취소
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={submit}
            disabled={saving}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 이력 모달 ──────────────────────────────────────────────────────────

const PAGE_SIZE = 5;

function HistoryModal({
  target,
  onClose,
}: {
  target: BalanceItem;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [usagePage, setUsagePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  useEffect(() => {
    fetch(`/api/admin/leave-balances/${target.user_id}/transactions`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setItems(data.items ?? []))
      .finally(() => setLoading(false));
  }, [target.user_id]);

  const q = query.trim().toLowerCase();

  // 검색어 변경 시 페이지 1로 리셋
  useEffect(() => {
    setUsagePage(1);
    setHistoryPage(1);
  }, [q]);

  // 사용일자 필터링 — 날짜 prefix(YYYY-MM-DD/YYYY-MM/YYYY) 또는 휴가종류 텍스트 매칭
  const filteredUsage = target.usage_list.filter((u) => {
    if (!q) return true;
    return (
      u.date.startsWith(q) ||
      u.type_full.toLowerCase().includes(q) ||
      u.type_short.toLowerCase().includes(q)
    );
  });

  // 변동 이력 필터링 — reason 또는 날짜(YYYY-MM-DD/YYYY-MM/YYYY) 매칭
  const filteredItems = items.filter((t) => {
    if (!q) return true;
    const datePart = (t.created_at ?? "").slice(0, 10); // YYYY-MM-DD
    return (
      (t.reason ?? "").toLowerCase().includes(q) ||
      datePart.startsWith(q) ||
      (t.created_by_name ?? "").toLowerCase().includes(q)
    );
  });

  // 페이지 계산
  const usageTotalPages = Math.max(1, Math.ceil(filteredUsage.length / PAGE_SIZE));
  const safeUsagePage = Math.min(usagePage, usageTotalPages);
  const pagedUsage = filteredUsage.slice(
    (safeUsagePage - 1) * PAGE_SIZE,
    safeUsagePage * PAGE_SIZE,
  );

  const historyTotalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / PAGE_SIZE),
  );
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);
  const pagedHistory = filteredItems.slice(
    (safeHistoryPage - 1) * PAGE_SIZE,
    safeHistoryPage * PAGE_SIZE,
  );

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${styles.modalLarge}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {target.display_name ?? "-"} 변동 이력 (최근 200건)
          </h3>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* 요약 박스 — 입사일/발생/사용/잔여 */}
          <div className={styles.summaryBox}>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>입사일</span>
              <span className={styles.summaryValue}>
                {target.joined_at ?? "-"}
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>발생</span>
              <span className={styles.summaryValue}>
                {target.granted.toFixed(1)}개{" "}
                {target.manual_grant !== 0 && (
                  <span className={styles.summarySub}>
                    (자동 {target.auto_grant.toFixed(1)} + 수동{" "}
                    {target.manual_grant.toFixed(1)})
                  </span>
                )}
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>사용</span>
              <span className={styles.summaryValue}>
                {target.used.toFixed(1)}개
              </span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>잔여</span>
              <strong
                className={
                  target.balance < 0
                    ? styles.summaryValueNegative
                    : styles.summaryValueBalance
                }
              >
                {target.balance.toFixed(1)}개
              </strong>
            </div>
          </div>

          {/* 검색 input — 사용일자 + 변동 이력 동시 필터링 */}
          <div className={styles.modalSearchWrap}>
            <Search size={14} className={styles.modalSearchIcon} />
            <input
              type="text"
              className={styles.modalSearchInput}
              placeholder="날짜(YYYY-MM-DD 또는 YYYY-MM) / 휴가 종류 / 사유 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className={styles.modalSearchClear}
                onClick={() => setQuery("")}
                aria-label="검색 초기화"
              >
                ✕
              </button>
            )}
          </div>

          {/* 사용일자 섹션 */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>
              사용일자 ({filteredUsage.length}
              {q ? ` / ${target.usage_list.length}` : ""}건)
            </h4>
            {target.usage_list.length === 0 ? (
              <div className={styles.sectionEmpty}>아직 사용한 휴가가 없습니다.</div>
            ) : filteredUsage.length === 0 ? (
              <div className={styles.sectionEmpty}>검색 결과가 없습니다.</div>
            ) : (
              <>
              <table className={styles.subTable}>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>휴가 종류</th>
                    <th>차감</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsage.map((u, i) => (
                    <tr key={`${u.date}-${i}`}>
                      <td>{u.date}</td>
                      <td>{u.type_full}</td>
                      <td className={styles.deltaMinus}>
                        -{u.delta.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Paginator
                page={safeUsagePage}
                totalPages={usageTotalPages}
                onChange={setUsagePage}
              />
              </>
            )}
          </div>

          {/* 변동 이력 섹션 (어드민 부여 + 자동 차감 transactions) */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>
              변동 이력 ({filteredItems.length}
              {q ? ` / ${items.length}` : ""}건, 최근 200건)
            </h4>
            {loading ? (
              <div className={styles.loadingWrap}>
                <Loader2 className={styles.spinner} size={18} />
              </div>
            ) : items.length === 0 ? (
              <div className={styles.sectionEmpty}>이력이 없습니다.</div>
            ) : filteredItems.length === 0 ? (
              <div className={styles.sectionEmpty}>검색 결과가 없습니다.</div>
            ) : (
              <>
              <table className={styles.subTable}>
                <thead>
                  <tr>
                    <th>일시</th>
                    <th>변동</th>
                    <th>사유</th>
                    <th>처리자</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedHistory.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {new Date(t.created_at).toLocaleString("ko-KR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td
                        className={
                          t.delta >= 0 ? styles.deltaPlus : styles.deltaMinus
                        }
                      >
                        {t.delta >= 0 ? "+" : ""}
                        {t.delta.toFixed(1)}
                      </td>
                      <td>
                        {t.approval_id ? (
                          <span className={styles.approvalTag}>결재 승인</span>
                        ) : null}{" "}
                        {t.reason}
                      </td>
                      <td className={styles.dim}>
                        {t.created_by_name ?? (t.approval_id ? "시스템" : "-")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Paginator
                page={safeHistoryPage}
                totalPages={historyTotalPages}
                onChange={setHistoryPage}
              />
              </>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 페이지네이션 ───────────────────────────────────────────────────────

function Paginator({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  // ±2 윈도우
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className={styles.paginator}>
      <button
        type="button"
        className={styles.pageBtn}
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
      >
        이전
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ""}`}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        className={styles.pageBtn}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
      >
        다음
      </button>
    </div>
  );
}
