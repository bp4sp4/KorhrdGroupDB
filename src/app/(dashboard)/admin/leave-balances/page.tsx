"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Minus, Search, History } from "lucide-react";
import styles from "./page.module.css";

interface BalanceItem {
  user_id: number;
  username: string | null;
  display_name: string | null;
  role: string | null;
  position_name: string | null;
  department_name: string | null;
  balance: number;
  updated_at: string | null;
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
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (it.display_name ?? "").toLowerCase().includes(q) ||
      (it.username ?? "").toLowerCase().includes(q) ||
      (it.department_name ?? "").toLowerCase().includes(q)
    );
  });

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
                <th>이메일</th>
                <th>부서</th>
                <th>직급</th>
                <th>잔여(일)</th>
                <th>최근 갱신</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.user_id}>
                  <td className={styles.nameCell}>{r.display_name ?? "-"}</td>
                  <td>{r.username ?? "-"}</td>
                  <td>{r.department_name ?? "-"}</td>
                  <td>{r.position_name ?? "-"}</td>
                  <td
                    className={`${styles.balanceCell} ${
                      r.balance <= 0 ? styles.balanceZero : ""
                    }`}
                  >
                    {r.balance.toFixed(1)}
                  </td>
                  <td className={styles.dim}>
                    {r.updated_at
                      ? new Date(r.updated_at).toLocaleDateString("ko-KR")
                      : "-"}
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

function HistoryModal({
  target,
  onClose,
}: {
  target: BalanceItem;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/leave-balances/${target.user_id}/transactions`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setItems(data.items ?? []))
      .finally(() => setLoading(false));
  }, [target.user_id]);

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
          {loading ? (
            <div className={styles.loadingWrap}>
              <Loader2 className={styles.spinner} size={18} />
            </div>
          ) : items.length === 0 ? (
            <div className={styles.empty}>이력이 없습니다.</div>
          ) : (
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
                {items.map((t) => (
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
          )}
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
