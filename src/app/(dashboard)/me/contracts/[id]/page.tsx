"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import styles from "./page.module.css";

// PDF.js + 캔버스는 SSR 불가 — 클라이언트 only
const PdfSignCanvas = dynamic(
  () => import("./_components/PdfSignCanvas"),
  { ssr: false, loading: () => <div className={styles.loading}>로딩…</div> },
);

const TYPE_LABEL: Record<string, string> = {
  regular: "정규직",
  contract: "계약직",
  civil: "민간",
  sales: "영업직",
};

interface ContractDetail {
  id: string;
  contract_type: string;
  status: string;
  employee_name: string;
  signed_at: string | null;
  pdf_path: string | null;
}

interface DrawingPage {
  pageNumber: number;
  drawingDataUrl: string;
}

export default function ContractSignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);
  const [stampUrl, setStampUrl] = useState<string | null>(null);
  const [drawings, setDrawings] = useState<DrawingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/me/contracts/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setErr(d.error);
          return;
        }
        setContract(d.contract);
        setTemplateUrl(d.templateUrl);
        setStampUrl(d.stampUrl);
      })
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    if (!contract) return;
    if (drawings.length === 0) {
      setErr("서명 또는 작성한 내용이 없습니다.");
      return;
    }
    if (!window.confirm("작성·서명한 내용을 제출하시겠습니까?")) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/me/contracts/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: drawings }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "제출에 실패했습니다.");
        return;
      }
      alert("제출되었습니다. 감사합니다.");
      router.push("/me/contracts");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className={styles.loading}>불러오는 중…</div>;
  if (err && !contract)
    return (
      <div className={styles.wrap}>
        <div className={styles.error}>{err}</div>
      </div>
    );
  if (!contract) return null;

  const isSigned = contract.status === "signed";

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.crumbs}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => router.push("/me/contracts")}
          >
            ← 목록
          </button>
          <span className={styles.typeBadge}>
            {TYPE_LABEL[contract.contract_type] ?? contract.contract_type}
          </span>
          <h1 className={styles.title}>{contract.employee_name} 근로계약서</h1>
        </div>
      </header>

      {err && <div className={styles.error}>{err}</div>}

      {isSigned && (
        <div className={styles.signedBanner}>
          ✅ 서명 완료된 계약서입니다. 수정할 수 없습니다.
        </div>
      )}

      {templateUrl && stampUrl && !isSigned ? (
        <PdfSignCanvas
          pdfUrl={templateUrl}
          stampUrl={stampUrl}
          onChange={setDrawings}
          onSubmit={handleSubmit}
          submitLabel={submitting ? "제출 중…" : "제출하기"}
          submitDisabled={submitting}
        />
      ) : !templateUrl ? (
        <div className={styles.error}>양식 PDF 경로를 찾을 수 없습니다.</div>
      ) : isSigned && contract.pdf_path ? (
        <div className={styles.signedNote}>
          서명 완료된 PDF는 관리자가 다운로드 가능합니다.
        </div>
      ) : null}
    </div>
  );
}
