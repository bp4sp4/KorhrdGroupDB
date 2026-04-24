'use client'

import styles from '../page.module.css'
import type { ApprovalFormCategory, ApprovalFormTemplate } from '@/types/approvalForm'

interface FormListProps {
  templates: ApprovalFormTemplate[]
  selectedCategoryId: string | null
  categories: ApprovalFormCategory[]
  onCreate: () => void
  onOpen: (template: ApprovalFormTemplate) => void
}

export function FormList({
  templates,
  selectedCategoryId,
  categories,
  onCreate,
  onOpen,
}: FormListProps) {
  const currentCategoryName = selectedCategoryId
    ? categories.find((c) => c.id === selectedCategoryId)?.name ?? '양식'
    : '전체 양식'

  return (
    <main className={styles.main}>
      <div className={styles.mainHead}>
        <h2 className={styles.mainTitle}>{currentCategoryName}</h2>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onCreate}
          type="button"
        >+ 양식 추가</button>
      </div>
      <div className={styles.mainBody}>
        {templates.length === 0 ? (
          <div className={styles.emptyState}>등록된 양식이 없습니다.</div>
        ) : (
          <table className={styles.formTable}>
            <thead>
              <tr>
                <th>양식명</th>
                <th>문서 코드</th>
                <th>필드 수</th>
                <th>상태</th>
                <th>수정일</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} onClick={() => onOpen(t)}>
                  <td>{t.name}</td>
                  <td className={styles.codeCell}>{t.document_type}</td>
                  <td>{t.schema?.blocks?.length ?? 0}</td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${t.is_active ? styles.statusActive : styles.statusInactive}`}
                    >
                      {t.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className={styles.dateCell}>
                    {new Date(t.updated_at).toLocaleDateString('ko-KR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
