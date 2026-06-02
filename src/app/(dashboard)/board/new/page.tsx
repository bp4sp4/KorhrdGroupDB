"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

// MailEditor — 메일 작성에 쓰는 WYSIWYG 에디터 (브라우저 only)
const MailEditor = dynamic(
  () => import("@/app/(dashboard)/mail/_components/MailEditor"),
  {
    ssr: false,
    loading: () => (
      <div className={styles.editorLoading}>에디터 불러오는 중…</div>
    ),
  },
);

const CATEGORIES = ["공지", "일반", "인사", "행사"] as const;
type Category = (typeof CATEGORIES)[number];

const MAX_FILES = 5;
const MAX_TITLE = 100;
const MAX_SIZE = 25 * 1024 * 1024; // 25MB

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  status: "uploading" | "done" | "error";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function NoticeWritePage() {
  const router = useRouter();
  const supabase = createClient();

  const [category, setCategory] = useState<Category>("공지");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(true);
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState<
    { id: string; name: string }[]
  >([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  /* ----- 초기 로드 — 부서 옵션 + 본인 권한 ----- */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/board/options");
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setDepartments(data.departments ?? []);
          if (data.myDepartment) setDepartment(data.myDepartment);
        }
      } catch {
        /* ignore */
      }
      try {
        const meRes = await fetch("/api/board?page=1");
        const me = await meRes.json();
        if (cancelled || !meRes.ok) return;
        setIsAdmin(!!me.me?.is_admin);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ----- toast ----- */
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  /* ----- 분류 ----- */
  const pickCategory = (cat: Category) => {
    setCategory(cat);
    if (cat === "공지") setPinned(true);
  };

  /* ----- 첨부 — Supabase Storage 직접 업로드 ----- */
  const addFiles = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const incoming = Array.from(list);
      for (const file of incoming) {
        if (files.length + 1 > MAX_FILES) {
          showToast(`첨부파일은 최대 ${MAX_FILES}개까지 가능합니다.`);
          break;
        }
        if (file.size > MAX_SIZE) {
          showToast(`${file.name} 은(는) 25MB 를 초과합니다.`);
          continue;
        }
        const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
        setFiles((prev) => [
          ...prev,
          {
            id,
            name: file.name,
            size: file.size,
            type: file.type,
            path: "",
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
            setFiles((prev) =>
              prev.map((f) =>
                f.id === id ? { ...f, path: sign.path, status: "done" } : f,
              ),
            );
          } catch {
            setFiles((prev) =>
              prev.map((f) => (f.id === id ? { ...f, status: "error" } : f)),
            );
          }
        })();
      }
    },
    [files.length, supabase, showToast],
  );

  const removeFile = (id: string) =>
    setFiles((prev) => prev.filter((f) => f.id !== id));

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  /* ----- footer ----- */
  const handleCancel = () => {
    if (
      window.confirm(
        "작성을 취소하고 목록으로 이동할까요? 입력한 내용은 저장되지 않습니다.",
      )
    ) {
      router.push("/board");
    }
  };

  /* ----- MailEditor 빈 내용 판정 ----- */
  const isEditorEmpty = (html: string) => {
    const stripped = html
      .replace(/<br\s*\/?>/gi, "")
      .replace(/<p>\s*<\/p>/gi, "")
      .replace(/&nbsp;/gi, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    return stripped.length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast("제목을 입력해 주세요.");
      return;
    }
    if (isEditorEmpty(content)) {
      showToast("내용을 입력해 주세요.");
      return;
    }
    if (files.some((f) => f.status === "uploading")) {
      showToast("첨부파일 업로드가 끝날 때까지 기다려주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content,
          category,
          department: department || null,
          is_pinned: pinned,
          attachments: files
            .filter((f) => f.status === "done")
            .map((f) => ({
              name: f.name,
              path: f.path,
              size: f.size,
              type: f.type,
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "등록에 실패했습니다.");
        return;
      }
      showToast(`"${category}" 공지사항이 등록되었습니다.`);
      router.push(`/board/${data.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.nw}>
      {/* head */}
      <div>
        <h1 className={styles.title}>공지사항 작성</h1>
      </div>

      <form className={styles.form} autoComplete="off" onSubmit={handleSubmit}>
        {/* 분류 */}
        <section className={styles.field}>
          <div className={styles.fieldLabel}>
            분류 <span className={styles.req}>*</span>
          </div>
          <div className={styles.chips}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`${styles.chip} ${category === cat ? styles.chipOn : ""}`}
                onClick={() => pickCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* 작성자 / 부서 */}
        <section className={styles.field}>
          <div className={styles.fieldLabel}>작성자 / 부서</div>
          <select
            className={styles.select}
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
        </section>

        {/* 제목 */}
        <section className={styles.field}>
          <div className={styles.fieldLabel}>
            제목 <span className={styles.req}>*</span>
          </div>
          <div className={styles.titleRow}>
            <input
              type="text"
              className={`${styles.input} ${styles.titleInput}`}
              placeholder="제목을 입력해 주세요"
              maxLength={MAX_TITLE}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <span className={styles.titleCount}>
              <b>{title.length}</b> / {MAX_TITLE}
            </span>
          </div>
        </section>

        {/* 상단 고정 — master-admin 만 표시 */}
        {isAdmin && (
          <section className={styles.field}>
            <div className={styles.fieldLabel}>게시 옵션</div>
            <label className={styles.pinCard}>
              <span className={styles.switch}>
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                />
                <span className={styles.slider} />
              </span>
              <span className={styles.pinText}>
                <strong>상단 고정 (공지)</strong>
                <span>
                  목록 상단에 항상 노출되며 &lsquo;공지&rsquo; 라벨이
                  표시됩니다.
                </span>
              </span>
            </label>
          </section>
        )}

        {/* 내용 — MailEditor */}
        <section className={styles.field}>
          <div className={styles.fieldLabel}>
            내용 <span className={styles.req}>*</span>
          </div>
          <div className={styles.editorWrap}>
            <MailEditor onChange={setContent} initialHtml="<p><br/></p>" />
          </div>
        </section>

        {/* 첨부파일 */}
        <section className={styles.field}>
          <div className={styles.fieldLabel}>
            첨부파일{" "}
            <span className={styles.hint}>
              개당 최대 25MB · 최대 {MAX_FILES}개
            </span>
          </div>
          <div
            className={`${styles.drop} ${dragging ? styles.dropDrag : ""}`}
            onClick={(e: MouseEvent<HTMLDivElement>) => {
              if ((e.target as HTMLElement).classList.contains(styles.pick))
                return;
              fileInputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragging(false);
            }}
            onDrop={onDrop}
          >
            <svg
              className={styles.upIco}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="M17 8l-5-5-5 5" />
              <path d="M12 3v12" />
            </svg>
            <div>
              <strong>파일을 끌어다 놓거나</strong>{" "}
              <span
                className={styles.pick}
                onClick={() => fileInputRef.current?.click()}
              >
                클릭하여 첨부
              </span>
              하세요
            </div>
            <div className={styles.dropSub}>
              PDF, DOCX, XLSX, 이미지 파일 등
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={onFileChange}
            />
          </div>

          {files.length > 0 && (
            <div className={styles.filelist}>
              {files.map((f) => (
                <div className={styles.fileRow} key={f.id}>
                  <span className={styles.fileClip}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path d="M21.4 11.05 12.25 20.2a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l8.48-8.49" />
                    </svg>
                  </span>
                  <span className={styles.fname}>{f.name}</span>
                  {f.status === "uploading" && (
                    <span className={styles.fstatus}>업로드중…</span>
                  )}
                  {f.status === "error" && (
                    <span className={styles.ferror}>실패</span>
                  )}
                  <span className={styles.fsize}>{formatSize(f.size)}</span>
                  <button
                    type="button"
                    className={styles.rm}
                    title="삭제"
                    onClick={() => removeFile(f.id)}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.2}
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 하단 버튼 */}
        <div className={styles.foot}>
          <button
            type="button"
            className={styles.btn}
            onClick={handleCancel}
            disabled={submitting}
          >
            취소
          </button>
          <div className={styles.footRight}>
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={submitting}
            >
              {submitting ? "등록 중…" : "등록"}
            </button>
          </div>
        </div>
      </form>

      {/* toast */}
      <div className={`${styles.toast} ${toast ? styles.toastShow : ""}`}>
        {toast}
      </div>
    </div>
  );
}
