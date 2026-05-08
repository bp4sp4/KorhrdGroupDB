'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './SemesterListCard.module.css';

interface SemesterRow {
  id: string;
  student_id: string;
  semester_no: number;
  confirmed: boolean;
  notes: string | null;
}

interface Props {
  studentId: string;
}

export default function SemesterListCard({ studentId }: Props) {
  const [semesters, setSemesters] = useState<SemesterRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('edu_student_semesters')
        .select('*')
        .eq('student_id', studentId)
        .order('semester_no');
      if (cancelled) return;
      setSemesters((data as SemesterRow[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  async function handleAddSemester() {
    const nextNo = (semesters.at(-1)?.semester_no ?? 0) + 1;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('edu_student_semesters')
      .insert({ student_id: studentId, semester_no: nextNo, confirmed: false })
      .select()
      .single();
    if (error) {
      alert(`학기 추가 실패: ${error.message}`);
      return;
    }
    setSemesters(prev => [...prev, data as SemesterRow]);
  }

  async function handleDeleteSemester(id: string) {
    if (!confirm('해당 학기를 삭제하시겠습니까?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('edu_student_semesters').delete().eq('id', id);
    if (error) {
      alert(`삭제 실패: ${error.message}`);
      return;
    }
    setSemesters(prev => prev.filter(s => s.id !== id));
  }

  async function updateSemester(id: string, patch: Partial<SemesterRow>) {
    setSemesters(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
    const supabase = createClient();
    const { error } = await supabase
      .from('edu_student_semesters')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) alert(`수정 실패: ${error.message}`);
  }

  if (loading) {
    return <div className={styles.loading}>수강내역을 불러오는 중...</div>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.title}>학기별 수강내역</div>
        <button className={styles.add_btn} onClick={handleAddSemester}>
          + 학기 추가
        </button>
      </div>

      {semesters.length === 0 ? (
        <div className={styles.empty}>
          학기가 추가되지 않았습니다. &quot;+ 학기 추가&quot;로 시작하세요.
        </div>
      ) : (
        <div className={styles.list}>
          {semesters.map(s => (
            <div key={s.id} className={styles.row}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={s.confirmed}
                  onChange={e => updateSemester(s.id, { confirmed: e.target.checked })}
                />
                <span className={styles.label}>{s.semester_no}학기</span>
              </label>
              <input
                className={styles.input}
                placeholder="비고 (예: 신청완료, 미수강 등)"
                value={s.notes ?? ''}
                onChange={e =>
                  setSemesters(prev =>
                    prev.map(x => (x.id === s.id ? { ...x, notes: e.target.value } : x))
                  )
                }
                onBlur={e => updateSemester(s.id, { notes: e.target.value })}
              />
              <button
                className={styles.delete_btn}
                onClick={() => handleDeleteSemester(s.id)}
                aria-label="학기 삭제"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
