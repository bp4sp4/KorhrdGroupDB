'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './EduManagersTab.module.css';

interface ActivityLog {
  id: number;
  user_id: string | null;
  user_name: string | null;
  action: string;
  target_type: string | null;
  target_name: string | null;
  detail: string | null;
  created_at: string;
}

interface Props {
  isActive: boolean;
}

export default function EduLogsTab({ isActive }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isActive || loaded) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('edu_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (!cancelled) {
        setLogs((data ?? []) as ActivityLog[]);
        setLoading(false);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isActive, loaded]);

  if (loading) return <div className={styles.loading}>불러오는 중...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>교육원 활동 로그</div>
          <div className={styles.sub}>최근 {logs.length}건</div>
        </div>
      </div>

      <div className={styles.table_wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>시간</th>
              <th>사용자</th>
              <th>액션</th>
              <th>대상</th>
              <th>상세</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={5} className={styles.empty}>활동 로그가 없습니다.</td></tr>
            ) : logs.map(log => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString('ko-KR')}</td>
                <td>{log.user_name ?? '-'}</td>
                <td>{log.action}</td>
                <td>{log.target_name ?? '-'}</td>
                <td>{log.detail ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
