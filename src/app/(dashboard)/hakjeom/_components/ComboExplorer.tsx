"use client";

import { useMemo, useState } from "react";
import styles from "./ComboExplorer.module.css";
import {
  AXES,
  ETC,
  NO_VALUE,
  axisValues,
  isRegistered,
  type AxisKey,
  type SegmentRecord,
} from "./segments";

// ─── 조합 탐색기 ──────────────────────────────────────────────────────────────
// 유입경로 × 학력 × 취득사유 × 반응포인트 조합별 등록률을 분석한다.
// 취득사유·반응포인트는 콤마 멀티값이라 태그 단위로 분해(중복 집계)한다.

export type ComboRecord = SegmentRecord;

interface ComboRow {
  key: string;
  values: { axis: AxisKey; value: string }[];
  total: number;
  registered: number;
  rate: number; // %
  lift: number; // rate / baseline
}

type Tone = "good" | "ok" | "bad" | "neutral";

function labelOf(
  row: ComboRow,
  minSample: number,
): { text: string; tone: Tone } {
  if (row.total >= minSample && row.lift >= 1.5)
    return { text: "추천 타겟", tone: "good" };
  if (row.lift >= 1.2) return { text: "양호", tone: "ok" };
  if (row.lift <= 0.5) return { text: "비효율", tone: "bad" };
  return { text: "보통", tone: "neutral" };
}

function confidenceOf(total: number, hasReaction: boolean): string {
  if (hasReaction && total < 40) return "신뢰 낮음";
  if (total >= 50) return "신뢰 높음";
  if (total >= 20) return "신뢰 보통";
  return "표본 적음";
}

