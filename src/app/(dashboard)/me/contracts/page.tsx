"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type Tab = "all" | "pending" | "done";

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
}

export default function MyContractsPage() {
  const [items, setItems] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");

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

  const isDone = (s: string) => s === "signed";
  const isWaiting = (s: string) => s === "pending_sign" || s === "draft";

  const counts = useMemo(
    () => ({
      all: items.length,
      pending: items.filter((c) => isWaiting(c.status)).length,
      done: items.filter((c) => isDone(c.status)).length,
    }),
    [items],
  );

  const rows = useMemo(
    () =>
      items.filter((c) =>
        tab === "all"
          ? true
          : tab === "pending"
            ? isWaiting(c.status)
            : isDone(c.status),
      ),
    [items, tab],
  );

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "전체", count: counts.all },
    { key: "pending", label: "서명 대기", count: counts.pending },
    { key: "done", label: "완료", count: counts.done },
  ];

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

      {/* 탭 */}
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className={styles.tabCount}>{t.count}</span>
          </button>
        ))}
      </div>

      {err && <div className={styles.error}>{err}</div>}

      {loading ? (
        <div className={styles.empty}>불러오는 중…</div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>지정된 계약서가 없습니다.</div>
      ) : rows.length === 0 ? (
        <div className={styles.empty}>해당 상태의 계약서가 없습니다.</div>
      ) : (
        <ul className={styles.list}>
          {rows.map((c) => {
            const isPending = c.status === "pending_sign";
            const isSigned = c.status === "signed";
            const isDraft = c.status === "draft";
            const statusCls = isSigned
              ? styles.statusSigned
              : isPending
                ? styles.statusPending
                : isDraft
                  ? styles.statusDraft
                  : styles.statusCancelled;
            return (
              <li key={c.id} className={styles.item}>
                <div className={styles.itemLeft}>
                  <div className={styles.itemTop}>
                    <span className={styles.typeBadge}>
                      {TYPE_LABEL[c.contract_type] ?? c.contract_type}
                    </span>
                    <span className={`${styles.statusText} ${statusCls}`}>
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
