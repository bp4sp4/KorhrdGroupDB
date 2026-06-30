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
import { formatRRN } from "./format";
import { buildContractPdf } from "./pdf";

// 서약서·동의서 4종 공용 — 폼 입력 + 실시간 미리보기 + 서명
export type PledgeKind = "privacy" | "ethics" | "nda" | "pledge";

const COMPANY = "㈜한평생그룹";

export interface PledgeForm {
  employeeName: string;
  birthDate: string; // 생년월일
  employeeRRN: string; // 주민등록번호 (nda)
  signDate: string; // 작성일
}
const DEFAULT_FORM: PledgeForm = {
  employeeName: "",
  birthDate: "",
  employeeRRN: "",
  signDate: "",
};

const TITLE: Record<PledgeKind, string> = {
  privacy: "개인정보 수집·이용 및 제공 동의서",
  ethics: "보안 / 윤리 강령 서약서",
  nda: "비밀유지 서약서",
  pledge: "입사 서약서",
};
// nda 는 주민등록번호, 나머지는 생년월일
const USE_RRN: Record<PledgeKind, boolean> = {
  privacy: false,
  ethics: false,
  nda: true,
  pledge: false,
};

function ymdParts(iso: string) {
  if (!iso) return { y: "20", m: "", d: "" };
  const [y, m, d] = iso.split("-");
  return { y, m: String(Number(m)), d: String(Number(d)) };
}

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

function Sign({ src }: { src: string | null }) {
  return (
    <span className={styles.signSlot}>
      (서명)
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="서명" className={styles.signInline} />
      )}
    </span>
  );
}

