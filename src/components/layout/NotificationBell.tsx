"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  CalendarClock,
  UserCheck,
  ClipboardList,
  CheckCircle,
  XCircle,
  FileText,
  X,
  UserPlus,
  Megaphone,
  LayoutGrid,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./NotificationBell.module.css";

// 새 공지가 들어올 때 자동 팝업 표시 여부 — 관리자 설정에서 토글
// app_settings.announcement_popup_enabled (boolean jsonb)
// 기본값은 false (관리자가 켜기 전까지 OFF)
const POPUP_SETTING_KEY = "announcement_popup_enabled";

interface AnnouncementAttachment {
  name: string;
  url: string;
  type?: string;
  size?: number;
}

interface Announcement {
  id: number;
  date: string;
  title: string;
  items: string[];
  attachments?: AnnouncementAttachment[] | null;
}

function formatFileSize(bytes?: number): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// Storage publicUrl에서 storage path를 추출해 다운로드 프록시 URL을 만든다
// (한글 깨짐 방지 + 강제 다운로드를 위해 API를 거침)
function buildDownloadUrl(att: AnnouncementAttachment): string {
  const marker = "/announcement-attachments/";
  const idx = att.url?.indexOf(marker);
  if (idx == null || idx === -1) return att.url;
  const path = att.url.slice(idx + marker.length);
  const params = new URLSearchParams({ path, filename: att.name });
  return `/api/announcements/download?${params.toString()}`;
}

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  actor_id?: number | null;
  target_date?: string | null;
}

type TabKey = "all" | "task" | "announcements";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

function isNewAnnouncement(date: string): boolean {
  return Date.now() - new Date(date).getTime() < 86400000;
}

// 로컬 기준 오늘 작성된 알림인지
function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// 한국 시간(KST) 기준 오늘 YYYY-MM-DD
function todayKstStr(): string {
  const now = new Date();
  // UTC+9
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// 업무보드 알림이 오늘 적용 대상인지
// target_date(YYYY-MM-DD) 우선, 없으면 created_at 기준 fallback
function isTaskActiveToday(n: Notification): boolean {
  if (n.target_date) {
    return n.target_date === todayKstStr();
  }
  return isToday(n.created_at);
}

function TypeIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    NEW_CONSULTATION: <UserPlus size={20} />,
    CONTACT_SCHEDULED: <CalendarClock size={20} />,
    MANAGER_ASSIGNED: <UserCheck size={20} />,
    APPROVAL_APPROVED: <CheckCircle size={20} />,
    APPROVAL_REJECTED: <XCircle size={20} />,
    APPROVAL_SUBMITTED: <FileText size={20} />,
    task_board: <LayoutGrid size={20} />,
  };
  return (
    <div className={styles.typeIcon}>
      {icons[type] ?? <ClipboardList size={20} />}
    </div>
  );
}

