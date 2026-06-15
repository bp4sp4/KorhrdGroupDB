"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import styles from "./page.module.css";

// ─── 타입 ──────────────────────────────────────────────────────────
interface Applicant {
  id: number;
  seq_no: number | null;
  name: string;
  contact: string | null;
  birth_date: string | null;
  address: string | null;
  desired_date: string | null;
  practice_type: string | null;
  desired_weekday: string | null;
  recognition_period: string | null;
  training_center: string | null;
  field_institution: string | null;
  status: string;
  counsel_content: string | null;
  amount: number | null;
  manager: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = ["입금완료", "추후진행예정", "재연계"] as const;

const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  입금완료: { background: "#E7F7EE", color: "#1A9E5E" },
  추후진행예정: { background: "#FFF6E5", color: "#C77700" },
  재연계: { background: "#EAF2FF", color: "#2563EB" },
};

// 편집 폼 필드 정의 (상담내용/상태/금액은 별도 렌더)
const FORM_FIELDS: { key: keyof Applicant; label: string; type?: "number" }[] = [
  { key: "seq_no", label: "번호", type: "number" },
  { key: "name", label: "이름" },
  { key: "contact", label: "연락처" },
  { key: "birth_date", label: "생년월일" },
  { key: "address", label: "주소" },
  { key: "desired_date", label: "희망날짜" },
  { key: "practice_type", label: "실습종류" },
  { key: "desired_weekday", label: "희망요일" },
  { key: "recognition_period", label: "인정기간" },
  { key: "training_center", label: "실습교육원" },
  { key: "field_institution", label: "현장실습기관" },
  { key: "manager", label: "담당자" },
];

