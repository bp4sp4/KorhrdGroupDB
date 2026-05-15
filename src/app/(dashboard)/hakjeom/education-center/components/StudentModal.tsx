'use client';

import { useState, useEffect, useRef } from 'react';
import type { EduStudent, EduCourse, EduEducationCenter, EduStudentFormData, EducationLevel, DesiredDegree } from '../types';
import styles from './StudentModal.module.css';
import ModalSelect from './ModalSelect';
import { DateInput } from '@/components/ui/Calendar/DateInput';
import { createClient } from '@/lib/supabase/client';

const EDUCATION_LEVELS: EducationLevel[] = [
  '고졸', '2년제중퇴', '2년제졸업', '3년제중퇴', '3년제졸업', '4년제중퇴', '4년제졸업',
];

const STATUSES = ['등록', '수료', '환불'] as const;

const DEFAULT_COURSES: EduCourse[] = [
  { id: 1, name: '사회복지사2급(구법)', created_at: '' },
  { id: 2, name: '사회복지사2급(신법)', created_at: '' },
  { id: 3, name: '사회복지사 실습', created_at: '' },
];

const DEFAULT_CENTERS = ['한평생교육', '서사평', '올티칭'];

const EDUCATION_LEVELS_WITH_MAJOR: EducationLevel[] = [
  '2년제졸업', '3년제졸업', '4년제졸업',
];

const ALL_DESIRED_DEGREES: DesiredDegree[] = [
  '학사 X',
  '전문학사',
  '전문학사(타전공)',
  '학사',
  '학사(타전공)',
];

function getDesiredDegreeOptions(level: EducationLevel | ''): DesiredDegree[] {
  if (!level) return [];
  // 학력과 무관하게 5가지 모두 노출 (학점은 plan 페이지에서 학력+법 조합으로 결정)
  return ALL_DESIRED_DEGREES;
}

interface Props {
  student?: EduStudent | null;
  courses: EduCourse[];
  centers: EduEducationCenter[];
  managers?: string[];
  onClose: () => void;
  onSubmit: (data: EduStudentFormData) => Promise<void>;
}

const EMPTY_FORM: EduStudentFormData = {
  name: '',
  phone: '',
  education_level: '',
  major: '',
  desired_degree: '',
  status: '등록',
  course_id: '',
  manager_name: '',
  cost: '',
  unit_price: '',
  class_start: '',
  target_completion_date: '',
  education_center_name: '',
  all_care: false,
  notes: '',
};