export default function ComboExplorer({ data }: { data: ComboRecord[] }) {
  const [selected, setSelected] = useState<AxisKey[]>(["source", "education"]);
  const [minSample, setMinSample] = useState(20);
  const [includeEmpty, setIncludeEmpty] = useState(false);

  // 전체 기준 등록률 (baseline)
  const baseline = useMemo(() => {
    if (data.length === 0) return 0;
    const reg = data.filter((d) => isRegistered(d.status)).length;
    return reg / data.length;
  }, [data]);

  const hasReaction = selected.includes("reaction");

  const rows = useMemo<ComboRow[]>(() => {
    if (selected.length === 0) return [];
    const acc: Record<
      string,
      { values: { axis: AxisKey; value: string }[]; total: number; reg: number }
    > = {};

    for (const rec of data) {
      // 각 축의 값 배열 → 데카르트 곱
      const perAxis = selected.map((axis) =>
        axisValues(rec, axis).map((value) => ({ axis, value })),
      );
      let combos: { axis: AxisKey; value: string }[][] = [[]];
      for (const opts of perAxis) {
        const next: { axis: AxisKey; value: string }[][] = [];
        for (const base of combos)
          for (const o of opts) next.push([...base, o]);
        combos = next;
      }
      const reg = isRegistered(rec.status);
      for (const combo of combos) {
        if (
          !includeEmpty &&
          combo.some((c) => c.value === NO_VALUE || c.value === ETC)
        )
          continue;
        const key = combo.map((c) => c.value).join(" · ");
        if (!acc[key]) acc[key] = { values: combo, total: 0, reg: 0 };
        acc[key].total += 1;
        if (reg) acc[key].reg += 1;
      }
    }

    return Object.entries(acc)
      .map(([key, v]) => {
        const rate = v.total > 0 ? (v.reg / v.total) * 100 : 0;
        return {
          key,
          values: v.values,
          total: v.total,
          registered: v.reg,
          rate,
          lift: baseline > 0 ? rate / 100 / baseline : 0,
        };
      })
      .filter((r) => r.total >= minSample)
      .sort((a, b) => b.rate - a.rate || b.total - a.total);
  }, [data, selected, minSample, includeEmpty, baseline]);

  const recommended = rows
    .filter((r) => labelOf(r, minSample).tone === "good")
    .slice(0, 3);

  const toggleAxis = (axis: AxisKey) => {
    setSelected((prev) => {
      if (prev.includes(axis)) {
        if (prev.length === 1) return prev; // 최소 1개 유지
        return prev.filter((a) => a !== axis);
      }
      if (prev.length >= 3) return prev; // 최대 3개
      return [...prev, axis];
    });
  };

  const axisLabel = (k: AxisKey) => AXES.find((a) => a.key === k)?.label ?? k;

  return (
    <div>
      {/* 컨트롤 바 */}
      <div className={styles.controls}>
        <div className={styles.controlBlock}>
          <div className={styles.controlLabel}>
            분석 축 선택 <span className={styles.controlHint}>(최대 3개)</span>
          </div>
          <div className={styles.chipRow}>
            {AXES.map((a) => {
              const on = selected.includes(a.key);
              const disabled = !on && selected.length >= 3;
              return (
                <button
                  key={a.key}
                  type="button"
                  className={`${styles.axisChip} ${on ? styles.axisChipOn : ""}`}
                  disabled={disabled}
                  onClick={() => toggleAxis(a.key)}
                  title={a.note}
                >
                  {a.label}
                  {a.note && (
                    <span className={styles.axisChipNote}>· {a.note}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.controlBlock}>
          <div className={styles.controlLabel}>
            최소 표본 수{" "}
            <span className={styles.controlHint}>{minSample}건 이상</span>
          </div>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={minSample}
            onChange={(e) => setMinSample(Number(e.target.value))}
            className={styles.slider}
          />
        </div>

        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={includeEmpty}
            onChange={(e) => setIncludeEmpty(e.target.checked)}
          />
          미입력·기타 포함
        </label>
      </div>

      {/* 기준 안내 */}
      <div className={styles.baselineBar}>
        <span>
          전체 평균 등록률{" "}
          <b className={styles.baselineValue}>{(baseline * 100).toFixed(1)}%</b>
        </span>
        <span className={styles.baselineDivider}>·</span>
        <span>등록 기준: 등록완료</span>
        {hasReaction && (
          <>
            <span className={styles.baselineDivider}>·</span>
            <span className={styles.warnText}>
              ⚠ 반응포인트는 입력률 35%·거절사유 위주 → 참고용
            </span>
          </>
        )}
      </div>

      {/* 추천 타겟 카드 */}
      {recommended.length > 0 && (
        <div className={styles.recoSection}>
          <div className={styles.recoTitle}>추천 타겟 조합</div>
          <div className={styles.recoGrid}>
            {recommended.map((r) => (
              <div key={r.key} className={styles.recoCard}>
                <div className={styles.recoCombo}>
                  {r.values.map((v) => (
                    <span key={v.axis} className={styles.recoTag}>
                      {v.value}
                    </span>
                  ))}
                </div>
                <div className={styles.recoRate}>{r.rate.toFixed(1)}%</div>
                <div className={styles.recoMeta}>
                  등록 {r.registered}/{r.total} · 평균比{" "}
                  <b>{r.lift.toFixed(1)}배</b>
                </div>
                <div className={styles.recoMsg}>
                  {r.values.map((v) => v.value).join(" · ")} → 등록률 높음, 추천
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 결과 테이블 */}
      {rows.length === 0 ? (
        <div className={styles.empty}>
          조건에 맞는 조합이 없습니다. 최소 표본 수를 낮추거나 축을 줄여보세요.
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thRank}>#</th>
                {selected.map((axis) => (
                  <th key={axis} className={styles.thLeft}>
                    {axisLabel(axis)}
                  </th>
                ))}
                <th className={styles.thCenter}>등록률</th>
                <th className={styles.thCenter}>등록/전체</th>
                <th className={styles.thCenter}>평균比</th>
                <th className={styles.thCenter}>평가</th>
                <th className={styles.thCenter}>신뢰도</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const lab = labelOf(r, minSample);
                const conf = confidenceOf(r.total, hasReaction);
                const barW = Math.min(r.rate, 100);
                return (
                  <tr key={r.key}>
                    <td className={styles.tdRank}>{idx + 1}</td>
                    {r.values.map((v) => (
                      <td key={v.axis} className={styles.tdValue}>
                        {v.value}
                      </td>
                    ))}
                    <td className={styles.tdRate}>
                      <div className={styles.rateWrap}>
                        <div className={styles.rateBarTrack}>
                          <div
                            className={styles.rateBarFill}
                            style={{ width: `${barW}%` }}
                          />
                        </div>
                        <span className={styles.rateNum}>
                          {r.rate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className={styles.tdCenter}>
                      {r.registered}/{r.total}
                    </td>
                    <td className={styles.tdCenter}>{r.lift.toFixed(1)}배</td>
                    <td className={styles.tdCenter}>
                      <span
                        className={`${styles.badge} ${styles[`badge_${lab.tone}`]}`}
                      >
                        {lab.text}
                      </span>
                    </td>
                    <td className={styles.tdConf}>{conf}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className={styles.footnote}>
            평가 기준: 전체 평균 등록률 대비
            1.5배↑(추천)·1.2배↑(양호)·0.5배↓(비효율) · 취득사유/반응포인트는
            복수 항목을 태그별 중복 집계
          </div>
        </div>
      )}
    </div>
  );
}
