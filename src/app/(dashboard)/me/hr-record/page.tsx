"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Script from "next/script";
import {
  Plus,
  Trash2,
  Save,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  EyeOff,
  Search,
} from "lucide-react";
import styles from "./page.module.css";

// 카카오 우편번호 API 타입 (Daum Postcode)
interface DaumPostcodeData {
  address: string;
  roadAddress: string;
  jibunAddress: string;
  zonecode: string;
  buildingName?: string;
  apartment?: "Y" | "N";
}
declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void;
      }) => { open: () => void };
    };
  }
}

type Status = "draft" | "submitted" | "approved" | "rejected";

interface EducationItem {
  school?: string | null;
  start?: string | null;
  end?: string | null;
  degree?: string | null;
  major?: string | null;
}
interface CareerItem {
  org?: string | null;
  position?: string | null;
  work?: string | null;
  start?: string | null;
  end?: string | null;
  months?: number | null;
  notes?: string | null;
  // 경력증명서 첨부 (이미지/PDF 등)
  attachment_url?: string | null;
  attachment_name?: string | null;
}
interface CertItem {
  name?: string | null;
  grade?: string | null;
  number?: string | null;
  issued_at?: string | null;
  issuer?: string | null;
}

interface Record {
  id?: string;
  status?: Status;
  profile_image_url?: string | null;
  name_ko?: string | null;
  name_en?: string | null;
  gender?: "male" | "female" | null;
  rrn?: string | null;
  birth_date?: string | null;
  company_name?: string | null;
  joined_at?: string | null;
  company_address?: string | null;
  current_address?: string | null;
  phone?: string | null;
  work_phone?: string | null;
  email?: string | null;
  emergency_phone?: string | null;
  emergency_relation?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  account_holder?: string | null;
  education?: EducationItem[];
  career?: CareerItem[];
  certificates?: CertItem[];
  reject_reason?: string | null;
}

function calcMonths(start?: string | null, end?: string | null): number {
  if (!start) return 0;
  // YYYY-MM 형식이면 YYYY-MM-01로 보정
  const normalize = (s: string) => (s.length === 7 ? `${s}-01` : s);
  const s = new Date(normalize(start) + "T00:00:00");
  const e = end ? new Date(normalize(end) + "T00:00:00") : new Date();
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const months =
    (e.getFullYear() - s.getFullYear()) * 12 +
    (e.getMonth() - s.getMonth()) +
    1;
  return Math.max(0, months);
}

const RELATION_OPTIONS = ["배우자", "부모", "형제"] as const;

// 본사 직장주소 기본값 — 빈 칸일 때 자동 채움 (사용자 수정 가능)
const DEFAULT_COMPANY_ADDRESS = "서울시 도봉구 마들로 13길 61, B동 905,906호";

