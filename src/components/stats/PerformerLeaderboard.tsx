"use client";

import styles from "./PerformerLeaderboard.module.css";

export interface PerformerStat {
  name: string;
  month: number;
  quarter: number;
  selected?: boolean;
}

interface Props {
  performers: PerformerStat[];
  title?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onSelect?: (p: PerformerStat) => void;
}

export default function PerformerLeaderboard({
  performers,
  title = "담당자 실적",
  primaryLabel = "이번 달",
  secondaryLabel = "이번 분기",
  onSelect,
}: Props) {
  const sorted = [...performers].sort((a, b) => b.month - a.month);
  const max = Math.max(...sorted.map((p) => p.month), 1);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.title}>{title}</div>
        <div className={styles.subtitle}>
          {primaryLabel} 기준 · 괄호는 {secondaryLabel} 누적
        </div>
      </header>

      <div
        className={styles.grid}
        style={{ gridTemplateColumns: `repeat(${sorted.length}, 1fr)` }}
      >
        {sorted.map((p, i) => {
          const isTop = i === 0 && p.month > 0;
          const isZero = p.month === 0;
          return (
            <button
              key={p.name}
              type="button"
              onClick={() => onSelect?.(p)}
              className={`${styles.item} ${isTop ? styles.itemTop : ""} ${p.selected ? styles.itemSelected : ""}`}
            >
              <div className={styles.row}>
                <span
                  className={`${styles.rank} ${isTop ? styles.rankTop : ""}`}
                >
                  {i + 1}
                </span>
                <span className={styles.name}>{p.name}</span>
              </div>

              <div className={`${styles.metric} ${isZero ? styles.metricZero : ""}`}>
                {p.month}
                <span className={styles.metricUnit}>%</span>
              </div>

              <div className={styles.barTrack}>
                <div
                  className={`${styles.barFill} ${isTop ? styles.barFillTop : ""}`}
                  style={{ width: `${(p.month / max) * 100}%` }}
                />
              </div>

              <div className={styles.secondary}>
                {secondaryLabel} {p.quarter}%
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
