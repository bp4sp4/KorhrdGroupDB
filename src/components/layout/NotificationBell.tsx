'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Bell, CalendarClock, UserCheck, ClipboardList, CheckCircle, XCircle, FileText, X, UserPlus, Megaphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ANNOUNCEMENTS from '@/lib/announcements'
import styles from './NotificationBell.module.css'

interface Notification {
  id: number
  type: string
  title: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string
}

type TabKey = 'all' | 'unread' | 'announcements'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

function isNewAnnouncement(date: string): boolean {
  return (Date.now() - new Date(date).getTime()) < 86400000
}

function TypeIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    NEW_CONSULTATION:   <UserPlus size={20} />,
    CONTACT_SCHEDULED:  <CalendarClock size={20} />,
    MANAGER_ASSIGNED:   <UserCheck size={20} />,
    APPROVAL_APPROVED:  <CheckCircle size={20} />,
    APPROVAL_REJECTED:  <XCircle size={20} />,
    APPROVAL_SUBMITTED: <FileText size={20} />,
  }
  return (
    <div className={styles.typeIcon}>
      {icons[type] ?? <ClipboardList size={20} />}
    </div>
  )
}

// 24시간 이내 NEW 공지 id 목록
const NEW_ANNOUNCEMENT_IDS = ANNOUNCEMENTS.filter(a => isNewAnnouncement(a.date)).map(a => a.id)

function getSeenIds(): number[] {
  try { return JSON.parse(localStorage.getItem('seenAnnouncementIds') ?? '[]') } catch { return [] }
}

const RESTRICTED_POSITIONS = new Set(['사원', '주임'])
const HIDDEN_TYPES_FOR_RESTRICTED = new Set(['NEW_CONSULTATION'])

