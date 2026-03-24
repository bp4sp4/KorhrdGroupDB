'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ResponsiveContainer, ComposedChart, BarChart, AreaChart, PieChart,
  Bar, Line, Area, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import styles from './page.module.css';
import MemoTimeline from '@/components/ui/MemoTimeline'
import { TableSkeleton, StatsCardsSkeleton, ChartsGridSkeleton, FilterBarSkeleton } from '@/components/ui/Skeleton'

// ─── 공통 타입 ──────────────────────────────────────────────────────────────

type ConsultationStatus = '상담대기' | '상담중' | '보류' | '등록대기' | '등록완료';
type AgencyStatus = '협약대기' | '협약중' | '보류' | '협약완료';
type TabKey = 'hakjeom' | 'agency' | 'bulk' | 'stats';

// ─── 학점은행제 타입 ─────────────────────────────────────────────────────────

interface HakjeomConsultation {
  id: number;
  name: string;
  contact: string;
  education: string | null;
  reason: string | null;
  click_source: string | null;
  status: ConsultationStatus;
  memo: string | null;
  subject_cost: number | null;
  manager: string | null;
  residence: string | null;
  hope_course: string | null;
  counsel_check: string | null;
  created_at: string;
  updated_at: string | null;
  memo_count?: number;
  latest_memo?: string | null;
}

// ─── 기관협약 타입 ────────────────────────────────────────────────────────────

interface Agency {
  id: number;
  category: string | null;
  address: string | null;
  institution_name: string | null;
  contact: string | null;
  credit_commission: string | null;
  private_commission: string | null;
  manager: string | null;
  memo: string | null;
  status: AgencyStatus;
  created_at: string;
}

// ─── 일괄등록 타입 ────────────────────────────────────────────────────────────

type RowType = 'consult' | 'cert';
type BulkTabView = 'upload' | 'staging';

interface StagingRow {
  id: number;
  row_type: RowType;
  name: string;
  contact: string;
  education: string | null;
  major_category: string | null;
  hope_course: string | null;
  click_source: string | null;
  reason: string | null;
  memo: string | null;
  status: string;
  manager: string | null;
  residence: string | null;
  counsel_check: string | null;
  subject_cost: number | null;
  applied_at: string | null;
  created_at: string;
}

interface CsvRow {
  name: string; contact: string; education: string; major_category: string;
  hope_course: string; click_source: string; reason: string; memo: string;
  status: string; manager: string; residence: string; counsel_check: string;
  subject_cost: string; applied_at: string;
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const CONSULTATION_STATUS_OPTIONS: ConsultationStatus[] = ['상담대기', '상담중', '보류', '등록대기', '등록완료'];
const AGENCY_STATUS_OPTIONS: AgencyStatus[] = ['협약대기', '협약중', '보류', '협약완료'];

const CONSULTATION_STATUS_STYLE: Record<ConsultationStatus, { background: string; color: string }> = {
  상담대기: { background: '#EBF3FE', color: '#3182F6' },
  상담중:   { background: '#FFF8E6', color: '#D97706' },
  보류:     { background: '#F3F4F6', color: '#6B7684' },
  등록대기: { background: '#FEF3C7', color: '#B45309' },
  등록완료: { background: '#DCFCE7', color: '#16A34A' },
};

const AGENCY_STATUS_STYLE: Record<AgencyStatus, { background: string; color: string }> = {
  협약대기: { background: '#EBF3FE', color: '#3182F6' },
  협약중:   { background: '#FFF8E6', color: '#D97706' },
  보류:     { background: '#F3F4F6', color: '#6B7684' },
  협약완료: { background: '#DCFCE7', color: '#16A34A' },
};

const CERT_MAJOR_CATEGORIES = ['전체과정', '실버과정', '아동과정', '방과후과정', '심리과정', '커피과정', '취·창업과정'];

const COUNSEL_CHECK_OPTIONS = ['타기관', '자체가격', '직장', '육아', '가격비교', '기타'];
const REASON_OPTIONS = ['즉시취업', '이직', '미래준비', '취업'];
const EDUCATION_OPTIONS = ['고등학교 졸업', '전문대 졸업', '대학교 재학', '대학교 중퇴', '대학교 졸업', '대학원 이상'];
const HAKJEOM_COURSE_OPTIONS = ['사회복지사', '아동학사', '평생교육사', '편입/대학원', '건강가정사', '청소년지도사', '보육교사', '심리상담사'];

// ─── 검색어 하이라이트 ──────────────────────────────────────────────────────

function Highlight({ text, query }: { text: string | null; query: string }) {
  if (!query || !text) return <>{text ?? '-'}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  const hasDirectMatch = parts.length > 1;
  if (hasDirectMatch) {
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase()
            ? <mark key={i} style={{ background: '#FFE500', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>{part}</mark>
            : part
        )}
      </>
    );
  }
  // 하이픈 제거 후 매칭 (전화번호 등)
  const textClean = text.replace(/-/g, '');
  const queryClean = query.replace(/-/g, '');
  if (queryClean && textClean.toLowerCase().includes(queryClean.toLowerCase())) {
    // 원본 text에서 하이픈 포함 위치 계산
    const cleanIdx = textClean.toLowerCase().indexOf(queryClean.toLowerCase());
    let origStart = 0, cleanCount = 0;
    for (let i = 0; i < text.length && cleanCount < cleanIdx; i++) {
      if (text[i] !== '-') cleanCount++;
      origStart = i + 1;
    }
    let origEnd = origStart, matched = 0;
    for (let i = origStart; i < text.length && matched < queryClean.length; i++) {
      if (text[i] !== '-') matched++;
      origEnd = i + 1;
    }
    return (
      <>
        {text.slice(0, origStart)}
        <mark style={{ background: '#FFE500', color: 'inherit', borderRadius: 2, padding: '0 1px' }}>{text.slice(origStart, origEnd)}</mark>
        {text.slice(origEnd)}
      </>
    );
  }
  return <>{text}</>;
}

// ─── 유틸 함수 ───────────────────────────────────────────────────────────────

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatCost(cost: number | null): string {
  if (cost === null || cost === undefined) return '-';
  return cost.toLocaleString('ko-KR') + '원';
}

function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/[^0-9]/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  if (numbers.length <= 11) return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
}

// 페이지네이션 숫자 목록 (현재±2 + 처음/끝 + 생략)
function getPaginationPages(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const delta = 2;
  const rangeStart = Math.max(2, current - delta);
  const rangeEnd = Math.min(total - 1, current + delta);
  const pages: (number | '...')[] = [1];
  if (rangeStart > 2) pages.push('...');
  for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
  if (rangeEnd < total - 1) pages.push('...');
  pages.push(total);
  return pages;
}

// 맘카페 ID → 한글 이름 매핑
const CAFE_NAMES: Record<string, string> = {
  cjsam: '순광맘',
  chobomamy: '러브양산맘',
  jinhaemam: '창원진해댁',
  momspanggju: '광주맘스팡',
  cjasm: '충주아사모',
  mygodsend: '화성남양애',
  yul2moms: '율하맘',
  chbabymom: '춘천맘',
  seosanmom: '서산맘',
  redog2oi: '부천소사구',
  ksn82599: '둔산맘',
  magic26: '안평맘스비',
  anjungmom: '평택안포맘',
  tlgmdaka0: '시맘수',
  babylovecafe: '양주베이비러브',
  naese: '중리사랑방',
  andongmom: '안동맘',
  donanmam: '대전도안맘',
};

// click_source 파싱: "대분류_중분류" → { major, minor(한글), needsCheck }
const KNOWN_CAFE_IDS = new Set(Object.keys(CAFE_NAMES));
const KNOWN_CAFE_KOREAN = new Set(Object.values(CAFE_NAMES));

function parseClickSource(source: string | null): { major: string; minor: string; needsCheck: boolean } {
  if (!source) return { major: '', minor: '', needsCheck: false };
  const stripped = source.startsWith('바로폼_') ? source.slice(4) : source;
  const idx = stripped.indexOf('_');
  if (idx === -1) return { major: stripped, minor: '', needsCheck: false };
  const major = stripped.slice(0, idx);
  const rawMinor = stripped.slice(idx + 1);
  const cleanedMinor = rawMinor.replace(/\(확인필요\)/g, '');
  const resolvedName = CAFE_NAMES[cleanedMinor] ?? cleanedMinor;
  const isUnknownMamcafe =
    major === '맘카페' &&
    cleanedMinor !== '확인필요' &&
    !KNOWN_CAFE_IDS.has(cleanedMinor) &&
    !KNOWN_CAFE_KOREAN.has(cleanedMinor);
  const minor = isUnknownMamcafe ? `${resolvedName}(확인필요)` : resolvedName;
  return { major, minor, needsCheck: isUnknownMamcafe || rawMinor === '확인필요' };
}

// click_source를 사람이 읽기 쉬운 형태로 변환
// "맘카페_momspanggju" → "맘카페 > 광주맘스팡"
// "맘카페_둔산맘" → "맘카페 > 둔산맘" (이미 한글인 경우 그대로)
function formatClickSourceDisplay(source: string | null): string {
  if (!source) return '-';
  const stripped = source.startsWith('바로폼_') ? source.slice(4) : source;
  const idx = stripped.indexOf('_');
  if (idx === -1) return stripped;
  const major = stripped.slice(0, idx);
  const rawMinor = stripped.slice(idx + 1);
  const resolved = CAFE_NAMES[rawMinor] ?? rawMinor;
  return `${major} > ${resolved}`;
}

// 유입경로 대분류 목록
const SOURCE_MAJORS = ['당근', '맘카페', '네이버', '인스타', '유튜브', '카카오', '페이스북', '지인소개', '기타'];

// 맘카페 한글 이름 목록 (칩 버튼용)
const CAFE_NAME_LIST = Object.values(CAFE_NAMES);

// ─── 공통 서브 컴포넌트 ──────────────────────────────────────────────────────

function StatusBadge({ status, styleMap }: {
  status: string;
  styleMap: Record<string, { background: string; color: string }>;
}) {
  const s = styleMap[status] ?? { background: '#F3F4F6', color: '#6B7684' };
  return (
    <span
      className={styles.statusBadge}
      style={{ background: s.background, color: s.color }}
    >
      {status}
    </span>
  );
}

