"use client";

import { useMemo, useState } from "react";
import styles from "./ActivityLogDense.module.css";

export interface LogChange {
  field?: string;
  from?: string | null;
  to?: string | null;
  note?: string;
}

export interface LogEvent {
  id?: string | number;
  /** "15:51" — HH:MM */
  time: string;
  /** "오늘 · 2026년 5월 14일 (목)" 등 그룹 헤더용 */
  date?: string;
  /** 담당자 (변경한 사람) */
  actor: string;
  /** 대상 (학생/과정 등 이름) */
  target: string;
  /** 카테고리 라벨 (예: "학점은행제 상담", "과정 수정") */
  category: string;
  changes: LogChange[];
}

interface Props {
  events: LogEvent[];
  onEventClick?: (event: LogEvent) => void;
}

function groupEvents(events: LogEvent[]) {
  const byDate = new Map<string, LogEvent[]>();
  events.forEach((e) => {
    const dateKey = e.date || "오늘";
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(e);
  });

  return Array.from(byDate.entries()).map(([date, evts]) => {
    const minutes: { time: string; events: LogEvent[] }[] = [];
    evts.forEach((e) => {
      const last = minutes[minutes.length - 1];
      if (last && last.time === e.time) last.events.push(e);
      else minutes.push({ time: e.time, events: [e] });
    });
    return { date, minutes };
  });
}

function ChangeSummary({ change }: { change: LogChange }) {
  if (change.note) return <span>{change.note}</span>;
  return (
    <>
      {change.field && (
        <>
          <span>{change.field}</span>{" "}
        </>
      )}
      <span className={styles.fromValue}>{change.from ?? "비움"}</span>
      <span className={styles.arrow}> → </span>
      <span className={styles.toValue}>{change.to ?? "비움"}</span>
    </>
  );
}

function EventRow({
  event,
  onClick,
}: {
  event: LogEvent;
  onClick?: (e: LogEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const first = event.changes[0];
  const more = event.changes.length - 1;

  const handleClick = () => {
    if (more > 0) setOpen((v) => !v);
    onClick?.(event);
  };

  return (
    <div
      onClick={handleClick}
      className={`${styles.row} ${more > 0 ? styles.rowClickable : ""}`}
    >
      <div className={styles.rowGrid}>
        <span className={styles.actor}>
          <span className={styles.actorDot} />
          {event.actor}
        </span>

        <span className={styles.sentence}>
          <b className={styles.target}>{event.target}</b>
          <span className={styles.divider}> · </span>
          {first && <ChangeSummary change={first} />}
          {more > 0 && (
            <span className={styles.moreBadge}>
              {open ? "접기" : `+${more}개 더`}
            </span>
          )}
        </span>

        <span className={styles.category}>{event.category}</span>
      </div>

      {open && more > 0 && (
        <div className={styles.expanded}>
          {event.changes.slice(1).map((c, i) => (
            <div key={i} className={styles.expandedLine}>
              <ChangeSummary change={c} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ActivityLogDense({ events, onEventClick }: Props) {
  const groups = useMemo(() => groupEvents(events), [events]);

  if (events.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyText}>활동 로그가 없습니다</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {groups.map((g, gi) => (
        <div key={gi}>
          <div className={styles.dateHeader}>
            <span>{g.date}</span>
            <span className={styles.dateCount}>
              {g.minutes.reduce((s, m) => s + m.events.length, 0)}건
            </span>
          </div>

          {g.minutes.map((m, mi) => (
            <div key={mi}>
              <div className={styles.minuteHeader}>
                <span className={styles.minuteTime}>{m.time}</span>
                <span>· {m.events.length}건</span>
              </div>

              {m.events.map((e, i) => (
                <EventRow
                  key={e.id ?? `${mi}-${i}`}
                  event={e}
                  onClick={onEventClick}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
