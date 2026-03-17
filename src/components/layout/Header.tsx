'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from './layout.module.css'

interface HeaderProps {
  title: string
  userName?: string
}

function getInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  if (/[\uAC00-\uD7A3]/.test(trimmed[0])) {
    return trimmed[0]
  }
  const words = trimmed.split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return trimmed[0].toUpperCase()
}

export default function Header({ title, userName = '관리자' }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const initial = getInitial(userName)

  return (
    <header className={styles.header}>
      <h1 className={styles.headerTitle}>{title}</h1>

      <div className={styles.headerRight}>
        <div className={styles.avatar}>
          <span className={styles.avatarInitial}>{initial}</span>
        </div>

        <span className={styles.headerUserName}>{userName}</span>

        <div className={styles.headerDivider} />

        <button onClick={handleLogout} className={styles.logoutBtn}>
          <LogOut size={14} />
          로그아웃
        </button>
      </div>
    </header>
  )
}
