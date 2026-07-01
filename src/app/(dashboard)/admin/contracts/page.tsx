"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

const TYPE_LABEL: Record<string, string> = {
  regular: "정규직",
  contract: "계약직",
  civil: "정규직(민간)",
  sales: "정규직(영업직)",
  privacy: "개인정보 동의서",
  ethics: "보안·윤리 서약서",
  nda: "비밀유지 서약서",
  pledge: "입사 서약서",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  pending_sign: "서명 대기",
  signed: "서명 완료",
  cancelled: "취소",
};

interface ContractItem {
  id: string;
  contract_type: string;
  status: string;
  employee_name: string;
  signed_at: string | null;
  created_at: string;
  pdf_path: string | null;
  employee_user_id: number | null;
}

export default function ContractsListPage() {
  const [items, setItems] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/contracts")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) setErr(d.error);
        else setItems(d.contracts ?? []);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr((e as Error).message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleDownload = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/contracts/${id}`);
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "다운로드 URL을 가져오지 못했습니다.");
        return;
      }
      if (!data.pdfSignedUrl) {
        alert("아직 서명 완료된 PDF가 없습니다.");
        return;
      }
      window.open(data.pdfSignedUrl, "_blank");
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !window.confirm(`${name} 의 계약서를 삭제할까요? 되돌릴 수 없습니다.`)
    )
      return;
    try {
      const res = await fetch(`/api/admin/contracts/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "삭제에 실패했습니다.");
        return;
      }
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>근로계약서 관리</h1>
          <p className={styles.sub}>
            관리자가 작성한 계약서를 관리하고, 서명 진행 상태를 확인합니다.
          </p>
        </div>
        <Link href="/admin/contracts/new" className={styles.btnPrimary}>
          + 신규 작성
        </Link>
      </div>

      {err && <div className={styles.error}>{err}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>양식</th>
              <th>근로자</th>
              <th>상태</th>
              <th>작성일</th>
              <th>서명일</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  불러오는 중…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  작성된 계약서가 없습니다.
                </td>
              </tr>
            ) : (
              items.map((c) => (
                <tr key={c.id}>
                  <td>{TYPE_LABEL[c.contract_type] ?? c.contract_type}</td>
                  <td className={styles.strong}>{c.employee_name}</td>
                  <td>
                    <span
                      className={`${styles.statusChip} ${
                        c.status === "signed"
                          ? styles.statusSigned
                          : c.status === "pending_sign"
                            ? styles.statusPending
                            : styles.statusDraft
                      }`}
                    >
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                  <td>{new Date(c.created_at).toLocaleDateString("ko-KR")}</td>
                  <td>
                    {c.signed_at
                      ? new Date(c.signed_at).toLocaleDateString("ko-KR")
                      : "-"}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      {c.status === "signed" && c.pdf_path && (
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => handleDownload(c.id)}
                        >
                          PDF 다운로드
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.actionDelBtn}
                        onClick={() => handleDelete(c.id, c.employee_name)}
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
