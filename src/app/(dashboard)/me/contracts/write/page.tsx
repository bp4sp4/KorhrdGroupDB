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
import styles from "./page.module.css";

// ─────────────────────────────────────────────────────────────
// 고정 회사(갑) 정보
// ─────────────────────────────────────────────────────────────
const COMPANY = {
  name: "㈜한평생그룹",
  addr: "서울시 도봉구 마들로13길 61, B동 905,906호(창동)",
  phone: "02-2135-6514",
  ceo: "양 병 웅",
};

// ─────────────────────────────────────────────────────────────
// 폼 타입 / 기본값
// ─────────────────────────────────────────────────────────────
interface ContractForm {
  employeeName: string;
  startDate: string; // 계약 시작일
  jobDesc: string;
  baseMonthly: string; // 기본급(월)
  mealMonthly: string; // 식대(월)
  positionMonthly: string; // 직책수당(월)
  employeeAddr: string;
  employeeRRN: string; // 주민번호
  employeePhone: string;
  contractDate: string; // 계약 체결일
}

const DEFAULT_FORM: ContractForm = {
  employeeName: "",
  startDate: "",
  jobDesc: "",
  baseMonthly: "",
  mealMonthly: "200000",
  positionMonthly: "0",
  employeeAddr: "",
  employeeRRN: "",
  employeePhone: "",
  contractDate: "",
};

const num = (v: string) => Number(String(v).replace(/[^0-9]/g, "")) || 0;
const won = (n: number) => (n > 0 ? n.toLocaleString() : "0");

function ymdParts(iso: string) {
  if (!iso) return { y: "20", m: "", d: "" };
  const [y, m, d] = iso.split("-");
  return { y, m: String(Number(m)), d: String(Number(d)) };
}

// ─────────────────────────────────────────────────────────────
// 서명 패드
// ─────────────────────────────────────────────────────────────
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

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#191f28";
  }, []);

  const pos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
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

// 서명 표시 (값 있으면 이미지, 없으면 (서명))
function Sign({ src }: { src: string | null }) {
  if (!src) return <span className={styles.signPlaceholder}>(서명)</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="서명" className={styles.signInline} />;
}

