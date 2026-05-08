'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DateInput } from '@/components/ui/Calendar/DateInput';
import styles from './AdminProcessCard.module.css';

type OX = 'O' | 'X' | null;
type NAO = 'N/A' | 'O' | null;

interface AdminRow {
  student_id: string;
  learner_username: string | null;
  learner_password: string | null;
  credit_application: OX;
  degree_application: OX;
  course_plan_date: string | null;
  dup_check_university: NAO;
  dup_check_certificate: NAO;
}

interface Props {
  studentId: string;
}

const EMPTY_ADMIN = (id: string): AdminRow => ({
  student_id: id,
  learner_username: '',
  learner_password: '',
  credit_application: null,
  degree_application: null,
  course_plan_date: null,
  dup_check_university: null,
  dup_check_certificate: null,
});

export default function AdminProcessCard({ studentId }: Props) {
  const [admin, setAdmin] = useState<AdminRow>(() => EMPTY_ADMIN(studentId));
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // ── 초기 로드 ──
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('edu_student_admin')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();
      if (cancelled) return;
      setAdmin((data as AdminRow) ?? EMPTY_ADMIN(studentId));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  // ── 행정 데이터 저장 (upsert) ──
  const persistAdmin = useCallback(async (next: AdminRow, fieldKey: string) => {
    setSavingField(fieldKey);
    const supabase = createClient();
    const payload = {
      student_id: studentId,
      learner_username: next.learner_username || null,
      learner_password: next.learner_password || null,
      credit_application: next.credit_application,
      degree_application: next.degree_application,
      course_plan_date: next.course_plan_date || null,
      dup_check_university: next.dup_check_university,
      dup_check_certificate: next.dup_check_certificate,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('edu_student_admin')
      .upsert(payload, { onConflict: 'student_id' });
    if (error) alert(`저장 실패: ${error.message}`);
    setSavingField(null);
  }, [studentId]);

  function updateAdminField<K extends keyof AdminRow>(key: K, value: AdminRow[K]) {
    setAdmin(prev => {
      const next = { ...prev, [key]: value };
      persistAdmin(next, String(key));
      return next;
    });
  }

  if (loading) {
    return <div className={styles.loading_card}>행정절차 정보를 불러오는 중...</div>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.section}>
          <div className={styles.section_label}>
            학습자 등록
            {savingField === 'learner_username' || savingField === 'learner_password'
              ? <span className={styles.saving}>저장 중...</span>
              : null}
          </div>
          <div className={styles.row_2col}>
            <div className={styles.field}>
              <label className={styles.field_label}>아이디</label>
              <input
                className={styles.input}
                placeholder="아이디"
                value={admin.learner_username ?? ''}
                onChange={e => setAdmin(prev => ({ ...prev, learner_username: e.target.value }))}
                onBlur={e => persistAdmin({ ...admin, learner_username: e.target.value }, 'learner_username')}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.field_label}>비밀번호</label>
              <div className={styles.password_wrap}>
                <input
                  className={styles.input}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="비밀번호"
                  value={admin.learner_password ?? ''}
                  onChange={e => setAdmin(prev => ({ ...prev, learner_password: e.target.value }))}
                  onBlur={e => persistAdmin({ ...admin, learner_password: e.target.value }, 'learner_password')}
                />
                <button
                  type="button"
                  className={styles.eye_btn}
                  onClick={() => setShowPassword(v => !v)}
                  aria-label="비밀번호 표시"
                >
                  {showPassword ? '숨김' : '보기'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.row_2col}>
            <SegSelect
              label="학점인정신청"
              options={['O', 'X']}
              value={admin.credit_application}
              saving={savingField === 'credit_application'}
              onChange={v => updateAdminField('credit_application', v as OX)}
            />
            <SegSelect
              label="학위신청"
              options={['O', 'X']}
              value={admin.degree_application}
              saving={savingField === 'degree_application'}
              onChange={v => updateAdminField('degree_application', v as OX)}
            />
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.row_2col}>
            <div className={styles.field}>
              <label className={styles.field_label}>
                수강신청 및 플랜과목
                {savingField === 'course_plan_date' && <span className={styles.saving}>저장 중...</span>}
              </label>
              <DateInput
                value={admin.course_plan_date ?? ''}
                onChange={v => updateAdminField('course_plan_date', v || null)}
                placeholder="날짜 선택"
                triggerClassName={styles.input}
              />
            </div>
            <div className={styles.field} />
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.section_label}>중복과목 확인</div>
          <div className={styles.row_2col}>
            <SegSelect
              label="전적대"
              options={['N/A', 'O']}
              value={admin.dup_check_university}
              saving={savingField === 'dup_check_university'}
              onChange={v => updateAdminField('dup_check_university', v as NAO)}
            />
            <SegSelect
              label="자격증"
              options={['N/A', 'O']}
              value={admin.dup_check_certificate}
              saving={savingField === 'dup_check_certificate'}
              onChange={v => updateAdminField('dup_check_certificate', v as NAO)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 커스텀 셀렉트 (세그먼트형) ──
function SegSelect({
  label,
  options,
  value,
  onChange,
  saving,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  saving?: boolean;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.field_label}>
        {label}
        {saving && <span className={styles.saving}>저장 중...</span>}
      </label>
      <div className={styles.seg_wrap}>
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            className={`${styles.seg_btn} ${value === opt ? styles.seg_btn_active : ''}`}
            onClick={() => onChange(value === opt ? null : opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
