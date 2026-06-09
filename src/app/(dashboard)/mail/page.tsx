"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  RefreshCcw,
  Pencil,
  X,
  Paperclip,
  Reply,
  Forward,
  AlertCircle,
  Link2,
  Star,
  Mail,
  MailOpen,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import dynamic from "next/dynamic";
import DOMPurify from "dompurify";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

// TUI Editor — SSR 비활성 (window 접근) + 클라이언트에서만 로드
const MailEditor = dynamic(() => import("./_components/MailEditor"), {
  ssr: false,
  loading: () => (
    <div className={styles.editorLoading}>에디터 불러오는 중…</div>
  ),
});

// ─── 타입 ──────────────────────────────────────────────────────────────
interface MailAddress {
  emailAddress: { address: string; name?: string };
}
interface MailListItem {
  messageId: string;
  subject: string;
  from?: MailAddress;
  to?: MailAddress[];
  receivedTime?: string;
  sentTime?: string;
  hasAttachment?: boolean;
  isRead?: boolean;
  bodyPreview?: string;
}
interface MailDetail extends MailListItem {
  body?: { contentType: "HTML" | "TEXT"; content: string };
  attachments?: {
    attachmentId: string;
    fileName: string;
    size: number;
    contentType?: string;
  }[];
}

// 작성 화면 주소록 항목 (사내 사용자)
interface MailContact {
  id: number;
  name: string;
  email: string;
}

// 작성 첨부 (Storage 직접 업로드)
interface Attachment {
  id: string;
  path: string | null;
  filename: string;
  contentType: string;
  size: number;
  status: "uploading" | "done" | "error";
}

const FOLDERS = [
  { key: "INBOX", label: "받은편지함", icon: Inbox },
  { key: "SENT", label: "보낸편지함", icon: Send },
  { key: "DRAFTS", label: "임시보관", icon: FileText },
  { key: "DELETED", label: "휴지통", icon: Trash2 },
] as const;
type FolderKey = (typeof FOLDERS)[number]["key"];

// 리스트 페이지당 노출 개수
const MAIL_PAGE_SIZE = 30;

// ─── 유틸 ──────────────────────────────────────────────────────────────
function fmtDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  return d.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

