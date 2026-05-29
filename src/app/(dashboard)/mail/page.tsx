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
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

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
        prev.map((m) =>
          selectedIds.has(m.messageId) ? { ...m, isRead } : m,
        ),
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

  const replyTo = useMemo(() => {
    if (!detail?.from) return [];
    return [detail.from.emailAddress.address];
  }, [detail]);

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
            onClick={() => setShowCompose(true)}
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
            replyTo={replyTo}
            replySubject={detail?.subject ? `Re: ${detail.subject}` : undefined}
            onClose={() => setShowCompose(false)}
            onSent={(sentFolderSynced, recipients) => {
              setShowCompose(false);
              setSentInfo({ recipients, sentFolderSynced });
              setSelectedId(null);
              setDetail(null);
              if (folder === "SENT") fetchList();
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
            <span className={styles.toolbarDivider} aria-hidden="true" />
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
                const isOutbox = folder === "SENT" || folder === "DRAFTS";
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
                          if (next.has(m.messageId)) next.delete(m.messageId);
                          else next.add(m.messageId);
                          return next;
                        });
                      }}
                      aria-label="별표"
                    >
                      <Star size={15} fill={star ? "#ffc107" : "none"} />
                    </button>
                    <span className={styles.rowReadIcon}>
                      {unread ? <Mail size={15} /> : <MailOpen size={15} />}
                    </span>
                    <span className={styles.rowFrom}>{displayName}</span>
                    <span className={styles.rowSubject}>
                      {m.hasAttachment && (
                        <Paperclip size={12} className={styles.attachIcon} />
                      )}
                      {m.subject || "(제목 없음)"}
                    </span>
                    <span className={styles.rowDate}>{fmtDate(date)}</span>
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
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.pagerNum} ${p === currentPage ? styles.pagerNumActive : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                className={styles.pagerBtn}
                disabled={currentPage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
              <span>{FOLDERS.find((f) => f.key === folder)?.label ?? "목록"}</span>
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
                setShowCompose(true);
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
                  onClick={() => setShowCompose(true)}
                >
                  <Reply size={13} />
                  답장
                </button>
                <button type="button" className={styles.actionBtn}>
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
                  __html:
                    detail.body?.contentType === "HTML"
                      ? detail.body.content
                      : `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(detail.body?.content ?? "")}</pre>`,
                }}
              />

              {detail.attachments && detail.attachments.length > 0 && (
                <div className={styles.detailAttachments}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#4e5968" }}>
                    첨부파일 {detail.attachments.length}개
                  </div>
                  {detail.attachments.map((a) => (
                    <div key={a.attachmentId} className={styles.attachItem}>
                      <Paperclip size={13} />
                      <span>{a.fileName}</span>
                      <span style={{ marginLeft: "auto", color: "#8b95a1", fontSize: 11 }}>
                        {formatBytes(a.size)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className={styles.detailEmpty}>불러올 수 없습니다.</div>
          )}
        </section>
        )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── 작성 패널 (인라인) ───────────────────────────────────────────────────
interface ComposePaneProps {
  replyTo?: string[];
  replySubject?: string;
  onClose: () => void;
  onSent: (sentFolderSynced: boolean, recipients: string[]) => void;
}
function ComposePane({
  replyTo = [],
  replySubject = "",
  onClose,
  onSent,
}: ComposePaneProps) {
  const [to, setTo] = useState(replyTo.join(", "));
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState(replySubject);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bodyHtml, setBodyHtml] = useState("");
  // 첨부 — Supabase Storage 직접 업로드 (Vercel 요청 한도 우회, 최대 25MB)
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const MAX_FILE_BYTES = 25 * 1024 * 1024;

  // 파일 선택 → 서명 URL 받아 Storage 에 직접 업로드
  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
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
          if (!signRes.ok || !sign.ok) throw new Error(sign.error ?? "sign fail");
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
  const removeFile = (idx: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== idx));

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
        c.tagName === "TH" ? base + "background:#f2f4f6;font-weight:700;" : base,
      );
    });
    return doc.body.innerHTML;
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
    const parseAddrs = (s: string) =>
      s
        .split(/[,;\s]+/)
        .map((x) => x.trim())
        .filter(Boolean);
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
          <h3 className={styles.composeTitle}>새 메일 작성</h3>
          <button
            type="button"
            className={styles.composeCloseBtn}
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={16} />
          </button>
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
            <input
              className={styles.composeInput}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="example@email.com, ..."
            />
          </div>
          {/* 참조 — 항상 표시, 우측 화살표로 숨은참조 토글 */}
          <div className={styles.composeRow}>
            <span className={styles.composeLabel}>참조</span>
            <input
              className={styles.composeInput}
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="참조 (쉼표로 구분)"
            />
            <button
              type="button"
              className={styles.refArrowBtn}
              onClick={() => setShowBcc((v) => !v)}
              aria-expanded={showBcc}
              aria-label="숨은참조"
              title="숨은참조"
            >
              {showBcc ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          {showBcc && (
            <div className={styles.composeRow}>
              <span className={styles.composeLabel}>숨은참조</span>
              <input
                className={styles.composeInput}
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="숨은참조 (쉼표로 구분)"
                autoFocus
              />
            </div>
          )}
          <div className={styles.composeRow}>
            <span className={styles.composeLabel}>제목</span>
            <input
              className={styles.composeInput}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
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

          {/* 본문 — TUI Editor */}
          <div className={styles.editorWrap}>
            <MailEditor onChange={setBodyHtml} />
          </div>
        </div>

        <div className={styles.composeFooter}>
          <button
            type="button"
            className={styles.composeBtnGhost}
            onClick={onClose}
            disabled={sending}
          >
            취소
          </button>
          <button
            type="button"
            className={styles.composeBtnPrimary}
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? "전송 중..." : "보내기"}
          </button>
        </div>
    </section>
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
        <button
          type="button"
          className={styles.sentBtn}
          onClick={onGoList}
        >
          메일 목록
        </button>
        <button
          type="button"
          className={styles.sentBtn}
          onClick={onCompose}
        >
          메일 쓰기
        </button>
      </div>
    </div>
  );
}
