"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  TrendingUp,
  Wallet,
  Target,
  AlertCircle,
  CheckCircle2,
  Circle,
} from "lucide-react";
import styles from "./JournalDetailModal.module.css";
import { getCalendarWeekIndex } from "@/lib/dashboard/weekOfMonth";

interface DetailResponse {
  user: {
    id: number;
    display_name: string;
    position_name: string | null;
    department_name: string | null;
    team_journal_form?: "default" | "academic";
  };
  journal: {
    morning: unknown;
    afternoon: unknown;
    tomorrow: unknown;
    tasks: unknown;
    issues?: unknown;
    status: string;
    submitted_at: string | null;
    updated_at: string;
  } | null;
  stats: {
    totalInquiries: number;
    registrations: number;
    registrationRate: number;
    salesThisMonth: number;
    delta: {
      inquiries: number;
      registrations: number;
      rate: number;
      sales: number;
    };
  };
  monthlyGoal: { total: number; weeks: number[] } | null;
  monthlyAchieved: { total: number; weeks: number[] };
  inquirySources: {
    company: { name: string; count: number }[];
    direct: { name: string; count: number }[];
  };
  weeklyGoal?:
    | { id: string; date: string; text: string; done: boolean }[]
    | null;
}

// morning/afternoon 의 jsonb 행을 { category, detail } 형태로 정규화
//   - work_journals.morning/afternoon = JournalRow[] = { id, category, detail }[]
//   - 일부 레거시 데이터(문자열 라인) 도 호환
interface JournalRow {
  category: string;
  detail: string;
}
function toJournalRows(v: unknown): JournalRow[] {
  if (v == null) return [];
  if (typeof v === "string") {
    return v
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => ({ category: "", detail: s }));
  }
  if (!Array.isArray(v)) return [];
  return v
    .map((it): JournalRow | null => {
      if (it == null) return null;
      if (typeof it === "string") return { category: "", detail: it };
      if (typeof it === "object") {
        const o = it as Record<string, unknown>;
        const category =
          typeof o.category === "string" ? o.category.trim() : "";
        const detail =
          typeof o.detail === "string"
            ? o.detail.trim()
            : typeof o.text === "string"
              ? o.text.trim()
              : typeof o.content === "string"
                ? o.content.trim()
                : "";
        if (!category && !detail) return null;
        return { category, detail };
      }
      return null;
    })
    .filter((r): r is JournalRow => r !== null);
}

// tomorrow 의 jsonb 는 { id?, text }[] 형태 — text 만 추출
function toTomorrowLines(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === "string") {
    return v
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(v)) return [];
  return v
    .map((it) => {
      if (typeof it === "string") return it.trim();
      if (it && typeof it === "object") {
        const o = it as Record<string, unknown>;
        return (
          (typeof o.text === "string" ? o.text : null) ??
          (typeof o.detail === "string" ? o.detail : null) ??
          ""
        ).trim();
      }
      return "";
    })
    .filter(Boolean);
}

