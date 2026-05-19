'use client'

import HrRecordsTab from '../HrRecordsTab'
import styles from '../page.module.css'

export default function AdminHrRecordsPage() {
  return (
    <div className={styles.pageWrap}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>인사기록카드 승인</h2>
      </div>
      <HrRecordsTab />
    </div>
  )
}
