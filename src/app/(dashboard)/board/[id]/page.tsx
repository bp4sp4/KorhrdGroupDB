"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Paperclip, Download, Send, Trash2 } from "lucide-react";
import styles from "./page.module.css";

const CATEGORIES = ["공지", "일반", "인사", "행사"] as const;

interface Attachment {
  name: string;
  path: string;
  size: number;
  type: string;
  url: string | null;
}
interface Post {
  id: number;
  title: string;
  content: string;
  category: string;
  department: string | null;
  author_id: number | null;
  author_name: string;
  is_pinned: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  attachments: Attachment[];
}
interface Comment {
  id: number;
  content: string;
  author_id: number | null;
  author_name: string;
  created_at: string;
  can_delete: boolean;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}
function fmtViews(v: number) {
  return v.toLocaleString("ko-KR");
}
function fmtSize(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  if (n >= 1024) return `${Math.round(n / 1024)}KB`;
  return `${n}B`;
}

export default function BoardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCat, setEditCat] = useState<(typeof CATEGORIES)[number]>("일반");
  const [editDept, setEditDept] = useState("");
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [editPinned, setEditPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (countView = false) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/board/${id}${countView ? "?view=1" : ""}`,
        );
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        if (res.ok) {
          setPost(data.post);
          setComments(data.comments ?? []);
          setCanEdit(!!data.can_edit);
          setIsAdmin(!!data.me?.is_admin);
        }
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  // 최초 1회만 조회수 증가 (StrictMode 이중 실행/재로딩 방지)
  const viewedRef = useRef(false);
  useEffect(() => {
    const first = !viewedRef.current;
    viewedRef.current = true;
    void load(first);
  }, [load]);

  const startEdit = async () => {
    if (!post) return;
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditCat((CATEGORIES as readonly string[]).includes(post.category)
      ? (post.category as (typeof CATEGORIES)[number])
      : "일반");
    setEditDept(post.department ?? "");
    setEditPinned(post.is_pinned);
    setEditing(true);
    if (departments.length === 0) {
      try {
        const res = await fetch("/api/board/options");
        const data = await res.json();
        if (res.ok) setDepartments(data.departments ?? []);
      } catch {
        /* ignore */
      }
    }
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) return alert("제목을 입력하세요.");
    setSaving(true);
    try {
      const res = await fetch(`/api/board/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent,
          category: editCat,
          department: editDept || null,
          is_pinned: editPinned,
        }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error ?? "수정 실패");
      setEditing(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const removePost = async () => {
    if (!confirm("이 게시글을 삭제할까요?")) return;
    const res = await fetch(`/api/board/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/board");
    else alert("삭제 실패");
  };

  const addComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/board/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        setCommentText("");
        await load();
      } else {
        const d = await res.json();
        alert(d.error ?? "댓글 등록 실패");
      }
    } finally {
      setPosting(false);
    }
  };

  const removeComment = async (cid: number) => {
    if (!confirm("댓글을 삭제할까요?")) return;
    const res = await fetch(`/api/board/comments/${cid}`, { method: "DELETE" });
    if (res.ok) await load();
    else alert("삭제 실패");
  };

  if (loading) return <div className={styles.state}>불러오는 중…</div>;
  if (notFound || !post)
    return (
      <div className={styles.state}>
        게시글을 찾을 수 없습니다.
        <button className={styles.btnList} onClick={() => router.push("/board")}>
          목록
        </button>
      </div>
    );

  return (
    <div className={styles.frame}>
      <div className={styles.pageHead}>
    
        <h1 className={styles.h1}>공지사항</h1>
      </div>

      <div className={styles.detail}>
        {editing ? (
          <div className={styles.editBox}>
            <div className={styles.editRow2}>
              <label className={styles.fieldCol}>
                <span className={styles.fieldLabel}>분류</span>
                <select
                  className={styles.fieldInput}
                  value={editCat}
                  onChange={(e) =>
                    setEditCat(e.target.value as (typeof CATEGORIES)[number])
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
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
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
            {isAdmin && (
              <label className={styles.pinCheck}>
                <input
                  type="checkbox"
                  checked={editPinned}
                  onChange={(e) => setEditPinned(e.target.checked)}
                />
                <span>상단에 고정 (공지)</span>
              </label>
            )}
            <label className={styles.fieldCol}>
              <span className={styles.fieldLabel}>제목</span>
              <input
                className={styles.fieldInput}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={200}
              />
            </label>
            <label className={styles.fieldCol}>
              <span className={styles.fieldLabel}>내용</span>
              <textarea
                className={styles.fieldTextarea}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            </label>
            <div className={styles.editFoot}>
              <button
                className={styles.btnList}
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                취소
              </button>
              <button
                className={styles.btnPrimary}
                onClick={saveEdit}
                disabled={saving}
              >
                {saving ? "저장 중…" : "수정 완료"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.detailHead}>
              {post.is_pinned && <span className={styles.pinBadge}>공지</span>}
              {!(post.is_pinned && post.category === "공지") && (
                <span className={styles.catTag}>{post.category}</span>
              )}
              <h2 className={styles.detailTitle}>{post.title}</h2>
            </div>
            <div className={styles.detailMeta}>
              <span>
                작성자 <b className={styles.metaStrong}>{post.author_name}</b>
              </span>
              {post.department && <span>부서 {post.department}</span>}
              <span>등록일 {fmtDate(post.created_at)}</span>
              <span>조회 {fmtViews(post.view_count)}</span>
            </div>

            <div className={styles.detailBody}>
              {(post.content || "(내용 없음)").split("\n\n").map((para, i) => (
                <p key={i} className={styles.para}>
                  {para}
                </p>
              ))}
            </div>

            {post.attachments.length > 0 && (
              <div className={styles.attachments}>
                <div className={styles.attachHead}>
                  <Paperclip size={14} /> 첨부파일 {post.attachments.length}
                </div>
                <ul className={styles.attachList}>
                  {post.attachments.map((a, i) => (
                    <li key={i} className={styles.attachItem}>
                      <Paperclip size={13} />
                      <span className={styles.attachName}>{a.name}</span>
                      <span className={styles.attachSize}>
                        {fmtSize(a.size)}
                      </span>
                      {a.url && (
                        <a
                          href={a.url}
                          className={styles.downloadBtn}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={a.name}
                        >
                          <Download size={14} />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.detailActions}>
              <button
                className={styles.btnList}
                onClick={() => router.push("/board")}
              >
                목록
              </button>
              {canEdit && (
                <div className={styles.actionRight}>
                  <button className={styles.btnEdit} onClick={startEdit}>
                    수정
                  </button>
                  <button className={styles.btnDel} onClick={removePost}>
                    삭제
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* 댓글 */}
        <section className={styles.commentSection}>
          <h3 className={styles.commentTitle}>댓글 {comments.length}</h3>
          <div className={styles.commentInputRow}>
            <textarea
              className={styles.commentInput}
              placeholder="댓글을 입력하세요"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={2}
            />
            <button
              className={styles.commentBtn}
              onClick={addComment}
              disabled={posting || !commentText.trim()}
            >
              <Send size={15} />
              등록
            </button>
          </div>
          <ul className={styles.commentList}>
            {comments.length === 0 && (
              <li className={styles.noComment}>첫 댓글을 남겨보세요.</li>
            )}
            {comments.map((c) => (
              <li key={c.id} className={styles.commentItem}>
                <div className={styles.commentMeta}>
                  <span className={styles.commentAuthor}>{c.author_name}</span>
                  <span className={styles.commentDate}>
                    {fmtDateTime(c.created_at)}
                  </span>
                  {c.can_delete && (
                    <button
                      className={styles.commentDel}
                      onClick={() => removeComment(c.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className={styles.commentBody}>{c.content}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
