"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import styles from "./page.module.css";

interface UsageEntry {
  date: string;
  end: string;
  type_short: string;
  type_full: string;
  delta: number;
  created_at: string;
}

interface MeBalance {
  balance: number;
  auto_grant: number;
  birthday_grant: number;
  manual_grant: number;
  used: number;
  joined_at: string | null;
  birth_date: string | null;
  usage_list: UsageEntry[];
}

type ApplyType = {
  id: string;
  title: string;
  sub: string;
  vacationType: string;
  primary?: boolean;
};

const APPLY_TYPES: ApplyType[] = [
  {
    id: "annual",
    title: "연차",
    sub: "",
    vacationType: "연차",
    primary: true,
  },
  {
    id: "halfAM",
    title: "반차(오전)",
    sub: "연차 0.5일 차감",
    vacationType: "반차(오전)",
  },
  {
    id: "halfPM",
    title: "반차(오후)",
    sub: "연차 0.5일 차감",
    vacationType: "반차(오후)",
  },
  {
    id: "event",
    title: "경조휴가",
    sub: "차감 없음 · 증빙 필수",
    vacationType: "경조휴가",
  },
  {
    id: "army",
    title: "예비군",
    sub: "차감 없음 · 통지서 필수",
    vacationType: "예비군",
  },
  {
    id: "sick",
    title: "병가",
    sub: "차감 없음 · 진단서 필수",
    vacationType: "병가",
  },
];