export default function StudentModal({ student, courses, centers, managers = [], onClose, onSubmit }: Props) {
  const [form, setForm] = useState<EduStudentFormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [classStartInput, setClassStartInput] = useState('');
  const [bachelorSuggestions, setBachelorSuggestions] = useState<string[]>([]);
  const [associateSuggestions, setAssociateSuggestions] = useState<string[]>([]);
  const [majorOpen, setMajorOpen] = useState(false);
  const majorRef = useRef<HTMLDivElement>(null);

  const [centerInput, setCenterInput] = useState('');
  const [centerOpen, setCenterOpen] = useState(false);
  const centerRef = useRef<HTMLDivElement>(null);

  const [allcareStatus, setAllcareStatus] = useState<{
    loading: boolean;
    subscribed: boolean | null;
    found: boolean | null;
    plan?: string;
    status?: string;
  }>({ loading: false, subscribed: null, found: null });
  const allcareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 문의DB 자동 채움 안내
  const [consultationFound, setConsultationFound] = useState<null | { from: string }>(null);
  const consultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consultAppliedKey = useRef<string>(''); // 같은 이름+번호로 두 번 채움 방지

  // 가이드 데모 모드 (lookup·submit 차단용)
  const guideDemoActiveRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('edu_credit_cert_presets')
      .select('bachelor_major, associate_major')
      .then(({ data }) => {
        if (!data) return;
        const toSortedList = (field: 'bachelor_major' | 'associate_major') => {
          const set = new Set<string>();
          data.forEach((row) => {
            (row[field] as string | null)?.split(',').forEach((m: string) => {
              const trimmed = m.trim();
              if (trimmed) set.add(trimmed);
            });
          });
          return Array.from(set).sort();
        };
        setBachelorSuggestions(toSortedList('bachelor_major'));
        setAssociateSuggestions(toSortedList('associate_major'));
      });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (majorRef.current && !majorRef.current.contains(e.target as Node)) setMajorOpen(false);
      if (centerRef.current && !centerRef.current.contains(e.target as Node)) setCenterOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // 이름 + 전화번호 변경 시 올케어 DB 실시간 조회 (디바운스 800ms)
  useEffect(() => {
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (!name || !phone || phone.replace(/-/g, '').length < 10) {
      setAllcareStatus({ loading: false, subscribed: null, found: null });
      return;
    }
    if (allcareTimer.current) clearTimeout(allcareTimer.current);
    setAllcareStatus((prev) => ({ ...prev, loading: true }));
    allcareTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/edu/allcare-check?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}`);
        const data = await res.json();
        setAllcareStatus({ loading: false, subscribed: data.subscribed, found: data.found, plan: data.plan, status: data.status });
        if (data.subscribed === true) set('all_care', true);
        if (data.subscribed === false) set('all_care', false);
      } catch {
        setAllcareStatus({ loading: false, subscribed: null, found: null });
      }
    }, 800);
    return () => { if (allcareTimer.current) clearTimeout(allcareTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name, form.phone]);

  // 가이드 데모 모드 ref (lookup useEffect에서 참조 — 위에서 선언)
  // 이름 + 전화번호 변경 시 문의 DB 매칭 → 빈 필드 자동 채움 (신규 추가 모드만)
  useEffect(() => {
    if (student) return; // 수정 모드면 자동 채움 X
    if (guideDemoActiveRef.current) return; // 가이드 데모 모드면 실제 API 호출 안 함
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (!name || !phone || phone.replace(/-/g, '').length < 10) return;
    const key = `${name}|${phone.replace(/\D/g, '')}`;
    if (consultAppliedKey.current === key) return;

    if (consultTimer.current) clearTimeout(consultTimer.current);
    consultTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/edu/lookup-consultation?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}`,
        );
        const data = await res.json();
        if (!data?.found || !data.consultation) return;
        const c = data.consultation as {
          education?: string | null;
          hope_course?: string | null;
          manager?: string | null;
          subject_cost?: number | null;
          memo?: string | null;
        };
        consultAppliedKey.current = key;
        setForm((prev) => {
          const next = { ...prev };
          // 최종학력 매핑: 문의 DB ↔ 등록학생관리 (공백·표기 차이 보정)
          if (!next.education_level && c.education) {
            const raw = String(c.education).trim();
            const normalized = raw.replace(/\s/g, '');
            // 1) 정확 일치 (공백 제거 후)
            let match = EDUCATION_LEVELS.find((l) => l === normalized) as
              | EducationLevel
              | undefined;
            // 2) 별칭 매핑 (문의DB에만 있는 값 → 등록학생관리 대체값)
            if (!match) {
              const aliasMap: Record<string, EducationLevel> = {
                "대학원이상": "4년제졸업",
                "대학교졸업(외국)": "4년제졸업",
              };
              if (aliasMap[normalized]) match = aliasMap[normalized];
            }
            if (match) next.education_level = match;
          }
          // 희망자격증과정 매핑 (이름)
          if (!next.course_id && c.hope_course) {
            const list = courses.length > 0 ? courses : DEFAULT_COURSES;
            const found = list.find(
              (cc) =>
                cc.name === c.hope_course ||
                (c.hope_course && c.hope_course.includes(cc.name)),
            );
            if (found) next.course_id = found.id;
          }
          if (!next.manager_name && c.manager) next.manager_name = c.manager;
          if (!next.unit_price && c.subject_cost) {
            next.unit_price = String(c.subject_cost);
          }
          if (!next.notes && c.memo) next.notes = c.memo;
          return next;
        });
        setConsultationFound({ from: '문의DB' });
        // 3초 후 안내 배지 제거
        setTimeout(() => setConsultationFound(null), 3500);
      } catch {
        /* ignore */
      }
    }, 800);
    return () => { if (consultTimer.current) clearTimeout(consultTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name, form.phone, student]);

  // 가이드 데모 중 — 정확히 '홍길동'을 입력하면 다음 단계로 자동 진행
  const guideNameDispatchedRef = useRef(false);
  useEffect(() => {
    if (!guideDemoActiveRef.current) return;
    if (guideNameDispatchedRef.current) return;
    if (form.name.trim() === '홍길동') {
      guideNameDispatchedRef.current = true;
      // 입력 결과를 사용자가 잠깐 보도록 700ms 후 진행
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('guide-edu-input-name-done'));
      }, 700);
    }
  }, [form.name]);

  // 가이드 데모 중 — 정확히 11자리 (01012345678) 입력 시 자동 진행
  const guidePhoneDispatchedRef = useRef(false);
  useEffect(() => {
    if (!guideDemoActiveRef.current) return;
    if (guidePhoneDispatchedRef.current) return;
    const digits = form.phone.replace(/\D/g, '');
    if (digits === '01012345678') {
      guidePhoneDispatchedRef.current = true;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('guide-edu-input-phone-done'));
      }, 700);
    }
  }, [form.phone]);

  // ── 가이드 데모 이벤트 리스너 (등록학생관리 가이드 전용) ──────────────
  useEffect(() => {
    const handleAction = (e: Event) => {
      const detail = (e as CustomEvent<{ type: string }>).detail;
      if (!detail) return;
      switch (detail.type) {
        case 'demo-on':
          // 가이드 데모 시작 — 실제 lookup·submit 차단
          guideDemoActiveRef.current = true;
          consultAppliedKey.current = 'GUIDE_DEMO_BLOCK';
          guideNameDispatchedRef.current = false;
          guidePhoneDispatchedRef.current = false;
          break;
        case 'demo-end':
          guideDemoActiveRef.current = false;
          consultAppliedKey.current = '';
          guideNameDispatchedRef.current = false;
          guidePhoneDispatchedRef.current = false;
          setForm(EMPTY_FORM);
          setConsultationFound(null);
          break;
        case 'auto-fill':
          // 실제 lookup API가 채우는 핵심 필드만 자동 입력
          // (최종학력 · 희망자격증과정 · 담당자 · 과목당 비용 · 메모)
          setForm((prev) => ({
            ...prev,
            education_level: '4년제졸업',
            course_id: 1,
            manager_name: '이규준',
            unit_price: '150000',
            notes: '가이드 예시 — 문의DB에서 자동 채움',
          }));
          setConsultationFound({ from: '문의DB (가이드 예시)' });
          break;
      }
    };
    window.addEventListener('guide-edu-modal-action', handleAction);
    return () => window.removeEventListener('guide-edu-modal-action', handleAction);
  }, []);

  const courseList = courses.length > 0 ? courses : DEFAULT_COURSES;
  const centerSuggestions = centers.length > 0 ? centers.map((c) => c.name) : DEFAULT_CENTERS;

  useEffect(() => {
    if (student) {
      setForm({
        name: student.name,
        phone: student.phone ?? '',
        education_level: student.education_level ?? '',
        major: student.major ?? '',
        desired_degree: student.desired_degree ?? '',
        status: student.status,
        course_id: student.course_id ?? '',
        manager_name: student.manager_name ?? '',
        cost: student.cost?.toString() ?? '',
        unit_price: student.unit_price?.toString() ?? '',
        class_start: student.class_start ?? '',
        target_completion_date: student.target_completion_date ?? '',
        education_center_name: student.education_center_name ?? '',
        all_care: student.all_care,
        notes: student.notes ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [student]);

  function set<K extends keyof EduStudentFormData>(key: K, value: EduStudentFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handlePhone(raw: string) {
    const d = raw.replace(/\D/g, '').slice(0, 11);
    let formatted = d;
    if (d.length > 7)      formatted = `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
    else if (d.length > 3) formatted = `${d.slice(0,3)}-${d.slice(3)}`;
    set('phone', formatted);
  }

  function handleCost(raw: string) {
    const digits = raw.replace(/[^\d]/g, '');
    set('cost', digits);
  }

  function handleUnitPrice(raw: string) {
    const digits = raw.replace(/[^\d]/g, '');
    set('unit_price', digits);
  }

  function displayCost(val: string) {
    if (!val) return '';
    return Number(val).toLocaleString();
  }

  // 과목당 비용 입력 시 결제금액 / 과목당비용으로 산출되는 과목수 (정수면 표시)
  const subjectCountPreview = (() => {
    const c = Number(form.cost || 0);
    const u = Number(form.unit_price || 0);
    if (!c || !u) return null;
    const n = c / u;
    return Number.isInteger(n) ? n : null;
  })();

  // 학력에 따라 전공 자동완성 목록 결정
  const majorSuggestions = form.education_level === '4년제졸업'
    ? bachelorSuggestions
    : associateSuggestions;

  const selectedCourseName = courseList.find((c) => c.id === Number(form.course_id))?.name ?? '';
  const isRehabCourse = selectedCourseName.includes('실습');
  const degreeOptions = isRehabCourse ? [] : getDesiredDegreeOptions(form.education_level);
  const showDesiredDegree = degreeOptions.length > 0;

  // 등록 교육원 태그 관련
  const centerTags = form.education_center_name.split(',').map(s => s.trim()).filter(Boolean);

  function addCenter(val: string) {
    if (!val || centerTags.includes(val)) return;
    set('education_center_name', [...centerTags, val].join(','));
  }

  function removeCenter(idx: number) {
    set('education_center_name', centerTags.filter((_, i) => i !== idx).join(','));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // 가이드 데모 중이면 DB 저장 없이 모달만 닫음
    if (guideDemoActiveRef.current) {
      onClose();
      window.dispatchEvent(new CustomEvent('guide-edu-modal-submitted'));
      return;
    }
    if (!form.phone.trim()) { alert('전화번호를 입력해주세요.'); return; }
    if (!form.education_level) { alert('최종학력을 선택해주세요.'); return; }
    if (!form.desired_degree) { alert('희망학위과정을 선택해주세요.'); return; }
    if (!form.course_id) { alert('희망자격증과정을 선택해주세요.'); return; }
    if (!form.manager_name) { alert('담당자를 선택해주세요.'); return; }
    if (!form.cost || Number(form.cost) <= 0) { alert('비용을 입력해주세요.'); return; }
    if (!form.unit_price || Number(form.unit_price) <= 0) { alert('과목당 비용을 입력해주세요.'); return; }
    setLoading(true);
    try {
      await onSubmit(form);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modal_header}>
          <h2 className={styles.modal_title}>
            {student ? '학생 정보 수정' : '학생 추가'}
            {consultationFound && (
              <span style={{
                marginLeft: 10,
                fontSize: 11,
                fontWeight: 600,
                color: '#15803D',
                background: '#DCFCE7',
                padding: '2px 8px',
                borderRadius: 999,
              }}>
                ✓ 문의DB에서 자동 채움
              </span>
            )}
          </h2>
          <button className={styles.modal_close} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modal_body}>
            <div className={styles.form_grid}>

              {/* 이름 */}
              <div className={styles.form_field} data-guide="edu-modal-name">
                <label className={styles.form_label}>이름<span className={styles.form_required}>*</span></label>
                <input className={styles.form_input} placeholder="이름 입력" value={form.name}
                  onChange={(e) => set('name', e.target.value)} required />
              </div>

              {/* 전화번호 */}
              <div className={styles.form_field} data-guide="edu-modal-phone">
                <label className={styles.form_label}>전화번호<span className={styles.form_required}>*</span></label>
                <input className={styles.form_input} placeholder="010-0000-0000"
                  value={form.phone} inputMode="numeric"
                  onChange={(e) => handlePhone(e.target.value)} />
              </div>

              {/* 최종학력 */}
              <div className={styles.form_field} data-guide="edu-modal-autofilled">
                <label className={styles.form_label}>최종학력<span className={styles.form_required}>*</span></label>
                <ModalSelect
                  value={form.education_level}
                  placeholder="선택"
                  options={EDUCATION_LEVELS.map((l) => ({ value: l, label: l }))}
                  onChange={(val) => {
                    set('education_level', val as EducationLevel | '');
                    if (!EDUCATION_LEVELS_WITH_MAJOR.includes(val as EducationLevel)) set('major', '');
                    set('desired_degree', '');
                  }}
                />
              </div>

              {/* 희망학위과정 */}
              {showDesiredDegree && (
                <div className={styles.form_field} data-guide="edu-modal-degree">
                  <label className={styles.form_label}>희망학위과정<span className={styles.form_required}>*</span></label>
                  <ModalSelect
                    value={form.desired_degree}
                    placeholder="선택"
                    options={degreeOptions.map((d) => ({
                      value: d,
                      label: d === '학사 X' ? '학위 X' : d,
                    }))}
                    onChange={(val) => set('desired_degree', val as DesiredDegree | '')}
                  />
                </div>
              )}

              {/* 학과(전공) - 2/3/4년제 졸업 시 표시 */}
              {EDUCATION_LEVELS_WITH_MAJOR.includes(form.education_level as EducationLevel) && (
                <div className={styles.form_field} data-guide="edu-modal-major">
                  <label className={styles.form_label}>학과 (전공)</label>
                  <div className={styles.major_wrap} ref={majorRef}>
                    <input
                      className={styles.major_input}
                      placeholder="전공 검색 또는 직접 입력"
                      value={form.major}
                      onChange={(e) => { set('major', e.target.value); setMajorOpen(true); }}
                      onFocus={() => setMajorOpen(true)}
                      autoComplete="off"
                    />
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      className={`${styles.major_chevron} ${majorOpen ? styles.major_chevron_open : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                    {majorOpen && (
                      <div className={styles.major_dropdown}>
                        {majorSuggestions
                          .filter((m) => !form.major || m.includes(form.major))
                          .map((m) => (
                            <div
                              key={m}
                              className={`${styles.major_option} ${form.major === m ? styles.major_option_active : ''}`}
                              onMouseDown={(e) => { e.preventDefault(); set('major', m); setMajorOpen(false); }}
                            >
                              {m}
                            </div>
                          ))}
                        {majorSuggestions.filter((m) => !form.major || m.includes(form.major)).length === 0 && (
                          <div className={`${styles.major_option} ${styles.major_option_empty}`}>
                            일치하는 전공 없음
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 희망자격증과정 */}
              <div className={styles.form_field} data-guide="edu-modal-course">
                <label className={styles.form_label}>희망자격증과정<span className={styles.form_required}>*</span></label>
                <ModalSelect
                  value={form.course_id !== '' ? String(form.course_id) : ''}
                  placeholder="선택"
                  options={courseList.map((c) => ({ value: String(c.id), label: c.name }))}
                  onChange={(val) => {
                    set('course_id', val ? Number(val) : '');
                    const name = courseList.find((c) => c.id === Number(val))?.name ?? '';
                    if (name.includes('실습')) set('desired_degree', '');
                  }}
                />
              </div>

              {/* 담당자 */}
              <div className={styles.form_field} data-guide="edu-modal-manager">
                <label className={styles.form_label}>담당자<span className={styles.form_required}>*</span></label>
                <ModalSelect
                  value={form.manager_name}
                  placeholder="선택"
                  options={managers.map((m) => ({ value: m, label: m }))}
                  onChange={(val) => set('manager_name', val)}
                />
              </div>

              {/* 등록교육원 (콤보박스) */}
              <div className={styles.form_field} data-guide="edu-modal-center">
                <label className={styles.form_label}>등록교육원</label>
                {centerTags.length > 0 && (
                  <div className={styles.center_tags}>
                    {centerTags.map((tag, i) => (
                      <span key={i} className={styles.class_start_tag}>
                        {tag}
                        <button type="button" className={styles.class_start_tag_remove}
                          onClick={() => removeCenter(i)}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className={styles.major_wrap} ref={centerRef}>
                  <input
                    className={styles.major_input}
                    placeholder="교육원 검색 또는 직접 입력"
                    value={centerInput}
                    onChange={(e) => { setCenterInput(e.target.value); setCenterOpen(true); }}
                    onFocus={() => setCenterOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = centerInput.trim();
                        if (val) { addCenter(val); setCenterInput(''); setCenterOpen(false); }
                      }
                    }}
                    autoComplete="off"
                  />
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`${styles.major_chevron} ${centerOpen ? styles.major_chevron_open : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  {centerOpen && (
                    <div className={styles.major_dropdown}>
                      {centerSuggestions
                        .filter((c) => !centerTags.includes(c) && (!centerInput || c.includes(centerInput)))
                        .map((c) => (
                          <div
                            key={c}
                            className={styles.major_option}
                            onMouseDown={(e) => { e.preventDefault(); addCenter(c); setCenterInput(''); setCenterOpen(false); }}
                          >
                            {c}
                          </div>
                        ))}
                      {centerInput.trim() && !centerSuggestions.includes(centerInput.trim()) && (
                        <div
                          className={`${styles.major_option} ${styles.major_option_add}`}
                          onMouseDown={(e) => { e.preventDefault(); addCenter(centerInput.trim()); setCenterInput(''); setCenterOpen(false); }}
                        >
                          + &quot;{centerInput.trim()}&quot; 추가
                        </div>
                      )}
                      {centerSuggestions.filter((c) => !centerTags.includes(c) && (!centerInput || c.includes(centerInput))).length === 0
                        && !centerInput.trim() && (
                        <div className={`${styles.major_option} ${styles.major_option_empty}`}>
                          추가 가능한 교육원 없음
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 개강반 */}
              <div className={styles.form_field} data-guide="edu-modal-class-start">
                <label className={styles.form_label}>개강반 (기수)</label>
                <div className={styles.class_start_wrap}>
                  {form.class_start.split(',').filter(Boolean).map((tag, i) => (
                    <span key={i} className={styles.class_start_tag}>
                      {tag}
                      <button type="button" className={styles.class_start_tag_remove}
                        onClick={() => {
                          const tags = form.class_start.split(',').filter(Boolean);
                          set('class_start', tags.filter((_, idx) => idx !== i).join(','));
                        }}>✕</button>
                    </span>
                  ))}
                  <input
                    className={styles.class_start_input}
                    placeholder="예: 202511 → 2025년 1학기 1기"
                    value={classStartInput}
                    inputMode="numeric"
                    onChange={(e) => {
                      const raw = e.target.value;
                      const prevDigits = classStartInput.replace(/\D/g, '');
                      const newDigits = raw.replace(/\D/g, '').slice(0, 7);
                      const effectiveDigits = newDigits === prevDigits && raw.length < classStartInput.length
                        ? newDigits.slice(0, -1) : newDigits;
                      if (!effectiveDigits) { setClassStartInput(''); return; }
                      if (effectiveDigits.length < 4) { setClassStartInput(effectiveDigits); return; }
                      if (effectiveDigits.length === 4) { setClassStartInput(`${effectiveDigits}년 `); return; }
                      if (effectiveDigits.length === 5) { setClassStartInput(`${effectiveDigits.slice(0,4)}년 ${effectiveDigits.slice(4)}학기 `); return; }
                      setClassStartInput(`${effectiveDigits.slice(0,4)}년 ${effectiveDigits.slice(4,5)}학기 ${effectiveDigits.slice(5)}기`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = classStartInput.trim();
                        const tags = form.class_start.split(',').filter(Boolean);
                        if (val && !tags.includes(val)) set('class_start', [...tags, val].join(','));
                        setClassStartInput('');
                      }
                    }}
                  />
                  {classStartInput.trim() && (
                    <button type="button" className={styles.class_start_add_btn}
                      onClick={() => {
                        const val = classStartInput.trim();
                        const tags = form.class_start.split(',').filter(Boolean);
                        if (val && !tags.includes(val)) set('class_start', [...tags, val].join(','));
                        setClassStartInput('');
                      }}>+</button>
                  )}
                </div>
              </div>

              {/* 비용 */}
              <div className={styles.form_field} data-guide="edu-modal-cost">
                <label className={styles.form_label}>비용<span className={styles.form_required}>*</span></label>
                <div className={styles.input_suffix_wrap}>
                  <input className={styles.form_input} inputMode="numeric" placeholder="0"
                    value={displayCost(form.cost)}
                    onChange={(e) => handleCost(e.target.value)} />
                  <span className={styles.input_suffix}>원</span>
                </div>
              </div>

              {/* 과목당 비용 */}
              <div className={styles.form_field} data-guide="edu-modal-unit-price">
                <label className={styles.form_label}>
                  과목당 비용<span className={styles.form_required}>*</span>
                  {subjectCountPreview !== null && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#3182f6', fontWeight: 500 }}>
                      = {subjectCountPreview}과목
                    </span>
                  )}
                </label>
                <div className={styles.input_suffix_wrap}>
                  <input className={styles.form_input} inputMode="numeric" placeholder="예: 45000"
                    value={displayCost(form.unit_price)}
                    onChange={(e) => handleUnitPrice(e.target.value)} />
                  <span className={styles.input_suffix}>원</span>
                </div>
              </div>

              {/* 목표취득예정일 */}
              <div className={styles.form_field} data-guide="edu-modal-target-date">
                <label className={styles.form_label}>목표취득예정일</label>
                <DateInput
                  value={form.target_completion_date}
                  onChange={(v) => set('target_completion_date', v)}
                  placeholder="연도. 월. 일."
                  triggerClassName={styles.form_input}
                  className={styles.form_input_wrap}
                />
              </div>

              {/* 올케어 가입여부 */}
              <div className={styles.form_field}>
                <label className={styles.form_label}>
                  올케어 가입여부
                  {allcareStatus.loading && (
                    <span className={styles.allcare_badge_checking}>조회 중...</span>
                  )}
                  {!allcareStatus.loading && allcareStatus.subscribed === true && (
                    <span className={styles.allcare_badge_active}>
                      ● 올케어 활성{allcareStatus.plan ? ` · ${allcareStatus.plan}` : ''}
                    </span>
                  )}
                  {!allcareStatus.loading && allcareStatus.subscribed === false && allcareStatus.found === true && (
                    <span className={styles.allcare_badge_inactive}>● 미구독</span>
                  )}
                  {!allcareStatus.loading && allcareStatus.subscribed === false && allcareStatus.found === false && (
                    <span className={styles.allcare_badge_notfound}>● 미가입</span>
                  )}
                </label>
                <div className={styles.allcare_group}>
                  <button type="button"
                    className={`${styles.allcare_btn} ${form.all_care ? styles.allcare_btn_active_o : ''}`}
                    onClick={() => set('all_care', true)}>O</button>
                  <button type="button"
                    className={`${styles.allcare_btn} ${!form.all_care ? styles.allcare_btn_active_x : ''}`}
                    onClick={() => set('all_care', false)}>X</button>
                </div>
              </div>

              {/* 특이사항/메모 */}
              <div className={`${styles.form_field} ${styles.form_field_full}`} data-guide="edu-modal-notes">
                <label className={styles.form_label}>특이사항 / 메모</label>
                <textarea className={styles.form_textarea} placeholder="특이사항 또는 메모를 입력하세요"
                  value={form.notes} onChange={(e) => set('notes', e.target.value)} />
              </div>

            </div>
          </div>

          <div className={styles.modal_footer}>
            <button type="button" className={styles.cancel_btn} onClick={onClose}>취소</button>
            <button type="submit" className={styles.submit_btn} disabled={loading}>
              {loading ? '저장 중...' : student ? '수정하기' : '학생 추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