// ─────────────────────────────────────────────────────────────
// 페이지
// ─────────────────────────────────────────────────────────────
export default function WriteContractPage() {
  const router = useRouter();
  const [form, setForm] = useState<ContractForm>(DEFAULT_FORM);
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.displayName)
          setForm((p) =>
            p.employeeName ? p : { ...p, employeeName: d.displayName },
          );
      })
      .catch(() => {});
  }, []);

  const up = useCallback(
    <K extends keyof ContractForm>(k: K, v: ContractForm[K]) =>
      setForm((p) => ({ ...p, [k]: v })),
    [],
  );

  const base = num(form.baseMonthly);
  const meal = num(form.mealMonthly);
  const position = num(form.positionMonthly);
  const totalMonthly = base + meal + position;
  const annual = totalMonthly * 12;

  const handleSave = async (signed: boolean) => {
    if (!form.employeeName.trim()) return alert("근로자 성명을 입력해 주세요.");
    if (signed && !signature) return alert("서명을 먼저 작성해 주세요.");
    setSaving(true);
    try {
      const res = await fetch("/api/me/contracts/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_data: form, signature, signed }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "저장 실패");
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

  return (
    <div className={styles.page}>
      {/* 좌측 입력 */}
      <aside className={styles.formPane}>
        <div className={styles.formScroll}>
          <Section title="근로자 정보">
            <Field label="성명">
              <input className={styles.input} value={form.employeeName} onChange={(e) => up("employeeName", e.target.value)} />
            </Field>
            <Field label="주소">
              <input className={styles.input} value={form.employeeAddr} onChange={(e) => up("employeeAddr", e.target.value)} placeholder="근로자 주소" />
            </Field>
            <Field label="주민번호">
              <input className={styles.input} value={form.employeeRRN} onChange={(e) => up("employeeRRN", e.target.value)} placeholder="예) 900101-1******" />
            </Field>
            <Field label="연락처">
              <input className={styles.input} value={form.employeePhone} onChange={(e) => up("employeePhone", e.target.value)} placeholder="휴대폰 번호" />
            </Field>
          </Section>

          <Section title="계약 / 업무">
            <Field label="계약 시작일">
              <input type="date" className={styles.input} value={form.startDate} onChange={(e) => up("startDate", e.target.value)} />
            </Field>
            <Field label="담당업무">
              <input className={styles.input} value={form.jobDesc} onChange={(e) => up("jobDesc", e.target.value)} placeholder="예) 상담 및 영업" />
            </Field>
            <Field label="계약 체결일">
              <input type="date" className={styles.input} value={form.contractDate} onChange={(e) => up("contractDate", e.target.value)} />
            </Field>
          </Section>

          <Section title="임금 (월 기준)">
            <Field label="기본급">
              <input className={styles.input} inputMode="numeric" value={form.baseMonthly} onChange={(e) => up("baseMonthly", e.target.value.replace(/[^0-9]/g, ""))} placeholder="예) 3960000" />
            </Field>
            <Field label="식대">
              <input className={styles.input} inputMode="numeric" value={form.mealMonthly} onChange={(e) => up("mealMonthly", e.target.value.replace(/[^0-9]/g, ""))} />
            </Field>
            <Field label="직책수당">
              <input className={styles.input} inputMode="numeric" value={form.positionMonthly} onChange={(e) => up("positionMonthly", e.target.value.replace(/[^0-9]/g, ""))} />
            </Field>
            <div className={styles.calcRow}>
              <span>월 합계 <b>{won(totalMonthly)}원</b></span>
              <span>연봉 <b>{won(annual)}원</b></span>
            </div>
          </Section>

          <Section title="서명 (을)">
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
            서명 후 저장
          </button>
        </div>
      </aside>

      {/* 우측 미리보기 — 실제 양식 */}
      <main className={styles.previewPane}>
        <div className={styles.doc} id="contract-doc">
          <h1 className={styles.docTitle}>근 로 계 약 서</h1>
          <p className={styles.intro}>
            사용자인 {COMPANY.name} (이하 “갑”이라 함)와 근로자{" "}
            <u className={styles.fill}>{form.employeeName || " ".repeat(8)}</u>{" "}
            (이하 “을”이라 함)는 아래 근로 조건을 성실히 이행할 것을 약정하고 근로
            계약을 체결한다.
          </p>

          <Article n={1} title="계약기간">
            계약 시작일은 <u className={styles.fill}>{s.y}</u>년{" "}
            <u className={styles.fill}>{s.m || "  "}</u>월{" "}
            <u className={styles.fill}>{s.d || "  "}</u>일이며, 근로계약
            기간의 정함이 없는 것으로 한다.
          </Article>

          <Article n={2} title="수습기간">
            <p>1) 근로 계약 체결 후 3개월이 도래하기 전일까지를 수습기간으로 한다. (단 당사 근로 유 경력자 및 동종 업체 및 관련 업무 유 경력자는 제외)</p>
            <p>2) 수습기간 또는 수습기간 만료 시에도 직무를 수행함에 있어 자질이 부적합 또는 부적당하다고 인정되는 경우 및 조직융화, 업무지식, 건강상태 등이 부적격하다고 인정되는 경우에 당사는 본 채용을 거부하거나 수습기간을 연장 할 수 있다.</p>
            <p>3) 수습기간동안의 급여는 정규직원과 동일한 조건으로 지급한다.</p>
          </Article>

          <Article n={3} title="담당업무 및 업무 장소">
            <p>1) 직원의 담당업무는 <u className={styles.fill}>{form.jobDesc || " ".repeat(12)}</u> 이며, 업무장소는 “갑”의 소재지 근무를 원칙으로 한다.</p>
            <p className={styles.indent}>소재지 : {COMPANY.addr}</p>
            <p>2) 전항은 회사의 업무상 필요에 의해 직종, 보직, 근무지를 변경할 수 있다. 동의 <Sign src={signature} /></p>
          </Article>

          <Article n={4} title="근로시간">
            <p>1) “을”의 근로시간은 1일 8시간 근무로 하며, 오전 10시부터 오후 7시까지로 한다.</p>
            <p>2) 휴게시간은 13시부터 14시로 하며, 근무시간에는 제외한다.</p>
            <p>3) 주 5일 근무로 하며 주 40시간을 원칙으로 한다. 단, “갑”은 “을”에게 업무상 필요시 주 52시간 내에서 근무를 요할 수 있다.</p>
            <p>4) 주휴일은 일요일로 하되, 업무상 부득이한 경우 미리 협의하여 주휴일을 변경할 수 있다. 단, 주휴일은 1주 소정근로일을 만근한 경우에 한해 부여한다.</p>
            <p>5) 기타 회사 상황 또는 업무의 특성으로 인하여 연장, 야간, 휴일 근로가 요구되는 경우, 관련법령의 허용 범위 내에서 이를 수행함에 동의한다. <Sign src={signature} /></p>
          </Article>

          <Article n={5} title="임금">
            <p>1) 연봉 금액 : <u className={styles.fill}>{won(annual)}</u>원/년 <span className={styles.unit}>(단위 : 원)</span></p>
            <table className={styles.salaryTable}>
              <thead>
                <tr>
                  <th>구분</th><th>기본급</th><th>식대</th><th>직책수당</th><th>합계</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>월</td>
                  <td>{won(base)}</td>
                  <td>{won(meal)}</td>
                  <td>{won(position)}</td>
                  <td>{won(totalMonthly)}</td>
                </tr>
              </tbody>
            </table>
            <p>2) 임금 구성항목</p>
            <p className={styles.indent}>- 식대 : 근무일수에 적합하게 일할 계산되어 지급되는 점심 식대, 1개월 만근시 20만원 지급</p>
            <p className={styles.indent}>- 직책수당 : 직책(실장, 팀장 등)을 맡게 된 직원에게 지급되는 수당</p>
            <p>3) 임금의 지급방법 및 계산방법</p>
            <p className={styles.indent}>- 지급방법 : 원천징수 후 본인이 지정한 본인 명의 통장으로 지급한다. 계약 후 지급사유가 발생한 기타의 수당과 “갑”이 별도로 정한 수당 등은 추가 지급한다.</p>
            <p className={styles.indent}>- 계산방법 : 1일부터 말일까지 산정하여 익월 10일 지급하되, 해당 지급일이 휴일인 경우는 직전 영업일에 직원의 급여계좌로 지급한다.</p>
            <p className={styles.indent}>- 월중 입/퇴사자나 무단 결근시에는 일할 계산하여 지급한다.</p>
            <p className={styles.indent}>- 지각, 조퇴, 개인적 외출 등의 사유로 근무하지 않은 경우 급여에서 공제한다.</p>
            <p className={styles.indent}>- 결근을 할 경우 해당일과 그 주의 주휴 수당을 공제한다.</p>
            <p>4) “을”은 급여에 대하여 고용보험, 의료보험, 국민연금 부담분 등 법률이 정하는 바에 따른 모든 제세 공과금을 부담하고, “갑”은 “을”에 대하여 “을”이 부담하는 관련 제세공과금을 공제한 후 지급한다.</p>
            <p>5) 퇴직금은 별도 규정에 준하며, 퇴직금을 지급하는 것에 갈음하여 퇴직연금에 가입할 수 있다.</p>
            <p>6) 새로운 근로 또는 연봉계약 체결시 임금은 갱신된다.</p>
            <p>7) 인사평가 결과에 따라 연봉은 삭감/동결/인상 될 수 있다.</p>
          </Article>

          <Article n={6} title="임금정보 누설 금지">
            <p>1) 직원은 임금 관련 정보를 타인(회사 임직원 포함)에게 누설하지 않아야 하며, 타인의 임금 관련 정보에 대해서도 알려고 하지 아니한다.</p>
            <p>2) 직원이 전항을 위반한 경우 회사는 내부 제규정에 의하여 직원을 징계할 수 있다.</p>
          </Article>

          <Article n={7} title="휴일 및 휴가">
            <p>1) 근로자의 날, 주휴일, 명절 당일 및 전·후일, 대통령령인 관공서의 공휴일(신정, 삼일절, 석가탄신일, 어린이날, 현충일, 제헌절, 광복절, 개천절, 한글날, 성탄절) 기타 대체 공휴일 및 공직선거일</p>
            <p>2) “갑”과 “을”은 근로관계법에서 정한 바에 따라 유급의 연차 휴가를 부여한다.</p>
          </Article>

          <Article n={8} title="연차 휴가">
            <p>1) 연차휴가 등 직원의 휴가 사용에 대해서는 관련 법령 및 회사에서 별도로 정한 제규정에 따른다.</p>
            <p>2) 1주 15시간 미만 근무자인 경우 연차휴가를 지급하지 아니한다.</p>
          </Article>

          <Article n={9} title="근태">
            <p>1) “을”은 부득이한 사유로 결근하고자 할 경우에는 소속부서의 장에게 사전통보를 하여야 하고, 부득이한 사유로 인하여 사전 통보가 불가능한 경우에는 가능한 방법으로 지체없이 사후 통보하여야 한다.</p>
            <p>2) “을”은 지각하였을 때에는 출근과 동시에 소속부서장에게 그 이유를 신고하여야 한다.</p>
            <p>3) “을”은 조퇴 또는 외출을 하고자 할 경우에는 소속부서장의 사전 승인을 받아야 한다.</p>
            <p>4) “갑”은 “을”이 결근할 경우 결근 일수에 해당하는 연봉을 감액하고, 업무상 재해나 질병 이외의 사유로 휴직할 경우에는 휴직기간 동안 연차 또는 무급 처리한다.</p>
          </Article>

          <Article n={10} title="복무">
            <p>1) “을”은 근무 중 “갑”이 정한 제규정에 따라 성실히 근무하여야 한다.</p>
            <p>2) “을”은 “갑”의 승인을 얻지 아니하고는 재직하고 있는 상태에서 타인에게 고용되거나 동종 업종 및 타 직업에 종사하여서는 아니된다.</p>
          </Article>

          <Article n={11} title="비밀 유지">
            <p>본 계약 중에 “을”이 지득/취득한 정보를 근로계약기간 및 퇴직후 2년간 비밀로 유지한다. 하기 사항 외에 “갑”의 영업비밀에 속하는 정보, 고객에 관한 정보 및 기타 “갑”이 비밀로 취급하는 모든 정보를 “갑”의 사전 서면 동의 없이 누설하거나 “갑” 이외의 자를 위하여 사용하여서는 아니 된다.</p>
          </Article>

          <Article n={12} title="사직 및 근무 변동 시 인수 인계">
            <p>1) “을”은 근로계약 기간 종료 전에 회사를 퇴직하고자 할 경우에는 1개월 전에 “갑”에게 사직서를 제출하여야 하고, “갑”이 사직서를 수리하기 전까지는 업무를 정상적으로 수행함에 소홀해서는 아니된다. 퇴직절차를 지키지 아니하여 발생하는 “갑”의 손해에 대하여 “을”은 배상책임을 지도록 한다.</p>
            <p>2) 제1항의 사직서가 수리되기 전에 출근하지 아니한 기간은 무단결근으로 본다.</p>
            <p>3) “을”은 전보, 퇴직, 휴직 기타 근무 상의 변동이 있을 때에는 담당업무, 보관 문서, 비품, 업무의 접수·종결·미결 등의 진행 사항을 상세히 열거한 업무인계서를 작성하여 후임자 또는 소속부서장이 지정하는 자에게 인계하여야 한다.</p>
          </Article>

          <Article n={13} title="계약해지">
            <p>1) 제1조의 계약기간에도 불구하고 “갑”에게 정당한 사유가 발생하였을 시 “을”과 근로계약의 해지에 동의한다.</p>
            <p className={styles.indent}>- 본 계약의 중대한 위반이나 불이행이 있는 때</p>
            <p className={styles.indent}>- 직원이 무단결근을 하거나 상습적으로 지각 및 조퇴를 한 때</p>
            <p className={styles.indent}>- 직원이 구속, 질병 등의 사유로 장기간 근로의 제공이 불가능한 때 (업무상 부상·질병 요양 휴업기간 및 그 후 30일 제외)</p>
            <p className={styles.indent}>- 회사의 업무명령을 정당한 이유 없이 거부한 때</p>
            <p className={styles.indent}>- 직원에게 책임 있는 사유로 회사의 명예나 신용을 훼손한 때</p>
            <p className={styles.indent}>- 업무수행에 관련하여 중대한 위법행위를 하거나 회사의 규정을 중대하게 위반한 경우</p>
            <p className={styles.indent}>- 회사가 도산 등의 이유로 직원과 고용관계를 유지할 수 없을 때</p>
            <p className={styles.indent}>- 회사가 긴박한 경영상의 필요가 있는 때</p>
            <p className={styles.indent}>- 기타 회사가 직원과의 고용관계를 유지할 수 없다고 인정되는 중대한 사유가 있는 때</p>
            <p>2) 계약해지 사유가 발생하였을 경우 “갑”은 “을”에게 30일 전에 이를 알려야 한다. “갑”은 “을”을 해고하려면 해고 사유와 해고 시기를 서면으로 통지하여야 한다.</p>
          </Article>

          <Article n={14} title="기타">
            <p>1) 기타 근로조건은 근로기준법에 위배되지 않는 한 “갑”이 정한 제규정에 따르기로 한다. 이외에 정함이 없는 것은 현행 근로기준법 및 기타 노동관계법에 따르기로 한다.</p>
            <p>2) 직원의 고의 또는 과실로 회사에 손해를 끼치거나, 퇴직시 업무 인수인계의 해태로 회사에 손해가 발생한 경우 직원은 그 손해를 배상하여야 한다.</p>
            <p>3) 새로운 근로계약 체결시까지 본 근로계약은 유효하다.</p>
          </Article>

          <Article n={15} title="준거법 및 관할 법원">
            <p>1) 본 계약 및 이와 관련하여 발생하는 모든 분쟁은 대한민국 법률에 의하여 규율·해석 및 집행된다.</p>
            <p>2) 본 계약에 명시되지 않은 사항이나 해석에 이견이 있는 경우, 쌍방은 우선 협의하여 해결한다. 협의로 해결되지 않을 경우, 사용자의 본사 소재지를 관할하는 법원을 제1심 관할 법원으로 한다.</p>
          </Article>

          <p className={styles.closing}>
            위와 같이 계약을 체결하고 계약서 2통을 작성, 서명 날인 후 “갑”과
            “을”이 각각 1통씩 보관한다.
          </p>
          <p>근로자 교부 확인 : <Sign src={signature} /></p>

          <p className={styles.docDate}>
            {c.y}년 {c.m || "  "}월 {c.d || "  "}일
          </p>

          <div className={styles.signGrid}>
            <div className={styles.party}>
              <div className={styles.partyTag}>(갑)</div>
              <div className={styles.partyRows}>
                <div>주소 : {COMPANY.addr}</div>
                <div>회사명 : {COMPANY.name}</div>
                <div>연락처 : {COMPANY.phone}</div>
                <div>대표자 : {COMPANY.ceo} (인)</div>
              </div>
            </div>
            <div className={styles.party}>
              <div className={styles.partyTag}>(을)</div>
              <div className={styles.partyRows}>
                <div>주소 : {form.employeeAddr}</div>
                <div>주민번호 : {form.employeeRRN}</div>
                <div>연락처 : {form.employeePhone}</div>
                <div className={styles.partySign}>
                  성명 : {form.employeeName} <Sign src={signature} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
    <div className={styles.article}>
      <div className={styles.articleHead}>
        제{n}조 ({title})
      </div>
      <div className={styles.articleBody}>{children}</div>
    </div>
  );
}
