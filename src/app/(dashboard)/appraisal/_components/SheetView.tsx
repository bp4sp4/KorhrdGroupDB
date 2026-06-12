"use client";

// 평가서 1장 (양식 보기/수정 + 점수 입력 겸용)
// 인사고과표(/appraisal)와 내 인사고과(/me/appraisal)에서 공용으로 사용한다.

import { useEffect, useMemo, type ReactNode } from "react";
import { Info, Minus, Plus } from "lucide-react";
import styles from "../page.module.css";
import {
  type AppraisalSheet,
  type ScoreMatrix,
  columnSubtotals,
  SCORE_SCALE,
  totalScore,
} from "@/lib/appraisal/form";
import {
  quantIndicatorKind,
  type QuantMetrics,
} from "@/lib/appraisal/quantScore";

// 전분기 대비 비율 → 점수 환산표 (매출·등록률 공통)
const RATIO_BANDS_TEXT =
  "점수 환산 (전분기 대비)\n" +
  "· 150% 이상 = 5점\n" +
  "· 120~150% 미만 = 4점\n" +
  "· 80~120% 미만 = 3점\n" +
  "· 60~80% 미만 = 2점\n" +
  "· 60% 미만 = 1점";

// 지표별 계산식 — 문항 옆 ⓘ 호버 툴팁에 표시
function quantFormula(kind: ReturnType<typeof quantIndicatorKind>): string {
  switch (kind) {
    case "sales":
      return (
        "비율(%) = 당분기 평균 매출 ÷ 전분기 평균 매출 × 100\n" +
        "· 평균 매출: 매출파일(자격증·수강등록·실습) 결제일 기준 분기 합산 ÷ 3개월\n" +
        "· 2026년 3분기 평가는 전분기 기준을 2026년 6월(1개월)로 산정\n" +
        RATIO_BANDS_TEXT
      );
    case "registration":
      return (
        "등록률(%) = 등록완료 ÷ 배정 DB × 100\n" +
        "· 배정 DB: 해당 분기 담당자로 배정된 학점은행 상담 건수\n" +
        "· 등록완료: 그중 상담 상태가 '등록완료'인 건수\n" +
        "비율(%) = 당분기 등록률 ÷ 전분기 등록률 × 100\n" +
        "· 2026년 3분기 평가는 전분기 기준을 2026년 6월(1개월)로 산정\n" +
        RATIO_BANDS_TEXT
      );
    case "assignedDb":
      return (
        "배정 DB수 = 해당 분기 담당자로 배정된 학점은행 상담 건수\n" +
        "· 기준: 상담 등록일이 해당 분기(3개월)에 포함\n" +
        "· 상대평가: 같은 부서 담당자 간 순위 비교\n" +
        "  (분기 배정 이력이 있는 부서원 + 본인 기준)\n" +
        "점수 환산\n" +
        "· 상위 20% = 5점\n" +
        "· 상위 40% = 4점\n" +
        "· 중위 40% = 3점\n" +
        "· 하위 20% = 2점\n" +
        "· 최하위 = 1점"
      );
    case "refund":
      return (
        "환불 건수 = 해당 분기 수강등록 중 환불 처리 건수\n" +
        "· 기준: 등록일이 해당 분기 + 상태가 '환불' 또는 '당월 환불'\n" +
        "점수 환산\n" +
        "· 0~3회 = 5점\n" +
        "· 4~6회 = 4점\n" +
        "· 7~9회 = 3점\n" +
        "· 10~12회 = 2점\n" +
        "· 13회 이상 = 1점"
      );
    case "attendance":
      return (
        "지각 = 출근 시각이 10:00 이후인 날 수\n" +
        "결근 = 분기 내 지난 평일 중 출근 기록·승인 휴가 모두 없는 날 수\n" +
        "· 기준: 출퇴근 기록 + 승인된 휴가신청서\n" +
        "점수 환산\n" +
        "· 지각 0회·결근 0회 = 5점\n" +
        "· 지각 1~2회 = 4점\n" +
        "· 지각 3~4회 = 3점\n" +
        "· 지각 5~6회 또는 결근 1회 = 2점\n" +
        "· 지각 7회 이상 또는 결근 2회 이상 = 1점"
      );
    default:
      return "";
  }
}