function getSeenIds(): number[] {
  try {
    return JSON.parse(localStorage.getItem("seenAnnouncementIds") ?? "[]");
  } catch {
    return [];
  }
}
function setSeenIds(ids: number[]) {
  try {
    localStorage.setItem("seenAnnouncementIds", JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

// task_board 알림용 seen IDs (로그인 시 미확인 알림 1회 팝업)
function getSeenTaskIds(): number[] {
  try {
    return JSON.parse(localStorage.getItem("seenTaskNotifIds") ?? "[]");
  } catch {
    return [];
  }
}
function setSeenTaskIds(ids: number[]) {
  try {
    // 최근 200건만 보존
    const capped = ids.slice(-200);
    localStorage.setItem("seenTaskNotifIds", JSON.stringify(capped));
  } catch {
    /* ignore */
  }
}

// 결재 도착 알림(APPROVAL_SUBMITTED)용 seen IDs
function getSeenApprovalIds(): number[] {
  try {
    return JSON.parse(localStorage.getItem("seenApprovalNotifIds") ?? "[]");
  } catch {
    return [];
  }
}
function setSeenApprovalIds(ids: number[]) {
  try {
    const capped = ids.slice(-200);
    localStorage.setItem("seenApprovalNotifIds", JSON.stringify(capped));
  } catch {
    /* ignore */
  }
}

const RESTRICTED_POSITIONS = new Set(["사원", "주임"]);
const HIDDEN_TYPES_FOR_RESTRICTED = new Set(["NEW_CONSULTATION"]);

// 사원/주임에게는 "누가 신청했는지"가 노출되는 접수류 알림을 숨긴다.
// 결재 상신(APPROVAL_SUBMITTED)은 본인이 결재자로 지정된 건만 오므로 제외.
function isRestrictedHiddenNotification(n: {
  type: string;
  title: string;
  message: string;
}): boolean {
  if (HIDDEN_TYPES_FOR_RESTRICTED.has(n.type)) return true;
  if (n.type.startsWith("APPROVAL_")) return false;
  const title = n.title ?? "";
  if (title.startsWith("새 ") && title.includes("접수")) return true;
  const message = n.message ?? "";
  if (/님이\s.*신청했습니다/.test(message)) return true;
  return false;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unseenCount, setUnseenCount] = useState(0);
  const [isRestricted, setIsRestricted] = useState(false);
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  // 공지 (Realtime)
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  // 새 공지 안내 팝업 (한 번만)
  const [showNewPopup, setShowNewPopup] = useState(false);
  const [pendingNewIds, setPendingNewIds] = useState<number[]>([]);
  // 관리자 설정: 새 공지 팝업 ON/OFF (DB에서 불러옴)
  const popupEnabledRef = useRef<boolean>(false);
  // 업무 알림 팝업
  const [taskPopup, setTaskPopup] = useState<Notification | null>(null);
  const lastTaskIdRef = useRef<number | null>(null);
  // 결재 도착 알림 팝업
  const [approvalPopup, setApprovalPopup] = useState<Notification | null>(null);
  const lastApprovalIdRef = useRef<number | null>(null);
  // 본인 작성 알림 억제용 자기 ID (ref + state — state는 useEffect 트리거용)
  const myIdRef = useRef<number | null>(null);
  const [myId, setMyId] = useState<number | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      /* ignore */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }, []);

  const deleteAll = useCallback(async () => {
    setNotifications([]);
    setUnreadCount(0);
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }, []);

  const deleteOne = useCallback(async (id: number) => {
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id);
      if (target && !target.is_read) setUnreadCount((c) => Math.max(0, c - 1));
      return prev.filter((n) => n.id !== id);
    });
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(markAllRead, 1200);
    return () => clearTimeout(timer);
  }, [open, markAllRead]);

  useEffect(() => {
    fetch("/api/notifications/check-stale").catch(() => {});
  }, []);

  // 관리자 설정: 새 공지 팝업 ON/OFF 로드
  useEffect(() => {
    fetch(`/api/app-settings?key=${POPUP_SETTING_KEY}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        popupEnabledRef.current = data?.value === true;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const pos = (data?.positionName ?? "").trim();
        setIsRestricted(RESTRICTED_POSITIONS.has(pos));
        if (typeof data?.id === "number") {
          myIdRef.current = data.id;
          setMyId(data.id);
        }
      })
      .catch(() => {});
  }, []);

  // 로그인/마운트 시 미확인 + 오늘 적용 task_board 알림이 있으면 팝업으로 1회 노출
  useEffect(() => {
    if (myId === null) return;
    if (taskPopup) return;
    const seen = getSeenTaskIds();
    // 오늘 적용(target_date === 오늘 KST) + 미확인 + 본인 작성 아님 가장 최신 1건
    const candidate = notifications.find(
      (n) =>
        n.type === "task_board" &&
        isTaskActiveToday(n) &&
        !seen.includes(n.id) &&
        (n.actor_id == null || Number(n.actor_id) !== myId),
    );
    if (candidate && lastTaskIdRef.current !== candidate.id) {
      lastTaskIdRef.current = candidate.id;
      setTaskPopup(candidate);
    }
  }, [notifications, myId, taskPopup]);

  // 로그인/마운트 시 미확인 결재 도착(APPROVAL_SUBMITTED) 알림이 있으면 팝업으로 1회 노출
  useEffect(() => {
    if (approvalPopup) return;
    const seen = getSeenApprovalIds();
    const candidate = notifications.find(
      (n) =>
        n.type === "APPROVAL_SUBMITTED" &&
        !n.is_read &&
        !seen.includes(n.id),
    );
    if (candidate && lastApprovalIdRef.current !== candidate.id) {
      lastApprovalIdRef.current = candidate.id;
      setApprovalPopup(candidate);
    }
  }, [notifications, approvalPopup]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    const supabase = createClient();
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          fetchNotifications();
          const n = payload.new as Notification;
          // 업무 알림이면 공지처럼 팝업 (target_date가 오늘 + 본인 X + 미확인)
          if (n?.type === "task_board" && n.id !== lastTaskIdRef.current) {
            const isMine =
              myIdRef.current !== null &&
              n.actor_id != null &&
              Number(n.actor_id) === myIdRef.current;
            const alreadySeen = getSeenTaskIds().includes(n.id);
            const todayActive = isTaskActiveToday(n);
            if (todayActive && !isMine && !alreadySeen) {
              lastTaskIdRef.current = n.id;
              setTaskPopup(n);
            }
          }
          // 결재 도착 알림(APPROVAL_SUBMITTED) — 본인에게 결재선이 지정된 경우 즉시 팝업
          if (
            n?.type === "APPROVAL_SUBMITTED" &&
            n.id !== lastApprovalIdRef.current
          ) {
            const alreadySeen = getSeenApprovalIds().includes(n.id);
            if (!alreadySeen) {
              lastApprovalIdRef.current = n.id;
              setApprovalPopup(n);
            }
          }
        },
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      clearInterval(interval);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [fetchNotifications]);

  // 공지 초기 로드 + Realtime 구독
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const fetchAnnouncements = async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .order("date", { ascending: false })
        .order("id", { ascending: false });
      if (cancelled) return;
      const list = (data ?? []) as Announcement[];
      setAnnouncements(list);

      // 마운트 시 새 공지(24h 이내 + seen 안 됨) 감지 → 팝업
      const seen = getSeenIds();
      const newOnes = list.filter(
        (a) => isNewAnnouncement(a.date) && !seen.includes(a.id),
      );
      if (newOnes.length > 0 && popupEnabledRef.current) {
        setPendingNewIds(newOnes.map((a) => a.id));
        setShowNewPopup(true);
      }
      const count = list.filter(
        (a) => isNewAnnouncement(a.date) && !seen.includes(a.id),
      ).length;
      setUnseenCount(count);
    };

    fetchAnnouncements();

    const channel = supabase
      .channel("announcements-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements" },
        (payload) => {
          console.log('[announcements] realtime INSERT', payload)
          const a = payload.new as Announcement;
          setAnnouncements((prev) =>
            prev.some((p) => p.id === a.id) ? prev : [a, ...prev],
          );
          const seen = getSeenIds();
          if (!seen.includes(a.id) && isNewAnnouncement(a.date)) {
            if (popupEnabledRef.current) {
              setPendingNewIds((prev) =>
                prev.includes(a.id) ? prev : [...prev, a.id],
              );
              setShowNewPopup(true);
            }
            setUnseenCount((c) => c + 1);
          }
        },
      )
      .subscribe((status, err) => {
        console.log('[announcements] subscribe status:', status, err ?? '')
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // 공지 탭 열면 현재 NEW 공지를 seen 처리
  useEffect(() => {
    if (tab !== "announcements" || !open) return;
    const newIds = announcements
      .filter((a) => isNewAnnouncement(a.date))
      .map((a) => a.id);
    if (newIds.length === 0) return;
    const seen = getSeenIds();
    const merged = Array.from(new Set([...seen, ...newIds]));
    setSeenIds(merged);
    setUnseenCount(0);
  }, [tab, open, announcements]);

  // 새 공지 팝업: 확인/닫기 모두 seen 처리
  const dismissNewPopup = useCallback(
    (openModal: boolean) => {
      setShowNewPopup(false);
      if (pendingNewIds.length > 0) {
        const seen = getSeenIds();
        setSeenIds(Array.from(new Set([...seen, ...pendingNewIds])));
        setPendingNewIds([]);
      }
      if (openModal) {
        setTab("announcements");
        setOpen(true);
      } else {
        // 닫기만 — 벨 카운트는 그대로 유지하지 않고 0으로
        setUnseenCount(0);
      }
    },
    [pendingNewIds],
  );

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const handleClickNotification = (n: Notification) => {
    if (n.link) window.location.href = n.link;
    setOpen(false);
  };

  const accessibleNotifications = isRestricted
    ? notifications.filter((n) => !isRestrictedHiddenNotification(n))
    : notifications;
  const taskNotifications = accessibleNotifications.filter(
    (n) => n.type === "task_board",
  );
  const visibleNotifications =
    tab === "task" ? taskNotifications : accessibleNotifications;
  const visibleUnreadCount = accessibleNotifications.filter(
    (n) => !n.is_read,
  ).length;

  const modal = open ? (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="알림"
      >
        {/* 좌측 사이드바 */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>알림</div>
          <nav className={styles.sidebarNav}>
            <button
              className={`${styles.sidebarItem} ${tab === "all" ? styles.sidebarItemActive : ""}`}
              onClick={() => setTab("all")}
            >
              전체 알림
              {accessibleNotifications.length > 0 && (
                <span className={styles.sidebarCount}>
                  {accessibleNotifications.length}
                </span>
              )}
            </button>
            <button
              className={`${styles.sidebarItem} ${tab === "task" ? styles.sidebarItemActive : ""}`}
              onClick={() => setTab("task")}
            >
              업무 알림
              {taskNotifications.length > 0 && (
                <span className={styles.sidebarCount}>
                  {taskNotifications.length}
                </span>
              )}
            </button>
            <button
              className={`${styles.sidebarItem} ${tab === "announcements" ? styles.sidebarItemActive : ""}`}
              onClick={() => setTab("announcements")}
            >
              공지
              {unseenCount > 0 && (
                <span
                  className={`${styles.sidebarCount} ${styles.sidebarCountUnread}`}
                >
                  {unseenCount}
                </span>
              )}
            </button>
          </nav>
        </aside>

        {/* 우측 콘텐츠 */}
        <div className={styles.content}>
          <div className={styles.contentHeader}>
            <span className={styles.contentTitle}>
              {tab === "all" && "전체 알림"}
              {tab === "task" && "업무 알림"}
              {tab === "announcements" && "공지"}
            </span>
            <div className={styles.contentActions}>
              {tab !== "announcements" && (
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                  onClick={deleteAll}
                >
                  <X size={14} />
                  전체 삭제
                </button>
              )}
              <button
                className={styles.closeBtn}
                onClick={() => setOpen(false)}
                aria-label="닫기"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className={styles.contentBody}>
            {tab === "announcements" ? (
              announcements.length === 0 ? (
                <div className={styles.empty}>
                  <Megaphone size={32} className={styles.emptyIcon} />
                  <p className={styles.emptyText}>등록된 공지가 없어요</p>
                </div>
              ) : (
                <div className={styles.announcementList}>
                  {(() => {
                    const groups = announcements.reduce<
                      { date: string; entries: Announcement[] }[]
                    >((acc, a) => {
                      const last = acc[acc.length - 1];
                      if (last && last.date === a.date) {
                        last.entries.push(a);
                      } else acc.push({ date: a.date, entries: [a] });
                      return acc;
                    }, []);
                    return groups.map((g, gi) => (
                      <div key={g.date} className={styles.announcementItem}>
                        <div className={styles.timelineTrack}>
                          <div className={styles.timelineDot} />
                          {gi < groups.length - 1 && (
                            <div className={styles.timelineLine} />
                          )}
                        </div>
                        <div className={styles.announcementContent}>
                          <div className={styles.announcementMeta}>
                            {isNewAnnouncement(g.date) && (
                              <span className={styles.announcementBadge}>
                                NEW
                              </span>
                            )}
                            <span className={styles.announcementDate}>
                              {g.date}
                            </span>
                          </div>
                          {g.entries.map((a) => (
                            <div
                              key={a.id}
                              className={styles.announcementEntry}
                            >
                              <p className={styles.announcementTitle}>
                                {a.title}
                              </p>
                              <ul className={styles.announcementBody}>
                                {a.items.map((item, i) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                              {a.attachments && a.attachments.length > 0 && (
                                <div className={styles.attachmentList}>
                                  {a.attachments.map((att, i) => (
                                    <a
                                      key={i}
                                      href={buildDownloadUrl(att)}
                                      className={styles.attachmentItem}
                                      download={att.name}
                                    >
                                      <FileText size={14} />
                                      <span className={styles.attachmentName}>
                                        {att.name}
                                      </span>
                                      {att.size != null && (
                                        <span
                                          className={styles.attachmentSize}
                                        >
                                          {formatFileSize(att.size)}
                                        </span>
                                      )}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )
            ) : visibleNotifications.length === 0 ? (
              <div className={styles.empty}>
                <Bell size={32} className={styles.emptyIcon} />
                <p className={styles.emptyText}>
                  {tab === "task"
                    ? "업무 알림이 없어요"
                    : "새로운 알림이 없어요"}
                </p>
                <p className={styles.emptySubText}>
                  알림이 오면 여기에 표시돼요
                </p>
              </div>
            ) : (
              visibleNotifications.map((n) => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  className={`${styles.item} ${!n.is_read ? styles.itemUnread : ""}`}
                  onClick={() => handleClickNotification(n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      handleClickNotification(n);
                  }}
                >
                  <TypeIcon type={n.type} />
                  <div className={styles.itemContent}>
                    <span className={styles.itemMessage}>{n.message}</span>
                    <span className={styles.itemMeta}>
                      {timeAgo(n.created_at)} · {n.title}
                    </span>
                  </div>
                  <button
                    className={styles.itemClose}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteOne(n.id);
                    }}
                    aria-label="삭제"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  // 업무 알림 팝업 (공지 팝업과 동일한 디자인)
  const dismissTaskPopup = (openLink: boolean) => {
    if (taskPopup) {
      const seen = getSeenTaskIds();
      setSeenTaskIds(Array.from(new Set([...seen, taskPopup.id])));
    }
    const link = taskPopup?.link ?? null;
    setTaskPopup(null);
    if (openLink && link) window.location.href = link;
  };

  const taskPopupEl = taskPopup ? (
    <div
      className={styles.newPopupOverlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismissTaskPopup(false);
      }}
    >
      <div className={styles.newPopup} role="dialog" aria-modal="true">
        <div className={styles.typeIcon} style={{ marginBottom: 8 }}>
          <LayoutGrid size={28} />
        </div>
        <div className={styles.newPopupTitle}>{taskPopup.title}</div>
        <div className={styles.newPopupDesc} style={{ whiteSpace: "pre-wrap" }}>
          {taskPopup.message}
        </div>
        <div className={styles.newPopupActions}>
          <button
            className={styles.newPopupBtnGhost}
            onClick={() => dismissTaskPopup(false)}
          >
            확인
          </button>
          <button
            className={styles.newPopupBtnPrimary}
            onClick={() => dismissTaskPopup(true)}
          >
            보러가기
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // 결재 도착 알림 팝업
  const dismissApprovalPopup = (openLink: boolean) => {
    if (approvalPopup) {
      const seen = getSeenApprovalIds();
      setSeenApprovalIds(Array.from(new Set([...seen, approvalPopup.id])));
    }
    const link = approvalPopup?.link ?? null;
    setApprovalPopup(null);
    if (openLink && link) window.location.href = link;
  };

  const approvalPopupEl = approvalPopup ? (
    <div
      className={styles.newPopupOverlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismissApprovalPopup(false);
      }}
    >
      <div className={styles.newPopup} role="dialog" aria-modal="true">
        <div className={styles.typeIcon} style={{ marginBottom: 8 }}>
          <FileText size={28} />
        </div>
        <div className={styles.newPopupTitle}>
          {approvalPopup.title || "결재선이 지정되었습니다"}
        </div>
        <div className={styles.newPopupDesc} style={{ whiteSpace: "pre-wrap" }}>
          {approvalPopup.message}
        </div>
        <div className={styles.newPopupActions}>
          <button
            className={styles.newPopupBtnGhost}
            onClick={() => dismissApprovalPopup(false)}
          >
            나중에
          </button>
          <button
            className={styles.newPopupBtnPrimary}
            onClick={() => dismissApprovalPopup(true)}
          >
            결재하러 가기
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // 새 공지 팝업
  const newPopup = showNewPopup ? (
    <div
      className={styles.newPopupOverlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismissNewPopup(false);
      }}
    >
      <div className={styles.newPopup} role="dialog" aria-modal="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/noti.png"
          alt="새 공지"
          width={88}
          height={88}
          className={styles.newPopupImage}
        />
        <div className={styles.newPopupTitle}>새로운 공지가 있습니다</div>
        <div className={styles.newPopupDesc}>
          {pendingNewIds.length > 1
            ? `읽지 않은 공지가 있어요. 확인하시겠습니까?`
            : "확인하시겠습니까?"}
        </div>
        <div className={styles.newPopupActions}>
          <button
            className={styles.newPopupBtnGhost}
            onClick={() => dismissNewPopup(false)}
          >
            닫기
          </button>
          <button
            className={styles.newPopupBtnPrimary}
            onClick={() => dismissNewPopup(true)}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className={styles.wrap}>
      <button
        className={`${styles.bellBtn} ${visibleUnreadCount + unseenCount > 0 ? styles.bellBtnActive : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="알림"
      >
        <Bell size={18} />
        {visibleUnreadCount + unseenCount > 0 && (
          <span className={styles.badge}>
            {visibleUnreadCount + unseenCount > 99
              ? "99+"
              : visibleUnreadCount + unseenCount}
          </span>
        )}
      </button>

      {typeof document !== "undefined" &&
        modal &&
        createPortal(modal, document.body)}
      {typeof document !== "undefined" &&
        newPopup &&
        createPortal(newPopup, document.body)}
      {typeof document !== "undefined" &&
        taskPopupEl &&
        createPortal(taskPopupEl, document.body)}
      {typeof document !== "undefined" &&
        approvalPopupEl &&
        createPortal(approvalPopupEl, document.body)}
    </div>
  );
}