function parseYMD(d: string | null | undefined): Date | null {
  if (!d) return null;
  const m = String(d).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fmtYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 적용 기간 (만 1년 단위, 입사일 기준)
function calcApplyRange(
  joinedAt: string | null,
  asOf: Date,
): { start: string; end: string } | null {
  const joined = parseYMD(joinedAt);
  if (!joined) return null;
  let years = asOf.getFullYear() - joined.getFullYear();
  if (
    asOf.getMonth() < joined.getMonth() ||
    (asOf.getMonth() === joined.getMonth() && asOf.getDate() < joined.getDate())
  ) {
    years--;
  }
  const start = new Date(
    joined.getFullYear() + years,
    joined.getMonth(),
    joined.getDate(),
  );
  const end = new Date(
    joined.getFullYear() + years + 1,
    joined.getMonth(),
    joined.getDate() - 1,
  );
  return { start: fmtYMD(start), end: fmtYMD(end) };
}

function senorityLabel(joinedAt: string | null, asOf: Date): string {
  const joined = parseYMD(joinedAt);
  if (!joined) return "-";
  let years = asOf.getFullYear() - joined.getFullYear();
  let months = asOf.getMonth() - joined.getMonth();
  if (asOf.getDate() < joined.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years <= 0 && months <= 0) return "0개월";
  if (years <= 0) return `${months}개월`;
  if (months <= 0) return `${years}년`;
  return `${years}년 ${months}개월`;
}

export default function MyLeavePage() {
  const router = useRouter();
  const [balance, setBalance] = useState<MeBalance | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/leave-balances/me");
      if (!r.ok) return;
      const data = await r.json();
      setBalance(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const today = new Date();
  const todayStr = fmtYMD(today);

  const applyRange = useMemo(
    () => calcApplyRange(balance?.joined_at ?? null, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [balance?.joined_at],
  );
  const sLabel = useMemo(
    () => senorityLabel(balance?.joined_at ?? null, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [balance?.joined_at],
  );

  const total = balance
    ? balance.auto_grant + balance.birthday_grant + balance.manual_grant
    : 0;
  const used = balance?.used ?? 0;
  const remaining = balance?.balance ?? 0;

  // usage_list → past 변환
  const past = useMemo(() => {
    return (balance?.usage_list ?? []).map((u, i) => ({
      id: `${u.date}-${i}`,
      type: u.type_full,
      days: u.delta > 0 ? u.delta : 0,
      dateStart: u.date,
      dateEnd: u.end || u.date,
    }));
  }, [balance?.usage_list]);

  // 신입(1년 미만) 다음 만근 적립일 계산 — useMemo는 항상 호출 (early return 전)
  const nextAccrual = useMemo(() => {
    const joined = parseYMD(balance?.joined_at ?? null);
    const auto = balance?.auto_grant ?? 0;
    const newbie = !!(joined && auto < 11);
    if (!newbie || !joined) return null;
    const now = new Date();
    let months =
      (now.getFullYear() - joined.getFullYear()) * 12 +
      (now.getMonth() - joined.getMonth());
    if (now.getDate() < joined.getDate()) months--;
    months = Math.max(0, months);
    const next = new Date(
      joined.getFullYear(),
      joined.getMonth() + months + 1,
      joined.getDate(),
    );
    const daysUntil = Math.max(
      0,
      Math.ceil((next.getTime() - now.getTime()) / 86400000),
    );
    return { date: fmtYMD(next), daysUntil };
  }, [balance?.joined_at, balance?.auto_grant]);

  const handleApply = (typeId: string) => {
    const t = APPLY_TYPES.find((x) => x.id === typeId);
    if (!t) return;
    router.push(
      `/approvals?new=휴가신청서&vacation_type=${encodeURIComponent(t.vacationType)}`,
    );
  };

  if (loading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.loadingWrap}>
          <Loader2 className={styles.spinner} size={20} /> 불러오는 중...
        </div>
      </div>
    );
  }

  // 추천 페이스
  const periodEnd = parseYMD(applyRange?.end ?? null);
  const daysLeft = periodEnd
    ? Math.max(0, Math.ceil((periodEnd.getTime() - today.getTime()) / 86400000))
    : 0;
  const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30));
  const paceNeeded = (remaining / monthsLeft).toFixed(1);

  // 신입 여부 (Hook 호출 X — 단순 계산)
  const isNewbie = !!balance?.joined_at && (balance?.auto_grant ?? 0) < 11;

  // 마지막 휴가로부터
  const lastVac = past[0] ? parseYMD(past[0].dateStart) : null;
  const daysSince = lastVac
    ? Math.floor((today.getTime() - lastVac.getTime()) / 86400000)
    : null;

  // 패턴 — 월/금 비중
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  let monFri = 0;
  past.forEach((r) => {
    const d = parseYMD(r.dateStart);
    if (!d) return;
    const w = dayNames[d.getDay()];
    if (w === "월" || w === "금") monFri++;
  });
  const patternPct =
    past.length > 0 ? Math.round((monFri / past.length) * 100) : 0;
  const patternLabel =
    patternPct >= 60
      ? "금/월 선호"
      : patternPct >= 40
        ? "평일 고르게"
        : "주중 분산";

  const primaryType = APPLY_TYPES.find((t) => t.primary) ?? APPLY_TYPES[0];
  const secondaryTypes = APPLY_TYPES.filter((t) => t.id !== primaryType.id);

  return (
    <div className={styles.wrap}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className={styles.title}>휴가현황</div>
        <div className={styles.todayBadge}>{todayStr}</div>
      </div>

      {/* HERO ROW */}
      <div className={styles.heroRow}>
        <div className={styles.heroMain}>
          <CircularProgress used={used} total={total} />
          <div className={styles.heroBody}>
            <div className={styles.heroLabel}>잔여 연차</div>
            <div className={styles.heroNumRow}>
              <span
                className={`${styles.heroNum} ${
                  remaining < 0 ? styles.heroNumNegative : ""
                }`}
              >
                {remaining.toFixed(1)}
              </span>
              <span className={styles.heroUnit}>일</span>
              <span className={styles.heroTotal}>/ {total}일</span>
            </div>
            <div className={styles.heroSub}>
              {remaining < 0 ? (
                <span className={styles.heroSubWarn}>
                  ⚠️ 가용 연차를 {Math.abs(remaining).toFixed(1)}일 초과
                  사용했습니다.
                </span>
              ) : isNewbie && nextAccrual ? (
                <>
                  <span className={styles.heroSubBlue}>
                    {nextAccrual.daysUntil}일
                  </span>{" "}
                  뒤(
                  <span className={styles.heroSubStrong}>
                    {nextAccrual.date}
                  </span>
                  ) 만근으로 <strong>1일 적립</strong>
                </>
              ) : (
                <>
                  <span className={styles.heroSubStrong}>
                    {applyRange?.end ?? "-"}
                  </span>
                  까지 <span className={styles.heroSubBlue}>{daysLeft}일</span>{" "}
                  남음
                </>
              )}
            </div>
          </div>
        </div>

        {remaining < 0 ? (
          <InsightCard
            label="초과 사용"
            value={`${Math.abs(remaining).toFixed(1)}일`}
            sub="관리자에게 휴가일수 조정을 요청하세요."
            tone="warn"
          />
        ) : isNewbie && nextAccrual ? (
          <InsightCard
            label="다음 만근 적립까지"
            value={`${nextAccrual.daysUntil}일`}
            sub={`${nextAccrual.date} 도래 시 +1일 자동 적립`}
            tone="info"
          />
        ) : remaining === 0 ? (
          <InsightCard
            label="잔여 없음"
            value="0일"
            sub="이번 회계연도 연차를 모두 사용했습니다."
            tone="neutral"
          />
        ) : (
          <InsightCard
            label="추천 페이스"
            value={`월 ${paceNeeded}일`}
            sub={`${monthsLeft}개월 안에 ${remaining.toFixed(1)}일 소진하려면`}
            tone="info"
          />
        )}

        <InsightCard
          label="마지막 휴가로부터"
          value={daysSince != null ? `${daysSince}일` : "—"}
          sub={
            lastVac ? `${past[0].dateStart} 이후 휴식 공백` : "휴가 기록 없음"
          }
          tone={daysSince != null && daysSince > 60 ? "warn" : "neutral"}
        />

        <InsightCard
          label="휴가 패턴"
          value={patternLabel}
          sub={
            past.length > 0
              ? `${past.length}건 중 ${monFri}건이 주말 붙임`
              : "데이터 부족"
          }
          tone="neutral"
        />
      </div>

      {/* Quick apply */}
      <div className={styles.quickCard}>
        <div>
          <button
            type="button"
            className={styles.quickPrimaryBtn}
            onClick={() => handleApply(primaryType.id)}
          >
            + {primaryType.title} 신청
            <span className={styles.quickPrimarySub}>{primaryType.sub}</span>
          </button>
        </div>
        <div className={styles.quickChips}>
          {secondaryTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              className={styles.quickChip}
              onClick={() => handleApply(t.id)}
            >
              <span className={styles.quickChipTitle}>{t.title}</span>
              <span className={styles.quickChipSub}>{t.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom row — 지난 휴가 + 월별 사용 */}
      <div className={styles.bottomRow}>
        <PastTimeline past={past} />
        <MonthlyPattern past={past} />
      </div>
    </div>
  );
}

// ─── 서브 컴포넌트 ────────────────────────────────────────

function CircularProgress({ used, total }: { used: number; total: number }) {
  const size = 110;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const rawPct = total > 0 ? used / total : 0;
  const isOver = rawPct > 1;
  const pct = Math.min(1, rawPct); // 호 길이는 100%로 cap
  const dash = pct * circ;
  const fillColor = isOver ? "#b91c1c" : "#3182f6";
  const textColor = isOver ? "#b91c1c" : "#191f28";
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ flexShrink: 0 }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="#f2f4f6"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={fillColor}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2}
        y={size / 2 - 2}
        textAnchor="middle"
        fontSize="22"
        fontWeight="700"
        fill={textColor}
        style={{
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
        }}
      >
        {Math.round(rawPct * 100)}%
      </text>
      <text
        x={size / 2}
        y={size / 2 + 16}
        textAnchor="middle"
        fontSize="10"
        fill="#8b95a1"
      >
        사용
      </text>
    </svg>
  );
}

function InsightCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "info" | "warn" | "neutral";
}) {
  const toneClass =
    tone === "info"
      ? styles.insightInfo
      : tone === "warn"
        ? styles.insightWarn
        : styles.insightNeutral;
  return (
    <div className={`${styles.insightCard} ${toneClass}`}>
      <div className={styles.insightLabelRow}>{label}</div>
      <div className={styles.insightValue}>{value}</div>
      <div className={styles.insightSub}>{sub}</div>
    </div>
  );
}

interface PastItem {
  id: string;
  type: string;
  days: number;
  dateStart: string;
  dateEnd: string;
}

const PREVIEW_LIMIT = 5;
const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

function TimelineList({ rows }: { rows: PastItem[] }) {
  return (
    <div className={styles.timeline}>
      <div className={styles.timelineLine} />
      {rows.map((r, i) => {
        const date = new Date(r.dateStart);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekday = dayNames[date.getDay()];
        const isWeekendAdj = weekday === "금" || weekday === "월";
        return (
          <div
            key={r.id}
            className={`${styles.timelineRow} ${
              i === rows.length - 1 ? styles.timelineRowLast : ""
            }`}
          >
            <div className={styles.timelineDot} />
            <div className={styles.timelineGrid}>
              <span className={styles.timelineDate}>
                {month}월 {day}일
              </span>
              <span className={styles.timelineMid}>
                {r.type} ·{" "}
                <span
                  className={
                    isWeekendAdj
                      ? styles.timelineWeekend
                      : styles.timelineWeekday
                  }
                >
                  {weekday}요일
                </span>
              </span>
              <span className={styles.timelineRight}>
                {r.days > 0 ? `${r.days}일` : "-"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PastTimeline({ past }: { past: PastItem[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  // 최신순(내림차순)으로 정렬 — 위로 최근 날짜
  const sortedDesc = [...past].sort(
    (a, b) => new Date(b.dateStart).getTime() - new Date(a.dateStart).getTime(),
  );
  const preview = sortedDesc.slice(0, PREVIEW_LIMIT);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>지난 휴가</span>
        <span className={styles.panelMeta}>{past.length}건</span>
      </div>
      {past.length === 0 ? (
        <div className={styles.empty}>아직 휴가 기록이 없어요</div>
      ) : (
        <>
          <TimelineList rows={preview} />
          {past.length > PREVIEW_LIMIT && (
            <button
              type="button"
              className={styles.moreBtn}
              onClick={() => setModalOpen(true)}
            >
              더보기 ({past.length}건 전체)
            </button>
          )}
        </>
      )}

      {modalOpen && (
        <PastTimelineModal
          past={sortedDesc}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

function PastTimelineModal({
  past,
  onClose,
}: {
  past: PastItem[];
  onClose: () => void;
}) {
  // 모달은 최신순(내림차순)으로 표시
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            지난 휴가 전체 ({past.length}건)
          </h3>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>
          {past.length === 0 ? (
            <div className={styles.empty}>아직 휴가 기록이 없어요</div>
          ) : (
            <table className={styles.modalTable}>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>휴가 종류</th>
                  <th>일수</th>
                </tr>
              </thead>
              <tbody>
                {past.map((r) => {
                  const d = new Date(r.dateStart);
                  const weekday = dayNames[d.getDay()];
                  return (
                    <tr key={r.id}>
                      <td>
                        {r.dateStart}
                        {r.dateEnd && r.dateEnd !== r.dateStart
                          ? ` ~ ${r.dateEnd}`
                          : ""}{" "}
                        <span className={styles.modalWeekday}>({weekday})</span>
                      </td>
                      <td>{r.type}</td>
                      <td>{r.days > 0 ? `${r.days}일` : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.modalCloseFooter}
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function MonthlyPattern({
  past,
}: {
  past: { id: string; days: number; dateStart: string }[];
}) {
  const monthCounts = new Array(12).fill(0);
  past.forEach((r) => {
    const m = new Date(r.dateStart).getMonth();
    monthCounts[m] += r.days;
  });
  const max = Math.max(...monthCounts, 1);
  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>월별 사용</span>
        <span className={styles.panelMeta}>일 단위</span>
      </div>
      <div className={styles.monthlyBars}>
        {monthCounts.map((count, i) => {
          const h = count > 0 ? (count / max) * 100 : 0;
          return (
            <div key={i} className={styles.monthlyCol}>
              {count > 0 && (
                <span className={styles.monthlyCount}>{count}</span>
              )}
              <div
                className={`${styles.monthlyBar} ${
                  count > 0 ? styles.monthlyBarActive : styles.monthlyBarEmpty
                }`}
                style={{
                  height: `${h}%`,
                  minHeight: count > 0 ? 4 : 0,
                }}
              />
              <span className={styles.monthlyLabel}>{i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