export default function MyHrRecordPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [record, setRecord] = useState<Record>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 로드
  useEffect(() => {
    fetch("/api/hr-records/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.record) {
          setRecord({
            ...data.record,
            // 기존 카드의 직장주소가 비어 있으면 기본값으로 채움
            company_address:
              data.record.company_address || DEFAULT_COMPANY_ADDRESS,
            education: data.record.education ?? [],
            career: data.record.career ?? [],
            certificates: data.record.certificates ?? [],
          });
        } else {
          // 신규 카드 — 직장주소 기본값으로 시작
          setRecord({
            company_address: DEFAULT_COMPANY_ADDRESS,
            education: [],
            career: [],
            certificates: [],
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const status: Status = record.status ?? "draft";
  const readonly = status === "submitted" || status === "approved";

  const update = <K extends keyof Record>(key: K, value: Record[K]) => {
    setRecord((p) => ({ ...p, [key]: value }));
  };

  // 학력
  const addEducation = () =>
    setRecord((p) => ({ ...p, education: [...(p.education ?? []), {}] }));
  const updateEducation = (i: number, patch: Partial<EducationItem>) =>
    setRecord((p) => ({
      ...p,
      education: (p.education ?? []).map((it, idx) =>
        idx === i ? { ...it, ...patch } : it,
      ),
    }));
  const removeEducation = (i: number) =>
    setRecord((p) => ({
      ...p,
      education: (p.education ?? []).filter((_, idx) => idx !== i),
    }));

  // 경력
  const addCareer = () =>
    setRecord((p) => ({ ...p, career: [...(p.career ?? []), {}] }));
  const updateCareer = (i: number, patch: Partial<CareerItem>) =>
    setRecord((p) => ({
      ...p,
      career: (p.career ?? []).map((it, idx) => {
        if (idx !== i) return it;
        const next = { ...it, ...patch };
        next.months = calcMonths(next.start, next.end);
        return next;
      }),
    }));
  const removeCareer = (i: number) =>
    setRecord((p) => ({
      ...p,
      career: (p.career ?? []).filter((_, idx) => idx !== i),
    }));

  // 자격
  const addCert = () =>
    setRecord((p) => ({ ...p, certificates: [...(p.certificates ?? []), {}] }));
  const updateCert = (i: number, patch: Partial<CertItem>) =>
    setRecord((p) => ({
      ...p,
      certificates: (p.certificates ?? []).map((it, idx) =>
        idx === i ? { ...it, ...patch } : it,
      ),
    }));
  const removeCert = (i: number) =>
    setRecord((p) => ({
      ...p,
      certificates: (p.certificates ?? []).filter((_, idx) => idx !== i),
    }));

  // 프로필 사진 업로드
  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/hr-records/me/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "업로드 실패" }));
        alert(err.error ?? "업로드 실패");
        return;
      }
      const data = await res.json();
      update("profile_image_url", data.url);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 저장 / 제출
  const persist = async (action: "save" | "submit") => {
    const setBusy = action === "submit" ? setSubmitting : setSaving;
    setBusy(true);
    try {
      const res = await fetch("/api/hr-records/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...record }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "저장 실패" }));
        alert(err.error ?? "저장 실패");
        return;
      }
      const data = await res.json();
      setRecord({
        ...data.record,
        education: data.record.education ?? [],
        career: data.record.career ?? [],
        certificates: data.record.certificates ?? [],
      });
      // layout 가드 갱신 (같은 탭)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("hr-record-updated"));
      }
      alert(
        action === "submit"
          ? "제출 완료! 어드민 승인 후 사용 가능합니다."
          : "저장되었습니다.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <Loader2 className={styles.spinner} size={28} />
        <span>불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {/* 카카오 우편번호 API */}
      <Script
        src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        strategy="lazyOnload"
      />

      {/* 헤더 */}
      <div className={styles.header}>
        <h1 className={styles.title}>인사기록카드</h1>
        <StatusBadge status={status} />
      </div>

      {/* 반려 사유 */}
      {status === "rejected" && record.reject_reason && (
        <div className={styles.rejectBox}>
          <div className={styles.rejectTitle}>
            <XCircle size={16} /> 반려되었습니다
          </div>
          <div className={styles.rejectReason}>{record.reject_reason}</div>
          <div className={styles.rejectHint}>
            내용을 수정한 후 다시 제출하면 검토가 재개됩니다.
          </div>
        </div>
      )}
      {status === "submitted" && (
        <div className={styles.infoBox}>
          <Clock size={16} /> 어드민 승인 대기 중입니다. 승인 전까지는 수정이
          제한됩니다.
        </div>
      )}
      {status === "approved" && (
        <div className={styles.successBox}>
          <CheckCircle2 size={16} /> 승인되었습니다. 수정이 필요하면 관리자에게
          문의하세요.
        </div>
      )}

      {/* 1. 기초자료 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>1. 기초자료</h2>

        <div className={styles.profileRow}>
          <div className={styles.profileWrap}>
            {record.profile_image_url ? (
              <Image
                src={record.profile_image_url}
                alt="프로필"
                width={120}
                height={120}
                className={styles.profileImg}
                unoptimized
              />
            ) : (
              <div className={styles.profilePlaceholder}>
                사진<span className={styles.required}>*</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFilePick}
              className={styles.fileInput}
              disabled={readonly || uploading}
            />
            {!readonly && (
              <button
                type="button"
                className={styles.profileBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "업로드 중..." : "사진 선택"}
              </button>
            )}
          </div>

          <div className={styles.grid2}>
            <Field label="한글 이름" required>
              <input
                className={styles.input}
                value={record.name_ko ?? ""}
                onChange={(e) => update("name_ko", e.target.value)}
                placeholder="예) 홍길동"
                disabled={readonly}
              />
            </Field>
            <Field label="영문 이름" required>
              <input
                className={styles.input}
                value={record.name_en ?? ""}
                onChange={(e) => update("name_en", e.target.value)}
                placeholder="예) Hong Gil Dong"
                disabled={readonly}
              />
            </Field>
            <Field label="성별" required>
              <div className={styles.radioRow}>
                {(["male", "female"] as const).map((g) => (
                  <label key={g} className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="gender"
                      checked={record.gender === g}
                      onChange={() => update("gender", g)}
                      disabled={readonly}
                    />
                    {g === "male" ? "남자" : "여자"}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="주민번호" required>
              <RrnInput
                value={record.rrn ?? ""}
                onChange={(v) => update("rrn", v)}
                disabled={readonly}
              />
            </Field>
            <Field label="생년월일" required>
              <DateField
                value={record.birth_date ?? ""}
                onChange={(v) => update("birth_date", v || null)}
                placeholder="19900101 (숫자만 입력)"
                disabled={readonly}
              />
            </Field>
            <Field label="입사일" required>
              <DateField
                value={record.joined_at ?? ""}
                onChange={(v) => update("joined_at", v || null)}
                placeholder="20250115"
                disabled={readonly}
              />
            </Field>
            <Field label="직장명" required>
              <input
                className={styles.input}
                value={record.company_name ?? ""}
                onChange={(e) => update("company_name", e.target.value)}
                placeholder="예) ㈜한평생그룹"
                disabled={readonly}
              />
            </Field>
            <Field label="휴대폰" required>
              <PhoneField
                value={record.phone ?? ""}
                onChange={(v) => update("phone", v)}
                placeholder="010-0000-0000"
                disabled={readonly}
              />
            </Field>
            <Field label="업무폰">
              <PhoneField
                value={record.work_phone ?? ""}
                onChange={(v) => update("work_phone", v)}
                placeholder="010-0000-0000 (선택)"
                disabled={readonly}
              />
            </Field>
            <Field label="이메일" required>
              <input
                type="email"
                className={styles.input}
                value={record.email ?? ""}
                onChange={(e) => update("email", e.target.value)}
                placeholder="(한평생 오피스 가입 된 이메일)"
                disabled={readonly}
              />
            </Field>
            <Field label="직장주소" required fullWidth>
              <AddressInput
                value={record.company_address ?? ""}
                onChange={(v) => update("company_address", v)}
                disabled={readonly}
              />
            </Field>
            <Field label="현주소" required fullWidth>
              <AddressInput
                value={record.current_address ?? ""}
                onChange={(v) => update("current_address", v)}
                disabled={readonly}
              />
            </Field>
            <Field label="비상전화" required>
              <PhoneField
                value={record.emergency_phone ?? ""}
                onChange={(v) => update("emergency_phone", v)}
                placeholder="010-0000-0000"
                disabled={readonly}
              />
            </Field>
            <Field label="관계" required>
              <select
                className={styles.input}
                value={record.emergency_relation ?? ""}
                onChange={(e) => update("emergency_relation", e.target.value)}
                disabled={readonly}
              >
                <option value="">선택</option>
                {RELATION_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <h3 className={styles.subTitle}>급여 입금 계좌 (본인 명의 필수)</h3>
        <div className={styles.grid3}>
          <Field label="은행명" required>
            <input
              className={styles.input}
              value={record.bank_name ?? ""}
              onChange={(e) => update("bank_name", e.target.value)}
              placeholder="예) 신한은행"
              disabled={readonly}
            />
          </Field>
          <Field label="계좌번호" required>
            <input
              className={styles.input}
              value={record.account_number ?? ""}
              onChange={(e) => update("account_number", e.target.value)}
              placeholder="000-0000-0000"
              disabled={readonly}
            />
          </Field>
          <Field label="예금주 (본인)" required>
            <input
              className={styles.input}
              value={record.account_holder ?? ""}
              onChange={(e) => update("account_holder", e.target.value)}
              placeholder="본인 이름"
              disabled={readonly}
            />
          </Field>
        </div>
      </section>

      {/* 2. 학력사항 */}
      <section className={styles.section}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>2. 학력사항</h2>
          {!readonly && (
            <button
              type="button"
              className={styles.addRowBtn}
              onClick={addEducation}
            >
              <Plus size={14} /> 학력 추가
            </button>
          )}
        </div>

        {(record.education ?? []).length === 0 ? (
          <div className={styles.empty}>등록된 학력이 없습니다.</div>
        ) : (
          <div className={styles.itemList}>
            {(record.education ?? []).map((it, i) => (
              <div key={i} className={styles.itemCard}>
                <Field label="학교명" fullWidth>
                  <input
                    className={styles.input}
                    value={it.school ?? ""}
                    onChange={(e) =>
                      updateEducation(i, { school: e.target.value })
                    }
                    disabled={readonly}
                  />
                </Field>
                <Field label="입학">
                  <YearMonthField
                    value={it.start ?? ""}
                    onChange={(v) => updateEducation(i, { start: v || null })}
                    placeholder="201003 (년월)"
                    disabled={readonly}
                  />
                </Field>
                <Field label="졸업">
                  <YearMonthField
                    value={it.end ?? ""}
                    onChange={(v) => updateEducation(i, { end: v || null })}
                    placeholder="201402"
                    disabled={readonly}
                  />
                </Field>
                <Field label="학위명">
                  <input
                    className={styles.input}
                    value={it.degree ?? ""}
                    onChange={(e) =>
                      updateEducation(i, { degree: e.target.value })
                    }
                    placeholder="예) 학사"
                    disabled={readonly}
                  />
                </Field>
                <Field label="전공">
                  <input
                    className={styles.input}
                    value={it.major ?? ""}
                    onChange={(e) =>
                      updateEducation(i, { major: e.target.value })
                    }
                    disabled={readonly}
                  />
                </Field>
                {!readonly && (
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeEducation(i)}
                  >
                    <Trash2 size={13} /> 행 삭제
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. 경력사항 */}
      <section className={styles.section}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>3. 경력사항</h2>
          {!readonly && (
            <button
              type="button"
              className={styles.addRowBtn}
              onClick={addCareer}
            >
              <Plus size={14} /> 경력 추가
            </button>
          )}
        </div>

        {(record.career ?? []).length === 0 ? (
          <div className={styles.empty}>등록된 경력이 없습니다.</div>
        ) : (
          <div className={styles.itemList}>
            {(record.career ?? []).map((it, i) => (
              <div key={i} className={styles.itemCard}>
                <Field label="기관명" fullWidth>
                  <input
                    className={styles.input}
                    value={it.org ?? ""}
                    onChange={(e) => updateCareer(i, { org: e.target.value })}
                    disabled={readonly}
                  />
                </Field>
                <Field label="직위">
                  <input
                    className={styles.input}
                    value={it.position ?? ""}
                    onChange={(e) =>
                      updateCareer(i, { position: e.target.value })
                    }
                    disabled={readonly}
                  />
                </Field>
                <Field label="해당업무" fullWidth>
                  <input
                    className={styles.input}
                    value={it.work ?? ""}
                    onChange={(e) => updateCareer(i, { work: e.target.value })}
                    disabled={readonly}
                  />
                </Field>
                <Field label="시작">
                  <YearMonthField
                    value={it.start ?? ""}
                    onChange={(v) => updateCareer(i, { start: v || null })}
                    placeholder="202003 (년월)"
                    disabled={readonly}
                  />
                </Field>
                <Field label="종료">
                  <YearMonthField
                    value={it.end ?? ""}
                    onChange={(v) => updateCareer(i, { end: v || null })}
                    placeholder="202402 (재직중 비움)"
                    disabled={readonly}
                  />
                </Field>
                <Field label="개월수 (자동)">
                  <input
                    className={styles.input}
                    value={it.months != null ? `${it.months}개월` : ""}
                    readOnly
                  />
                </Field>
                <Field label="비고" fullWidth>
                  <input
                    className={styles.input}
                    value={it.notes ?? ""}
                    onChange={(e) => updateCareer(i, { notes: e.target.value })}
                    disabled={readonly}
                  />
                </Field>
                <Field label="경력증명서" fullWidth>
                  <CareerAttachment
                    item={it}
                    onChange={(patch) => updateCareer(i, patch)}
                    disabled={readonly}
                  />
                </Field>
                {!readonly && (
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeCareer(i)}
                  >
                    <Trash2 size={13} /> 행 삭제
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. 자격사항 */}
      <section className={styles.section}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>4. 자격사항 및 교육수료</h2>
          {!readonly && (
            <button
              type="button"
              className={styles.addRowBtn}
              onClick={addCert}
            >
              <Plus size={14} /> 자격 추가
            </button>
          )}
        </div>

        {(record.certificates ?? []).length === 0 ? (
          <div className={styles.empty}>등록된 자격이 없습니다.</div>
        ) : (
          <div className={styles.itemList}>
            {(record.certificates ?? []).map((it, i) => (
              <div key={i} className={styles.itemCard}>
                <Field label="자격증명">
                  <input
                    className={styles.input}
                    value={it.name ?? ""}
                    onChange={(e) => updateCert(i, { name: e.target.value })}
                    disabled={readonly}
                  />
                </Field>
                <Field label="급수">
                  <input
                    className={styles.input}
                    value={it.grade ?? ""}
                    onChange={(e) => updateCert(i, { grade: e.target.value })}
                    disabled={readonly}
                  />
                </Field>
                <Field label="자격증번호">
                  <input
                    className={styles.input}
                    value={it.number ?? ""}
                    onChange={(e) => updateCert(i, { number: e.target.value })}
                    disabled={readonly}
                  />
                </Field>
                <Field label="취득일자">
                  <YearMonthField
                    value={it.issued_at ?? ""}
                    onChange={(v) => updateCert(i, { issued_at: v || null })}
                    placeholder="202305 (년월)"
                    disabled={readonly}
                  />
                </Field>
                <Field label="인가기관" fullWidth>
                  <input
                    className={styles.input}
                    value={it.issuer ?? ""}
                    onChange={(e) => updateCert(i, { issuer: e.target.value })}
                    disabled={readonly}
                  />
                </Field>
                {!readonly && (
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeCert(i)}
                  >
                    <Trash2 size={13} /> 행 삭제
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 푸터 — 저장/제출 */}
      {!readonly && (
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => persist("save")}
            disabled={saving || submitting}
          >
            {saving ? "저장 중..." : "임시 저장"}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => {
              // 기초자료 필수 필드 검증 (업무폰 제외)
              const required: { value: unknown; label: string }[] = [
                { value: record.profile_image_url, label: "프로필 사진" },
                { value: record.name_ko, label: "한글 이름" },
                { value: record.name_en, label: "영문 이름" },
                { value: record.gender, label: "성별" },
                { value: record.rrn, label: "주민번호" },
                { value: record.birth_date, label: "생년월일" },
                { value: record.company_name, label: "직장명" },
                { value: record.joined_at, label: "입사일" },
                { value: record.company_address, label: "직장주소" },
                { value: record.current_address, label: "현주소" },
                { value: record.phone, label: "휴대폰" },
                { value: record.email, label: "이메일" },
                { value: record.emergency_phone, label: "비상전화" },
                { value: record.emergency_relation, label: "비상 관계" },
                { value: record.bank_name, label: "은행명" },
                { value: record.account_number, label: "계좌번호" },
                { value: record.account_holder, label: "예금주" },
              ];
              for (const r of required) {
                const v =
                  typeof r.value === "string"
                    ? r.value.trim()
                    : (r.value ?? "");
                if (!v) {
                  alert(`${r.label}은(는) 필수입니다.`);
                  return;
                }
              }
              if (
                !confirm(
                  "제출 후에는 어드민 승인 전까지 수정이 제한됩니다. 제출하시겠습니까?",
                )
              ) {
                return;
              }
              persist("submit");
            }}
            disabled={saving || submitting}
          >
            {submitting ? "제출 중..." : "제출하기"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 보조 컴포넌트 ──────────────────────────────────────────────────────

function Field({
  label,
  required,
  fullWidth,
  children,
}: {
  label: string;
  required?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`${styles.field} ${fullWidth ? styles.fieldFull : ""}`}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </label>
      {children}
    </div>
  );
}

function AddressInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const handleSearch = () => {
    if (typeof window === "undefined" || !window.daum?.Postcode) {
      alert("주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        const base = data.roadAddress || data.address || "";
        // 건물명이 있으면 괄호로 추가
        const full = data.buildingName
          ? `${base} (${data.buildingName})`
          : base;
        onChange(full);
      },
    }).open();
  };

  return (
    <div className={styles.addressWrap}>
      <input
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="주소 검색 버튼으로 찾기 또는 직접 입력"
        disabled={disabled}
      />
      {!disabled && (
        <button
          type="button"
          className={styles.addressBtn}
          onClick={handleSearch}
        >
          <Search size={14} /> 주소 검색
        </button>
      )}
    </div>
  );
}

// 사용자가 숫자만 쳐도 자동으로 YYYY-MM-DD 형식이 되는 입력
function formatDate(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function DateField({
  value,
  onChange,
  placeholder = "YYYY-MM-DD",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      className={styles.input}
      value={formatDate(value)}
      onChange={(e) => onChange(formatDate(e.target.value))}
      placeholder={placeholder}
      disabled={disabled}
      inputMode="numeric"
      autoComplete="off"
      maxLength={10}
    />
  );
}

// 사용자가 숫자만 쳐도 자동으로 YYYY-MM 형식이 되는 입력 (학력/경력/자격)
function formatYearMonth(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function YearMonthField({
  value,
  onChange,
  placeholder = "YYYY-MM",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  // 기존 데이터가 YYYY-MM-DD 형태로 저장되어 있을 수 있으니 표시할 때는 YYYY-MM만
  const display = formatYearMonth(value);
  return (
    <input
      type="text"
      className={styles.input}
      value={display}
      onChange={(e) => onChange(formatYearMonth(e.target.value))}
      placeholder={placeholder}
      disabled={disabled}
      inputMode="numeric"
      autoComplete="off"
      maxLength={7}
    />
  );
}

// Storage publicUrl에서 storage path를 추출해 다운로드 프록시 URL을 만든다
function buildHrDownloadUrl(url: string, name?: string | null): string {
  const marker = "/hr-profile-images/";
  const idx = url?.indexOf(marker);
  if (idx == null || idx === -1) return url;
  const path = url.slice(idx + marker.length);
  const params = new URLSearchParams({
    path,
    filename: name ?? "경력증명서",
  });
  return `/api/hr-records/download?${params.toString()}`;
}

// ─── 경력증명서 첨부 ──────────────────────────────────────────────────
function CareerAttachment({
  item,
  onChange,
  disabled,
}: {
  item: CareerItem;
  onChange: (patch: Partial<CareerItem>) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "career");
      const res = await fetch("/api/hr-records/me/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "업로드 실패" }));
        alert(err.error ?? "업로드 실패");
        return;
      }
      const data = await res.json();
      onChange({ attachment_url: data.url, attachment_name: data.name });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemove = () => {
    if (!confirm("첨부파일을 제거하시겠습니까?")) return;
    onChange({ attachment_url: null, attachment_name: null });
  };

  return (
    <div className={styles.attachmentWrap}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handlePick}
        className={styles.fileInput}
        disabled={disabled || uploading}
      />
      {item.attachment_url ? (
        <div className={styles.attachmentRow}>
          <a
            href={buildHrDownloadUrl(item.attachment_url, item.attachment_name)}
            download={item.attachment_name ?? "경력증명서"}
            className={styles.attachmentLink}
          >
            📎 {item.attachment_name || "첨부파일 다운로드"}
          </a>
          {!disabled && (
            <>
              <button
                type="button"
                className={styles.attachmentBtn}
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "업로드 중..." : "교체"}
              </button>
              <button
                type="button"
                className={styles.attachmentBtnDanger}
                onClick={handleRemove}
              >
                제거
              </button>
            </>
          )}
        </div>
      ) : (
        !disabled && (
          <button
            type="button"
            className={styles.attachmentBtn}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "업로드 중..." : "📎 경력증명서 첨부 (이미지/PDF)"}
          </button>
        )
      )}
    </div>
  );
}

// 전화번호 자동 하이픈 — 010-XXXX-XXXX / 02-XXXX-XXXX 등
function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  // 서울 02 (10자리: 02-XXX-XXXX, 9~10자리: 02-XXXX-XXXX)
  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9)
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  // 휴대폰/일반 (010-XXXX-XXXX, 031-XXX-XXXX 등)
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length === 10)
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function PhoneField({
  value,
  onChange,
  placeholder = "010-0000-0000",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      className={styles.input}
      value={formatPhone(value)}
      onChange={(e) => onChange(formatPhone(e.target.value))}
      placeholder={placeholder}
      disabled={disabled}
      inputMode="numeric"
      autoComplete="off"
      maxLength={13}
    />
  );
}

function formatRrn(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

function RrnInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [reveal, setReveal] = useState(false);
  const backRef = useRef<HTMLInputElement>(null);

  const digits = value.replace(/\D/g, "");
  const front = digits.slice(0, 6);
  const back = digits.slice(6, 13);

  const updateFront = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 6);
    const next = d + back;
    onChange(formatRrn(next));
    // 6자리 다 채우면 뒷자리로 자동 포커스
    if (d.length === 6 && backRef.current) {
      backRef.current.focus();
    }
  };
  const updateBack = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 7);
    onChange(formatRrn(front + d));
  };

  return (
    <div className={styles.rrnWrap}>
      <input
        className={styles.rrnFront}
        type="text"
        value={front}
        onChange={(e) => updateFront(e.target.value)}
        placeholder="981027"
        disabled={disabled}
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
      />
      <span className={styles.rrnDash}>-</span>
      <input
        ref={backRef}
        className={styles.rrnBack}
        type={reveal ? "text" : "password"}
        value={back}
        onChange={(e) => updateBack(e.target.value)}
        placeholder="1******"
        disabled={disabled}
        inputMode="numeric"
        autoComplete="off"
        maxLength={7}
      />
      <button
        type="button"
        className={styles.rrnToggle}
        onClick={() => setReveal((v) => !v)}
        tabIndex={-1}
        aria-label={reveal ? "주민번호 숨기기" : "주민번호 보기"}
        title={reveal ? "숨기기" : "제대로 입력했나 확인"}
        disabled={disabled}
      >
        {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: {
    [K in Status]: { label: string; cls: string; icon: React.ReactNode };
  } = {
    draft: {
      label: "작성 중",
      cls: styles.badgeDraft,
      icon: <Save size={12} />,
    },
    submitted: {
      label: "승인 대기",
      cls: styles.badgeSubmitted,
      icon: <Clock size={12} />,
    },
    approved: {
      label: "승인 완료",
      cls: styles.badgeApproved,
      icon: <CheckCircle2 size={12} />,
    },
    rejected: {
      label: "반려",
      cls: styles.badgeRejected,
      icon: <XCircle size={12} />,
    },
  };
  const v = map[status];
  return (
    <span className={`${styles.badge} ${v.cls}`}>
      {v.icon}
      {v.label}
    </span>
  );
}
