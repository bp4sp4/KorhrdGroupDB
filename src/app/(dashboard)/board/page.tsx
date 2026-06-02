"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  MessageSquare,
} from "lucide-react";
import styles from "./page.module.css";

const CATEGORIES = ["공지", "일반", "인사", "행사"] as const;
const FILTERS = ["전체", ...CATEGORIES] as const;
const SEARCH_FIELDS = ["제목", "작성자", "내용"] as const;

interface PostRow {
  id: number;
  title: string;
  category: string;
  department: string | null;
  author_name: string;
  is_pinned: boolean;
  view_count: number;
  created_at: string;
  comment_count: number;
  attachment_count: number;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
function fmtViews(v: number) {
  return v.toLocaleString("ko-KR");
}

function pageWindow(current: number, total: number, span = 5): number[] {
  let start = Math.max(1, current - Math.floor(span / 2));
  const end = Math.min(total, start + span - 1);
  start = Math.max(1, end - span + 1);
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

export default function BoardPage() {
  const router = useRouter();

  const [items, setItems] = useState<PostRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [category, setCategory] = useState<(typeof FILTERS)[number]>("전체");
  const [q, setQ] = useState("");
  const [field, setField] = useState<(typeof SEARCH_FIELDS)[number]>("제목");
  const [draftQ, setDraftQ] = useState("");
  const [draftField, setDraftField] =
    useState<(typeof SEARCH_FIELDS)[number]>("제목");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        q,
        field,
      });
      if (category !== "전체") params.set("category", category);
      const res = await fetch(`/api/board?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setPageSize(data.pageSize ?? 10);
      }
    } finally {
      setLoading(false);
    }
  }, [page, q, field, category]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pinnedRows = items.filter((p) => p.is_pinned);
  const normalRows = items.filter((p) => !p.is_pinned);

  const runSearch = () => {
    setField(draftField);
    setQ(draftQ.trim());
    setPage(1);
  };
  const selectCategory = (c: (typeof FILTERS)[number]) => {
    setCategory(c);
    setPage(1);
  };

  return (
    <div className={styles.frame}>
      <div className={styles.pageHead}>
     
        <h1 className={styles.h1}>공지사항</h1>
        <p className={styles.sub}>
          회사의 주요 소식과 공지사항을 확인하실 수 있습니다.
        </p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          {FILTERS.map((c) => (
            <button
              key={c}
              onClick={() => selectCategory(c)}
              className={`${styles.tab} ${category === c ? styles.tabOn : ""}`}
              type="button"
            >
              {c}
            </button>
          ))}
        </div>
        <div className={styles.searchWrap}>
          <select
            className={styles.searchSel}
            value={draftField}
            onChange={(e) =>
              setDraftField(e.target.value as (typeof SEARCH_FIELDS)[number])
            }
          >
            {SEARCH_FIELDS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <div className={styles.searchBox}>
            <input
              className={styles.searchInput}
              placeholder="검색어 입력"
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
            <button className={styles.searchBtn} onClick={runSearch} type="button">
              <Search size={15} /> 검색
            </button>
          </div>
        </div>
      </div>

      <div className={styles.countRow}>
        전체 <b className={styles.countNum}>{total}</b>건
        {q ? <span className={styles.queryTag}>&apos;{q}&apos; 검색결과</span> : null}
        <span className={styles.pageInfo}>
          {page} / {totalPages} 페이지
        </span>
      </div>

      <table className={styles.table}>
        <colgroup>
          <col className={styles.colNo} />
          <col className={styles.colCat} />
          <col />
          <col className={styles.colAuthor} />
          <col className={styles.colDate} />
          <col className={styles.colViews} />
        </colgroup>
        <thead>
          <tr className={styles.thead}>
            <th className={styles.th}>번호</th>
            <th className={styles.th}>분류</th>
            <th className={`${styles.th} ${styles.thTitle}`}>제목</th>
            <th className={styles.th}>작성자</th>
            <th className={styles.th}>등록일</th>
            <th className={styles.th}>조회</th>
          </tr>
        </thead>
        <tbody>
          {pinnedRows.map((n, i) => (
            <tr
              key={n.id}
              className={`${styles.tr} ${styles.trPin}`}
              onClick={() => router.push(`/board/${n.id}`)}
            >
              <td className={styles.tdMuted}>
                {(page - 1) * pageSize + i + 1}
              </td>
              <td className={styles.td}>
                <span className={styles.catTag}>{n.category}</span>
              </td>
              <td className={`${styles.tdTitle} ${styles.tdTitleBold}`}>
                <span className={styles.titleWrap}>
                  <span className={styles.titleText}>{n.title}</span>
                  <RowMeta c={n.comment_count} a={n.attachment_count} />
                </span>
              </td>
              <td className={styles.tdMuted}>
                {n.author_name}
                {n.department && (
                  <span className={styles.deptLine}>{n.department}</span>
                )}
              </td>
              <td className={styles.tdMuted}>{fmtDate(n.created_at)}</td>
              <td className={styles.tdMuted}>{fmtViews(n.view_count)}</td>
            </tr>
          ))}
          {normalRows.map((n, i) => (
            <tr
              key={n.id}
              className={styles.tr}
              onClick={() => router.push(`/board/${n.id}`)}
            >
              <td className={styles.tdMuted}>
                {(page - 1) * pageSize + pinnedRows.length + i + 1}
              </td>
              <td className={styles.td}>
                <span className={styles.catTag}>{n.category}</span>
              </td>
              <td className={styles.tdTitle}>
                <span className={styles.titleWrap}>
                  <span className={styles.titleText}>{n.title}</span>
                  <RowMeta c={n.comment_count} a={n.attachment_count} />
                </span>
              </td>
              <td className={styles.tdMuted}>
                {n.author_name}
                {n.department && (
                  <span className={styles.deptLine}>{n.department}</span>
                )}
              </td>
              <td className={styles.tdMuted}>{fmtDate(n.created_at)}</td>
              <td className={styles.tdMuted}>{fmtViews(n.view_count)}</td>
            </tr>
          ))}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={6} className={styles.empty}>
                검색 결과가 없습니다.
              </td>
            </tr>
          )}
          {loading && (
            <tr>
              <td colSpan={6} className={styles.empty}>
                불러오는 중…
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className={styles.bottom}>
        <div className={styles.bottomSpacer} />
        <div className={styles.pager}>
          <button
            className={styles.pageArrow}
            disabled={page <= 1}
            onClick={() => setPage((v) => Math.max(1, v - 1))}
            type="button"
          >
            <ChevronLeft size={14} />
          </button>
          {pageWindow(page, totalPages).map((i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`${styles.pageNum} ${page === i ? styles.pageNumOn : ""}`}
              type="button"
            >
              {i}
            </button>
          ))}
          <button
            className={styles.pageArrow}
            disabled={page >= totalPages}
            onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
            type="button"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <button
          className={styles.writeBtn}
          onClick={() => router.push("/board/new")}
          type="button"
        >
          ＋ 글쓰기
        </button>
      </div>

    </div>
  );
}

function RowMeta({ c, a }: { c: number; a: number }) {
  if (!c && !a) return null;
  return (
    <span className={styles.rowMeta}>
      {c > 0 && (
        <span className={styles.rowMetaItem}>
          <MessageSquare size={12} />
          {c}
        </span>
      )}
      {a > 0 && (
        <span className={styles.rowMetaItem}>
          <Paperclip size={12} />
          {a}
        </span>
      )}
    </span>
  );
}
