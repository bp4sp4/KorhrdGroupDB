"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Download, Save, Eraser } from "lucide-react";
import styles from "../write/page.module.css";
import { formatRRN, formatPhone, comma } from "./format";
import { buildContractPdf } from "./pdf";

// 근로계약서 4종 공용 — 폼 입력 + 실시간 미리보기 + 서명
// (서약서·동의서 4종은 별도 단계에서 추가)

export type WorkVariant = "regular" | "contract" | "civil" | "sales";

const COMPANY = {
  name: "㈜한평생그룹",
  addr: "서울시 도봉구 마들로13길 61, B동 905,906호(창동)",
  phone: "02-2135-6514",
  ceo: "양 병 웅",
};
// 회사 직인 (대표이사 인) — 갑 대표자 (인) 옆에 표시
const STAMP_URL =
  "https://mipzevxfqacbheqojrwa.supabase.co/storage/v1/object/public/contract-stamps/korhrd-group.png";

export interface ContractForm {
  employeeName: string;
  employeeAddr: string;
  employeeRRN: string;
  employeePhone: string;
  jobDesc: string;
  startDate: string;
  endDate: string; // 계약직만
  contractDate: string;
  baseMonthly: string; // 연봉제: 기본급(월)
  mealMonthly: string; // 식대(월)
  allowanceMonthly: string; // 직책수당/민간수당/인센티브(월)
  hourlyWage: string; // 계약직: 시급
  // 관리자가 지정하는 근로조건 (비어있으면 기본 문구 유지)
  workTime?: string; // 제4조 근무시간
  breakTime?: string; // 제4조 휴게시간
  workDays?: string; // 제4조 근무일
  weeklyHoliday?: string; // 제4조 주휴일
  workLocation?: string; // 제3조 업무 장소(소재지)
  probationMonths?: string; // 제2조 수습기간(개월)
  position?: string; // 직책/직위
  department?: string; // 부서
  specialTerms?: string; // 특약사항
}

export const DEFAULT_FORM: ContractForm = {
  employeeName: "",
  employeeAddr: "",
  employeeRRN: "",
  employeePhone: "",
  jobDesc: "",
  startDate: "",
  endDate: "",
  contractDate: "",
  baseMonthly: "",
  mealMonthly: "200000",
  allowanceMonthly: "0",
  hourlyWage: "10320",
};

// 변형별 설정
const VARIANT: Record<
  WorkVariant,
  {
    allowanceLabel: string;
    allowanceDesc: string;
    workTimeText: string;
  }
> = {
  regular: {
    allowanceLabel: "직책수당",
    allowanceDesc: "직책(실장, 팀장 등)을 맡게 된 직원에게 지급되는 수당",
    workTimeText: "1일 8시간 근무로 하며, 오전 10시부터 오후 7시까지로 한다.",
  },
  civil: {
    allowanceLabel: "민간수당",
    allowanceDesc: "민간자격증 1개 발급 시 인센티브 5,000원 지급",
    workTimeText: "1일 8시간 근무로 하며, 오전 10시부터 오후 7시까지로 한다.",
  },
  sales: {
    allowanceLabel: "인센티브",
    allowanceDesc: "매출의 인센티브 수당 (1,000만원 이상 10% / 1,000만원 미만 5%)",
    workTimeText:
      "1일 8시간 근무로 하며, 오전 10시부터 오후 7시, 또는 오전 9시부터 오후 6시까지로 한다.",
  },
  contract: {
    allowanceLabel: "수당",
    allowanceDesc: "",
    workTimeText: "1일 8시간 근무로 하며, 오전 10시부터 오후 7시까지로 한다.",
  },
};

// 제4조 근로시간 기본 문구 (관리자가 값을 지정하지 않으면 사용)
const DEFAULT_BREAK_TIME = "휴게시간은 13시부터 14시로 하며, 근무시간에는 제외한다.";
const DEFAULT_WORK_DAYS =
  "주 5일 근무로 하며 주 40시간을 원칙으로 한다. 단, “갑”은 “을”에게 업무상 필요시 주 52시간 내에서 근무를 요할 수 있다.";
const DEFAULT_WEEKLY_HOLIDAY =
  "주휴일은 일요일로 하되, 업무상 부득이한 경우 미리 협의하여 주휴일을 변경할 수 있다. 단, 주휴일은 1주 소정근로일을 만근한 경우에 한해 부여한다.";

