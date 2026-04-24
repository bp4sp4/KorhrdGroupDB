'use client'

import styles from '../page.module.css'
import type { ApprovalFormCategory } from '@/types/approvalForm'

interface CategoryTreeProps {
  categories: ApprovalFormCategory[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAdd: () => void
  onRename: (category: ApprovalFormCategory) => void
  onDelete: (category: ApprovalFormCategory) => void
}

export function CategoryTree({
  categories,
  selectedId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}: CategoryTreeProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHead}>
        <span>카테고리</span>
        <button className={styles.iconBtn} onClick={onAdd} type="button">+ 추가</button>
      </div>
      <div className={styles.sidebarBody}>
        <div
          className={`${styles.catItem}${selectedId === null ? ' ' + styles.catItemActive : ''}`}
          onClick={() => onSelect(null)}
        >
          <span>전체</span>
        </div>
        {categories.map((c) => (
          <div
            key={c.id}
            className={`${styles.catItem}${selectedId === c.id ? ' ' + styles.catItemActive : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <span>{c.name}</span>
            <span className={styles.catActions}>
              <button
                className={styles.iconBtn}
                type="button"
                onClick={(e) => { e.stopPropagation(); onRename(c) }}
              >수정</button>
              <button
                className={styles.iconBtn}
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(c) }}
              >삭제</button>
            </span>
          </div>
        ))}
      </div>
    </aside>
  )
}
