"use client";

import { useMemo, useState } from "react";
import styles from "./ManagerMatcher.module.css";
import {
  AXES,
  ETC,
  NO_VALUE,
  axisValues,
  isRegistered,
  type AxisKey,
  type SegmentRecord,
} from "./segments";

// ─── 담당자 배정 추천 ─────────────────────────────────────────────────────────
// 리드 유형(유입경로/학력/취득사유/반응포인트)을 고르면, 그 유형에서
// 과거 등록률이 가장 높은 담당자를 추천한다.

const ALL = "전체";
const MIN_OVERALL = 30; // 분석 대상 담당자 최소 누적 배정 건수

interface MgrRow {
  manager: string;
  total: number; // 이 유형에서 배정받은 건수
  registered: number;
  rate: number; // %
  overallRate: number; // 담당자 전체 평균 등록률 %
  lift: number; // rate / overallRate
}

export default function ManagerMatcher({ data }: { data: SegmentRecord[] }) {
  const [profile, setProfile] = useState<Partial<Record<AxisKey, string>>>({});
  const [minSample, setMinSample] = useState(15);

  // ── 축별 선택 가능한 값 목록 (빈도순) ──
  const axisOptions = useMemo(() => {
    const out: Record<AxisKey, string[]> = {
      source: [],
      education: [],
      reason: [],
      reaction: [],
    };
    for (const axis of AXES.map((a) => a.key)) {
      const cnt: Record<string, number> = {};
      for (const rec of data)
        for (const v of axisValues(rec, axis)) cnt[v] = (cnt[v] ?? 0) + 1;
      out[axis] = Object.keys(cnt)
        .filter((v) => v !== NO_VALUE && v !== ETC)
        .sort((a, b) => cnt[b] - cnt[a]);
    }
    return out;
  }, [data]);

  // ── 담당자별 전체 평균 등록률 (lift 기준선) ──
  const overallByMgr = useMemo(() => {
    const acc: Record<string, { total: number; reg: number }> = {};
    for (const rec of data) {
      const m = (rec.manager ?? "").trim();
      if (!m) continue;
      if (!acc[m]) acc[m] = { total: 0, reg: 0 };
      acc[m].total += 1;
      if (isRegistered(rec.status)) acc[m].reg += 1;
    }
    const map: Record<string, { total: number; rate: number }> = {};
    for (const [m, v] of Object.entries(acc))
      map[m] = { total: v.total, rate: v.total ? (v.reg / v.total) * 100 : 0 };
    return map;
  }, [data]);

  // ── 선택한 유형에 맞는 레코드 ──
  const matched = useMemo(() => {
    const active = (Object.entries(profile) as [AxisKey, string][]).filter(
      ([, v]) => v && v !== ALL,
    );
    return data.filter((rec) =>
      active.every(([axis, val]) => axisValues(rec, axis).includes(val)),
    );
  }, [data, profile]);

  // ── 담당자 랭킹 ──
  const rows = useMemo<MgrRow[]>(() => {
    const acc: Record<string, { total: number; reg: number }> = {};
    for (const rec of matched) {
      const m = (rec.manager ?? "").trim();
      if (!m) continue;
      if ((overallByMgr[m]?.total ?? 0) < MIN_OVERALL) continue; // 표본 적은 담당자 제외
      if (!acc[m]) acc[m] = { total: 0, reg: 0 };
      acc[m].total += 1;
      if (isRegistered(rec.status)) acc[m].reg += 1;
    }
    return Object.entries(acc)
      .map(([manager, v]) => {
        const rate = v.total ? (v.reg / v.total) * 100 : 0;
        const overallRate = overallByMgr[manager]?.rate ?? 0;
        return {
          manager,
          total: v.total,
          registered: v.reg,
          rate,
          overallRate,
          lift: overallRate > 0 ? rate / overallRate : 0,
        };
      })
      .filter((r) => r.total >= minSample)
      .sort((a, b) => b.rate - a.rate || b.total - a.total);
  }, [matched, overallByMgr, minSample]);

  // ── 세그먼트 전체 평균 (담당자 무관) ──
  const segAvg = useMemo(() => {
    if (matched.length === 0) return 0;
    const reg = matched.filter((r) => isRegistered(r.status)).length;
    return (reg / matched.length) * 100;
  }, [matched]);

  const best = rows[0];
  const activeProfile = (Object.entries(profile) as [AxisKey, string][]).filter(
    ([, v]) => v && v !== ALL,
  );
  const profileText = activeProfile.length
    ? activeProfile.map(([, v]) => v).join(" · ")
    : "전체 리드";

  const setAxis = (axis: AxisKey, val: string) =>
    setProfile((p) => ({ ...p, [axis]: val }));

  const maxRate = Math.max(...rows.map((r) => r.rate), 1);

  return (
    <div>
      {/* 유형 선택 */}
      <div className={styles.selectorBar}>
        <div className={styles.selectorLabel}>리드 유형 선택</div>
        <div className={styles.selectorRow}>
          {AXES.map((a) => (
            <div key={a.key} className={styles.selectField}>
              <label className={styles.selectFieldLabel}>{a.label}</label>
              <select
                className={styles.select}
                value={profile[a.key] ?? ALL}
                onChange={(e) => setAxis(a.key, e.target.value)}
              >
                <option value={ALL}>전체</option>
                {axisOptions[a.key].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div className={styles.selectField}>
            <label className={styles.selectFieldLabel}>
              담당자 최소 표본 {minSample}건
            </label>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={minSample}
              onChange={(e) => setMinSample(Number(e.target.value))}
              className={styles.slider}
            />
          </div>
        </div>
      </div>

      {/* 모수 안내 */}
      <div className={styles.metaBar}>
        <span>
          <b className={styles.profileText}>{profileText}</b> 유형 ·
        </span>
        <span>
          해당 리드{" "}
          <b className={styles.sampleCount}>
            {matched.length.toLocaleString()}건
          </b>
        </span>
        <span className={styles.divider}>·</span>
        <span>
          세그먼트 평균 등록률 <b>{segAvg.toFixed(1)}%</b>
        </span>
        {matched.length < 30 && (
          <span className={styles.warn}>⚠ 표본이 적어 참고만 권장</span>
        )}
      </div>

      {/* 추천 배정 카드 */}
      {best ? (
        <div className={styles.heroCard}>
          <div className={styles.heroName}>{best.manager}</div>
          <div className={styles.heroRate}>
            이 유형 등록률 <b>{best.rate.toFixed(1)}%</b>
          </div>
          <div className={styles.heroSub}>
            세그먼트 평균 {segAvg.toFixed(1)}% · 본인 전체평균{" "}
            {best.overallRate.toFixed(1)}%
            {best.lift >= 1.1 && (
              <span className={styles.heroBadge}>
                강점 {best.lift.toFixed(1)}배
              </span>
            )}
          </div>
          <div className={styles.heroMsg}>
            {profileText} 리드는 <b>{best.manager}</b>에게 배정 추천 — 등록{" "}
            {best.registered}/{best.total}건
          </div>
        </div>
      ) : (
        <div className={styles.empty}>
          조건에 맞는 담당자 데이터가 부족합니다. 유형을 넓히거나 최소 표본 수를
          낮춰보세요.
        </div>
      )}

      {/* 담당자 랭킹 테이블 */}
      {rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thRank}>#</th>
                <th className={styles.thLeft}>담당자</th>
                <th className={styles.thRate}>이 유형 등록률</th>
                <th className={styles.thCenter}>등록/배정</th>
                <th className={styles.thCenter}>본인 평균</th>
                <th className={styles.thCenter}>강점</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const barW = (r.rate / maxRate) * 100;
                const isBest = idx === 0;
                return (
                  <tr
                    key={r.manager}
                    className={isBest ? styles.bestRow : undefined}
                  >
                    <td className={styles.tdRank}>{idx + 1}</td>
                    <td className={styles.tdName}>
                      {r.manager}
                      {isBest && <span className={styles.tdBestTag}>추천</span>}
                    </td>
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
                    <td className={styles.tdCenter}>
                      {r.overallRate.toFixed(1)}%
                    </td>
                    <td className={styles.tdCenter}>
                      <span
                        className={`${styles.lift} ${
                          r.lift >= 1.1
                            ? styles.liftUp
                            : r.lift <= 0.9
                              ? styles.liftDown
                              : ""
                        }`}
                      >
                        {r.lift.toFixed(1)}배
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className={styles.footnote}>
            등록 기준: 등록완료 · 누적 배정 {MIN_OVERALL}건 미만 담당자는 제외 ·
            &lsquo;강점&rsquo;은 본인 전체 평균 대비 이 유형에서의 등록률 배수
          </div>
        </div>
      )}
    </div>
  );
}
