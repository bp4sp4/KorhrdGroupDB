"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import ContractEditor, {
  type WorkVariant,
} from "../../../me/contracts/_contract/ContractEditor";
import PledgeEditor, {
  type PledgeKind,
} from "../../../me/contracts/_contract/PledgeEditor";

// 관리자 PDF 재생성 — 저장된 form_data/서명으로 문서를 다시 렌더링해
// "서명 후 저장" 시 PDF 를 새 페이지분할 엔진으로 재생성·교체한다.
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
const WORK_TYPES = new Set(["regular", "contract", "civil", "sales"]);
const PLEDGE_KINDS = new Set(["privacy", "ethics", "nda", "pledge"]);

interface ContractDetail {
  id: string;
  contract_type: string;
  status: string;
  employee_name: string;
  form_data: Record<string, unknown> | null;
  signature: string | null;
}

export default function AdminContractRegeneratePage({
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
    fetch(`/api/admin/contracts/${id}`)
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
  if (err || !contract)
    return (
      <div className={styles.wrap}>
        <div className={styles.error}>{err ?? "계약서를 찾을 수 없습니다."}</div>
      </div>
    );

  const initialForm = {
    ...((contract.form_data ?? {}) as Record<string, unknown>),
    employeeName:
      (contract.form_data?.employeeName as string) || contract.employee_name,
  };
  const onBack = () => router.push("/admin/contracts");
  const submitUrl = `/api/admin/contracts/${id}/regenerate-pdf`;

  if (WORK_TYPES.has(contract.contract_type)) {
    return (
      <ContractEditor
        variant={contract.contract_type as WorkVariant}
        mode="assigned"
        contractId={id}
        initialForm={initialForm as never}
        initialSignature={contract.signature}
        readOnly={false}
        viewFirst
        submitUrl={submitUrl}
        afterSavePath="/admin/contracts"
        headerTitle={`${contract.employee_name} 근로계약서 — PDF 재생성`}
        headerBadge={TYPE_LABEL[contract.contract_type]}
        onBack={onBack}
      />
    );
  }

  if (PLEDGE_KINDS.has(contract.contract_type)) {
    return (
      <PledgeEditor
        kind={contract.contract_type as PledgeKind}
        contractId={id}
        initialForm={initialForm as never}
        initialSignature={contract.signature}
        readOnly={false}
        submitUrl={submitUrl}
        afterSavePath="/admin/contracts"
        headerTitle={`${contract.employee_name} ${TYPE_LABEL[contract.contract_type] ?? "서약서"} — PDF 재생성`}
        headerBadge={TYPE_LABEL[contract.contract_type]}
        onBack={onBack}
      />
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.error}>지원하지 않는 양식입니다.</div>
    </div>
  );
}
