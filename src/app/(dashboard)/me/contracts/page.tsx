"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

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
}

export default function MyContractsPage() {
  const [items, setItems] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/contracts")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErr(d.error);
        else setItems(d.contracts ?? []);
      })
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div className={styles.headRow}>
          <h1 className={styles.title}>내 근로계약서</h1>
        </div>
        <p className={styles.sub}>
          관리자가 작성을 요청한 계약서 목록입니다. &quot;서명 대기&quot;인
          계약서를 눌러 작성·서명하세요.
        </p>
      </div>

      {err && <div className={styles.error}>{err}</div>}

      {loading ? (
        <div className={styles.empty}>불러오는 중…</div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>지정된 계약서가 없습니다.</div>
      ) : (
        <ul className={styles.list}>
          {items.map((c) => {
            const isPending = c.status === "pending_sign";
            const isSigned = c.status === "signed";
            const isDraft = c.status === "draft";
            return (
              <li key={c.id} className={styles.item}>
                <div className={styles.itemLeft}>
                  <div className={styles.itemTop}>
                    <span className={styles.typeBadge}>
                      {TYPE_LABEL[c.contract_type] ?? c.contract_type}
                    </span>
                    <span
                      className={`${styles.statusChip} ${
                        isSigned
                          ? styles.statusSigned
                          : isPending
                            ? styles.statusPending
                            : styles.statusDraft
                      }`}
                    >
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </div>
                  <div className={styles.itemName}>{c.employee_name}</div>
                  <div className={styles.itemMeta}>
                    작성 요청:{" "}
                    {new Date(c.created_at).toLocaleDateString("ko-KR")}
                    {c.signed_at && (
                      <>
                        {" · 서명 완료: "}
                        {new Date(c.signed_at).toLocaleDateString("ko-KR")}
                      </>
                    )}
                  </div>
                </div>
                <div className={styles.itemRight}>
                  {isPending && (
                    <Link
                      href={`/me/contracts/${c.id}`}
                      className={styles.btnPrimary}
                    >
                      작성·서명하기
                    </Link>
                  )}
                  {isDraft && (
                    <Link
                      href={`/me/contracts/${c.id}`}
                      className={styles.btnPrimary}
                    >
                      이어서 작성하기
                    </Link>
                  )}
                  {isSigned && (
                    <Link
                      href={`/me/contracts/${c.id}`}
                      className={styles.btnGhost}
                    >
                      보기·수정
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