// 문항 옆 ⓘ — 호버 시 계산식 툴팁
function QuantInfo({ text }: { text: string }) {
  const kind = quantIndicatorKind(text);
  if (!kind) return null;
  return (
    <span className={styles.quantInfo} aria-label="계산식 보기">
      <Info size={13} />
      <span className={styles.quantTooltip} role="tooltip">
        {quantFormula(kind)}
      </span>
    </span>
  );
}

// 정량평가 자동 산출 배지 — 지표 문구에 맞는 실측값 표시
function QuantBadge({
  metrics,
  text,
}: {
  metrics: QuantMetrics;
  text: string;
}) {
  const kind = quantIndicatorKind(text);
  if (!kind) return null;

  let body: ReactNode = null;
  switch (kind) {
    case "sales":
      body =
        metrics.sales.rate != null ? (
          <>
            {metrics.prevPeriod} 평균 {metrics.sales.prevAvg?.toLocaleString()}
            만원 · 당분기 평균 {metrics.sales.currAvg.toLocaleString()}만원 ·{" "}
            {metrics.sales.rate}% → <b>{metrics.sales.score}점</b>
          </>
        ) : (
          <>
            {metrics.prevPeriod} 실적 없음 (당분기 평균{" "}
            {metrics.sales.currAvg.toLocaleString()}만원) — 비교 산출 불가
          </>
        );
      break;
    case "registration":
      body =
        metrics.registration.compareRate != null ? (
          <>
            등록률 {metrics.prevPeriod} {metrics.registration.prevRate}% →
            당분기 {metrics.registration.rate}% (
            {metrics.registration.compareRate}%) →{" "}
            <b>{metrics.registration.score}점</b>
          </>
        ) : metrics.registration.assigned > 0 ? (
          <>
            배정 DB {metrics.registration.assigned}건 중 등록{" "}
            {metrics.registration.registered}건 → 등록률{" "}
            <b>{metrics.registration.rate}%</b> ({metrics.prevPeriod} 자료 없음
            — 비교 산출 불가)
          </>
        ) : (
          <>배정 DB 없음</>
        );
      break;
    case "assignedDb":
      body =
        metrics.assignedDb.score != null ? (
          <>
            배정 DB <b>{metrics.assignedDb.count.toLocaleString()}건</b> · 부서
            내 {metrics.assignedDb.rank}위/{metrics.assignedDb.groupSize}명 →{" "}
            <b>{metrics.assignedDb.score}점</b>
          </>
        ) : (
          <>
            배정 DB <b>{metrics.assignedDb.count.toLocaleString()}건</b> (부서
            내 비교 대상 없음)
          </>
        );
      break;
    case "refund":
      body = (
        <>
          환불 <b>{metrics.refund.count}건</b> → <b>{metrics.refund.score}점</b>
        </>
      );
      break;
    case "attendance":
      body = (
        <>
          지각 <b>{metrics.attendance.lateCount}회</b> · 결근{" "}
          <b>{metrics.attendance.absentCount}회</b> →{" "}
          <b>{metrics.attendance.score}점</b>
        </>
      );
      break;
  }

  return (
    <span className={styles.quantBadge}>
      자동산출 {metrics.period} · {body}
    </span>
  );
}

// 지표 문구에 해당하는 자동산출 점수 (1~5) — 산출 불가/비대상이면 null
function autoQuantScore(metrics: QuantMetrics, text: string): number | null {
  switch (quantIndicatorKind(text)) {
    case "sales":
      return metrics.sales.score;
    case "registration":
      return metrics.registration.score;
    case "assignedDb":
      return metrics.assignedDb.score;
    case "refund":
      return metrics.refund.score;
    case "attendance":
      return metrics.attendance.score;
    default:
      return null;
  }
}

