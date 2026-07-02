"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import JSZip from "jszip";
import {
  Search,
  Download,
  Trash2,
  Plus,
  ChevronDown,
  MoreVertical,
  RefreshCw,
  X,
} from "lucide-react";
import ContractEditor, {
  type WorkVariant,
  type ContractForm,
} from "@/app/(dashboard)/me/contracts/_contract/ContractEditor";
import PledgeEditor, {
  type PledgeKind,
} from "@/app/(dashboard)/me/contracts/_contract/PledgeEditor";
import { buildContractPdf } from "@/app/(dashboard)/me/contracts/_contract/pdf";
import editorStyles from "@/app/(dashboard)/me/contracts/write/page.module.css";
import styles from "./page.module.css";

const WORK_TYPES = new Set(["regular", "contract", "civil", "sales"]);

interface FullContract {
  id: string;
  contract_type: string;
  employee_name: string;
  form_data: Record<string, unknown> | null;
  signature: string | null;
}

// 화면 뒤에서 계약서 문서를 렌더링해 재생성 PDF 를 만들기 위한 숨김 호스트.
// 저장 PDF 가 아니라 최신 페이지분할 엔진으로 다시 그린 문서를 담는다.
function BulkDocRenderer({
  contract,
  onReady,
}: {
  contract: FullContract;
  onReady: (docEl: HTMLElement, contract: FullContract) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await (
          document as Document & { fonts?: { ready?: Promise<unknown> } }
        ).fonts?.ready;
      } catch {
        /* noop */
      }
      await new Promise((r) => setTimeout(r, 80));
      const root = wrapRef.current;
      if (!root) return;
      const docEl = root.querySelector("#contract-doc") as HTMLElement | null;
      if (!docEl) return;
      const imgs = Array.from(docEl.querySelectorAll("img"));
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((res) => {
                img.onload = () => res(null);
                img.onerror = () => res(null);
              }),
        ),
      );
      await new Promise((r) => setTimeout(r, 40));
      if (!cancelled) onReady(docEl, contract);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [contract, onReady]);

  const isWork = WORK_TYPES.has(contract.contract_type);
  return (
    <div ref={wrapRef} className={styles.bulkRenderHost} aria-hidden>
      {isWork ? (
        <ContractEditor
          variant={contract.contract_type as WorkVariant}
          mode="assigned"
          preview
          initialForm={(contract.form_data ?? {}) as Partial<ContractForm>}
          initialSignature={contract.signature}
        />
      ) : (
        <PledgeEditor
          kind={contract.contract_type as PledgeKind}
          contractId={contract.id}
          readOnly
          initialForm={(contract.form_data ?? {}) as never}
          initialSignature={contract.signature}
        />
      )}
    </div>
  );
}

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
  department: string;
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "signed"
      ? styles.badgeDone
      : status === "pending_sign"
        ? styles.badgeWait
        : status === "cancelled"
          ? styles.badgeCancel
          : styles.badgeDraft;
  return (
    <span className={`${styles.badge} ${cls}`}>
      <span className={styles.badgeDot} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ko-KR");
}

