/**
 * Calendar.tsx
 * Toss-style personal calendar — Pretendard, white tones, blue accent.
 *
 * Usage:
 *   import Calendar from "./Calendar";
 *   <Calendar events={myEvents} today={new Date()} />
 *
 * Drop the <style> at the top of your app once (or move it to a .css file).
 * Requires Pretendard webfont (loaded here via <link>), Tailwind not needed.
 */

import React, { useMemo, useState } from "react";
import "./Calendar.css";

/* =========================================================================
   Types
   ========================================================================= */

export type Category = "work" | "life" | "imp" | "health" | "event";

export interface CalendarEvent {
  id: string;
  date: string; // "YYYY-MM-DD"
  title: string;
  category: Category;
  start?: string; // "HH:mm"
  end?: string; // "HH:mm"
  where?: string;
}

export interface CalendarProps {
  events?: CalendarEvent[];
  today?: Date;
  initialMonth?: Date; // any date inside the month to render
  onAddEvent?: (date: string) => void;
  onSelectEvent?: (id: string) => void;
}

/* =========================================================================
   Constants
   ========================================================================= */

const CATEGORY_META: Record<
  Category,
  { label: string; color: string; soft: string; on: string }
> = {
  work: {
    label: "업무",
    color: "var(--blue)",
    soft: "var(--blue-soft)",
    on: "var(--blue)",
  },
  life: {
    label: "개인",
    color: "var(--green)",
    soft: "var(--green-soft)",
    on: "#15803d",
  },
  imp: {
    label: "중요",
    color: "var(--red)",
    soft: "var(--red-soft)",
    on: "var(--red)",
  },
  health: {
    label: "운동·건강",
    color: "var(--purple)",
    soft: "var(--purple-soft)",
    on: "#7c3aed",
  },
  event: {
    label: "기념일",
    color: "var(--orange)",
    soft: "var(--orange-soft)",
    on: "#c2570c",
  },
};

const WEEK_KO = ["일", "월", "화", "수", "목", "금", "토"];
const WEEK_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/* =========================================================================
   Date helpers
   ========================================================================= */

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function buildMonthGrid(anchor: Date) {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const first = new Date(y, m, 1);
  const startWeekday = first.getDay(); // 0 = Sun
  const start = new Date(y, m, 1 - startWeekday);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === m });
  }
  return cells;
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/* =========================================================================
   Sample data (replace with your imports)
   ========================================================================= */

const SAMPLE_EVENTS: CalendarEvent[] = [
  { id: "1", date: "2026-05-01", title: "근로자의 날", category: "imp" },
  { id: "2", date: "2026-05-01", title: "팀 워크샵", category: "work" },
  {
    id: "3",
    date: "2026-05-04",
    title: "팀 회의",
    category: "work",
    start: "10:00",
  },
  { id: "4", date: "2026-05-05", title: "어린이날", category: "imp" },
  { id: "5", date: "2026-05-06", title: "독서 모임", category: "life" },
  { id: "6", date: "2026-05-08", title: "어버이날", category: "event" },
  { id: "7", date: "2026-05-08", title: "저녁 약속", category: "life" },
  { id: "8", date: "2026-05-10", title: "가족 산책", category: "life" },
  {
    id: "9",
    date: "2026-05-12",
    title: "치과",
    category: "health",
    start: "14:00",
  },
  { id: "10", date: "2026-05-15", title: "스승의 날", category: "event" },
  {
    id: "11",
    date: "2026-05-18",
    title: "필라테스",
    category: "health",
    start: "19:30",
  },
  { id: "12", date: "2026-05-19", title: "제안서 마감", category: "imp" },
  // today
  {
    id: "13",
    date: "2026-05-20",
    title: "아침 러닝",
    category: "health",
    start: "08:30",
    end: "09:15",
    where: "한강 잠수교 · 5km",
  },
  {
    id: "14",
    date: "2026-05-20",
    title: "팀 스탠드업",
    category: "work",
    start: "10:00",
    end: "10:25",
    where: "Zoom · 25분",
  },
  {
    id: "15",
    date: "2026-05-20",
    title: "디자인 리뷰 — 5월 스프린트",
    category: "work",
    start: "15:00",
    end: "16:00",
    where: "회의실 B · 윤지, 도현",
  },
  {
    id: "16",
    date: "2026-05-20",
    title: "어머니와 저녁식사",
    category: "life",
    start: "19:00",
    end: "21:00",
    where: "성수동 · 예약 완료",
  },

  {
    id: "17",
    date: "2026-05-21",
    title: "부산 출장 · KTX 07:10",
    category: "work",
    where: "해운대",
  },
  { id: "18", date: "2026-05-22", title: "부산 출장", category: "work" },
  { id: "19", date: "2026-05-23", title: "부처님 오신 날", category: "imp" },
  { id: "20", date: "2026-05-25", title: "월간 리포트", category: "work" },
  {
    id: "21",
    date: "2026-05-26",
    title: "독서 모임 · 5월의 책",
    category: "life",
    start: "19:30",
    where: "합정 카페",
  },
  {
    id: "22",
    date: "2026-05-29",
    title: "결혼 3주년 기념일",
    category: "event",
  },
];

