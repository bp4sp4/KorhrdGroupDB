"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  MessageSquare,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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

interface DraftAttachment {
  name: string;
  path: string;
  size: number;
  type: string;
  status: "uploading" | "done" | "error";
}

const MAX_SIZE = 25 * 1024 * 1024;

function fmtDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
function fmtViews(v: number) {
  return v.toLocaleString("ko-KR");
}
function fmtSize(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  if (n >= 1024) return `${Math.round(n / 1024)}KB`;
  return `${n}B`;
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
  const supabase = createClient();

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  // 글쓰기 모달
  const [writeOpen, setWriteOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("일반");
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [pinned, setPinned] = useState(false);
  const [atts, setAtts] = useState<DraftAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
        setIsAdmin(!!data.me?.is_admin);
      }
    } finally {
      setLoading(false);
    }
  }, [page, q, field, category]);

  useEffect(() => {
    void load();
  }, [load]);

  // 부서 목록은 글쓰기 모달 최초 오픈 시 1회 로드
  useEffect(() => {
    if (!writeOpen || departments.length > 0) return;
    void (async () => {
      try {
        const res = await fetch("/api/board/options");
        const data = await res.json();
        if (res.ok) {
          setDepartments(data.departments ?? []);
          if (data.myDepartment) setDepartment(data.myDepartment);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [writeOpen, departments.length]);

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

  const uploadFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      for (const file of list) {
        if (file.size > MAX_SIZE) {
          alert(`${file.name} 은(는) 25MB 를 초과합니다.`);
          continue;
        }
        const idx = atts.length;
        setAtts((prev) => [
          ...prev,
          {
            name: file.name,
            path: "",
            size: file.size,
            type: file.type,
            status: "uploading",
          },
        ]);
        void (async () => {
          try {
            const signRes = await fetch("/api/board/attachments/sign", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filename: file.name }),
            });
            const sign = await signRes.json();
            if (!signRes.ok || !sign.ok) throw new Error(sign.error ?? "sign");
            const up = await supabase.storage
              .from(sign.bucket)
              .uploadToSignedUrl(sign.path, sign.token, file, {
                contentType: file.type || "application/octet-stream",
              });
            if (up.error) throw up.error;
            setAtts((prev) =>
              prev.map((a, i) =>
                i === idx && a.status === "uploading"
                  ? { ...a, path: sign.path, status: "done" }
                  : a,
              ),
            );
          } catch {
            setAtts((prev) =>
              prev.map((a, i) => (i === idx ? { ...a, status: "error" } : a)),
            );
          }
        })();
      }
    },
    [atts.length, supabase],
  );

  const removeAtt = (i: number) =>
    setAtts((prev) => prev.filter((_, idx) => idx !== i));

  const resetWrite = () => {
    setTitle("");
    setContent("");
    setCat("일반");
    setPinned(false);
    setAtts([]);
  };

  const submit = async () => {
    if (!title.trim()) return alert("제목을 입력하세요.");
    if (!content.trim()) return alert("내용을 입력하세요.");
    if (atts.some((a) => a.status === "uploading"))
      return alert("첨부파일 업로드가 끝날 때까지 기다려주세요.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content,
          category: cat,
          department: department || null,
          is_pinned: pinned,
          attachments: atts
            .filter((a) => a.status === "done")
            .map((a) => ({
              name: a.name,
              path: a.path,
              size: a.size,
              type: a.type,
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error ?? "등록 실패");
      setWriteOpen(false);
      resetWrite();
      router.push(`/board/${data.id}`);
    } finally {
      setSubmitting(false);
    }
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
          onClick={() => setWriteOpen(true)}
          type="button"
        >
          ＋ 글쓰기
        </button>
      </div>

      {writeOpen && (
        <div
          className={styles.overlay}
          onMouseDown={() => !submitting && setWriteOpen(false)}
        >
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h3 className={styles.modalTitle}>새 공지 작성</h3>
              <button
                className={styles.modalClose}
                onClick={() => setWriteOpen(false)}
                type="button"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.row2}>
                <label className={styles.fieldCol}>
                  <span className={styles.fieldLabel}>분류</span>
                  <select
                    className={styles.fieldInput}
                    value={cat}
                    onChange={(e) =>
                      setCat(e.target.value as (typeof CATEGORIES)[number])
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.fieldCol}>
                  <span className={styles.fieldLabel}>작성자 / 부서</span>
                  <select
                    className={styles.fieldInput}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="">부서 선택</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={styles.fieldCol}>
                <span className={styles.fieldLabel}>제목</span>
                <input
                  className={styles.fieldInput}
                  placeholder="공지 제목을 입력하세요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                />
              </label>
              <label className={styles.fieldCol}>
                <span className={styles.fieldLabel}>내용</span>
                <textarea
                  className={styles.fieldTextarea}
                  placeholder="공지 내용을 입력하세요"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </label>

              {isAdmin && (
                <label className={styles.pinCheck}>
                  <input
                    type="checkbox"
                    checked={pinned}
                    onChange={(e) => setPinned(e.target.checked)}
                  />
                  <span>상단에 고정 (공지)</span>
                </label>
              )}

              <div
                className={`${styles.dropZone} ${dragOver ? styles.dropOver : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files?.length)
                    uploadFiles(e.dataTransfer.files);
                }}
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip size={15} />
                파일을 끌어다 놓거나 클릭해 첨부 (최대 25MB)
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.length) uploadFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
              {atts.length > 0 && (
                <ul className={styles.attList}>
                  {atts.map((a, i) => (
                    <li key={i} className={styles.attItem}>
                      <Paperclip size={13} />
                      <span className={styles.attName}>{a.name}</span>
                      <span className={styles.attSize}>{fmtSize(a.size)}</span>
                      {a.status === "uploading" && (
                        <span className={styles.attStatus}>업로드중…</span>
                      )}
                      {a.status === "error" && (
                        <span className={styles.attError}>실패</span>
                      )}
                      <button
                        type="button"
                        className={styles.attRemove}
                        onClick={() => removeAtt(i)}
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className={styles.modalFoot}>
              <button
                className={styles.btnGhost}
                onClick={() => setWriteOpen(false)}
                type="button"
                disabled={submitting}
              >
                취소
              </button>
              <button
                className={styles.btnPrimary}
                onClick={submit}
                type="button"
                disabled={submitting}
              >
                {submitting ? "등록 중…" : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}
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
