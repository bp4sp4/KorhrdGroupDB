"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./SalesTargetsBoard.module.css";

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
  team: string | null;
  role: string;
  weeks: number[];
}

type Filter = "all" | "set" | "unset";

const fmt = (n: number) => n.toLocaleString("ko-KR");

// 숫자 입력 — 포커스 중엔 콤마 없이(커서 안 튐), 벗어나면 콤마 표시
function MoneyInput({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? (value ? fmt(value) : "");
  return (
    <input
      className={className}
      value={display}
      inputMode="numeric"
      placeholder="0"
      onFocus={() => setDraft(value ? String(value) : "")}
      onChange={(e) => {
        const d = e.target.value.replace(/[^\d]/g, "");
        setDraft(d);
        onChange(d === "" ? 0 : parseInt(d, 10));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

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
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

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

  const stepMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  };

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
      team: r.teamName,
      role: r.position || (r.isLeader ? "팀장" : "사원"),
      weeks: [...weeks],
    });
  };

  const modalTotal = modal
    ? modal.weeks.reduce((a, b) => a + (b || 0), 0)
    : 0;

  const handleSaveTarget = async () => {
    if (!modal) return;
    setModalSaving(true);
    try {
      await post([
        { userId: modal.userId, target: { total: modalTotal, weeks: modal.weeks } },
      ]);
      setModal(null);
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setModalSaving(false);
    }
  };

  const canEditMin = !!data?.canEditMin;
  const canEditTarget = !!data?.canEditTarget;
  const q = search.trim().toLowerCase();
  const rows = (data?.rows ?? []).filter((r) => {
    if (filter === "set" && r.targetSales == null) return false;
    if (filter === "unset" && r.targetSales != null) return false;
    if (q && !`${r.name} ${r.teamName ?? ""}`.toLowerCase().includes(q))
      return false;
    return true;
  });
  const ym = `${year} · ${month}월`;

  return (
    <div className={styles.board}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>매출 목표 관리</h1>
            <span className={styles.badge}>{ym}</span>
          </div>
          <p className={styles.desc}>
            목표매출(메인 KPI·주차별)은 팀장·본부장이, 최소매출(기준 매출 달성률)은
            경영지원본부가 지정합니다. 단위: 만원.
          </p>
        </div>
        <div className={styles.headRight}>
          <div className={styles.monthNav}>
            <button
              type="button"
              className={styles.monthArrow}
              onClick={() => stepMonth(-1)}
              aria-label="이전 달"
            >
              ‹
            </button>
            <span className={styles.monthLabel}>{ym}</span>
            <button
              type="button"
              className={styles.monthArrow}
              onClick={() => stepMonth(1)}
              aria-label="다음 달"
            >
              ›
            </button>
          </div>
          {canEditMin && (
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSaveMin}
              disabled={saving || loading}
            >
              {saving ? "저장 중..." : "최소매출 저장"}
            </button>
          )}
        </div>
      </div>

      {/* 툴바 */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {(
            [
              ["all", "전체"],
              ["set", "목표 설정 완료"],
              ["unset", "미설정"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <span
              key={key}
              className={`${styles.chip} ${filter === key ? styles.chipOn : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </span>
          ))}
        </div>
        <div className={styles.search}>
          <input
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름·팀 검색"
          />
        </div>
      </div>

      {loading ? (
        <div className={styles.empty}>불러오는 중...</div>
      ) : error ? (
        <div className={styles.empty}>{error}</div>
      ) : !data || data.rows.length === 0 ? (
        <div className={styles.empty}>표시할 직원이 없습니다.</div>
      ) : rows.length === 0 ? (
        <div className={styles.empty}>조건에 맞는 직원이 없습니다.</div>
      ) : (
        <div className={styles.card}>
          {/* head */}
          <div className={styles.headRow}>
            <div className={`${styles.th} ${styles.thName}`}>이름</div>
            <div className={styles.th}>팀</div>
            <div className={styles.th}>직책</div>
            <div className={styles.th}>최소매출</div>
            <div className={`${styles.th} ${styles.thCenter}`}>
              목표매출 <span className={styles.thMuted}>· 주차별</span>
            </div>
            <div className={`${styles.th} ${styles.thRight}`}>실제매출</div>
            <div className={`${styles.th} ${styles.thRight} ${styles.thRateEnd}`}>
              달성률
            </div>
          </div>

          {/* rows */}
          {rows.map((r) => {
            const minVal = minEdits[r.userId] ?? r.minSales;
            const target = r.targetSales;
            const achieve =
              target != null && target > 0
                ? Math.round((r.actualSales / target) * 100)
                : null;
            const rateCls =
              achieve == null
                ? styles.rateNone
                : achieve >= 100
                  ? styles.rateHigh
                  : achieve >= 90
                    ? styles.rateMid
                    : styles.rateLow;
            return (
              <div key={r.userId} className={styles.row}>
                {/* name */}
                <div className={styles.nameCell}>
                  <span className={styles.name}>{r.name}</span>
                </div>
                {/* team */}
                <div className={styles.teamCell}>{r.teamName ?? "-"}</div>
                {/* role */}
                <div className={styles.roleCell}>
                  <span
                    className={`${styles.roleBadge} ${r.isLeader ? styles.roleBadgeLead : ""}`}
                  >
                    {r.position || (r.isLeader ? "팀장" : "사원")}
                  </span>
                </div>
                {/* min */}
                <div className={styles.minCell}>
                  {canEditMin ? (
                    <div className={styles.minBox}>
                      <MoneyInput
                        className={styles.minInput}
                        value={minVal}
                        onChange={(n) =>
                          setMinEdits((p) => ({ ...p, [r.userId]: n }))
                        }
                      />
                      <span className={styles.unit}>만</span>
                    </div>
                  ) : (
                    <span
                      className={`${styles.minText} ${r.minSalesDefaulted ? styles.muted : ""}`}
                    >
                      {fmt(minVal)}
                    </span>
                  )}
                </div>
                {/* target */}
                {target != null ? (
                  <div
                    className={`${styles.targetCell} ${canEditTarget ? styles.targetClickable : ""}`}
                    onClick={canEditTarget ? () => openModal(r) : undefined}
                  >
                    <span className={styles.targetVal}>
                      {fmt(target)}
                      <span className={styles.targetUnit}>만</span>
                    </span>
                    {canEditTarget && <span className={styles.chevron}>›</span>}
                  </div>
                ) : (
                  <div className={styles.targetCell}>
                    {canEditTarget ? (
                      <button
                        type="button"
                        className={styles.setBtn}
                        onClick={() => openModal(r)}
                      >
                        목표 설정
                      </button>
                    ) : (
                      <span className={styles.muted}>미설정</span>
                    )}
                  </div>
                )}
                {/* actual */}
                <div className={styles.actualCell}>
                  {target != null ? fmt(r.actualSales) : "—"}
                </div>
                {/* rate */}
                <div className={styles.rateCell}>
                  <span className={`${styles.rateBadge} ${rateCls}`}>
                    {achieve != null ? `${achieve}%` : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 주차별 목표 설정 모달 ── */}
      {modal && (
        <div
          className={styles.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget && !modalSaving) setModal(null);
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <div className={styles.modalTopRow}>
                <span className={styles.modalBadge}>{ym}</span>
                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => !modalSaving && setModal(null)}
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>
              <h2 className={styles.modalTitle}>
                {modal.name}님의
                <br />
                주차별 목표를 설정하세요
              </h2>
              <p className={styles.modalSub}>
                {(modal.team ?? "-") + " · " + modal.role} · 단위 만원
              </p>
            </div>

            <div className={styles.weekList}>
              {modal.weeks.map((w, i) => (
                <div key={i} className={styles.weekRow}>
                  <span className={styles.weekBadge}>{i + 1}주</span>
                  <div className={styles.weekInfo}>
                    <div className={styles.weekLabel}>{i + 1}주차</div>
                  </div>
                  <div className={styles.weekInputWrap}>
                    <MoneyInput
                      className={styles.weekInput}
                      value={w}
                      onChange={(n) =>
                        setModal((m) =>
                          m
                            ? {
                                ...m,
                                weeks: m.weeks.map((x, idx) => (idx === i ? n : x)),
                              }
                            : m,
                        )
                      }
                    />
                    <span className={styles.weekUnit}>만</span>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.totalBox}>
              <span className={styles.totalLabel}>월 목표 합계</span>
              <span className={styles.totalVal}>
                {fmt(modalTotal)}
                <span className={styles.totalUnit}>만원</span>
              </span>
            </div>

            <div className={styles.modalFoot}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => setModal(null)}
                disabled={modalSaving}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleSaveTarget}
                disabled={modalSaving}
              >
                {modalSaving ? "저장 중..." : "저장하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
