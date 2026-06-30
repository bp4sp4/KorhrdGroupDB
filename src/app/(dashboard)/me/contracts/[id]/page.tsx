"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import ContractEditor, {
  type WorkVariant,
} from "../_contract/ContractEditor";
import PledgeEditor, { type PledgeKind } from "../_contract/PledgeEditor";

const TYPE_LABEL: Record<string, string> = {
  regular: "정규직",
  contract: "계약직",
  civil: "민간",
  sales: "영업직",
  privacy: "개인정보 동의서",
  ethics: "보안·윤리 서약서",
  nda: "비밀유지 서약서",
  pledge: "입사 서약서",
};
const WORK_TYPES = new Set(["regular", "contract", "civil", "sales"]);
const PLEDGE_KINDS = new Set(["privacy", "ethics", "nda", "pledge"]);

interface ContractDetail {
  id: string;
  contract_type: string;
  status: string;
  employee_name: string;
  signed_at: string | null;
  pdf_path: string | null;
  form_data: Record<string, unknown> | null;
  signature: string | null;
}

export default function ContractSignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
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
      })
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className={styles.loading}>불러오는 중…</div>;
  if (err && !contract)
    return (
      <div className={styles.wrap}>
        <div className={styles.error}>{err}</div>
      </div>
    );
  if (!contract) return null;

  const initialForm = {
    ...((contract.form_data ?? {}) as Record<string, unknown>),
    employeeName:
      (contract.form_data?.employeeName as string) || contract.employee_name,
  };
  const onBack = () => router.push("/me/contracts");

  // 근로계약서 4종 — 폼+미리보기 에디터 (전체화면)
  if (WORK_TYPES.has(contract.contract_type)) {
    return (
      <ContractEditor
        variant={contract.contract_type as WorkVariant}
        mode="assigned"
        contractId={id}
        initialForm={initialForm as never}
        initialSignature={contract.signature}
        readOnly={false}
        headerTitle={`${contract.employee_name} 근로계약서`}
        headerBadge={TYPE_LABEL[contract.contract_type]}
        onBack={onBack}
      />
    );
  }

  // 서약서·동의서 4종 — 폼+미리보기 에디터 (전체화면)
  if (PLEDGE_KINDS.has(contract.contract_type)) {
    return (
      <PledgeEditor
        kind={contract.contract_type as PledgeKind}
        contractId={id}
        initialForm={initialForm as never}
        initialSignature={contract.signature}
        readOnly={false}
        headerTitle={`${contract.employee_name} ${TYPE_LABEL[contract.contract_type] ?? "서약서"}`}
        headerBadge={TYPE_LABEL[contract.contract_type]}
        onBack={onBack}
      />
    );
  }

  // 알 수 없는 양식
  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.crumbs}>
          <button type="button" className={styles.backBtn} onClick={onBack}>
            ← 목록
          </button>
          <h1 className={styles.title}>{contract.employee_name} 전자계약</h1>
        </div>
      </header>
      <div className={styles.error}>지원하지 않는 양식입니다.</div>
    </div>
  );
}
