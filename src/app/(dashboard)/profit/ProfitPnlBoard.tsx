"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ProfitPnlBoard.module.css";

interface SgnaItem {
  label: string;
  amount: number;
  note: string;
}

interface PnlResp {
  division: string;
  settingsMonth: string;
  selectedMonth: string | null;
  months: { edu: string | null; cert: string | null; practice: string | null };
  revenue: {
    eduOurs: number;
    eduOthers: number;
    cert: number;
    practice: number;
  };
  counts: { eduOursSubjects: number; certSubjects: number };
  cogs: {
    eduInstructorFee: number;
    eduInstructorMonth: string;
    eduInstructorAccounts: string[];
    eduInstructorOk: boolean;
  };
  assumptions: { settlement_rate: number; cert_fee_per_subject: number };
  certUsageFee: number;
  certUsageCustom: boolean;
  sgnaItems: SgnaItem[];
  sgnaSeedMonth: string | null;
}

const INSURANCE_RATE = 0.12; // 4대보험 = 기본급(정규직) × 12%

const won = (n: number) => Math.round(n).toLocaleString("ko-KR");

// 월 선택 옵션 — 최근 12개월
function buildMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const list: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    list.push({ value: v, label: `${d.getFullYear()}년 ${d.getMonth() + 1}월` });
  }
  return list;
}