function fmtAmount(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${v.toLocaleString("ko-KR")}원`;
}

export default function PracticeApplicantsPage() {
  const [rows, setRows] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("전체");
  const [editing, setEditing] = useState<Applicant | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/practice-applicants");
      const d = await res.json();
      if (res.ok) setRows(d.rows ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // 상태별 카운트
  const counts = useMemo(() => {
    const c: Record<string, number> = { 전체: rows.length };
    for (const s of STATUS_OPTIONS) c[s] = 0;
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  // 검색 + 상태 필터
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "전체" && r.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        r.name,
        r.contact,
        r.field_institution,
        r.training_center,
        r.practice_type,
        r.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, statusFilter]);

  // 상태 빠른 변경
  const handleStatusChange = async (id: number, status: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r)),
    );
    const res = await fetch("/api/practice-applicants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, patch: { status } }),
    });
    if (!res.ok) {
      await fetchRows();
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "상태 변경 실패");
    }
  };

  // 상세 저장
  const handleSave = async (id: number, patch: Partial<Applicant>) => {
    const res = await fetch("/api/practice-applicants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, patch }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(d.error ?? "저장 실패");
      return false;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? (d.row as Applicant) : r)));
    return true;
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 신청자를 삭제할까요?")) return;
    const res = await fetch(`/api/practice-applicants?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      setEditing(null);
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "삭제 실패");
    }
  };

  return (
    <div className={styles.wrap}>
      {/* 헤더 */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>실습신청자</h1>
          <span className={styles.subtitle}>
            전체 {counts["전체"]}명 · 입금완료 {counts["입금완료"] ?? 0} · 추후진행예정{" "}
            {counts["추후진행예정"] ?? 0} · 재연계 {counts["재연계"] ?? 0}
          </span>
        </div>
        <div className={styles.headerRight}>
          <input
            className={styles.search}
            placeholder="이름·연락처·기관 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 상태 필터 칩 */}
      <div className={styles.filterChips}>
        {(["전체", ...STATUS_OPTIONS] as string[]).map((s) => (
          <button
            key={s}
            type="button"
            className={`${styles.chip} ${statusFilter === s ? styles.chipActive : ""}`}
            onClick={() => setStatusFilter(s)}
          >
            {s}
            <span className={styles.chipCount}>{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>번호</th>
              <th>이름</th>
              <th>연락처</th>
              <th>생년월일</th>
              <th>주소</th>
              <th>희망날짜</th>
              <th>실습종류</th>
              <th>희망요일</th>
              <th>인정기간</th>
              <th>실습교육원</th>
              <th>현장실습기관</th>
              <th>상태</th>
              <th>결제금액</th>
              <th>상담내용</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={14} className={styles.empty}>
                  불러오는 중…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={14} className={styles.empty}>
                  데이터가 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => (
                <tr
                  key={r.id}
                  className={styles.row}
                  onClick={() => setEditing(r)}
                >
                  <td className={styles.cellNum}>{r.seq_no ?? i + 1}</td>
                  <td className={styles.cellName}>{r.name}</td>
                  <td>{r.contact ?? "—"}</td>
                  <td>{r.birth_date ?? "—"}</td>
                  <td className={styles.cellWide} title={r.address ?? ""}>
                    {r.address ?? "—"}
                  </td>
                  <td>{r.desired_date ?? "—"}</td>
                  <td>{r.practice_type ?? "—"}</td>
                  <td>{r.desired_weekday ?? "—"}</td>
                  <td>{r.recognition_period ?? "—"}</td>
                  <td>{r.training_center ?? "—"}</td>
                  <td>{r.field_institution ?? "—"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select
                      className={styles.statusSelect}
                      value={r.status}
                      style={{
                        background: STATUS_STYLE[r.status]?.background,
                        color: STATUS_STYLE[r.status]?.color,
                      }}
                      onChange={(e) => handleStatusChange(r.id, e.target.value)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={styles.cellAmount}>{fmtAmount(r.amount)}</td>
                  <td className={styles.cellMemo} title={r.counsel_content ?? ""}>
                    {r.counsel_content ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <DetailModal
          row={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ─── 상세/편집 모달 ─────────────────────────────────────────────────
function DetailModal({
  row,
  onClose,
  onSave,
  onDelete,
}: {
  row: Applicant;
  onClose: () => void;
  onSave: (id: number, patch: Partial<Applicant>) => Promise<boolean>;
  onDelete: (id: number) => void;
}) {
  const [form, setForm] = useState<Applicant>(row);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof Applicant, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setSaving(true);
    try {
      const patch: Partial<Applicant> = {
        seq_no: form.seq_no === null ? null : Number(form.seq_no),
        name: form.name,
        contact: form.contact,
        birth_date: form.birth_date,
        address: form.address,
        desired_date: form.desired_date,
        practice_type: form.practice_type,
        desired_weekday: form.desired_weekday,
        recognition_period: form.recognition_period,
        training_center: form.training_center,
        field_institution: form.field_institution,
        manager: form.manager,
        status: form.status,
        amount:
          form.amount === null || (form.amount as unknown as string) === ""
            ? null
            : Number(form.amount),
        counsel_content: form.counsel_content,
      };
      const ok = await onSave(row.id, patch);
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2>{form.name || "실습신청자"} 상세</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.grid}>
            {FORM_FIELDS.map((f) => (
              <label key={f.key} className={styles.field}>
                <span>{f.label}</span>
                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={(form[f.key] as string | number | null) ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </label>
            ))}

            <label className={styles.field}>
              <span>상태</span>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>결제금액</span>
              <input
                type="number"
                value={form.amount ?? ""}
                onChange={(e) => set("amount", e.target.value)}
              />
            </label>
          </div>

          <label className={`${styles.field} ${styles.fieldFull}`}>
            <span>상담내용</span>
            <textarea
              rows={5}
              value={form.counsel_content ?? ""}
              onChange={(e) => set("counsel_content", e.target.value)}
            />
          </label>
        </div>

        <div className={styles.modalFoot}>
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={() => onDelete(row.id)}
          >
            삭제
          </button>
          <div className={styles.footRight}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              취소
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={submit}
              disabled={saving}
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