function fmtFullDate(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 답장/전달용 원문 인용 HTML
function buildQuotedBody(detail: MailDetail | null): string {
  if (!detail) return "";
  const from =
    detail.from?.emailAddress.name ||
    detail.from?.emailAddress.address ||
    "보낸이";
  const date = fmtFullDate(detail.receivedTime ?? detail.sentTime);
  const orig =
    detail.body?.contentType === "HTML"
      ? DOMPurify.sanitize(detail.body.content ?? "")
      : `<pre style="white-space:pre-wrap;font-family:inherit;margin:0;">${escapeHtml(detail.body?.content ?? "")}</pre>`;
  return `<p><br/></p><div style="border-left:3px solid #e5e8eb;padding-left:12px;color:#4e5968;">
    <div style="font-size:12px;color:#8b95a1;margin-bottom:8px;">${escapeHtml(date)} ${escapeHtml(from)} 님이 작성:</div>
    ${orig}
  </div>`;
}

// ─── 서명 (고정 로고 + 이름/부서/연락처/주소) ───────────────────────────────
// 로고는 고정 — public 에 배치된 회사 로고를 사용 (이미지 업로드 불가)
const SIGNATURE_LOGO_SRC = "/mail-signature-logo.png";
const SIGNATURE_LOGO_WIDTH = 132;

interface SignatureData {
  name: string;
  dept: string;
  phone: string;
  email: string;
  address: string;
}
const EMPTY_SIGNATURE: SignatureData = {
  name: "",
  dept: "",
  phone: "",
  email: "",
  address: "",
};

// 구조화 입력 + 고정 로고(base64) → 이메일용 서명 HTML (인라인 스타일 — 메일 클라이언트 호환)
function buildSignatureHtml(s: SignatureData, logoDataUrl: string): string {
  const esc = (x: string) =>
    x.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines: string[] = [];
  // 순서: 이름 → 부서 → (T. 번호  E. 이메일) → 회사주소 → 로고(맨 아래)
  if (s.name.trim()) {
    lines.push(
      `<div data-sig-name style="font-weight:700;color:#191f28;font-size:15px;">${esc(
        s.name,
      )}</div>`,
    );
  }
  if (s.dept.trim()) {
    lines.push(
      `<div data-sig-dept style="color:#4e5968;font-size:13px;">${esc(
        s.dept,
      )}</div>`,
    );
  }
  const contact: string[] = [];
  if (s.phone.trim())
    contact.push(`T. <span data-sig-phone>${esc(s.phone)}</span>`);
  if (s.email.trim())
    contact.push(
      `E. <a data-sig-email href="mailto:${esc(s.email)}" style="color:#3182f6;text-decoration:none;">${esc(
        s.email,
      )}</a>`,
    );
  if (contact.length > 0) {
    lines.push(
      `<div style="color:#4e5968;font-size:13px;">${contact.join(
        " &nbsp;&nbsp; ",
      )}</div>`,
    );
  }
  if (s.address.trim()) {
    lines.push(
      `<div data-sig-address style="color:#8b95a1;font-size:13px;">${esc(
        s.address,
      )}</div>`,
    );
  }
  if (logoDataUrl) {
    lines.push(
      `<img data-sig-logo src="${logoDataUrl}" alt="한평생그룹" style="width:${SIGNATURE_LOGO_WIDTH}px;height:auto;display:block;margin-top:12px;" />`,
    );
  }
  if (lines.length === 0) return "";
  return `<div data-mail-signature="1" style="line-height:1.6;">${lines.join(
    "",
  )}</div>`;
}

// 저장된 서명 HTML → 구조화 입력 (재편집용). 포맷은 buildSignatureHtml 이 생성한 것을 가정
function parseSignatureHtml(html: string | null): SignatureData {
  if (!html || typeof document === "undefined") return { ...EMPTY_SIGNATURE };
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = (sel: string) =>
    div.querySelector(sel)?.textContent?.trim() ?? "";
  return {
    name: text("[data-sig-name]"),
    dept: text("[data-sig-dept]"),
    phone: text("[data-sig-phone]"),
    email: text("[data-sig-email]"),
    address: text("[data-sig-address]"),
  };
}

// ─── 메인 ──────────────────────────────────────────────────────────────
interface ConnectionStatus {
  connected: boolean;
  email?: string | null;
}

export default function MailPage() {
  const [folder, setFolder] = useState<FolderKey>("INBOX");
  const [query, setQuery] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [list, setList] = useState<MailListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // URL ?id=<messageId> 로 진입 시 해당 메일 자동 선택 (대시보드 메일 리스트 → 상세)
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("id");
  });
  // 초기 URL id 가 fetchList useEffect 의 setSelectedId(null) 로 덮어쓰이지 않도록 가드
  const isFirstMountRef = useRef(true);
  const [detail, setDetail] = useState<MailDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  // 작성 초기값 (답장/전달/새 메일)
  const [composeInit, setComposeInit] = useState<{
    to: string[];
    subject: string;
    bodyHtml: string;
  }>({ to: [], subject: "", bodyHtml: "" });
  const openCompose = (init?: {
    to?: string[];
    subject?: string;
    bodyHtml?: string;
  }) => {
    setComposeInit({
      to: init?.to ?? [],
      subject: init?.subject ?? "",
      bodyHtml: init?.bodyHtml ?? "",
    });
    setShowCompose(true);
  };
  // 네이버식 리스트 — 행 선택/별표 (로컬 상태, 별표는 표시용)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  // 발송 직후 우측 본문 영역에 표시할 성공 화면 정보
  const [sentInfo, setSentInfo] = useState<{
    recipients: string[];
    sentFolderSynced: boolean;
  } | null>(null);

  // ── 메일 자격증명 연결 상태 ──
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(
    null,
  );

  // ── 서명 (DB 저장, 새 메일에 자동 삽입) ──
  const [signatureHtml, setSignatureHtml] = useState<string | null>(null);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);

  // mount 시 서명 조회
  useEffect(() => {
    let cancelled = false;
    fetch("/api/mail-credentials/signature", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setSignatureHtml(d.signatureHtml ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // mount 시 자격증명 상태 조회
  useEffect(() => {
    let cancelled = false;
    setConnectionLoading(true);
    fetch("/api/mail-credentials/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.credentials) {
          setConnection({ connected: true, email: d.credentials.email });
        } else {
          setConnection({ connected: false });
        }
      })
      .catch(() => {
        if (!cancelled) setConnection({ connected: false });
      })
      .finally(() => {
        if (!cancelled) setConnectionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 연결 해제 (자격증명 삭제는 메일 설정 페이지에서)
  // 검색 디바운스
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  // 목록 fetch
  const fetchList = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ folder, count: "150" });
      if (searchDebounced) params.set("q", searchDebounced);
      const res = await fetch(`/api/mail/list?${params}`, {
        cache: "no-store",
      });
      const data = await res.json();
      // 자격증명 없음 → 연결 화면으로 전환
      if (
        res.status === 401 &&
        (data?.code === "MAIL_CREDENTIALS_REQUIRED" ||
          data?.code === "NW_AUTH_REQUIRED")
      ) {
        setConnection({ connected: false });
        setList([]);
        return;
      }
      if (!res.ok || !data.ok) {
        setError(data.error || "메일 목록을 불러올 수 없습니다");
        setList([]);
        return;
      }
      setList((data.messages ?? []) as MailListItem[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setListLoading(false);
    }
  }, [folder, searchDebounced]);

  useEffect(() => {
    fetchList();
    if (!isFirstMountRef.current) {
      setSelectedId(null);
      setDetail(null);
    }
    isFirstMountRef.current = false;
  }, [fetchList]);

  // 폴더/검색 변경 시 1페이지로
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [folder, searchDebounced]);

  // 선택 메일 일괄 읽음/안읽음
  const bulkSetRead = useCallback(
    async (isRead: boolean) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      await Promise.all(
        ids.map((id) =>
          fetch(
            `/api/mail/${encodeURIComponent(id)}?folder=${encodeURIComponent(folder)}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isRead }),
            },
          ).catch(() => {}),
        ),
      );
      setList((prev) =>
        prev.map((m) => (selectedIds.has(m.messageId) ? { ...m, isRead } : m)),
      );
      setSelectedIds(new Set());
    },
    [selectedIds, folder],
  );

  // 선택 메일 일괄 삭제(휴지통 이동)
  const bulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`선택한 ${ids.length}개 메일을 삭제할까요?`)) return;
    await Promise.all(
      ids.map((id) =>
        fetch(
          `/api/mail/${encodeURIComponent(id)}?folder=${encodeURIComponent(folder)}`,
          { method: "DELETE" },
        ).catch(() => {}),
      ),
    );
    const idSet = selectedIds;
    setList((prev) => prev.filter((m) => !idSet.has(m.messageId)));
    if (selectedId && idSet.has(selectedId)) {
      setSelectedId(null);
      setDetail(null);
    }
    setSelectedIds(new Set());
  }, [selectedIds, folder, selectedId]);

  // 상세 fetch
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    const folderQS = `?folder=${encodeURIComponent(folder)}`;
    fetch(`/api/mail/${encodeURIComponent(selectedId)}${folderQS}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.ok) {
          setDetail(d.data);
          fetch(`/api/mail/${encodeURIComponent(selectedId)}${folderQS}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isRead: true }),
          }).catch(() => {});
          setList((prev) =>
            prev.map((m) =>
              m.messageId === selectedId ? { ...m, isRead: true } : m,
            ),
          );
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, folder]);

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm("이 메일을 휴지통으로 이동하시겠습니까?")) return;
    const res = await fetch(
      `/api/mail/${encodeURIComponent(selectedId)}?folder=${encodeURIComponent(folder)}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setList((prev) => prev.filter((m) => m.messageId !== selectedId));
      setSelectedId(null);
      setDetail(null);
    }
  };

  // 연결 상태 로딩 중
  if (connectionLoading) {
    return (
      <div className={styles.app}>
        <div className={styles.connectWrap}>
          <p className={styles.connectMuted}>연결 상태 확인 중...</p>
        </div>
      </div>
    );
  }

  // 미연결 상태 → 연결 안내 카드
  if (!connection?.connected) {
    return (
      <div className={styles.app}>
        <div className={styles.connectWrap}>
          <div className={styles.connectCard}>
            <div className={styles.connectIcon}>
              <Link2 size={28} />
            </div>
            <h2 className={styles.connectTitle}>메일 자격증명 등록 필요</h2>
            <p className={styles.connectDesc}>
              본인 메일 자격증명(다음 스마트워크 등)을 등록하면
              <br />
              받은편지함과 메일 발송 기능을 사용할 수 있습니다.
            </p>
            {connectionMessage && (
              <div className={styles.connectMessage}>{connectionMessage}</div>
            )}
            <a className={styles.connectBtn} href="/me/mail-settings">
              <Link2 size={16} />
              메일 설정으로 이동
            </a>
            <p className={styles.connectFootnote}>
              앱 비밀번호로 IMAP/SMTP 연결 — 본인 메일함 조회/발송 가능.
              <br />
              언제든 자격증명을 삭제할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 상세(읽기) 패널은 메일을 선택했거나 발송 직후일 때만 표시 — 기본은 리스트만
  const showDetailPane =
    !showCompose && (selectedId !== null || sentInfo !== null);

  // 페이징 (15개씩)
  const totalPages = Math.max(1, Math.ceil(list.length / MAIL_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = list.slice(
    (currentPage - 1) * MAIL_PAGE_SIZE,
    currentPage * MAIL_PAGE_SIZE,
  );

  return (
    <div className={styles.app}>
      <div className={styles.layout}>
        {/* Left: 폴더 사이드바 */}
        <aside className={styles.folderSide}>
          <button
            type="button"
            className={styles.composeBtn}
            onClick={() => openCompose()}
          >
            <Pencil size={14} />
            메일 쓰기
          </button>
          <div className={styles.folderList}>
            {FOLDERS.map((f) => {
              const Icon = f.icon;
              const active = folder === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  className={`${styles.folderItem} ${active ? styles.folderItemActive : ""}`}
                  onClick={() => {
                    // 폴더 전환 시 작성/상세 화면 닫고 목록으로
                    setShowCompose(false);
                    setSelectedId(null);
                    setDetail(null);
                    setSentInfo(null);
                    setFolder(f.key);
                  }}
                >
                  <Icon size={15} />
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {showCompose ? (
          <ComposePane
            initialTo={composeInit.to}
            initialSubject={composeInit.subject}
            initialBody={composeInit.bodyHtml}
            signature={signatureHtml ?? ""}
            onEditSignature={() => setSignatureModalOpen(true)}
            onClose={() => setShowCompose(false)}
            onSent={(sentFolderSynced, recipients) => {
              setShowCompose(false);
              setSentInfo({ recipients, sentFolderSynced });
              setSelectedId(null);
              setDetail(null);
              if (folder === "SENT") fetchList();
            }}
            onSavedDraft={() => {
              // 임시저장 → 작성 닫고 임시보관함으로 이동
              setShowCompose(false);
              setSelectedId(null);
              setDetail(null);
              if (folder === "DRAFTS") fetchList();
              else setFolder("DRAFTS");
            }}
          />
        ) : (
          <>
            {!showDetailPane && (
              <>
                {/* 메일 목록 — 상세를 열면 숨기고 본문이 이 자리에 표시 */}
                <section className={styles.listCol}>
                  <div className={styles.listHead}>
                    <input
                      className={styles.searchInput}
                      placeholder="메일 검색 (제목/보낸이/내용)"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>

                  {/* 네이버식 툴바 — 전체선택 / 개수 / 새로고침 */}
                  <div className={styles.listToolbar}>
                    <input
                      type="checkbox"
                      className={styles.rowCheck}
                      checked={
                        pageItems.length > 0 &&
                        pageItems.every((m) => selectedIds.has(m.messageId))
                      }
                      onChange={(e) =>
                        setSelectedIds(
                          e.target.checked
                            ? new Set(pageItems.map((m) => m.messageId))
                            : new Set(),
                        )
                      }
                      aria-label="현재 페이지 전체 선택"
                    />
                    <button
                      type="button"
                      className={styles.toolbarBtn}
                      disabled={selectedIds.size === 0}
                      onClick={() => bulkSetRead(true)}
                    >
                      읽음
                    </button>
                    <button
                      type="button"
                      className={styles.toolbarBtn}
                      disabled={selectedIds.size === 0}
                      onClick={() => bulkSetRead(false)}
                    >
                      안읽음
                    </button>
                    <button
                      type="button"
                      className={styles.toolbarBtn}
                      disabled={selectedIds.size === 0}
                      onClick={bulkDelete}
                    >
                      삭제
                    </button>
                    <span
                      className={styles.toolbarDivider}
                      aria-hidden="true"
                    />
                    <span className={styles.toolbarCount}>
                      {selectedIds.size > 0
                        ? `${selectedIds.size}개 선택`
                        : `전체 ${list.length} · 안읽음 ${list.filter((m) => m.isRead === false).length}`}
                    </span>
                    <button
                      type="button"
                      className={styles.refreshBtn}
                      onClick={() => fetchList()}
                      title="새로고침"
                    >
                      <RefreshCcw size={14} />
                    </button>
                  </div>

                  {error && (
                    <div className={styles.errorBox}>
                      <AlertCircle size={14} style={{ marginRight: 6 }} />
                      {error}
                    </div>
                  )}

                  <div className={styles.listBody}>
                    {listLoading ? (
                      <div className={styles.listEmpty}>불러오는 중...</div>
                    ) : list.length === 0 ? (
                      <div className={styles.listEmpty}>메일이 없습니다.</div>
                    ) : (
                      pageItems.map((m) => {
                        const active = selectedId === m.messageId;
                        const unread = m.isRead === false;
                        const date = m.receivedTime ?? m.sentTime ?? "";
                        const isOutbox =
                          folder === "SENT" || folder === "DRAFTS";
                        let displayName: string;
                        if (isOutbox) {
                          const recipients = m.to ?? [];
                          if (recipients.length === 0) {
                            displayName = "(받는 사람 없음)";
                          } else {
                            const first =
                              recipients[0].emailAddress.name ||
                              recipients[0].emailAddress.address;
                            displayName =
                              recipients.length > 1
                                ? `${first} 외 ${recipients.length - 1}명`
                                : first;
                          }
                          displayName = `받는 사람: ${displayName}`;
                        } else {
                          displayName =
                            m.from?.emailAddress.name ||
                            m.from?.emailAddress.address ||
                            "(보낸이 없음)";
                        }
                        const checked = selectedIds.has(m.messageId);
                        const star = starredIds.has(m.messageId);
                        return (
                          <div
                            key={m.messageId}
                            className={`${styles.mailRow} ${active ? styles.mailRowActive : ""} ${unread ? styles.mailRowUnread : ""}`}
                            onClick={() => setSelectedId(m.messageId)}
                          >
                            <input
                              type="checkbox"
                              className={styles.rowCheck}
                              checked={checked}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(m.messageId);
                                  else next.delete(m.messageId);
                                  return next;
                                });
                              }}
                            />
                            <button
                              type="button"
                              className={`${styles.rowStar} ${star ? styles.rowStarOn : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setStarredIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(m.messageId))
                                    next.delete(m.messageId);
                                  else next.add(m.messageId);
                                  return next;
                                });
                              }}
                              aria-label="별표"
                            >
                              <Star
                                size={15}
                                fill={star ? "#ffc107" : "none"}
                              />
                            </button>
                            <span className={styles.rowReadIcon}>
                              {unread ? (
                                <Mail size={15} />
                              ) : (
                                <MailOpen size={15} />
                              )}
                            </span>
                            <span className={styles.rowFrom}>
                              {displayName}
                            </span>
                            <span className={styles.rowSubject}>
                              {m.hasAttachment && (
                                <Paperclip
                                  size={12}
                                  className={styles.attachIcon}
                                />
                              )}
                              {m.subject || "(제목 없음)"}
                            </span>
                            <span className={styles.rowDate}>
                              {fmtDate(date)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {totalPages > 1 && (
                    <div className={styles.pager}>
                      <button
                        type="button"
                        className={styles.pagerBtn}
                        disabled={currentPage === 1}
                        onClick={() => setPage(1)}
                        aria-label="처음"
                      >
                        «
                      </button>
                      <button
                        type="button"
                        className={styles.pagerBtn}
                        disabled={currentPage === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-label="이전"
                      >
                        ‹
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (p) => (
                          <button
                            key={p}
                            type="button"
                            className={`${styles.pagerNum} ${p === currentPage ? styles.pagerNumActive : ""}`}
                            onClick={() => setPage(p)}
                          >
                            {p}
                          </button>
                        ),
                      )}
                      <button
                        type="button"
                        className={styles.pagerBtn}
                        disabled={currentPage === totalPages}
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        aria-label="다음"
                      >
                        ›
                      </button>
                      <button
                        type="button"
                        className={styles.pagerBtn}
                        disabled={currentPage === totalPages}
                        onClick={() => setPage(totalPages)}
                        aria-label="마지막"
                      >
                        »
                      </button>
                    </div>
                  )}
                </section>
              </>
            )}

            {/* 메일 상세 — 목록 대신 전체 영역에 표시 */}
            {showDetailPane && (
              <section className={styles.detailCol}>
                <div className={styles.detailTopBar}>
                  <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => {
                      setSelectedId(null);
                      setDetail(null);
                      setSentInfo(null);
                    }}
                  >
                    <ChevronLeft size={18} />
                    <span>
                      {FOLDERS.find((f) => f.key === folder)?.label ?? "목록"}
                    </span>
                  </button>
                </div>
                {sentInfo ? (
                  <SentSuccessView
                    recipients={sentInfo.recipients}
                    sentFolderSynced={sentInfo.sentFolderSynced}
                    onGoList={() => {
                      setSentInfo(null);
                      setFolder("SENT");
                    }}
                    onCompose={() => {
                      setSentInfo(null);
                      openCompose();
                    }}
                  />
                ) : !selectedId ? (
                  <div className={styles.detailEmpty}>
                    <Inbox size={32} />
                    <div>메일을 선택해 주세요</div>
                  </div>
                ) : detailLoading ? (
                  <div className={styles.detailEmpty}>불러오는 중...</div>
                ) : detail ? (
                  <>
                    <div className={styles.detailHead}>
                      <h2 className={styles.detailSubject}>
                        {detail.subject || "(제목 없음)"}
                      </h2>
                      <div className={styles.detailMeta}>
                        <div className={styles.detailFromBlock}>
                          <span className={styles.detailFromName}>
                            {detail.from?.emailAddress.name ||
                              detail.from?.emailAddress.address ||
                              "-"}
                          </span>
                          <span className={styles.detailFromAddr}>
                            {detail.from?.emailAddress.address}
                          </span>
                        </div>
                        <span className={styles.detailDate}>
                          {fmtFullDate(detail.receivedTime ?? detail.sentTime)}
                        </span>
                      </div>
                    </div>

                    <div className={styles.detailActions}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() =>
                          openCompose({
                            to: detail.from?.emailAddress.address
                              ? [detail.from.emailAddress.address]
                              : [],
                            subject: `Re: ${detail.subject ?? ""}`,
                            bodyHtml: buildQuotedBody(detail),
                          })
                        }
                      >
                        <Reply size={13} />
                        답장
                      </button>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() =>
                          openCompose({
                            to: [],
                            subject: `Fwd: ${detail.subject ?? ""}`,
                            bodyHtml: buildQuotedBody(detail),
                          })
                        }
                      >
                        <Forward size={13} />
                        전달
                      </button>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                        onClick={handleDelete}
                        style={{ marginLeft: "auto" }}
                      >
                        <Trash2 size={13} />
                        삭제
                      </button>
                    </div>

                    <div
                      className={styles.detailBody}
                      dangerouslySetInnerHTML={{
                        // 받은 메일 HTML 은 신뢰할 수 없으므로 DOMPurify 로 새니타이즈 (XSS 방어)
                        __html:
                          detail.body?.contentType === "HTML"
                            ? DOMPurify.sanitize(detail.body.content ?? "", {
                                ADD_ATTR: ["target"],
                              })
                            : `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(detail.body?.content ?? "")}</pre>`,
                      }}
                    />

                    {detail.attachments && detail.attachments.length > 0 && (
                      <div className={styles.detailAttachments}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#4e5968",
                          }}
                        >
                          첨부파일 {detail.attachments.length}개
                        </div>
                        {detail.attachments.map((a) => (
                          <div
                            key={a.attachmentId}
                            className={styles.attachItem}
                          >
                            <Paperclip size={13} />
                            <span>{a.fileName}</span>
                            <span
                              style={{
                                marginLeft: "auto",
                                color: "#8b95a1",
                                fontSize: 11,
                              }}
                            >
                              {formatBytes(a.size)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 본문 하단 — 이전 / 다음 메일 행 (네이버 메일 스타일) */}
                    {selectedId && (() => {
                      const idx = list.findIndex(
                        (m) => m.messageId === selectedId,
                      );
                      const prev = idx > 0 ? list[idx - 1] : null;
                      const next = idx >= 0 && idx < list.length - 1
                        ? list[idx + 1]
                        : null;
                      if (!prev && !next) return null;
                      return (
                        <div className={styles.detailSiblings}>
                          {prev && (
                            <button
                              type="button"
                              className={styles.siblingRow}
                              onClick={() => setSelectedId(prev.messageId)}
                            >
                              <ChevronUp
                                size={14}
                                className={styles.siblingArrow}
                              />
                              <span className={styles.siblingFrom}>
                                {prev.from?.emailAddress.name ||
                                  prev.from?.emailAddress.address ||
                                  "-"}
                              </span>
                              <span className={styles.siblingFolderTag}>
                                [
                                {FOLDERS.find((f) => f.key === folder)?.label ??
                                  "받은편지함"}
                                ]
                              </span>
                              <span className={styles.siblingSubject}>
                                {prev.subject || "(제목 없음)"}
                              </span>
                              <span className={styles.siblingDate}>
                                {fmtDate(prev.receivedTime ?? prev.sentTime)}
                              </span>
                            </button>
                          )}
                          {next && (
                            <button
                              type="button"
                              className={styles.siblingRow}
                              onClick={() => setSelectedId(next.messageId)}
                            >
                              <ChevronDown
                                size={14}
                                className={styles.siblingArrow}
                              />
                              <span className={styles.siblingFrom}>
                                {next.from?.emailAddress.name ||
                                  next.from?.emailAddress.address ||
                                  "-"}
                              </span>
                              <span className={styles.siblingFolderTag}>
                                [
                                {FOLDERS.find((f) => f.key === folder)?.label ??
                                  "받은편지함"}
                                ]
                              </span>
                              <span className={styles.siblingSubject}>
                                {next.subject || "(제목 없음)"}
                              </span>
                              <span className={styles.siblingDate}>
                                {fmtDate(next.receivedTime ?? next.sentTime)}
                              </span>
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div className={styles.detailEmpty}>불러올 수 없습니다.</div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {signatureModalOpen && (
        <SignatureModal
          initialHtml={signatureHtml}
          onClose={() => setSignatureModalOpen(false)}
          onSaved={(html) => {
            setSignatureHtml(html);
            setSignatureModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ─── 작성 패널 (인라인) ───────────────────────────────────────────────────
interface ComposePaneProps {
  initialTo?: string[];
  initialSubject?: string;
  initialBody?: string;
  /** DB에 저장된 서명 HTML (새 메일 작성 시 자동 삽입 + 변경 시 라이브 반영) */
  signature?: string;
  /** 서명 설정 모달 열기 */
  onEditSignature: () => void;
  onClose: () => void;
  onSent: (sentFolderSynced: boolean, recipients: string[]) => void;
  /** 임시저장 성공 시 — 임시보관함으로 이동 */
  onSavedDraft: () => void;
}
function ComposePane({
  initialTo = [],
  initialSubject = "",
  initialBody = "",
  signature = "",
  onEditSignature,
  onClose,
  onSent,
  onSavedDraft,
}: ComposePaneProps) {
  // 에디터 초기 본문 — 입력영역/인용 + 서명(있으면 하단). 매번 새 작성으로 시작
  const effectiveInitialBody = `${
    initialBody || "<p><br/></p><p><br/></p>"
  }${signature ? `<p><br/></p>${signature}` : ""}`;

  const [to, setTo] = useState(initialTo.join(", "));
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState(initialSubject);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bodyHtml, setBodyHtml] = useState("");
  // 첨부 — Supabase Storage 직접 업로드 (Vercel 요청 한도 우회, 최대 25MB)
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const MAX_FILE_BYTES = 25 * 1024 * 1024;
  // 임시저장/미리보기 상태
  const [savingDraft, setSavingDraft] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // 주소록(사내 사용자) — 받는사람/참조/숨은참조 자동완성용
  const [contacts, setContacts] = useState<MailContact[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/mail/contacts", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (Array.isArray(d?.contacts)) setContacts(d.contacts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  // 나가기 확인 모달 (마지막 저장 이후 수정사항이 있을 때만)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  // 마지막 저장 이후 사용자가 수정했는지 추적 — 닫기 시 경고 표시 여부 결정
  const dirtyRef = useRef(false);
  // 본문 에디터의 최초 onChange(초기 HTML 주입)는 수정으로 보지 않기 위한 플래그
  const bodyInitedRef = useRef(false);
  const markDirty = () => {
    dirtyRef.current = true;
  };

  // 본문 변경 핸들러 — 최초 1회(초기 HTML 주입)는 무시, 이후는 사용자 수정으로 간주
  const handleBodyChange = (html: string) => {
    setBodyHtml(html);
    if (!bodyInitedRef.current) {
      bodyInitedRef.current = true;
      return;
    }
    markDirty();
  };

  // 닫기 요청 — 저장 이후 수정사항이 있으면 확인 모달, 없으면 즉시 닫기
  const handleCloseRequest = () => {
    if (dirtyRef.current) {
      setLeaveConfirmOpen(true);
      return;
    }
    onClose();
  };

  // 파일 선택 → 서명 URL 받아 Storage 에 직접 업로드
  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    markDirty();
    const list = Array.from(fl);
    const supabase = createClient();
    for (const file of list) {
      const id = `${file.name}-${file.size}-${file.lastModified}`;
      if (file.size > MAX_FILE_BYTES) {
        setAttachments((prev) => [
          ...prev,
          {
            id,
            path: null,
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size,
            status: "error",
          },
        ]);
        continue;
      }
      setAttachments((prev) => [
        ...prev,
        {
          id,
          path: null,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
          status: "uploading",
        },
      ]);
      void (async () => {
        try {
          const signRes = await fetch("/api/mail/attachments/sign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name }),
          });
          const sign = await signRes.json();
          if (!signRes.ok || !sign.ok)
            throw new Error(sign.error ?? "sign fail");
          const up = await supabase.storage
            .from(sign.bucket)
            .uploadToSignedUrl(sign.path, sign.token, file, {
              contentType: file.type || "application/octet-stream",
            });
          if (up.error) throw up.error;
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === id ? { ...a, path: sign.path, status: "done" } : a,
            ),
          );
        } catch {
          setAttachments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, status: "error" } : a)),
          );
        }
      })();
    }
  };
  // 임시 첨부 정리 (미발송분)
  const cleanupPaths = (paths: string[]) => {
    const valid = paths.filter(Boolean);
    if (valid.length === 0) return;
    fetch("/api/mail/attachments/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: valid }),
      keepalive: true,
    }).catch(() => {});
  };

  const removeFile = (idx: number) =>
    setAttachments((prev) => {
      const target = prev[idx];
      if (target?.path) cleanupPaths([target.path]);
      markDirty();
      return prev.filter((_, i) => i !== idx);
    });

  // 업로드된 임시파일 경로 추적 (언마운트 정리용) + 발송 완료 플래그
  const uploadedPathsRef = useRef<string[]>([]);
  const sentRef = useRef(false);
  // 임시보관함에 저장한 메일 UID — 재저장 시 교체(중복 누적 방지)
  const draftUidRef = useRef<number | null>(null);
  useEffect(() => {
    uploadedPathsRef.current = attachments
      .filter((a) => a.status === "done" && a.path)
      .map((a) => a.path as string);
  }, [attachments]);
  useEffect(() => {
    return () => {
      // 작성 닫기/이동 시 발송 안 한 첨부는 스토리지에서 삭제
      // (임시저장 시 첨부는 IMAP 메일에 임베드되므로 스토리지 임시본은 정리해도 됨)
      if (sentRef.current || uploadedPathsRef.current.length === 0) return;
      cleanupPaths(uploadedPathsRef.current);
    };
  }, []);

  // HTML → 평문 (텍스트 폴백)
  const htmlToText = (html: string): string => {
    if (typeof document === "undefined") return "";
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.innerText;
  };

  // 발송용 HTML 보정 — 표(table) 에 인라인 테두리 추가 (이메일 클라이언트는 외부 CSS 미적용)
  const styleEmailHtml = (html: string): string => {
    if (typeof document === "undefined") return html;
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("table").forEach((t) => {
      t.setAttribute(
        "style",
        "border-collapse:collapse;border:1px solid #c8ccd0;margin:8px 0;",
      );
    });
    doc.querySelectorAll("th,td").forEach((c) => {
      const base = "border:1px solid #c8ccd0;padding:6px 10px;min-width:110px;";
      c.setAttribute(
        "style",
        c.tagName === "TH"
          ? base + "background:#f2f4f6;font-weight:700;"
          : base,
      );
    });
    return doc.body.innerHTML;
  };

  // 주소 문자열 → 배열 (쉼표/세미콜론/공백 구분)
  const parseAddrs = (s: string) =>
    s
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);

  // 임시저장 — IMAP 임시보관함(Drafts)에 저장 후 임시보관함으로 이동
  const handleSaveDraft = async () => {
    setErr(null);
    if (attachments.some((a) => a.status === "uploading")) {
      setErr("첨부파일 업로드가 끝날 때까지 기다려주세요.");
      return;
    }
    if (attachments.some((a) => a.status === "error")) {
      setErr("업로드 실패한 첨부파일이 있습니다. 제거 후 다시 시도해주세요.");
      return;
    }
    const attachmentPayload = attachments
      .filter((a) => a.status === "done" && a.path)
      .map((a) => ({
        path: a.path as string,
        filename: a.filename,
        contentType: a.contentType,
      }));

    setSavingDraft(true);
    try {
      const res = await fetch("/api/mail/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: parseAddrs(to),
          cc: parseAddrs(cc),
          bcc: parseAddrs(bcc),
          subject: subject.trim(),
          bodyText: htmlToText(bodyHtml),
          bodyHtml: styleEmailHtml(bodyHtml),
          attachments: attachmentPayload,
          replaceUid: draftUidRef.current ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "임시저장에 실패했습니다.");
        return;
      }
      draftUidRef.current =
        typeof data.uid === "number" ? data.uid : draftUidRef.current;
      // 임시저장된 첨부는 IMAP 메일에 임베드됨 → 스토리지 임시본 정리 스킵 위해 발송 플래그 대용으로 처리하지 않고
      // 언마운트 정리에 맡김(닫힐 때 정리). 저장 완료 → 수정사항 초기화 후 임시보관함으로 이동
      dirtyRef.current = false;
      onSavedDraft();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSend = async () => {
    setErr(null);
    const toList = to
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (toList.length === 0) {
      setErr("받는 사람을 입력해주세요");
      return;
    }
    if (!subject.trim()) {
      setErr("제목을 입력해주세요");
      return;
    }
    const ccList = parseAddrs(cc);
    const bccList = parseAddrs(bcc);

    if (attachments.some((a) => a.status === "uploading")) {
      setErr("첨부파일 업로드가 끝날 때까지 기다려주세요.");
      return;
    }
    if (attachments.some((a) => a.status === "error")) {
      setErr("업로드 실패한 첨부파일이 있습니다. 제거 후 다시 시도해주세요.");
      return;
    }
    const attachmentPayload = attachments
      .filter((a) => a.status === "done" && a.path)
      .map((a) => ({
        path: a.path as string,
        filename: a.filename,
        contentType: a.contentType,
      }));

    setSending(true);
    try {
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toList,
          cc: ccList.length > 0 ? ccList : undefined,
          bcc: bccList.length > 0 ? bccList : undefined,
          subject: subject.trim(),
          bodyText: htmlToText(bodyHtml),
          bodyHtml: styleEmailHtml(bodyHtml),
          attachments: attachmentPayload,
        }),
      });
      const raw = await res.text();
      let data: {
        ok?: boolean;
        error?: string;
        messageId?: string;
        sentFolderSynced?: boolean;
      } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        // Vercel 함수 타임아웃/에러 시 plain text 가 올 수 있음
        setErr(
          res.status === 504 || res.status === 408
            ? "발송 시간이 초과되었습니다. 잠시 후 다시 시도해주세요."
            : `발송 실패 (HTTP ${res.status})`,
        );
        return;
      }
      if (!res.ok || !data.ok) {
        setErr(data.error || `발송 실패 (HTTP ${res.status})`);
        return;
      }
      sentRef.current = true; // 발송 성공 → 서버가 첨부 정리하므로 언마운트 정리 스킵
      onSent(Boolean(data.sentFolderSynced), toList);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className={styles.composePane}>
      <div className={styles.composeHead}>
        <div className={styles.composeActionBar}>
          <button
            type="button"
            className={styles.toolbarSendBtn}
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? "전송 중…" : "보내기"}
          </button>
          <button
            type="button"
            className={styles.composeActionBtn}
            onClick={() => setPreviewOpen(true)}
            disabled={sending}
          >
            미리보기
          </button>
          <button
            type="button"
            className={styles.composeActionBtn}
            onClick={handleSaveDraft}
            disabled={sending || savingDraft}
          >
            {savingDraft ? "저장 중…" : "임시저장"}
          </button>
          <button
            type="button"
            className={styles.composeActionBtn}
            onClick={onEditSignature}
          >
            서명설정
          </button>
        </div>
        <div className={styles.composeHeadRight}>
          <button
            type="button"
            className={styles.composeCloseBtn}
            onClick={handleCloseRequest}
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {err && (
        <div className={styles.errorBox}>
          <AlertCircle size={14} style={{ marginRight: 6 }} />
          {err}
        </div>
      )}

      <div className={styles.composeBody}>
        <div className={styles.composeRow}>
          <span className={styles.composeLabel}>받는 사람</span>
          <RecipientInput
            value={to}
            onChange={(v) => {
              setTo(v);
              markDirty();
            }}
            placeholder="이름·이메일 검색 또는 직접 입력"
            contacts={contacts}
          />
        </div>
        {/* 참조 — 항상 표시, "참조" 라벨 옆 화살표로 숨은참조 토글 */}
        <div className={styles.composeRow}>
          <span className={styles.composeLabelWithToggle}>
            <span>참조</span>
            <button
              type="button"
              className={styles.refArrowBtn}
              onClick={() => setShowBcc((v) => !v)}
              aria-expanded={showBcc}
              aria-label="숨은참조"
              title="숨은참조"
            >
              {showBcc ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </span>
          <RecipientInput
            value={cc}
            onChange={(v) => {
              setCc(v);
              markDirty();
            }}
            placeholder="참조 (쉼표로 구분)"
            contacts={contacts}
          />
        </div>
        {showBcc && (
          <div className={styles.composeRow}>
            <span className={styles.composeLabel}>숨은참조</span>
            <RecipientInput
              value={bcc}
              onChange={(v) => {
                setBcc(v);
                markDirty();
              }}
              placeholder="숨은참조 (쉼표로 구분)"
              contacts={contacts}
              autoFocus
            />
          </div>
        )}
        <div className={styles.composeRow}>
          <span className={styles.composeLabel}>제목</span>
          <input
            className={styles.composeInput}
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              markDirty();
            }}
            placeholder="제목을 입력하세요"
          />
        </div>
        {/* 첨부파일 */}
        <div className={styles.composeRow}>
          <span className={styles.composeLabel}>첨부파일</span>
          <div
            className={`${styles.attachArea} ${dragOver ? styles.attachAreaDrag : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
          >
            <div className={styles.attachTop}>
              <label className={styles.attachAddBtn}>
                <Paperclip size={13} /> 파일 첨부
                <input
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <span className={styles.attachHint}>
                여기로 끌어다 놓기 · 여러 개 가능 · 최대 25MB/파일
              </span>
            </div>
            {attachments.length > 0 && (
              <div className={styles.attachChips}>
                {attachments.map((a, i) => (
                  <span
                    key={a.id + i}
                    className={`${styles.attachChip} ${a.status === "error" ? styles.attachChipError : ""}`}
                  >
                    <Paperclip size={11} />
                    <span className={styles.attachChipName}>{a.filename}</span>
                    <span className={styles.attachChipSize}>
                      {a.status === "uploading"
                        ? "업로드 중…"
                        : a.status === "error"
                          ? "실패"
                          : formatBytes(a.size)}
                    </span>
                    <button
                      type="button"
                      className={styles.attachChipX}
                      onClick={() => removeFile(i)}
                      aria-label="첨부 제거"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 본문 에디터 — 서명은 변경 시 라이브로 반영 (signatureHtml) */}
        <div className={styles.editorWrap}>
          <MailEditor
            onChange={handleBodyChange}
            initialHtml={effectiveInitialBody}
            signatureHtml={signature}
          />
        </div>
      </div>

      {previewOpen && (
        <ComposePreviewModal
          to={to}
          cc={cc}
          bcc={bcc}
          subject={subject}
          bodyHtml={styleEmailHtml(bodyHtml)}
          attachments={attachments}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {/* 나가기 확인 — 마지막 저장 이후 수정사항이 있을 때 */}
      {leaveConfirmOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setLeaveConfirmOpen(false)}
        >
          <div
            className={styles.leaveConfirm}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className={styles.leaveConfirmClose}
              onClick={() => setLeaveConfirmOpen(false)}
              aria-label="닫기"
            >
              <X size={18} />
            </button>
            <div className={styles.leaveConfirmIcon}>
              <AlertCircle size={26} />
            </div>
            <p className={styles.leaveConfirmText}>
              이 페이지를 벗어나면 마지막 저장 후 수정된 내용은 저장되지
              않습니다.
            </p>
            <div className={styles.leaveConfirmBtns}>
              <button
                type="button"
                className={styles.leaveConfirmCancel}
                onClick={() => setLeaveConfirmOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.leaveConfirmOk}
                onClick={() => {
                  setLeaveConfirmOpen(false);
                  onClose();
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── 받는사람/참조/숨은참조 자동완성 입력 ─────────────────────────────────
// - focus 시 드롭다운(전체 주소록) 노출
// - 타이핑 시 마지막 토큰(쉼표/세미콜론/공백 뒤 부분)으로 필터링
// - 항목 클릭 시 현재 토큰을 해당 이메일로 치환하고 ", " 로 마감 → 이어서 입력 가능
// - 외부 클릭 / ESC / Enter 로 닫기
interface RecipientInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  contacts: MailContact[];
  rightAdornment?: React.ReactNode;
  autoFocus?: boolean;
}
function RecipientInput({
  value,
  onChange,
  placeholder,
  contacts,
  rightAdornment,
  autoFocus,
}: RecipientInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // autoFocus 로 인한 최초 focus 이벤트는 드롭다운 자동 열기를 스킵
  //  (예: 숨은참조 토글로 필드를 펼쳤을 때 드롭다운이 자동으로 열리는 것 방지)
  const skipNextFocusOpenRef = useRef(autoFocus);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // 현재 입력 중인 마지막 토큰 (쉼표/세미콜론/공백 뒤 부분)
  const lastTokenStart = (() => {
    let i = value.length - 1;
    while (i >= 0 && !/[,;\s]/.test(value[i])) i--;
    return i + 1;
  })();
  const lastToken = value.slice(lastTokenStart).trim();
  const prefix = value.slice(0, lastTokenStart);

  // 이미 입력된 이메일 토큰 — 드롭다운에서 제외
  const enteredEmails = new Set(
    value
      .split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  // 마지막 토큰은 "입력 중"이므로 입력 완료 목록에서 제외
  enteredEmails.delete(lastToken.toLowerCase());

  const filtered = useMemo(() => {
    const q = lastToken.toLowerCase();
    const list = contacts.filter(
      (c) => !enteredEmails.has(c.email.toLowerCase()),
    );
    if (!q) return list;
    return list.filter(
      (c) =>
        c.email.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastToken, contacts, value]);

  useEffect(() => {
    setActiveIdx(0);
  }, [lastToken, open]);

  const pick = (c: MailContact) => {
    // 마지막 토큰을 해당 이메일로 치환, 이어서 입력할 수 있게 ", " 마감
    const trimmedPrefix = prefix.replace(/[,;\s]+$/, "");
    const next = trimmedPrefix
      ? `${trimmedPrefix}, ${c.email}, `
      : `${c.email}, `;
    onChange(next);
    // 선택 후 드롭다운 닫고, 이어서 input 으로 자동 포커스되더라도 다시 열리지 않게 보호
    setOpen(false);
    skipNextFocusOpenRef.current = true;
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(next.length, next.length);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (filtered[activeIdx]) {
        e.preventDefault();
        pick(filtered[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className={styles.recipientWrap}>
      <input
        ref={inputRef}
        className={styles.composeInput}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          // autoFocus 로 인한 최초 focus 는 자동 열기 스킵 (이후 클릭/포커스는 정상 동작)
          if (skipNextFocusOpenRef.current) {
            skipNextFocusOpenRef.current = false;
            return;
          }
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {rightAdornment}
      {open && filtered.length > 0 && (
        <ul ref={listRef} className={styles.recipientDropdown} role="listbox">
          {filtered.map((c, idx) => (
            <li
              key={c.id}
              role="option"
              aria-selected={idx === activeIdx}
              className={`${styles.recipientItem} ${
                idx === activeIdx ? styles.recipientItemActive : ""
              }`}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseDown={(e) => {
                // input blur 전에 클릭 처리 (mousedown 으로 잡아야 함)
                e.preventDefault();
                pick(c);
              }}
            >
              <span className={styles.recipientItemName}>{c.name}</span>
              <span className={styles.recipientItemEmail}>{c.email}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── 작성 미리보기 모달 ─────────────────────────────────────────────────
interface ComposePreviewModalProps {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  bodyHtml: string;
  attachments: Attachment[];
  onClose: () => void;
}
function ComposePreviewModal({
  to,
  cc,
  bcc,
  subject,
  bodyHtml,
  attachments,
  onClose,
}: ComposePreviewModalProps) {
  const safeBody = useMemo(
    () =>
      DOMPurify.sanitize(
        bodyHtml || "<p style='color:#8b95a1'>본문이 비어있습니다.</p>",
        {
          ADD_ATTR: ["target"],
        },
      ),
    [bodyHtml],
  );
  const parseList = (s: string) =>
    s
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  const toList = parseList(to);
  const ccList = parseList(cc);
  const bccList = parseList(bcc);
  const doneAttachments = attachments.filter((a) => a.status === "done");

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.previewModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sigModalHead}>
          <h3 className={styles.sigModalTitle}>메일 미리보기</h3>
          <button
            type="button"
            className={styles.sigCloseBtn}
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>
        <div className={styles.previewBody}>
          <div className={styles.previewMeta}>
            <div className={styles.previewMetaRow}>
              <span className={styles.previewMetaLabel}>제목</span>
              <span className={styles.previewMetaValue}>
                {subject || <em className={styles.previewDim}>(제목 없음)</em>}
              </span>
            </div>
            <div className={styles.previewMetaRow}>
              <span className={styles.previewMetaLabel}>받는 사람</span>
              <span className={styles.previewMetaValue}>
                {toList.length > 0 ? (
                  toList.join(", ")
                ) : (
                  <em className={styles.previewDim}>(받는 사람 없음)</em>
                )}
              </span>
            </div>
            {ccList.length > 0 && (
              <div className={styles.previewMetaRow}>
                <span className={styles.previewMetaLabel}>참조</span>
                <span className={styles.previewMetaValue}>
                  {ccList.join(", ")}
                </span>
              </div>
            )}
            {bccList.length > 0 && (
              <div className={styles.previewMetaRow}>
                <span className={styles.previewMetaLabel}>숨은참조</span>
                <span className={styles.previewMetaValue}>
                  {bccList.join(", ")}
                </span>
              </div>
            )}
            {doneAttachments.length > 0 && (
              <div className={styles.previewMetaRow}>
                <span className={styles.previewMetaLabel}>첨부</span>
                <span className={styles.previewMetaValue}>
                  {doneAttachments.map((a, i) => (
                    <span key={a.id} className={styles.previewAttachItem}>
                      <Paperclip size={11} />
                      {a.filename}
                      <span className={styles.previewDim}>
                        ({formatBytes(a.size)})
                      </span>
                      {i < doneAttachments.length - 1 ? " " : ""}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>
          <div
            className={styles.previewContent}
            dangerouslySetInnerHTML={{ __html: safeBody }}
          />
        </div>
        <div className={styles.sigModalFooter}>
          <button
            type="button"
            className={styles.composeBtnPrimary}
            onClick={onClose}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 발송 성공 안내 화면 ────────────────────────────────────────────────
interface SentSuccessViewProps {
  recipients: string[];
  sentFolderSynced: boolean;
  onGoList: () => void;
  onCompose: () => void;
}
function SentSuccessView({
  recipients,
  sentFolderSynced,
  onGoList,
  onCompose,
}: SentSuccessViewProps) {
  const summary =
    recipients.length === 0
      ? ""
      : recipients.length === 1
        ? recipients[0]
        : `${recipients[0]} 외 ${recipients.length - 1}명`;

  return (
    <div className={styles.sentSuccess}>
      <div className={styles.sentIconWrap}>
        <Send size={28} className={styles.sentIcon} />
      </div>
      <h2 className={styles.sentTitle}>메일을 성공적으로 보냈습니다.</h2>
      {summary && <p className={styles.sentRecipients}>받는 사람: {summary}</p>}
      {!sentFolderSynced && (
        <p className={styles.sentNotice}>
          보낸편지함 동기화는 잠시 후 반영될 수 있어요.
        </p>
      )}
      <div className={styles.sentActions}>
        <button type="button" className={styles.sentBtn} onClick={onGoList}>
          메일 목록
        </button>
        <button type="button" className={styles.sentBtn} onClick={onCompose}>
          메일 쓰기
        </button>
      </div>
    </div>
  );
}

// ─── 서명 설정 모달 (고정 로고 + 이름/부서/연락처/주소) ──────────────────────
interface SignatureModalProps {
  initialHtml: string | null;
  onClose: () => void;
  onSaved: (html: string | null) => void;
}
function SignatureModal({
  initialHtml,
  onClose,
  onSaved,
}: SignatureModalProps) {
  const [data, setData] = useState<SignatureData>(() =>
    parseSignatureHtml(initialHtml),
  );
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 고정 로고를 절대 URL 로 사용 (base64 임베드 시 용량 초과 — 네이버 5,000byte 제한)
  useEffect(() => {
    if (typeof window === "undefined") return;
    setLogoDataUrl(`${window.location.origin}${SIGNATURE_LOGO_SRC}`);
  }, []);

  const set = <K extends keyof SignatureData>(
    key: K,
    value: SignatureData[K],
  ) => setData((prev) => ({ ...prev, [key]: value }));

  const previewHtml = useMemo(() => {
    const html = buildSignatureHtml(data, logoDataUrl);
    return html ? DOMPurify.sanitize(html) : "";
  }, [data, logoDataUrl]);

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      const html = buildSignatureHtml(data, logoDataUrl);
      const res = await fetch("/api/mail-credentials/signature", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureHtml: html || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.error ?? "저장에 실패했습니다.");
        return;
      }
      onSaved(html || null);
    } finally {
      setSaving(false);
    }
  };

  const fields: {
    key: keyof SignatureData;
    label: string;
    placeholder: string;
    type?: string;
  }[] = [
    { key: "name", label: "이름", placeholder: "예: 박상훈" },
    { key: "dept", label: "부서", placeholder: "예: 경영지원팀" },
    { key: "phone", label: "번호", placeholder: "예: 010-1234-5678" },
    {
      key: "email",
      label: "이메일",
      placeholder: "예: name@korhrdcorp.co.kr",
      type: "email",
    },
    {
      key: "address",
      label: "회사주소",
      placeholder: "예: 서울시 ○○구 ○○로 123",
    },
  ];

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.sigModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sigModalHead}>
          <h3 className={styles.sigModalTitle}>서명 설정</h3>
          <button
            type="button"
            className={styles.sigCloseBtn}
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.sigModalBody}>
          <p className={styles.sigHint}>
            새 메일을 작성할 때 본문 맨 위에 자동으로 들어갑니다. 로고는
            한평생그룹 로고로 고정됩니다.
          </p>

          {fields.map((f) => (
            <div key={f.key} className={styles.sigField}>
              <label className={styles.sigLabel}>{f.label}</label>
              <input
                type={f.type ?? "text"}
                className={styles.sigInput}
                value={data[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
            </div>
          ))}

          <div className={styles.sigField}>
            <label className={styles.sigLabel}>미리보기</label>
            {previewHtml ? (
              <div
                className={styles.sigPreview}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <div className={styles.sigPreviewEmpty}>
                내용을 입력하면 미리보기가 표시됩니다.
              </div>
            )}
            {!logoDataUrl && (
              <p className={styles.sigHint}>
                ⚠️ 로고 파일이 아직 없습니다.{" "}
                <code>public/mail-signature-logo.png</code> 에 로고를 저장하면
                자동으로 표시됩니다.
              </p>
            )}
          </div>

          {err && <div className={styles.sigError}>{err}</div>}
        </div>

        <div className={styles.sigModalFooter}>
          <button
            type="button"
            className={styles.composeBtnGhost}
            onClick={onClose}
            disabled={saving}
          >
            취소
          </button>
          <button
            type="button"
            className={styles.composeBtnPrimary}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