export function JournalDetailModal({
  userId,
  date,
  onClose,
}: {
  userId: number;
  date: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(
      `/api/work-journal/admin/detail?user_id=${userId}&date=${encodeURIComponent(date)}`,
      { cache: "no-store" },
    )
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error ?? "디테일을 불러오지 못했습니다.");
        }
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, date]);

  // 오늘 주차 계산 — 모달 표시 일자 기준
  const [yy, mm, dd] = date.split("-").map(Number);
  const currentWeekIdx = getCalendarWeekIndex(yy, mm, dd);
  const monthLabel = `${mm}월`;

  const morning = toJournalRows(data?.journal?.morning);
  const afternoon = toJournalRows(data?.journal?.afternoon);
  const tomorrow = toTomorrowLines(data?.journal?.tomorrow);

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="닫기"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M18.0072 3.93918C18.5537 3.3906 19.4411 3.38723 19.9906 3.93332C20.5398 4.47992 20.5428 5.36865 19.9964 5.91819L13.9789 11.9636L20.0667 18.0822C20.6129 18.6318 20.6102 19.5206 20.0609 20.0671C19.5113 20.6126 18.6224 20.6103 18.076 20.0613L11.9999 13.9529L5.92368 20.0613C5.37709 20.6099 4.48821 20.6131 3.93882 20.0671C3.38989 19.5207 3.38724 18.6318 3.93296 18.0822L10.0194 11.9636L4.00473 5.91819C3.45878 5.36914 3.4601 4.48031 4.00913 3.93332C4.55871 3.38686 5.4474 3.39003 5.99399 3.93918L11.9999 9.97434L18.0072 3.93918Z"
              fill="#8995A2"
            />
          </svg>
        </button>

        {loading && <div className={styles.loading}>불러오는 중...</div>}
        {error && <div className={styles.errorBox}>{error}</div>}

        {data && (
          <>
            {/* 좌측 컬럼 — 상단: 날짜+사용자+오전+오후 / 하단: 내일 예정업무 */}
            <div className={styles.leftCol}>
              <div className={styles.leftTopGroup}>
                <div className={styles.dateLabel}>
                  {date.replaceAll("-", ".")} (
                  {
                    ["일", "월", "화", "수", "목", "금", "토"][
                      new Date(yy, mm - 1, dd).getDay()
                    ]
                  }
                  )
                </div>
                <div className={styles.empRow}>
                  <span className={styles.avatar} aria-hidden="true">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="42"
                      height="42"
                      viewBox="0 0 42 42"
                      fill="none"
                    >
                      <circle cx="21" cy="21" r="21" fill="#D9D9D9" />
                    </svg>
                  </span>
                  <div className={styles.empTexts}>
                    <div className={styles.empName}>
                      {data.user.display_name}
                    </div>
                    <div className={styles.empPos}>
                      {data.user.department_name ?? ""}
                    </div>
                  </div>
                </div>

                {/* 학사팀(academic)은 오전/오후 업무를 사용하지 않음 → 숨김 */}
                {data.user.team_journal_form !== "academic" && (
                  <>
                    <JournalSection
                      title="오전 업무 (10:00~13:00)"
                      rows={morning}
                    />
                    <JournalSection
                      title="오후 업무 (14:00~19:00)"
                      rows={afternoon}
                    />
                  </>
                )}
              </div>

              {/* 내일 예정 업무 — 좌측 컬럼 하단 고정 */}
              <TomorrowSection title="내일 예정 업무" items={tomorrow} />
            </div>

            {/* 우측 컬럼 — 학사팀이면 이번주 목표 + 이슈/조치사항, 그 외 기본(목표/통계/유입경로) */}
            <div className={styles.rightCol}>
              {data.user.team_journal_form === "academic" ? (
                <>
                  <WeeklyGoalCard
                    goals={data.weeklyGoal ?? []}
                    dateForWeek={date}
                  />
                  <IssuesCard issues={data.journal?.issues} />
                </>
              ) : (
                <>
                  <GoalCard
                    monthLabel={monthLabel}
                    goalTotal={data.monthlyGoal?.total ?? 0}
                    goalWeeks={data.monthlyGoal?.weeks ?? [0, 0, 0, 0, 0]}
                    achievedTotal={data.monthlyAchieved.total}
                    achievedWeeks={data.monthlyAchieved.weeks}
                    currentWeekIdx={currentWeekIdx}
                  />
                  <div className={styles.rightBottomRow}>
                    <StatList stats={data.stats} />
                    <SourcesCard inquirySources={data.inquirySources} />
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function JournalSection({
  title,
  rows,
}: {
  title: string;
  rows: JournalRow[];
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>{title}</div>
      {rows.length === 0 ? (
        <div className={styles.sectionEmpty}>입력된 내용이 없습니다.</div>
      ) : (
        <ul className={styles.ulist}>
          {rows.map((row, i) => (
            <li key={i} className={styles.journalLi}>
              <span className={styles.journalBullet}>•</span>
              {row.category && (
                <span className={styles.journalCategory}>{row.category}</span>
              )}
              {row.detail && (
                <span className={styles.journalDetail}>{row.detail}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TomorrowSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className={styles.tomorrowSection}>
      <div className={styles.tomorrowHead}>{title}</div>
      {items.length === 0 ? (
        <div className={styles.tomorrowEmpty}>입력된 내용이 없습니다.</div>
      ) : (
        <ol className={styles.tomorrowList}>
          {items.map((it, i) => (
            <li key={i} className={styles.tomorrowLi}>
              {i + 1}. {it}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function GoalCard({
  monthLabel,
  goalTotal,
  goalWeeks,
  achievedTotal,
  achievedWeeks,
  currentWeekIdx,
}: {
  monthLabel: string;
  goalTotal: number;
  goalWeeks: number[];
  achievedTotal: number;
  achievedWeeks: number[];
  currentWeekIdx: number;
}) {
  const pct =
    goalTotal > 0
      ? Math.min(100, Math.round((achievedTotal / goalTotal) * 100))
      : 0;
  return (
    <div className={styles.goalCard}>
      <div className={styles.goalTitle}>이번달 목표 현황</div>
      <div className={styles.goalBody}>
        <div className={styles.goalLeft}>
          <div className={styles.goalRing}>
            <span className={styles.goalRingLabel}>{monthLabel} 목표 달성률</span>
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e8eef5" strokeWidth="10" />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#0084fe"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 2 * Math.PI * 40} ${2 * Math.PI * 40}`}
                transform="rotate(-90 50 50)"
              />
              <text x="50" y="55" textAnchor="middle" className={styles.goalRingPct}>
                {pct}%
              </text>
            </svg>
          </div>
          <div className={styles.goalSalesBox}>
            <span className={styles.goalSalesLabel}>{monthLabel} 매출</span>
            <div className={styles.goalSalesInner}>
              <div className={styles.goalSalesValueWrap}>
                <span className={styles.goalSalesValue}>
                  {achievedTotal.toLocaleString()}만원
                </span>
                <span className={styles.goalSalesTarget}>
                  /목표 {goalTotal.toLocaleString()}만원
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.goalWeeks}>
          {goalWeeks.map((target, i) => {
            const value = achievedWeeks[i] ?? 0;
            const wp = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
            const isCurrent = i === currentWeekIdx;
            return (
              <div
                key={i}
                className={`${styles.weekRow} ${isCurrent ? styles.weekRowCurrent : ""}`}
              >
                {/* 좌측 — 라벨/퍼센트 (위) + 진행바 (아래) */}
                <div className={styles.weekLeftCol}>
                  <div className={styles.weekTop}>
                    <span className={styles.weekLabel}>{i + 1}주차</span>
                    <span className={styles.weekPct}>
                      {target > 0 ? `${wp}%` : "-%"}
                    </span>
                  </div>
                  <div className={styles.weekBar}>
                    <span
                      className={styles.weekFill}
                      style={{ width: `${wp}%` }}
                    />
                  </div>
                </div>

                {/* 우측 — 금액 / 목표 */}
                <div className={styles.weekAmount}>
                  <span className={styles.weekAmountValue}>
                    {target > 0 ? `${value.toLocaleString()}만원` : "-만원"}
                  </span>
                  <span className={styles.weekAmountTarget}>
                    /{target.toLocaleString()}만원
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatList({ stats }: { stats: DetailResponse["stats"] }) {
  return (
    <div className={styles.statList}>
      <StatItem
        icon={<Users size={32} />}
        label="전체문의"
        value={`${stats.totalInquiries.toLocaleString()}건`}
        sub={`전일대비 ${stats.delta.inquiries > 0 ? "+" : ""}${stats.delta.inquiries}건`}
      />
      <StatItem
        icon={<UserPlus size={32} />}
        label="등록 건수"
        value={`${stats.registrations.toLocaleString()}건`}
        sub={`전일대비 ${stats.delta.registrations > 0 ? "+" : ""}${stats.delta.registrations}건`}
      />
      <StatItem
        icon={<TrendingUp size={32} />}
        label="등록률"
        value={`${stats.registrationRate.toFixed(1)}%`}
        sub={`전일대비 ${stats.delta.rate > 0 ? "+" : ""}${stats.delta.rate.toFixed(1)}%p`}
      />
      <StatItem
        icon={<Wallet size={32} />}
        label="매출"
        value={`${Math.round(stats.salesThisMonth / 10000).toLocaleString()}만원`}
        sub={`전일대비 ${stats.delta.sales > 0 ? "+" : ""}${Math.round(stats.delta.sales / 10000).toLocaleString()}만원`}
      />
    </div>
  );
}

function StatItem({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statIcon}>{icon}</span>
      <div className={styles.statTexts}>
        <div className={styles.statTop}>
          <span className={styles.statLabel}>{label}</span>
          <span className={styles.statValue}>{value}</span>
        </div>
        {sub && <span className={styles.statSub}>{sub}</span>}
      </div>
    </div>
  );
}

const SOURCE_COLORS: Record<string, string> = {
  당근: "#FF6F0E",
  맘카페: "#75ED4C",
  네이버: "#03C75A",
  "인스타·페이스북": "#4DA8FF",
  구글: "#FB4E57",
  카카오: "#FAE200",
  토스: "#0064FF",
  기타: "#1E1E1E",
  최적블로그: "#0084FE",
  지인소개: "#767676",
};

function SourcesCard({
  inquirySources,
}: {
  inquirySources: DetailResponse["inquirySources"];
}) {
  const company = inquirySources.company.map((s) => ({
    ...s,
    color: SOURCE_COLORS[s.name] ?? "#8d99a5",
  }));
  const direct = inquirySources.direct.map((s) => ({
    ...s,
    color: SOURCE_COLORS[s.name] ?? "#8d99a5",
  }));
  const cTotal = company.reduce((s, x) => s + x.count, 0);
  const dTotal = direct.reduce((s, x) => s + x.count, 0);

  return (
    <div className={styles.sourcesCard}>
      <div className={styles.sourcesTitle}>오늘의 문의 유입경로</div>
      <div className={styles.sourcesSections}>
        <SourceSubsection
          label="회사 배정 문의"
          data={company}
          total={cTotal}
        />
        <SourceSubsection
          label="직접 유입 문의"
          data={direct}
          total={dTotal}
        />
      </div>
    </div>
  );
}

function SourceSubsection({
  label,
  data,
  total,
}: {
  label: string;
  data: { name: string; count: number; color: string }[];
  total: number;
}) {
  return (
    <div className={styles.srcSection}>
      <span className={styles.srcLabel}>{label}</span>
      <div className={styles.srcBar}>
        {total === 0 && <div className={styles.srcBarEmpty}>오늘 0건</div>}
        {data.map((s) => (
          <span
            key={s.name}
            className={styles.srcBarSeg}
            style={{
              width: `${(s.count / total) * 100}%`,
              background: s.color,
            }}
          />
        ))}
      </div>
      <div className={styles.srcChipRow}>
        {data.slice(0, 3).map((s) => {
          const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
          return (
            <div key={s.name} className={styles.srcChip}>
              <span className={styles.srcDot} style={{ background: s.color }} />
              <span className={styles.srcChipName}>{s.name}</span>
              <span className={styles.srcChipCount}>
                {s.count.toLocaleString()}건({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 학사팀 — 이번주 목표 카드 (읽기 전용 표시)
function WeeklyGoalCard({
  goals,
  dateForWeek,
}: {
  goals: { id: string; date: string; text: string; done: boolean }[];
  dateForWeek: string;
}) {
  // dateForWeek 가 속한 주의 월요일~일요일 라벨
  const [y, m, d] = dateForWeek.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const dow = target.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(target);
  monday.setDate(target.getDate() + offset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dd: Date) =>
    `${String(dd.getMonth() + 1).padStart(2, "0")}.${String(dd.getDate()).padStart(2, "0")}`;
  const weekRange = `${fmt(monday)} ~ ${fmt(sunday)}`;

  const total = goals.length;
  const doneCount = goals.filter((g) => g.done).length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className={styles.academicCard}>
      <div className={styles.academicCardHeader}>
        <span className={styles.academicCardHeaderLeft}>
          <span className={styles.academicCardHeaderIcon}>
            <Target size={16} />
          </span>
          <span className={styles.academicCardTitle}>이번주 목표</span>
          <span className={styles.academicCardSub}>{weekRange}</span>
        </span>
        {total > 0 && (
          <span className={styles.academicCardCount}>
            {doneCount}/{total} 완료
          </span>
        )}
      </div>

      {total > 0 && (
        <div className={styles.academicProgressBar}>
          <span
            className={styles.academicProgressFill}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {goals.length === 0 ? (
        <div className={styles.academicEmpty}>
          <Target size={28} className={styles.academicEmptyIcon} />
          <span>설정된 이번주 목표가 없습니다.</span>
        </div>
      ) : (
        <ul className={styles.weeklyGoalReadList}>
          {goals.map((g) => (
            <li
              key={g.id}
              className={`${styles.weeklyGoalReadItem} ${g.done ? styles.weeklyGoalReadItemDone : ""}`}
            >
              <span className={styles.weeklyGoalReadCheckIcon}>
                {g.done ? (
                  <CheckCircle2 size={18} className={styles.iconDone} />
                ) : (
                  <Circle size={18} className={styles.iconUndone} />
                )}
              </span>
              <span className={styles.weeklyGoalReadBody}>
                <span className={styles.weeklyGoalReadText}>{g.text}</span>
                <span className={styles.weeklyGoalReadDate}>
                  {(() => {
                    const v = (g.date ?? "").trim();
                    if (!v) return "미정";
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
                    const dd = new Date(`${v}T00:00:00`);
                    if (Number.isNaN(dd.getTime())) return v;
                    const mm = String(dd.getMonth() + 1).padStart(2, "0");
                    const ddd = String(dd.getDate()).padStart(2, "0");
                    const wk = ["일", "월", "화", "수", "목", "금", "토"][
                      dd.getDay()
                    ];
                    return `${mm}.${ddd} (${wk})`;
                  })()}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 학사팀 — 이슈 및 조치사항 카드 (읽기 전용)
function IssuesCard({ issues }: { issues: unknown }) {
  // issues 는 JournalRow[] = {id, category, detail}[]
  const rows = Array.isArray(issues)
    ? (issues as { category?: unknown; detail?: unknown; id?: unknown }[])
        .map((r) => ({
          id: typeof r?.id === "string" ? r.id : String(r?.id ?? ""),
          category:
            typeof r?.category === "string" ? r.category.trim() : "",
          detail: typeof r?.detail === "string" ? r.detail.trim() : "",
        }))
        .filter((r) => r.category !== "" || r.detail !== "")
    : [];

  return (
    <div className={styles.academicCard}>
      <div className={styles.academicCardHeader}>
        <span className={styles.academicCardHeaderLeft}>
          <span
            className={`${styles.academicCardHeaderIcon} ${styles.academicCardHeaderIconWarn}`}
          >
            <AlertCircle size={16} />
          </span>
          <span className={styles.academicCardTitle}>이슈 및 조치사항</span>
        </span>
        {rows.length > 0 && (
          <span className={styles.academicCardCount}>{rows.length}건</span>
        )}
      </div>
      {rows.length === 0 ? (
        <div className={styles.academicEmpty}>
          <AlertCircle size={28} className={styles.academicEmptyIcon} />
          <span>등록된 이슈 및 조치사항이 없습니다.</span>
        </div>
      ) : (
        <ul className={styles.issuesReadList}>
          {rows.map((r) => (
            <li key={r.id} className={styles.issuesReadItem}>
              {r.category && (
                <span className={styles.issuesReadCategory}>{r.category}</span>
              )}
              {r.detail && (
                <span className={styles.issuesReadDetail}>{r.detail}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
