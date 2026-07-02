"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Info, Check, ArrowRight } from "lucide-react";
import styles from "./page.module.css";
import ContractEditor, {
  type WorkVariant,
  type ContractForm,
} from "@/app/(dashboard)/me/contracts/_contract/ContractEditor";

type ContractType =
  | "regular"
  | "contract"
  | "civil"
  | "sales"
  | "privacy"
  | "ethics"
  | "nda"
  | "pledge";

const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  regular: "정규직",
  contract: "계약직",
  civil: "정규직(민간)",
  sales: "정규직(영업직)",
  privacy: "개인정보 동의서",
  ethics: "보안·윤리 서약서",
  nda: "비밀유지 서약서",
  pledge: "입사 서약서",
};
const CONTRACT_TYPE_DESC: Record<ContractType, string> = {
  regular: "연봉제, 기간 없음 — 기본급·식대",
  contract: "시급제, 시작·종료일 명시",
  civil: "연봉제 — 정규직과 동일 구조",
  sales: "연봉제 — 영업직",
  privacy: "개인정보 수집·이용 및 제3자 제공 동의",
  ethics: "보안/윤리 강령 준수 서약",
  nda: "영업비밀 비밀유지 서약",
  pledge: "입사 서약 (취업규칙 준수 등)",
};
// 신규 작성에서 선택 가능한 양식
const VISIBLE_TYPES: ContractType[] = [
  "regular",
  "contract",
  "civil",
  "sales",
  "privacy",
  "ethics",
  "nda",
  "pledge",
];

interface AppUserOption {
  id: number;
  name: string;
}