export function SheetView({
  sheet,
  editing,
  onChange,
  scores,
  onScore,
  salesMetric,
  highlightMissing = false,
}: {
  sheet: AppraisalSheet;
  editing: boolean;
  onChange: (fn: (sheet: AppraisalSheet) => void) => void;
  /** 점수표 — 있으면 점수 표시(평가 모드) */
  scores?: ScoreMatrix;
  /** 점수 클릭 핸들러 — 있으면 점수 입력 가능 */
  onScore?: (
    blockIdx: number,
    indicatorIdx: number,
    value: number | null,
  ) => void;
  /** 정량평가 자동 산출값 — 정량 지표(매출·등록률·배정 DB·환불·근태)에 표시 */
  salesMetric?: QuantMetrics | null;
  /** 제출 시도 후 미체크 행 빨간 표시 (체크하면 자동 해제) */
  highlightMissing?: boolean;
}) {
  const blocks = useMemo(() => sheet.blocks ?? [], [sheet.blocks]);

  // 정량 지표 자동산출 점수를 점수표에 강제 반영 (평가자가 변경 불가)
  // 산출 불가(null)인 정량 행도 수동 점수를 지워 자동산출 외 입력을 차단한다.
  useEffect(() => {
    if (!salesMetric || !scores || !onScore) return;
    blocks.forEach((block, bi) => {
      (block.indicators ?? []).forEach((ind, ii) => {
        if (!quantIndicatorKind(ind.text ?? "")) return;
        const auto = autoQuantScore(salesMetric, ind.text ?? "");
        if ((scores[bi]?.[ii] ?? null) !== auto) onScore(bi, ii, auto);
      });
    });
  }, [salesMetric, scores, onScore, blocks]);

  const hasEvalType =
    editing || blocks.some((b) => b.indicators?.some((i) => i.evalType));
  const scoreCols = SCORE_SCALE.length;
  const totalCols = 4 + (hasEvalType ? 1 : 0) + scoreCols;
  const subtotals = scores ? columnSubtotals(scores) : null;
  const total = scores ? totalScore(scores) : null;

  return (
    <section className={styles.sheet}>
      {/* 상단 정보 */}
      <table className={styles.metaTable}>
        <tbody>
          <tr>
            <th className={styles.metaLabel}>평가서</th>
            <td className={styles.sheetName}>
              <EditableText
                value={sheet.title}
                editing={editing}
                onChange={(v) => onChange((s) => void (s.title = v))}
              />
            </td>
          </tr>
          <tr>
            <th className={styles.metaLabel}>관리부서</th>
            <td>
              <EditableText
                value={sheet.managingDept}
                editing={editing}
                onChange={(v) => onChange((s) => void (s.managingDept = v))}
              />
            </td>
          </tr>
          <tr>
            <th className={styles.metaLabel}>지표명</th>
            <td>
              <EditableText
                value={sheet.indicatorName}
                editing={editing}
                onChange={(v) => onChange((s) => void (s.indicatorName = v))}
              />
            </td>
          </tr>
          <tr>
            <th className={styles.metaLabel}>측정방법</th>
            <td>
              <EditableText
                value={sheet.method}
                editing={editing}
                multiline
                onChange={(v) => onChange((s) => void (s.method = v))}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* 평가 항목 */}
      <table className={styles.mainTable}>
        <thead>
          <tr>
            <th className={styles.colNo}>번호</th>
            <th className={styles.colCategory}>분야</th>
            <th className={styles.colEvaluator}>평가자</th>
            <th>세부지표</th>
            {hasEvalType && <th className={styles.colEvalType}>구분</th>}
            {SCORE_SCALE.map((n) => (
              <th key={n} className={styles.colScore}>
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {blocks.map((block, bi) =>
            (block.indicators ?? []).map((indicator, ii) => (
              <tr key={`${bi}-${ii}`}>
                {ii === 0 && (
                  <>
                    <td
                      rowSpan={block.indicators.length}
                      className={styles.colNo}
                    >
                      {block.no}
                      {editing && blocks.length > 1 && (
                        <button
                          type="button"
                          className={styles.miniBtn}
                          title="분야 삭제"
                          onClick={() =>
                            onChange((s) => {
                              s.blocks.splice(bi, 1);
                              s.blocks.forEach((b, i) => (b.no = i + 1));
                            })
                          }
                        >
                          <Minus size={11} />
                        </button>
                      )}
                    </td>
                    <td
                      rowSpan={block.indicators.length}
                      className={styles.colCategory}
                    >
                      <EditableText
                        value={block.category}
                        editing={editing}
                        multiline
                        center
                        onChange={(v) =>
                          onChange((s) => void (s.blocks[bi].category = v))
                        }
                      />
                    </td>
                    <td
                      rowSpan={block.indicators.length}
                      className={styles.colEvaluator}
                    >
                      <EditableText
                        value={block.evaluator}
                        editing={editing}
                        multiline
                        center
                        onChange={(v) =>
                          onChange((s) => void (s.blocks[bi].evaluator = v))
                        }
                      />
                    </td>
                  </>
                )}
                <td className={styles.indicatorCell}>
                  <div className={styles.indicatorInner}>
                    {!editing && salesMetric ? (
                      <span className={styles.indicatorTextWrap}>
                        <EditableText
                          value={indicator.text}
                          editing={false}
                          onChange={() => {}}
                        />
                        <QuantInfo text={indicator.text} />
                      </span>
                    ) : (
                      <EditableText
                        value={indicator.text}
                        editing={editing}
                        onChange={(v) =>
                          onChange(
                            (s) => void (s.blocks[bi].indicators[ii].text = v),
                          )
                        }
                      />
                    )}
                    {!editing && salesMetric && (
                      <QuantBadge metrics={salesMetric} text={indicator.text} />
                    )}
                    {editing && block.indicators.length > 1 && (
                      <button
                        type="button"
                        className={styles.miniBtn}
                        title="행 삭제"
                        onClick={() =>
                          onChange(
                            (s) => void s.blocks[bi].indicators.splice(ii, 1),
                          )
                        }
                      >
                        <Minus size={11} />
                      </button>
                    )}
                    {editing && ii === block.indicators.length - 1 && (
                      <button
                        type="button"
                        className={styles.miniBtn}
                        title="행 추가"
                        onClick={() =>
                          onChange(
                            (s) =>
                              void s.blocks[bi].indicators.push({ text: "" }),
                          )
                        }
                      >
                        <Plus size={11} />
                      </button>
                    )}
                  </div>
                </td>
                {hasEvalType && (
                  <td className={styles.colEvalType}>
                    <EditableText
                      value={indicator.evalType ?? ""}
                      editing={editing}
                      center
                      placeholder="-"
                      onChange={(v) =>
                        onChange(
                          (s) =>
                            void (s.blocks[bi].indicators[ii].evalType =
                              v.trim() || undefined),
                        )
                      }
                    />
                  </td>
                )}
                {SCORE_SCALE.map((n) => {
                  // 정량 지표 행 — 자동산출 점수로 체크 고정, 평가자(팀장 포함) 수정 불가
                  // 산출 불가인 행도 잠가서 수동 입력을 막는다 (채점 제외)
                  const lockedMetrics =
                    !editing && scores ? (salesMetric ?? null) : null;
                  if (
                    lockedMetrics &&
                    quantIndicatorKind(indicator.text ?? "") != null
                  ) {
                    const autoScore = autoQuantScore(
                      lockedMetrics,
                      indicator.text ?? "",
                    );
                    return (
                      <td
                        key={n}
                        className={`${styles.scoreCell} ${autoScore === n ? styles.scoreCellMarked : ""} ${styles.scoreCellLocked}`}
                        title={
                          autoScore != null
                            ? "자동산출 점수 — 수정할 수 없습니다"
                            : "자동산출 항목 — 산출 불가 (채점 제외)"
                        }
                      >
                        {autoScore === n ? "✓" : ""}
                      </td>
                    );
                  }
                  const marked = scores?.[bi]?.[ii] === n;
                  // 제출 시도 후 미체크 행 강조 — 체크하는 순간 자동 해제
                  const missing =
                    highlightMissing &&
                    !!onScore &&
                    scores?.[bi]?.[ii] == null;
                  if (onScore) {
                    return (
                      <td
                        key={n}
                        className={`${styles.scoreCell} ${styles.scoreCellClickable} ${marked ? styles.scoreCellMarked : ""} ${missing ? styles.scoreCellMissing : ""}`}
                        data-score-missing={missing && n === 1 ? "1" : undefined}
                        onClick={() => onScore(bi, ii, marked ? null : n)}
                      >
                        {marked ? "✓" : ""}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={n}
                      className={`${styles.scoreCell} ${marked ? styles.scoreCellMarked : ""}`}
                    >
                      {marked ? "✓" : ""}
                    </td>
                  );
                })}
              </tr>
            )),
          )}
          {editing && (
            <tr>
              <td colSpan={totalCols} className={styles.addBlockRow}>
                <button
                  type="button"
                  className={styles.addBlockBtn}
                  onClick={() =>
                    onChange(
                      (s) =>
                        void s.blocks.push({
                          no: s.blocks.length + 1,
                          category: "",
                          evaluator: "",
                          indicators: [{ text: "" }],
                        }),
                    )
                  }
                >
                  <Plus size={13} /> 분야 추가
                </button>
              </td>
            </tr>
          )}
          <tr className={styles.subtotalRow}>
            <td colSpan={totalCols - scoreCols}>소 계</td>
            {SCORE_SCALE.map((n) => (
              <td key={n} className={styles.scoreCell}>
                {subtotals ? subtotals[n] : ""}
              </td>
            ))}
          </tr>
          <tr className={styles.totalRow}>
            <td colSpan={totalCols - scoreCols}>총 계</td>
            <td colSpan={scoreCols} className={styles.totalCell}>
              {total !== null ? `${total}점` : ""}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 측정 정보 */}
      <table className={styles.footTable}>
        <thead>
          <tr>
            <th>측정단위</th>
            <th>평가주기</th>
            <th>성과측정/등록주기</th>
            <th>근거자료 및 출처</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <EditableText
                value={sheet.unit}
                editing={editing}
                center
                onChange={(v) => onChange((s) => void (s.unit = v))}
              />
            </td>
            <td>
              <EditableText
                value={sheet.cycle}
                editing={editing}
                center
                onChange={(v) => onChange((s) => void (s.cycle = v))}
              />
            </td>
            <td>
              <EditableText
                value={sheet.registerCycle}
                editing={editing}
                center
                onChange={(v) => onChange((s) => void (s.registerCycle = v))}
              />
            </td>
            <td>
              <EditableText
                value={sheet.evidence}
                editing={editing}
                center
                onChange={(v) => onChange((s) => void (s.evidence = v))}
              />
            </td>
          </tr>
        </tbody>
      </table>

      {/* 적용대상 / 사용분야 / 유의사항 */}
      <table className={styles.metaTable}>
        <tbody>
          <tr>
            <th className={styles.metaLabel}>적용대상</th>
            <td>
              <EditableText
                value={sheet.target}
                editing={editing}
                onChange={(v) => onChange((s) => void (s.target = v))}
              />
            </td>
          </tr>
          <tr>
            <th className={styles.metaLabel}>사용분야</th>
            <td>
              <EditableText
                value={sheet.usage}
                editing={editing}
                onChange={(v) => onChange((s) => void (s.usage = v))}
              />
            </td>
          </tr>
          <tr>
            <th className={styles.metaLabel}>유의사항</th>
            <td>
              <EditableText
                value={sheet.note}
                editing={editing}
                multiline
                onChange={(v) => onChange((s) => void (s.note = v))}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 보기/수정 겸용 텍스트
// ─────────────────────────────────────────────────────────────────────
function EditableText({
  value,
  editing,
  onChange,
  multiline = false,
  center = false,
  placeholder,
}: {
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  multiline?: boolean;
  center?: boolean;
  placeholder?: string;
}) {
  if (!editing) {
    return (
      <span
        className={`${styles.text}${center ? ` ${styles.textCenter}` : ""}`}
      >
        {value || (placeholder ?? "")}
      </span>
    );
  }
  if (multiline) {
    return (
      <textarea
        className={`${styles.cellTextarea}${center ? ` ${styles.textCenter}` : ""}`}
        value={value}
        rows={Math.max(2, value.split("\n").length)}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      className={`${styles.cellInput}${center ? ` ${styles.textCenter}` : ""}`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