// ── 본문(서약 항목) ──────────────────────────────────────────
function Body({ kind }: { kind: PledgeKind }) {
  if (kind === "privacy") {
    return (
      <>
        <p className={styles.intro}>
          {COMPANY} (이하 ‘회사’라 함)은 개인정보보호법 등 관련 법령에 따라 아래와
          같이 임직원의 개인정보를 처리하고 있습니다. 귀하께서는 개인정보의
          수집·이용 및 제3자 제공에 대하여 아래 사항을 모두 숙지하신 후 동의 여부를
          결정하여 회사에 제출하여 주시기 바랍니다.
        </p>
        <div className={styles.article}>
          <div className={styles.articleHead}>개인정보 수집·이용 동의</div>
          <div className={styles.articleBody}>
            <p>· 수집·이용 목적 : 근로계약 체결 및 유지 / 인사·노무 관리 및 급여 지급</p>
            <p>· 수집·이용 항목 : 이름, 사진, 연락처(이메일, 전화번호), 주소</p>
            <p>· 보유·이용 기간 : 동의일로부터 근로계약 종료일 이후 3년까지 위 목적 범위 내에서 보유·이용</p>
          </div>
        </div>
        <p>
          ※ 귀하는 개인정보 수집·이용에 동의하지 아니할 권리가 있으나, 위 정보는
          근로계약 체결 및 급여 지급 등을 위하여 필요한 정보이므로 동의가 없을 경우
          근로계약 체결 및 급여 지급이 제한될 수 있습니다.
        </p>
        <p className={styles.closing}>
          나는 위와 같은 개인정보 수집·이용 동의 내용을 모두 숙지하였으며, 회사가
          나의 개인정보를 수집·이용하는 것에 동의합니다.
        </p>
      </>
    );
  }
  if (kind === "ethics") {
    const items = [
      "회사의 전산시스템, 고객 정보 등 모든 기밀사항을 외부에 유출하거나 사적으로 사용하지 않겠습니다.",
      "업무상 알게 된 모든 정보(문서, 통계, 전략 등)는 회사의 자산으로 간주하며, 퇴사 후에도 제3자에게 공개하지 않겠습니다.",
      "업무 중 사적 용도로 회사 이메일·메신저·기기·자료 등을 사용하지 않으며, 불법 소프트웨어를 다운로드하지 않겠습니다.",
      "금품 수수, 부당한 외부 인맥 거래, 특정 이해관계에 따른 업무처리를 하지 않겠습니다.",
      "직장 내 상호 존중 문화를 바탕으로 성희롱·괴롭힘·위계적 언행 등 비윤리적 행위를 하지 않겠습니다.",
      "회사의 윤리강령·정보보안지침·개인정보보호지침을 숙지하고 실무에서 충실히 반영하겠습니다.",
      "위 서약을 위반하여 회사 또는 이해관계자에게 피해를 발생시킨 경우, 그에 따른 법적 책임을 감수하겠습니다.",
    ];
    return (
      <>
        <p className={styles.intro}>
          본인은 {COMPANY} (이하 ‘회사’라 함)의 직원으로서 다음의 보안 및 윤리규정을
          성실히 준수할 것을 서약합니다.
        </p>
        {items.map((t, i) => (
          <p key={i}>
            {i + 1}. {t}
          </p>
        ))}
      </>
    );
  }
  if (kind === "pledge") {
    const items = [
      "회사의 취업규칙·근태규정·지시사항 등을 성실히 준수하겠습니다.",
      "업무 수행 시 공정성과 책임감을 바탕으로 회사의 명예와 신뢰를 해치지 않겠습니다.",
      "허위보고·문서조작·고의적 지연 등 비윤리적 업무행위를 하지 않으며, 인지한 경우 즉시 보고하겠습니다.",
      "직무상 알게 된 회사 및 가맹점 관련 정보는 외부에 누설하지 않으며, 개인적인 용도로도 활용하지 않겠습니다.",
      "직장 내 괴롭힘·성희롱·차별·폭언 등 타인의 인격을 침해하는 행위를 하지 않겠습니다.",
      "회사 자산(비품·정보·시스템 등)은 정해진 목적에 따라 사용하며, 사적 유용 시 책임을 질 수 있음을 인지합니다.",
      "퇴사 시 모든 회사 자산 및 정보를 반납하며, 퇴사 이후에도 회사의 명예를 손상시키는 행동을 하지 않겠습니다.",
    ];
    return (
      <>
        <p className={styles.intro}>
          본인은 {COMPANY} (이하 ‘회사’라 함)에 입사함에 있어 회사의 발전과 업무의
          원활한 수행을 위해 다음의 사항을 성실히 이행할 것을 서약합니다.
        </p>
        {items.map((t, i) => (
          <p key={i}>
            {i + 1}. {t}
          </p>
        ))}
        <p className={styles.closing}>
          위 사항을 성실히 이행할 것을 서약하며, 위반 시 회사의 인사조치 및 민·형사상
          책임을 수용하겠습니다.
        </p>
      </>
    );
  }
  // nda
  const arts: [string, string][] = [
    ["영업비밀", "본 서약서상 영업비밀이란 본인이 회사의 업무 수행과 관련하여 알게 되거나 제공받는 영업활동에 유용한 기술상·경영상의 제반 정보(지식재산·기술, 마케팅·판매기법, 인사·조직·재무·전산, 연구개발·교육, 계약 및 거래 정보, 사업계획 및 보고서 등)를 의미하며 이에 한정되지 아니합니다."],
    ["비밀유지의무", "본인은 업무 수행 중 수령·지득한 영업비밀을 회사가 승인한 이외의 방법으로 사용하지 아니하고, 사전 서면 승인 없이 제3자에게 공개·누설하지 않으며, 퇴사 이후에도 이를 엄수합니다. 비밀유지의무는 구두·서면·파일 등 방법을 불문합니다."],
    ["자료의 반환", "본인은 퇴사 시 및 업무 변경 시 영업비밀이 포함된 제반 자료·매체(하드디스크·USB·CD 등)를 보관 상태 그대로 회사에 반환하며, 회사의 요구가 있을 경우 즉시 반환하거나 회복 불가능하게 폐기하고 그 사실을 서면으로 확인합니다."],
    ["소유권의 귀속", "본인이 업무와 관련하여 작성한 문건·자료·저작물 및 개발·취득·인지한 기술·발명·노하우 등에 대한 소유권 및 지식재산권은 회사에 전적으로 귀속되며, 본인은 관련 권리를 회사의 요청에 따라 즉시 회사에 양도합니다."],
    ["비공개 의무", "본인은 회사의 사전 서면동의 없이 본인의 홍보 등을 위하여 언론·SNS 등에 회사 업무 및 수행내용을 게시하거나 관련 인터뷰를 하지 않겠습니다."],
    ["확약사항", "본인은 본 서약 전 다른 회사의 자료를 모두 반납하였고 사본을 보유하지 아니함을 확약하며, 제3자에 대한 비밀유지의무를 부담하는 정보를 사용하지 아니할 것을 확약합니다."],
    ["손해배상", "본인은 본 서약상의 의무를 위반할 경우 부정경쟁방지 및 영업비밀보호에 관한 법률 등 관계 법령에 따른 민·형사상 책임을 지며, 회사에 발생한 모든 손해(법률비용 포함)를 배상합니다."],
    ["업무용 컴퓨터 등의 조회", "본인은 회사의 정보처리장치·정보통신망을 업무용으로만 사용하며, 회사가 불법행위 방지 및 영업비밀 보호를 위하여 필요한 경우 사용 내역 등을 모니터링·열람할 수 있음에 동의합니다."],
    ["계약기간", "본 서약서는 서약한 날로부터 시작하여 퇴사한 날로부터 2년간 효력이 있습니다."],
    ["관할법", "본 서약과 관련된 모든 분쟁은 회사의 본사 소재지를 관할하는 법원을 제1심 관할 법원으로 합니다."],
  ];
  return (
    <>
      <p className={styles.intro}>
        본인은 {COMPANY} (이하 “회사”)에서 업무를 수행함에 있어 취득할 가능성이 있는
        회사의 영업비밀 보호와 관련하여 다음과 같이 서약합니다.
      </p>
      {arts.map(([t, b], i) => (
        <div key={i} className={styles.article}>
          <div className={styles.articleHead}>
            제{i + 1}조 ({t})
          </div>
          <div className={styles.articleBody}>
            <p>{b}</p>
          </div>
        </div>
      ))}
    </>
  );
}