export default function NewContractPage() {
  const router = useRouter();
  // 여러 양식 동시 선택 가능
  const [types, setTypes] = useState<Set<ContractType>>(new Set());
  // 근로계약서 4종은 서로 하나만 선택 가능(상호 배타) / 서약서·동의서는 다중 선택
  const WORK_TYPE_SET = new Set<ContractType>([
    "regular",
    "contract",
    "civil",
    "sales",
  ]);
  const toggleType = (t: ContractType) =>
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) {
        next.delete(t);
        return next;
      }
      // 근로계약서 양식을 켤 때는 기존 근로계약서 선택을 해제
      if (WORK_TYPE_SET.has(t)) {
        for (const w of WORK_TYPE_SET) next.delete(w);
      }
      next.add(t);
      return next;
    });
  const [users, setUsers] = useState<AppUserOption[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [employeeUserId, setEmployeeUserId] = useState<number | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 관리자가 지정하는 임금 (직원은 보기만)
  const [baseMonthly, setBaseMonthly] = useState("");
  const [mealMonthly, setMealMonthly] = useState("200000");
  const [hourlyWage, setHourlyWage] = useState("10320");
  // 제5조 2) 임금 구성항목 (비우면 기본 문구)
  const [wageComposition, setWageComposition] = useState("");

  // 관리자가 지정하는 근로조건 (비우면 계약서 기본 문구 유지 — 직원은 보기만)
  const [workTime, setWorkTime] = useState("");
  const [breakTime, setBreakTime] = useState("");
  const [workDays, setWorkDays] = useState("");
  const [weeklyHoliday, setWeeklyHoliday] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [probationMonths, setProbationMonths] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [specialTerms, setSpecialTerms] = useState("");
  // 미리보기에서 강조할 조항 (편집 중인 필드에 해당)
  const [focusedArticle, setFocusedArticle] = useState<number | null>(null);

  const hasMonthly = (["regular", "civil", "sales"] as ContractType[]).some(
    (t) => types.has(t),
  );
  const hasHourly = types.has("contract");
  const showWage = hasMonthly || hasHourly;
  const comma = (v: string) => {
    const n = v.replace(/[^0-9]/g, "");
    return n ? Number(n).toLocaleString() : "";
  };

  useEffect(() => {
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users.slice(0, 30);
    return users
      .filter((u) => (u.name ?? "").toLowerCase().includes(q))
      .slice(0, 30);
  }, [users, userQuery]);

  const pickUser = (u: AppUserOption) => {
    setEmployeeUserId(u.id);
    setEmployeeName(u.name);
    setUserQuery(u.name);
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (types.size === 0) {
      setErr("양식을 1개 이상 선택하세요.");
      return;
    }
    if (!employeeName.trim()) {
      setErr("근로자 이름을 선택하거나 입력하세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_types: Array.from(types),
          employee_user_id: employeeUserId,
          employee_name: employeeName.trim(),
          wage: { baseMonthly, mealMonthly, hourlyWage },
          work_conditions: {
            workTime, breakTime, workDays, weeklyHoliday, workLocation,
            probationMonths, position, department, specialTerms, wageComposition,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "저장에 실패했습니다.");
        return;
      }
      router.push("/admin/contracts");
    } finally {
      setSaving(false);
    }
  };

  // 실시간 미리보기 — 선택된 근로계약서 1종 기준 (서약서·동의서는 미리보기 없음)
  const previewVariant = (
    ["regular", "civil", "sales", "contract"] as ContractType[]
  ).find((t) => types.has(t)) as WorkVariant | undefined;
  const previewForm: Partial<ContractForm> = {
    employeeName,
    baseMonthly,
    mealMonthly,
    hourlyWage,
    wageComposition,
    workTime,
    breakTime,
    workDays,
    weeklyHoliday,
    workLocation,
    probationMonths,
    position,
    department,
    specialTerms,
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
      <div className={styles.head}>
        <div className={styles.headTitleRow}>
          <h1 className={styles.title}>전자계약 신규 작성</h1>
          <span className={styles.headBadge}>임시저장 없음</span>
        </div>
        <p className={styles.sub}>
          양식(근로계약서·서약서·동의서)과 직원을 지정하면 해당 직원이 로그인 후
          양식 위에 직접 작성·서명합니다.
        </p>
      </div>

      <div className={styles.splitLayout}>
      <form id="contract-new-form" onSubmit={handleSubmit} className={styles.form}>
        {err && <div className={styles.error}>{err}</div>}

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionBadge}>1</span>
            <h2 className={styles.sectionTitle}>양식 선택</h2>
            <span className={styles.sectionHint}>여러 개 선택 가능</span>
            {types.size > 0 && (
              <span className={styles.countChip}>{types.size}개 선택됨</span>
            )}
          </div>
          <div className={styles.typeGrid}>
            {VISIBLE_TYPES.map((t) => {
              const on = types.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  className={`${styles.typeCard} ${on ? styles.typeCardActive : ""}`}
                  onClick={() => toggleType(t)}
                >
                  <span className={styles.typeCardTop}>
                    <span className={styles.typeName}>
                      {CONTRACT_TYPE_LABEL[t]}
                    </span>
                    <span className={styles.typeCheck} aria-hidden>
                      {on && <Check size={12} strokeWidth={3} />}
                    </span>
                  </span>
                  <span className={styles.typeDesc}>
                    {CONTRACT_TYPE_DESC[t]}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionBadge}>2</span>
            <h2 className={styles.sectionTitle}>근로자(을) 지정</h2>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              시스템 사용자 선택 <span className={styles.req}>*</span>
            </label>
            <div className={styles.dropdownWrap}>
              <div className={styles.inputAffix}>
                <span className={styles.inputIcon}>
                  <Search size={15} />
                </span>
                <input
                  type="text"
                  className={`${styles.input} ${styles.inputWithIcon}`}
                  value={userQuery}
                  placeholder="이름으로 검색"
                  onFocus={() => setShowDropdown(true)}
                  onChange={(e) => {
                    setUserQuery(e.target.value);
                    setShowDropdown(true);
                    if (!e.target.value) {
                      setEmployeeUserId(null);
                      setEmployeeName("");
                    }
                  }}
                  onBlur={() =>
                    setTimeout(() => setShowDropdown(false), 150)
                  }
                />
              </div>
              {showDropdown && filteredUsers.length > 0 && (
                <ul className={styles.dropdown}>
                  {filteredUsers.map((u) => (
                    <li
                      key={u.id}
                      className={styles.dropdownItem}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickUser(u);
                      }}
                    >
                      {u.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className={styles.hint}>
              해당 직원이 로그인한 상태로 패드에서 본인의 계약서를 작성합니다.
            </p>
          </div>
        </section>

        {showWage && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionBadge}>3</span>
              <h2 className={styles.sectionTitle}>임금 설정</h2>
              <span className={styles.sectionHint}>
                근로계약서 — 직원은 수정할 수 없습니다
              </span>
            </div>
            {hasMonthly && (
              <>
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>기본급 (월)</label>
                    <div className={styles.inputAffix}>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={`${styles.input} ${styles.inputWithSuffix}`}
                        value={comma(baseMonthly)}
                        onFocus={() => setFocusedArticle(5)}
                        placeholder="예) 3,960,000"
                        onChange={(e) =>
                          setBaseMonthly(e.target.value.replace(/[^0-9]/g, ""))
                        }
                      />
                      <span className={styles.inputSuffix}>원</span>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>식대 (월)</label>
                    <div className={styles.inputAffix}>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={`${styles.input} ${styles.inputWithSuffix}`}
                        value={comma(mealMonthly)}
                        onFocus={() => setFocusedArticle(5)}
                        onChange={(e) =>
                          setMealMonthly(e.target.value.replace(/[^0-9]/g, ""))
                        }
                      />
                      <span className={styles.inputSuffix}>원</span>
                    </div>
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    임금 구성항목{" "}
                    <span className={styles.labelSub}>(제5조 2)</span>
                  </label>
                  <textarea
                    className={`${styles.input} ${styles.textarea}`}
                    rows={3}
                    value={wageComposition}
                    onFocus={() => setFocusedArticle(5)}
                    placeholder="비우면 기본: - 식대 : 근무일수에 적합하게 일할 계산되어 지급되는 점심 식대, 1개월 만근시 20만원 지급 (줄바꿈으로 여러 줄)"
                    onChange={(e) => setWageComposition(e.target.value)}
                  />
                </div>
              </>
            )}
            {hasHourly && (
              <div className={styles.field}>
                <label className={styles.label}>시급 (계약직)</label>
                <div className={styles.inputAffix}>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={`${styles.input} ${styles.inputWithSuffix}`}
                    value={comma(hourlyWage)}
                    onFocus={() => setFocusedArticle(5)}
                    placeholder="예) 10,320"
                    onChange={(e) =>
                      setHourlyWage(e.target.value.replace(/[^0-9]/g, ""))
                    }
                  />
                  <span className={styles.inputSuffix}>원</span>
                </div>
              </div>
            )}
            <div className={styles.infoBox}>
              <span className={styles.infoIcon}>
                <Info size={14} />
              </span>
              <p className={styles.infoText}>
                여기서 입력한 임금이 직원 계약서에 자동 반영되며, 직원은 보기만
                가능합니다. (서약서·동의서에는 적용되지 않습니다.)
              </p>
            </div>
          </section>
        )}

        {showWage && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionBadge}>4</span>
              <h2 className={styles.sectionTitle}>근로조건 설정</h2>
              <span className={styles.sectionHint}>선택 — 비우면 기본 문구 유지</span>
            </div>

            {/* 제2조 */}
            <div className={styles.group}>
              <div className={styles.groupHead}>
                <span className={styles.groupClause}>제2조</span>
                <span className={styles.groupTitle}>수습기간</span>
              </div>
              <div className={styles.groupFields}>
                <div className={styles.field}>
                  <label className={styles.groupLabel}>수습기간 (개월)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={`${styles.input} ${styles.inputSm}`}
                    value={probationMonths}
                    onFocus={() => setFocusedArticle(2)}
                    placeholder="비우면 기본: 3"
                    onChange={(e) =>
                      setProbationMonths(e.target.value.replace(/[^0-9]/g, ""))
                    }
                  />
                </div>
              </div>
            </div>

            {/* 제3조 */}
            <div className={styles.group}>
              <div className={styles.groupHead}>
                <span className={styles.groupClause}>제3조</span>
                <span className={styles.groupTitle}>담당업무 및 업무 장소</span>
              </div>
              <div className={styles.groupFields}>
                <div className={styles.field}>
                  <label className={styles.groupLabel}>근무 장소</label>
                  <input
                    type="text"
                    className={`${styles.input} ${styles.inputSm}`}
                    value={workLocation}
                    onFocus={() => setFocusedArticle(3)}
                    placeholder="비우면 기본: 서울시 도봉구 마들로13길 61, B동 905,906호(창동)"
                    onChange={(e) => setWorkLocation(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.groupLabel}>직책 / 직위</label>
                  <input
                    type="text"
                    className={`${styles.input} ${styles.inputSm}`}
                    value={position}
                    onFocus={() => setFocusedArticle(3)}
                    placeholder="예) 팀장 (비우면 표시 안 함)"
                    onChange={(e) => setPosition(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.groupLabel}>부서</label>
                  <input
                    type="text"
                    className={`${styles.input} ${styles.inputSm}`}
                    value={department}
                    onFocus={() => setFocusedArticle(3)}
                    placeholder="예) 마케팅개발본부 (비우면 표시 안 함)"
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* 제4조 */}
            <div className={styles.group}>
              <div className={styles.groupHead}>
                <span className={styles.groupClause}>제4조</span>
                <span className={styles.groupTitle}>근로시간</span>
              </div>
              <div className={styles.groupFields}>
                <div className={styles.field}>
                  <label className={styles.groupLabel}>근무시간</label>
                  <textarea
                    className={`${styles.input} ${styles.inputSm} ${styles.textarea}`}
                    rows={2}
                    value={workTime}
                    onFocus={() => setFocusedArticle(4)}
                    placeholder="비우면 기본: 1일 8시간 근무, 오전 10시부터 오후 7시까지"
                    onChange={(e) => setWorkTime(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.groupLabel}>휴게시간</label>
                  <textarea
                    className={`${styles.input} ${styles.inputSm} ${styles.textarea}`}
                    rows={2}
                    value={breakTime}
                    onFocus={() => setFocusedArticle(4)}
                    placeholder="비우면 기본: 휴게시간은 13시부터 14시로 하며, 근무시간에는 제외한다."
                    onChange={(e) => setBreakTime(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.groupLabel}>근무일</label>
                  <textarea
                    className={`${styles.input} ${styles.inputSm} ${styles.textarea}`}
                    rows={2}
                    value={workDays}
                    onFocus={() => setFocusedArticle(4)}
                    placeholder="비우면 기본: 주 5일 근무, 주 40시간 원칙 (최대 52시간)"
                    onChange={(e) => setWorkDays(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.groupLabel}>주휴일</label>
                  <textarea
                    className={`${styles.input} ${styles.inputSm} ${styles.textarea}`}
                    rows={2}
                    value={weeklyHoliday}
                    onFocus={() => setFocusedArticle(4)}
                    placeholder="비우면 기본: 주휴일은 일요일로 하되, 협의하여 변경 가능"
                    onChange={(e) => setWeeklyHoliday(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* 특약 */}
            <div className={styles.group}>
              <div className={styles.groupHead}>
                <span className={styles.groupClause}>특약사항</span>
                <span className={styles.groupSub}>(선택)</span>
              </div>
              <div className={styles.groupFields}>
                <textarea
                  className={`${styles.input} ${styles.inputSm} ${styles.textarea}`}
                  rows={2}
                  value={specialTerms}
                  onFocus={() => setFocusedArticle(16)}
                  placeholder="계약별 추가 특약 조항 (줄바꿈으로 여러 줄, 비우면 조항 없음)"
                  onChange={(e) => setSpecialTerms(e.target.value)}
                />
              </div>
              <div className={styles.infoBox}>
                <span className={styles.infoIcon}>
                  <Info size={14} />
                </span>
                <p className={styles.infoText}>
                  입력한 근로조건이 계약서 본문에 반영되며, 직원은 보기만
                  가능합니다. 비워두면 기존 표준 문구가 그대로 사용됩니다.
                </p>
              </div>
            </div>
          </section>
        )}

      </form>

        {previewVariant && (
          <aside className={styles.previewPane}>
            <div className={styles.previewLabel}>
              <span className={styles.previewDot} />
              <span className={styles.previewLabelText}>실시간 미리보기</span>
              <span className={styles.previewLabelSub}>
                · {CONTRACT_TYPE_LABEL[previewVariant]}
              </span>
            </div>
            <div className={styles.previewFrame}>
              <div className={styles.previewDoc}>
                <ContractEditor
                  variant={previewVariant}
                  mode="assigned"
                  preview
                  initialForm={previewForm}
                  highlightArticleN={focusedArticle}
                />
              </div>
            </div>
          </aside>
        )}
      </div>
      </div>

      {/* 하단 고정 액션바 */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerStatus}>
            양식 <b>{types.size}건</b> · 근로자{" "}
            {employeeName ? (
              <b>{employeeName}</b>
            ) : (
              <span className={styles.footerStatusWarn}>미지정</span>
            )}
          </span>
          <div className={styles.footerSpacer} />
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => router.back()}
            disabled={saving}
          >
            취소
          </button>
          <button
            type="submit"
            form="contract-new-form"
            className={styles.btnPrimary}
            disabled={saving}
          >
            {saving
              ? "저장 중..."
              : types.size > 1
                ? `${types.size}건 저장 후 서명 대기`
                : "저장 후 서명 대기"}
            {!saving && <ArrowRight size={15} />}
          </button>
        </div>
      </footer>
    </div>
  );
}
