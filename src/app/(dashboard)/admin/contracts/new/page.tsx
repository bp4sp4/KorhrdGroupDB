"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

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
  civil: "민간",
  sales: "영업직",
  privacy: "개인정보 동의서",
  ethics: "보안·윤리 서약서",
  nda: "비밀유지 서약서",
  pledge: "입사 서약서",
};
const CONTRACT_TYPE_DESC: Record<ContractType, string> = {
  regular: "연봉제, 기간 없음 — 기본급/식대/직책수당",
  contract: "시급제, 시작·종료일 명시",
  civil: "연봉제, 정규직과 동일 구조",
  sales: "연봉제, 인센티브 포함 (매출 기준 5~10%)",
  privacy: "개인정보 수집·이용 및 제3자 제공 동의",
  ethics: "보안/윤리 강령 준수 서약",
  nda: "영업비밀 비밀유지 서약",
  pledge: "입사 서약 (취업규칙 준수 등)",
};

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
  const [allowanceMonthly, setAllowanceMonthly] = useState("0");
  const [hourlyWage, setHourlyWage] = useState("10320");

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
          wage: { baseMonthly, mealMonthly, allowanceMonthly, hourlyWage },
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

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h1 className={styles.title}>전자계약 신규 작성</h1>
        <p className={styles.sub}>
          양식(근로계약서·서약서·동의서)과 직원을 지정하면 해당 직원이 로그인 후
          양식 위에 직접 작성·서명합니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {err && <div className={styles.error}>{err}</div>}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            1. 양식 선택{" "}
            <span className={styles.sectionHint}>
              (여러 개 선택 가능{types.size > 0 ? ` · ${types.size}개 선택됨` : ""})
            </span>
          </h2>
          <div className={styles.typeGrid}>
            {(Object.keys(CONTRACT_TYPE_LABEL) as ContractType[]).map((t) => {
              const on = types.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  className={`${styles.typeCard} ${on ? styles.typeCardActive : ""}`}
                  onClick={() => toggleType(t)}
                >
                  <span className={styles.typeCheck} aria-hidden>
                    {on ? "☑" : "☐"}
                  </span>
                  <span className={styles.typeName}>
                    {CONTRACT_TYPE_LABEL[t]}
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
          <h2 className={styles.sectionTitle}>2. 근로자(을) 지정</h2>
          <div className={styles.field}>
            <label className={styles.label}>시스템 사용자 선택 *</label>
            <div className={styles.dropdownWrap}>
              <input
                type="text"
                className={styles.input}
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
            <h2 className={styles.sectionTitle}>
              3. 임금 설정{" "}
              <span className={styles.sectionHint}>
                (근로계약서 — 직원은 수정할 수 없습니다)
              </span>
            </h2>
            {hasMonthly && (
              <>
                <div className={styles.field}>
                  <label className={styles.label}>기본급 (월)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={styles.input}
                    value={comma(baseMonthly)}
                    placeholder="예) 3,960,000"
                    onChange={(e) =>
                      setBaseMonthly(e.target.value.replace(/[^0-9]/g, ""))
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>식대 (월)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={styles.input}
                    value={comma(mealMonthly)}
                    onChange={(e) =>
                      setMealMonthly(e.target.value.replace(/[^0-9]/g, ""))
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    수당 (직책/민간/인센티브, 월)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={styles.input}
                    value={comma(allowanceMonthly)}
                    onChange={(e) =>
                      setAllowanceMonthly(e.target.value.replace(/[^0-9]/g, ""))
                    }
                  />
                </div>
              </>
            )}
            {hasHourly && (
              <div className={styles.field}>
                <label className={styles.label}>시급 (계약직)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className={styles.input}
                  value={comma(hourlyWage)}
                  placeholder="예) 10,320"
                  onChange={(e) =>
                    setHourlyWage(e.target.value.replace(/[^0-9]/g, ""))
                  }
                />
              </div>
            )}
            <p className={styles.hint}>
              여기서 입력한 임금이 직원 계약서에 자동 반영되며, 직원은 보기만
              가능합니다. (서약서·동의서에는 적용되지 않습니다.)
            </p>
          </section>
        )}

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => router.back()}
            disabled={saving}
          >
            취소
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={saving}>
            {saving
              ? "저장 중..."
              : types.size > 1
                ? `${types.size}건 저장 후 서명 대기`
                : "저장 후 서명 대기"}
          </button>
        </div>
      </form>
    </div>
  );
}
