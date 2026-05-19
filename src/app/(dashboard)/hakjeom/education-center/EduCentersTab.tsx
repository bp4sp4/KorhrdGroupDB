'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './EduManagersTab.module.css';

interface Center {
  id: number;
  name: string;
  created_at: string;
}

interface Props {
  isActive: boolean;
}

export default function EduCentersTab({ isActive }: Props) {
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [centers, setCenters] = useState<Center[]>([]);
  const [usageMap, setUsageMap] = useState<Record<string, number>>({});

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Center | null>(null);
  const [form, setForm] = useState({ name: '' });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!isActive || loaded) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [centersRes, studentsRes] = await Promise.all([
        supabase.from('edu_education_centers').select('*').order('id'),
        supabase.from('edu_students').select('education_center_name'),
      ]);
      if (cancelled) return;
      setCenters((centersRes.data ?? []) as Center[]);
      // 학생 사용 카운트 (이름별)
      const usage: Record<string, number> = {};
      for (const s of (studentsRes.data ?? []) as { education_center_name: string | null }[]) {
        const n = s.education_center_name;
        if (n) usage[n] = (usage[n] ?? 0) + 1;
      }
      setUsageMap(usage);
      setLoading(false);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isActive, loaded]);

  function openAdd() {
    setEditTarget(null);
    setForm({ name: '' });
    setShowModal(true);
  }

  function openEdit(c: Center) {
    setEditTarget(c);
    setForm({ name: c.name });
    setShowModal(true);
  }

  async function handleSave() {
    if (savingRef.current) return;
    const name = form.name.trim();
    if (!name) return;
    // 중복 체크 (편집 중인 자신 제외)
    if (centers.some((c) => c.name === name && c.id !== editTarget?.id)) {
      alert('이미 같은 이름의 교육원 기관이 존재합니다.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const supabase = createClient();

    try {
      if (editTarget) {
        // 이름 변경 시 학생/매출의 education_center_name도 동기 변경
        const oldName = editTarget.name;
        const { error: updateErr } = await supabase
          .from('edu_education_centers')
          .update({ name })
          .eq('id', editTarget.id);
        if (updateErr) {
          alert(`수정 실패: ${updateErr.message}`);
          return;
        }
        if (oldName !== name) {
          await supabase
            .from('edu_students')
            .update({
              education_center_name: name,
              updated_at: new Date().toISOString(),
            })
            .eq('education_center_name', oldName);
          await supabase
            .from('edu_sales')
            .update({
              education_center_name: name,
              updated_at: new Date().toISOString(),
            })
            .eq('education_center_name', oldName);
        }
        setCenters((prev) =>
          prev.map((c) => (c.id === editTarget.id ? { ...c, name } : c)),
        );
        if (oldName !== name) {
          setUsageMap((prev) => {
            const next = { ...prev };
            const cnt = next[oldName] ?? 0;
            delete next[oldName];
            next[name] = (next[name] ?? 0) + cnt;
            return next;
          });
        }
      } else {
        const { data, error } = await supabase
          .from('edu_education_centers')
          .insert({ name })
          .select()
          .single();
        if (error) {
          alert(`추가 실패: ${error.message}`);
          return;
        }
        if (data) setCenters((prev) => [...prev, data as Center]);
      }
      setShowModal(false);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleDelete(c: Center) {
    const usage = usageMap[c.name] ?? 0;
    if (usage > 0) {
      alert(
        `"${c.name}" 교육원을 사용 중인 학생이 ${usage}명 있어 삭제할 수 없습니다.\n학생의 교육원을 먼저 변경해주세요.`,
      );
      return;
    }
    if (!confirm(`"${c.name}" 교육원 기관을 삭제하시겠습니까?`)) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('edu_education_centers')
      .delete()
      .eq('id', c.id);
    if (error) {
      alert(`삭제 실패: ${error.message}`);
      return;
    }
    setCenters((prev) => prev.filter((x) => x.id !== c.id));
  }

  if (loading) return <div className={styles.loading}>불러오는 중...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>교육원 기관 관리</div>
          <div className={styles.sub}>
            기관 {centers.length}개 · 등록학생관리/매출파일의 교육원 옵션
          </div>
        </div>
        <button className={styles.add_btn} onClick={openAdd}>
          + 기관 추가
        </button>
      </div>

      <div className={styles.table_wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>기관명</th>
              <th>사용 학생수</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {centers.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  등록된 교육원 기관이 없습니다.
                </td>
              </tr>
            ) : (
              centers.map((c) => {
                const usage = usageMap[c.name] ?? 0;
                return (
                  <tr key={c.id}>
                    <td className={styles.sort_order}>{c.id}</td>
                    <td className={styles.manager_name}>{c.name}</td>
                    <td>{usage > 0 ? `${usage}명` : '-'}</td>
                    <td>
                      <div className={styles.row_actions}>
                        <button
                          className={styles.edit_btn}
                          onClick={() => openEdit(c)}
                        >
                          수정
                        </button>
                        <button
                          className={styles.delete_btn}
                          onClick={() => handleDelete(c)}
                          disabled={usage > 0}
                          title={
                            usage > 0
                              ? `사용 중인 학생 ${usage}명이 있어 삭제 불가`
                              : '삭제'
                          }
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modal_header}>
              <span className={styles.modal_title}>
                {editTarget ? '교육원 기관 수정' : '교육원 기관 추가'}
              </span>
              <button
                className={styles.modal_close}
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <div className={styles.modal_body}>
              <div className={styles.field}>
                <label className={styles.label}>기관명</label>
                <input
                  className={styles.input}
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="예) 한평생그룹"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                {editTarget && form.name.trim() !== editTarget.name && (
                  <div className={styles.hint}>
                    ⚠️ 이름을 바꾸면 이 기관을 사용 중인{' '}
                    <b>학생 {usageMap[editTarget.name] ?? 0}명</b>의 교육원도
                    자동 변경됩니다.
                  </div>
                )}
              </div>
            </div>
            <div className={styles.modal_footer}>
              <button
                className={styles.cancel_btn}
                onClick={() => setShowModal(false)}
              >
                취소
              </button>
              <button
                className={styles.confirm_btn}
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
              >
                {saving ? '저장 중...' : editTarget ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