export default function ContractsListPage() {
  const [items, setItems] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  // 필터 상태
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [workerFilter, setWorkerFilter] = useState<string>("all");
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // 일괄 다운로드 — 화면 뒤에서 순차 재생성 → zip
  const [bulkQueue, setBulkQueue] = useState<FullContract[]>([]);
  const [bulkPos, setBulkPos] = useState<number>(-1);
  const zipRef = useRef<JSZip | null>(null);
  const usedNamesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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

  const cntAll = items.length;
  const cntWait = items.filter((r) => r.status === "pending_sign").length;
  const cntDone = items.filter((r) => r.status === "signed").length;

  // 부서 → 근로자 트리
  const tree = useMemo(() => {
    const depts = Array.from(new Set(items.map((r) => r.department)));
    return depts
      .sort((a, b) => a.localeCompare(b, "ko"))
      .map((dn) => {
        const drows = items.filter((r) => r.department === dn);
        const workers = Array.from(
          new Set(drows.map((r) => r.employee_name)),
        )
          .sort((a, b) => a.localeCompare(b, "ko"))
          .map((wn) => ({
            name: wn,
            count: drows.filter((r) => r.employee_name === wn).length,
          }));
        return { name: dn, count: drows.length, workers };
      });
  }, [items]);

  const rows = useMemo(() => {
    const q = search.trim();
    return items.filter(
      (r) =>
        (statusFilter === "all" || r.status === statusFilter) &&
        (deptFilter === "all" || r.department === deptFilter) &&
        (workerFilter === "all" || r.employee_name === workerFilter) &&
        (q === "" ||
          `${TYPE_LABEL[r.contract_type] ?? r.contract_type}${r.employee_name}${r.department}`.includes(
            q,
          )),
    );
  }, [items, search, statusFilter, deptFilter, workerFilter]);

  const selIds = Object.keys(sel).filter((k) => sel[k]);
  const selCount = selIds.length;
  const allSel = rows.length > 0 && rows.every((r) => sel[r.id]);

  const toggleRow = (id: string) =>
    setSel((s) => {
      const n = { ...s };
      if (n[id]) delete n[id];
      else n[id] = true;
      return n;
    });
  const toggleAll = () => {
    if (allSel) setSel({});
    else setSel(Object.fromEntries(rows.map((r) => [r.id, true])));
  };

  const chips: { label: string; clear: () => void }[] = [];
  if (statusFilter !== "all")
    chips.push({
      label: `상태 · ${STATUS_LABEL[statusFilter] ?? statusFilter}`,
      clear: () => setStatusFilter("all"),
    });
  if (deptFilter !== "all")
    chips.push({
      label: `부서 · ${deptFilter}`,
      clear: () => {
        setDeptFilter("all");
        setWorkerFilter("all");
      },
    });
  if (workerFilter !== "all")
    chips.push({
      label: `근로자 · ${workerFilter}`,
      clear: () => setWorkerFilter("all"),
    });
  if (search.trim())
    chips.push({ label: `검색 · ${search.trim()}`, clear: () => setSearch("") });
  const resetAll = () => {
    setStatusFilter("all");
    setDeptFilter("all");
    setWorkerFilter("all");
    setSearch("");
  };

  const deleteOne = async (id: string) => {
    const res = await fetch(`/api/admin/contracts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error ?? "삭제에 실패했습니다.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`${name} 의 계약서를 삭제할까요? 되돌릴 수 없습니다.`))
      return;
    try {
      await deleteOne(id);
      setSel((s) => {
        const n = { ...s };
        delete n[id];
        return n;
      });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  // 선택 건 중 서명 완료(다운로드 가능) 개수
  const selDownloadable = selIds.filter(
    (id) => items.find((r) => r.id === id)?.status === "signed",
  );

  const TYPE_FILE_LABEL: Record<string, string> = TYPE_LABEL;

  // 문서 1건 렌더 완료 → 재생성 PDF 를 zip 에 추가하고 다음으로
  const handleDocReady = useCallback(
    async (docEl: HTMLElement, c: FullContract) => {
      try {
        const pdf = await buildContractPdf(docEl, editorStyles.pdfClean);
        const label = TYPE_FILE_LABEL[c.contract_type] ?? c.contract_type;
        const baseName = (c.employee_name || "계약서").trim();
        let name = `${baseName}_${label}.pdf`;
        let n = 2;
        while (usedNamesRef.current.has(name)) {
          name = `${baseName}_${label}_${n}.pdf`;
          n += 1;
        }
        usedNamesRef.current.add(name);
        zipRef.current?.file(name, pdf.output("arraybuffer"));
      } catch (e) {
        console.error("일괄 다운로드 렌더 실패", c.id, e);
      }
      setBulkPos((p) => p + 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // 큐 소진 → zip 생성·다운로드
  useEffect(() => {
    if (bulkPos < 0 || bulkQueue.length === 0 || bulkPos < bulkQueue.length)
      return;
    (async () => {
      const zip = zipRef.current;
      if (zip) {
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `근로계약서_${bulkQueue.length}건.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      zipRef.current = null;
      usedNamesRef.current = new Set();
      setBulkQueue([]);
      setBulkPos(-1);
      setDownloading(false);
    })();
  }, [bulkPos, bulkQueue]);

  const handleBulkDownload = async () => {
    if (selDownloadable.length === 0) {
      alert("선택 항목 중 서명 완료된 계약서가 없습니다.");
      return;
    }
    setDownloading(true);
    try {
      const results = await Promise.all(
        selDownloadable.map((id) =>
          fetch(`/api/admin/contracts/${id}`).then((r) =>
            r.ok ? r.json() : null,
          ),
        ),
      );
      const queue = results
        .filter((d): d is { contract: FullContract } => !!d?.contract)
        .map((d) => d.contract);
      if (queue.length === 0) {
        alert("다운로드할 계약서를 불러오지 못했습니다.");
        setDownloading(false);
        return;
      }
      zipRef.current = new JSZip();
      usedNamesRef.current = new Set();
      setBulkQueue(queue);
      setBulkPos(0);
    } catch (e) {
      alert((e as Error).message);
      setDownloading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selCount === 0) return;
    if (
      !window.confirm(
        `선택한 ${selCount}건의 계약서를 삭제할까요? 되돌릴 수 없습니다.`,
      )
    )
      return;
    try {
      for (const id of selIds) await deleteOne(id);
      setSel({});
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className={styles.wrap}>
      {/* 페이지 헤드 */}
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>근로계약서 관리</h1>
          <p className={styles.sub}>
            관리자가 작성한 계약서를 관리하고, 서명 진행 상태를 확인합니다.
          </p>
        </div>
        <Link href="/admin/contracts/new" className={styles.btnPrimary}>
          <Plus size={16} strokeWidth={2.4} />
          신규 작성
        </Link>
      </div>

      {err && <div className={styles.error}>{err}</div>}

      <div className={styles.layout}>
        {/* 좌측 필터 레일 */}
        <aside className={styles.rail}>
          <div className={styles.railLabel}>상태</div>
          <button
            className={`${styles.facet} ${statusFilter === "all" ? styles.facetActive : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            <span>전체</span>
            <span className={styles.facetCount}>{cntAll}</span>
          </button>
          <button
            className={`${styles.facet} ${statusFilter === "pending_sign" ? styles.facetActive : ""}`}
            onClick={() => setStatusFilter("pending_sign")}
          >
            <span>서명 대기</span>
            <span className={styles.facetCount}>{cntWait}</span>
          </button>
          <button
            className={`${styles.facet} ${statusFilter === "signed" ? styles.facetActive : ""}`}
            onClick={() => setStatusFilter("signed")}
          >
            <span>서명 완료</span>
            <span className={styles.facetCount}>{cntDone}</span>
          </button>

          <div className={styles.railDivider} />
          <div className={styles.railLabel}>부서 · 근로자</div>
          <button
            className={`${styles.facet} ${deptFilter === "all" ? styles.facetActive : ""}`}
            onClick={() => {
              setDeptFilter("all");
              setWorkerFilter("all");
            }}
          >
            <span>전체 부서</span>
            <span className={styles.facetCount}>{cntAll}</span>
          </button>
          {tree.map((g) => {
            const expanded = deptFilter === g.name;
            return (
              <div key={g.name}>
                <button
                  className={`${styles.deptHead} ${expanded ? styles.deptHeadActive : ""}`}
                  onClick={() => {
                    setDeptFilter(expanded ? "all" : g.name);
                    setWorkerFilter("all");
                  }}
                >
                  <span
                    className={`${styles.deptChevron} ${expanded ? "" : styles.deptChevronCollapsed}`}
                  >
                    <ChevronDown size={15} strokeWidth={2.2} />
                  </span>
                  <span className={styles.deptName}>{g.name}</span>
                  <span className={styles.facetCount}>{g.count}</span>
                </button>
                {expanded &&
                  g.workers.map((w) => {
                    const active =
                      deptFilter === g.name && workerFilter === w.name;
                    return (
                      <button
                        key={w.name}
                        className={`${styles.workRow} ${active ? styles.workRowActive : ""}`}
                        onClick={() => {
                          setDeptFilter(g.name);
                          setWorkerFilter(active ? "all" : w.name);
                        }}
                      >
                        <span className={styles.workName}>{w.name}</span>
                        <span className={styles.facetCount}>{w.count}</span>
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </aside>

        {/* 메인 테이블 */}
        <div className={styles.panel}>
          {/* 툴바 */}
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}>
                <Search size={16} />
              </span>
              <input
                className={styles.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="양식·근로자·부서 검색"
              />
            </div>
            <div className={styles.toolbarSpacer} />
            <span className={styles.toolbarCount}>{rows.length}건 표시</span>
          </div>

          {/* 적용된 필터 칩 */}
          {chips.length > 0 && (
            <div className={styles.chipBar}>
              <span className={styles.chipBarLabel}>적용된 필터</span>
              {chips.map((c, i) => (
                <span key={i} className={styles.chip}>
                  {c.label}
                  <button
                    className={styles.chipClear}
                    onClick={c.clear}
                    aria-label="필터 제거"
                  >
                    <X size={10} strokeWidth={3} />
                  </button>
                </span>
              ))}
              <button className={styles.chipReset} onClick={resetAll}>
                전체 초기화
              </button>
            </div>
          )}

          {/* 일괄 작업 바 */}
          {selCount > 0 && (
            <div className={styles.bulkBar}>
              <span className={styles.bulkCount}>{selCount}건 선택됨</span>
              <button
                className={styles.bulkAction}
                onClick={handleBulkDownload}
                disabled={downloading}
              >
                <Download size={14} />
                {downloading ? "다운로드 중…" : "일괄 다운로드"}
              </button>
              <button className={styles.bulkDanger} onClick={handleBulkDelete}>
                <Trash2 size={14} />
                일괄 삭제
              </button>
              <div className={styles.toolbarSpacer} />
              <button className={styles.bulkClear} onClick={() => setSel({})}>
                선택 해제
              </button>
            </div>
          )}

          {/* 헤더 */}
          <div className={`${styles.grid} ${styles.gridHead}`}>
            <div>
              <input
                type="checkbox"
                className={styles.check}
                checked={allSel}
                onChange={toggleAll}
              />
            </div>
            <div>양식</div>
            <div>근로자</div>
            <div>부서</div>
            <div>상태</div>
            <div>작성일</div>
            <div>서명일</div>
            <div />
          </div>

          {/* 행 */}
          {loading ? (
            <div className={styles.stateRow}>불러오는 중…</div>
          ) : rows.length === 0 ? (
            <div className={styles.stateRow}>조건에 맞는 계약서가 없습니다.</div>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className={`${styles.grid} ${styles.gridRow} ${sel[r.id] ? styles.gridRowSel : ""}`}
              >
                <div>
                  <input
                    type="checkbox"
                    className={styles.check}
                    checked={!!sel[r.id]}
                    onChange={() => toggleRow(r.id)}
                  />
                </div>
                <div className={styles.cellForm}>
                  {TYPE_LABEL[r.contract_type] ?? r.contract_type}
                </div>
                <div className={styles.cellWorker}>{r.employee_name}</div>
                <div className={styles.cellMuted}>{r.department}</div>
                <div>
                  <StatusBadge status={r.status} />
                </div>
                <div className={styles.cellMuted}>{fmtDate(r.created_at)}</div>
                <div className={styles.cellMuted}>
                  {r.status === "signed" ? fmtDate(r.signed_at) : "—"}
                </div>
                <div className={styles.cellActions}>
                  <button
                    className={styles.iconBtn}
                    title="관리"
                    onClick={() => setMenu(menu === r.id ? null : r.id)}
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menu === r.id && (
                    <>
                      <div
                        className={styles.menuScrim}
                        onClick={() => setMenu(null)}
                      />
                      <div className={styles.menu}>
                        {r.status === "signed" && (
                          <>
                            <a
                              href={`/api/admin/contracts/${r.id}/download`}
                              className={styles.menuItem}
                              onClick={() => setMenu(null)}
                            >
                              <Download size={15} />
                              PDF 다운로드
                            </a>
                            <Link
                              href={`/admin/contracts/${r.id}`}
                              className={styles.menuItem}
                              onClick={() => setMenu(null)}
                            >
                              <RefreshCw size={15} />
                              재생성
                            </Link>
                            <div className={styles.menuDivider} />
                          </>
                        )}
                        <button
                          className={`${styles.menuItem} ${styles.menuItemDanger}`}
                          onClick={() => {
                            setMenu(null);
                            handleDelete(r.id, r.employee_name);
                          }}
                        >
                          <Trash2 size={15} />
                          삭제
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          )}

          {/* 푸터 */}
          <div className={styles.footer}>
            <div className={styles.footerTotal}>
              총 <strong>{rows.length}</strong>건
            </div>
          </div>
        </div>
      </div>

      {/* 일괄 다운로드 — 화면 뒤 순차 재생성 (현재 1건만 마운트) */}
      {bulkPos >= 0 && bulkPos < bulkQueue.length && (
        <BulkDocRenderer
          key={`${bulkQueue[bulkPos].id}:${bulkPos}`}
          contract={bulkQueue[bulkPos]}
          onReady={handleDocReady}
        />
      )}
    </div>
  );
}
