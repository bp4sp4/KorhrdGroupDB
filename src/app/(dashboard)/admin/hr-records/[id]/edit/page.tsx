"use client";

import { useEffect, useRef, useState, use } from "react";
import Image from "next/image";
import Script from "next/script";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  EyeOff,
  Search,
  ArrowLeft,
} from "lucide-react";
import styles from "../../../../me/hr-record/page.module.css";
import adminStyles from "./admin.module.css";

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
  author_name?: string | null;
  author_email?: string | null;
}

function calcMonths(start?: string | null, end?: string | null): number {
  if (!start) return 0;
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

export default function AdminHrRecordEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [record, setRecord] = useState<Record>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 로드
  useEffect(() => {
    fetch(`/api/admin/hr-records/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.record) {
          setRecord({
            ...data.record,
            education: data.record.education ?? [],
            career: data.record.career ?? [],
            certificates: data.record.certificates ?? [],
          });
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const status: Status = record.status ?? "draft";

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

  // 프로필 사진 업로드 (admin endpoint)
  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "profile");
      const res = await fetch(`/api/admin/hr-records/${id}/upload`, {
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

  // 저장
  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...record };
      delete payload.id;
      delete payload.status;
      delete payload.author_name;
      delete payload.author_email;
      delete payload.reject_reason;

      const res = await fetch(`/api/admin/hr-records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "저장 실패" }));
        alert(err.error ?? "저장 실패");
        return;
      }
      alert("저장되었습니다.");
      router.push("/admin/hr-records");
    } finally {
      setSaving(false);
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
      <Script
        src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        strategy="lazyOnload"
      />

      {/* 헤더 */}
      <div className={styles.header}>
        <div className={adminStyles.headerLeft}>
          <button
            type="button"
            className={adminStyles.backBtn}
            onClick={() => router.push("/admin/hr-records")}
          >
            <ArrowLeft size={14} /> 목록
          </button>
          <h1 className={styles.title}>
            어드민 편집: {record.name_ko ?? record.author_name ?? "-"}
          </h1>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className={adminStyles.adminNotice}>
        ⚠️ 관리자 편집 모드입니다. 사용자의 인사기록카드를 직접 수정합니다.
        상태({STATUS_LABEL[status]})는 승인/반려 작업에서만 변경됩니다.
      </div>

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
              <div className={styles.profilePlaceholder}>사진 없음</div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFilePick}
              className={styles.fileInput}
              disabled={uploading}
            />
            <button
              type="button"
              className={styles.profileBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "업로드 중..." : "사진 선택"}
            </button>
          </div>

          <div className={styles.grid2}>
            <Field label="한글 이름">
              <input
                className={styles.input}
                value={record.name_ko ?? ""}
                onChange={(e) => update("name_ko", e.target.value)}
                placeholder="예) 홍길동"
              />
            </Field>
            <Field label="영문 이름">
              <input
                className={styles.input}
                value={record.name_en ?? ""}
                onChange={(e) => update("name_en", e.target.value)}
                placeholder="예) Hong Gil Dong"
              />
            </Field>
            <Field label="성별">
              <div className={styles.radioRow}>
                {(["male", "female"] as const).map((g) => (
                  <label key={g} className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="gender"
                      checked={record.gender === g}
                      onChange={() => update("gender", g)}
                    />
                    {g === "male" ? "남자" : "여자"}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="주민번호">
              <RrnInput
                value={record.rrn ?? ""}
                onChange={(v) => update("rrn", v)}
              />
            </Field>
            <Field label="생년월일">
              <DateField
                value={record.birth_date ?? ""}
                onChange={(v) => update("birth_date", v || null)}
                placeholder="19900101"
              />
            </Field>
            <Field label="입사일">
              <DateField
                value={record.joined_at ?? ""}
                onChange={(v) => update("joined_at", v || null)}
                placeholder="20250115"
              />
            </Field>
            <Field label="직장명">
              <input
                className={styles.input}
                value={record.company_name ?? ""}
                onChange={(e) => update("company_name", e.target.value)}
                placeholder="예) ㈜한평생그룹"
              />
            </Field>
            <Field label="휴대폰">
              <PhoneField
                value={record.phone ?? ""}
                onChange={(v) => update("phone", v)}
                placeholder="010-0000-0000"
              />
            </Field>
            <Field label="업무폰">
              <PhoneField
                value={record.work_phone ?? ""}
                onChange={(v) => update("work_phone", v)}
                placeholder="010-0000-0000 (선택)"
              />
            </Field>
            <Field label="이메일">
              <input
                type="email"
                className={styles.input}
                value={record.email ?? ""}
                onChange={(e) => update("email", e.target.value)}
                placeholder="이메일"
              />
            </Field>
            <Field label="직장주소" fullWidth>
              <AddressInput
                value={record.company_address ?? ""}
                onChange={(v) => update("company_address", v)}
              />
            </Field>
            <Field label="현주소" fullWidth>
              <AddressInput
                value={record.current_address ?? ""}
                onChange={(v) => update("current_address", v)}
              />
            </Field>
            <Field label="비상전화">
              <PhoneField
                value={record.emergency_phone ?? ""}
                onChange={(v) => update("emergency_phone", v)}
                placeholder="010-0000-0000"
              />
            </Field>
            <Field label="관계">
              <select
                className={styles.input}
                value={record.emergency_relation ?? ""}
                onChange={(e) => update("emergency_relation", e.target.value)}
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

        <h3 className={styles.subTitle}>급여 입금 계좌</h3>
        <div className={styles.grid3}>
          <Field label="은행명">
            <input
              className={styles.input}
              value={record.bank_name ?? ""}
              onChange={(e) => update("bank_name", e.target.value)}
              placeholder="예) 신한은행"
            />
          </Field>
          <Field label="계좌번호">
            <input
              className={styles.input}
              value={record.account_number ?? ""}
              onChange={(e) => update("account_number", e.target.value)}
              placeholder="000-0000-0000"
            />
          </Field>
          <Field label="예금주">
            <input
              className={styles.input}
              value={record.account_holder ?? ""}
              onChange={(e) => update("account_holder", e.target.value)}
              placeholder="본인 이름"
            />
          </Field>
        </div>
      </section>

      {/* 2. 학력사항 */}
      <section className={styles.section}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>2. 학력사항</h2>
          <button
            type="button"
            className={styles.addRowBtn}
            onClick={addEducation}
          >
            <Plus size={14} /> 학력 추가
          </button>
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
                  />
                </Field>
                <Field label="입학">
                  <YearMonthField
                    value={it.start ?? ""}
                    onChange={(v) => updateEducation(i, { start: v || null })}
                    placeholder="201003"
                  />
                </Field>
                <Field label="졸업">
                  <YearMonthField
                    value={it.end ?? ""}
                    onChange={(v) => updateEducation(i, { end: v || null })}
                    placeholder="201402"
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
                  />
                </Field>
                <Field label="전공">
                  <input
                    className={styles.input}
                    value={it.major ?? ""}
                    onChange={(e) =>
                      updateEducation(i, { major: e.target.value })
                    }
                  />
                </Field>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeEducation(i)}
                >
                  <Trash2 size={13} /> 행 삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. 경력사항 */}
      <section className={styles.section}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>3. 경력사항</h2>
          <button
            type="button"
            className={styles.addRowBtn}
            onClick={addCareer}
          >
            <Plus size={14} /> 경력 추가
          </button>
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
                  />
                </Field>
                <Field label="직위">
                  <input
                    className={styles.input}
                    value={it.position ?? ""}
                    onChange={(e) =>
                      updateCareer(i, { position: e.target.value })
                    }
                  />
                </Field>
                <Field label="해당업무" fullWidth>
                  <input
                    className={styles.input}
                    value={it.work ?? ""}
                    onChange={(e) => updateCareer(i, { work: e.target.value })}
                  />
                </Field>
                <Field label="시작">
                  <YearMonthField
                    value={it.start ?? ""}
                    onChange={(v) => updateCareer(i, { start: v || null })}
                    placeholder="202003"
                  />
                </Field>
                <Field label="종료">
                  <YearMonthField
                    value={it.end ?? ""}
                    onChange={(v) => updateCareer(i, { end: v || null })}
                    placeholder="202402"
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
                    onChange={(e) =>
                      updateCareer(i, { notes: e.target.value })
                    }
                  />
                </Field>
                <Field label="경력증명서" fullWidth>
                  <CareerAttachment
                    recordId={id}
                    item={it}
                    onChange={(patch) => updateCareer(i, patch)}
                  />
                </Field>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeCareer(i)}
                >
                  <Trash2 size={13} /> 행 삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. 자격사항 */}
      <section className={styles.section}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>4. 자격사항 및 교육수료</h2>
          <button
            type="button"
            className={styles.addRowBtn}
            onClick={addCert}
          >
            <Plus size={14} /> 자격 추가
          </button>
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
                  />
                </Field>
                <Field label="급수">
                  <input
                    className={styles.input}
                    value={it.grade ?? ""}
                    onChange={(e) => updateCert(i, { grade: e.target.value })}
                  />
                </Field>
                <Field label="자격증번호">
                  <input
                    className={styles.input}
                    value={it.number ?? ""}
                    onChange={(e) => updateCert(i, { number: e.target.value })}
                  />
                </Field>
                <Field label="취득일자">
                  <YearMonthField
                    value={it.issued_at ?? ""}
                    onChange={(v) => updateCert(i, { issued_at: v || null })}
                    placeholder="202305"
                  />
                </Field>
                <Field label="인가기관" fullWidth>
                  <input
                    className={styles.input}
                    value={it.issuer ?? ""}
                    onChange={(e) =>
                      updateCert(i, { issuer: e.target.value })
                    }
                  />
                </Field>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeCert(i)}
                >
                  <Trash2 size={13} /> 행 삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 푸터 */}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={() => router.push("/admin/hr-records")}
          disabled={saving}
        >
          취소
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={save}
          disabled={saving}
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}