function StatusSelect({
  value, onChange, options, styleMap,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  styleMap: Record<string, { background: string; color: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  const s = styleMap[value] ?? { background: '#F3F4F6', color: '#6B7684' };
  return (
    <>
      <span
        className={styles.statusBadgeBtn}
        style={{ background: s.background, color: s.color }}
        onClick={e => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          setPos({ top: rect.bottom + 4, left: rect.left });
          setOpen(v => !v);
        }}
      >{value}</span>
      {open && (
        <div
          className={styles.statusSelectDropdown}
          style={{ top: pos.top, left: pos.left }}
          onClick={e => e.stopPropagation()}
        >
          {options.map(opt => {
            const st = styleMap[opt] ?? { background: '#F3F4F6', color: '#6B7684' };
            return (
              <div
                key={opt}
                className={`${styles.statusSelectOption}${value === opt ? ` ${styles.statusSelectOptionActive}` : ''}`}
                onClick={() => { onChange(opt); setOpen(false); }}
              >
                <span className={styles.statusSelectDot} style={{ background: st.color }} />
                {opt}
                {value === opt && <span style={{ marginLeft: 'auto', color: st.color, fontSize: 11 }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── Custom Select Dropdown ──────────────────────────────────────────────────

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  fullWidth?: boolean;
  style?: React.CSSProperties;
}

function CustomSelect({ value, onChange, options, placeholder, fullWidth, style }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
    setOpen(v => !v);
  };

  const selected = options.find(o => o.value === value);
  const displayLabel = selected?.label ?? placeholder ?? '선택';

  return (
    <div ref={ref} className={`${styles.customSelectWrap} ${fullWidth ? styles.customSelectFull : ''}`} style={style}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={styles.customSelectTrigger}
      >
        <span className={value ? styles.customSelectValue : styles.customSelectPlaceholder}>
          {displayLabel}
        </span>
        <svg
          className={`${styles.customSelectCaret} ${open ? styles.customSelectCaretOpen : ''}`}
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className={styles.customSelectDropdown} style={dropdownStyle}>
          {options.map(opt => (
            <div
              key={opt.value}
              className={`${styles.customSelectOption} ${opt.value === value ? styles.customSelectOptionActive : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 섹션 래퍼
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <p className={styles.sectionTitle}>{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoRowLabel}>{label}</span>
      <span className={styles.infoRowValue}>{value}</span>
    </div>
  );
}


// ─── 학점은행제 상세 패널 ────────────────────────────────────────────────────

interface HakjeomDetailPanelProps {
  item: HakjeomConsultation;
  onClose: () => void;
  onUpdate: (id: number, fields: Partial<HakjeomConsultation>) => Promise<void>;
  initialTab?: 'basic' | 'info' | 'memo';
}

function HakjeomDetailPanel({ item, onClose, onUpdate, initialTab = 'basic' }: HakjeomDetailPanelProps) {
  const initSource = (src: string | null) => {
    const { major, minor } = parseClickSource(src);
    return { major, minor: CAFE_NAMES[minor] ?? minor };
  };

  const [editStatus, setEditStatus] = useState<ConsultationStatus>(item.status);
  const [editMemo, setEditMemo] = useState(item.memo ?? '');
  const [editManager, setEditManager] = useState(item.manager ?? '');
  const [editEducation, setEditEducation] = useState(item.education ?? '');
  const [editHopeCourse, setEditHopeCourse] = useState(item.hope_course ?? '');
  const [editReason, setEditReason] = useState<string[]>(
    item.reason ? item.reason.split(', ').map(s => s.trim()).filter(Boolean) : []
  );
  const parseCounselCheck = (raw: string | null) => {
    if (!raw) return { checks: [], etc: '' };
    const items = raw.split(', ').map(s => s.trim()).filter(Boolean);
    const etcItem = items.find(s => s.startsWith('기타(') && s.endsWith(')'));
    const checks = items.map(s => s.startsWith('기타(') && s.endsWith(')') ? '기타' : s);
    const etc = etcItem ? etcItem.slice(3, -1) : (items.includes('기타') ? '' : '');
    return { checks, etc };
  };
  const initCounsel = parseCounselCheck(item.counsel_check);
  const [editCounselCheck, setEditCounselCheck] = useState<string[]>(initCounsel.checks);
  const [editCounselCheckEtc, setEditCounselCheckEtc] = useState(initCounsel.etc);
  const [editSourceMajor, setEditSourceMajor] = useState(() => initSource(item.click_source).major);
  const [editSourceMinor, setEditSourceMinor] = useState(() => initSource(item.click_source).minor);
  const [editResidence, setEditResidence] = useState(item.residence ?? '');
  const [editSubjectCost, setEditSubjectCost] = useState(item.subject_cost ? String(item.subject_cost) : '');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'info' | 'memo'>(initialTab);
  const [memoCount, setMemoCount] = useState<number | null>(null);

  const builtClickSource = editSourceMajor
    ? editSourceMinor ? `${editSourceMajor}_${editSourceMinor}` : editSourceMajor
    : '';

  useEffect(() => {
    const { major, minor } = initSource(item.click_source);
    setEditStatus(item.status);
    setEditMemo(item.memo ?? '');
    setEditManager(item.manager ?? '');
    setEditEducation(item.education ?? '');
    setEditHopeCourse(item.hope_course ?? '');
    setEditReason(item.reason ? item.reason.split(', ').map(s => s.trim()).filter(Boolean) : []);
    const counsel = parseCounselCheck(item.counsel_check);
    setEditCounselCheck(counsel.checks);
    setEditCounselCheckEtc(counsel.etc);
    setEditSourceMajor(major);
    setEditSourceMinor(minor);
    setEditResidence(item.residence ?? '');
    setEditSubjectCost(item.subject_cost ? String(item.subject_cost) : '');
  }, [item.id]);

  const toggleReason = (val: string) => {
    setEditReason(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const toggleCounselCheck = (val: string) => {
    setEditCounselCheck(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleMajorSelect = (m: string) => {
    if (editSourceMajor === m) {
      setEditSourceMajor('');
      setEditSourceMinor('');
    } else {
      setEditSourceMajor(m);
      setEditSourceMinor('');
    }
  };

  const handleMinorSelect = (cafeName: string) => {
    setEditSourceMinor(prev => prev === cafeName ? '' : cafeName);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(item.id, {
        status: editStatus,
        memo: editMemo || null,
        manager: editManager || null,
        education: editEducation || null,
        hope_course: editHopeCourse || null,
        reason: editReason.length > 0 ? editReason.join(', ') : null,
        counsel_check: editCounselCheck.length > 0
          ? editCounselCheck.map(c => c === '기타' && editCounselCheckEtc.trim() ? `기타(${editCounselCheckEtc.trim()})` : c).join(', ')
          : null,
        click_source: builtClickSource || null,
        residence: editResidence || null,
        subject_cost: editSubjectCost ? parseInt(editSubjectCost.replace(/,/g, ''), 10) || null : null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // 이니셜: 이름 첫 글자
  const avatarChar = item.name.charAt(0);

  return (
    <div
      className={styles.detailModalOverlay}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.detailModal}>
        {/* 헤더 */}
        <div className={styles.detailModalHeader}>
          <div className={styles.detailModalHeaderTop}>
            <div className={styles.detailModalHeaderLeft}>
              <div>
                <div className={styles.detailModalNameRow}>
                  <p className={styles.detailModalName}>{item.name}</p>
                  <StatusBadge status={editStatus} styleMap={CONSULTATION_STATUS_STYLE} />
                </div>
                <p className={styles.detailModalSub}>{item.contact}</p>
                <p className={styles.detailModalSub}>등록일: {formatDateShort(item.created_at)}</p>
              </div>
            </div>
            <button onClick={onClose} className={styles.detailModalCloseBtn}>✕</button>
          </div>

          {/* 탭 바 */}
          <div className={styles.detailModalTabs}>
            {(['basic', 'info', 'memo'] as const).map(tab => {
              const labels = { basic: '기본정보', info: '취득정보', memo: '메모' };
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`${styles.detailModalTab} ${activeTab === tab ? styles.detailModalTabActive : ''}`}
                >
                  {tab === 'memo' && memoCount != null && memoCount > 0
                    ? `메모 (${memoCount})`
                    : labels[tab]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 바디 */}
        <div className={styles.detailModalBody}>
          {activeTab === 'basic' && (
            <>
              {/* 유입경로 */}
              <div className={styles.detailChipSection}>
                <span className={styles.detailChipSectionLabel}>유입경로</span>
                <div className={styles.detailChipRow}>
                  {SOURCE_MAJORS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMajorSelect(m)}
                      className={editSourceMajor === m ? styles.tagBtnActive : styles.tagBtn}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {editSourceMajor === '맘카페' && (
                  <div className={styles.clickSourceSubPanel}>
                    {CAFE_NAME_LIST.map(cafeName => (
                      <button
                        key={cafeName}
                        type="button"
                        onClick={() => handleMinorSelect(cafeName)}
                        className={editSourceMinor === cafeName ? styles.tagBtnSmActive : styles.tagBtnSm}
                      >
                        {cafeName}
                      </button>
                    ))}
                  </div>
                )}
                {builtClickSource && (
                  <p className={styles.clickSourcePreview}>{formatClickSourceDisplay(builtClickSource)}</p>
                )}
              </div>

              {/* 최종학력 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>최종학력</span>
                <CustomSelect
                  value={editEducation}
                  onChange={setEditEducation}
                  fullWidth
                  options={[
                    { value: '', label: '선택 안 함' },
                    ...EDUCATION_OPTIONS.map(o => ({ value: o, label: o })),
                  ]}
                />
              </div>

              {/* 희망과정 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>희망과정</span>
                <CustomSelect
                  value={editHopeCourse}
                  onChange={setEditHopeCourse}
                  fullWidth
                  options={[
                    { value: '', label: '선택 안 함' },
                    ...HAKJEOM_COURSE_OPTIONS.map(o => ({ value: o, label: o })),
                  ]}
                />
              </div>

              {/* 거주지 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>거주지</span>
                <input
                  value={editResidence}
                  onChange={e => setEditResidence(e.target.value)}
                  placeholder="예) 서울 강남구"
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>

              {/* 과목비용 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>과목비용</span>
                <input
                  value={editSubjectCost}
                  onChange={e => setEditSubjectCost(e.target.value)}
                  placeholder="예) 580000"
                  type="number"
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>

            </>
          )}

          {activeTab === 'info' && (
            <>
              {/* 취득사유 */}
              <div className={styles.detailChipSection}>
                <span className={styles.detailChipSectionLabel}>취득사유</span>
                <div className={styles.detailChipRow}>
                  {REASON_OPTIONS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleReason(r)}
                      className={editReason.includes(r) ? styles.tagBtnActive : styles.tagBtn}
                    >
                      {editReason.includes(r) ? `✓ ${r}` : r}
                    </button>
                  ))}
                </div>
              </div>

              {/* 고민 (다중 선택) */}
              <div className={styles.detailChipSection}>
                <span className={styles.detailChipSectionLabel}>고민</span>
                <div className={styles.detailChipRow}>
                  {COUNSEL_CHECK_OPTIONS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCounselCheck(c)}
                      className={editCounselCheck.includes(c) ? styles.tagBtnActive : styles.tagBtn}
                    >
                      {editCounselCheck.includes(c) ? `✓ ${c}` : c}
                    </button>
                  ))}
                </div>
                {editCounselCheck.includes('기타') && (
                  <input
                    value={editCounselCheckEtc}
                    onChange={e => setEditCounselCheckEtc(e.target.value)}
                    placeholder="기타 내용 입력"
                    className={`${styles.input} ${styles.inputFull}`}
                    style={{ marginTop: 8 }}
                    autoFocus
                  />
                )}
              </div>

              {/* 상태 */}
              <div className={styles.detailChipSection}>
                <span className={styles.detailChipSectionLabel}>상태</span>
                <div className={styles.detailChipRow}>
                  {CONSULTATION_STATUS_OPTIONS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditStatus(s)}
                      style={
                        editStatus === s
                          ? {
                              padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                              border: `2px solid ${CONSULTATION_STATUS_STYLE[s].color}`,
                              background: CONSULTATION_STATUS_STYLE[s].background,
                              color: CONSULTATION_STATUS_STYLE[s].color,
                              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                            }
                          : {
                              padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                              border: '2px solid var(--toss-border)',
                              background: 'transparent',
                              color: 'var(--toss-text-secondary)',
                              fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                            }
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* 담당자 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>담당자</span>
                <input
                  type="text"
                  value={editManager}
                  onChange={e => setEditManager(e.target.value)}
                  placeholder="담당자 이름"
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>
            </>
          )}

          {activeTab === 'memo' && (
            <MemoTimeline
              tableName="hakjeom_consultations"
              recordId={String(item.id)}
              legacyMemo={item.memo}
              onCountChange={setMemoCount}
            />
          )}
        </div>

        {/* 푸터 */}
        <div className={styles.detailModalFooter}>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`${styles.panelSaveBtn} ${saving ? styles.panelSaveBtnDisabled : ''}`}
          >
            {saving ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 모달: 신규 추가 (학점은행제) ────────────────────────────────────────────

interface HakjeomAddModalProps {
  onClose: () => void;
  onSaved: () => void;
  uniqueManagers?: string[];
}

function HakjeomAddModal({ onClose, onSaved, uniqueManagers = [] }: HakjeomAddModalProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', contact: '', education: '',
    hope_course: '',
    reason: [] as string[],
    counsel_check: [] as string[],
    counsel_check_etc: '',
    sourceMajor: '', sourceMinor: '',
    subject_cost: '', manager: '', residence: '', memo: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; contact?: string }>({});
  const [showManagerInput, setShowManagerInput] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);

  const TOTAL_STEPS = 3;

  const toggleArr = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  useEffect(() => {
    if (step === 1) setTimeout(() => nameRef.current?.focus(), 50);
  }, [step]);

  const validateStep1 = () => {
    const newErrors: { name?: string; contact?: string } = {};
    if (!form.name.trim()) newErrors.name = '이름을 입력해주세요';
    if (!form.contact.trim()) newErrors.contact = '연락처를 입력해주세요';
    else if (form.contact.replace(/-/g, '').length < 10) newErrors.contact = '연락처를 정확히 입력해주세요';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step < TOTAL_STEPS) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/hakjeom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          hope_course: form.hope_course,
          reason: form.reason.join(', '),
          counsel_check: [
            ...form.counsel_check.filter(c => c !== '기타'),
            ...(form.counsel_check.includes('기타') && form.counsel_check_etc.trim() ? [`기타(${form.counsel_check_etc.trim()})`] : form.counsel_check.includes('기타') ? ['기타'] : []),
          ].join(', '),
          click_source: form.sourceMajor
            ? (form.sourceMinor ? `${form.sourceMajor}_${form.sourceMinor}` : form.sourceMajor)
            : '',
          is_manual_entry: true,
        }),
      });
      if (!res.ok) throw new Error('추가 실패');
      onSaved();
      onClose();
    } catch {
      alert('추가에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = formatPhoneNumber(e.target.value);
    setForm(p => ({ ...p, contact: val }));
    if (errors.contact) setErrors(p => ({ ...p, contact: undefined }));
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} className={styles.modalOverlay}>
      <div className={styles.funnelBox}>
        {/* 헤더 */}
        <div className={styles.funnelHeader}>
          <button type="button" onClick={step === 1 ? onClose : handleBack} className={styles.funnelBackBtn}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M14 9H4M4 9L8 5M4 9L8 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <span className={styles.funnelStepLabel}>{step} / {TOTAL_STEPS}</span>
          <button type="button" onClick={onClose} className={styles.funnelCloseBtn}>✕</button>
        </div>

        {/* 진행 바 */}
        <div className={styles.funnelProgressBar}>
          <div className={styles.funnelProgressFill} style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>

        {/* 스텝 콘텐츠 */}
        <div className={styles.funnelBody}>

          {/* ── Step 1: 기본 정보 + 희망과정 ── */}
          {step === 1 && (
            <div className={styles.funnelStep}>
              <p className={styles.funnelQuestion}>학생 정보를 입력해주세요</p>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>이름</label>
                <input
                  ref={nameRef}
                  value={form.name}
                  onChange={e => { setForm(p => ({ ...p, name: e.target.value })); if (errors.name) setErrors(p => ({ ...p, name: undefined })); }}
                  onKeyDown={e => e.key === 'Enter' && contactRef.current?.focus()}
                  placeholder="홍길동"
                  className={`${styles.funnelInput}${errors.name ? ` ${styles.funnelInputError}` : ''}`}
                />
                {errors.name && <p className={styles.funnelError}>{errors.name}</p>}
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>연락처</label>
                <input
                  ref={contactRef}
                  value={form.contact}
                  onChange={handleContactChange}
                  placeholder="010-0000-0000"
                  inputMode="tel"
                  className={`${styles.funnelInput}${errors.contact ? ` ${styles.funnelInputError}` : ''}`}
                />
                {errors.contact && <p className={styles.funnelError}>{errors.contact}</p>}
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>거주지 <span className={styles.funnelOptional}>(선택)</span></label>
                <input
                  value={form.residence}
                  onChange={e => setForm(p => ({ ...p, residence: e.target.value }))}
                  placeholder="예) 서울 강남구"
                  className={styles.funnelInput}
                />
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>희망과정 <span className={styles.funnelOptional}>(선택)</span></label>
                <CustomSelect
                  value={form.hope_course}
                  onChange={v => setForm(p => ({ ...p, hope_course: v }))}
                  fullWidth
                  options={[
                    { value: '', label: '선택' },
                    ...HAKJEOM_COURSE_OPTIONS.map(o => ({ value: o, label: o })),
                  ]}
                />
              </div>
            </div>
          )}

          {/* ── Step 2: 취득사유 + 최종학력 ── */}
          {step === 2 && (
            <div className={styles.funnelStep}>
              <p className={styles.funnelQuestion}>취득 목적과 학력을 선택해주세요</p>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>취득사유 <span className={styles.funnelOptional}>(복수 선택 가능)</span></label>
                <div className={styles.funnelTagRow}>
                  {REASON_OPTIONS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, reason: toggleArr(p.reason, r) }))}
                      className={form.reason.includes(r) ? styles.tagBtnV2Active : styles.tagBtnV2}
                    >
                      {form.reason.includes(r) ? `✓ ${r}` : r}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>최종학력 <span className={styles.funnelOptional}>(선택)</span></label>
                <div className={styles.funnelTagRow} style={{ flexWrap: 'wrap' }}>
                  {EDUCATION_OPTIONS.map(edu => (
                    <button
                      key={edu}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, education: p.education === edu ? '' : edu }))}
                      className={form.education === edu ? styles.tagBtnV2Active : styles.tagBtnV2}
                    >
                      {edu}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>고민 <span className={styles.funnelOptional}>(복수 선택 가능)</span></label>
                <div className={styles.funnelTagRow} style={{ flexWrap: 'wrap' }}>
                  {COUNSEL_CHECK_OPTIONS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, counsel_check: toggleArr(p.counsel_check, c) }))}
                      className={form.counsel_check.includes(c) ? styles.tagBtnV2Active : styles.tagBtnV2}
                    >
                      {form.counsel_check.includes(c) ? `✓ ${c}` : c}
                    </button>
                  ))}
                </div>
                {form.counsel_check.includes('기타') && (
                  <input
                    value={form.counsel_check_etc}
                    onChange={e => setForm(p => ({ ...p, counsel_check_etc: e.target.value }))}
                    placeholder="기타 내용 입력"
                    className={styles.funnelInput}
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Step 3: 내부 정보 ── */}
          {step === 3 && (
            <div className={styles.funnelStep}>
              <p className={styles.funnelQuestion}>내부 정보를 입력해주세요</p>
              <p className={styles.funnelSubQuestion}>모두 선택사항이에요</p>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>담당자</label>
                {uniqueManagers.length > 0 && (
                  <div className={styles.funnelTagRow} style={{ marginBottom: showManagerInput ? 8 : 0 }}>
                    {uniqueManagers.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setForm(p => ({ ...p, manager: p.manager === m ? '' : m })); setShowManagerInput(false); }}
                        className={form.manager === m ? styles.tagBtnV2Active : styles.tagBtnV2}
                      >
                        {m}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setShowManagerInput(v => !v); setForm(p => ({ ...p, manager: '' })); }}
                      className={showManagerInput ? styles.tagBtnV2Active : styles.tagBtnV2}
                    >
                      직접 입력
                    </button>
                  </div>
                )}
                {(uniqueManagers.length === 0 || showManagerInput) && (
                  <input
                    value={form.manager}
                    onChange={e => setForm(p => ({ ...p, manager: e.target.value }))}
                    placeholder="담당자 이름"
                    className={styles.funnelInput}
                    autoFocus={showManagerInput}
                  />
                )}
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>유입경로 <span className={styles.funnelOptional}>(선택)</span></label>
                <div className={styles.funnelTagRow} style={{ flexWrap: 'wrap' }}>
                  {SOURCE_MAJORS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, sourceMajor: p.sourceMajor === m ? '' : m, sourceMinor: '' }))}
                      className={form.sourceMajor === m ? styles.tagBtnV2Active : styles.tagBtnV2}
                    >
                      {form.sourceMajor === m ? `✓ ${m}` : m}
                    </button>
                  ))}
                </div>
                {form.sourceMajor === '맘카페' && (
                  <div className={styles.clickSourceSubPanel} style={{ marginTop: 8 }}>
                    {CAFE_NAME_LIST.map(cafeName => (
                      <button
                        key={cafeName}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, sourceMinor: p.sourceMinor === cafeName ? '' : cafeName }))}
                        className={form.sourceMinor === cafeName ? styles.tagBtnSmActive : styles.tagBtnSm}
                      >
                        {cafeName}
                      </button>
                    ))}
                  </div>
                )}
                {form.sourceMajor && (
                  <p className={styles.clickSourcePreview}>
                    {formatClickSourceDisplay(form.sourceMajor + (form.sourceMinor ? `_${form.sourceMinor}` : ''))}
                  </p>
                )}
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>과목비용</label>
                <input
                  value={form.subject_cost}
                  onChange={e => setForm(p => ({ ...p, subject_cost: e.target.value }))}
                  placeholder="예) 150000"
                  inputMode="numeric"
                  className={styles.funnelInput}
                />
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>메모</label>
                <textarea
                  value={form.memo}
                  onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
                  rows={3}
                  placeholder="메모 입력"
                  className={styles.textarea}
                />
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className={styles.funnelFooter}>
          {step < TOTAL_STEPS ? (
            <button type="button" onClick={handleNext} className={`${styles.btnPrimary} ${styles.funnelNextBtn}`}>
              다음
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving} className={`${styles.btnPrimary} ${styles.funnelNextBtn}`}>
              {saving ? '저장 중...' : '등록 완료'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 모달: 신규 추가 (기관협약) ──────────────────────────────────────────────

interface AgencyAddModalProps {
  editTarget?: Agency | null;
  onClose: () => void;
  onSaved: () => void;
  uniqueManagers: string[];
}

function AgencyAddModal({ editTarget, onClose, onSaved, uniqueManagers }: AgencyAddModalProps) {
  const [form, setForm] = useState({
    category: editTarget?.category ?? '',
    address: editTarget?.address ?? '',
    institution_name: editTarget?.institution_name ?? '',
    contact: editTarget?.contact ?? '',
    credit_commission: editTarget?.credit_commission ?? '',
    private_commission: editTarget?.private_commission ?? '',
    manager: editTarget?.manager ?? '',
    memo: editTarget?.memo ?? '',
    status: editTarget?.status ?? ('협약대기' as AgencyStatus),
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.institution_name.trim()) { alert('기관이름을 입력해주세요.'); return; }
    setSaving(true);
    try {
      const payload = { ...form, institution_name: form.institution_name.trim() };
      const res = await fetch('/api/hakjeom/agency', {
        method: editTarget ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editTarget ? { id: editTarget.id, ...payload } : payload),
      });
      if (!res.ok) throw new Error('저장 실패');
      onSaved();
      onClose();
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} className={styles.modalOverlay}>
      <div className={styles.modalBox}>
        <h2 className={styles.modalTitle}>{editTarget ? '기관 수정' : '기관 추가'}</h2>
        <form onSubmit={handleSubmit}>
          {([
            { label: '분류', key: 'category', placeholder: '예) 복지관, 학교, 센터' },
            { label: '지역', key: 'address', placeholder: '예) 서울 강남구' },
            { label: '기관이름 *', key: 'institution_name', placeholder: '기관이름 입력' },
            { label: '연락처', key: 'contact', placeholder: '예) 02-1234-5678' },
            { label: '학점커미션', key: 'credit_commission', placeholder: '예) 10%, 5만원' },
            { label: '민간커미션', key: 'private_commission', placeholder: '예) 15%, 3만원' },
          ] as { label: string; key: keyof typeof form; placeholder: string }[]).map(({ label, key, placeholder }) => (
            <div key={key} className={styles.modalFieldGroup}>
              <label className={styles.modalLabel}>{label}</label>
              <input
                value={String(form[key])}
                onChange={e => { const val = key === 'contact' ? formatPhoneNumber(e.target.value) : e.target.value; setForm(p => ({ ...p, [key]: val })); }}
                placeholder={placeholder}
                className={`${styles.input} ${styles.inputFull}`}
              />
            </div>
          ))}
          <div className={styles.modalFieldGroup}>
            <label className={styles.modalLabel}>담당자</label>
            {uniqueManagers.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {uniqueManagers.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, manager: p.manager === m ? '' : m }))}
                    className={form.manager === m ? styles.tagBtnV2Active : styles.tagBtnV2}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            <input
              value={form.manager}
              onChange={e => setForm(p => ({ ...p, manager: e.target.value }))}
              placeholder="직접 입력"
              className={`${styles.input} ${styles.inputFull}`}
            />
          </div>
          <div className={styles.modalFieldGroup}>
            <label className={styles.modalLabel}>메모</label>
            <textarea
              value={form.memo}
              onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
              rows={3}
              placeholder="메모 입력"
              className={styles.textarea}
            />
          </div>
          <div className={styles.modalFieldGroupLast}>
            <label className={styles.modalLabel}>상태</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {AGENCY_STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, status: s }))}
                  className={form.status === s ? styles.tagBtnV2Active : styles.tagBtnV2}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.modalBtnRow}>
            <button type="submit" disabled={saving} className={`${styles.btnPrimary} ${styles.modalBtnFlex}`}>{saving ? '저장 중...' : '저장'}</button>
            <button type="button" onClick={onClose} className={`${styles.btnSecondary} ${styles.modalBtnFlex}`}>취소</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 탭: 학점은행제 ──────────────────────────────────────────────────────────

function HakjeomTab({ setStatsNode, isActive, highlightId }: { setStatsNode: (node: React.ReactNode) => void; isActive: boolean; highlightId?: number }) {
  const [items, setItems] = useState<HakjeomConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 필터 상태
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConsultationStatus[]>([]);
  const [managerFilter, setManagerFilter] = useState<string[]>([]);
  const [majorCategoryFilter, setMajorCategoryFilter] = useState<string[]>([]);
  const [minorCategoryFilter, setMinorCategoryFilter] = useState<string[]>([]);
  const [reasonFilter, setReasonFilter] = useState<string[]>([]);
  const [counselCheckFilter, setCounselCheckFilter] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // UI 상태
  const [selectedItem, setSelectedItem] = useState<HakjeomConsultation | null>(null);
  const [openTab, setOpenTab] = useState<'basic' | 'info' | 'memo'>('basic');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [deleteToastVisible, setDeleteToastVisible] = useState(false);
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const [filterDropdownPos, setFilterDropdownPos] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showManagerAssign, setShowManagerAssign] = useState(false);

  useEffect(() => { setSelectedIds([]); }, [currentPage]);
  const [assigningManager, setAssigningManager] = useState(false);
  const [managerAssignInput, setManagerAssignInput] = useState('');
  const managerAssignRef = useRef<HTMLDivElement>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (managerAssignRef.current && !managerAssignRef.current.contains(e.target as Node)) {
        setShowManagerAssign(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 검색에서 직접 이동 시 해당 행 하이라이트
  useEffect(() => {
    if (!highlightId || items.length === 0) return;
    const idx = items.findIndex(item => item.id === highlightId);
    if (idx < 0) return;
    setCurrentPage(Math.ceil((idx + 1) / itemsPerPage));
    setTimeout(() => {
      const el = document.querySelector(`tr[data-id="${highlightId}"]`) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add(styles.highlightRow);
      setTimeout(() => el.classList.remove(styles.highlightRow), 2500);
    }, 150);
  }, [items, highlightId]);

  const fetchData = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hakjeom');
      if (!res.ok) throw new Error('데이터를 불러오지 못했습니다.');
      const data: HakjeomConsultation[] = await res.json();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (isActive) fetchData(true); }, [isActive, fetchData]);
  useEffect(() => {
    if (!openFilterColumn) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenFilterColumn(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [openFilterColumn]);

  const handleUpdate = async (id: number, fields: Partial<HakjeomConsultation>) => {
    const res = await fetch('/api/hakjeom', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...fields }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? '업데이트에 실패했습니다.');
    }
    const { data: updated } = await res.json();
    const merged = updated ?? fields;
    setItems(prev => prev.map(c => c.id === id ? { ...c, ...merged } : c));
    setSelectedItem(prev => prev?.id === id ? { ...prev, ...merged } : prev);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const handleStatusChange = async (id: number, status: ConsultationStatus) => {
    await handleUpdate(id, { status });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`${selectedIds.length}건을 삭제할까요?`)) return;
    setDeleting(true);
    await fetch('/api/hakjeom', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds }),
    });
    setSelectedIds([]);
    await fetchData();
    setDeleting(false);
    setDeleteToastVisible(true);
    setTimeout(() => setDeleteToastVisible(false), 2500);
  };

  const handleBulkAssignManager = async (manager: string) => {
    if (selectedIds.length === 0) return;
    setAssigningManager(true);
    setShowManagerAssign(false);
    await fetch('/api/hakjeom', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds, manager }),
    });
    setSelectedIds([]);
    setManagerAssignInput('');
    await fetchData();
    setAssigningManager(false);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };


  // 필터링
  const uniqueManagers = Array.from(new Set(items.map(c => c.manager).filter(Boolean))) as string[];
  const uniqueMajorCategories = Array.from(new Set(items.map(c => parseClickSource(c.click_source).major).filter(Boolean))).sort();
  const needsCheckCount = items.filter(c => parseClickSource(c.click_source).needsCheck).length;
  const uniqueMinorCategories = Array.from(new Set(
    items
      .filter(c => majorCategoryFilter.length === 0 || majorCategoryFilter.includes(parseClickSource(c.click_source).major))
      .map(c => parseClickSource(c.click_source))
      .filter(p => Boolean(p.minor) && !p.needsCheck)
      .map(p => p.minor)
  )).sort();

  const filtered = items.filter(c => {
    if (searchText) {
      const q = searchText.toLowerCase();
      const contactClean = c.contact.replace(/-/g, '');
      const searchClean = searchText.replace(/-/g, '');
      if (!(c.name.toLowerCase().includes(q) || contactClean.includes(searchClean) || (c.reason || '').toLowerCase().includes(q) || (c.memo || '').toLowerCase().includes(q) || (c.click_source || '').toLowerCase().includes(q))) return false;
    }
    if (statusFilter.length > 0 && !statusFilter.includes(c.status)) return false;
    if (managerFilter.length > 0) {
      const hasNone = managerFilter.includes('none');
      const others = managerFilter.filter(x => x !== 'none');
      const matches = (hasNone && !c.manager) || others.some(m => c.manager === m);
      if (!matches) return false;
    }
    if (majorCategoryFilter.length > 0 && !majorCategoryFilter.includes(parseClickSource(c.click_source).major)) return false;
    if (minorCategoryFilter.length > 0) {
      const parsed = parseClickSource(c.click_source);
      const matches = minorCategoryFilter.some(f => f === '__needs_check__' ? parsed.needsCheck : parsed.minor === f);
      if (!matches) return false;
    }
    if (reasonFilter.length > 0) {
      const reasons = (c.reason || '').split(', ').map(r => r.trim());
      if (!reasonFilter.some(f => reasons.includes(f))) return false;
    }
    if (counselCheckFilter.length > 0) {
      const checks = (c.counsel_check || '').split(', ').map(ch => ch.trim());
      const matches = counselCheckFilter.some(f =>
        f === '기타' ? checks.some(ch => ch.startsWith('기타')) : checks.includes(f)
      );
      if (!matches) return false;
    }
    if (startDate || endDate) {
      const d = new Date(c.created_at);
      if (startDate && d < new Date(startDate + 'T00:00:00')) return false;
      if (endDate && d > new Date(endDate + 'T23:59:59')) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSelect = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedIds(prev => prev.length === paginated.length ? [] : paginated.map(c => c.id));

  const isFiltered = searchText || statusFilter.length > 0 || managerFilter.length > 0 || majorCategoryFilter.length > 0 || minorCategoryFilter.length > 0 || reasonFilter.length > 0 || counselCheckFilter.length > 0 || startDate || endDate;

  const resetFilters = () => {
    setSearchText(''); setStatusFilter([]); setManagerFilter([]);
    setMajorCategoryFilter([]); setMinorCategoryFilter([]);
    setReasonFilter([]); setCounselCheckFilter([]);
    setStartDate(''); setEndDate(''); setCurrentPage(1);
  };

  // 담당자별 실적 (헤더 칩)
  useEffect(() => {
    if (!isActive) { setStatsNode(null); return; }
    const mgrs = Array.from(new Set(items.map(c => c.manager).filter(Boolean))) as string[];
    if (mgrs.length === 0) { setStatsNode(null); return; }
    const rate = (list: HakjeomConsultation[]) => {
      const t = list.length;
      return t > 0 ? Math.round((list.filter(c => c.status === '등록완료').length / t) * 100) : 0;
    };
    const mStats = mgrs.map(name => {
      const all = items.filter(c => c.manager === name);
      const recent30 = [...all].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 30);
      return { name, overall: rate(all), recent: rate(recent30) };
    }).sort((a, b) => b.overall - a.overall);
    const topName = mStats[0]?.overall > 0 ? mStats[0].name : null;
    setStatsNode(
      <div className={styles.statsInline}>
        <span className={styles.statsInlineLabel}>담당자 실적</span>
        {mStats.map(m => {
          const isTop = m.name === topName;
          return (
            <span key={m.name} className={`${styles.statsInlineItem} ${isTop ? styles.statsInlineItemTop : ''}`}>
              <span className={styles.statsInlineName}>
                {isTop && '🥇 '}{m.name}
              </span>
              <span className={styles.statsInlineRateGroup}>
                <span className={styles.statsInlineRateLabel}>30건</span>
                <span className={styles.statsInlineRate}>{m.recent}%</span>
              </span>
              <span className={styles.statsInlineRateGroup}>
                <span className={styles.statsInlineRateLabel}>전체</span>
                <span className={`${styles.statsInlineRate} ${isTop ? styles.statsInlineRateTop : ''}`}>{m.overall}%</span>
              </span>
            </span>
          );
        })}
      </div>
    );
    return () => setStatsNode(null);
  }, [items, setStatsNode, isActive]);

  return (
    <div>
      {loading ? <FilterBarSkeleton /> : (
        <>
          {/* 필터 영역 */}
          <div className={styles.filterRow}>
            <input type="text" value={searchText} onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }} placeholder="이름, 연락처, 취득사유, 메모 검색..." className={styles.input} style={{ width: 300 }} />
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setCurrentPage(1); }} className={styles.input} style={{ width: 140 }} />
            <span className={styles.dateSeparator}>~</span>
            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setCurrentPage(1); }} className={styles.input} style={{ width: 140 }} />
            {isFiltered && (
              <button onClick={resetFilters} className={styles.btnSecondary}>필터 초기화</button>
            )}
            {selectedIds.length > 0 && (
              <>
                <span className={styles.bulkActionCount}>{selectedIds.length}건 선택됨</span>
                <div ref={managerAssignRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowManagerAssign(v => !v)}
                    disabled={assigningManager}
                    className={styles.btnPrimary}
                  >
                    {assigningManager ? '배정 중...' : '담당자 배정 ▾'}
                  </button>
                  {showManagerAssign && (
                    <div className={styles.managerAssignDropdown}>
                      {uniqueManagers.map(m => (
                        <button
                          key={m}
                          className={styles.managerAssignOption}
                          onClick={() => handleBulkAssignManager(m)}
                        >
                          {m}
                        </button>
                      ))}
                      <div className={styles.managerAssignDivider} />
                      <div className={styles.managerAssignInputRow}>
                        <input
                          className={styles.managerAssignInput}
                          placeholder="직접 입력"
                          value={managerAssignInput}
                          onChange={e => setManagerAssignInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && managerAssignInput.trim()) handleBulkAssignManager(managerAssignInput.trim()) }}
                          autoFocus
                        />
                        <button
                          className={styles.managerAssignConfirm}
                          disabled={!managerAssignInput.trim()}
                          onClick={() => { if (managerAssignInput.trim()) handleBulkAssignManager(managerAssignInput.trim()) }}
                        >
                          확인
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={handleBulkDelete} disabled={deleting} className={styles.btnDanger}>
                  {deleting ? '삭제 중...' : '선택 삭제'}
                </button>
                <button onClick={() => { setSelectedIds([]); setShowManagerAssign(false); }} className={styles.btnSecondary}>선택 해제</button>
              </>
            )}
          </div>
          {/* 액션 바 */}
          <div className={styles.actionBar}>
            <span className={styles.actionBarCount}>
              총 <strong className={styles.actionBarCountBold}>{filtered.length}</strong>건
            </span>
            <div className={styles.actionBarSpacer} />
            <button onClick={() => setShowAddModal(true)} className={styles.btnPrimary}>+ 추가</button>
          </div>
        </>
      )}

      {/* 테이블 */}
      <div className={styles.tableCard}>
        {error ? (
          <div className={styles.tableErrorMsg}>{error}</div>
        ) : (
          <div className={styles.tableOverflow}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thCenter}>
                    <input type="checkbox" checked={paginated.length > 0 && selectedIds.length === paginated.length} onChange={toggleSelectAll} className={styles.checkbox} />
                  </th>
                  <th className={styles.thNum}>번호</th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      대분류
                      <button className={`${styles.thFilterBtn}${majorCategoryFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'major') { setOpenFilterColumn(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left }); setOpenFilterColumn('major'); }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    </div>
                  </th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      중분류
                      <button className={`${styles.thFilterBtn}${minorCategoryFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'minor') { setOpenFilterColumn(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left }); setOpenFilterColumn('minor'); }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    </div>
                  </th>
                  <th className={styles.th}>이름</th>
                  <th className={styles.th}>연락처</th>
                  <th className={styles.th}>학력</th>
                  <th className={styles.th}>희망과정</th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      취득사유
                      <button className={`${styles.thFilterBtn}${reasonFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'reason') { setOpenFilterColumn(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left }); setOpenFilterColumn('reason'); }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    </div>
                  </th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      담당자
                      <button className={`${styles.thFilterBtn}${managerFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'manager') { setOpenFilterColumn(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left }); setOpenFilterColumn('manager'); }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    </div>
                  </th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      고민
                      <button className={`${styles.thFilterBtn}${counselCheckFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'counsel') { setOpenFilterColumn(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left }); setOpenFilterColumn('counsel'); }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    </div>
                  </th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      상태
                      <button className={`${styles.thFilterBtn}${statusFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'status') { setOpenFilterColumn(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left }); setOpenFilterColumn('status'); }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    </div>
                  </th>
                  <th className={styles.th}>과목비용</th>
                  <th className={styles.th}>메모</th>
                  <th className={styles.th}>등록일</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton cols={15} rows={8} />
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={15} className={styles.tableEmptyMsg}>검색 결과가 없습니다.</td></tr>
                ) : paginated.map((item, index) => (
                  <tr
                    key={item.id}
                    data-id={item.id}
                    onClick={() => setSelectedItem(item)}
                    style={{
                      cursor: 'pointer',
                      background: selectedItem?.id === item.id ? 'var(--toss-blue-subtle, #EBF3FE)' : selectedIds.includes(item.id) ? '#f0f7ff' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (selectedItem?.id !== item.id && !selectedIds.includes(item.id)) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--toss-bg)'; }}
                    onMouseLeave={e => { if (selectedItem?.id !== item.id && !selectedIds.includes(item.id)) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                  >
                    <td className={styles.tdCenter} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)} className={styles.checkbox} />
                    </td>
                    <td className={styles.tdNum}>{(currentPage - 1) * itemsPerPage + index + 1}</td>
                    <td className={styles.tdSecondary}>{parseClickSource(item.click_source).major || '-'}</td>
                    <td className={styles.tdSecondary} style={parseClickSource(item.click_source).needsCheck ? { color: '#ef4444', fontWeight: 600 } : undefined}>{parseClickSource(item.click_source).minor || '-'}</td>
                    <td className={styles.tdBold}><Highlight text={item.name} query={searchText} /></td>
                    <td className={styles.tdTabular}><Highlight text={item.contact} query={searchText} /></td>
                    <td className={styles.tdSecondary}>{item.education ?? '-'}</td>
                    <td className={styles.tdSecondary}>{item.hope_course ?? '-'}</td>
                    <td className={styles.tdEllipsis} title={item.reason ?? ''}><Highlight text={item.reason} query={searchText} /></td>
                    <td className={styles.tdSecondary}>{item.manager ?? '-'}</td>
                    <td className={styles.tdCounsel}>
                      {item.counsel_check ? (
                        <div className={styles.counselChipRow}>
                          {item.counsel_check.split(', ').map(c => c.trim()).filter(Boolean).map(c => (
                            <span key={c} className={styles.counselChip}>{c}</span>
                          ))}
                        </div>
                      ) : <span className={styles.tdMuted}>-</span>}
                    </td>
                    <td className={styles.td} onClick={e => e.stopPropagation()}>
                      <StatusSelect
                        value={item.status}
                        onChange={v => handleStatusChange(item.id, v as ConsultationStatus)}
                        options={CONSULTATION_STATUS_OPTIONS}
                        styleMap={CONSULTATION_STATUS_STYLE}
                      />
                    </td>
                    <td className={styles.tdSecondary}>{formatCost(item.subject_cost)}</td>
                    <td className={styles.tdMemo} title={item.memo ?? ''} onClick={e => { e.stopPropagation(); setOpenTab('memo'); setSelectedItem(item); }} style={{ cursor: 'pointer' }}>
                      {item.memo || item.latest_memo || '-'}
                    </td>
                    <td className={styles.tdDateSmall}>
                      {formatDate(item.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={styles.pageBtn}
            style={{ marginRight: 4 }}
          >‹</button>
          {getPaginationPages(currentPage, totalPages).map((page, idx) =>
            page === '...'
              ? <span key={`ellipsis-${idx}`} className={styles.pageEllipsis}>…</span>
              : <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={page === currentPage ? styles.pageBtnActive : styles.pageBtn}
                >{page}</button>
          )}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={styles.pageBtn}
            style={{ marginLeft: 4 }}
          >›</button>
        </div>
      )}

      {/* 사이드 패널 */}
      {selectedItem && (
        <HakjeomDetailPanel item={selectedItem} onClose={() => { setSelectedItem(null); setOpenTab('basic'); }} onUpdate={handleUpdate} initialTab={openTab} />
      )}
      {toastVisible && <div className={styles.toast}>저장이 완료되었습니다</div>}
      {deleteToastVisible && <div className={styles.toast}>삭제되었습니다</div>}

      {/* 추가 모달 */}
      {showAddModal && (
        <HakjeomAddModal onClose={() => setShowAddModal(false)} onSaved={fetchData} uniqueManagers={uniqueManagers} />
      )}

      {/* 컬럼 필터 드롭다운 */}
      {openFilterColumn && (
        <div
          ref={dropdownRef}
          className={styles.filterColumnDropdown}
          style={{ top: filterDropdownPos.top, left: filterDropdownPos.left }}
        >
          {openFilterColumn === 'major' && (
            <>
              <div className={`${styles.filterDropdownItem}${majorCategoryFilter.length === 0 ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setMajorCategoryFilter([]); setMinorCategoryFilter([]); setCurrentPage(1); setOpenFilterColumn(null); }}>전체</div>
              {uniqueMajorCategories.map(m => (
                <div key={m} className={`${styles.filterDropdownItem}${majorCategoryFilter.includes(m) ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setMajorCategoryFilter(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]); setCurrentPage(1); }}>{m}</div>
              ))}
            </>
          )}
          {openFilterColumn === 'minor' && (
            <>
              <div className={`${styles.filterDropdownItem}${minorCategoryFilter.length === 0 ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setMinorCategoryFilter([]); setCurrentPage(1); setOpenFilterColumn(null); }}>전체</div>
              {needsCheckCount > 0 && (
                <div className={`${styles.filterDropdownItem}${minorCategoryFilter.includes('__needs_check__') ? ` ${styles.filterDropdownItemActive}` : ''}`} style={{ color: '#ef4444', fontWeight: 600 }} onClick={() => { setMinorCategoryFilter(prev => prev.includes('__needs_check__') ? prev.filter(x => x !== '__needs_check__') : [...prev, '__needs_check__']); setCurrentPage(1); }}>확인필요 ({needsCheckCount})</div>
              )}
              {uniqueMinorCategories.map(m => (
                <div key={m} className={`${styles.filterDropdownItem}${minorCategoryFilter.includes(m) ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setMinorCategoryFilter(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]); setCurrentPage(1); }}>{m}</div>
              ))}
            </>
          )}
          {openFilterColumn === 'reason' && (
            <>
              <div className={`${styles.filterDropdownItem}${reasonFilter.length === 0 ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setReasonFilter([]); setCurrentPage(1); setOpenFilterColumn(null); }}>전체</div>
              {REASON_OPTIONS.map(r => (
                <div key={r} className={`${styles.filterDropdownItem}${reasonFilter.includes(r) ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setReasonFilter(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]); setCurrentPage(1); }}>{r}</div>
              ))}
            </>
          )}
          {openFilterColumn === 'counsel' && (
            <>
              <div className={`${styles.filterDropdownItem}${counselCheckFilter.length === 0 ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setCounselCheckFilter([]); setCurrentPage(1); setOpenFilterColumn(null); }}>전체</div>
              {COUNSEL_CHECK_OPTIONS.map(c => (
                <div key={c} className={`${styles.filterDropdownItem}${counselCheckFilter.includes(c) ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setCounselCheckFilter(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]); setCurrentPage(1); }}>{c}</div>
              ))}
            </>
          )}
          {openFilterColumn === 'manager' && (
            <>
              <div className={`${styles.filterDropdownItem}${managerFilter.length === 0 ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setManagerFilter([]); setCurrentPage(1); setOpenFilterColumn(null); }}>전체</div>
              <div className={`${styles.filterDropdownItem}${managerFilter.includes('none') ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setManagerFilter(prev => prev.includes('none') ? prev.filter(x => x !== 'none') : [...prev, 'none']); setCurrentPage(1); }}>미배정</div>
              {uniqueManagers.map(m => (
                <div key={m} className={`${styles.filterDropdownItem}${managerFilter.includes(m) ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setManagerFilter(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]); setCurrentPage(1); }}>{m}</div>
              ))}
            </>
          )}
          {openFilterColumn === 'status' && (
            <>
              <div className={`${styles.filterDropdownItem}${statusFilter.length === 0 ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setStatusFilter([]); setCurrentPage(1); setOpenFilterColumn(null); }}>전체</div>
              {CONSULTATION_STATUS_OPTIONS.map(s => (
                <div key={s} className={`${styles.filterDropdownItem}${statusFilter.includes(s as ConsultationStatus) ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setStatusFilter(prev => prev.includes(s as ConsultationStatus) ? prev.filter(x => x !== s) : [...prev, s as ConsultationStatus]); setCurrentPage(1); }}>{s}</div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 탭: 기관협약 ────────────────────────────────────────────────────────────

// 기관협약 CSV 헤더 매핑
const AGENCY_HEADER_MAP: Record<string, string> = {
  '기관명': 'institution_name', 'institution_name': 'institution_name',
  '분류': 'category', 'category': 'category',
  '지역': 'address', 'region': 'address', 'address': 'address',
  '연락처': 'contact', 'contact': 'contact',
  '학점수수료': 'credit_commission', 'credit_commission': 'credit_commission',
  '민간수수료': 'private_commission', 'private_commission': 'private_commission',
  '담당자': 'manager', 'manager': 'manager',
  '메모': 'memo', 'memo': 'memo',
  '상태': 'status', 'status': 'status',
};

const AGENCY_CSV_TEMPLATE = '\uFEFF기관명,분류,지역,연락처,학점수수료,민간수수료,담당자,메모,상태\n한빛유치원,어린이집,서울 강동구,02-1234-5678,10%,15%,김담당,,협약대기\n';

function parseAgencyCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, '').replace(/^"|"$/g, ''));
  const colMap = headers.map((h, i) => ({ field: AGENCY_HEADER_MAP[h], idx: i })).filter(({ field }) => field);
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.every(c => !c)) return null;
    const row: Record<string, string> = {};
    colMap.forEach(({ field, idx }) => { if (cols[idx] !== undefined) row[field] = cols[idx]; });
    if (!row.status) row.status = '협약대기';
    return row;
  }).filter(Boolean) as Record<string, string>[];
}

function AgencyTab({ setStatsNode, isActive, highlightId }: { setStatsNode: (node: React.ReactNode) => void; isActive: boolean; highlightId?: number }) {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 필터
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<AgencyStatus | 'all'>('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // 헤더 필터 드롭다운
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const [filterDropdownPos, setFilterDropdownPos] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // UI
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Agency | null>(null);
  const [deleteToastVisible, setDeleteToastVisible] = useState(false);

  // 셀 클릭 편집
  const [fieldModal, setFieldModal] = useState<{ id: number; field: keyof Agency; label: string; value: string; multiline?: boolean } | null>(null);
  const [fieldSaving, setFieldSaving] = useState(false);

  // 검색에서 직접 이동 시 해당 행 하이라이트
  useEffect(() => {
    if (!highlightId || agencies.length === 0) return;
    const idx = agencies.findIndex(a => a.id === highlightId);
    if (idx < 0) return;
    setCurrentPage(Math.ceil((idx + 1) / ITEMS_PER_PAGE));
    setTimeout(() => {
      const el = document.querySelector(`tr[data-id="${highlightId}"]`) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add(styles.highlightRow);
      setTimeout(() => el.classList.remove(styles.highlightRow), 2500);
    }, 150);
  }, [agencies, highlightId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hakjeom/agency');
      if (!res.ok) throw new Error('데이터를 불러오지 못했습니다.');
      const data: Agency[] = await res.json();
      setAgencies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (isActive) fetchData(); }, [isActive, fetchData]);

  useEffect(() => {
    if (!openFilterColumn) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenFilterColumn(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [openFilterColumn]);

  const handleStatusChange = async (id: number, status: AgencyStatus) => {
    const res = await fetch('/api/hakjeom/agency', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setAgencies(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    }
  };

  const handleFieldSave = async () => {
    if (!fieldModal) return;
    setFieldSaving(true);
    const res = await fetch('/api/hakjeom/agency', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: fieldModal.id, [fieldModal.field]: fieldModal.value || null }),
    });
    if (res.ok) {
      setAgencies(prev => prev.map(a => a.id === fieldModal.id ? { ...a, [fieldModal.field]: fieldModal.value || null } : a));
      setFieldModal(null);
    } else {
      alert('저장에 실패했습니다.');
    }
    setFieldSaving(false);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}건을 삭제할까요?`)) return;
    setDeleting(true);
    const ids = Array.from(selectedIds);
    await fetch('/api/hakjeom/agency', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    setSelectedIds(new Set());
    await fetchData();
    setDeleting(false);
    setDeleteToastVisible(true);
    setTimeout(() => setDeleteToastVisible(false), 2500);
  };

  const uniqueManagers = Array.from(new Set(agencies.map(a => a.manager).filter(Boolean))) as string[];
  const uniqueCategories = Array.from(new Set(agencies.map(a => a.category).filter(Boolean))) as string[];

  const filtered = agencies.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
    if (managerFilter !== 'all') {
      if (managerFilter === 'none' && a.manager) return false;
      if (managerFilter !== 'none' && a.manager !== managerFilter) return false;
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      const contactClean = (a.contact || '').replace(/-/g, '');
      const searchClean = searchText.replace(/-/g, '');
      if (!((a.institution_name || '').toLowerCase().includes(q) || (a.contact || '').toLowerCase().includes(q) || contactClean.includes(searchClean) || (a.address || '').toLowerCase().includes(q) || (a.category || '').toLowerCase().includes(q) || (a.manager || '').toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // 필터 변경 시 첫 페이지로 리셋
  useEffect(() => { setCurrentPage(1); }, [searchText, statusFilter, managerFilter, categoryFilter]);

  const toggleSelect = (id: number) => setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleSelectAll = () => setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(a => a.id)));

  const isFiltered = searchText || statusFilter !== 'all' || managerFilter !== 'all' || categoryFilter !== 'all';

  // 담당자별 실적 (헤더 칩)
  useEffect(() => {
    if (!isActive) { setStatsNode(null); return; }
    const mgrs = Array.from(new Set(agencies.map(a => a.manager).filter(Boolean))) as string[];
    if (mgrs.length === 0) { setStatsNode(null); return; }
    const mStats = mgrs.map(name => {
      const all = agencies.filter(a => a.manager === name);
      return { name, total: all.length, completed: all.filter(a => a.status === '협약완료').length };
    }).sort((a, b) => b.total - a.total);
    setStatsNode(
      <div className={styles.statsInline}>
        <span className={styles.statsInlineLabel}>담당자 협약</span>
        {mStats.map(m => (
          <span key={m.name} className={styles.statsInlineItem}>
            {m.name}<span className={styles.statsInlineRate}>{m.completed}/{m.total}</span>
          </span>
        ))}
      </div>
    );
    return () => setStatsNode(null);
  }, [agencies, setStatsNode, isActive]);

  return (
    <div>
      {loading ? <FilterBarSkeleton /> : (
        <>
          <div className={styles.filterRow}>
            <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="기관명, 지역, 분류, 담당자 검색..." className={styles.input} style={{ width: 300 }} />
            {isFiltered && <button onClick={() => { setSearchText(''); setStatusFilter('all'); setManagerFilter('all'); setCategoryFilter('all'); }} className={styles.btnSecondary}>필터 초기화</button>}
          </div>

          {/* 일괄 선택 액션 바 */}
          {selectedIds.size > 0 && (
            <div className={styles.bulkActionBar}>
              <span className={styles.bulkActionCount}>{selectedIds.size}건 선택됨</span>
              <button onClick={handleDeleteSelected} disabled={deleting} className={styles.btnDanger}>
                {deleting ? '삭제 중...' : '선택 삭제'}
              </button>
              {selectedIds.size === 1 && (
                <button
                  onClick={() => { const target = agencies.find(a => a.id === Array.from(selectedIds)[0]); if (target) { setEditTarget(target); setShowModal(true); } }}
                  disabled={deleting}
                  className={styles.btnSecondary}
                >
                  수정
                </button>
              )}
              <button onClick={() => setSelectedIds(new Set())} className={styles.btnSecondary}>선택 해제</button>
            </div>
          )}

          <div className={styles.actionBar}>
            <span className={styles.actionBarCount}>총 <strong className={styles.actionBarCountBold}>{filtered.length}</strong>건</span>
            <div className={styles.actionBarSpacer} />
            <button onClick={() => { setEditTarget(null); setShowModal(true); }} className={styles.btnPrimary}>+ 기관 추가</button>
          </div>
        </>
      )}

      <div className={styles.tableCard}>
        {error ? (
          <div className={styles.tableErrorMsg}>{error}</div>
        ) : (
          <div className={styles.tableOverflow}>
            <table className={styles.tableMinWidth900}>
              <thead>
                <tr>
                  <th className={styles.thCenter}>
                    <input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length} onChange={toggleSelectAll} className={styles.checkbox} />
                  </th>
                  <th className={styles.thNum}>번호</th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      분류
                      <button className={`${styles.thFilterBtn}${categoryFilter !== 'all' ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'category') { setOpenFilterColumn(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left }); setOpenFilterColumn('category'); }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    </div>
                  </th>
                  <th className={styles.th}>지역</th>
                  <th className={styles.th}>기관이름</th>
                  <th className={styles.th}>연락처</th>
                  <th className={styles.th}>학점커미션</th>
                  <th className={styles.th}>민간커미션</th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      담당자
                      <button className={`${styles.thFilterBtn}${managerFilter !== 'all' ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'manager') { setOpenFilterColumn(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left }); setOpenFilterColumn('manager'); }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    </div>
                  </th>
                  <th className={styles.th}>메모</th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      상태
                      <button className={`${styles.thFilterBtn}${statusFilter !== 'all' ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'status') { setOpenFilterColumn(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left }); setOpenFilterColumn('status'); }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    </div>
                  </th>
                  <th className={styles.th}>등록일</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton cols={12} rows={8} />
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={12} className={styles.tableEmptyMsg}>등록된 기관이 없습니다.</td></tr>
                ) : paginated.map((a, index) => (
                  <tr key={a.id} data-id={a.id} style={{ background: selectedIds.has(a.id) ? '#f0f7ff' : 'transparent' }}>
                    <td className={styles.tdCenter}>
                      <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} className={styles.checkbox} />
                    </td>
                    <td className={styles.tdNum}>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                    <td className={styles.tdSecondary}><Highlight text={a.category} query={searchText} /></td>
                    <td className={styles.tdSecondary}><Highlight text={a.address} query={searchText} /></td>
                    <td className={styles.tdBold}><Highlight text={a.institution_name} query={searchText} /></td>
                    <td className={styles.td}>
                      {a.contact ? (
                        <span
                          onClick={() => { navigator.clipboard.writeText(a.contact!); }}
                          style={{ cursor: 'pointer', borderRadius: 4, padding: '2px 4px' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f2f4f6')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                          title="클릭하여 복사"
                        >
                          <Highlight text={a.contact} query={searchText} />
                        </span>
                      ) : '-'}
                    </td>
                    {/* 셀 클릭 편집: 학점커미션 */}
                    <td className={styles.td}>
                      <span
                        className={styles.cellClick}
                        onClick={() => setFieldModal({ id: a.id, field: 'credit_commission', label: '학점커미션', value: a.credit_commission || '' })}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f2f4f6')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                      >
                        {a.credit_commission || <span className={styles.agencyEmptyColor}>-</span>}
                      </span>
                    </td>
                    {/* 민간커미션 */}
                    <td className={styles.td}>
                      <span
                        className={styles.cellClick}
                        onClick={() => setFieldModal({ id: a.id, field: 'private_commission', label: '민간커미션', value: a.private_commission || '' })}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f2f4f6')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                      >
                        {a.private_commission || <span className={styles.agencyEmptyColor}>-</span>}
                      </span>
                    </td>
                    {/* 담당자 */}
                    <td className={styles.td}>
                      <span
                        className={styles.cellClick}
                        onClick={() => setFieldModal({ id: a.id, field: 'manager', label: '담당자', value: a.manager || '' })}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f2f4f6')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                      >
                        {a.manager ? <Highlight text={a.manager} query={searchText} /> : <span className={styles.agencyEmptyColor}>미배정</span>}
                      </span>
                    </td>
                    {/* 메모 */}
                    <td className={styles.tdMemoCell}>
                      <span
                        className={styles.cellClickMemo}
                        onClick={() => setFieldModal({ id: a.id, field: 'memo', label: '메모', value: a.memo || '', multiline: true })}
                        title={a.memo || ''}
                      >
                        {a.memo || <span className={styles.agencyEmptyColor}>-</span>}
                      </span>
                    </td>
                    <td className={styles.td} onClick={e => e.stopPropagation()}>
                      <StatusSelect
                        value={a.status}
                        onChange={v => handleStatusChange(a.id, v as AgencyStatus)}
                        options={AGENCY_STATUS_OPTIONS}
                        styleMap={AGENCY_STATUS_STYLE}
                      />
                    </td>
                    <td className={styles.agencyDateTd}>{formatDateShort(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={styles.pageBtn} style={{ marginRight: 4 }}>‹</button>
          {getPaginationPages(currentPage, totalPages).map((page, idx) =>
            page === '...'
              ? <span key={`ellipsis-${idx}`} className={styles.pageEllipsis}>…</span>
              : <button key={page} onClick={() => setCurrentPage(page)} className={page === currentPage ? styles.pageBtnActive : styles.pageBtn}>{page}</button>
          )}
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={styles.pageBtn} style={{ marginLeft: 4 }}>›</button>
        </div>
      )}

      {/* 헤더 필터 드롭다운 */}
      {openFilterColumn && (
        <div
          ref={dropdownRef}
          className={styles.filterColumnDropdown}
          style={{ top: filterDropdownPos.top, left: filterDropdownPos.left }}
        >
          {openFilterColumn === 'category' && (
            <>
              <div className={`${styles.filterDropdownItem}${categoryFilter === 'all' ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setCategoryFilter('all'); setOpenFilterColumn(null); }}>전체</div>
              {uniqueCategories.map(c => (
                <div key={c} className={`${styles.filterDropdownItem}${categoryFilter === c ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setCategoryFilter(c); setOpenFilterColumn(null); }}>{c}</div>
              ))}
            </>
          )}
          {openFilterColumn === 'manager' && (
            <>
              <div className={`${styles.filterDropdownItem}${managerFilter === 'all' ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setManagerFilter('all'); setOpenFilterColumn(null); }}>전체</div>
              <div className={`${styles.filterDropdownItem}${managerFilter === 'none' ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setManagerFilter('none'); setOpenFilterColumn(null); }}>미배정</div>
              {uniqueManagers.map(m => (
                <div key={m} className={`${styles.filterDropdownItem}${managerFilter === m ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setManagerFilter(m); setOpenFilterColumn(null); }}>{m}</div>
              ))}
            </>
          )}
          {openFilterColumn === 'status' && (
            <>
              <div className={`${styles.filterDropdownItem}${statusFilter === 'all' ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setStatusFilter('all'); setOpenFilterColumn(null); }}>전체</div>
              {AGENCY_STATUS_OPTIONS.map(s => (
                <div key={s} className={`${styles.filterDropdownItem}${statusFilter === s ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setStatusFilter(s as AgencyStatus); setOpenFilterColumn(null); }}>{s}</div>
              ))}
            </>
          )}
        </div>
      )}

      {/* 셀 편집 모달 */}
      {fieldModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setFieldModal(null); }} className={styles.modalOverlay}>
          <div className={styles.fieldModalBox}>
            <h3 className={styles.fieldModalTitle}>{fieldModal.label} 수정</h3>
            {/* 담당자는 기존 담당자 chip 선택 제공 */}
            {fieldModal.field === 'manager' && uniqueManagers.length > 0 && (
              <div className={styles.fieldModalChipRow}>
                {uniqueManagers.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setFieldModal(prev => prev ? { ...prev, value: prev.value === m ? '' : m } : prev)}
                    className={fieldModal.value === m ? styles.tagBtnChipActive : styles.tagBtnChip}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            {fieldModal.multiline ? (
              <textarea
                value={fieldModal.value}
                onChange={e => setFieldModal(prev => prev ? { ...prev, value: e.target.value } : prev)}
                rows={4}
                autoFocus
                placeholder={`${fieldModal.label} 입력`}
                className={`${styles.textarea} ${styles.fieldModalInput}`}
                onKeyDown={e => { if (e.key === 'Escape') setFieldModal(null); }}
              />
            ) : (
              <input
                value={fieldModal.value}
                onChange={e => setFieldModal(prev => prev ? { ...prev, value: e.target.value } : prev)}
                autoFocus
                placeholder={`${fieldModal.label} 입력`}
                className={`${styles.input} ${styles.fieldModalInput}`}
                onKeyDown={e => { if (e.key === 'Enter') handleFieldSave(); if (e.key === 'Escape') setFieldModal(null); }}
              />
            )}
            <div className={styles.fieldModalBtnRow}>
              <button onClick={handleFieldSave} disabled={fieldSaving} className={`${styles.btnPrimary} ${styles.fieldModalBtnFlex}`}>{fieldSaving ? '저장 중...' : '저장'}</button>
              <button onClick={() => setFieldModal(null)} className={`${styles.btnSecondary} ${styles.fieldModalBtnFlex}`}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 추가/수정 모달 */}
      {showModal && (
        <AgencyAddModal editTarget={editTarget} onClose={() => { setShowModal(false); setEditTarget(null); }} onSaved={fetchData} uniqueManagers={uniqueManagers} />
      )}
      {deleteToastVisible && <div className={styles.toast}>삭제되었습니다</div>}

    </div>
  );
}

// ─── 탭: 일괄등록 ────────────────────────────────────────────────────────────

const HEADER_MAP: Record<string, keyof CsvRow> = {
  '이름': 'name', 'name': 'name',
  '연락처': 'contact', 'contact': 'contact',
  '최종학력': 'education', 'education': 'education',
  '과정분류': 'major_category', 'major_category': 'major_category',
  '희망과정': 'hope_course', 'hope_course': 'hope_course',
  '유입경로': 'click_source', 'click_source': 'click_source',
  '상담사유': 'reason', '취득사유': 'reason', 'reason': 'reason',
  '메모': 'memo', 'memo': 'memo',
  '상태': 'status', 'status': 'status',
  '담당자': 'manager', 'manager': 'manager',
  '거주지': 'residence', 'residence': 'residence',
  '상담체크': 'counsel_check', '고민': 'counsel_check', 'counsel_check': 'counsel_check',
  '과목비용': 'subject_cost', 'subject_cost': 'subject_cost',
  '신청일시': 'applied_at', 'applied_at': 'applied_at',
};

const CONSULT_TEMPLATE = [
  '\uFEFF대분류,중분류,이름,연락처,최종학력,희망과정,취득사유,과목비용,담당자,거주지,메모,고민,신청일시,상태',
  '네이버,네이버카페,홍길동,010-1234-5678,대학교 재학,사회복지사,취업 때문에,580000,김담당,서울 강동구,,타기관,2026-03-01,상담대기',
  '맘카페,순광맘,김영희,010-2345-6789,고등학교 졸업,평생교육사,자격증 취득,450000,이담당,경기 수원시,오전 연락 요망,,2026-03-03,상담대기',
  '',
].join('\n');

const CERT_TEMPLATE = [
  '\uFEFF대분류,중분류,이름,연락처,희망과정,취득사유,과목비용,담당자,거주지,메모,고민,신청일시',
  '네이버,네이버카페,홍길동,010-1234-5678,생활지원사1급,취업 목적,280000,김담당,서울 강동구,,타기관,2026-03-01',
  '맘카페,순광맘,김영희,010-2345-6789,아동미술지도사1급,부업 준비,240000,이담당,경기 수원시,오전 연락,,가격비교,2026-03-03',
  '',
].join('\n');

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, '').replace(/^"|"$/g, ''));
  const majorIdx = headers.findIndex(h => h === '대분류');
  const minorIdx = headers.findIndex(h => h === '중분류');
  const colMap = headers.map((h, i) => ({ field: HEADER_MAP[h], idx: i }))
    .filter(({ field, idx }) => field && idx !== majorIdx && idx !== minorIdx);
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.every(c => !c)) return null;
    const row: CsvRow = { name: '', contact: '', education: '', major_category: '', hope_course: '', click_source: '', reason: '', memo: '', status: '', manager: '', residence: '', counsel_check: '', subject_cost: '', applied_at: '' };
    colMap.forEach(({ field, idx }) => { if (cols[idx] !== undefined) row[field] = cols[idx]; });
    const major = majorIdx !== -1 ? (cols[majorIdx] ?? '') : '';
    const minor = minorIdx !== -1 ? (cols[minorIdx] ?? '') : '';
    if (!row.click_source) {
      if (major && minor) row.click_source = `${major}_${minor}`;
      else if (major) row.click_source = major;
    }
    if (!row.status) row.status = '상담대기';
    return row;
  }).filter(Boolean) as CsvRow[];
}

function toCostInt(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = parseInt(String(v).replace(/[^0-9]/g, ''));
  return isNaN(n) ? null : n;
}

type BulkUploadType = RowType | 'agency';

function BulkTab({ onMoveSuccess }: { onMoveSuccess?: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<BulkTabView>('upload');
  const [uploadType, setUploadType] = useState<BulkUploadType>('consult');
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [agencyRows, setAgencyRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [staging, setStaging] = useState<StagingRow[]>([]);
  const [stagingLoading, setStagingLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [typeFilter, setTypeFilter] = useState<RowType | 'all'>('all');
  const [moving, setMoving] = useState(false);

  useEffect(() => { fetchStaging(); }, []);

  async function fetchStaging() {
    setStagingLoading(true);
    const res = await fetch('/api/bulk');
    if (res.ok) setStaging(await res.json());
    setStagingLoading(false);
  }

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      if (uploadType === 'agency') {
        setAgencyRows(parseAgencyCsv(text));
      } else {
        setCsvRows(parseCsv(text));
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  async function handleSaveToStaging() {
    if (!csvRows.length) return;
    setSaving(true);
    const rows = csvRows.map(r => ({
      row_type: uploadType,
      name: r.name, contact: r.contact,
      education: uploadType === 'consult' ? (r.education || null) : null,
      major_category: uploadType === 'cert' ? (r.major_category || null) : null,
      hope_course: r.hope_course || null,
      click_source: r.click_source || null,
      reason: r.reason || null,
      memo: r.memo || null,
      status: r.status || '상담대기',
      manager: r.manager || null,
      residence: r.residence || null,
      counsel_check: r.counsel_check || null,
      subject_cost: toCostInt(r.subject_cost),
      applied_at: r.applied_at || null,
    }));
    const res = await fetch('/api/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) });
    if (res.ok) {
      setCsvRows([]); setFileName('');
      await fetchStaging();
      setView('staging');
    }
    setSaving(false);
  }

  async function handleMove() {
    if (!selectedIds.length) return;
    const targets = staging.filter(s => selectedIds.includes(s.id));
    const consultTargets = targets.filter(t => t.row_type === 'consult');
    const certTargets = targets.filter(t => t.row_type === 'cert');
    setMoving(true);
    let ok = true;
    let errMsg = '';

    if (consultTargets.length) {
      const res = await fetch('/api/hakjeom/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: consultTargets }) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        errMsg = body.error || `학점은행제 이동 실패 (${res.status})`;
        ok = false;
      }
    }
    if (ok && certTargets.length) {
      const res = await fetch('/api/hakjeom/private-cert/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: certTargets }) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        errMsg = body.error || `민간자격증 이동 실패 (${res.status})`;
        ok = false;
      }
    }
    if (ok) {
      await fetch('/api/bulk', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selectedIds }) });
      setSelectedIds([]);
      await fetchStaging();
      onMoveSuccess?.();
    } else {
      alert(`이동 실패: ${errMsg}`);
    }
    setMoving(false);
  }

  async function handleDeleteSelected() {
    if (!selectedIds.length || !confirm(`${selectedIds.length}건을 삭제할까요?`)) return;
    await fetch('/api/bulk', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selectedIds }) });
    setSelectedIds([]);
    await fetchStaging();
  }

  function downloadTemplate() {
    const content = uploadType === 'agency' ? AGENCY_CSV_TEMPLATE : uploadType === 'consult' ? CONSULT_TEMPLATE : CERT_TEMPLATE;
    const name = uploadType === 'agency' ? '기관협약_CSV템플릿.csv' : uploadType === 'consult' ? '학점은행제_CSV템플릿.csv' : '민간자격증_CSV템플릿.csv';
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleAgencySave() {
    if (!agencyRows.length) return;
    setSaving(true);
    const res = await fetch('/api/hakjeom/agency/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: agencyRows }),
    });
    if (res.ok) {
      const { count } = await res.json();
      setAgencyRows([]); setFileName('');
      alert(`${count}건이 등록되었습니다.`);
    } else {
      const d = await res.json();
      alert(d.error || '등록에 실패했습니다.');
    }
    setSaving(false);
  }

  const filteredStaging = typeFilter === 'all' ? staging : staging.filter(s => s.row_type === typeFilter);
  const consultCount = staging.filter(s => s.row_type === 'consult').length;
  const certCount = staging.filter(s => s.row_type === 'cert').length;
  const allFilteredSelected = filteredStaging.length > 0 && filteredStaging.every(s => selectedIds.includes(s.id));

  function formatDt(d: string) {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
  }

  const CONSULT_PREVIEW_COLS: (keyof CsvRow)[] = ['click_source','name','contact','education','hope_course','reason','subject_cost','manager','residence','counsel_check','applied_at','status'];
  const CERT_PREVIEW_COLS: (keyof CsvRow)[] = ['click_source','name','contact','hope_course','reason','subject_cost','manager','residence','counsel_check','applied_at'];
  const CONSULT_HEADERS = ['유입경로','이름','연락처','최종학력','희망과정','취득사유','과목비용','담당자','거주지','고민','신청일시','상태'];
  const CERT_HEADERS = ['유입경로','이름','연락처','희망과정','취득사유','과목비용','담당자','거주지','고민','신청일시'];

  const previewCols = uploadType === 'consult' ? CONSULT_PREVIEW_COLS : CERT_PREVIEW_COLS;
  const previewHeaders = uploadType === 'consult' ? CONSULT_HEADERS : CERT_HEADERS;

  return (
    <div className={styles.bulkWrap}>
      <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

      {/* 탭 헤더 */}
      <div className={styles.bulkTabBar}>
        <button onClick={() => setView('upload')} className={`${styles.bulkTabBtn} ${view === 'upload' ? styles.bulkTabBtnActive : ''}`}>
          CSV 업로드
        </button>
        <button onClick={() => setView('staging')} className={`${styles.bulkTabBtn} ${view === 'staging' ? styles.bulkTabBtnActive : ''}`}>
          임시 저장 ({staging.length})
        </button>
        {view === 'upload' && (
          <button onClick={downloadTemplate} className={styles.bulkTemplateBtn}>
            ↓ 템플릿 다운로드
          </button>
        )}
      </div>

      {/* ── 업로드 탭 ── */}
      {view === 'upload' && (
        <div className={styles.bulkUploadArea}>
          {/* 구분 선택 */}
          <div className={styles.bulkTypeRow}>
            {(['consult', 'cert', 'agency'] as BulkUploadType[]).map(t => (
              <button key={t} onClick={() => { setUploadType(t); setCsvRows([]); setAgencyRows([]); setFileName(''); }}
                className={`${styles.bulkTypeBtn} ${uploadType === t ? styles.bulkTypeBtnActive : ''}`}>
                {t === 'consult' ? '학점은행제' : t === 'cert' ? '민간자격증' : '기관협약'}
              </button>
            ))}
          </div>

          {/* 드롭존 */}
          {!csvRows.length && !agencyRows.length && (
            <div className={styles.bulkDropzone}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <span className={styles.bulkDropzoneIcon}>📂</span>
              <p className={styles.bulkDropzoneTitle}>{uploadType === 'consult' ? '학점은행제' : uploadType === 'cert' ? '민간자격증' : '기관협약'} CSV 파일 업로드</p>
              <p className={styles.bulkDropzoneSub}>파일을 드래그하거나 클릭해서 선택하세요</p>
            </div>
          )}

          {/* 미리보기 */}
          {/* 기관협약 미리보기 */}
          {agencyRows.length > 0 && (
            <div className={styles.bulkPreviewCard}>
              <div className={styles.bulkPreviewHeader}>
                <div>
                  <span className={styles.bulkPreviewTitle}>미리보기</span>
                  <span className={styles.bulkPreviewMeta}>{fileName} · {agencyRows.length}건</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setAgencyRows([]); setFileName(''); }} className={styles.btnSecondary}>취소</button>
                  <button onClick={handleAgencySave} disabled={saving} className={styles.btnPrimary}>
                    {saving ? '등록 중...' : `${agencyRows.length}건 등록`}
                  </button>
                </div>
              </div>
              <div className={styles.bulkPreviewTableWrap}>
                <table className={styles.bulkTable}>
                  <thead><tr className={styles.bulkThead}>
                    <th className={styles.th}>#</th>
                    {['기관명', '분류', '지역', '연락처', '학점수수료', '민간수수료', '담당자', '상태'].map(h => <th key={h} className={styles.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {agencyRows.map((row, i) => (
                      <tr key={i} className={styles.tr}>
                        <td className={styles.td} style={{ color: '#aaa', textAlign: 'center' }}>{i + 1}</td>
                        <td className={styles.td}>{row.institution_name || <span className={styles.tdMuted}>-</span>}</td>
                        <td className={styles.td}>{row.category || <span className={styles.tdMuted}>-</span>}</td>
                        <td className={styles.td}>{row.address || <span className={styles.tdMuted}>-</span>}</td>
                        <td className={styles.td}>{row.contact || <span className={styles.tdMuted}>-</span>}</td>
                        <td className={styles.td}>{row.credit_commission || <span className={styles.tdMuted}>-</span>}</td>
                        <td className={styles.td}>{row.private_commission || <span className={styles.tdMuted}>-</span>}</td>
                        <td className={styles.td}>{row.manager || <span className={styles.tdMuted}>-</span>}</td>
                        <td className={styles.td}>{row.status || '협약대기'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {csvRows.length > 0 && (
            <div className={styles.bulkPreviewCard}>
              <div className={styles.bulkPreviewHeader}>
                <div>
                  <span className={styles.bulkPreviewTitle}>미리보기</span>
                  <span className={styles.bulkPreviewMeta}>{fileName} · {csvRows.length}건</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setCsvRows([]); setFileName(''); }} className={styles.btnSecondary}>취소</button>
                  <button onClick={handleSaveToStaging} disabled={saving} className={styles.btnPrimary}>
                    {saving ? '저장 중...' : `${csvRows.length}건 임시 저장`}
                  </button>
                </div>
              </div>
              <div className={styles.bulkPreviewTableWrap}>
                <table className={styles.bulkTable}>
                  <thead><tr className={styles.bulkThead}>
                    <th className={styles.th}>#</th>
                    {previewHeaders.map(h => <th key={h} className={styles.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {csvRows.map((row, i) => (
                      <tr key={i} className={styles.tr}>
                        <td className={styles.td} style={{ color: '#aaa', textAlign: 'center' }}>{i+1}</td>
                        {previewCols.map((col, j) => (
                          <td key={j} className={styles.td}>{row[col] || <span className={styles.tdMuted}>-</span>}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 컬럼 안내 */}
          <div className={styles.bulkGuideBox}>
            <p className={styles.bulkGuideTitle}>컬럼 안내</p>
            <div className={styles.bulkGuideGrid}>
              {(uploadType === 'agency' ? [
                { col: '기관명*', desc: '필수' },
                { col: '분류', desc: '어린이집, 유치원 등' },
                { col: '지역', desc: '서울 강동구 등' },
                { col: '연락처', desc: '전화번호' },
                { col: '학점수수료', desc: '10% 등 자유 입력' },
                { col: '민간수수료', desc: '15% 등 자유 입력' },
                { col: '담당자', desc: '담당자 이름' },
                { col: '메모', desc: '자유 입력' },
                { col: '상태', desc: '비우면 협약대기' },
              ] : uploadType === 'consult' ? [
                { col: '대분류', desc: '네이버, 맘카페, 당근 등' },
                { col: '중분류', desc: '→ 유입경로 자동 조합' },
                { col: '이름*', desc: '필수' },
                { col: '연락처*', desc: '필수, 010-0000-0000' },
                { col: '최종학력', desc: '고등학교 졸업 등' },
                { col: '희망과정', desc: '사회복지사, 보육교사 등' },
                { col: '취득사유', desc: '자유 입력' },
                { col: '과목비용', desc: '숫자 (콤마 포함 가능)' },
                { col: '담당자', desc: '담당자 이름' },
                { col: '거주지', desc: '지역명' },
                { col: '메모', desc: '자유 입력' },
                { col: '고민', desc: '타기관, 자체가격 등' },
                { col: '신청일시', desc: '비우면 현재 시간' },
                { col: '상태', desc: '비우면 상담대기' },
              ] : [
                { col: '대분류', desc: '네이버, 맘카페, 당근 등' },
                { col: '중분류', desc: '→ 유입경로 자동 조합' },
                { col: '이름*', desc: '필수' },
                { col: '연락처*', desc: '필수, 010-0000-0000' },
                { col: '희망과정', desc: '바리스타1급, 심리상담사1급 등' },
                { col: '취득사유', desc: '자유 입력' },
                { col: '과목비용', desc: '숫자' },
                { col: '담당자', desc: '담당자 이름' },
                { col: '거주지', desc: '지역명' },
                { col: '메모', desc: '자유 입력' },
                { col: '고민', desc: '타기관, 자체가격 등' },
                { col: '신청일시', desc: '비우면 현재 시간' },
              ]).map(({ col, desc }) => (
                <div key={col} className={styles.bulkGuideItem}>
                  <span className={styles.bulkGuideCol}>{col}</span>
                  <span className={styles.bulkGuideDesc}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 임시 저장 탭 ── */}
      {view === 'staging' && (
        <div className={styles.bulkStagingArea}>
          <div className={styles.bulkStagingToolbar}>
            <CustomSelect
              value={typeFilter}
              onChange={v => setTypeFilter(v as RowType | 'all')}
              style={{ minWidth: 140 }}
              options={[
                { value: 'all', label: `전체 (${staging.length})` },
                { value: 'consult', label: `학점은행제 (${consultCount})` },
                { value: 'cert', label: `민간자격증 (${certCount})` },
              ]}
            />
            <div style={{ flex: 1 }} />
            {selectedIds.length > 0 && <>
              <span className={styles.bulkSelectedCount}>{selectedIds.length}건 선택</span>
              <button onClick={handleMove} disabled={moving} className={styles.btnPrimary}>
                {moving ? '이동 중...' : '상담 목록으로 이동 →'}
              </button>
              <button onClick={handleDeleteSelected} className={styles.btnDanger}>삭제</button>
              <button onClick={() => setSelectedIds([])} className={styles.btnSecondary}>해제</button>
            </>}
          </div>

          {stagingLoading && <div className={styles.bulkEmptyState}>로딩 중...</div>}
          {!stagingLoading && !staging.length && (
            <div className={styles.bulkEmptyState}>
              <span className={styles.bulkEmptyIcon}>📭</span>
              <p>임시 저장된 데이터가 없습니다</p>
              <p className={styles.bulkEmptySub}>CSV 업로드 탭에서 파일을 업로드해 주세요</p>
            </div>
          )}
          {!stagingLoading && staging.length > 0 && (
            <div className={styles.tableCard}>
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.bulkTable}>
                  <thead><tr className={styles.bulkThead}>
                    <th className={styles.th} style={{ width: 40 }}>
                      <input type="checkbox" checked={allFilteredSelected} onChange={() => {
                        const ids = filteredStaging.map(s => s.id);
                        setSelectedIds(allFilteredSelected ? selectedIds.filter(id => !ids.includes(id)) : [...new Set([...selectedIds, ...ids])]);
                      }} />
                    </th>
                    <th className={styles.th}>구분</th>
                    <th className={styles.th}>이름</th>
                    <th className={styles.th}>연락처</th>
                    <th className={styles.th}>학력/과정분류</th>
                    <th className={styles.th}>희망과정</th>
                    <th className={styles.th}>유입경로</th>
                    <th className={styles.th}>상태</th>
                    <th className={styles.th}>담당자</th>
                    <th className={styles.th}>저장일</th>
                  </tr></thead>
                  <tbody>
                    {filteredStaging.length === 0 ? (
                      <tr><td colSpan={10} className={styles.tdMuted} style={{ textAlign: 'center', padding: '40px 20px' }}>데이터 없음</td></tr>
                    ) : filteredStaging.map((row) => (
                      <tr key={row.id} className={`${styles.tr} ${selectedIds.includes(row.id) ? styles.trSelected : ''}`}>
                        <td className={styles.td} style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => setSelectedIds(prev => prev.includes(row.id) ? prev.filter(x => x !== row.id) : [...prev, row.id])} />
                        </td>
                        <td className={styles.td}>
                          <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                            background: row.row_type === 'consult' ? '#EBF3FE' : '#F5F0FF',
                            color: row.row_type === 'consult' ? '#3182F6' : '#7C3AED' }}>
                            {row.row_type === 'consult' ? '학점은행제' : '민간자격증'}
                          </span>
                        </td>
                        <td className={styles.td} style={{ fontWeight: 600 }}>{row.name}</td>
                        <td className={styles.td}>{row.contact}</td>
                        <td className={styles.td}>{row.education || row.major_category || <span className={styles.tdMuted}>-</span>}</td>
                        <td className={styles.td}>{row.hope_course || <span className={styles.tdMuted}>-</span>}</td>
                        <td className={styles.td}>{row.click_source || <span className={styles.tdMuted}>-</span>}</td>
                        <td className={styles.td}>
                          <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: '#DCFCE7', color: '#16A34A' }}>{row.status}</span>
                        </td>
                        <td className={styles.td}>{row.manager || <span className={styles.tdMuted}>-</span>}</td>
                        <td className={styles.td} style={{ color: '#8b95a1', fontSize: 12 }}>{formatDt(row.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 탭: 통계 ────────────────────────────────────────────────────────────────

// 통계용 축약 타입 (API에서 필요한 필드만 사용)
interface StatItem {
  id: number;
  status: ConsultationStatus;
  click_source: string | null;
  hope_course: string | null;
  counsel_check: string | null;
  created_at: string;
}

type StatsSource = 'hakjeom';
type StatsSubTab = 'overview' | 'status' | 'source' | 'time' | 'mamcafe';

// 통계 상수
const STATS_STATUS_COLORS: Record<string, string> = {
  '상담대기': '#94a3b8', '상담중': '#3b82f6',
  '보류': '#f59e0b', '등록대기': '#8b5cf6', '등록완료': '#22c55e',
};
const STATS_STATUS_LIST: ConsultationStatus[] = ['상담대기', '상담중', '보류', '등록대기', '등록완료'];
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const SOURCE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];

const SOURCE_LABELS: { id: StatsSource; label: string }[] = [
  { id: 'hakjeom', label: '학점은행제' },
];

const STATS_SUB_TABS: { id: StatsSubTab; label: string }[] = [
  { id: 'overview', label: '개요' },
  { id: 'status', label: '상태 분석' },
  { id: 'source', label: '유입 경로' },
  { id: 'time', label: '시간 패턴' },
  { id: 'mamcafe', label: '맘카페' },
];

// 유틸
function toKST(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(d.getHours() + 9);
  return d;
}
function ym(d: Date): string { return d.toISOString().slice(0, 7); }
function ymd(d: Date): string { return d.toISOString().slice(0, 10); }
function getMajorSrc(source: string | null): string {
  if (!source) return '바로폼';
  const s = source.startsWith('바로폼_') ? source.slice(4) : source;
  const i = s.indexOf('_');
  return i === -1 ? s : s.slice(0, i);
}

// 공통 Tooltip
const StatsTip = ({ active, payload, label }: { active?: boolean; payload?: { name?: string; value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.statsTip}>
      {label && <div className={styles.statsTipLabel}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className={styles.statsTipValue}>
          {p.name ? <span className={styles.statsTipName}>{p.name} </span> : null}{p.value}건
        </div>
      ))}
    </div>
  );
};

// 요약 카드
function StatsCard({ label, value, sub, color, badge, badgeColor }: {
  label: string; value: string | number; sub?: string;
  color?: string; badge?: string; badgeColor?: string;
}) {
  return (
    <div className={styles.statsCard}>
      <div className={styles.statsCardHeader}>
        <span className={styles.statsCardLabel}>{label}</span>
        {badge && (
          <span
            className={styles.statsCardBadge}
            style={{ color: badgeColor || '#22c55e', background: (badgeColor || '#22c55e') + '15' }}
          >
            {badge}
          </span>
        )}
      </div>
      <div className={styles.statsCardValue} style={{ color: color || '#191f28' }}>{value}</div>
      {sub && <div className={styles.statsCardSub}>{sub}</div>}
    </div>
  );
}

// 패널 래퍼
function StatsPanel({ title, sub, children, style }: {
  title: string; sub?: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
  // marginBottom: 16 이 있는 경우와 없는 경우를 구분해서 처리
  const hasMb16 = style && 'marginBottom' in style && style.marginBottom === 16;
  return (
    <div className={hasMb16 ? styles.statsPanelMb16 : styles.statsPanel} style={hasMb16 ? undefined : style}>
      <div className={styles.statsPanelHeader}>
        <div className={styles.statsPanelTitle}>{title}</div>
        {sub && <div className={styles.statsPanelSub}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function StatsTab() {
  const [data, setData] = useState<StatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<StatsSource>('hakjeom');
  const [subTab, setSubTab] = useState<StatsSubTab>('overview');

  // 소스 토글 슬라이딩 pill
  const srcRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const srcBarRef = useRef<HTMLDivElement>(null);
  const [srcPill, setSrcPill] = useState<{ left: number; width: number } | null>(null);

  // 소스 변경 시 데이터 fetch
  useEffect(() => {
    setLoading(true);
    fetch(`/api/hakjeom/stats?type=${source}`)
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [source]);

  // pill 위치 계산
  useEffect(() => {
    const idx = SOURCE_LABELS.findIndex(s => s.id === source);
    const el = srcRefs.current[idx];
    const bar = srcBarRef.current;
    if (!el || !bar) return;
    const barRect = bar.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setSrcPill({ left: elRect.left - barRect.left, width: elRect.width });
  }, [source, loading]);

  // ── 기준 날짜
  const now = toKST(new Date().toISOString());
  const thisMonthKey = ym(now);
  const prevM = new Date(now); prevM.setMonth(prevM.getMonth() - 1);
  const prevMonthKey = ym(prevM);

  // ── 개요 집계
  const total = data.length;
  const thisMonth = data.filter(c => c.created_at.slice(0, 7) === thisMonthKey).length;
  const prevMonth = data.filter(c => c.created_at.slice(0, 7) === prevMonthKey).length;
  const growth = prevMonth > 0 ? Math.round(((thisMonth - prevMonth) / prevMonth) * 100) : null;
  const ago30 = new Date(now); ago30.setDate(ago30.getDate() - 29); ago30.setHours(0, 0, 0, 0);
  const recent30 = data.filter(c => new Date(c.created_at) >= ago30).length;
  const registered = data.filter(c => c.status === '등록완료').length;
  const regRate = total > 0 ? Math.round((registered / total) * 100) : 0;
  const waiting = data.filter(c => c.status === '상담대기').length;

  // ── 월별 데이터 (최근 6개월)
  const monthlyData = (() => {
    const sixAgo = new Date(now); sixAgo.setDate(1); sixAgo.setMonth(sixAgo.getMonth() - 5);
    const sixAgoYm = ym(sixAgo);
    let startYm: string;
    if (data.length > 0) {
      const earliest = data.reduce((min, c) => c.created_at < min ? c.created_at : min, data[0].created_at);
      const earliestYm = earliest.slice(0, 7);
      startYm = earliestYm > sixAgoYm ? earliestYm : sixAgoYm;
    } else {
      startYm = thisMonthKey;
    }
    const months: { month: string; 신규: number; 등록: number }[] = [];
    const cur = new Date(startYm + '-01T00:00:00');
    while (ym(cur) <= thisMonthKey) {
      const key = ym(cur);
      const list = data.filter(c => c.created_at.slice(0, 7) === key);
      months.push({ month: key.slice(5) + '월', 신규: list.length, 등록: list.filter(c => c.status === '등록완료').length });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  })();
  const monthlySub = monthlyData.length >= 6 ? '최근 6개월' : monthlyData.length > 1 ? `최근 ${monthlyData.length}개월` : '이번달';

  // ── 일별 30일
  const dailyData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (29 - i));
    const key = ymd(d);
    return { date: key.slice(5), count: data.filter(c => c.created_at.slice(0, 10) === key).length };
  });

  // ── 상태별 집계
  const statusData = STATS_STATUS_LIST.map(s => ({
    name: s, value: data.filter(c => c.status === s).length, fill: STATS_STATUS_COLORS[s],
  }));

  // ── 유입경로
  const srcMap: Record<string, number> = {};
  data.forEach(c => { const m = getMajorSrc(c.click_source); srcMap[m] = (srcMap[m] || 0) + 1; });
  const srcData = Object.entries(srcMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

  // ── 맘카페 세부 통계
  const mamcafeMap: Record<string, number> = {};
  data
    .filter(c => getMajorSrc(c.click_source) === '맘카페')
    .forEach(c => {
      const { minor } = parseClickSource(c.click_source);
      const key = minor || '미입력';
      mamcafeMap[key] = (mamcafeMap[key] || 0) + 1;
    });
  const mamcafeData = Object.entries(mamcafeMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  const mamcafeTotal = mamcafeData.reduce((s, d) => s + d.value, 0);

  // ── 시간대
  const hourData = Array.from({ length: 24 }, (_, h) => ({
    hour: String(h).padStart(2, '0'),
    count: data.filter(c => toKST(c.created_at).getHours() === h).length,
  }));
  const peakCount = hourData.length > 0 ? Math.max(...hourData.map(d => d.count)) : 0;
  const peaks = hourData.filter(d => d.count === peakCount && peakCount > 0);

  // ── 요일별
  const weekData = WEEKDAY_KO.map((day, i) => ({
    day, count: data.filter(c => toKST(c.created_at).getDay() === i).length,
  }));
  const maxWeekCount = weekData.length > 0 ? Math.max(...weekData.map(d => d.count)) : 0;

  return (
    <div className={styles.statsContainer}>

      {/* 소스 토글 */}
      <div className={styles.statsSourceToggleWrap}>
        <div ref={srcBarRef} className={styles.statsSourceBar}>
          {srcPill && (
            <div style={{
              position: 'absolute', bottom: 0, left: srcPill.left, width: srcPill.width, height: '100%',
              background: 'rgba(2,32,71,0.08)', borderRadius: 32,
              transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1), width 0.22s cubic-bezier(0.4,0,0.2,1)',
              zIndex: 0,
            }} />
          )}
          {SOURCE_LABELS.map((s, i) => (
            <button
              key={s.id}
              ref={el => { srcRefs.current[i] = el; }}
              onClick={() => setSource(s.id)}
              className={styles.statsSourceBtn}
              style={{
                fontWeight: source === s.id ? 700 : 500,
                color: source === s.id ? '#191f28' : '#8b95a1',
              }}
            >{s.label}</button>
          ))}
        </div>
      </div>

      {/* 서브탭 */}
      <div className={styles.statsSubTabBar}>
        {STATS_SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={styles.statsSubTabBtn}
            style={{
              borderBottom: subTab === t.id ? '2px solid #191f28' : '2px solid transparent',
              marginBottom: -1,
              fontWeight: subTab === t.id ? 700 : 400,
              color: subTab === t.id ? '#191f28' : '#8b95a1',
            }}
          >{t.label}</button>
        ))}
      </div>

      {loading ? (
        <>
          <StatsCardsSkeleton count={5} />
          <ChartsGridSkeleton />
        </>
      ) : (
        <>
          {/* ════ 개요 ════ */}
          {subTab === 'overview' && (
            <div>
              <div className={styles.statsGrid5}>
                <StatsCard label="전체 신청" value={total.toLocaleString()} sub="누적 전체" />
                <StatsCard
                  label="이번달 신규" value={thisMonth} sub={`전월 ${prevMonth}건`}
                  badge={growth !== null ? `${growth >= 0 ? '+' : ''}${growth}%` : undefined}
                  badgeColor={growth !== null && growth >= 0 ? '#22c55e' : '#f04452'}
                />
                <StatsCard label="최근 30일" value={recent30} sub="오늘 포함 30일" color="#6366f1" />
                <StatsCard
                  label="등록완료" value={registered} sub={`전환율 ${regRate}%`} color="#22c55e"
                  badge={`${regRate}%`} badgeColor="#22c55e"
                />
                <StatsCard
                  label="상담 대기중" value={waiting} sub="미처리 건수"
                  color={waiting > 20 ? '#f04452' : '#f59e0b'}
                />
              </div>

              <StatsPanel title="월별 신규 신청 vs 등록완료" sub={monthlySub} style={{ marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={monthlyData} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<StatsTip />} />
                    <Bar dataKey="신규" fill="#93C5FD" radius={[4, 4, 0, 0]} barSize={28} name="신규" />
                    <Bar dataKey="등록" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={28} name="등록완료" />
                    <Line type="monotone" dataKey="신규" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 3 }} name="신규 추세" />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className={styles.statsLegend}>
                  {([['#93C5FD', '신규 신청'], ['#3B82F6', '등록완료'], ['#3B82F6', '신규 추세']] as [string, string][]).map(([c, l]) => (
                    <div key={l} className={styles.statsLegendItem}>
                      <div className={styles.statsLegendDot} style={{ background: c }} />{l}
                    </div>
                  ))}
                </div>
              </StatsPanel>

              <StatsPanel title="일별 신규 상담" sub="최근 30일">
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={dailyData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="statsGrad30" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={4} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<StatsTip />} />
                    <Area type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} fill="url(#statsGrad30)" dot={false} activeDot={{ r: 4, fill: '#3B82F6' }} name="신규" />
                  </AreaChart>
                </ResponsiveContainer>
              </StatsPanel>
            </div>
          )}

          {/* ════ 상태 분석 ════ */}
          {subTab === 'status' && (
            <div>
              <div className={styles.statsGrid5}>
                {statusData.map(d => (
                  <StatsCard
                    key={d.name} label={d.name} value={d.value}
                    sub={total > 0 ? `전체의 ${Math.round((d.value / total) * 100)}%` : '-'}
                    color={d.fill}
                  />
                ))}
              </div>

              <div className={styles.statsGridStatusDetail}>
                <StatsPanel title="상태 분포">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={52} outerRadius={84} paddingAngle={2} dataKey="value">
                        {statusData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip content={<StatsTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={styles.statsStatusLegend}>
                    {statusData.map(d => (
                      <div key={d.name} className={styles.statsStatusLegendItem}>
                        <div className={styles.statsStatusLegendDot} style={{ background: d.fill }} />
                        <span className={styles.statsStatusLegendName}>{d.name}</span>
                        <span className={styles.statsStatusLegendCount}>{d.value}건</span>
                        <span className={styles.statsStatusLegendPct}>({total > 0 ? Math.round((d.value / total) * 100) : 0}%)</span>
                      </div>
                    ))}
                  </div>
                </StatsPanel>

                <StatsPanel title="전환 퍼널" sub="신청 → 등록 흐름">
                  <div className={styles.funnelList}>
                    {statusData.map(d => {
                      const pct = total > 0 ? (d.value / total) * 100 : 0;
                      return (
                        <div key={d.name} className={styles.funnelItem}>
                          <div className={styles.funnelItemHeader}>
                            <span className={styles.funnelItemName}>{d.name}</span>
                            <span className={styles.funnelItemStat}>{d.value}건 ({Math.round(pct)}%)</span>
                          </div>
                          <div className={styles.funnelBarTrack}>
                            <div
                              className={styles.funnelBarInner}
                              style={{ width: `${pct}%`, background: d.fill }}
                            >
                              {pct > 8 && <span className={styles.funnelBarLabel}>{d.value}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className={styles.funnelConversionBox}>
                    <div className={styles.funnelConversionTitle}>등록 전환율</div>
                    <div className={styles.funnelConversionRate}>{regRate}%</div>
                    <div className={styles.funnelConversionSub}>전체 {total}건 중 {registered}건 등록완료</div>
                  </div>
                </StatsPanel>
              </div>
            </div>
          )}

          {/* ════ 유입 경로 ════ */}
          {subTab === 'source' && (
            <div>
              <div className={styles.statsGrid4}>
                {srcData.slice(0, 4).map((d, i) => (
                  <StatsCard key={d.name} label={d.name} value={d.value}
                    sub={total > 0 ? `전체의 ${Math.round((d.value / total) * 100)}%` : '-'}
                    color={SOURCE_COLORS[i]}
                  />
                ))}
              </div>

              <div className={styles.statsGridSourceDetail}>
                <StatsPanel title="유입 경로별 신청 건수" sub="대분류 기준">
                  <ResponsiveContainer width="100%" height={Math.max(200, srcData.length * 42)}>
                    <BarChart data={srcData} layout="vertical" margin={{ top: 4, right: 32, bottom: 0, left: 56 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#4e5968' }} tickLine={false} axisLine={false} width={56} />
                      <Tooltip content={<StatsTip />} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={22} name="건수">
                        {srcData.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </StatsPanel>

                <StatsPanel title="비율">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={srcData} cx="50%" cy="50%" outerRadius={90} paddingAngle={2} dataKey="value">
                        {srcData.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<StatsTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={styles.statsSrcLegend}>
                    {srcData.map((d, i) => (
                      <div key={d.name} className={styles.statsSrcLegendItem}>
                        <div className={styles.statsSrcLegendDot} style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                        <span className={styles.statsSrcLegendName}>{d.name}</span>
                        <span className={styles.statsSrcLegendCount}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </StatsPanel>
              </div>

            </div>
          )}

          {/* ════ 맘카페 ════ */}
          {subTab === 'mamcafe' && (
            <div>
              <div className={styles.statsGrid4}>
                {mamcafeData.slice(0, 4).map((d, i) => (
                  <StatsCard key={d.name} label={d.name} value={d.value}
                    sub={mamcafeTotal > 0 ? `전체의 ${Math.round((d.value / mamcafeTotal) * 100)}%` : '-'}
                    color={SOURCE_COLORS[i]}
                  />
                ))}
              </div>

              {mamcafeData.length === 0 ? (
                <StatsPanel title="맘카페 세부 통계">
                  <p style={{ textAlign: 'center', color: '#8b95a1', padding: '32px 0', fontSize: 14 }}>맘카페 신청 데이터가 없습니다.</p>
                </StatsPanel>
              ) : (
                <div className={styles.statsGridSourceDetail}>
                  <StatsPanel title="카페별 신청 건수" sub="카페명 기준">
                    <ResponsiveContainer width="100%" height={Math.max(200, mamcafeData.length * 42)}>
                      <BarChart data={mamcafeData} layout="vertical" margin={{ top: 4, right: 32, bottom: 0, left: 72 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#4e5968' }} tickLine={false} axisLine={false} width={72} />
                        <Tooltip content={<StatsTip />} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={22} name="건수">
                          {mamcafeData.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </StatsPanel>

                  <StatsPanel title="비율">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={mamcafeData} cx="50%" cy="50%" outerRadius={90} paddingAngle={2} dataKey="value">
                          {mamcafeData.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<StatsTip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className={styles.statsSrcLegend}>
                      {mamcafeData.map((d, i) => (
                        <div key={d.name} className={styles.statsSrcLegendItem}>
                          <div className={styles.statsSrcLegendDot} style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                          <span className={styles.statsSrcLegendName}>{d.name}</span>
                          <span className={styles.statsSrcLegendCount}>{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </StatsPanel>
                </div>
              )}
            </div>
          )}

          {/* ════ 시간 패턴 ════ */}
          {subTab === 'time' && (
            <div>
              <div className={styles.statsGrid3}>
                <StatsCard
                  label="피크 시간대"
                  value={peaks.length > 0 ? peaks.map(p => `${p.hour}시`).join(', ') : '-'}
                  sub={peakCount > 0 ? `${peakCount}건 접수` : '데이터 없음'}
                  color="#3b82f6"
                />
                <StatsCard
                  label="평일 평균"
                  value={Math.round(weekData.filter((_, i) => i >= 1 && i <= 5).reduce((a, b) => a + b.count, 0) / 5)}
                  sub="월~금 하루 평균"
                  color="#22c55e"
                />
                <StatsCard
                  label="주말 평균"
                  value={Math.round((weekData[0].count + weekData[6].count) / 2)}
                  sub="토·일 하루 평균"
                  color="#f59e0b"
                />
              </div>

              <div className={styles.statsGrid2}>
                <StatsPanel title="요일별 신청 건수">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={weekData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 13, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<StatsTip />} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={28} name="건수">
                        {weekData.map((d, i) => (
                          <Cell key={i} fill={
                            d.count === maxWeekCount && maxWeekCount > 0 ? '#3b82f6'
                              : i === 0 || i === 6 ? '#fca5a5'
                              : '#bfdbfe'
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className={styles.statsLegendSm}>
                    {([['#bfdbfe', '평일'], ['#fca5a5', '주말'], ['#3b82f6', '최다']] as [string, string][]).map(([c, l]) => (
                      <div key={l} className={styles.statsLegendItem}>
                        <div className={styles.statsLegendDot} style={{ background: c }} />{l}
                      </div>
                    ))}
                  </div>
                </StatsPanel>

                <StatsPanel title="시간대별 신청 건수" sub="0시~23시 (KST)">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={hourData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={1} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<StatsTip />} />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]} barSize={13} name="건수">
                        {hourData.map((d, i) => (
                          <Cell key={i} fill={peaks.some(p => p.hour === d.hour) ? '#3b82f6' : '#dbeafe'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </StatsPanel>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── 메인 페이지 컴포넌트 ────────────────────────────────────────────────────

const TAB_CONFIG: { key: TabKey; label: string }[] = [
  { key: 'hakjeom', label: '학점은행제' },
  { key: 'agency', label: '기관협약' },
  { key: 'bulk', label: '일괄등록' },
  { key: 'stats', label: '통계' },
];

export default function HakjeomPage() {
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab') as TabKey | null;
  const urlHighlight = searchParams.get('highlight') ? Number(searchParams.get('highlight')) : undefined;

  const initialTab: TabKey = (urlTab === 'hakjeom' || urlTab === 'agency') ? urlTab : 'hakjeom';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [mountedTabs, setMountedTabs] = useState<Set<TabKey>>(new Set([initialTab]));
  const [statsNode, setStatsNode] = useState<React.ReactNode>(null);

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    setMountedTabs(prev => new Set([...prev, key]));
  };

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>학점은행제 사업부</h2>
          <p className={styles.pageSubTitle}>
            학점은행제, 기관협약 상담 내역을 통합 관리합니다.
          </p>
        </div>
        {statsNode}
      </div>

      {/* 탭 네비게이션 */}
      <div className={styles.tabNav}>
        {TAB_CONFIG.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={activeTab === key ? styles.tabBtnActive : styles.tabBtn}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 - 첫 방문 시 마운트, 이후 CSS로 숨김 */}
      <div style={{ display: activeTab === 'hakjeom' ? 'block' : 'none' }}>
        {mountedTabs.has('hakjeom') && <HakjeomTab setStatsNode={setStatsNode} isActive={activeTab === 'hakjeom'} highlightId={urlTab === 'hakjeom' ? urlHighlight : undefined} />}
      </div>
      <div style={{ display: activeTab === 'agency' ? 'block' : 'none' }}>
        {mountedTabs.has('agency') && <AgencyTab setStatsNode={setStatsNode} isActive={activeTab === 'agency'} highlightId={urlTab === 'agency' ? urlHighlight : undefined} />}
      </div>
      <div style={{ display: activeTab === 'bulk' ? 'block' : 'none' }}>
        {mountedTabs.has('bulk') && <BulkTab onMoveSuccess={() => handleTabChange('hakjeom')} />}
      </div>
      <div style={{ display: activeTab === 'stats' ? 'block' : 'none' }}>
        {mountedTabs.has('stats') && <StatsTab />}
      </div>
    </div>
  );
}
