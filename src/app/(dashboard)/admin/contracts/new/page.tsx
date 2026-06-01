"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

type ContractType = "regular" | "contract" | "civil" | "sales";

const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  regular: "정규직",
  contract: "계약직",
  civil: "민간",
  sales: "영업직",
};
const CONTRACT_TYPE_DESC: Record<ContractType, string> = {
  regular: "연봉제, 기간 없음 — 기본급/식대/직책수당",
  contract: "시급제, 시작·종료일 명시",
  civil: "연봉제, 정규직과 동일 구조",
  sales: "연봉제, 인센티브 포함 (매출 기준 5~10%)",
};

interface AppUserOption {
  id: number;
  name: string;
}

export default function NewContractPage() {
  const router = useRouter();
  const [type, setType] = useState<ContractType>("regular");
  const [users, setUsers] = useState<AppUserOption[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [employeeUserId, setEmployeeUserId] = useState<number | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
          contract_type: type,
          employee_user_id: employeeUserId,
          employee_name: employeeName.trim(),
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
        <h1 className={styles.title}>근로계약서 신규 작성</h1>
        <p className={styles.sub}>
          양식 종류와 직원을 지정하면 해당 직원이 패드에서 로그인 후 양식 위에
          직접 작성·서명합니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {err && <div className={styles.error}>{err}</div>}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. 양식 선택</h2>
          <div className={styles.typeGrid}>
            {(Object.keys(CONTRACT_TYPE_LABEL) as ContractType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`${styles.typeCard} ${type === t ? styles.typeCardActive : ""}`}
                onClick={() => setType(t)}
              >
                <span className={styles.typeName}>
                  {CONTRACT_TYPE_LABEL[t]}
                </span>
                <span className={styles.typeDesc}>
                  {CONTRACT_TYPE_DESC[t]}
                </span>
              </button>
            ))}
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
            {saving ? "저장 중..." : "저장 후 서명 대기"}
          </button>
        </div>
      </form>
    </div>
  );
}
