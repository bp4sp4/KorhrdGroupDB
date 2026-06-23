"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import styles from "./page.module.css";

interface Row {
  userId: number;
  name: string;
  teamName: string | null;
  position: string | null;
  isLeader: boolean;
  minSales: number;
  minSalesDefaulted: boolean;
  targetSales: number | null;
  targetWeeks: number[] | null;
  actualSales: number;
}

interface ApiResp {
  year: number;
  month: number;
  canEditMin: boolean;
  canEditTarget: boolean;
  rows: Row[];
}

interface TargetModal {
  userId: number;
  name: string;
  weeks: string[];
}

const fmt = (n: number) => n.toLocaleString();

export default function SalesTargetsBoard() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<ApiResp | null>(null);
  const [minEdits, setMinEdits] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<TargetModal | null>(null);
  const [modalSaving, setModalSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMinEdits({});
    try {
      const res = await fetch(`/api/sales-targets?year=${year}&month=${month}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "불러오기 실패");
      }
      setData((await res.json()) as ApiResp);
    } catch (e) {
      setData(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (
    updates: {
      userId: number;
      minSales?: number;
      target?: { total: number; weeks: number[] };
    }[],
  ) => {
    const res = await fetch("/api/sales-targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month, updates }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error ?? "저장 실패");
    }
  };

  const handleSaveMin = async () => {
    if (!data?.canEditMin) return;
    const updates = Object.entries(minEdits).map(([uid, minSales]) => ({
      userId: Number(uid),
      minSales,
    }));
    if (updates.length === 0) {
      alert("변경된 최소매출이 없습니다.");
      return;
    }
    setSaving(true);
    try {
      await post(updates);
      await load();
      alert("최소매출을 저장했습니다.");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const openModal = (r: Row) => {
    const weeks = r.targetWeeks ?? [0, 0, 0, 0, 0];
    setModal({
      userId: r.userId,
      name: r.name,
      weeks: weeks.map((n) => (n ? String(n) : "")),
    });
  };

  const modalWeekNums = modal
    ? modal.weeks.map((v) => Math.max(0, Math.floor(Number(v) || 0)))
    : [];
  const modalTotal = modalWeekNums.reduce((a, b) => a + b, 0);

  const handleSaveTarget = async () => {
    if (!modal) return;
    setModalSaving(true);
    try {
      await post([
        { userId: modal.userId, target: { total: modalTotal, weeks: modalWeekNums } },
      ]);
      setModal(null);
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setModalSaving(false);
    }
  };

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className={styles.board}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>매출 목표 관리</h1>
          <p className={styles.hint}>
            목표매출(메인 KPI·주차별)은 팀장·본부장이, 최소매출(기준 매출
            달성률)은 경영지원본부가 지정합니다. 단위: 만원.
          </p>
        </div>
        <div className={styles.controls}>
          <select
            className={styles.select}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
          {data?.canEditMin && (
            <button
              className={styles.saveBtn}
              onClick={handleSaveMin}
              disabled={saving || loading}
            >
              {saving ? "저장 중..." : "최소매출 저장"}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.empty}>불러오는 중...</div>
      ) : error ? (
        <div className={styles.empty}>{error}</div>
      ) : !data || data.rows.length === 0 ? (
        <div className={styles.empty}>표시할 직원이 없습니다.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>이름</th>
                <th>팀</th>
                <th>직책</th>
                <th>최소매출</th>
                <th>목표매출(월)</th>
                <th>실제매출</th>
                <th>목표 달성률</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const minVal = minEdits[r.userId] ?? r.minSales;
                const targetNum = r.targetSales ?? 0;
                const achieve =
                  targetNum > 0
                    ? Math.round((r.actualSales / targetNum) * 1000) / 10
                    : null;
                return (
                  <tr key={r.userId}>
                    <td>{r.name}</td>
                    <td>{r.teamName ?? "-"}</td>
                    <td>
                      {r.position ?? "-"}
                      {r.isLeader && (
                        <span className={styles.leaderTag}>팀장</span>
                      )}
                    </td>
                    <td>
                      {data.canEditMin ? (
                        <input
                          type="number"
                          min={0}
                          className={styles.input}
                          value={minVal}
                          onChange={(e) =>
                            setMinEdits((p) => ({
                              ...p,
                              [r.userId]: Math.max(
                                0,
                                Math.floor(Number(e.target.value) || 0),
                              ),
                            }))
                          }
                        />
                      ) : (
                        <span className={r.minSalesDefaulted ? styles.muted : ""}>
                          {fmt(minVal)}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className={styles.targetCell}>
                        <span>
                          {r.targetSales != null ? (
                            fmt(r.targetSales)
                          ) : (
                            <span className={styles.muted}>미설정</span>
                          )}
                        </span>
                        {data.canEditTarget && (
                          <button
                            className={styles.weekBtn}
                            onClick={() => openModal(r)}
                          >
                            주차별 설정
                          </button>
                        )}
                      </div>
                    </td>
                    <td>{fmt(r.actualSales)}</td>
                    <td>
                      {achieve != null ? (
                        <span
                          className={
                            achieve >= 100 ? styles.achHigh : styles.achLow
                          }
                        >
                          {achieve}%
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget && !modalSaving) setModal(null);
          }}
        >
          <div className={styles.modalBox}>
            <div className={styles.modalHead}>
              <h3 className={styles.modalTitle}>
                {modal.name} · {month}월 주차별 목표매출
              </h3>
              <button
                className={styles.modalClose}
                onClick={() => setModal(null)}
                disabled={modalSaving}
                aria-label="닫기"
              >
                <X size={16} />
              </button>
            </div>
            <div className={styles.weekGrid}>
              {modal.weeks.map((w, i) => (
                <label key={i} className={styles.weekField}>
                  <span className={styles.weekLabel}>{i + 1}주차</span>
                  <input
                    type="number"
                    min={0}
                    className={styles.input}
                    placeholder="0"
                    value={w}
                    onChange={(e) =>
                      setModal((m) =>
                        m
                          ? {
                              ...m,
                              weeks: m.weeks.map((x, idx) =>
                                idx === i ? e.target.value : x,
                              ),
                            }
                          : m,
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <div className={styles.modalSummary}>
              월 목표 합계 <b>{fmt(modalTotal)}만원</b>
            </div>
            <div className={styles.modalFoot}>
              <button
                className={styles.btnGhost}
                onClick={() => setModal(null)}
                disabled={modalSaving}
              >
                취소
              </button>
              <button
                className={styles.saveBtn}
                onClick={handleSaveTarget}
                disabled={modalSaving}
              >
                {modalSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