/* =========================================================================
   Calendar — main
   ========================================================================= */

export default function Calendar({
  events = SAMPLE_EVENTS,
  today = new Date(2026, 4, 20),
  initialMonth,
  onAddEvent,
  onSelectEvent,
}: CalendarProps) {
  const [cursor, setCursor] = useState<Date>(initialMonth ?? today);
  const [selected, setSelected] = useState<Date>(today);

  const cells = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const eventsByDate = useMemo(() => {
    const m: Record<string, CalendarEvent[]> = {};
    for (const e of events) (m[e.date] ??= []).push(e);
    return m;
  }, [events]);

  const goPrev = () =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const goNext = () =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const goToday = () => {
    setCursor(today);
    setSelected(today);
  };

  const selectedKey = fmtDate(selected);
  const selectedEvents = (eventsByDate[selectedKey] ?? [])
    .slice()
    .sort((a, b) => (a.start ?? "99:99").localeCompare(b.start ?? "99:99"));

  // upcoming = next ~14 days after today, limit 4
  const upcoming = useMemo(() => {
    const todayKey = fmtDate(today);
    return events
      .filter((e) => e.date > todayKey)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);
  }, [events, today]);

  return (
    <>
      <CalendarStyles />
      <div className="app">
        <div className="page">
          <SideNav
            cursor={cursor}
            onPrev={goPrev}
            onNext={goNext}
            today={today}
            selected={selected}
            onPickDate={setSelected}
            eventsByDate={eventsByDate}
            onAdd={() => onAddEvent?.(selectedKey)}
          />

          <MonthView
            cursor={cursor}
            cells={cells}
            today={today}
            selected={selected}
            eventsByDate={eventsByDate}
            onSelect={setSelected}
            onPrev={goPrev}
            onNext={goNext}
            onGoToday={goToday}
          />

          <RightPanel
            selected={selected}
            today={today}
            events={selectedEvents}
            upcoming={upcoming}
            onAdd={() => onAddEvent?.(selectedKey)}
            onSelectEvent={onSelectEvent}
          />
        </div>
      </div>
    </>
  );
}

/* =========================================================================
   Side nav (left)
   ========================================================================= */

interface SideNavProps {
  cursor: Date;
  onPrev: () => void;
  onNext: () => void;
  today: Date;
  selected: Date;
  onPickDate: (d: Date) => void;
  eventsByDate: Record<string, CalendarEvent[]>;
  onAdd: () => void;
}

