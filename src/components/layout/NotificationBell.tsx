'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, CalendarClock, UserCheck, ClipboardList, CheckCircle, XCircle, FileText, X, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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

function TypeIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    NEW_CONSULTATION:  <UserPlus size={20} />,
    CONTACT_SCHEDULED: <CalendarClock size={20} />,
    MANAGER_ASSIGNED:  <UserCheck size={20} />,
    APPROVAL_APPROVED: <CheckCircle size={20} />,
    APPROVAL_REJECTED: <XCircle size={20} />,
    APPROVAL_SUBMITTED: <FileText size={20} />,
  }
  return (
    <div className={styles.typeIcon}>
      {icons[type] ?? <ClipboardList size={20} />}
    </div>
  )
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
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
    setNotifications(prev => prev.filter(n => n.id !== id))
    setUnreadCount(prev => {
      const target = notifications.find(n => n.id === id)
      return target && !target.is_read ? Math.max(0, prev - 1) : prev
    })
    await fetch('/api/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
  }, [notifications])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(markAllRead, 1200)
    return () => clearTimeout(timer)
  }, [open, markAllRead])

  useEffect(() => {
    fetch('/api/notifications/check-stale').catch(() => {})
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

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleClickNotification = (n: Notification) => {
    if (n.link) window.location.href = n.link
    setOpen(false)
  }

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        className={`${styles.bellBtn} ${unreadCount > 0 ? styles.bellBtnActive : ''}`}
        onClick={() => setOpen(v => !v)}
        title="알림"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>알림</span>
            {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount}개 읽지 않음</span>}
            {notifications.length > 0 && (
              <button className={styles.deleteAllBtn} onClick={deleteAll}>모두 삭제</button>
            )}
          </div>

          <div className={styles.dropdownBody}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>
                <Bell size={32} className={styles.emptyIcon} />
                <p className={styles.emptyText}>새로운 알림이 없어요</p>
                <p className={styles.emptySubText}>알림이 오면 여기에 표시돼요</p>
              </div>
            ) : (
              notifications.map(n => (
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
      )}
    </div>
  )
}