// 숫자 입력 — 포커스 중엔 콤마 없이 원시 숫자(커서 안 튐), 벗어나면 콤마/단위 표시
function NumberField({
  value,
  onCommit,
  kind,
  className,
  readOnly,
}: {
  value: number;
  onCommit: (n: number) => void;
  kind: "money" | "rate";
  className?: string;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? (kind === "money" ? won(value) : String(value));
  return (
    <input
      className={className}
      value={display}
      readOnly={readOnly}
      inputMode={kind === "money" ? "numeric" : "decimal"}
      onFocus={readOnly ? undefined : () => setDraft(value ? String(value) : "")}
      onChange={
        readOnly
          ? undefined
          : (e) => {
              if (kind === "money") {
                const d = e.target.value.replace(/[^\d]/g, "");
                setDraft(d);
                onCommit(d === "" ? 0 : parseInt(d, 10));
              } else {
                const v = e.target.value.replace(/[^\d.]/g, "");
                setDraft(v);
                onCommit(Math.min(100, Number(v) || 0));
              }
            }
      }
      onBlur={readOnly ? undefined : () => setDraft(null)}
    />
  );
}

export default function ProfitPnlBoard({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<PnlResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 편집 상태
  const [settlementRate, setSettlementRate] = useState(35);
  const [certUsageFee, setCertUsageFee] = useState(0);
  const [sgnaItems, setSgnaItems] = useState<SgnaItem[]>([]);
  // 월 필터 — null이면 최신(자동)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const monthOptions = buildMonthOptions();
  const saveMonthRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = selectedMonth
        ? `/api/profit/pnl?month=${selectedMonth}`
        : "/api/profit/pnl";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "불러오기 실패");
      }
      const d = (await res.json()) as PnlResp;
      setData(d);
      saveMonthRef.current = d.settingsMonth; // 저장(PUT) 대상 월
      setSettlementRate(d.assumptions.settlement_rate);
      setCertUsageFee(d.certUsageFee);
      setSgnaItems(d.sgnaItems);
    } catch (e) {
      setData(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── 저장 (디바운스) ──
  const pendingRef = useRef<Record<string, unknown>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSave = useCallback((fields: Record<string, unknown>) => {
    Object.assign(pendingRef.current, fields);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const payload = { ...pendingRef.current };
      pendingRef.current = {};
      void fetch("/api/profit/pnl", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, month: saveMonthRef.current }),
      }).catch(() => {});
    }, 600);
  }, []);

  if (loading) return <div className={styles.state}>불러오는 중…</div>;
  if (error || !data)
    return <div className={styles.state}>{error ?? "데이터가 없습니다."}</div>;

  // ── 파생 계산 ──
  const { eduOurs, eduOthers, cert, practice } = data.revenue;
  const revenueTotal = eduOurs + eduOthers + cert + practice;

  const cogsEdu = data.cogs.eduInstructorFee; // 학점은행제 교강사비
  const cogsSettle = Math.round((eduOthers * settlementRate) / 100); // 타 교육원 정산금
  const cogsCert = certUsageFee; // 민간자격증 과목 사용료
  const cogsTotal = cogsEdu + cogsSettle + cogsCert;

  const grossProfit = revenueTotal - cogsTotal; // 매출총이익

  // 판관비 — 4대보험(자동) + 커스텀 행
  const baseSalary = sgnaItems
    .filter((it) => it.label.includes("기본급"))
    .reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const insurance = Math.round(baseSalary * INSURANCE_RATE);
  const sgnaItemsTotal = sgnaItems.reduce(
    (s, it) => s + (Number(it.amount) || 0),
    0,
  );
  const sgnaTotal = insurance + sgnaItemsTotal;

  const operatingProfit = revenueTotal - cogsTotal - sgnaTotal; // 영업이익
  const opMargin =
    revenueTotal > 0 ? (operatingProfit / revenueTotal) * 100 : 0;

  const tag = (m: string | null) => m ?? "-";

  const updateItem = (i: number, patch: Partial<SgnaItem>) => {
    const next = sgnaItems.map((it, idx) =>
      idx === i ? { ...it, ...patch } : it,
    );
    setSgnaItems(next);
    queueSave({ sgna_items: next });
  };
  const addItem = () => {
    const next = [...sgnaItems, { label: "", amount: 0, note: "" }];
    setSgnaItems(next);
    queueSave({ sgna_items: next });
  };
  const removeItem = (i: number) => {
    const next = sgnaItems.filter((_, idx) => idx !== i);
    setSgnaItems(next);
    queueSave({ sgna_items: next });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.controls}>
        <select
          className={styles.monthSelect}
          value={selectedMonth ?? ""}
          onChange={(e) => setSelectedMonth(e.target.value || null)}
        >
          <option value="">최신(자동)</option>
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => void load()}
        >
          새로고침
        </button>
      </div>

      <div className={styles.body}>
        {/* ── 좌측 요약 (제목 + 손익 흐름) ── */}
        <div className={styles.leftCol}>
          <h1 className={styles.title}>예상손익계산서</h1>
          <p className={styles.caption}>
            한평생그룹 · {data.division} · 단위 원
          </p>
          <div className={styles.sumOpLabel}>예상 영업이익</div>
          <div className={styles.sumOpValue}>
            {won(operatingProfit)}
            <span className={styles.sumOpUnit}>원</span>
          </div>
          <div className={styles.sumRate}>
            영업이익률 {opMargin.toFixed(1)}%
          </div>

          <div className={styles.sumDivider} />

          <div className={`${styles.sumRow} ${styles.sumRowFirst}`}>
            <span className={styles.sumLabel}>매출</span>
            <span className={styles.sumValue}>{won(revenueTotal)}</span>
          </div>
          <div className={styles.sumRow}>
            <span className={styles.sumLabel}>− 매출원가</span>
            <span className={styles.sumValue}>{won(cogsTotal)}</span>
          </div>
          <div className={styles.sumRow}>
            <span className={styles.sumLabelEm}>= 매출총이익</span>
            <span className={`${styles.sumValue} ${styles.sumValueEm}`}>
              {won(grossProfit)}
            </span>
          </div>
          <div className={styles.sumRow}>
            <span className={styles.sumLabel}>− 판매관리비</span>
            <span className={styles.sumValue}>{won(sgnaTotal)}</span>
          </div>
        </div>

        {/* ── 우측 원장 ── */}
        <div className={styles.rightCol}>
          <div className={`${styles.grid3} ${styles.colHeadRow}`}>
            <div className={styles.colHead}>과목</div>
            <div className={`${styles.colHead} ${styles.colHeadRight}`}>
              금액
            </div>
            <div className={`${styles.colHead} ${styles.colHeadNote}`}>
              비고
            </div>
          </div>

          {/* 매출 */}
          <div className={`${styles.grid3} ${styles.groupHeader}`}>
            <div className={styles.groupTitle}>매출</div>
            <div className={styles.groupTotal}>{won(revenueTotal)}</div>
            <div />
          </div>
          <div className={`${styles.grid3} ${styles.itemRow}`}>
            <div className={styles.itemLabel}>
              우리 교육원 <span className={styles.itemHint}>(덧셈·올티칭)</span>
            </div>
            <div className={styles.itemAmt}>{won(eduOurs)}</div>
            <div className={styles.itemNote}>등록월 {tag(data.months.edu)}</div>
          </div>
          <div className={`${styles.grid3} ${styles.itemRow}`}>
            <div className={styles.itemLabel}>타 교육원</div>
            <div className={styles.itemAmt}>{won(eduOthers)}</div>
            <div className={styles.itemNote}>덧셈·올티칭 외 전체</div>
          </div>
          <div className={`${styles.grid3} ${styles.itemRow}`}>
            <div className={styles.itemLabel}>민간자격증</div>
            <div className={styles.itemAmt}>{won(cert)}</div>
            <div className={styles.itemNote}>
              결제월 {tag(data.months.cert)}
            </div>
          </div>
          <div className={`${styles.grid3} ${styles.itemRow}`}>
            <div className={styles.itemLabel}>실습서비스</div>
            <div className={styles.itemAmt}>{won(practice)}</div>
            <div className={styles.itemNote}>
              결제월 {tag(data.months.practice)}
            </div>
          </div>

          {/* 매출원가 */}
          <div className={`${styles.grid3} ${styles.groupHeader}`}>
            <div className={styles.groupTitle}>매출원가</div>
            <div className={`${styles.groupTotal} ${styles.groupTotalCost}`}>
              {won(cogsTotal)}
            </div>
            <div />
          </div>
          <div className={`${styles.grid3} ${styles.itemRow}`}>
            <div className={styles.itemLabel}>학점은행제 (교강사)</div>
            <div className={styles.itemAmt}>{won(cogsEdu)}</div>
            <div className={styles.itemNote}>
              교수비 통장 출금 · {data.cogs.eduInstructorMonth}
              {!data.cogs.eduInstructorOk && (
                <span className={styles.warn}> · 조회실패</span>
              )}
            </div>
          </div>
          <div className={`${styles.grid3} ${styles.itemRow}`}>
            <div className={styles.itemLabel}>타 교육원 정산금</div>
            <div className={styles.itemAmt}>{won(cogsSettle)}</div>
            <div className={styles.itemNote}>
              <span className={styles.muted}>타매출 ×</span>
              <NumberField
                className={`${styles.rateInput} ${!canEdit ? styles.readonly : ""}`}
                value={settlementRate}
                kind="rate"
                readOnly={!canEdit}
                onCommit={(n) => {
                  setSettlementRate(n);
                  queueSave({ settlement_rate: n });
                }}
              />
              <span className={styles.muted}>%</span>
            </div>
          </div>
          <div className={`${styles.grid3} ${styles.itemRow}`}>
            <div className={styles.itemLabel}>민간자격증 과목 사용료</div>
            <div>
              <NumberField
                className={`${styles.amtInput} ${!canEdit ? styles.readonly : ""}`}
                value={certUsageFee}
                kind="money"
                readOnly={!canEdit}
                onCommit={(n) => {
                  setCertUsageFee(n);
                  queueSave({ cert_usage_fee: n });
                }}
              />
            </div>
            <div />
          </div>

          {/* 매출총이익 */}
          <div className={`${styles.grid3} ${styles.subtotalRow}`}>
            <div className={styles.subtotalTitle}>매출총이익</div>
            <div className={styles.subtotalAmt}>{won(grossProfit)}</div>
            <div className={styles.subtotalNote}>매출 − 매출원가</div>
          </div>

          {/* 판매관리비 */}
          <div className={`${styles.grid3} ${styles.groupHeader}`}>
            <div className={styles.groupTitle}>판매관리비</div>
            <div className={`${styles.groupTotal} ${styles.groupTotalCost}`}>
              {won(sgnaTotal)}
            </div>
            <div className={styles.groupNote}>
              {data.sgnaSeedMonth ? `${data.sgnaSeedMonth} 지출 기준` : ""}
            </div>
          </div>
          {/* 4대보험 — 기본급(정규직) × 12% 자동 */}
          <div className={`${styles.grid3} ${styles.itemRow}`}>
            <div className={styles.itemLabel}>4대보험</div>
            <div className={styles.itemAmt}>{won(insurance)}</div>
            <div className={styles.itemNote}>기본급(정규직) × 12% 자동</div>
          </div>
          {sgnaItems.map((it, i) => (
            <div key={i} className={`${styles.grid3} ${styles.itemRow}`}>
              <div className={styles.labelCell}>
                <input
                  className={`${styles.labelInput} ${!canEdit ? styles.readonly : ""}`}
                  value={it.label}
                  placeholder="항목명"
                  readOnly={!canEdit}
                  onChange={(e) => updateItem(i, { label: e.target.value })}
                />
              </div>
              <div>
                <NumberField
                  className={`${styles.amtInput} ${!canEdit ? styles.readonly : ""}`}
                  value={it.amount}
                  kind="money"
                  readOnly={!canEdit}
                  onCommit={(n) => updateItem(i, { amount: n })}
                />
              </div>
              <div className={styles.noteCell}>
                <input
                  className={`${styles.noteInput} ${!canEdit ? styles.readonly : ""}`}
                  value={it.note}
                  placeholder="비고"
                  readOnly={!canEdit}
                  onChange={(e) => updateItem(i, { note: e.target.value })}
                />
                {canEdit && (
                  <button
                    type="button"
                    className={styles.delBtn}
                    onClick={() => removeItem(i)}
                    title="행 삭제"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
          {canEdit && (
            <div className={styles.addRow}>
              <button type="button" className={styles.addBtn} onClick={addItem}>
                + 행 추가
              </button>
            </div>
          )}

          {/* 영업이익 */}
          <div className={`${styles.grid3} ${styles.totalRow}`}>
            <div className={styles.totalTitle}>영업이익</div>
            <div className={styles.totalAmt}>{won(operatingProfit)}</div>
            <div className={styles.totalNote}>
              영업이익률 {opMargin.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      <p className={styles.footnote}>
        매출은 각 출처(학점은행제·민간자격증·실습서비스)의 최신 데이터 월을
        매출파일과 동일 기준으로 자동 반영합니다(환불·삭제 제외). 학점은행제
        교강사비는 ‘학점은행제 교수비’ 통장(신한) 출금 실시간 연동, 4대보험은
        기본급(정규직)×12% 자동이며, 그 외 정산율·민간 사용료·판관비
        항목/금액/비고는 직접 수정·자동 저장됩니다.
      </p>
    </div>
  );
}