interface Props {
  kind: PledgeKind;
  contractId: string;
  initialForm?: Partial<PledgeForm>;
  initialSignature?: string | null;
  readOnly?: boolean;
  headerTitle?: string;
  headerBadge?: string;
  onBack?: () => void;
}

export default function PledgeEditor({
  kind,
  contractId,
  initialForm,
  initialSignature = null,
  readOnly = false,
  headerTitle,
  headerBadge,
  onBack,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<PledgeForm>({ ...DEFAULT_FORM, ...initialForm });
  const [signature, setSignature] = useState<string | null>(initialSignature);
  const [saving, setSaving] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);
  const useRrn = USE_RRN[kind];

  useEffect(() => {
    if (initialForm?.employeeName) return;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.displayName)
          setForm((p) => (p.employeeName ? p : { ...p, employeeName: d.displayName }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const up = <K extends keyof PledgeForm>(k: K, v: PledgeForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

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
    if (!form.employeeName.trim()) return alert("성명을 입력해 주세요.");
    if (signed && !signature) return alert("서명을 먼저 작성해 주세요.");
    setSaving(true);
    try {
      const pdfDataUrl = signed ? await renderPdfDataUrl() : null;
      const res = await fetch(`/api/me/contracts/${contractId}/submit-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_data: form, signature, signed, pdfDataUrl }),
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

  const d = ymdParts(form.signDate);

  return (
    <div className={styles.editorRoot}>
      {(headerTitle || onBack) && (
        <div className={styles.editorBar}>
          {onBack && (
            <button type="button" className={styles.editorBack} onClick={onBack}>
              ← 목록
            </button>
          )}
          {headerBadge && <span className={styles.editorBadge}>{headerBadge}</span>}
          {headerTitle && <span className={styles.editorTitle}>{headerTitle}</span>}
          {readOnly && <span className={styles.editorSignedBadge}>✅ 서명 완료</span>}
        </div>
      )}
      <div className={styles.editorBody}>
        {!readOnly && (
          <aside className={styles.formPane}>
            <div className={styles.formScroll}>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>서약자 정보</h3>
                <div className={styles.sectionBody}>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>성명</span>
                    <input className={styles.input} value={form.employeeName} onChange={(e) => up("employeeName", e.target.value)} />
                  </label>
                  {useRrn ? (
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>주민등록번호</span>
                      <input className={styles.input} value={form.employeeRRN} onChange={(e) => up("employeeRRN", formatRRN(e.target.value))} inputMode="numeric" placeholder="901027-1234567" />
                    </label>
                  ) : (
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>생년월일</span>
                      <input type="date" className={styles.input} value={form.birthDate} onChange={(e) => up("birthDate", e.target.value)} />
                    </label>
                  )}
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>작성일</span>
                    <input type="date" className={styles.input} value={form.signDate} onChange={(e) => up("signDate", e.target.value)} />
                  </label>
                </div>
              </section>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>서명</h3>
                <SignaturePad value={signature} onChange={setSignature} />
              </section>
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
        <main className={styles.previewPane}>
          <div className={styles.doc} id="contract-doc" ref={docRef}>
            <h1 className={styles.docTitle}>{TITLE[kind]}</h1>
            {useRrn && (
              <div className={styles.signGrid}>
                <div className={styles.party}>
                  <div className={styles.partyRows}>
                    <div>성명 : {form.employeeName}</div>
                    <div>주민등록번호 : {form.employeeRRN}</div>
                  </div>
                </div>
              </div>
            )}
            <Body kind={kind} />

            <p className={styles.docDate}>
              {d.y}년 {d.m || "  "}월 {d.d || "  "}일
            </p>
            <div className={styles.signGrid}>
              <div className={styles.party}>
                <div className={styles.partyRows}>
                  {!useRrn && <div>생년월일 : {ymdParts(form.birthDate).y !== "20" || form.birthDate ? `${ymdParts(form.birthDate).y}년 ${ymdParts(form.birthDate).m || "  "}월 ${ymdParts(form.birthDate).d || "  "}일` : ""}</div>}
                  <div className={styles.partySign}>
                    성명 : {form.employeeName} <Sign src={signature} />
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
