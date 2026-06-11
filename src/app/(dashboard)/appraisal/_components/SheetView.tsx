"use client";

// 평가서 1장 (양식 보기/수정 + 점수 입력 겸용)
// 인사고과표(/appraisal)와 내 인사고과(/me/appraisal)에서 공용으로 사용한다.

import { type ReactNode } from "react";
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

// 지표별 계산식 — 문항 옆 ⓘ 호버 툴팁에 표시
function quantFormula(kind: ReturnType<typeof quantIndicatorKind>): string {
  switch (kind) {
    case "sales":
      return (
        "달성률(%) = 분기 실적 ÷ 분기 목표 × 100\n" +
        "· 목표: 대시보드 '이번달 목표 설정' 월별 입력값의 분기(3개월) 합산\n" +
        "· 실적: 매출파일(자격증·수강등록·실습) 결제일 기준 분기 합산\n" +
        "평가점수 환산\n" +
        "· 120% 이상 = 120점\n" +
        "· 110~119% = 110점\n" +
        "· 100~109% = 100점\n" +
        "· 90~99% = 90점\n" +
        "· 80~89% = 80점\n" +
        "· 80% 미만 = 70점"
      );
    case "registration":
      return (
        "등록률(%) = 등록완료 ÷ 배정 DB × 100\n" +
        "· 배정 DB: 해당 분기 담당자로 배정된 학점은행 상담 건수\n" +
        "· 등록완료: 그중 상담 상태가 '등록완료'인 건수"
      );
    case "assignedDb":
      return (
        "배정 DB수 = 해당 분기 담당자로 배정된 학점은행 상담 건수\n" +
        "· 기준: 상담 등록일이 해당 분기(3개월)에 포함\n" +
        "· 상대평가: 팀 내 담당자 간 비교"
      );
    case "refund":
      return (
        "환불 건수 = 해당 분기 수강등록 중 환불 처리 건수\n" +
        "· 기준: 등록일이 해당 분기 + 상태가 '환불' 또는 '당월 환불'"
      );
    case "attendance":
      return (
        "출근일수 = 해당 분기 출근 기록이 있는 날 수\n" +
        "지각 = 출근 시각이 10:00 이후인 날 수\n" +
        "· 기준: 출퇴근 기록"
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
            목표 {metrics.sales.goalTotal?.toLocaleString()}만원 · 실적{" "}
            {metrics.sales.actualTotal.toLocaleString()}만원 · 달성률{" "}
            {metrics.sales.rate}% → <b>{metrics.sales.score}점</b>
          </>
        ) : (
          <>
            목표 미설정 (실적 {metrics.sales.actualTotal.toLocaleString()}만원)
            — 대시보드에서 이번달 목표를 입력하세요
          </>
        );
      break;
    case "registration":
      body =
        metrics.registration.assigned > 0 ? (
          <>
            배정 DB {metrics.registration.assigned}건 중 등록{" "}
            {metrics.registration.registered}건 → 등록률{" "}
            <b>{metrics.registration.rate}%</b>
          </>
        ) : (
          <>배정 DB 없음</>
        );
      break;
    case "assignedDb":
      body = (
        <>
          배정 DB <b>{metrics.registration.assigned.toLocaleString()}건</b>
        </>
      );
      break;
    case "refund":
      body = (
        <>
          환불 <b>{metrics.refundCount}건</b>
        </>
      );
      break;
    case "attendance":
      body = (
        <>
          출근 {metrics.attendance.workDays}일 · 지각{" "}
          <b>{metrics.attendance.lateCount}회</b>
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

export function SheetView({
  sheet,
  editing,
  onChange,
  scores,
  onScore,
  salesMetric,
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
}) {
  const blocks = sheet.blocks ?? [];
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
                  const marked = scores?.[bi]?.[ii] === n;
                  if (onScore) {
                    return (
                      <td
                        key={n}
                        className={`${styles.scoreCell} ${styles.scoreCellClickable} ${marked ? styles.scoreCellMarked : ""}`}
                        onClick={() => onScore(bi, ii, marked ? null : n)}
                      >
                        {marked ? n : ""}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={n}
                      className={`${styles.scoreCell} ${marked ? styles.scoreCellMarked : ""}`}
                    >
                      {marked ? n : ""}
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