const STATUS_LABEL: { [K in Status]: string } = {
  draft: "작성 중",
  submitted: "승인 대기",
  approved: "승인 완료",
  rejected: "반려",
};

// ─── 보조 컴포넌트 (me 페이지와 동일) ────────────────────────────────────

function Field({
  label,
  fullWidth,
  children,
}: {
  label: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`${styles.field} ${fullWidth ? styles.fieldFull : ""}`}>
      <label className={styles.label}>{label}</label>
      {children}
    </div>
  );
}

function AddressInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const handleSearch = () => {
    if (typeof window === "undefined" || !window.daum?.Postcode) {
      alert("주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        const base = data.roadAddress || data.address || "";
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
      />
      <button
        type="button"
        className={styles.addressBtn}
        onClick={handleSearch}
      >
        <Search size={14} /> 주소 검색
      </button>
    </div>
  );
}

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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      className={styles.input}
      value={formatDate(value)}
      onChange={(e) => onChange(formatDate(e.target.value))}
      placeholder={placeholder}
      inputMode="numeric"
      autoComplete="off"
      maxLength={10}
    />
  );
}

function formatYearMonth(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function YearMonthField({
  value,
  onChange,
  placeholder = "YYYY-MM",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const display = formatYearMonth(value);
  return (
    <input
      type="text"
      className={styles.input}
      value={display}
      onChange={(e) => onChange(formatYearMonth(e.target.value))}
      placeholder={placeholder}
      inputMode="numeric"
      autoComplete="off"
      maxLength={7}
    />
  );
}

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

function CareerAttachment({
  recordId,
  item,
  onChange,
}: {
  recordId: string;
  item: CareerItem;
  onChange: (patch: Partial<CareerItem>) => void;
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
      const res = await fetch(`/api/admin/hr-records/${recordId}/upload`, {
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
        disabled={uploading}
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
        </div>
      ) : (
        <button
          type="button"
          className={styles.attachmentBtn}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "업로드 중..." : "📎 경력증명서 첨부 (이미지/PDF)"}
        </button>
      )}
    </div>
  );
}

function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9)
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      className={styles.input}
      value={formatPhone(value)}
      onChange={(e) => onChange(formatPhone(e.target.value))}
      placeholder={placeholder}
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
}: {
  value: string;
  onChange: (v: string) => void;
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
        title={reveal ? "숨기기" : "확인"}
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