function SideNav({
  cursor,
  onPrev,
  onNext,
  today,
  selected,
  onPickDate,
  eventsByDate,
  onAdd,
}: SideNavProps) {
  const cells = useMemo(() => buildMonthGrid(cursor), [cursor]);

  return (
    <aside className="sidenav">
      <button className="add-btn" onClick={onAdd}>
        <span className="plus">+</span>
        <span>새 일정 추가</span>
      </button>

      <div className="mini-cal">
        <div className="h">
          <span>
            {cursor.getFullYear()}. {cursor.getMonth() + 1}
          </span>
          <div className="arrows">
            <button onClick={onPrev}>‹</button>
            <button onClick={onNext}>›</button>
          </div>
        </div>
        <div className="dows">
          {WEEK_KO.map((d, i) => (
            <div key={d} className={i === 0 ? "sun" : i === 6 ? "sat" : ""}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid">
          {cells.map(({ date, inMonth }) => {
            const key = fmtDate(date);
            const has = !!eventsByDate[key]?.length;
            const isToday = isSameDay(date, today);
            const isSel = isSameDay(date, selected);
            const cls = [
              !inMonth && "muted",
              isToday && "today",
              has && "has",
              isSel && !isToday && "sel",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div
                key={key + (inMonth ? "" : "-out")}
                className={cls}
                onClick={() => onPickDate(date)}
              >
                {date.getDate()}
              </div>
            );
          })}
        </div>
      </div>

      <NavSection title="내 캘린더">
        {(Object.keys(CATEGORY_META) as Category[]).map((k, idx) => (
          <button key={k} className={"nav-item" + (idx === 0 ? " on" : "")}>
            <span
              className="cat-swatch"
              style={{ background: CATEGORY_META[k].color }}
            />
            {CATEGORY_META[k].label}
            <span className="count">·</span>
          </button>
        ))}
      </NavSection>

      <NavSection title="구독">
        <button className="nav-item">
          <span className="ic">
            <CalIcon />
          </span>
          대한민국 공휴일<span className="count">·</span>
        </button>
        <button className="nav-item">
          <span className="ic">
            <GlobeIcon />
          </span>
          음력<span className="count">·</span>
        </button>
      </NavSection>
    </aside>
  );
}

function NavSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="nav-section">
      <div className="label">{title}</div>
      {children}
    </div>
  );
}

/* =========================================================================
   Month view (center)
   ========================================================================= */

interface MonthViewProps {
  cursor: Date;
  cells: { date: Date; inMonth: boolean }[];
  today: Date;
  selected: Date;
  eventsByDate: Record<string, CalendarEvent[]>;
  onSelect: (d: Date) => void;
  onPrev: () => void;
  onNext: () => void;
  onGoToday: () => void;
}

function MonthView({
  cursor,
  cells,
  today,
  selected,
  eventsByDate,
  onSelect,
  onPrev,
  onNext,
  onGoToday,
}: MonthViewProps) {
  const weekNo = Math.ceil(
    ((+new Date(today.getFullYear(), today.getMonth(), today.getDate()) -
      +new Date(today.getFullYear(), 0, 1)) /
      86400000 +
      new Date(today.getFullYear(), 0, 1).getDay() +
      1) /
      7,
  );

  return (
    <main className="center">
      <div className="cal-head">
        <div className="title">
          <h1>
            {cursor.getMonth() + 1}월
            <span className="yr"> · {cursor.getFullYear()}</span>
          </h1>
          <div className="sub">
            {weekNo}주차 · 오늘 {today.getMonth() + 1}월 {today.getDate()}일{" "}
            {WEEK_KO[today.getDay()]}요일
          </div>
        </div>
        <div className="cal-controls">
          <button className="today-btn" onClick={onGoToday}>
            오늘
          </button>
          <button className="navbtn" onClick={onPrev}>
            ‹
          </button>
          <button className="navbtn" onClick={onNext}>
            ›
          </button>
          <div className="seg">
            <button>일</button>
            <button>주</button>
            <button className="on">월</button>
            <button>년</button>
          </div>
        </div>
      </div>

      <div className="dows-row">
        {WEEK_KO.map((d, i) => (
          <div key={d} className={i === 0 ? "sun" : i === 6 ? "sat" : ""}>
            {d}
          </div>
        ))}
      </div>

      <div className="calendar">
        {cells.map(({ date, inMonth }) => {
          const key = fmtDate(date);
          const evts = eventsByDate[key] ?? [];
          const isToday = isSameDay(date, today);
          const isSel = isSameDay(date, selected);
          const dow = date.getDay();
          const cls = [
            "day",
            !inMonth && "muted",
            isToday && "today",
            isSel && !isToday && "sel",
            dow === 0 && "sun",
            dow === 6 && "sat",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={key + (inMonth ? "" : "-out")}
              className={cls}
              onClick={() => onSelect(date)}
            >
              <div className="num-wrap">
                <span className="num">{date.getDate()}</span>
              </div>
              {evts.length > 0 && (
                <div className="events">
                  {evts.slice(0, 2).map((e) => (
                    <div key={e.id} className={"ev " + e.category}>
                      {e.title}
                      {e.start ? ` ${e.start}` : ""}
                    </div>
                  ))}
                  {evts.length > 2 && (
                    <div className="more">+ {evts.length - 2}개 더보기</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

/* =========================================================================
   Right panel
   ========================================================================= */

interface RightPanelProps {
  selected: Date;
  today: Date;
  events: CalendarEvent[];
  upcoming: CalendarEvent[];
  onAdd: () => void;
  onSelectEvent?: (id: string) => void;
}

// where 값에서 상태 큰 그룹 추출 (검색·필터용)
function extractStatusGroup(where: string | undefined): string {
  if (!where) return "기타";
  const s = where;
  if (s.includes("상담완료")) return "상담완료";
  if (s.includes("부재중")) return "부재중";
  if (s.includes("장기가망")) return "장기가망";
  if (s.includes("상담대기")) return "상담대기";
  if (s.includes("등록완료")) return "등록완료";
  if (s.includes("지인")) return "지인";
  if (s.includes("수신거부")) return "수신거부";
  return "기타";
}

const STATUS_GROUPS = [
  "상담완료",
  "상담대기",
  "부재중",
  "장기가망",
  "지인",
  "등록완료",
  "수신거부",
  "기타",
] as const;

function RightPanel({
  selected,
  today,
  events,
  upcoming,
  onAdd,
  onSelectEvent,
}: RightPanelProps) {
  const isToday = isSameDay(selected, today);
  const dow = WEEK_KO[selected.getDay()];
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"none" | "manager">("none");

  // 선택 날짜가 바뀌면 검색어 / 필터 / 더보기 초기화
  React.useEffect(() => {
    setQuery("");
    setShowAll(false);
    setStatusFilter(null);
    setGroupBy("none");
  }, [selected]);

  const PAGE_SIZE = 10;
  const q = query.trim().toLowerCase();
  const filteredBySearch = q
    ? events.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.where ?? "").toLowerCase().includes(q),
      )
    : events;
  const filtered = statusFilter
    ? filteredBySearch.filter(
        (e) => extractStatusGroup(e.where) === statusFilter,
      )
    : filteredBySearch;

  // 상태별 카운트 (필터 칩에 표시)
  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of filteredBySearch) {
      const g = extractStatusGroup(e.where);
      map[g] = (map[g] ?? 0) + 1;
    }
    return map;
  }, [filteredBySearch]);

  // 담당자 그룹화
  const managerGroups = useMemo(() => {
    if (groupBy !== "manager") return null;
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      const manager =
        (e.where ?? "").match(/담당\s+([^·]+)/)?.[1]?.trim() ?? "미배정";
      const arr = map.get(manager) ?? [];
      arr.push(e);
      map.set(manager, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered, groupBy]);

  const visible = showAll ? filtered : filtered.slice(0, PAGE_SIZE);
  const hiddenCount = filtered.length - visible.length;
  const isManyEvents = events.length > 30;

  return (
    <aside className="right">
      <section className="day-panel">
        <div className="h">
          <div className="t">{isToday ? "오늘의 일정" : "선택한 날 일정"}</div>
          <div className="sub">
            {selected.getMonth() + 1}월 {selected.getDate()}일 · {dow}요일
          </div>
        </div>

        <div className="day-hero">
          <div className="l">
            <div className="date">{selected.getDate()}</div>
            <div className="meta">
              <div className="dow">{dow}요일</div>
              <div className="lun">
                {selected.getFullYear()}년 {selected.getMonth() + 1}월
              </div>
            </div>
          </div>
          <div className="r">
            <div className="cnt">{events.length}</div>
            <div className="lbl">일정</div>
          </div>
        </div>

        <div className={`schedule${isManyEvents ? " compact" : ""}`}>
          {events.length > PAGE_SIZE && (
            <>
              <div className="day-search">
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowAll(false);
                  }}
                  placeholder="이름으로 검색 (예: 윤경민)"
                  className="day-search-input"
                />
                {query && (
                  <span className="day-search-count">{filtered.length}건</span>
                )}
              </div>

              {/* 상태 그룹 칩 — 많이 있을 때만 */}
              {isManyEvents && (
                <div className="day-chips">
                  <button
                    type="button"
                    className={`day-chip${statusFilter === null ? " on" : ""}`}
                    onClick={() => setStatusFilter(null)}
                  >
                    전체
                    <span className="n">{filteredBySearch.length}</span>
                  </button>
                  {STATUS_GROUPS.filter((s) => statusCounts[s] > 0).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`day-chip${statusFilter === s ? " on" : ""}`}
                      onClick={() =>
                        setStatusFilter(statusFilter === s ? null : s)
                      }
                    >
                      {s}
                      <span className="n">{statusCounts[s]}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 그룹화 토글 */}
              {isManyEvents && (
                <div className="day-group-toggle">
                  <button
                    type="button"
                    className={`group-btn${groupBy === "none" ? " on" : ""}`}
                    onClick={() => setGroupBy("none")}
                  >
                    목록
                  </button>
                  <button
                    type="button"
                    className={`group-btn${groupBy === "manager" ? " on" : ""}`}
                    onClick={() => setGroupBy("manager")}
                  >
                    담당자별
                  </button>
                </div>
              )}
            </>
          )}

          {/* 담당자별 그룹 모드 */}
          {groupBy === "manager" && managerGroups ? (
            managerGroups.map(([manager, items]) => (
              <div key={manager} className="day-group">
                <div className="day-group-h">
                  <span className="day-group-name">{manager}</span>
                  <span className="day-group-cnt">{items.length}건</span>
                </div>
                {items.slice(0, 5).map((e) => (
                  <div
                    key={e.id}
                    className="item"
                    onClick={() => onSelectEvent?.(e.id)}
                  >
                    <div className="info">
                      <div className="name">
                        <span
                          className="tag"
                          style={{
                            background: CATEGORY_META[e.category].color,
                          }}
                        />
                        {e.title}
                      </div>
                      {e.where && <div className="where">{e.where}</div>}
                    </div>
                  </div>
                ))}
                {items.length > 5 && (
                  <div className="day-group-more">외 {items.length - 5}건</div>
                )}
              </div>
            ))
          ) : (
            <>
              {visible.map((e) => (
                <div
                  key={e.id}
                  className="item"
                  onClick={() => onSelectEvent?.(e.id)}
                >
                  <div className="time">
                    {e.start ?? "종일"}
                    {e.end && <span className="end">~{e.end}</span>}
                  </div>
                  <div className="info">
                    <div className="name">
                      <span
                        className="tag"
                        style={{ background: CATEGORY_META[e.category].color }}
                      />
                      {e.title}
                    </div>
                    {e.where && <div className="where">{e.where}</div>}
                  </div>
                  <div className="more-dots">···</div>
                </div>
              ))}

              {hiddenCount > 0 && (
                <button
                  type="button"
                  className="show-more-btn"
                  onClick={() => setShowAll(true)}
                >
                  외 {hiddenCount}건 더 보기
                </button>
              )}

              {showAll && filtered.length > PAGE_SIZE && (
                <button
                  type="button"
                  className="show-more-btn"
                  onClick={() => setShowAll(false)}
                >
                  접기
                </button>
              )}
            </>
          )}

          {events.length === 0 && (
            <div className="empty">아직 등록된 일정이 없어요.</div>
          )}
          {events.length > 0 && filtered.length === 0 && (
            <div className="empty">필터 결과가 없어요.</div>
          )}

          <button className="add-item" onClick={onAdd}>
            <span className="pl">+</span>
            <span>이 날에 일정 추가하기</span>
          </button>
        </div>
      </section>

      <section className="up-section">
        <div className="h">
          <div className="t">다가오는 일정</div>
          <div className="all">전체 보기</div>
        </div>
        <div className="up-list">
          {upcoming.map((e) => {
            const d = new Date(e.date);
            return (
              <div
                key={e.id}
                className="up-row"
                onClick={() => onSelectEvent?.(e.id)}
              >
                <div className={"ddot " + e.category}>
                  <div className="d">{d.getDate()}</div>
                  <div className="m">{WEEK_EN[d.getDay()]}</div>
                </div>
                <div className="info">
                  <div className="n">{e.title}</div>
                  {e.where && (
                    <div className="s">
                      <span>{e.start ?? ""}</span>
                      {e.start && <span className="dot" />}
                      <span>{e.where}</span>
                    </div>
                  )}
                </div>
                <div className="arr">›</div>
              </div>
            );
          })}
        </div>
      </section>
    </aside>
  );
}

/* =========================================================================
   Icons
   ========================================================================= */

const CalIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

const GlobeIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" />
  </svg>
);

/* =========================================================================
   Styles (inline so the file is self-contained — move to .css if you prefer)
   ========================================================================= */

function CalendarStyles() {
  return null;
}