const num = (v: string) => Number(String(v).replace(/[^0-9]/g, "")) || 0;
const won = (n: number) => (n > 0 ? n.toLocaleString() : "0");
function ymdParts(iso: string) {
  if (!iso) return { y: "20", m: "", d: "" };
  const [y, m, d] = iso.split("-");
  return { y, m: String(Number(m)), d: String(Number(d)) };
}

// ── 서명 패드 ──────────────────────────────────────────────
function SignaturePad({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const loadedInitial = useRef(false);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0a0d12";
  }, []);
  // 기존(저장된) 서명을 패드에 한 번 그려준다 — "보기·수정" 시 서명이 보이도록
  useEffect(() => {
    if (loadedInitial.current || !value) return;
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    loadedInitial.current = true;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
    img.src = value;
  }, [value]);
  const pos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (c.width / r.width),
      y: (e.clientY - r.top) * (c.height / r.height),
    };
  };
  const start = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  };
  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const c = canvasRef.current;
    if (c) onChange(c.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    onChange(null);
  };
  return (
    <div className={styles.signWrap}>
      <canvas
        ref={canvasRef}
        width={320}
        height={130}
        className={styles.signCanvas}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      {!value && <span className={styles.signHint}>여기에 서명해 주세요</span>}
      <button type="button" className={styles.signClearBtn} onClick={clear}>
        <Eraser size={13} /> 다시 서명
      </button>
    </div>
  );
}

function Sign({ src, name }: { src: string | null; name?: string }) {
  return (
    <>
      {name ? <span className={styles.signName}>{name}</span> : null}
      <span className={styles.signSlot}>
        (서명)
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="서명" className={styles.signInline} />
        )}
      </span>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}
function Article({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.article} data-article={n}>
      <div className={styles.articleHead}>
        제{n}조 ({title})
      </div>
      <div className={styles.articleBody}>{children}</div>
    </div>
  );
}

interface Props {
  variant: WorkVariant;
  mode: "self" | "assigned";
  contractId?: string;
  initialForm?: Partial<ContractForm>;
  initialSignature?: string | null;
  readOnly?: boolean;
  /** 미리보기 전용 — 폼 패널·서명·제출을 숨기고 문서만, initialForm 변경을 실시간 반영 */
  preview?: boolean;
  /** 미리보기에서 강조할 조항 번호 (관리자가 편집 중인 필드에 해당하는 조를 하이라이트·스크롤) */
  highlightArticleN?: number | null;
  /** true면 처음엔 문서만 보기(사이드바 숨김), 헤더의 '수정' 버튼으로 편집 시작 */
  viewFirst?: boolean;
  headerTitle?: string;
  headerBadge?: string;
  onBack?: () => void;
}

