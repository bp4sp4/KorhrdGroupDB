'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { logEduActivity } from '@/lib/edu-logger';
import type { EduStudent, EduCourse, EduEducationCenter, EduStudentFormData } from '../../types';
import StudentModal from '../../components/StudentModal';
import AdminProcessCard from './AdminProcessCard';
import SemesterListCard from './SemesterListCard';
import styles from './page.module.css';

// ── 타입 ───────────────────────────────────────────────────────
interface StudentMemo {
  id: string;
  student_id: string;
  content: string;
  created_by: string;
  created_at: string;
}

type DetailTab = '행정 절차' | '수강내역' | '특이사항';

// ── 헬퍼 ──────────────────────────────────────────────────────
function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatPhone(phone: string | null) {
  if (!phone) return '-';
  return phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────
export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [student,    setStudent]    = useState<EduStudent | null>(null);
  const [courses,    setCourses]    = useState<EduCourse[]>([]);
  const [centers,    setCenters]    = useState<EduEducationCenter[]>([]);
  const [managersDb, setManagersDb] = useState<string[]>([]);
  const [modalOpen,  setModalOpen]  = useState(false);

  const [activeTab, setActiveTab] = useState<DetailTab>('행정 절차');

  // 특이사항(구 메모)
  const [memos,        setMemos]        = useState<StudentMemo[]>([]);
  const [newMemo,      setNewMemo]      = useState('');
  const [memoSaving,   setMemoSaving]   = useState(false);
  const [editingMemoId,   setEditingMemoId]   = useState<string | null>(null);
  const [editingMemoText, setEditingMemoText] = useState('');

  // 현재 사용자 이름
  const [myName, setMyName] = useState('');

  const STATUS_STYLE: Record<string, { cls: string; label: string }> = {
    등록:              { cls: styles.badge_enrolled,  label: '등록'    },
    '사회복지사-실습예정': { cls: styles.badge_practice, label: '실습예정' },
    수료:              { cls: styles.badge_completed, label: '수료'    },
    환불:              { cls: styles.badge_refund,    label: '환불'    },
    삭제예정:           { cls: styles.badge_refund,    label: '삭제예정' },
  };

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const [s, c, e, mgr, { data: { user } }] = await Promise.all([
        supabase.from('edu_students').select('*, edu_courses(*)').eq('id', id).single(),
        supabase.from('edu_courses').select('*').order('id'),
        supabase.from('edu_education_centers').select('*').order('id'),
        supabase.from('edu_managers').select('name').order('sort_order'),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;
      setStudent(s.data as EduStudent);
      setCourses((c.data as EduCourse[]) ?? []);
      setCenters((e.data as EduEducationCenter[]) ?? []);
      setManagersDb((mgr.data ?? []).map((m: { name: string }) => m.name));

      if (user) {
        const { data: appUser } = await supabase
          .from('app_users')
          .select('display_name')
          .eq('username', user.email)
          .maybeSingle();
        if (!cancelled) setMyName(appUser?.display_name ?? user.email ?? '');
      }

      const { data: memosData } = await supabase
        .from('edu_student_memos')
        .select('*')
        .eq('student_id', id)
        .order('created_at', { ascending: false });
      if (!cancelled) setMemos((memosData as StudentMemo[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function handleSubmit(data: EduStudentFormData) {
    const supabase = createClient();
    const payload = {
      name: data.name, phone: data.phone || null,
      education_level: data.education_level || null, major: data.major || null,
      desired_degree: data.desired_degree || null, status: data.status,
      course_id: data.course_id || null, manager_name: data.manager_name || null,
      cost: data.cost ? Number(data.cost) : null,
      unit_price: data.unit_price ? Number(data.unit_price) : null,
      class_start: data.class_start || null,
      target_completion_date: data.target_completion_date || null,
      education_center_name: data.education_center_name || null,
      all_care: data.all_care, notes: data.notes || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('edu_students').update(payload).eq('id', id);
    if (error) { alert(`수정 실패: ${error.message}`); return; }
    logEduActivity({ action: '학생 수정', target_type: 'student', target_name: data.name });
    const { data: updated } = await supabase.from('edu_students').select('*, edu_courses(*)').eq('id', id).single();
    setStudent(updated as EduStudent);
  }

  async function handleAddMemo() {
    if (!newMemo.trim()) return;
    setMemoSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.from('edu_student_memos').insert({
      student_id: id, content: newMemo.trim(), created_by: myName,
    }).select().single();
    if (error) { alert('특이사항 저장 실패'); setMemoSaving(false); return; }
    setMemos(prev => [data as StudentMemo, ...prev]);
    setNewMemo('');
    setMemoSaving(false);
  }

  async function handleDeleteMemo(memoId: string) {
    if (!confirm('특이사항을 삭제하시겠습니까?')) return;
    const supabase = createClient();
    await supabase.from('edu_student_memos').delete().eq('id', memoId);
    setMemos(prev => prev.filter(m => m.id !== memoId));
  }

  function startEditMemo(memo: StudentMemo) {
    setEditingMemoId(memo.id);
    setEditingMemoText(memo.content);
  }

  async function handleSaveMemo(memoId: string) {
    if (!editingMemoText.trim()) return;
    const supabase = createClient();
    const { error } = await supabase.from('edu_student_memos')
      .update({ content: editingMemoText.trim() })
      .eq('id', memoId);
    if (error) { alert('수정 실패'); return; }
    setMemos(prev => prev.map(m => m.id === memoId ? { ...m, content: editingMemoText.trim() } : m));
    setEditingMemoId(null);
    setEditingMemoText('');
  }

  if (!student) {
    return <div className={styles.page_wrap}><div className={styles.loading}>불러오는 중...</div></div>;
  }

  const status = STATUS_STYLE[student.status];

  return (
    <div className={styles.page_wrap}>

      {/* 뒤로가기 */}
      <button className={styles.back_btn} onClick={() => router.push('/hakjeom?tab=edu-students')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        학생 목록으로
      </button>

      {/* 헤더 카드 */}
      <div className={styles.header_card}>
        <div className={styles.header_left}>
          <div className={styles.name_row}>
            <h1 className={styles.student_name}>{student.name}</h1>
            <span className={`${styles.badge} ${status?.cls ?? ''}`}>{status?.label ?? student.status}</span>
          </div>
          <div className={styles.meta_row}>
            <span>{formatPhone(student.phone)}</span>
            {student.edu_courses?.name && <><span className={styles.meta_dot} /><span>{student.edu_courses.name}</span></>}
            {student.education_center_name && <><span className={styles.meta_dot} /><span>{student.education_center_name}</span></>}
            {student.manager_name && <><span className={styles.meta_dot} /><span>{student.manager_name}</span></>}
          </div>
        </div>
        <div className={styles.header_actions}>
          <button className={styles.plan_btn} onClick={() => router.push(`/hakjeom/education-center/students/${id}/plan`)}>
            학습플랜 설계
          </button>
          <button className={styles.edit_btn} onClick={() => setModalOpen(true)}>
            수정
          </button>
        </div>
      </div>

      {/* 정보 그리드 */}
      <div className={styles.info_grid}>
        <div className={styles.info_card}>
          <div className={styles.card_title}>기본 정보</div>
          <div className={styles.info_list}>
            <InfoRow label="담당자"   value={student.manager_name} />
            <InfoRow label="교육원"   value={student.education_center_name} />
            <InfoRow label="과정"     value={student.edu_courses?.name} />
            <InfoRow label="개강반"   value={student.class_start} />
            <InfoRow label="최종학력" value={student.education_level} />
            <InfoRow label="등록일"   value={formatDate(student.registered_at)} />
          </div>
        </div>
        <div className={styles.info_card}>
          <div className={styles.card_title}>학습 정보</div>
          <div className={styles.info_list}>
            <InfoRow label="목표취득일" value={formatDate(student.target_completion_date)} />
            <InfoRow label="비용"       value={student.cost ? `${student.cost.toLocaleString()}원` : null} />
            <InfoRow label="올케어"     value={student.all_care ? 'O' : 'X'} />
            <InfoRow label="전공"       value={student.major} />
            <InfoRow label="희망학위"   value={student.desired_degree} />
            {student.notes && <InfoRow label="메모" value={student.notes} />}
          </div>
        </div>
      </div>

      {/* 탭 섹션 */}
      <div className={styles.tab_section}>
        {/* 탭 헤더 */}
        <div className={styles.tab_header}>
          {(['행정 절차', '수강내역', '특이사항'] as DetailTab[]).map(tab => (
            <button
              key={tab}
              className={`${styles.tab_btn} ${activeTab === tab ? styles.tab_btn_active : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {tab === '특이사항' && memos.length > 0 && <span className={styles.tab_count}>{memos.length}</span>}
            </button>
          ))}
        </div>

        {/* ── 행정 절차 탭 ── */}
        {activeTab === '행정 절차' && (
          <div className={styles.tab_body}>
            <AdminProcessCard studentId={student.id} />
          </div>
        )}

        {/* ── 수강내역 탭 ── */}
        {activeTab === '수강내역' && (
          <div className={styles.tab_body}>
            <SemesterListCard studentId={student.id} />
          </div>
        )}

        {/* ── 특이사항 탭 ── */}
        {activeTab === '특이사항' && (
          <div className={styles.tab_body}>
            {/* 입력 */}
            <div className={styles.memo_input_wrap}>
              <textarea
                className={styles.memo_textarea}
                placeholder="특이사항을 입력하세요..."
                value={newMemo}
                onChange={e => setNewMemo(e.target.value)}
                rows={3}
              />
              <div className={styles.memo_input_footer}>
                <button
                  className={styles.memo_submit_btn}
                  onClick={handleAddMemo}
                  disabled={memoSaving || !newMemo.trim()}
                >
                  {memoSaving ? '저장 중...' : '특이사항 추가'}
                </button>
              </div>
            </div>

            {/* 목록 */}
            {memos.length === 0 ? (
              <div className={styles.empty}>등록된 특이사항이 없습니다.</div>
            ) : (
              <div className={styles.memo_list}>
                {memos.map(memo => (
                  <div key={memo.id} className={styles.memo_card}>
                    {editingMemoId === memo.id ? (
                      <>
                        <textarea
                          className={styles.memo_edit_textarea}
                          value={editingMemoText}
                          onChange={e => setEditingMemoText(e.target.value)}
                          rows={3}
                          autoFocus
                        />
                        <div className={styles.memo_footer}>
                          <span className={styles.memo_meta}>{memo.created_by} · {formatDateTime(memo.created_at)}</span>
                          <div className={styles.memo_edit_actions}>
                            <button className={styles.cancel_btn} onClick={() => setEditingMemoId(null)}>취소</button>
                            <button className={styles.memo_submit_btn} onClick={() => handleSaveMemo(memo.id)} disabled={!editingMemoText.trim()}>저장</button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={styles.memo_content}>{memo.content}</div>
                        <div className={styles.memo_footer}>
                          <span className={styles.memo_meta}>{memo.created_by} · {formatDateTime(memo.created_at)}</span>
                          <div className={styles.memo_edit_actions}>
                            <button className={styles.edit_icon_btn} onClick={() => startEditMemo(memo)}>수정</button>
                            <button className={styles.delete_btn} onClick={() => handleDeleteMemo(memo.id)}>삭제</button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <StudentModal
          student={student}
          courses={courses}
          centers={centers}
          managers={managersDb}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className={styles.info_row}>
      <span className={styles.info_label}>{label}</span>
      <span className={styles.info_value}>{value ?? '-'}</span>
    </div>
  );
}