// 사원/주임에게는 "누가 신청했는지"가 노출되는 접수류 알림을 숨긴다.
// 결재 상신(APPROVAL_SUBMITTED)은 본인이 결재자로 지정된 건만 오므로 제외.
function isRestrictedHiddenNotification(n: { type: string; title: string; message: string }): boolean {
  if (HIDDEN_TYPES_FOR_RESTRICTED.has(n.type)) return true
  if (n.type.startsWith('APPROVAL_')) return false
  const title = n.title ?? ''
  if (title.startsWith('새 ') && title.includes('접수')) return true
  const message = n.message ?? ''
  if (/님이\s.*신청했습니다/.test(message)) return true
  return false
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabKey>('all')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [unseenCount, setUnseenCount] = useState(0)
  const [isRestricted, setIsRestricted] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch { /* ignore */ }
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
  }, [])

  const deleteAll = useCallback(async () => {
    setNotifications([])
    setUnreadCount(0)
    await fetch('/api/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
  }, [])

  const deleteOne = useCallback(async (id: number) => {
    setNotifications(prev => {
      const target = prev.find(n => n.id === id)
      if (target && !target.is_read) setUnreadCount(c => Math.max(0, c - 1))
      return prev.filter(n => n.id !== id)
    })
    await fetch('/api/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
  }, [])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(markAllRead, 1200)
    return () => clearTimeout(timer)
  }, [open, markAllRead])

  useEffect(() => {
    fetch('/api/notifications/check-stale').catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const pos = (data?.positionName ?? '').trim()
        setIsRestricted(RESTRICTED_POSITIONS.has(pos))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 15000)
    const supabase = createClient()
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications()
      })
      .subscribe()
    channelRef.current = channel
    return () => {
      clearInterval(interval)
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [fetchNotifications])

  // 마운트 시 unseen 공지 수 계산
  useEffect(() => {
    const seen = getSeenIds()
    const count = NEW_ANNOUNCEMENT_IDS.filter(id => !seen.includes(id)).length
    setUnseenCount(count)
  }, [])

  // 공지 탭 열면 seen 처리
  useEffect(() => {
    if (tab !== 'announcements' || !open) return
    const seen = getSeenIds()
    const merged = Array.from(new Set([...seen, ...NEW_ANNOUNCEMENT_IDS]))
    try { localStorage.setItem('seenAnnouncementIds', JSON.stringify(merged)) } catch { /* ignore */ }
    setUnseenCount(0)
  }, [tab, open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const handleClickNotification = (n: Notification) => {
    if (n.link) window.location.href = n.link
    setOpen(false)
  }

  const accessibleNotifications = isRestricted
    ? notifications.filter(n => !isRestrictedHiddenNotification(n))
    : notifications
  const visibleNotifications = tab === 'unread'
    ? accessibleNotifications.filter(n => !n.is_read)
    : accessibleNotifications
  const visibleUnreadCount = accessibleNotifications.filter(n => !n.is_read).length

  const modal = open ? (
    <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="알림">

        {/* 좌측 사이드바 */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>알림</div>
          <nav className={styles.sidebarNav}>
            <button
              className={`${styles.sidebarItem} ${tab === 'all' ? styles.sidebarItemActive : ''}`}
              onClick={() => setTab('all')}
            >
              전체 알림
              {accessibleNotifications.length > 0 && <span className={styles.sidebarCount}>{accessibleNotifications.length}</span>}
            </button>
            <button
              className={`${styles.sidebarItem} ${tab === 'unread' ? styles.sidebarItemActive : ''}`}
              onClick={() => setTab('unread')}
            >
              안읽은 알림
              {visibleUnreadCount > 0 && <span className={`${styles.sidebarCount} ${styles.sidebarCountUnread}`}>{visibleUnreadCount}</span>}
            </button>
            <button
              className={`${styles.sidebarItem} ${tab === 'announcements' ? styles.sidebarItemActive : ''}`}
              onClick={() => setTab('announcements')}
            >
              공지
              {unseenCount > 0 && <span className={`${styles.sidebarCount} ${styles.sidebarCountUnread}`}>{unseenCount}</span>}
            </button>
          </nav>
        </aside>

        {/* 우측 콘텐츠 */}
        <div className={styles.content}>
          <div className={styles.contentHeader}>
            <span className={styles.contentTitle}>
              {tab === 'all' && '전체 알림'}
              {tab === 'unread' && '안읽은 알림'}
              {tab === 'announcements' && '공지'}
            </span>
            <div className={styles.contentActions}>
              {tab !== 'announcements' && (
                <>
                  <button className={styles.actionBtn} onClick={markAllRead}>
                    <CheckCircle size={14} />
                    전체 읽음
                  </button>
                  <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={deleteAll}>
                    <X size={14} />
                    전체 삭제
                  </button>
                </>
              )}
              <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="닫기">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className={styles.contentBody}>
            {tab === 'announcements' ? (
              ANNOUNCEMENTS.length === 0 ? (
                <div className={styles.empty}>
                  <Megaphone size={32} className={styles.emptyIcon} />
                  <p className={styles.emptyText}>등록된 공지가 없어요</p>
                </div>
              ) : (
                <div className={styles.announcementList}>
                  {(() => {
                    const groups = ANNOUNCEMENTS.reduce<{ date: string; entries: typeof ANNOUNCEMENTS }[]>((acc, a) => {
                      const last = acc[acc.length - 1]
                      if (last && last.date === a.date) { last.entries.push(a) }
                      else acc.push({ date: a.date, entries: [a] })
                      return acc
                    }, [])
                    return groups.map((g, gi) => (
                      <div key={g.date} className={styles.announcementItem}>
                        <div className={styles.timelineTrack}>
                          <div className={styles.timelineDot} />
                          {gi < groups.length - 1 && <div className={styles.timelineLine} />}
                        </div>
                        <div className={styles.announcementContent}>
                          <div className={styles.announcementMeta}>
                            {isNewAnnouncement(g.date) && (
                              <span className={styles.announcementBadge}>NEW</span>
                            )}
                            <span className={styles.announcementDate}>{g.date}</span>
                          </div>
                          {g.entries.map(a => (
                            <div key={a.id} className={styles.announcementEntry}>
                              <p className={styles.announcementTitle}>{a.title}</p>
                              <ul className={styles.announcementBody}>
                                {a.items.map((item, i) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              )
            ) : visibleNotifications.length === 0 ? (
              <div className={styles.empty}>
                <Bell size={32} className={styles.emptyIcon} />
                <p className={styles.emptyText}>
                  {tab === 'unread' ? '읽지 않은 알림이 없어요' : '새로운 알림이 없어요'}
                </p>
                <p className={styles.emptySubText}>알림이 오면 여기에 표시돼요</p>
              </div>
            ) : (
              visibleNotifications.map(n => (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  className={`${styles.item} ${!n.is_read ? styles.itemUnread : ''}`}
                  onClick={() => handleClickNotification(n)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClickNotification(n) }}
                >
                  <TypeIcon type={n.type} />
                  <div className={styles.itemContent}>
                    <span className={styles.itemMessage}>{n.message}</span>
                    <span className={styles.itemMeta}>{timeAgo(n.created_at)} · {n.title}</span>
                  </div>
                  <button
                    className={styles.itemClose}
                    onClick={(e) => { e.stopPropagation(); deleteOne(n.id) }}
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
  ) : null

  return (
    <div className={styles.wrap}>
      <button
        className={`${styles.bellBtn} ${(visibleUnreadCount + unseenCount) > 0 ? styles.bellBtnActive : ''}`}
        onClick={() => setOpen(v => !v)}
        title="알림"
      >
        <Bell size={18} />
        {(visibleUnreadCount + unseenCount) > 0 && (
          <span className={styles.badge}>{(visibleUnreadCount + unseenCount) > 99 ? '99+' : visibleUnreadCount + unseenCount}</span>
        )}
      </button>

      {typeof document !== 'undefined' && modal && createPortal(modal, document.body)}
    </div>
  )
}