export default function ContractEditor({
  variant,
  mode,
  contractId,
  initialForm,
  initialSignature = null,
  readOnly = false,
  preview = false,
  highlightArticleN = null,
  viewFirst = false,
  headerTitle,
  headerBadge,
  onBack,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<ContractForm>({
    ...DEFAULT_FORM,
    ...initialForm,
  });

  // 미리보기 모드에서는 부모(관리자 폼)의 입력값 변경을 실시간으로 반영
  const initialFormKey = JSON.stringify(initialForm ?? {});
  useEffect(() => {
    if (!preview) return;
    setForm({ ...DEFAULT_FORM, ...initialForm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, initialFormKey]);
  const [signature, setSignature] = useState<string | null>(initialSignature);
  const [saving, setSaving] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);
  const cfg = VARIANT[variant];
  const isHourly = variant === "contract";
  // 관리자가 지정한 계약(assigned)에서는 임금을 관리자가 설정 → 직원은 보기만
  const lockWage = mode === "assigned";

  // 편집 모드 — viewFirst면 처음엔 문서만 보기, '수정' 버튼으로 사이드바 노출
  const [editing, setEditing] = useState(!viewFirst);

  // 미리보기 — 편집 중인 조항을 하이라이트하고 화면에 보이도록 스크롤
  useEffect(() => {
    if (!preview) return;
    const root = docRef.current;
    if (!root) return;
    root
      .querySelectorAll(`.${styles.articleActive}`)
      .forEach((el) => el.classList.remove(styles.articleActive));
    if (highlightArticleN == null) return;
    const el = root.querySelector(
      `[data-article="${highlightArticleN}"]`,
    ) as HTMLElement | null;
    if (el) {
      el.classList.add(styles.articleActive);
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [preview, highlightArticleN]);

  useEffect(() => {
    if (initialForm?.employeeName) return;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.displayName)
          setForm((p) =>
            p.employeeName ? p : { ...p, employeeName: d.displayName },
          );
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const up = useCallback(
    <K extends keyof ContractForm>(k: K, v: ContractForm[K]) =>
      setForm((p) => ({ ...p, [k]: v })),
    [],
  );

  const base = num(form.baseMonthly);
  const meal = num(form.mealMonthly);
  const allowance = num(form.allowanceMonthly);
  const totalMonthly = base + meal + allowance;
  const annual = totalMonthly * 12;
  const hourly = num(form.hourlyWage);

  const [focusedField, setFocusedField] = useState<string | null>(null);
  useEffect(() => {
    if (!focusedField) return;
    docRef.current
      ?.querySelector(`[data-field="${focusedField}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedField]);
  const focusProps = (name: string) => ({
    onFocus: () => setFocusedField(name),
    onBlur: () => setFocusedField(null),
  });
  const spot = (name: string, node: React.ReactNode) => (
    <span
      data-field={name}
      className={focusedField === name ? styles.fieldHl : styles.fieldSpot}
    >
      {node}
    </span>
  );

  // 화면(미리보기)을 A4 여러 장 PDF 로
  const buildPdf = useCallback(async () => {
    const el = docRef.current;
    if (!el) return null;
    return buildContractPdf(el, styles.pdfClean);
  }, []);

  const renderPdfDataUrl = useCallback(async (): Promise<string | null> => {
    const pdf = await buildPdf();
    return pdf ? pdf.output("datauristring") : null;
  }, [buildPdf]);

  const handleSave = async (signed: boolean) => {
    if (!form.employeeName.trim()) return alert("근로자 성명을 입력해 주세요.");
    if (signed && !signature) return alert("서명을 먼저 작성해 주세요.");
    setSaving(true);
    try {
      if (mode === "assigned" && contractId) {
        const pdfDataUrl = signed ? await renderPdfDataUrl() : null;
        const res = await fetch(
          `/api/me/contracts/${contractId}/submit-form`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ form_data: form, signature, signed, pdfDataUrl }),
          },
        );
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? "저장 실패");
        }
      } else {
        const res = await fetch("/api/me/contracts/write", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            form_data: form,
            signature,
            signed,
            contract_type: variant,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? "저장 실패");
        }
      }
      alert(signed ? "서명 완료 후 저장되었습니다." : "임시 저장되었습니다.");
      router.push("/me/contracts");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const c = ymdParts(form.contractDate);
  const s = ymdParts(form.startDate);
  const e = ymdParts(form.endDate);

  return (
    <div className={`${styles.editorRoot} ${preview ? styles.editorRootPreview : ""}`}>
      {(headerTitle || onBack) && (
        <div className={styles.editorBar}>
          {onBack && (
            <button type="button" className={styles.editorBack} onClick={onBack}>
              ← 목록
            </button>
          )}
          {headerBadge && (
            <span className={styles.editorBadge}>{headerBadge}</span>
          )}
          {headerTitle && (
            <span className={styles.editorTitle}>{headerTitle}</span>
          )}
          {readOnly && (
            <span className={styles.editorSignedBadge}>✅ 서명 완료</span>
          )}
          {!preview && (
            <div className={styles.editorBarActions}>
              {!readOnly && (
                <button
                  type="button"
                  className={`${styles.barBtn} ${editing ? styles.barBtnGhost : styles.barBtnPrimary}`}
                  onClick={() => setEditing((v) => !v)}
                >
                  {editing ? "보기" : "수정"}
                </button>
              )}
              <button
                type="button"
                className={`${styles.barBtn} ${styles.barBtnGhost}`}
                onClick={() => window.print()}
              >
                <Download size={15} /> PDF 다운로드
              </button>
            </div>
          )}
        </div>
      )}
      <div className={styles.editorBody}>
        {/* 좌측 입력 */}
        {!readOnly && !preview && editing && (
        <aside className={styles.formPane}>
          <div className={styles.formScroll}>
            {/* 계약서 문서 순서대로: 성명 → 계약 → 임금 → 체결·근로자정보 → 서명 */}
            <Section title="① 계약 / 업무">
              <Field label="성명">
                <input className={styles.input} value={form.employeeName} onChange={(ev) => up("employeeName", ev.target.value)} {...focusProps("employeeName")} />
              </Field>
              <Field label="계약 시작일">
                <input type="date" className={styles.input} value={form.startDate} onChange={(ev) => up("startDate", ev.target.value)} {...focusProps("startDate")} />
              </Field>
              {isHourly && (
                <Field label="계약 종료일">
                  <input type="date" className={styles.input} value={form.endDate} onChange={(ev) => up("endDate", ev.target.value)} {...focusProps("endDate")} />
                </Field>
              )}
              <Field label="담당업무">
                <input className={styles.input} value={form.jobDesc} onChange={(ev) => up("jobDesc", ev.target.value)} {...focusProps("jobDesc")} placeholder="예) 상담 및 영업" />
              </Field>
            </Section>

            <Section title={isHourly ? "② 임금 (시급)" : "② 임금 (월 기준)"}>
              {lockWage && (
                <p className={styles.lockHint}>
                  임금은 관리자가 지정한 금액으로, 수정할 수 없습니다.
                </p>
              )}
              {isHourly ? (
                <Field label="시급">
                  <input className={styles.input} inputMode="numeric" value={comma(form.hourlyWage)} onChange={(ev) => up("hourlyWage", ev.target.value.replace(/[^0-9]/g, ""))} {...focusProps("hourlyWage")} placeholder="예) 10,320" disabled={lockWage} />
                </Field>
              ) : (
                <>
                  <Field label="기본급">
                    <input className={styles.input} inputMode="numeric" value={comma(form.baseMonthly)} onChange={(ev) => up("baseMonthly", ev.target.value.replace(/[^0-9]/g, ""))} {...focusProps("baseMonthly")} placeholder="예) 3,960,000" disabled={lockWage} />
                  </Field>
                  <Field label="식대">
                    <input className={styles.input} inputMode="numeric" value={comma(form.mealMonthly)} onChange={(ev) => up("mealMonthly", ev.target.value.replace(/[^0-9]/g, ""))} {...focusProps("mealMonthly")} disabled={lockWage} />
                  </Field>
                  <Field label={cfg.allowanceLabel}>
                    <input className={styles.input} inputMode="numeric" value={comma(form.allowanceMonthly)} onChange={(ev) => up("allowanceMonthly", ev.target.value.replace(/[^0-9]/g, ""))} {...focusProps("allowanceMonthly")} disabled={lockWage} />
                  </Field>
                  <div className={styles.calcRow}>
                    <span>월 합계 <b>{won(totalMonthly)}원</b></span>
                    <span>연봉 <b>{won(annual)}원</b></span>
                  </div>
                </>
              )}
            </Section>

            <Section title="③ 계약 체결 · 근로자(을) 정보">
              <Field label="계약 체결일">
                <input type="date" className={styles.input} value={form.contractDate} onChange={(ev) => up("contractDate", ev.target.value)} {...focusProps("contractDate")} />
              </Field>
              <Field label="주소">
                <input className={styles.input} value={form.employeeAddr} onChange={(ev) => up("employeeAddr", ev.target.value)} {...focusProps("employeeAddr")} placeholder="근로자 주소" />
              </Field>
              <Field label="주민번호">
                <input className={styles.input} value={form.employeeRRN} onChange={(ev) => up("employeeRRN", formatRRN(ev.target.value))} {...focusProps("employeeRRN")} inputMode="numeric" placeholder="901027-1234567" />
              </Field>
              <Field label="연락처">
                <input className={styles.input} value={form.employeePhone} onChange={(ev) => up("employeePhone", formatPhone(ev.target.value))} {...focusProps("employeePhone")} inputMode="numeric" placeholder="010-1234-5678" />
              </Field>
            </Section>

            <Section title="④ 서명 (을)">
              <SignaturePad value={signature} onChange={setSignature} />
            </Section>
          </div>

          <div className={styles.toolbar}>
            <button type="button" className={styles.btnGhost} onClick={() => window.print()}>
              <Download size={15} /> PDF 저장
            </button>
            <button type="button" className={styles.btnSecondary} onClick={() => handleSave(false)} disabled={saving}>
              <Save size={15} /> 임시저장
            </button>
            <button type="button" className={styles.btnPrimary} onClick={() => handleSave(true)} disabled={saving}>
              {saving ? "저장 중…" : "서명 후 저장"}
            </button>
          </div>
        </aside>
      )}

      {/* 우측 미리보기 */}
      <main className={`${styles.previewPane} ${preview ? styles.previewPanePreview : ""}`}>
        <div className={styles.doc} id="contract-doc" ref={docRef}>
          <h1 className={styles.docTitle}>근 로 계 약 서</h1>
          <p className={styles.intro}>
            사용자인 {COMPANY.name} (이하 “갑”이라 함)와 근로자{" "}
            {spot("employeeName", <u className={styles.fill}>{form.employeeName || " ".repeat(8)}</u>)}{" "}
            (이하 “을”이라 함)는 아래 근로 조건을 성실히 이행할 것을 약정하고 근로 계약을 체결한다.
          </p>

          <Article n={1} title="계약기간">
            {isHourly ? (
              <p>
                계약 시작일은 {spot("startDate", <><u className={styles.fill}>{s.y}</u>년 <u className={styles.fill}>{s.m || "  "}</u>월 <u className={styles.fill}>{s.d || "  "}</u>일</>)}이며,
                계약 종료일은 {spot("endDate", <><u className={styles.fill}>{e.y}</u>년 <u className={styles.fill}>{e.m || "  "}</u>월 <u className={styles.fill}>{e.d || "  "}</u>일</>)}로 한다.
                본 계약은 기간의 정함이 있는 근로계약이며, 계약기간 만료 시 별도 합의가 없는 한 자동 종료된다.
              </p>
            ) : (
              <p>
                계약 시작일은 {spot("startDate", <><u className={styles.fill}>{s.y}</u>년 <u className={styles.fill}>{s.m || "  "}</u>월 <u className={styles.fill}>{s.d || "  "}</u>일</>)}이며, 근로계약 기간의 정함이 없는 것으로 한다.
              </p>
            )}
          </Article>

          <Article n={2} title="수습기간">
            <p>1) 근로 계약 체결 후 {form.probationMonths?.trim() || "3"}개월이 도래하기 전일까지를 수습기간으로 한다. (단 당사 근로 유 경력자 및 동종 업체 및 관련 업무 유 경력자는 제외)</p>
            <p>2) 수습기간 또는 수습기간 만료 시에도 직무를 수행함에 있어 자질이 부적합 또는 부적당하다고 인정되는 경우 및 조직융화, 업무지식, 건강상태 등이 부적격하다고 인정되는 경우에 당사는 본 채용을 거부하거나 수습기간을 연장 할 수 있다.</p>
            <p>3) 수습기간동안의 급여는 정규직원과 동일한 조건으로 지급한다.</p>
          </Article>

          <Article n={3} title="담당업무 및 업무 장소">
            <p>1) 직원의 담당업무는 {spot("jobDesc", <u className={styles.fill}>{form.jobDesc || " ".repeat(12)}</u>)}
              {(() => {
                const parts = [
                  form.position?.trim() && `직책: ${form.position.trim()}`,
                  form.department?.trim() && `부서: ${form.department.trim()}`,
                ].filter(Boolean);
                return parts.length ? ` (${parts.join(", ")})` : "";
              })()} 이며, 업무장소는 “갑”의 소재지 근무를 원칙으로 한다.</p>
            <p className={styles.indent}>소재지 : {form.workLocation?.trim() || COMPANY.addr}</p>
            <p>2) 전항은 회사의 업무상 필요에 의해 직종, 보직, 근무지를 변경할 수 있다. 동의 <Sign src={signature} name={form.employeeName} /></p>
          </Article>

          <Article n={4} title="근로시간">
            <p>1) “을”의 근로시간은 {form.workTime?.trim() || cfg.workTimeText}</p>
            <p>2) {form.breakTime?.trim() || DEFAULT_BREAK_TIME}</p>
            <p>3) {form.workDays?.trim() || DEFAULT_WORK_DAYS}</p>
            <p>4) {form.weeklyHoliday?.trim() || DEFAULT_WEEKLY_HOLIDAY}</p>
            <p>5) 기타 회사 상황 또는 업무의 특성으로 인하여 연장, 야간, 휴일 근로가 요구되는 경우, 관련법령의 허용 범위 내에서 이를 수행함에 동의한다. <Sign src={signature} name={form.employeeName} /></p>
          </Article>

          <Article n={5} title="임금">
            {isHourly ? (
              <>
                <p>1) 임금(시급) : {spot("hourlyWage", <u className={styles.fill}>{won(hourly)}</u>)} 원/시간</p>
                <p>2) 지급방법 : 원천징수 후 본인이 지정한 본인 명의 통장으로 지급한다.</p>
                <p className={styles.indent}>계산방법 : 매월 1일부터 말일까지 산정하여 익월 10일 지급하되, 해당 지급일이 휴일인 경우 직전 영업일에 지급한다.</p>
                <p className={styles.indent}>- 월중 입/퇴사자나 무단 결근 시에는 실제 근로시간 기준으로 산정하여 지급한다.</p>
                <p className={styles.indent}>- 지각, 조퇴, 개인적 외출 등의 사유로 근무하지 않은 경우 해당 시간만큼 공제한다.</p>
                <p>3) “을”은 급여에 대하여 고용보험, 의료보험, 국민연금 부담분 등 법률이 정하는 바에 따른 모든 제세공과금을 부담하고, “갑”은 이를 공제한 후 지급한다.</p>
                <p>4) 퇴직금은 관련 법령 및 회사 규정에 따른다.</p>
              </>
            ) : (
              <>
                <p>1) 연봉 금액 : <u className={styles.fill}>{won(annual)}</u>원/년 <span className={styles.unit}>(단위 : 원)</span></p>
                <table className={styles.salaryTable}>
                  <thead>
                    <tr>
                      <th>구분</th><th>기본급</th><th>식대</th><th>{cfg.allowanceLabel}</th><th>합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>월</td>
                      <td>{spot("baseMonthly", won(base))}</td>
                      <td>{spot("mealMonthly", won(meal))}</td>
                      <td>{spot("allowanceMonthly", won(allowance))}</td>
                      <td>{won(totalMonthly)}</td>
                    </tr>
                  </tbody>
                </table>
                <p>2) 임금 구성항목</p>
                <p className={styles.indent}>- 식대 : 근무일수에 적합하게 일할 계산되어 지급되는 점심 식대, 1개월 만근시 20만원 지급</p>
                <p className={styles.indent}>- {cfg.allowanceLabel} : {cfg.allowanceDesc}</p>
                <p>3) 지급방법 : 원천징수 후 본인이 지정한 본인 명의 통장으로 지급한다. 계산방법 : 1일부터 말일까지 산정하여 익월 10일 지급하되, 휴일인 경우 직전 영업일에 지급한다. 월중 입/퇴사자나 무단 결근시에는 일할 계산하여 지급한다.</p>
                <p>4) “을”은 급여에 대하여 고용보험, 의료보험, 국민연금 부담분 등 법률이 정하는 바에 따른 모든 제세공과금을 부담하고, “갑”은 이를 공제한 후 지급한다.</p>
                <p>5) 퇴직금은 별도 규정에 준하며, 퇴직금을 지급하는 것에 갈음하여 퇴직연금에 가입할 수 있다.</p>
                <p>6) 새로운 근로 또는 연봉계약 체결시 임금은 갱신된다.</p>
                <p>7) 인사평가 결과에 따라 연봉은 삭감/동결/인상 될 수 있다.</p>
              </>
            )}
          </Article>

          <Article n={6} title="임금정보 누설 금지">
            <p>1) 직원은 임금 관련 정보를 타인(회사 임직원 포함)에게 누설하지 않아야 하며, 타인의 임금 관련 정보에 대해서도 알려고 하지 아니한다.</p>
            <p>2) 직원이 전항을 위반한 경우 회사는 내부 제규정에 의하여 직원을 징계할 수 있다.</p>
          </Article>

          <Article n={7} title="휴일 및 휴가">
            <p>1) 근로자의 날, 주휴일, 대통령령인 관공서의 공휴일 및 대체공휴일 등은 관계 법령 및 회사 규정에 따른다.</p>
            <p>2) “갑”과 “을”은 근로관계법에서 정한 바에 따라 유급의 연차 휴가를 부여한다.</p>
          </Article>

          <Article n={8} title="연차 휴가">
            <p>1) 연차휴가 사용은 관련 법령 및 회사에서 별도로 정한 제규정에 따른다.</p>
            <p>2) 1주 15시간 미만 근무자인 경우 연차휴가를 지급하지 아니한다.</p>
          </Article>

          <Article n={9} title="근태">
            <p>1) “을”은 부득이한 사유로 결근하고자 할 경우 소속부서의 장에게 사전통보한다.</p>
            <p>2) 지각 시 출근과 동시에 소속부서장에게 그 이유를 신고한다.</p>
            <p>3) 조퇴 또는 외출은 소속부서장의 사전 승인을 받아야 한다.</p>
          </Article>

          <Article n={10} title="복무">
            <p>1) “을”은 근무 중 “갑”이 정한 제규정에 따라 성실히 근무하여야 한다.</p>
            <p>2) “을”은 “갑”의 승인을 얻지 아니하고는 재직 중 타인에게 고용되거나 동종 업종 및 타 직업에 종사하여서는 아니된다.</p>
          </Article>

          <Article n={11} title="비밀 유지">
            <p>“을”은 근로계약기간 및 퇴직 후 2년간 “갑”의 영업비밀, 고객정보 등 비밀 정보를 “갑”의 사전 서면 동의 없이 누설하거나 사용하여서는 아니 된다.</p>
          </Article>

          <Article n={12} title="사직 및 근무 변동 시 인수인계">
            <p>1) “을”이 퇴직하고자 할 경우 1개월 전에 “갑”에게 사직서를 제출한다.</p>
            <p>2) 사직서 수리 전 출근하지 아니한 기간은 무단결근으로 본다.</p>
            <p>3) 전보, 퇴직, 휴직 등 변동 시 업무인계서를 작성하여 인계한다.</p>
          </Article>

          <Article n={13} title="계약해지">
            <p>다음 사유에 해당하는 경우 “갑”은 계약을 해지할 수 있다. — 본 계약의 중대한 위반·불이행, 무단결근·상습 지각·조퇴, 정당한 이유 없는 업무명령 거부, 회사의 명예·신용 훼손, 기타 고용관계를 유지할 수 없는 중대한 사유. 해고 등 근로관계 종료는 관계 법령에 따라 처리한다.</p>
          </Article>

          <Article n={14} title="기타">
            <p>기타 근로조건은 근로기준법에 위배되지 않는 한 “갑”의 제규정에 따르며, 본 계약에 정함이 없는 사항은 근로기준법 및 기타 노동관계법에 따른다.</p>
          </Article>

          <Article n={15} title="준거법 및 관할 법원">
            <p>본 계약은 대한민국 법률에 따라 규율되며, 분쟁 발생 시 사용자의 본사 소재지를 관할하는 법원을 제1심 관할 법원으로 한다.</p>
          </Article>

          {form.specialTerms?.trim() && (
            <Article n={16} title="특약사항">
              {form.specialTerms
                .trim()
                .split("\n")
                .map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
            </Article>
          )}

          <p className={styles.closing}>
            위와 같이 계약을 체결하고 계약서 2통을 작성, 서명 날인 후 “갑”과 “을”이 각각 1통씩 보관한다.
          </p>
          <p>근로자 교부 확인 : <Sign src={signature} name={form.employeeName} /></p>

          <p className={styles.docDate}>
            {spot("contractDate", <>{c.y}년 {c.m || "  "}월 {c.d || "  "}일</>)}
          </p>

          <div className={styles.signGrid}>
            <div className={styles.party}>
              <div className={styles.partyTag}>(갑)</div>
              <div className={styles.partyRows}>
                <div>주소 : {COMPANY.addr}</div>
                <div>회사명 : {COMPANY.name}</div>
                <div>연락처 : {COMPANY.phone}</div>
                <div className={styles.partySign}>
                  대표자 : {COMPANY.ceo} (인)
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={STAMP_URL}
                    alt="직인"
                    className={styles.stampImg}
                    crossOrigin="anonymous"
                  />
                </div>
              </div>
            </div>
            <div className={styles.party}>
              <div className={styles.partyTag}>(을)</div>
              <div className={styles.partyRows}>
                <div>주소 : {spot("employeeAddr", form.employeeAddr)}</div>
                <div>주민번호 : {spot("employeeRRN", form.employeeRRN)}</div>
                <div>연락처 : {spot("employeePhone", form.employeePhone)}</div>
                <div className={styles.partySign}>
                  성명 : <Sign src={signature} name={form.employeeName} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
