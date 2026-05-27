"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Link2Off,
  CheckCircle2,
} from "lucide-react";
import styles from "./page.module.css";

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

const FOLDERS = [
  { key: "INBOX", label: "받은편지함", icon: Inbox },
  { key: "SENT", label: "보낸편지함", icon: Send },
  { key: "DRAFTS", label: "임시보관", icon: FileText },
  { key: "DELETED", label: "휴지통", icon: Trash2 },
] as const;
type FolderKey = (typeof FOLDERS)[number]["key"];

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MailDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
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
  const handleDisconnect = useCallback(async () => {
    if (!confirm("메일 자격증명을 삭제하시겠습니까? (메일 설정 페이지에서도 가능)")) return;
    try {
      await fetch("/api/mail-credentials/me", { method: "DELETE" });
      setConnection({ connected: false });
      setList([]);
      setDetail(null);
      setSelectedId(null);
    } catch {
      // ignore
    }
  }, []);

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
      const params = new URLSearchParams({ folder, count: "50" });
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
    setSelectedId(null);
    setDetail(null);
  }, [fetchList]);

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

  return (
    <div className={styles.app}>
      {/* 연결 정보 배지 (상단) */}
      <div className={styles.connectionBar}>
        <span className={styles.connectionBadge}>
          <CheckCircle2 size={14} />
          {connection.email || "메일 연결됨"}
        </span>
        {connectionMessage && (
          <span className={styles.connectionMessageInline}>{connectionMessage}</span>
        )}
        <button
          type="button"
          className={styles.disconnectBtn}
          onClick={handleDisconnect}
        >
          <Link2Off size={13} />
          연결 해제
        </button>
      </div>

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
                  onClick={() => setFolder(f.key)}
                >
                  <Icon size={15} />
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Middle: 메일 목록 */}
        <section className={styles.listCol}>
          <div className={styles.listHead}>
            <input
              className={styles.searchInput}
              placeholder="메일 검색 (제목/보낸이/내용)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
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
              list.map((m) => {
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
                return (
                  <div
                    key={m.messageId}
                    className={`${styles.mailItem} ${active ? styles.mailItemActive : ""} ${unread ? styles.mailItemUnread : ""}`}
                    onClick={() => setSelectedId(m.messageId)}
                  >
                    <div className={styles.mailItemTop}>
                      <span className={styles.mailFrom}>{displayName}</span>
                      <span className={styles.mailDate}>{fmtDate(date)}</span>
                    </div>
                    <div className={styles.mailSubject}>
                      {m.hasAttachment && (
                        <Paperclip size={12} className={styles.attachIcon} />
                      )}
                      {m.subject || "(제목 없음)"}
                    </div>
                    {m.bodyPreview && (
                      <div className={styles.mailPreview}>{m.bodyPreview}</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right: 메일 상세 (발송 직후 → 성공 안내 화면) */}
        <section className={styles.detailCol}>
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
      </div>

      {/* 작성 모달 */}
      {showCompose && (
        <ComposeModal
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
      )}
    </div>
  );
}

// ─── 작성 모달 ──────────────────────────────────────────────────────────
interface ComposeModalProps {
  replyTo?: string[];
  replySubject?: string;
  onClose: () => void;
  onSent: (sentFolderSynced: boolean, recipients: string[]) => void;
}
function ComposeModal({
  replyTo = [],
  replySubject = "",
  onClose,
  onSent,
}: ComposeModalProps) {
  const [to, setTo] = useState(replyTo.join(", "));
  const [subject, setSubject] = useState(replySubject);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
    setSending(true);
    try {
      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toList,
          subject: subject.trim(),
          bodyText: body,
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
    <div
      className={styles.modalOverlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.composeModal}>
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
          <div className={styles.composeRow}>
            <span className={styles.composeLabel}>제목</span>
            <input
              className={styles.composeInput}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="제목을 입력하세요"
            />
          </div>
          <textarea
            className={styles.composeTextarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="내용을 입력하세요"
          />
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
