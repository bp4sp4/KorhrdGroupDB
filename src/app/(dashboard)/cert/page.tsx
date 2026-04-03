'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import {
  ResponsiveContainer, ComposedChart, BarChart, AreaChart, PieChart,
  Bar, Line, Area, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import styles from '../hakjeom/page.module.css'
import certStyles from './page.module.css'
import MemoTimeline from '@/components/ui/MemoTimeline'
import MemoHoverBadge from '@/components/ui/MemoHoverBadge'
import { TableSkeleton, StatsCardsSkeleton, ChartsGridSkeleton, FilterBarSkeleton } from '@/components/ui/Skeleton'
import { downloadExcel } from '@/lib/excelExport'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled'

// source 탭 구분: 'hakjeom' = 학점연계 신청, 'edu' = 교육원, 'private-cert' = 민간자격증
type SourceTab = 'hakjeom' | 'edu' | 'private-cert' | 'stats' | 'student-mgmt' | 'student-bulk' | 'counsel-template'

// 민간자격증 관련 타입
type ConsultationStatus = '상담대기' | '상담중' | '보류' | '등록대기' | '등록완료'

// 학생관리 타입
type StudentStatus = '과정안내' | '수강중' | '미응시' | '수료' | '발급완료' | '취소'

interface CourseItem {
  name: string;
  rate: number | null;
}

interface CertStudent {
  id: number;
  name: string;
  contact: string;
  click_source: string | null;
  course: string | null;
  completion_rate: number | null;
  status: StudentStatus;
  manager: string | null;
  memo: string | null;
  created_at: string;
  memo_count?: number;
  latest_memo?: string | null;
  latest_memo_at?: string | null;
}

interface PrivateCert {
  id: number;
  name: string;
  contact: string;
  major_category: string | null;
  hope_course: string | null;
  reason: string | null;
  click_source: string | null;
  memo: string | null;
  counsel_check: string | null;
  status: ConsultationStatus;
  subject_cost: number | null;
  manager: string | null;
  residence: string | null;
  created_at: string;
  memo_count?: number;
  latest_memo?: string | null;
}

interface CertApplication {
  id: string
  name: string
  contact: string
  birth_prefix: string
  address: string
  address_main?: string | null
  address_detail?: string | null
  certificates: string[]
  cash_receipt: string
  photo_url?: string | null
  order_id?: string | null
  amount?: number | null
  payment_status?: PaymentStatus | null
  trade_id?: string | null
  mul_no?: string | null
  pay_method?: string | null
  paid_at?: string | null
  failed_at?: string | null
  cancelled_at?: string | null
  is_checked?: boolean | null
  source?: string | null
  ref?: string | null
  created_at: string
  updated_at?: string | null
  memo_count?: number
  latest_memo?: string | null
}

interface Stats {
  total: number
  paid: number
  pending: number
  cancelled: number
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const PAGE_SIZE = 10

const CERT_COURSES = [
  '병원동행매니저1급','노인돌봄생활지원사1급','방과후돌봄교실지도사1급','바리스타1급','타로심리상담사1급',
  '심리상담사1급','아동요리지도사1급','노인심리상담사1급','다문화심리상담사1급','독서논술지도사1급',
  '독서지도사1급','동화구연지도사1급','디지털중독예방지도사1급','미술심리상담사1급','미술심리상담사2급',
  '방과후수학지도사1급','스토리텔링수학지도사1급','방과후아동지도사1급','방과후학교지도사1급','병원코디네이터1급',
  '부동산권리분석사1급','부모교육상담사1급','북아트1급','산모신생아건강관리사','산후관리사',
  '손유희지도사1급','스피치지도사1급','실버인지활동지도사1급','심리분석사1급','아동공예지도자',
  '아동미술심리상담사','아동미술지도사','아동미술심리상담사1급','안전교육지도사','안전관리사',
  '안전교육지도사1급','영어동화구연지도사','유튜브크리에이터','음악심리상담사','이미지메이킹스피치',
  '인성지도사1급','인성지도사2급','자기주도학습지도사1급','자기주도학습지도사2급','자원봉사지도사1급',
  '종이접기지도사','지역아동교육지도사1급','진로적성상담사1급','코딩지도사','클레이아트지도사',
  '프레젠테이션스피치','학교폭력예방상담사1급','NIE지도사1급','교육마술지도사1급','POP디자인지도사',
  'SNS마케팅전문가','ESG경영평가사','ESG인증평가사','가족상담사','간병사',
  '네일아트코디네이터&뷰티코디네이터','데이터라벨러','도시농업전문가','독서심리상담사','디지털리터러시지도사',
  '메이크업코디네이터&뷰티코디네이터','명리심리상담사','반려동물행동상담지도사','방역관리사','베이비시터',
  '병원원무행정전문가','생활지원사','실버보드게임지도사','실버케어지도사','인형극공연지도사',
  '정원관리사','조향사','집합건물관리사','초등돌봄전담사','피부미용코디네이터&뷰티코디네이터',
  '헤어코디네이터&뷰티코디네이터','환경관리전문가','아동심리상담사','은퇴설계전문가','영농형태양광전문가',
  '자원순환관리사','마케팅기획전문가','반려동물관리사','탐정사',
]

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: '결제완료',
  pending: '결제대기',
  failed: '결제실패',
  cancelled: '취소',
}

/** 결제 상태 → statusBadge 인라인 색상 매핑 */
const PAYMENT_STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  paid: { bg: '#d1fae5', color: '#065f46' },
  pending: { bg: '#fef3c7', color: '#92400e' },
  failed: { bg: '#fee2e2', color: '#991b1b' },
  cancelled: { bg: '#fee2e2', color: '#991b1b' },
}

/** DB source 값 → 표시 텍스트 */
const SOURCE_DISPLAY: Record<string, string> = {
  bridge: '학점연계',
  prepayment: '교육원',
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'paid', label: '결제완료' },
  { value: 'pending', label: '결제대기' },
  { value: 'cancelled', label: '취소' },
  { value: 'failed', label: '결제실패' },
]

const CERT_CATEGORIES: { label: string; options: string[] }[] = [
  {
    label: '전체과정',
    options: [
      '병원동행매니저1급','노인돌봄생활지원사1급','방과후돌봄교실지도사1급','바리스타1급','타로심리상담사1급',
      '심리상담사1급','아동요리지도사1급','노인심리상담사1급','다문화심리상담사1급','독서논술지도사1급',
      '독서지도사1급','동화구연지도사1급','디지털중독예방지도사1급','미술심리상담사1급','미술심리상담사2급',
      '방과후수학지도사1급','스토리텔링수학지도사1급','방과후아동지도사1급','방과후학교지도사1급','병원코디네이터1급',
      '부동산권리분석사1급','부모교육상담사1급','북아트1급','산모신생아건강관리사','산후관리사',
      '손유희지도사1급','스피치지도사1급','실버인지활동지도사1급','심리분석사1급','아동공예지도자',
      '아동미술심리상담사','아동미술지도사','아동미술심리상담사1급','안전교육지도사','안전관리사',
      '안전교육지도사1급','영어동화구연지도사','유튜브크리에이터','음악심리상담사','이미지메이킹스피치',
      '인성지도사1급','인성지도사2급','자기주도학습지도사1급','자기주도학습지도사2급','자원봉사지도사1급',
      '종이접기지도사','지역아동교육지도사1급','진로적성상담사1급','코딩지도사','클레이아트지도사',
      '프레젠테이션스피치','학교폭력예방상담사1급','NIE지도사1급','교육마술지도사1급','POP디자인지도사','SNS마케팅전문가',
    ],
  },
  {
    label: '실버과정',
    options: ['생활지원사1급','노인심리상담사1급','병원동행매니저1급','실버인지활동지도사1급','안전교육지도사1급','자원봉사지도사1급'],
  },
  {
    label: '아동과정',
    options: ['아동미술지도사1급','아동요리지도사1급','손유희지도사1급','종이접기지도사1급','클레이아트지도사1급','북아트1급'],
  },
  {
    label: '방과후과정',
    options: ['방과후돌봄교실지도사1급','방과후아동지도사1급','영어동화구연지도사1급','코딩지도사1급','독서논술지도사1급','진로적성상담사1급','학교폭력예방상담사1급'],
  },
  {
    label: '심리과정',
    options: ['심리상담사1급','심리분석사1급','미술심리상담사1급','음악심리상담사1급','부모교육상담사1급','진로적성상담사1급','학교폭력예방상담사1급'],
  },
  {
    label: '커피과정',
    options: ['바리스타1급'],
  },
  {
    label: '취·창업과정',
    options: ['타로심리상담사1급','바리스타1급','안전관리사1급','안전교육지도사1급','산모신생아건강관리사1급','산후관리사1급','SNS마케팅전문가1급','유튜브크리에이터1급'],
  },
]

const SOURCE_TABS: { value: SourceTab; label: string }[] = [
  { value: 'hakjeom', label: '학점연계 신청' },
  { value: 'edu', label: '교육원' },
  { value: 'private-cert', label: '민간자격증' },
  { value: 'student-mgmt', label: '학생관리' },
  { value: 'student-bulk', label: '일괄등록' },
  { value: 'counsel-template', label: '상담 템플릿' },
  { value: 'stats', label: '통계' },
]

// ─── 민간자격증 상수 ─────────────────────────

const CONSULTATION_STATUS_OPTIONS: ConsultationStatus[] = ['상담대기', '상담중', '보류', '등록대기', '등록완료'];
const CONSULTATION_STATUS_STYLE: Record<ConsultationStatus, { background: string; color: string }> = {
  상담대기: { background: '#EBF3FE', color: '#3182F6' },
  상담중:   { background: '#FFF8E6', color: '#D97706' },
  보류:     { background: '#F3F4F6', color: '#6B7684' },
  등록대기: { background: '#FEF3C7', color: '#B45309' },
  등록완료: { background: '#DCFCE7', color: '#16A34A' },
};
const CERT_MAJOR_CATEGORIES = ['전체과정', '실버과정', '아동과정', '방과후과정', '심리과정', '커피과정', '취·창업과정'];
const COUNSEL_CHECK_OPTIONS = ['타기관', '자체가격', '직장', '육아', '가격비교', '기타'];
const REASON_OPTIONS = ['즉시취업', '이직', '미래준비', '취업'];
const CAFE_NAMES: Record<string, string> = {
  cjsam: '순광맘', chobomamy: '러브양산맘', jinhaemam: '창원진해댁', momspanggju: '광주맘스팡',
  cjasm: '충주아사모', mygodsend: '화성남양애', yul2moms: '율하맘', chbabymom: '춘천맘',
  seosanmom: '서산맘', redog2oi: '부천소사구', ksn82599: '둔산맘', magic26: '안평맘스비',
  anjungmom: '평택안포맘', tlgmdaka0: '시맘수', babylovecafe: '양주베이비러브', naese: '중리사랑방',
  andongmom: '안동맘', donanmam: '대전도안맘',
};
const KNOWN_CAFE_IDS = new Set(Object.keys(CAFE_NAMES));
const KNOWN_CAFE_KOREAN = new Set(Object.values(CAFE_NAMES));
const SOURCE_MAJORS = ['당근', '맘카페', '네이버', '인스타', '유튜브', '카카오', '페이스북', '지인소개', '기타'];
const CAFE_NAME_LIST = Object.values(CAFE_NAMES);

// ─── 학생관리 상수 ─────────────────────────
const STUDENT_STATUS_OPTIONS: StudentStatus[] = ['과정안내', '수강중', '미응시', '수료', '발급완료', '취소'];
const STUDENT_STATUS_STYLE: Record<StudentStatus, { background: string; color: string }> = {
  과정안내: { background: '#EBF3FE', color: '#3182F6' },
  수강중:   { background: '#FFF8E6', color: '#D97706' },
  미응시:   { background: '#FEE2E2', color: '#991B1B' },
  수료:     { background: '#DCFCE7', color: '#16A34A' },
  발급완료: { background: '#D1FAE5', color: '#065F46' },
  취소:     { background: '#F3F4F6', color: '#6B7684' },
};

// 한국시간 기준 경과 시간 계산
function getKstElapsedHours(dateStr: string): number {
  const now = new Date();
  const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const created = new Date(dateStr);
  const kstCreated = new Date(created.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return (kstNow.getTime() - kstCreated.getTime()) / (1000 * 60 * 60);
}

// 생성일로부터 N일째 되는 날 10시 이후인지 확인 (KST 기준)
// N=1: 다음 날 10시, N=7: 7일 후 10시
function isPastNthDay10AM(dateStr: string, days: number): boolean {
  const kstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const kstCreated = new Date(new Date(dateStr).toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const target = new Date(kstCreated);
  target.setDate(target.getDate() + days);
  target.setHours(10, 0, 0, 0);
  return kstNow >= target;
}

// 학생 목록 정렬: 상단노출 규칙 적용
// - 과정안내/수강중: 다음 날(1일 후) 10시 이후 상단 노출
// - 미응시/수료/발급완료/취소: 7일 후 10시 이후 상단 노출
function sortStudents(items: CertStudent[]): CertStudent[] {
  const TOP_STATUSES: StudentStatus[] = ['과정안내', '수강중'];
  const DONE_STATUSES: StudentStatus[] = ['미응시', '수료', '발급완료', '취소'];

  const topItems: CertStudent[] = [];
  const doneItems: CertStudent[] = [];
  const normalItems: CertStudent[] = [];

  for (const item of items) {
    if (TOP_STATUSES.includes(item.status) && isPastNthDay10AM(item.created_at, 1)) {
      topItems.push(item);
    } else if (DONE_STATUSES.includes(item.status) && isPastNthDay10AM(item.created_at, 7)) {
      doneItems.push(item);
    } else {
      normalItems.push(item);
    }
  }

  return [...topItems, ...doneItems, ...normalItems];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** 과목 JSON 파싱 (하위 호환: 순수 문자열이면 rate=null로 변환) */
function parseCourseItems(val: string | null): CourseItem[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return val.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name, rate: null }));
}

function serializeCourseItems(items: CourseItem[]): string {
  if (items.length === 0) return '';
  return JSON.stringify(items);
}

function getCourseNames(val: string | null): string {
  return parseCourseItems(val).map(c => c.name).join(', ');
}

/** 페이지네이션 버튼 배열 계산 (hakjeom 패턴 동일) */
function getPaginationPages(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const delta = 2
  const rangeStart = Math.max(2, current - delta)
  const rangeEnd = Math.min(total - 1, current + delta)
  const pages: (number | '...')[] = [1]
  if (rangeStart > 2) pages.push('...')
  for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i)
  if (rangeEnd < total - 1) pages.push('...')
  pages.push(total)
  return pages
}

/** 검색어 하이라이트 컴포넌트 */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  if (parts.length > 1) {
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className={certStyles.highlightMark}>{part}</mark>
          ) : (
            part
          ),
        )}
      </>
    )
  }
  // 하이픈 제거 후 매칭 (전화번호 등)
  const textClean = text.replace(/-/g, '')
  const queryClean = query.replace(/-/g, '')
  if (queryClean && textClean.toLowerCase().includes(queryClean.toLowerCase())) {
    const cleanIdx = textClean.toLowerCase().indexOf(queryClean.toLowerCase())
    let origStart = 0, cleanCount = 0
    for (let i = 0; i < text.length && cleanCount < cleanIdx; i++) {
      if (text[i] !== '-') cleanCount++
      origStart = i + 1
    }
    let origEnd = origStart, matched = 0
    for (let i = origStart; i < text.length && matched < queryClean.length; i++) {
      if (text[i] !== '-') matched++
      origEnd = i + 1
    }
    return (
      <>
        {text.slice(0, origStart)}
        <mark className={certStyles.highlightMark}>{text.slice(origStart, origEnd)}</mark>
        {text.slice(origEnd)}
      </>
    )
  }
  return <>{text}</>
}

// ─── 민간자격증 헬퍼 ─────────────────────────

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
  return { major, minor, needsCheck: isUnknownMamcafe || cleanedMinor === '확인필요' };
}

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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/[^0-9]/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  if (numbers.length <= 11) return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
}

// ─── 민간자격증 공통 컴포넌트 ─────────────────

function StatusBadge({ status, styleMap }: {
  status: string;
  styleMap: Record<string, { background: string; color: string }>;
}) {
  const s = styleMap[status] ?? { background: '#F3F4F6', color: '#6B7684' };
  return (
    <span className={styles.statusBadge} style={{ background: s.background, color: s.color }}>
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
                {value === opt && <span className={certStyles.statusSelectCheck} style={{ color: st.color }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

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
        position: 'fixed', top: rect.bottom + 6, left: rect.left, width: rect.width, zIndex: 9999,
      });
    }
    setOpen(v => !v);
  };

  const selected = options.find(o => o.value === value);
  const displayLabel = selected?.label ?? placeholder ?? '선택';

  return (
    <div ref={ref} className={`${styles.customSelectWrap} ${fullWidth ? styles.customSelectFull : ''}`} style={style}>
      <button ref={triggerRef} type="button" onClick={handleOpen} className={styles.customSelectTrigger}>
        <span className={value ? styles.customSelectValue : styles.customSelectPlaceholder}>{displayLabel}</span>
        <svg
          className={`${styles.customSelectCaret} ${open ? styles.customSelectCaretOpen : ''}`}
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
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

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

/** 수강과목 자동완성 입력 (단일, 필터용) */
function CourseAutocomplete({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const suggestions = value.trim()
    ? CERT_COURSES.filter(c => c.toLowerCase().includes(value.toLowerCase()))
    : CERT_COURSES;

  function openWithPos() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(true);
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapRef} className={certStyles.courseAutoWrap}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => { onChange(e.target.value); openWithPos(); }}
        onFocus={openWithPos}
        onClick={openWithPos}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && createPortal(
        <div
          className={certStyles.courseAutoDropdown}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: Math.max(pos.width, 220) }}
          onMouseDown={e => e.preventDefault()}
        >
          {suggestions.map(s => (
            <div
              key={s}
              className={certStyles.courseAutoItem}
              onMouseDown={() => { onChange(s); setOpen(false); }}
            >
              {s}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

/** 수강과목 복수 선택 태그 입력 - 과목별 수강률 포함 (상세 패널 / 추가 모달용) */
function CourseTagInput({
  items,
  onChange,
  placeholder,
}: {
  items: CourseItem[];
  onChange: (v: CourseItem[]) => void;
  placeholder?: string;
}) {
  const [inputVal, setInputVal] = useState('');
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const tagNames = items.map(i => i.name);
  const suggestions = inputVal.trim()
    ? CERT_COURSES.filter(c => c.toLowerCase().includes(inputVal.toLowerCase()) && !tagNames.includes(c))
    : CERT_COURSES.filter(c => !tagNames.includes(c));

  function openWithPos() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(true);
  }

  function addItem(name: string) {
    onChange([...items, { name, rate: 0 }]);
    setInputVal('');
    setOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function removeItem(name: string) {
    onChange(items.filter(i => i.name !== name));
  }

  function updateRate(name: string, rateStr: string) {
    const parsed = rateStr === '' ? 0 : Number(rateStr);
    const rate = isNaN(parsed) ? 0 : Math.min(100, Math.max(0, parsed));
    onChange(items.map(i => i.name === name ? { ...i, rate } : i));
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapRef} className={certStyles.courseTagWrap}>
      {items.map(item => (
        <div key={item.name} className={certStyles.courseTagRow}>
          <span className={certStyles.courseTagName}>{item.name}</span>
          <input
            type="number"
            min={0}
            max={100}
            value={item.rate ?? 0}
            onChange={e => updateRate(item.name, e.target.value)}
            placeholder="0"
            className={certStyles.courseTagRateInput}
          />
          <span className={certStyles.courseTagRateUnit}>%</span>
          <button
            type="button"
            className={certStyles.courseTagRemove}
            onMouseDown={e => { e.preventDefault(); removeItem(item.name); }}
          >×</button>
        </div>
      ))}
      <input
        ref={inputRef}
        value={inputVal}
        onChange={e => { setInputVal(e.target.value); openWithPos(); }}
        onFocus={openWithPos}
        onClick={openWithPos}
        placeholder={items.length === 0 ? (placeholder ?? '과목 검색 후 추가...') : '+ 과목 추가'}
        className={certStyles.courseTagInput}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && createPortal(
        <div
          className={certStyles.courseAutoDropdown}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: Math.max(pos.width, 220) }}
          onMouseDown={e => e.preventDefault()}
        >
          {suggestions.map(s => (
            <div key={s} className={certStyles.courseAutoItem} onMouseDown={() => addItem(s)}>
              {s}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

/** 결제 상태 배지 */
function PaymentBadge({ status }: { status?: PaymentStatus | null }) {
  const key = status ?? 'pending'
  const color = PAYMENT_STATUS_COLOR[key] ?? PAYMENT_STATUS_COLOR.pending
  return (
    <span
      className={styles.statusBadge}
      style={{ background: color.bg, color: color.color }}
    >
      {PAYMENT_STATUS_LABEL[key] ?? key}
    </span>
  )
}

/** 통계 카드 */
function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`${styles.statsCard} ${certStyles.statCardWrap}`}>
      <p className={`${styles.statsCardLabel} ${certStyles.statCardLabel}`}>{label}</p>
      <p
        className={`${styles.statsCardValue} ${highlight ? certStyles.statCardValueHighlight : certStyles.statCardValue}`}
      >
        {value.toLocaleString()}
        <span className={certStyles.statCardUnit}>건</span>
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────
// Detail Panel (hakjeom detailModal 패턴)
// ─────────────────────────────────────────────

function DetailPanel({
  app,
  onClose,
  onUpdate,
}: {
  app: CertApplication
  onClose: () => void
  onUpdate: (id: string, fields: Partial<CertApplication>) => Promise<void>
}) {
  const [activeTab, setActiveTab] = useState<'basic' | 'payment' | 'memo'>('basic')
  const [memoCount, setMemoCount] = useState<number | null>(null)
  const [editName, setEditName] = useState(app.name)
  const [editContact, setEditContact] = useState(app.contact)
  const [editBirthPrefix, setEditBirthPrefix] = useState(app.birth_prefix ?? '')
  const [editAddress, setEditAddress] = useState(app.address_main ?? app.address ?? '')
  const [editAddressDetail, setEditAddressDetail] = useState(app.address_detail ?? '')
  const [editCerts, setEditCerts] = useState(app.certificates?.join(', ') ?? '')
  const [editCashReceipt, setEditCashReceipt] = useState(app.cash_receipt ?? '')
  const [editPaymentStatus, setEditPaymentStatus] = useState<string>(app.payment_status ?? 'pending')
  const [editAmount, setEditAmount] = useState(app.amount ? String(app.amount) : '')
  const [isChecked, setIsChecked] = useState(!!app.is_checked)
  const [saving, setSaving] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const handlePhotoFileChange = (file: File) => {
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = e => setPhotoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handlePhotoDownload = async () => {
    if (!app.photo_url) return
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${app.photo_url}`
    const res = await fetch(url)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const img = new Image()
    img.src = objectUrl
    await new Promise(resolve => { img.onload = resolve })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(objectUrl)
    canvas.toBlob(jpgBlob => {
      if (!jpgBlob) return
      const jpgUrl = URL.createObjectURL(jpgBlob)
      const a = document.createElement('a')
      a.href = jpgUrl
      const baseName = (app.photo_url!.split('/').pop() ?? 'photo').replace(/\.[^/.]+$/, '')
      a.download = `${baseName}.jpg`
      a.click()
      URL.revokeObjectURL(jpgUrl)
    }, 'image/jpeg', 0.92)
  }

  useEffect(() => {
    setEditName(app.name)
    setEditContact(app.contact)
    setEditBirthPrefix(app.birth_prefix ?? '')
    setEditAddress(app.address_main ?? app.address ?? '')
    setEditAddressDetail(app.address_detail ?? '')
    setEditCerts(app.certificates?.join(', ') ?? '')
    setEditCashReceipt(app.cash_receipt ?? '')
    setEditPaymentStatus(app.payment_status ?? 'pending')
    setEditAmount(app.amount ? String(app.amount) : '')
    setIsChecked(!!app.is_checked)
    setActiveTab('basic')
  }, [app.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      let newPhotoUrl: string | undefined
      if (photoFile) {
        setUploadingPhoto(true)
        const fd = new FormData()
        fd.append('id', app.id)
        fd.append('photo', photoFile)
        const res = await fetch('/api/cert/photo', { method: 'POST', body: fd })
        if (res.ok) {
          const json = await res.json()
          newPhotoUrl = json.photo_url
        }
        setUploadingPhoto(false)
        setPhotoFile(null)
        setPhotoPreview(null)
      }
      await onUpdate(app.id, {
        name: editName,
        contact: editContact,
        birth_prefix: editBirthPrefix || undefined,
        address: editAddress || undefined,
        address_detail: editAddressDetail || undefined,
        certificates: editCerts ? editCerts.split(',').map(s => s.trim()).filter(Boolean) : [],
        cash_receipt: editCashReceipt || undefined,
        payment_status: editPaymentStatus as PaymentStatus,
        amount: editAmount ? Number(editAmount) : undefined,
        is_checked: isChecked,
        ...(newPhotoUrl ? { photo_url: newPhotoUrl } : {}),
      })
      onClose()
    } finally {
      setSaving(false)
      setUploadingPhoto(false)
    }
  }

  const tabLabels = { basic: '기본정보', payment: '결제정보', memo: '메모' } as const

  return (
    <div
      className={styles.detailModalOverlay}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={styles.detailModal}>
        {/* 헤더 */}
        <div className={styles.detailModalHeader}>
          <div className={styles.detailModalHeaderTop}>
            <div className={styles.detailModalHeaderLeft}>
              <div>
                <div className={styles.detailModalNameRow}>
                  <p className={styles.detailModalName}>{app.name}</p>
                  <PaymentBadge status={app.payment_status} />
                </div>
                <p className={styles.detailModalSub}>{app.contact}</p>
                <p className={styles.detailModalSub}>
                  신청일: {new Date(app.created_at).toLocaleDateString('ko-KR')}
                  {' · '}출처: {SOURCE_DISPLAY[app.source ?? ''] ?? app.source ?? '-'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className={styles.detailModalCloseBtn}>✕</button>
          </div>

          {/* 탭 */}
          <div className={styles.detailModalTabs}>
            {(['basic', 'payment', 'memo'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`${styles.detailModalTab} ${activeTab === tab ? styles.detailModalTabActive : ''}`}
              >
                {tab === 'memo' && memoCount != null && memoCount > 0
                  ? `메모 (${memoCount})`
                  : tabLabels[tab]}
              </button>
            ))}
          </div>
        </div>

        {/* 바디 */}
        <div className={styles.detailModalBody}>
          {activeTab === 'basic' && (
            <>
              {/* 제출 사진 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>제출 사진</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  {/* 기존 사진 또는 새 미리보기 */}
                  {(photoPreview || app.photo_url) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoPreview ?? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${app.photo_url}`}
                        alt="제출 사진"
                        className={certStyles.photoThumb}
                      />
                      {!photoPreview && app.photo_url && (
                        <button type="button" onClick={handlePhotoDownload} className={certStyles.photoDownloadBtn}>
                          다운로드
                        </button>
                      )}
                      {photoPreview && (
                        <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null) }} className={certStyles.photoDownloadBtn}>
                          취소
                        </button>
                      )}
                    </div>
                  )}
                  {/* 업로드 버튼 */}
                  <label style={{ cursor: 'pointer', display: 'inline-block' }}>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFileChange(f) }}
                    />
                    <span className={`${styles.btnSecondary} ${certStyles.photoUploadBtn}`} style={{ display: 'inline-block', cursor: 'pointer' }}>
                      {app.photo_url || photoPreview ? '사진 교체' : '사진 첨부'}
                    </span>
                  </label>
                  {uploadingPhoto && <span style={{ fontSize: 12, color: 'var(--toss-text-tertiary)' }}>업로드 중...</span>}
                </div>
              </div>

              {/* 확인 처리 */}
              <div className={styles.detailChipSection}>
                <span className={styles.detailChipSectionLabel}>확인 상태</span>
                <div className={styles.detailChipRow}>
                  {[
                    { value: false, label: '미발급' },
                    { value: true, label: '발급완료' },
                  ].map(opt => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setIsChecked(opt.value)}
                      className={isChecked === opt.value ? certStyles.chipBtn : certStyles.chipBtnInactive}
                      style={
                        isChecked === opt.value
                          ? {
                              border: `2px solid ${opt.value ? '#059669' : '#f59e0b'}`,
                              background: opt.value ? '#d1fae5' : '#fef3c7',
                              color: opt.value ? '#065f46' : '#92400e',
                            }
                          : undefined
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 이름 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>이름</span>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>

              {/* 연락처 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>연락처</span>
                <input
                  value={editContact}
                  onChange={e => setEditContact(e.target.value)}
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>

              {/* 생년월일 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>생년월일</span>
                <input
                  value={editBirthPrefix}
                  onChange={e => setEditBirthPrefix(e.target.value)}
                  placeholder="예) 950101"
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>

              {/* 주소 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>주소</span>
                <input
                  value={editAddress}
                  onChange={e => setEditAddress(e.target.value)}
                  placeholder="주소 입력"
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>

              {/* 상세주소 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>상세주소</span>
                <input
                  value={editAddressDetail}
                  onChange={e => setEditAddressDetail(e.target.value)}
                  placeholder="상세주소 입력"
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>

              {/* 신청 자격증 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>신청 자격증</span>
                <input
                  value={editCerts}
                  onChange={e => setEditCerts(e.target.value)}
                  placeholder="쉼표로 구분 (예: 사회복지사2급, 보육교사2급)"
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>
              {editCerts && (
                <div className={certStyles.certPreviewRow}>
                  {editCerts.split(',').map(s => s.trim()).filter(Boolean).map((cert, idx) => (
                    <span
                      key={idx}
                      className={`${styles.statusBadge} ${certStyles.certPreviewBadge}`}
                    >
                      {cert}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'payment' && (
            <>
              {/* 결제 상태 */}
              <div className={styles.detailChipSection}>
                <span className={styles.detailChipSectionLabel}>결제 상태</span>
                <div className={styles.detailChipRow}>
                  {(['pending', 'paid', 'failed', 'cancelled'] as const).map(s => {
                    const color = PAYMENT_STATUS_COLOR[s]
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEditPaymentStatus(s)}
                        className={editPaymentStatus === s ? certStyles.chipBtn : certStyles.chipBtnInactive}
                        style={
                          editPaymentStatus === s
                            ? {
                                border: `2px solid ${color.color}`,
                                background: color.bg,
                                color: color.color,
                              }
                            : undefined
                        }
                      >
                        {PAYMENT_STATUS_LABEL[s]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 결제 금액 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>결제 금액</span>
                <input
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  placeholder="숫자만 입력"
                  type="number"
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>

              {/* 현금영수증 */}
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>현금영수증</span>
                <input
                  value={editCashReceipt}
                  onChange={e => setEditCashReceipt(e.target.value)}
                  placeholder="현금영수증 번호"
                  className={`${styles.input} ${styles.inputFull}`}
                />
              </div>

              {/* 읽기 전용 결제 정보 */}
              <div className={certStyles.detailInfoBox}>
                <DetailRow label="결제 수단" value={app.pay_method ?? '-'} />
                <DetailRow label="결제번호" value={app.mul_no ?? '-'} mono />
                <DetailRow label="주문번호" value={app.order_id ?? '-'} mono />
                <DetailRow label="거래번호" value={app.trade_id ?? '-'} mono />
                <DetailRow label="결제일" value={app.paid_at ? new Date(app.paid_at).toLocaleString('ko-KR') : '-'} />
                {app.failed_at && <DetailRow label="실패일" value={new Date(app.failed_at).toLocaleString('ko-KR')} />}
                {app.cancelled_at && <DetailRow label="취소일" value={new Date(app.cancelled_at).toLocaleString('ko-KR')} last />}
                {!app.cancelled_at && !app.failed_at && <DetailRow label="" value="" last />}
              </div>

              {/* 기타 정보 */}
              <div className={certStyles.detailInfoBoxMt12}>
                <DetailRow label="출처" value={SOURCE_DISPLAY[app.source ?? ''] ?? app.source ?? '-'} />
                <DetailRow label="신청일" value={new Date(app.created_at).toLocaleString('ko-KR')} />
                {app.updated_at && <DetailRow label="수정일" value={new Date(app.updated_at).toLocaleString('ko-KR')} last />}
                {!app.updated_at && <DetailRow label="" value="" last />}
              </div>
            </>
          )}

          {activeTab === 'memo' && (
            <MemoTimeline
              tableName="certificate_applications"
              recordId={String(app.id)}
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
  )
}

/** 상세 패널 내 행 (읽기 전용) */
function DetailRow({ label, value, mono, last }: { label: string; value: React.ReactNode; mono?: boolean; last?: boolean }) {
  return (
    <div
      className={`${styles.infoRow} ${certStyles.detailRowInner} ${last ? certStyles.detailRowNoBorder : certStyles.detailRowBorderBottom}`}
    >
      <span className={`${styles.infoRowLabel} ${certStyles.detailRowLabel}`}>{label}</span>
      <span
        className={`${styles.infoRowValue} ${mono ? certStyles.detailRowValueMono : certStyles.detailRowValue}`}
      >
        {value ?? '-'}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────
// Add Modal
// ─────────────────────────────────────────────

function AddCertModal({
  sourceTab,
  onClose,
  onCreated,
}: {
  sourceTab: SourceTab
  onClose: () => void
  onCreated: () => void
}) {
  const TOTAL_STEPS = 3
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '',
    contact: '',
    birth_prefix: '',
    address: '',
    address_detail: '',
    cash_receipt: '',
    amount: '',
  })
  const [selectedCerts, setSelectedCerts] = useState<string[]>([])
  const [certSearch, setCertSearch] = useState('')
  const [certCategory, setCertCategory] = useState('전체과정')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; contact?: string }>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const contactRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 1) setTimeout(() => nameRef.current?.focus(), 50)
  }, [step])

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = formatPhoneNumber(e.target.value)
    setForm(p => ({ ...p, contact: val }))
    if (errors.contact) setErrors(p => ({ ...p, contact: undefined }))
  }

  const validateStep1 = () => {
    const newErrors: { name?: string; contact?: string } = {}
    if (!form.name.trim()) newErrors.name = '이름을 입력해주세요'
    if (!form.contact.trim()) newErrors.contact = '연락처를 입력해주세요'
    else if (form.contact.replace(/-/g, '').length < 10) newErrors.contact = '연락처를 정확히 입력해주세요'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return
    if (step < TOTAL_STEPS) setStep(s => s + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1)
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setPhotoFile(file)
    if (file) {
      const url = URL.createObjectURL(file)
      setPhotoPreview(url)
    } else {
      setPhotoPreview(null)
    }
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const sourceMap: Record<string, string> = { hakjeom: 'bridge', edu: 'prepayment' }
      const source = sourceMap[sourceTab] ?? sourceTab

      const fd = new FormData()
      fd.append('name', form.name.trim())
      fd.append('contact', form.contact.trim())
      if (form.birth_prefix.trim()) fd.append('birth_prefix', form.birth_prefix.trim())
      if (form.address.trim()) fd.append('address', form.address.trim())
      if (form.address_detail.trim()) fd.append('address_detail', form.address_detail.trim())
      fd.append('certificates', JSON.stringify(selectedCerts))
      if (form.cash_receipt.trim()) fd.append('cash_receipt', form.cash_receipt.trim())
      if (form.amount) fd.append('amount', form.amount)
      if (source) fd.append('source', source)
      if (photoFile) fd.append('photo', photoFile)

      const res = await fetch('/api/cert', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('등록 실패')
      onCreated()
      onClose()
    } catch {
      alert('등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const modalTitle =
    sourceTab === 'hakjeom' ? '학점연계 신청 추가' : '교육원 신청 추가'

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} className={styles.modalOverlay}>
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

          {/* ── Step 1: 기본 정보 ── */}
          {step === 1 && (
            <div className={styles.funnelStep}>
              <p className={styles.funnelQuestion}>신청자 정보를 입력해주세요</p>
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
                <label className={styles.funnelLabel}>생년월일 <span className={styles.funnelOptional}>(선택)</span></label>
                <input
                  value={form.birth_prefix}
                  onChange={e => setForm(p => ({ ...p, birth_prefix: e.target.value }))}
                  placeholder="예) 950101"
                  inputMode="numeric"
                  className={styles.funnelInput}
                />
              </div>
            </div>
          )}

          {/* ── Step 2: 주소 & 자격증 ── */}
          {step === 2 && (() => {
            const catOptions = CERT_CATEGORIES.find(c => c.label === certCategory)?.options ?? [];
            const filteredOptions = certSearch.trim()
              ? CERT_CATEGORIES.flatMap(c => c.options).filter((o, i, a) => a.indexOf(o) === i).filter(o => o.includes(certSearch.trim()))
              : catOptions;
            return (
              <div className={styles.funnelStep}>
                <p className={styles.funnelQuestion}>주소와 자격증을 입력해주세요</p>
                <p className={styles.funnelSubQuestion}>모두 선택사항이에요</p>
                <div className={styles.funnelFieldGroup}>
                  <label className={styles.funnelLabel}>주소</label>
                  <input
                    value={form.address}
                    onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                    placeholder="주소 입력"
                    className={styles.funnelInput}
                  />
                </div>
                <div className={styles.funnelFieldGroup}>
                  <label className={styles.funnelLabel}>상세주소</label>
                  <input
                    value={form.address_detail}
                    onChange={e => setForm(p => ({ ...p, address_detail: e.target.value }))}
                    placeholder="상세주소 입력"
                    className={styles.funnelInput}
                  />
                </div>
                <div className={styles.funnelFieldGroup}>
                  <label className={styles.funnelLabel}>
                    신청 자격증
                    {selectedCerts.length > 0 && (
                      <span className={certStyles.selectedCertCount}>{selectedCerts.length}개 선택</span>
                    )}
                  </label>

                  {/* 선택된 자격증 태그 */}
                  {selectedCerts.length > 0 && (
                    <div className={certStyles.selectedCertTagRow}>
                      {selectedCerts.map(cert => (
                        <span key={cert} className={certStyles.selectedCertTag}>
                          {cert}
                          <button
                            type="button"
                            onClick={() => setSelectedCerts(prev => prev.filter(c => c !== cert))}
                            className={certStyles.selectedCertTagRemoveBtn}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 검색 */}
                  <input
                    value={certSearch}
                    onChange={e => setCertSearch(e.target.value)}
                    placeholder="자격증 검색..."
                    className={`${styles.funnelInput} ${certStyles.certSearchInput}`}
                  />

                  {/* 카테고리 탭 */}
                  {!certSearch.trim() && (
                    <div className={certStyles.certCategoryTabRow}>
                      {CERT_CATEGORIES.map(cat => (
                        <button
                          key={cat.label}
                          type="button"
                          onClick={() => setCertCategory(cat.label)}
                          className={`${certCategory === cat.label ? styles.tagBtnV2Active : styles.tagBtnV2} ${certStyles.certCategoryTabBtn}`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 자격증 목록 */}
                  <div className={certStyles.certListBox}>
                    {filteredOptions.length === 0 ? (
                      <div className={certStyles.certListEmpty}>
                        검색 결과가 없습니다
                      </div>
                    ) : (
                      filteredOptions.map(opt => {
                        const isSelected = selectedCerts.includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setSelectedCerts(prev =>
                              isSelected ? prev.filter(c => c !== opt) : [...prev, opt]
                            )}
                            className={isSelected ? certStyles.certListItemSelected : certStyles.certListItem}
                          >
                            <span className={isSelected ? certStyles.certListCheckboxSelected : certStyles.certListCheckbox}>
                              {isSelected && '✓'}
                            </span>
                            {opt}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Step 3: 결제 & 사진 ── */}
          {step === 3 && (
            <div className={styles.funnelStep}>
              <p className={styles.funnelQuestion}>결제 정보를 입력해주세요</p>
              <p className={styles.funnelSubQuestion}>모두 선택사항이에요</p>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>현금영수증</label>
                <input
                  value={form.cash_receipt}
                  onChange={e => setForm(p => ({ ...p, cash_receipt: e.target.value }))}
                  placeholder="현금영수증 번호"
                  className={styles.funnelInput}
                />
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>결제 금액</label>
                <input
                  value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="숫자만 입력"
                  inputMode="numeric"
                  className={styles.funnelInput}
                />
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>사진 <span className={styles.funnelOptional}>(선택)</span></label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className={certStyles.hidden}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`${styles.btnSecondary} ${certStyles.photoUploadBtn}`}
                >
                  {photoFile ? photoFile.name : '사진 선택'}
                </button>
                {photoPreview && (
                  <div className={certStyles.photoPreviewWrap}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreview}
                      alt="미리보기"
                      className={certStyles.photoPreviewImg}
                    />
                    <button
                      type="button"
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                      className={certStyles.photoPreviewRemoveBtn}
                    >
                      ✕
                    </button>
                  </div>
                )}
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
  )
}

// ─── 민간자격증 상세 패널 ────────────────────────────────────────────────────

interface PCertDetailPanelProps {
  item: PrivateCert;
  onClose: () => void;
  onUpdate: (id: number, fields: Partial<PrivateCert>) => Promise<void>;
  initialTab?: 'basic' | 'info' | 'memo';
}

function PCertDetailPanel({ item, onClose, onUpdate, initialTab = 'basic' }: PCertDetailPanelProps) {
  const [editStatus, setEditStatus] = useState<ConsultationStatus>(item.status);
  const [editMemo, setEditMemo] = useState(item.memo ?? '');
  const [editManager, setEditManager] = useState(item.manager ?? '');
  const [editMajorCategory, setEditMajorCategory] = useState(item.major_category ?? '');
  const [editHopeCourse, setEditHopeCourse] = useState(item.hope_course ?? '');
  const [editReason, setEditReason] = useState<string[]>(
    item.reason ? item.reason.split(', ').map(s => s.trim()).filter(Boolean) : []
  );
  const parseCounselCheck2 = (raw: string | null) => {
    if (!raw) return { checks: [] as string[], etc: '' };
    const items = raw.split(', ').map(s => s.trim()).filter(Boolean);
    const etcItem = items.find(s => s.startsWith('기타(') && s.endsWith(')'));
    const checks = items.map(s => s.startsWith('기타(') && s.endsWith(')') ? '기타' : s);
    const etc = etcItem ? etcItem.slice(3, -1) : '';
    return { checks, etc };
  };
  const initCounsel2 = parseCounselCheck2(item.counsel_check);
  const [editCounselCheck, setEditCounselCheck] = useState<string[]>(initCounsel2.checks);
  const [editCounselCheckEtc, setEditCounselCheckEtc] = useState(initCounsel2.etc);
  const [editClickSource, setEditClickSource] = useState(item.click_source ?? '');
  const [editResidence, setEditResidence] = useState(item.residence ?? '');
  const [editSubjectCost, setEditSubjectCost] = useState(item.subject_cost ? String(item.subject_cost) : '');
  const [editName, setEditName] = useState(item.name ?? '');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'info' | 'memo'>(initialTab);
  const [memoCount, setMemoCount] = useState<number | null>(null);

  useEffect(() => {
    setEditStatus(item.status);
    setEditMemo(item.memo ?? '');
    setEditManager(item.manager ?? '');
    setEditMajorCategory(item.major_category ?? '');
    setEditHopeCourse(item.hope_course ?? '');
    setEditReason(item.reason ? item.reason.split(', ').map(s => s.trim()).filter(Boolean) : []);
    const counsel2 = parseCounselCheck2(item.counsel_check);
    setEditCounselCheck(counsel2.checks);
    setEditCounselCheckEtc(counsel2.etc);
    setEditClickSource(item.click_source ?? '');
    setEditResidence(item.residence ?? '');
    setEditSubjectCost(item.subject_cost ? String(item.subject_cost) : '');
    setEditName(item.name ?? '');
  }, [item.id]);

  const toggleReason = (val: string) => {
    setEditReason(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };
  const toggleCounselCheck = (val: string) => {
    setEditCounselCheck(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(item.id, {
        status: editStatus,
        memo: editMemo || null,
        manager: editManager || null,
        major_category: editMajorCategory || null,
        hope_course: editHopeCourse || null,
        reason: editReason.length > 0 ? editReason.join(', ') : null,
        counsel_check: editCounselCheck.length > 0
          ? editCounselCheck.map(c => c === '기타' && editCounselCheckEtc.trim() ? `기타(${editCounselCheckEtc.trim()})` : c).join(', ')
          : null,
        click_source: editClickSource || null,
        residence: editResidence || null,
        subject_cost: editSubjectCost ? parseInt(editSubjectCost.replace(/,/g, ''), 10) || null : null,
        name: editName.trim() || item.name,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.detailModalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.detailModal}>
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
          <div className={styles.detailModalTabs}>
            {(['basic', 'info', 'memo'] as const).map(tab => {
              const labels = { basic: '기본정보', info: '취득정보', memo: '메모' };
              return (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)}
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
        <div className={styles.detailModalBody}>
          {activeTab === 'basic' && (
            <>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>유입경로</span>
                <div className={certStyles.clickSourceRow}>
                  <input value={editClickSource} onChange={e => setEditClickSource(e.target.value)} placeholder="예) 맘카페_순광맘" className={`${styles.input} ${styles.inputFull}`} />
                  {editClickSource && <p className={styles.clickSourceTextPreview}>표시: {formatClickSourceDisplay(editClickSource)}</p>}
                </div>
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>대분류</span>
                <CustomSelect value={editMajorCategory} onChange={setEditMajorCategory} fullWidth
                  options={[{ value: '', label: '선택 안 함' }, ...CERT_MAJOR_CATEGORIES.map(o => ({ value: o, label: o }))]} />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>희망과정</span>
                <input value={editHopeCourse} onChange={e => setEditHopeCourse(e.target.value)} placeholder="희망과정 입력" className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>거주지</span>
                <input value={editResidence} onChange={e => setEditResidence(e.target.value)} placeholder="예) 서울 강남구" className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>과목비용</span>
                <input value={editSubjectCost} onChange={e => setEditSubjectCost(e.target.value)} placeholder="예) 280000" type="number" className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>이름</span>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="이름" className={`${styles.input} ${styles.inputFull}`} />
              </div>
            </>
          )}
          {activeTab === 'info' && (
            <>
              <div className={styles.detailChipSection}>
                <span className={styles.detailChipSectionLabel}>취득사유</span>
                <div className={styles.detailChipRow}>
                  {REASON_OPTIONS.map(r => (
                    <button key={r} type="button" onClick={() => toggleReason(r)} className={editReason.includes(r) ? styles.tagBtnActive : styles.tagBtn}>
                      {editReason.includes(r) ? `✓ ${r}` : r}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.detailChipSection}>
                <span className={styles.detailChipSectionLabel}>고민</span>
                <div className={styles.detailChipRow}>
                  {COUNSEL_CHECK_OPTIONS.map(c => (
                    <button key={c} type="button" onClick={() => toggleCounselCheck(c)} className={editCounselCheck.includes(c) ? styles.tagBtnActive : styles.tagBtn}>
                      {editCounselCheck.includes(c) ? `✓ ${c}` : c}
                    </button>
                  ))}
                </div>
                {editCounselCheck.includes('기타') && (
                  <input value={editCounselCheckEtc} onChange={e => setEditCounselCheckEtc(e.target.value)} placeholder="기타 내용 입력" className={`${styles.input} ${styles.inputFull} ${certStyles.mt8}`} autoFocus />
                )}
              </div>
              <div className={styles.detailChipSection}>
                <span className={styles.detailChipSectionLabel}>상태</span>
                <div className={styles.detailChipRow}>
                  {CONSULTATION_STATUS_OPTIONS.map(s => (
                    <button key={s} type="button" onClick={() => setEditStatus(s)}
                      className={editStatus === s ? certStyles.chipBtn : certStyles.chipBtnInactive}
                      style={editStatus === s
                        ? { border: `2px solid ${CONSULTATION_STATUS_STYLE[s].color}`, background: CONSULTATION_STATUS_STYLE[s].background, color: CONSULTATION_STATUS_STYLE[s].color }
                        : undefined
                      }
                    >{s}</button>
                  ))}
                </div>
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>담당자</span>
                <input type="text" value={editManager} onChange={e => setEditManager(e.target.value)} placeholder="담당자 이름" className={`${styles.input} ${styles.inputFull}`} />
              </div>
            </>
          )}
          {activeTab === 'memo' && (
            <MemoTimeline
              tableName="private_cert_consultations"
              recordId={String(item.id)}
              legacyMemo={item.memo}
              onCountChange={setMemoCount}
            />
          )}
        </div>
        <div className={styles.detailModalFooter}>
          <button onClick={handleSave} disabled={saving} className={`${styles.panelSaveBtn} ${saving ? styles.panelSaveBtnDisabled : ''}`}>
            {saving ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 민간자격증 추가 모달 ────────────────────────────────────────────────────

function PCertAddModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const TOTAL_STEPS = 3;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', contact: '', residence: '',
    major_category: '', reason: '', click_source: '',
    subject_cost: '', manager: '', memo: '',
  });
  const [errors, setErrors] = useState<{ name?: string; contact?: string }>({});
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

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
      const res = await fetch('/api/hakjeom/private-cert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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

          {/* ── Step 1: 기본 정보 ── */}
          {step === 1 && (
            <div className={styles.funnelStep}>
              <p className={styles.funnelQuestion}>기본 정보를 입력해주세요</p>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>이름</label>
                <input
                  ref={nameRef}
                  value={form.name}
                  onChange={e => { setForm(p => ({ ...p, name: e.target.value })); if (errors.name) setErrors(p => ({ ...p, name: undefined })); }}
                  placeholder="홍길동"
                  className={`${styles.funnelInput}${errors.name ? ` ${styles.funnelInputError}` : ''}`}
                />
                {errors.name && <p className={styles.funnelError}>{errors.name}</p>}
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>연락처</label>
                <input
                  value={form.contact}
                  onChange={e => { setForm(p => ({ ...p, contact: formatPhoneNumber(e.target.value) })); if (errors.contact) setErrors(p => ({ ...p, contact: undefined })); }}
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
            </div>
          )}

          {/* ── Step 2: 과정 정보 ── */}
          {step === 2 && (
            <div className={styles.funnelStep}>
              <p className={styles.funnelQuestion}>과정 정보를 선택해주세요</p>
              <p className={styles.funnelSubQuestion}>모두 선택사항이에요</p>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>대분류</label>
                <select
                  value={form.major_category}
                  onChange={e => setForm(p => ({ ...p, major_category: e.target.value }))}
                  className={styles.funnelSelect}
                >
                  <option value="">선택 안 함</option>
                  {CERT_MAJOR_CATEGORIES.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>취득사유</label>
                <div className={styles.funnelTagRow}>
                  {REASON_OPTIONS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, reason: p.reason === r ? '' : r }))}
                      className={form.reason === r ? styles.tagBtnV2Active : styles.tagBtnV2}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>유입경로 <span className={styles.funnelOptional}>(선택)</span></label>
                <input
                  value={form.click_source}
                  onChange={e => setForm(p => ({ ...p, click_source: e.target.value }))}
                  placeholder="예) 맘카페_예시카페"
                  className={styles.funnelInput}
                />
              </div>
            </div>
          )}

          {/* ── Step 3: 추가 정보 ── */}
          {step === 3 && (
            <div className={styles.funnelStep}>
              <p className={styles.funnelQuestion}>추가 정보를 입력해주세요</p>
              <p className={styles.funnelSubQuestion}>모두 선택사항이에요</p>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>과목비용</label>
                <input
                  value={form.subject_cost}
                  onChange={e => setForm(p => ({ ...p, subject_cost: e.target.value }))}
                  placeholder="예) 150,000"
                  className={styles.funnelInput}
                />
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>담당자</label>
                <input
                  value={form.manager}
                  onChange={e => setForm(p => ({ ...p, manager: e.target.value }))}
                  placeholder="담당자 이름"
                  className={styles.funnelInput}
                />
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>메모 <span className={styles.funnelOptional}>(선택)</span></label>
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

// ─── 민간자격증 Highlight (하이픈 매칭 포함) ──────────────────────────────────

function PCertHighlight({ text, query }: { text: string | null; query: string }) {
  if (!query || !text) return <>{text ?? '-'}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  const hasDirectMatch = parts.length > 1;
  if (hasDirectMatch) {
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase()
            ? <mark key={i} className={certStyles.pcertHighlightMark}>{part}</mark>
            : part
        )}
      </>
    );
  }
  const textClean = text.replace(/-/g, '');
  const queryClean = query.replace(/-/g, '');
  if (queryClean && textClean.toLowerCase().includes(queryClean.toLowerCase())) {
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
        <mark className={certStyles.pcertHighlightMark}>{text.slice(origStart, origEnd)}</mark>
        {text.slice(origEnd)}
      </>
    );
  }
  return <>{text}</>;
}

// ─── 탭: 민간자격증 ──────────────────────────────────────────────────────────

function PrivateCertTab({ setStatsNode, highlightId }: { setStatsNode: (node: React.ReactNode) => void; highlightId?: number }) {
  const [items, setItems] = useState<PrivateCert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConsultationStatus | 'all'>('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [majorCategoryFilter, setMajorCategoryFilter] = useState('all');
  const [minorCategoryFilter, setMinorCategoryFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [counselCheckFilter, setCounselCheckFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [selectedItem, setSelectedItem] = useState<PrivateCert | null>(null);
  const [openTab, setOpenTab] = useState<'basic' | 'info' | 'memo'>('basic');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [deleteToastVisible, setDeleteToastVisible] = useState(false);
  const [filterDropdownPos, setFilterDropdownPos] = useState({ top: 0, left: 0 });
  const itemsPerPage = 10;

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
      const res = await fetch('/api/hakjeom/private-cert');
      if (!res.ok) throw new Error('데이터를 불러오지 못했습니다.');
      const data: PrivateCert[] = await res.json();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
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

  // 담당자별 실적 (헤더 칩)
  useEffect(() => {
    const mgrs = Array.from(new Set(items.map(c => c.manager).filter(Boolean))) as string[];
    if (mgrs.length === 0) { setStatsNode(null); return; }
    const rate = (list: PrivateCert[]) => {
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
  }, [items, setStatsNode]);

  const handleUpdate = async (id: number, fields: Partial<PrivateCert>) => {
    const res = await fetch('/api/hakjeom/private-cert', {
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
    await fetch('/api/hakjeom/private-cert', {
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

  const uniqueManagers = Array.from(new Set(items.map(c => c.manager).filter(Boolean))) as string[];
  const uniqueMajorCategories = Array.from(new Set(items.map(c => parseClickSource(c.click_source).major).filter(Boolean))).sort();
  const needsCheckCount = items.filter(c => parseClickSource(c.click_source).needsCheck).length;
  const uniqueMinorCategories = Array.from(new Set(
    items
      .filter(c => majorCategoryFilter === 'all' || parseClickSource(c.click_source).major === majorCategoryFilter)
      .map(c => parseClickSource(c.click_source))
      .filter(p => Boolean(p.minor) && !p.needsCheck)
      .map(p => p.minor)
  )).sort();

  const filtered = items.filter(c => {
    if (searchText) {
      const q = searchText.toLowerCase();
      const contactClean = c.contact.replace(/-/g, '');
      const searchClean = searchText.replace(/-/g, '');
      if (!(c.name.toLowerCase().includes(q) || contactClean.includes(searchClean) || (c.reason || '').toLowerCase().includes(q) || (c.memo || '').toLowerCase().includes(q))) return false;
    }
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (managerFilter !== 'all') {
      if (managerFilter === 'none' && c.manager) return false;
      if (managerFilter !== 'none' && c.manager !== managerFilter) return false;
    }
    if (majorCategoryFilter !== 'all' && parseClickSource(c.click_source).major !== majorCategoryFilter) return false;
    if (minorCategoryFilter !== 'all') {
      const parsed = parseClickSource(c.click_source);
      if (minorCategoryFilter === '__needs_check__') { if (!parsed.needsCheck) return false; }
      else if (parsed.minor !== minorCategoryFilter) return false;
    }
    if (reasonFilter !== 'all') {
      const reasons = (c.reason || '').split(', ').map(r => r.trim());
      if (!reasons.includes(reasonFilter)) return false;
    }
    if (counselCheckFilter !== 'all') {
      const checks = (c.counsel_check || '').split(', ').map(ch => ch.trim());
      if (counselCheckFilter === '기타') {
        if (!checks.some(ch => ch.startsWith('기타'))) return false;
      } else {
        if (!checks.includes(counselCheckFilter)) return false;
      }
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

  const isFiltered = searchText || statusFilter !== 'all' || managerFilter !== 'all' || majorCategoryFilter !== 'all' || minorCategoryFilter !== 'all' || reasonFilter !== 'all' || counselCheckFilter !== 'all' || startDate || endDate;

  const PCERT_HEADERS = ['번호', '대분류', '중분류', '이름', '연락처', '과정분류', '희망과정', '상담메모', '담당자', '상담확인', '상태', '등록일'];
  const pcertToRow = (item: PrivateCert, i: number) => [
    i + 1,
    parseClickSource(item.click_source).major || '',
    parseClickSource(item.click_source).minor || '',
    item.name,
    item.contact,
    item.major_category ?? '',
    item.hope_course ?? '',
    item.reason ?? '',
    item.manager ?? '',
    item.counsel_check ?? '',
    item.status,
    item.created_at ? new Date(item.created_at).toLocaleString('ko-KR') : '',
  ];

  const handlePCertDownloadSelected = () => {
    const targets = filtered.filter(c => selectedIds.includes(c.id));
    downloadExcel(`민간자격증_선택_${new Date().toLocaleDateString('ko-KR').replace(/\. /g,'-').replace('.','')}.xlsx`, [{
      name: '민간자격증',
      headers: PCERT_HEADERS,
      rows: targets.map((item, i) => pcertToRow(item, i)),
    }]);
  };

  const handlePCertDownloadAll = () => {
    downloadExcel(`민간자격증_전체_${new Date().toLocaleDateString('ko-KR').replace(/\. /g,'-').replace('.','')}.xlsx`, [{
      name: '민간자격증',
      headers: PCERT_HEADERS,
      rows: filtered.map((item, i) => pcertToRow(item, i)),
    }]);
  };

  const resetFilters = () => {
    setSearchText(''); setStatusFilter('all'); setManagerFilter('all');
    setMajorCategoryFilter('all'); setMinorCategoryFilter('all');
    setReasonFilter('all'); setCounselCheckFilter('all');
    setStartDate(''); setEndDate(''); setCurrentPage(1);
  };

  return (
    <div>
      {loading ? <FilterBarSkeleton /> : (
        <>
          <div className={styles.filterRow}>
            <input type="text" value={searchText} onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }} placeholder="이름, 연락처, 취득사유 검색..." className={`${styles.input} ${certStyles.pcertSearchInput}`} />
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setCurrentPage(1); }} className={`${styles.input} ${certStyles.dateInput140}`} />
            <span className={styles.dateSeparator}>~</span>
            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setCurrentPage(1); }} className={`${styles.input} ${certStyles.dateInput140}`} />
            {isFiltered && <button onClick={resetFilters} className={styles.btnSecondary}>필터 초기화</button>}
            {selectedIds.length > 0 && (
              <>
                <span className={styles.bulkActionCount}>{selectedIds.length}건 선택됨</span>
                <button onClick={handleBulkDelete} disabled={deleting} className={styles.btnDanger}>
                  {deleting ? '삭제 중...' : '선택 삭제'}
                </button>
                <button onClick={handlePCertDownloadSelected} className={styles.btnDownload}>↓ 선택 다운로드</button>
                <button onClick={() => setSelectedIds([])} className={styles.btnSecondary}>선택 해제</button>
              </>
            )}
          </div>
          <div className={styles.actionBar}>
            <span className={styles.actionBarCount}>총 <strong className={styles.actionBarCountBold}>{filtered.length}</strong>건</span>
            <div className={styles.actionBarSpacer} />
            <button onClick={handlePCertDownloadAll} className={styles.btnDownload}>↓ 전체 다운로드</button>
            <button onClick={() => setShowAddModal(true)} className={styles.btnPrimary}>+ 추가</button>
          </div>
        </>
      )}

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
                      <button className={`${styles.thFilterBtn}${majorCategoryFilter !== 'all' ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'major') { setOpenFilterColumn(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left }); setOpenFilterColumn('major'); }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    </div>
                  </th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      중분류
                      <button className={`${styles.thFilterBtn}${minorCategoryFilter !== 'all' ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'minor') { setOpenFilterColumn(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left }); setOpenFilterColumn('minor'); }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    </div>
                  </th>
                  <th className={styles.th}>이름</th>
                  <th className={styles.th}>연락처</th>
                  <th className={styles.th}>과정분류</th>
                  <th className={styles.th}>희망과정</th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      취득사유
                      <button className={`${styles.thFilterBtn}${reasonFilter !== 'all' ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'reason') { setOpenFilterColumn(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left }); setOpenFilterColumn('reason'); }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    </div>
                  </th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      담당자
                      <button className={`${styles.thFilterBtn}${managerFilter !== 'all' ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'manager') { setOpenFilterColumn(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left }); setOpenFilterColumn('manager'); }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    </div>
                  </th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      고민
                      <button className={`${styles.thFilterBtn}${counselCheckFilter !== 'all' ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'counsel') { setOpenFilterColumn(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left }); setOpenFilterColumn('counsel'); }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    </div>
                  </th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      상태
                      <button className={`${styles.thFilterBtn}${statusFilter !== 'all' ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'status') { setOpenFilterColumn(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left }); setOpenFilterColumn('status'); }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    </div>
                  </th>
                  <th className={styles.th}>메모</th>
                  <th className={styles.th}>등록일</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton cols={13} rows={8} />
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={13} className={styles.tableEmptyMsg}>검색 결과가 없습니다.</td></tr>
                ) : paginated.map((item, index) => (
                  <tr
                    key={item.id}
                    data-id={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={certStyles.pcertTr}
                    style={{
                      background: selectedItem?.id === item.id ? '#EBF3FE' : selectedIds.includes(item.id) ? '#f0f7ff' : 'transparent',
                    }}
                    onMouseEnter={e => { if (selectedItem?.id !== item.id && !selectedIds.includes(item.id)) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--toss-bg)'; }}
                    onMouseLeave={e => { if (selectedItem?.id !== item.id && !selectedIds.includes(item.id)) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                  >
                    <td className={styles.tdCenter} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)} className={styles.checkbox} />
                    </td>
                    <td className={styles.tdNum}>{(currentPage - 1) * itemsPerPage + index + 1}</td>
                    <td className={styles.tdSecondary}>{parseClickSource(item.click_source).major || '-'}</td>
                    <td className={`${styles.tdSecondary}${parseClickSource(item.click_source).needsCheck ? ` ${certStyles.tdNeedsCheck}` : ''}`}>{parseClickSource(item.click_source).minor || '-'}</td>
                    <td className={styles.tdBold}><PCertHighlight text={item.name} query={searchText} /></td>
                    <td className={styles.tdTabular}><PCertHighlight text={item.contact} query={searchText} /></td>
                    <td className={styles.tdSecondary}>{item.major_category ?? '-'}</td>
                    <td className={styles.tdEllipsis}>{item.hope_course ?? '-'}</td>
                    <td className={styles.tdEllipsis} title={item.reason ?? ''}><PCertHighlight text={item.reason} query={searchText} /></td>
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
                    <td className={styles.tdMemo} onClick={e => { e.stopPropagation(); setOpenTab('memo'); setSelectedItem(item); }} style={{ cursor: 'pointer' }}>
                      <MemoHoverBadge text={item.latest_memo || item.memo || '-'} />
                    </td>
                    <td className={styles.tdDateSmall}>{formatDate(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={`${styles.pageBtn} ${certStyles.pageBtnMr4}`}>‹</button>
          {getPaginationPages(currentPage, totalPages).map((page, idx) =>
            page === '...'
              ? <span key={`ellipsis-${idx}`} className={styles.pageEllipsis}>…</span>
              : <button key={page} onClick={() => setCurrentPage(page as number)} className={page === currentPage ? styles.pageBtnActive : styles.pageBtn}>{page}</button>
          )}
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={`${styles.pageBtn} ${certStyles.pageBtnMl4}`}>›</button>
        </div>
      )}

      {selectedItem && <PCertDetailPanel item={selectedItem} onClose={() => { setSelectedItem(null); setOpenTab('basic'); }} onUpdate={handleUpdate} initialTab={openTab} />}
      {showAddModal && <PCertAddModal onClose={() => setShowAddModal(false)} onSaved={fetchData} />}
      {toastVisible && <div className={styles.toast}>저장이 완료되었습니다</div>}
      {deleteToastVisible && <div className={styles.toast}>삭제되었습니다</div>}

      {openFilterColumn && (
        <div ref={dropdownRef} className={styles.filterColumnDropdown} style={{ top: filterDropdownPos.top, left: filterDropdownPos.left }}>
          {openFilterColumn === 'major' && (
            <>
              <div className={`${styles.filterDropdownItem}${majorCategoryFilter === 'all' ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setMajorCategoryFilter('all'); setMinorCategoryFilter('all'); setCurrentPage(1); setOpenFilterColumn(null); }}>전체</div>
              {uniqueMajorCategories.map(m => (
                <div key={m} className={`${styles.filterDropdownItem}${majorCategoryFilter === m ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setMajorCategoryFilter(m); setMinorCategoryFilter('all'); setCurrentPage(1); setOpenFilterColumn(null); }}>{m}</div>
              ))}
            </>
          )}
          {openFilterColumn === 'minor' && (
            <>
              <div className={`${styles.filterDropdownItem}${minorCategoryFilter === 'all' ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setMinorCategoryFilter('all'); setCurrentPage(1); setOpenFilterColumn(null); }}>전체</div>
              {needsCheckCount > 0 && (
                <div className={`${styles.filterDropdownItem}${minorCategoryFilter === '__needs_check__' ? ` ${styles.filterDropdownItemActive}` : ''} ${certStyles.filterNeedsCheck}`} onClick={() => { setMinorCategoryFilter('__needs_check__'); setCurrentPage(1); setOpenFilterColumn(null); }}>확인필요 ({needsCheckCount})</div>
              )}
              {uniqueMinorCategories.map(m => (
                <div key={m} className={`${styles.filterDropdownItem}${minorCategoryFilter === m ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setMinorCategoryFilter(m); setCurrentPage(1); setOpenFilterColumn(null); }}>{m}</div>
              ))}
            </>
          )}
          {openFilterColumn === 'reason' && (
            <>
              <div className={`${styles.filterDropdownItem}${reasonFilter === 'all' ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setReasonFilter('all'); setCurrentPage(1); setOpenFilterColumn(null); }}>전체</div>
              {REASON_OPTIONS.map(r => (
                <div key={r} className={`${styles.filterDropdownItem}${reasonFilter === r ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setReasonFilter(r); setCurrentPage(1); setOpenFilterColumn(null); }}>{r}</div>
              ))}
            </>
          )}
          {openFilterColumn === 'counsel' && (
            <>
              <div className={`${styles.filterDropdownItem}${counselCheckFilter === 'all' ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setCounselCheckFilter('all'); setCurrentPage(1); setOpenFilterColumn(null); }}>전체</div>
              {COUNSEL_CHECK_OPTIONS.map(c => (
                <div key={c} className={`${styles.filterDropdownItem}${counselCheckFilter === c ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setCounselCheckFilter(c); setCurrentPage(1); setOpenFilterColumn(null); }}>{c}</div>
              ))}
            </>
          )}
          {openFilterColumn === 'manager' && (
            <>
              <div className={`${styles.filterDropdownItem}${managerFilter === 'all' ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setManagerFilter('all'); setCurrentPage(1); setOpenFilterColumn(null); }}>전체</div>
              <div className={`${styles.filterDropdownItem}${managerFilter === 'none' ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setManagerFilter('none'); setCurrentPage(1); setOpenFilterColumn(null); }}>미배정</div>
              {uniqueManagers.map(m => (
                <div key={m} className={`${styles.filterDropdownItem}${managerFilter === m ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setManagerFilter(m); setCurrentPage(1); setOpenFilterColumn(null); }}>{m}</div>
              ))}
            </>
          )}
          {openFilterColumn === 'status' && (
            <>
              <div className={`${styles.filterDropdownItem}${statusFilter === 'all' ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setStatusFilter('all'); setCurrentPage(1); setOpenFilterColumn(null); }}>전체</div>
              {CONSULTATION_STATUS_OPTIONS.map(s => (
                <div key={s} className={`${styles.filterDropdownItem}${statusFilter === s ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setStatusFilter(s as ConsultationStatus); setCurrentPage(1); setOpenFilterColumn(null); }}>{s}</div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Application Tab (기존 신청관리)
// ─────────────────────────────────────────────

function ApplicationTab({ sourceTab, highlightId }: { sourceTab: 'hakjeom' | 'edu'; highlightId?: number }) {
  const [applications, setApplications] = useState<CertApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [filterDropdownPos, setFilterDropdownPos] = useState({ top: 0, left: 0 })
  const [selectedApp, setSelectedApp] = useState<CertApplication | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [toastVisible2, setToastVisible2] = useState(false)
  const [deleteToastVisible2, setDeleteToastVisible2] = useState(false)

  // 체크박스 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // 검색에서 직접 이동 시 해당 행 하이라이트
  useEffect(() => {
    if (!highlightId || applications.length === 0) return
    const idx = applications.findIndex(a => a.id === String(highlightId))
    if (idx < 0) return
    setCurrentPage(Math.ceil((idx + 1) / PAGE_SIZE))
    setTimeout(() => {
      const el = document.querySelector(`tr[data-id="${highlightId}"]`) as HTMLElement | null
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.add(styles.highlightRow)
      setTimeout(() => el.classList.remove(styles.highlightRow), 2500)
    }, 150)
  }, [applications, highlightId])

  // ── 데이터 fetch ──────────────────────────────
  const fetchApplications = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('payment_status', statusFilter)
      params.set('source_tab', sourceTab)

      const res = await fetch(`/api/cert?${params.toString()}`)
      if (!res.ok) throw new Error('데이터를 불러오지 못했습니다.')
      const data: CertApplication[] = await res.json()
      setApplications(data)
      setSelectedIds(new Set())
      setCurrentPage(1)
    } catch (err) {
      console.error('[CertPage] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, sourceTab])

  useEffect(() => {
    fetchApplications()
  }, [fetchApplications])

  useEffect(() => {
    if (!openFilterColumn) return
    const handleMouseDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenFilterColumn(null)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [openFilterColumn])

  // ── 클라이언트 사이드 검색 필터링 ────────────
  const sourceOptions = [
    { value: 'all', label: '전체' },
    ...Array.from(new Set(applications.map(a => a.source).filter(Boolean)))
      .sort()
      .map(s => ({ value: `src:${s}`, label: SOURCE_DISPLAY[s as string] ?? (s as string) })),
    ...Array.from(new Set(applications.map(a => a.ref).filter(Boolean)))
      .sort()
      .map(s => ({ value: `ref:${s}`, label: s as string })),
  ]

  const filtered = applications.filter((app) => {
    if (sourceFilter !== 'all') {
      if (sourceFilter.startsWith('src:')) {
        if (app.source !== sourceFilter.slice(4)) return false
      } else if (sourceFilter.startsWith('ref:')) {
        if (app.ref !== sourceFilter.slice(4)) return false
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const contactClean = app.contact.replace(/-/g, '')
      if (
        !app.name.toLowerCase().includes(q) &&
        !app.contact.toLowerCase().includes(q) &&
        !contactClean.includes(q.replace(/-/g, ''))
      ) return false
    }
    return true
  })

  // ── 페이지네이션 ──────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const paginationPages = getPaginationPages(safePage, totalPages)

  // 검색어 바뀌면 첫 페이지로
  const handleSearchChange = (q: string) => {
    setSearchQuery(q)
    setCurrentPage(1)
    setSelectedIds(new Set())
  }

  // ── 상세 패널에서 필드 업데이트 ─────────────────
  const handleUpdate = async (id: string, fields: Partial<CertApplication>) => {
    try {
      const res = await fetch('/api/cert', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...fields }),
      })
      if (!res.ok) throw new Error('업데이트 실패')
      // 성공 시 목록 갱신
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, ...fields } : a)))
      if (selectedApp?.id === id) {
        setSelectedApp((prev) => (prev ? { ...prev, ...fields } : prev))
      }
      setToastVisible2(true)
      setTimeout(() => setToastVisible2(false), 2500)
    } catch (err) {
      console.error('[CertPage] update error:', err)
      alert('저장에 실패했습니다.')
    }
  }

  // ── 체크박스 ──────────────────────────────────
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginated.map((a) => a.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const isAllSelected = paginated.length > 0 && paginated.every((a) => selectedIds.has(a.id))
  const isIndeterminate = paginated.some((a) => selectedIds.has(a.id)) && !isAllSelected

  // ── 일괄 삭제 ─────────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    const confirmed = window.confirm(`선택한 ${selectedIds.size}건을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)
    if (!confirmed) return

    setBulkDeleting(true)
    try {
      const res = await fetch('/api/cert', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      if (!res.ok) throw new Error('삭제 실패')
      await fetchApplications()
      setDeleteToastVisible2(true)
      setTimeout(() => setDeleteToastVisible2(false), 2500)
    } catch (err) {
      console.error('[CertPage] bulk delete error:', err)
      alert('삭제에 실패했습니다.')
    } finally {
      setBulkDeleting(false)
    }
  }

  const tabLabel = sourceTab === 'hakjeom' ? '학점연계신청' : '교육원'
  const APP_HEADERS = sourceTab === 'edu'
    ? ['번호', '이름', '연락처', '결제금액', '결제상태', '출처', '신청일']
    : ['번호', '이름', '연락처', '신청자격증', '결제금액', '결제상태', '출처', '신청일']

  const appToRow = (app: CertApplication, i: number) => {
    const base = [
      i + 1,
      app.name,
      app.contact,
      ...(sourceTab !== 'edu' ? [app.certificates?.join(', ') ?? ''] : []),
      app.amount ?? '',
      app.payment_status ? (PAYMENT_STATUS_LABEL[app.payment_status] ?? app.payment_status) : '',
      app.source ?? '',
      app.created_at ? new Date(app.created_at).toLocaleString('ko-KR') : '',
    ]
    return base
  }

  const handleAppDownloadSelected = () => {
    const targets = filtered.filter(a => selectedIds.has(a.id))
    downloadExcel(`${tabLabel}_선택_${new Date().toLocaleDateString('ko-KR').replace(/\. /g,'-').replace('.','')}.xlsx`, [{
      name: tabLabel,
      headers: APP_HEADERS,
      rows: targets.map((a, i) => appToRow(a, i)),
    }])
  }

  const handleAppDownloadAll = () => {
    downloadExcel(`${tabLabel}_전체_${new Date().toLocaleDateString('ko-KR').replace(/\. /g,'-').replace('.','')}.xlsx`, [{
      name: tabLabel,
      headers: APP_HEADERS,
      rows: filtered.map((a, i) => appToRow(a, i)),
    }])
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className={certStyles.appTabWrap}>

      {loading ? <FilterBarSkeleton /> : (
        <>
          {/* 검색 / 필터 행 */}
          <div className={styles.filterRow}>
            <input
              type="text"
              placeholder="이름, 연락처 검색..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className={`${styles.input} ${certStyles.searchInput300}`}
            />
            {(searchQuery || statusFilter !== 'all' || sourceFilter !== 'all') && (
              <button onClick={() => { handleSearchChange(''); setStatusFilter('all'); setSourceFilter('all') }} className={styles.btnSecondary}>필터 초기화</button>
            )}
            {selectedIds.size > 0 && (
              <>
                <span className={styles.bulkActionCount}>{selectedIds.size}건 선택됨</span>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className={styles.btnDanger}
                >
                  {bulkDeleting ? '삭제 중...' : '선택 삭제'}
                </button>
                <button onClick={handleAppDownloadSelected} className={styles.btnDownload}>↓ 선택 다운로드</button>
                <button onClick={() => setSelectedIds(new Set())} className={styles.btnSecondary}>선택 해제</button>
              </>
            )}
          </div>

          {/* 액션 바 */}
          <div className={styles.actionBar}>
            <span className={styles.actionBarCount}>
              총 <strong className={styles.actionBarCountBold}>{filtered.length}</strong>건
            </span>
            <div className={styles.actionBarSpacer} />
            <button onClick={handleAppDownloadAll} className={styles.btnDownload}>↓ 전체 다운로드</button>
            <button onClick={() => setShowAddModal(true)} className={styles.btnPrimary}>+ 신청 추가</button>
          </div>
        </>
      )}

      {/* 테이블 카드 */}
      <div className={styles.tableCard}>
        <div className={styles.tableOverflow}>
          <table className={`${styles.table} ${certStyles.tableMinW900}`}>
              <thead>
                <tr>
                  {/* 전체 선택 체크박스 */}
                  <th className={`${styles.thCenter} ${certStyles.thCheckboxW44}`}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={isAllSelected}
                      ref={(el) => { if (el) el.indeterminate = isIndeterminate }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th className={styles.thNum}>번호</th>
                  <th className={styles.th}>이름</th>
                  <th className={styles.th}>연락처</th>
                  {sourceTab !== 'edu' && <th className={styles.th}>신청 자격증</th>}
                  <th className={styles.th}>결제 금액</th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      결제 상태
                      <button
                        className={`${styles.thFilterBtn}${statusFilter !== 'all' ? ` ${styles.thFilterBtnActive}` : ''}`}
                        onClick={e => {
                          e.stopPropagation()
                          if (openFilterColumn === 'payment_status') { setOpenFilterColumn(null); return; }
                          const rect = e.currentTarget.getBoundingClientRect()
                          setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left })
                          setOpenFilterColumn('payment_status')
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      출처
                      <button
                        className={`${styles.thFilterBtn}${sourceFilter !== 'all' ? ` ${styles.thFilterBtnActive}` : ''}`}
                        onClick={e => {
                          e.stopPropagation()
                          if (openFilterColumn === 'source') { setOpenFilterColumn(null); return; }
                          const rect = e.currentTarget.getBoundingClientRect()
                          setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left })
                          setOpenFilterColumn('source')
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </th>
                  <th className={styles.th}>신청일</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton cols={9} rows={8} />
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className={styles.tableEmptyMsg}>신청 내역이 없습니다.</td></tr>
                ) : paginated.map((app, index) => {
                  const isSelected = selectedIds.has(app.id)
                  return (
                    <tr
                      key={app.id}
                      data-id={app.id}
                      className={`${isSelected ? styles.trSelected : styles.tr}${app.is_checked && !isSelected ? ` ${certStyles.trChecked}` : ''}`}
                    >
                      {/* 체크박스 */}
                      <td
                        className={styles.tdCenter}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={isSelected}
                          onChange={(e) => handleSelectOne(app.id, e.target.checked)}
                        />
                      </td>
                      <td className={styles.tdNum}>{(safePage - 1) * PAGE_SIZE + index + 1}</td>

                      {/* 이름 */}
                      <td
                        className={`${styles.tdBold} ${certStyles.tdClickable}`}
                        onClick={() => setSelectedApp(app)}
                      >
                        <Highlight text={app.name} query={searchQuery} />
                        {app.is_checked && (
                          <span className={`${styles.statusBadge} ${certStyles.issuedBadge}`}>
                            발급완료
                          </span>
                        )}
                      </td>

                      {/* 연락처 */}
                      <td
                        className={`${styles.tdTabular} ${certStyles.tdClickable}`}
                        onClick={() => setSelectedApp(app)}
                      >
                        <Highlight text={app.contact} query={searchQuery} />
                      </td>

                      {/* 신청 자격증 */}
                      {sourceTab !== 'edu' && (
                        <td
                          className={`${styles.td} ${certStyles.tdClickable}`}
                          onClick={() => setSelectedApp(app)}
                        >
                          <div className={certStyles.certTagList}>
                            {app.certificates?.map((cert, idx) => (
                              <span
                                key={idx}
                                className={`${styles.statusBadge} ${certStyles.certTagBadge}`}
                              >
                                {cert}
                              </span>
                            ))}
                          </div>
                        </td>
                      )}

                      {/* 결제 금액 */}
                      <td
                        className={`${styles.tdTabular} ${certStyles.tdClickable}`}
                        onClick={() => setSelectedApp(app)}
                      >
                        {app.amount ? `${app.amount.toLocaleString()}원` : '-'}
                      </td>

                      {/* 결제 상태 */}
                      <td
                        className={`${styles.td} ${certStyles.tdClickable}`}
                        onClick={() => setSelectedApp(app)}
                      >
                        <PaymentBadge status={app.payment_status} />
                      </td>

                      {/* 출처 */}
                      <td
                        className={`${styles.tdSecondary} ${certStyles.tdSource}`}
                        onClick={() => setSelectedApp(app)}
                      >
                        {SOURCE_DISPLAY[app.source ?? ''] ?? app.source ?? '-'}
                        {app.ref && (
                          <span className={`${styles.statusBadge} ${certStyles.refBadge}`}>
                            {app.ref}
                          </span>
                        )}
                      </td>

                      {/* 신청일 */}
                      <td
                        className={`${styles.tdDateSmall} ${certStyles.tdDate}`}
                        onClick={() => setSelectedApp(app)}
                      >
                        {new Date(app.created_at).toLocaleDateString('ko-KR')}
                        <br />
                        <span className={certStyles.tdDateTime}>
                          {new Date(app.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

      </div>

      {/* 페이지네이션 */}
      {!loading && totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={`${styles.pageBtn} ${safePage <= 1 ? certStyles.pageBtnDisabled : certStyles.pageBtnActive}`}
            disabled={safePage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            ‹
          </button>
          {paginationPages.map((page, idx) =>
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className={styles.pageEllipsis}>…</span>
            ) : (
              <button
                key={page}
                onClick={() => setCurrentPage(page as number)}
                className={safePage === page ? styles.pageBtnActive : styles.pageBtn}
              >
                {page}
              </button>
            ),
          )}
          <button
            className={`${styles.pageBtn} ${safePage >= totalPages ? certStyles.pageBtnDisabled : certStyles.pageBtnActive}`}
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            ›
          </button>
        </div>
      )}

      {/* 신청 추가 모달 */}
      {showAddModal && (
        <AddCertModal
          sourceTab={sourceTab}
          onClose={() => setShowAddModal(false)}
          onCreated={fetchApplications}
        />
      )}

      {/* 상세 패널 */}
      {selectedApp && (
        <DetailPanel
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdate={handleUpdate}
        />
      )}
      {toastVisible2 && <div className={styles.toast}>저장이 완료되었습니다</div>}
      {deleteToastVisible2 && <div className={styles.toast}>삭제되었습니다</div>}

      {/* 결제 상태 헤더 필터 드롭다운 */}
      {openFilterColumn === 'payment_status' && (
        <div
          ref={dropdownRef}
          className={styles.filterColumnDropdown}
          style={{ top: filterDropdownPos.top, left: filterDropdownPos.left }}
        >
          {STATUS_FILTER_OPTIONS.map(o => (
            <div
              key={o.value}
              className={`${styles.filterDropdownItem}${statusFilter === o.value ? ` ${styles.filterDropdownItemActive}` : ''}`}
              onClick={() => { setStatusFilter(o.value); setCurrentPage(1); setOpenFilterColumn(null) }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}

      {/* 출처 헤더 필터 드롭다운 */}
      {openFilterColumn === 'source' && (
        <div
          ref={dropdownRef}
          className={styles.filterColumnDropdown}
          style={{ top: filterDropdownPos.top, left: filterDropdownPos.left }}
        >
          <div
            className={`${styles.filterDropdownItem}${sourceFilter === 'all' ? ` ${styles.filterDropdownItemActive}` : ''}`}
            onClick={() => { setSourceFilter('all'); setCurrentPage(1); setOpenFilterColumn(null) }}
          >
            전체
          </div>
          {sourceOptions.filter(o => o.value !== 'all').map(o => (
            <div
              key={o.value}
              className={`${styles.filterDropdownItem}${sourceFilter === o.value ? ` ${styles.filterDropdownItemActive}` : ''}`}
              onClick={() => { setSourceFilter(o.value); setCurrentPage(1); setOpenFilterColumn(null) }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Stats Tab
// ─────────────────────────────────────────────

type CertStatsSource = 'hakjeom' | 'edu' | 'private-cert' | 'all'
type CertStatsSubTab = 'overview' | 'status' | 'time'

interface CertStatsItem {
  id: string | number
  status: string
  created_at: string
  type: 'cert' | 'private-cert'
}

const CERT_STATS_SOURCE_LABELS: { id: CertStatsSource; label: string }[] = [
  { id: 'hakjeom', label: '학점연계' },
  { id: 'edu', label: '교육원' },
  { id: 'private-cert', label: '민간자격증' },
  { id: 'all', label: '전체' },
]

const CERT_STATS_SUB_TABS: { id: CertStatsSubTab; label: string }[] = [
  { id: 'overview', label: '개요' },
  { id: 'status', label: '상태 분석' },
  { id: 'time', label: '시간 패턴' },
]

const CERT_PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: '#22c55e', pending: '#f59e0b', failed: '#ef4444', cancelled: '#94a3b8',
}
const CERT_PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: '결제완료', pending: '결제대기', failed: '결제실패', cancelled: '취소',
}
const CERT_CONSULT_STATUS_COLORS: Record<string, string> = {
  '상담대기': '#94a3b8', '상담중': '#3b82f6', '보류': '#f59e0b', '등록대기': '#8b5cf6', '등록완료': '#22c55e',
}

const CERT_SOURCE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b']
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

function certToKST(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(d.getHours() + 9);
  return d;
}
function certYm(d: Date): string { return d.toISOString().slice(0, 7); }
function certYmd(d: Date): string { return d.toISOString().slice(0, 10); }

const CertStatsTip = ({ active, payload, label }: { active?: boolean; payload?: { name?: string; value: number }[]; label?: string }) => {
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
}

function CertStatsCard({ label, value, sub, color, badge, badgeColor }: {
  label: string; value: string | number; sub?: string;
  color?: string; badge?: string; badgeColor?: string;
}) {
  return (
    <div className={styles.statsCard}>
      <div className={styles.statsCardHeader}>
        <span className={styles.statsCardLabel}>{label}</span>
        {badge && (
          <span className={styles.statsCardBadge} style={{ color: badgeColor || '#22c55e', background: (badgeColor || '#22c55e') + '15' }}>
            {badge}
          </span>
        )}
      </div>
      <div className={styles.statsCardValue} style={{ color: color || '#191f28' }}>{value}</div>
      {sub && <div className={styles.statsCardSub}>{sub}</div>}
    </div>
  );
}

function CertStatsPanel({ title, sub, children, style }: {
  title: string; sub?: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
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

// ─────────────────────────────────────────────
// 학생관리: 상세 패널
// ─────────────────────────────────────────────

function CertStudentDetailPanel({ item, onClose, onUpdate, initialTab = 'basic' }: {
  item: CertStudent;
  onClose: () => void;
  onUpdate: (id: number, fields: Partial<CertStudent>) => Promise<void>;
  initialTab?: 'basic' | 'memo';
}) {
  const [editName, setEditName] = useState(item.name);
  const [editContact, setEditContact] = useState(item.contact);
  const [editCourseItems, setEditCourseItems] = useState<CourseItem[]>(() => parseCourseItems(item.course));
  const [editStatus, setEditStatus] = useState<StudentStatus>(item.status);
  const [editManager, setEditManager] = useState(item.manager ?? '');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'memo'>(initialTab);
  const [memoCount, setMemoCount] = useState<number | null>(null);
  const [localMemoCount, setLocalMemoCount] = useState<number>(item.memo_count ?? 0);
  const [localLastMemoAt, setLocalLastMemoAt] = useState<string | null>(item.latest_memo_at ?? null);

  useEffect(() => {
    setEditName(item.name);
    setEditContact(item.contact);
    setEditCourseItems(parseCourseItems(item.course));
    setEditStatus(item.status);
    setEditManager(item.manager ?? '');
  }, [item.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(item.id, {
        name: editName.trim() || item.name,
        contact: editContact.trim() || item.contact,
        course: editCourseItems.length > 0 ? serializeCourseItems(editCourseItems) : null,
        completion_rate: null,
        status: editStatus,
        manager: editManager || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const courseItems = parseCourseItems(item.course);

  return (
    <div className={styles.detailModalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.detailModal}>
        <div className={styles.detailModalHeader}>
          <div className={styles.detailModalHeaderTop}>
            <div className={styles.detailModalHeaderLeft}>
              <div>
                <div className={styles.detailModalNameRow}>
                  <p className={styles.detailModalName}>{item.name}</p>
                  <StatusBadge status={editStatus} styleMap={STUDENT_STATUS_STYLE} />
                </div>
                <p className={styles.detailModalSub}>{item.contact}</p>
                <p className={styles.detailModalSub}>등록일: {formatDateShort(item.created_at)}</p>
                <div className={styles.detailModalContactRow}>
                  <span className={styles.detailModalContactBadge}>
                    총 {localMemoCount}회 연락
                  </span>
                  {localLastMemoAt && (
                    <span className={styles.detailModalContactSub}>
                      마지막 연락: {formatDateShort(localLastMemoAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className={styles.detailModalCloseBtn}>✕</button>
          </div>
          <div className={styles.detailModalTabs}>
            {(['basic', 'memo'] as const).map(tab => {
              const labels = { basic: '기본정보', memo: '메모' };
              return (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                  className={`${styles.detailModalTab} ${activeTab === tab ? styles.detailModalTabActive : ''}`}
                >
                  {tab === 'memo' && memoCount != null && memoCount > 0 ? `메모 (${memoCount})` : labels[tab]}
                </button>
              );
            })}
          </div>
        </div>
        <div className={styles.detailModalBody}>
          {activeTab === 'basic' && (
            <>
              <div className={styles.detailChipSection}>
                <span className={styles.detailChipSectionLabel}>상태</span>
                <div className={styles.detailChipRow}>
                  {STUDENT_STATUS_OPTIONS.map(s => (
                    <button key={s} type="button" onClick={() => setEditStatus(s)}
                      className={editStatus === s ? certStyles.chipBtn : certStyles.chipBtnInactive}
                      style={editStatus === s
                        ? { border: `2px solid ${STUDENT_STATUS_STYLE[s].color}`, background: STUDENT_STATUS_STYLE[s].background, color: STUDENT_STATUS_STYLE[s].color }
                        : undefined
                      }
                    >{s}</button>
                  ))}
                </div>
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>이름</span>
                <input value={editName} onChange={e => setEditName(e.target.value)} className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>연락처</span>
                <input value={editContact} onChange={e => setEditContact(e.target.value)} className={`${styles.input} ${styles.inputFull}`} />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>수강과목</span>
                <CourseTagInput items={editCourseItems} onChange={setEditCourseItems} placeholder="과목 검색 후 추가..." />
              </div>
              <div className={styles.detailFieldRow}>
                <span className={styles.detailFieldLabel}>담당자</span>
                <input value={editManager} onChange={e => setEditManager(e.target.value)} placeholder="담당자 이름" className={`${styles.input} ${styles.inputFull}`} />
              </div>
            </>
          )}
          {activeTab === 'memo' && (
            <>
              <MemoTimeline
                tableName="cert_students"
                recordId={String(item.id)}
                legacyMemo={item.memo}
                defaultInput={[
                  editContact.trim(),
                  editCourseItems.length > 0
                    ? editCourseItems.map(c => `${c.name}(${c.rate ?? 0}%)`).join(', ')
                    : null,
                ].filter(Boolean).join(' / ')}
                onCountChange={(count) => { setMemoCount(count); setLocalMemoCount(count); }}
                onLastMemoAt={setLocalLastMemoAt}
                onAdd={async () => {}}
              />
            </>
          )}
        </div>
        <div className={styles.detailModalFooter}>
          <button onClick={handleSave} disabled={saving} className={`${styles.panelSaveBtn} ${saving ? styles.panelSaveBtnDisabled : ''}`}>
            {saving ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 학생관리: 추가 모달 ─────────────────────────────────────────────────────

function CertStudentAddModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const TOTAL_STEPS = 2;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', contact: '', courseItems: [] as CourseItem[], manager: '', memo: '',
  });
  const [errors, setErrors] = useState<{ name?: string; contact?: string }>({});
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

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
      const res = await fetch('/api/cert/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          course: form.courseItems.length > 0 ? serializeCourseItems(form.courseItems) : null,
          completion_rate: null,
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

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} className={styles.modalOverlay}>
      <div className={styles.funnelBox}>
        <div className={styles.funnelHeader}>
          <button type="button" onClick={step === 1 ? onClose : handleBack} className={styles.funnelBackBtn}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M14 9H4M4 9L8 5M4 9L8 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <span className={styles.funnelStepLabel}>{step} / {TOTAL_STEPS}</span>
          <button type="button" onClick={onClose} className={styles.funnelCloseBtn}>✕</button>
        </div>
        <div className={styles.funnelProgressBar}>
          <div className={styles.funnelProgressFill} style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
        <div className={styles.funnelBody}>
          {step === 1 && (
            <div className={styles.funnelStep}>
              <p className={styles.funnelQuestion}>학생 기본 정보를 입력해주세요</p>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>이름</label>
                <input
                  ref={nameRef}
                  value={form.name}
                  onChange={e => { setForm(p => ({ ...p, name: e.target.value })); if (errors.name) setErrors(p => ({ ...p, name: undefined })); }}
                  placeholder="홍길동"
                  className={`${styles.funnelInput}${errors.name ? ` ${styles.funnelInputError}` : ''}`}
                />
                {errors.name && <p className={styles.funnelError}>{errors.name}</p>}
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>연락처</label>
                <input
                  value={form.contact}
                  onChange={e => { setForm(p => ({ ...p, contact: formatPhoneNumber(e.target.value) })); if (errors.contact) setErrors(p => ({ ...p, contact: undefined })); }}
                  placeholder="010-0000-0000"
                  inputMode="tel"
                  className={`${styles.funnelInput}${errors.contact ? ` ${styles.funnelInputError}` : ''}`}
                />
                {errors.contact && <p className={styles.funnelError}>{errors.contact}</p>}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className={styles.funnelStep}>
              <p className={styles.funnelQuestion}>수강 정보를 입력해주세요</p>
              <p className={styles.funnelSubQuestion}>모두 선택사항이에요</p>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>수강과목</label>
                <CourseTagInput
                  items={form.courseItems}
                  onChange={v => setForm(p => ({ ...p, courseItems: v }))}
                  placeholder="과목 검색 후 추가..."
                />
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>담당자</label>
                <input
                  value={form.manager}
                  onChange={e => setForm(p => ({ ...p, manager: e.target.value }))}
                  placeholder="담당자 이름"
                  className={styles.funnelInput}
                />
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>메모</label>
                <input
                  value={form.memo}
                  onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
                  placeholder="메모 내용"
                  className={styles.funnelInput}
                />
              </div>
            </div>
          )}
        </div>
        <div className={styles.funnelFooter}>
          {step < TOTAL_STEPS ? (
            <button type="button" onClick={handleNext} className={styles.funnelNextBtn}>다음</button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving} className={`${styles.funnelNextBtn}${saving ? ` ${styles.funnelNextBtnDisabled}` : ''}`}>
              {saving ? '저장 중...' : '등록하기'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 학생관리 일괄등록 CSV 설정
// ─────────────────────────────────────────────

const STUDENT_CSV_TEMPLATE = [
  '\uFEFF이름,연락처,수강과목,상태,담당자,메모,등록일',
  '홍길동,010-1234-5678,생활지원사1급:80,과정안내,김담당,,2024-03-15',
  '김영희,010-2345-6789,아동미술지도사1급:30/생활지원사1급:50,수강중,이담당,오전 연락 요망,2024-04-01',
  '',
].join('\n');

const STUDENT_CSV_COLUMN_MAP: Record<string, string> = {
  '이름': 'name', 'name': 'name',
  '연락처': 'contact', 'contact': 'contact',
  '수강과목': 'course', 'course': 'course',
  '상태': 'status', 'status': 'status',
  '담당자': 'manager', 'manager': 'manager',
  '메모': 'memo', 'memo': 'memo',
  '등록일': 'created_at', 'created_at': 'created_at',
};

interface StudentCsvRow {
  name: string; contact: string;
  course: string; status: string;
  manager: string; memo: string;
  created_at: string;
}

// "과목명:수강률/과목명:수강률" 형식을 CourseItem JSON으로 변환
function parseCsvCourseField(val: string): string {
  if (!val.trim()) return '';
  const parts = val.split('/').map(s => s.trim()).filter(Boolean);
  const items: CourseItem[] = parts.map(part => {
    const colonIdx = part.lastIndexOf(':');
    if (colonIdx > 0) {
      const name = part.slice(0, colonIdx).trim();
      const rateStr = part.slice(colonIdx + 1).trim().replace('%', '');
      const rate = Number(rateStr);
      return { name, rate: isNaN(rate) ? 0 : Math.min(100, Math.max(0, rate)) };
    }
    return { name: part, rate: 0 };
  });
  return serializeCourseItems(items);
}

function parseStudentCsv(text: string): StudentCsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, '').replace(/^"|"$/g, ''));
  const mapped = headers.map(h => STUDENT_CSV_COLUMN_MAP[h] ?? null);
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    mapped.forEach((key, i) => { if (key) row[key] = cols[i] ?? ''; });
    if (row.course) row.course = parseCsvCourseField(row.course);
    return row as unknown as StudentCsvRow;
  }).filter(r => r.name && r.contact);
}

// ─────────────────────────────────────────────
// 학생관리 탭
// ─────────────────────────────────────────────

function StudentMgmtTab() {
  const [items, setItems] = useState<CertStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StudentStatus | 'all'>('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [selectedItem, setSelectedItem] = useState<CertStudent | null>(null);
  const [openTab, setOpenTab] = useState<'basic' | 'memo'>('basic');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [deleteToastVisible, setDeleteToastVisible] = useState(false);
  const [filterDropdownPos, setFilterDropdownPos] = useState({ top: 0, left: 0 });
  const itemsPerPage = 10;

  const fetchData = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cert/students');
      if (!res.ok) throw new Error('데이터를 불러오지 못했습니다.');
      const data: CertStudent[] = await res.json();
      setItems(sortStudents(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setSelectedIds([]); }, [currentPage]);
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

  const handleUpdate = async (id: number, fields: Partial<CertStudent>) => {
    const res = await fetch('/api/cert/students', {
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
    setItems(prev => sortStudents(prev.map(c => c.id === id ? { ...c, ...merged } : c)));
    setSelectedItem(prev => prev?.id === id ? { ...prev, ...merged } : prev);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const handleStatusChange = async (id: number, status: StudentStatus) => {
    await handleUpdate(id, { status });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`${selectedIds.length}건을 삭제할까요?`)) return;
    setDeleting(true);
    await fetch('/api/cert/students', {
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

  const filtered = items.filter(c => {
    if (searchText) {
      const q = searchText.toLowerCase();
      const contactClean = c.contact.replace(/-/g, '');
      const searchClean = searchText.replace(/-/g, '');
      if (!(
        c.name.toLowerCase().includes(q) ||
        contactClean.includes(searchClean) ||
        (c.course || '').toLowerCase().includes(q) ||
        (c.memo || '').toLowerCase().includes(q)
      )) return false;
    }
    if (courseFilter && (c.course || '').toLowerCase() !== courseFilter.toLowerCase()) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (managerFilter === 'none' && c.manager) return false;
    if (managerFilter !== 'all' && managerFilter !== 'none' && c.manager !== managerFilter) return false;
    if (startDate || endDate) {
      const d = new Date(c.created_at);
      if (startDate && d < new Date(startDate + 'T00:00:00')) return false;
      if (endDate && d > new Date(endDate + 'T23:59:59')) return false;
    }
    return true;
  });

  const uniqueManagers = Array.from(new Set(items.map(c => c.manager).filter(Boolean))) as string[];

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const toggleSelect = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedIds(prev => prev.length === paginated.length ? [] : paginated.map(c => c.id));

  const isFiltered = searchText || courseFilter || statusFilter !== 'all' || managerFilter !== 'all' || startDate || endDate;

  const STUDENT_HEADERS = ['번호', '이름', '연락처', '수강과목', '수강률', '상태', '담당자', '메모', '등록일'];
  const studentToRow = (item: CertStudent, i: number) => {
    const ci = parseCourseItems(item.course);
    return [
      i + 1,
      item.name,
      item.contact,
      ci.map(c => c.name).join(', '),
      ci.map(c => c.rate != null ? `${c.rate}%` : '').join(' / '),
      item.status,
      item.manager ?? '',
      item.latest_memo ?? item.memo ?? '',
      item.created_at ? new Date(item.created_at).toLocaleString('ko-KR') : '',
    ];
  };

  const handleDownloadAll = () => {
    downloadExcel(`학생관리_전체_${new Date().toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '')}.xlsx`, [{
      name: '학생관리',
      headers: STUDENT_HEADERS,
      rows: filtered.map((item, i) => studentToRow(item, i)),
    }]);
  };

  const handleDownloadSelected = () => {
    const targets = filtered.filter(c => selectedIds.includes(c.id));
    downloadExcel(`학생관리_선택_${new Date().toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '')}.xlsx`, [{
      name: '학생관리',
      headers: STUDENT_HEADERS,
      rows: targets.map((item, i) => studentToRow(item, i)),
    }]);
  };

  const resetFilters = () => {
    setSearchText(''); setCourseFilter(''); setStatusFilter('all'); setManagerFilter('all');
    setStartDate(''); setEndDate(''); setCurrentPage(1);
  };

  return (
    <div>
      {loading ? <FilterBarSkeleton /> : (
        <>
          <div className={styles.filterRow}>
            <input
              type="text"
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
              placeholder="이름, 연락처, 메모 검색..."
              className={`${styles.input} ${certStyles.pcertSearchInput}`}
            />
            <CourseAutocomplete
              value={courseFilter}
              onChange={v => { setCourseFilter(v); setCurrentPage(1); }}
              placeholder="수강과목 검색..."
              className={`${styles.input} ${certStyles.courseFilterInput}`}
            />
            <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setCurrentPage(1); }} className={`${styles.input} ${certStyles.dateInput140}`} />
            <span className={styles.dateSeparator}>~</span>
            <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setCurrentPage(1); }} className={`${styles.input} ${certStyles.dateInput140}`} />
            {isFiltered && <button onClick={resetFilters} className={styles.btnSecondary}>필터 초기화</button>}
            {selectedIds.length > 0 && (
              <>
                <span className={styles.bulkActionCount}>{selectedIds.length}건 선택됨</span>
                <button onClick={handleBulkDelete} disabled={deleting} className={styles.btnDanger}>
                  {deleting ? '삭제 중...' : '선택 삭제'}
                </button>
                <button onClick={handleDownloadSelected} className={styles.btnDownload}>↓ 선택 다운로드</button>
                <button onClick={() => setSelectedIds([])} className={styles.btnSecondary}>선택 해제</button>
              </>
            )}
          </div>
          <div className={styles.actionBar}>
            <span className={styles.actionBarCount}>총 <strong className={styles.actionBarCountBold}>{filtered.length}</strong>건</span>
            <div className={styles.actionBarSpacer} />
            <button onClick={handleDownloadAll} className={styles.btnDownload}>↓ 전체 다운로드</button>
            <button onClick={() => setShowAddModal(true)} className={styles.btnPrimary}>+ 추가</button>
          </div>
        </>
      )}

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
                  <th className={styles.th}>이름</th>
                  <th className={styles.th}>연락처</th>
                  <th className={styles.th}>수강과목</th>
                  <th className={styles.th}>수강률</th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      상태
                      <button className={`${styles.thFilterBtn}${statusFilter !== 'all' ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'status') { setOpenFilterColumn(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left }); setOpenFilterColumn('status'); }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    </div>
                  </th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      담당자
                      <button className={`${styles.thFilterBtn}${managerFilter !== 'all' ? ` ${styles.thFilterBtnActive}` : ''}`} onClick={e => { e.stopPropagation(); if (openFilterColumn === 'manager') { setOpenFilterColumn(null); return; } const rect = e.currentTarget.getBoundingClientRect(); setFilterDropdownPos({ top: rect.bottom + 4, left: rect.left }); setOpenFilterColumn('manager'); }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
                    </div>
                  </th>
                  <th className={styles.th}>메모</th>
                  <th className={styles.th}>등록일</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton cols={10} rows={8} />
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={10} className={styles.tableEmptyMsg}>검색 결과가 없습니다.</td></tr>
                ) : paginated.map((item, index) => {
                  const courseItems = parseCourseItems(item.course);
                  return (
                    <tr
                      key={item.id}
                      data-id={item.id}
                      onClick={() => { setOpenTab('basic'); setSelectedItem(item); }}
                      className={certStyles.pcertTr}
                      style={{
                        background: selectedItem?.id === item.id ? '#EBF3FE' : selectedIds.includes(item.id) ? '#f0f7ff' : 'transparent',
                      }}
                      onMouseEnter={e => { if (selectedItem?.id !== item.id && !selectedIds.includes(item.id)) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--toss-bg)'; }}
                      onMouseLeave={e => { if (selectedItem?.id !== item.id && !selectedIds.includes(item.id)) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                    >
                      <td className={styles.tdCenter} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)} className={styles.checkbox} />
                      </td>
                      <td className={styles.tdNum}>{(currentPage - 1) * itemsPerPage + index + 1}</td>
                      <td className={styles.tdBold}><PCertHighlight text={item.name} query={searchText} /></td>
                      <td className={styles.tdTabular}><PCertHighlight text={item.contact} query={searchText} /></td>
                      <td className={styles.td}>
                        {courseItems.length > 0 ? (
                          <div className={certStyles.courseTableCellList}>
                            {courseItems.map(c => (
                              <span key={c.name} className={certStyles.courseTableTag}>
                                {c.name} {c.rate ?? 0}%
                              </span>
                            ))}
                          </div>
                        ) : <span className={styles.tdMuted}>-</span>}
                      </td>
                      <td className={styles.td}>
                        {courseItems.length > 0 ? (
                          <div className={certStyles.studentRateCellStack}>
                            {courseItems.map(c => {
                              const r = c.rate ?? 0;
                              return (
                                <div key={c.name} className={certStyles.studentRateCellRow}>
                                  <div className={certStyles.studentRateCellBar}>
                                    <div className={certStyles.studentRateCellBarFill} style={{ width: `${Math.min(r, 100)}%` }} />
                                  </div>
                                  <span className={certStyles.studentRateCellText}>{r}%</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : <span className={styles.tdMuted}>-</span>}
                      </td>
                      <td className={styles.td} onClick={e => e.stopPropagation()}>
                        <StatusSelect
                          value={item.status}
                          onChange={v => handleStatusChange(item.id, v as StudentStatus)}
                          options={STUDENT_STATUS_OPTIONS}
                          styleMap={STUDENT_STATUS_STYLE}
                        />
                      </td>
                      <td className={styles.tdSecondary}>{item.manager ?? <span className={styles.tdMuted}>-</span>}</td>
                      <td className={styles.tdMemo} onClick={e => { e.stopPropagation(); setOpenTab('memo'); setSelectedItem(item); }} style={{ cursor: 'pointer' }}>
                        <MemoHoverBadge text={item.latest_memo || item.memo || '-'} />
                      </td>
                      <td className={styles.tdDateSmall}>{formatDate(item.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={`${styles.pageBtn} ${certStyles.pageBtnMr4}`}>‹</button>
          {getPaginationPages(currentPage, totalPages).map((page, idx) =>
            page === '...'
              ? <span key={`ellipsis-${idx}`} className={styles.pageEllipsis}>…</span>
              : <button key={page} onClick={() => setCurrentPage(page as number)} className={page === currentPage ? styles.pageBtnActive : styles.pageBtn}>{page}</button>
          )}
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={`${styles.pageBtn} ${certStyles.pageBtnMl4}`}>›</button>
        </div>
      )}

      {selectedItem && (
        <CertStudentDetailPanel
          item={selectedItem}
          onClose={() => { setSelectedItem(null); setOpenTab('basic'); }}
          onUpdate={handleUpdate}
          initialTab={openTab}
        />
      )}
      {showAddModal && <CertStudentAddModal onClose={() => setShowAddModal(false)} onSaved={fetchData} />}
      {toastVisible && <div className={styles.toast}>저장이 완료되었습니다</div>}
      {deleteToastVisible && <div className={styles.toast}>삭제되었습니다</div>}

      {openFilterColumn && (
        <div ref={dropdownRef} className={styles.filterColumnDropdown} style={{ top: filterDropdownPos.top, left: filterDropdownPos.left }}>
          {openFilterColumn === 'status' && (
            <>
              <div className={`${styles.filterDropdownItem}${statusFilter === 'all' ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setStatusFilter('all'); setCurrentPage(1); setOpenFilterColumn(null); }}>전체</div>
              {STUDENT_STATUS_OPTIONS.map(s => (
                <div key={s} className={`${styles.filterDropdownItem}${statusFilter === s ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setStatusFilter(s); setCurrentPage(1); setOpenFilterColumn(null); }}>{s}</div>
              ))}
            </>
          )}
          {openFilterColumn === 'manager' && (
            <>
              <div className={`${styles.filterDropdownItem}${managerFilter === 'all' ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setManagerFilter('all'); setCurrentPage(1); setOpenFilterColumn(null); }}>전체</div>
              <div className={`${styles.filterDropdownItem}${managerFilter === 'none' ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setManagerFilter('none'); setCurrentPage(1); setOpenFilterColumn(null); }}>미배정</div>
              {uniqueManagers.map(m => (
                <div key={m} className={`${styles.filterDropdownItem}${managerFilter === m ? ` ${styles.filterDropdownItemActive}` : ''}`} onClick={() => { setManagerFilter(m); setCurrentPage(1); setOpenFilterColumn(null); }}>{m}</div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 학생관리 일괄등록 뷰
// ─────────────────────────────────────────────

function StudentBulkUploadView({ onBack }: { onBack: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<StudentCsvRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);

  // 임시저장 목록
  const [drafts, setDrafts] = useState<CertStudent[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [selectedDraftIds, setSelectedDraftIds] = useState<number[]>([]);
  const [confirming, setConfirming] = useState(false);

  const fetchDrafts = async () => {
    setDraftsLoading(true);
    const res = await fetch('/api/cert/students/draft');
    if (res.ok) setDrafts(await res.json());
    setDraftsLoading(false);
  };

  useEffect(() => { fetchDrafts(); }, []);

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setCsvRows(parseStudentCsv(text));
    };
    reader.readAsText(file, 'utf-8');
  }

  function downloadTemplate() {
    const blob = new Blob([STUDENT_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '학생관리_CSV템플릿.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSave() {
    if (!csvRows.length) return;
    setSaving(true);
    const res = await fetch('/api/cert/students/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: csvRows }),
    });
    if (res.ok) {
      const { count } = await res.json();
      alert(`${count}건이 임시저장되었습니다.`);
      setCsvRows([]); setFileName('');
      await fetchDrafts();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || '저장에 실패했습니다.');
    }
    setSaving(false);
  }

  async function handleConfirm() {
    if (!selectedDraftIds.length || confirming) return;
    if (!confirm(`선택한 ${selectedDraftIds.length}건을 학생관리로 이동하시겠습니까?`)) return;
    setConfirming(true);
    const res = await fetch('/api/cert/students/draft', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedDraftIds }),
    });
    if (res.ok) {
      setSelectedDraftIds([]);
      await fetchDrafts();
    } else {
      alert('이동에 실패했습니다.');
    }
    setConfirming(false);
  }

  function toggleDraft(id: number) {
    setSelectedDraftIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function toggleAllDrafts() {
    if (selectedDraftIds.length === drafts.length) {
      setSelectedDraftIds([]);
    } else {
      setSelectedDraftIds(drafts.map(d => d.id));
    }
  }

  const PREVIEW_COLS: (keyof StudentCsvRow)[] = ['name', 'contact', 'course', 'status', 'manager', 'memo', 'created_at'];
  const PREVIEW_HEADERS = ['이름', '연락처', '수강과목', '상태', '담당자', '메모', '등록일'];

  return (
    <div className={styles.bulkWrap}>
      <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

      <div className={styles.bulkTabBar}>
        <span className={styles.bulkTabBtn} style={{ fontWeight: 700, color: 'var(--toss-blue)' }}>CSV 일괄등록</span>
        <button onClick={downloadTemplate} className={styles.bulkTemplateBtn}>↓ 템플릿 다운로드</button>
      </div>

      {/* ── 섹션 1: 임시저장 목록 ── */}
      <div className={certStyles.draftSection}>
        <div className={certStyles.draftSectionHeader}>
          <span className={certStyles.draftSectionTitle}>임시저장 목록</span>
          {drafts.length > 0 && (
            <span className={certStyles.draftSectionCount}>{drafts.length}건</span>
          )}
          <div className={certStyles.draftSectionSpacer} />
          {selectedDraftIds.length > 0 && (
            <button
              className={styles.btnPrimary}
              onClick={handleConfirm}
              disabled={confirming}
            >
              {confirming ? '이동 중...' : `선택한 ${selectedDraftIds.length}건 학생관리로 이동`}
            </button>
          )}
        </div>

        {draftsLoading ? (
          <div className={certStyles.draftEmpty}>불러오는 중...</div>
        ) : drafts.length === 0 ? (
          <div className={certStyles.draftEmpty}>임시저장된 항목이 없습니다. CSV를 업로드해서 임시저장해보세요.</div>
        ) : (
          <div className={styles.tableCard}>
            <div className={styles.tableOverflow}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>
                      <input
                        type="checkbox"
                        checked={selectedDraftIds.length === drafts.length}
                        onChange={toggleAllDrafts}
                      />
                    </th>
                    <th className={styles.th}>이름</th>
                    <th className={styles.th}>연락처</th>
                    <th className={styles.th}>수강과목</th>
                    <th className={styles.th}>상태</th>
                    <th className={styles.th}>담당자</th>
                    <th className={styles.th}>임시등록일</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map(item => {
                    const courseItems = parseCourseItems(item.course);
                    return (
                      <tr
                        key={item.id}
                        className={selectedDraftIds.includes(item.id) ? certStyles.draftRowSelected : ''}
                        onClick={() => toggleDraft(item.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className={styles.td} onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedDraftIds.includes(item.id)}
                            onChange={() => toggleDraft(item.id)}
                          />
                        </td>
                        <td className={styles.td}>{item.name}</td>
                        <td className={styles.tdSecondary}>{item.contact}</td>
                        <td className={styles.td}>
                          {courseItems.length > 0 ? (
                            <div className={certStyles.courseTableCellList}>
                              {courseItems.map(c => (
                                <span key={c.name} className={certStyles.courseTableTag}>{c.name}{c.rate != null ? ` ${c.rate}%` : ''}</span>
                              ))}
                            </div>
                          ) : <span className={styles.tdMuted}>-</span>}
                        </td>
                        <td className={styles.td}>{item.status}</td>
                        <td className={styles.tdSecondary}>{item.manager || '-'}</td>
                        <td className={styles.tdSecondary}>{formatDate(item.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 섹션 2: CSV 업로드 ── */}
      <div className={certStyles.draftSection}>
        <div className={certStyles.draftSectionHeader}>
          <span className={certStyles.draftSectionTitle}>CSV 업로드</span>
        </div>

        {!csvRows.length ? (
          <div className={styles.bulkUploadArea}>
            <div
              className={styles.bulkDropzone}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <span className={styles.bulkDropzoneIcon}>📂</span>
              <p className={styles.bulkDropzoneTitle}>학생관리 CSV 파일 업로드</p>
              <p className={styles.bulkDropzoneSub}>파일을 드래그하거나 클릭해서 선택하세요</p>
            </div>
            <div className={styles.bulkGuideBox}>
              <p className={styles.bulkGuideTitle}>컬럼 안내</p>
              <div className={styles.bulkGuideGrid}>
                {[
                  { col: '이름', desc: '필수' },
                  { col: '연락처', desc: '필수' },
                  { col: '수강과목', desc: '아래 형식 참고' },
                  { col: '상태', desc: '선택 (기본: 과정안내)' },
                  { col: '담당자', desc: '선택' },
                  { col: '메모', desc: '선택' },
                  { col: '등록일', desc: '선택 (예: 2024-03-15, 생략 시 오늘)' },
                ].map(({ col, desc }) => (
                  <div key={col} className={styles.bulkGuideItem}>
                    <span className={styles.bulkGuideCol}>{col}</span>
                    <span className={styles.bulkGuideDesc}>{desc}</span>
                  </div>
                ))}
              </div>
              <div className={certStyles.bulkCourseGuide}>
                <p className={certStyles.bulkCourseGuideTitle}>📌 수강과목 입력 방법</p>
                <div className={certStyles.bulkCourseGuideRow}>
                  <span className={certStyles.bulkCourseGuideLabel}>단일 과목</span>
                  <code className={certStyles.bulkCourseGuideCode}>생활지원사1급:80</code>
                  <span className={certStyles.bulkCourseGuideHint}>과목명:수강률(0~100)</span>
                </div>
                <div className={certStyles.bulkCourseGuideRow}>
                  <span className={certStyles.bulkCourseGuideLabel}>여러 과목</span>
                  <code className={certStyles.bulkCourseGuideCode}>생활지원사1급:80/아동미술지도사1급:30</code>
                  <span className={certStyles.bulkCourseGuideHint}>슬래시(/)로 구분</span>
                </div>
                <div className={certStyles.bulkCourseGuideRow}>
                  <span className={certStyles.bulkCourseGuideLabel}>수강률 없이</span>
                  <code className={certStyles.bulkCourseGuideCode}>생활지원사1급</code>
                  <span className={certStyles.bulkCourseGuideHint}>수강률 생략 시 0%로 저장</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.bulkUploadArea}>
            <div className={styles.bulkPreviewCard}>
              <div className={styles.bulkPreviewHeader}>
                <span className={styles.bulkPreviewTitle}>{fileName}</span>
                <span className={styles.bulkPreviewMeta}>{csvRows.length}건 파싱됨</span>
                <div style={{ flex: 1 }} />
                <button onClick={() => { setCsvRows([]); setFileName(''); }} className={styles.btnSecondary}>다시 선택</button>
                <button onClick={handleSave} disabled={saving} className={styles.btnPrimary}>
                  {saving ? '저장 중...' : `${csvRows.length}건 임시저장`}
                </button>
              </div>
              <div className={styles.bulkPreviewTableWrap}>
                <table className={styles.bulkTable}>
                  <thead className={styles.bulkThead}>
                    <tr>
                      {PREVIEW_HEADERS.map(h => <th key={h} className={styles.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.map((row, i) => (
                      <tr key={i}>
                        {PREVIEW_COLS.map(col => <td key={col} className={styles.td}>{row[col] || '-'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 상담 템플릿 탭
// ─────────────────────────────────────────────

type TemplateSubTab = '첫 안내' | '수업' | '시험' | '취업' | '비용/결제' | '학생 개인고민' | '과정안내'| '수강안내'
const TEMPLATE_SUB_TABS: TemplateSubTab[] = ['첫 안내', '수업', '시험', '취업', '비용/결제', '학생 개인고민', '과정안내', '수강안내']

interface TemplateBlock {
  id: number
  sub_tab: string
  title: string
  content: string
  images: string[]
  order_index: number
}

function DownloadAllImagesBtn({ urls, title }: { urls: string[]; title: string }) {
  const [state, setState] = useState<'idle' | 'loading'>('idle')

  const handleDownload = async () => {
    setState('loading')
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      await Promise.all(urls.map(async (url, i) => {
        const res = await fetch(url)
        const blob = await res.blob()
        const ext = blob.type.split('/')[1] ?? 'jpg'
        zip.file(`image-${i + 1}.${ext}`, blob)
      }))
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const objUrl = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = `${title || 'images'}.zip`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(objUrl)
    } catch { /* skip */ }
    setState('idle')
  }

  return (
    <button type="button" className={certStyles.templateImageSaveAllBtn} onClick={handleDownload} disabled={state === 'loading'}>
      {state === 'loading' ? 'ZIP 만드는 중...' : `이미지 ZIP 저장${urls.length > 1 ? ` (${urls.length}개)` : ''}`}
    </button>
  )
}

function CopyImageBtn({ url, index }: { url: string; index: number }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const handleCopy = async () => {
    setState('loading')
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      setState('done')
      setTimeout(() => setState('idle'), 1500)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 1500)
    }
  }

  return (
    <div className={certStyles.templateImageWrap}>
      <img src={url} alt="" className={certStyles.templateImage} />
      <button
        type="button"
        className={`${certStyles.templateImageCopyBtn} ${state === 'done' ? certStyles.templateImageCopyBtnDone : state === 'error' ? certStyles.templateImageCopyBtnError : ''}`}
        onClick={handleCopy}
        disabled={state === 'loading'}
        title={`이미지 ${index + 1} 복사`}
      >
        {state === 'loading' ? '...' : state === 'done' ? '✓' : state === 'error' ? '✕' : '복사'}
      </button>
    </div>
  )
}

function CopyMergedImagesBtn({ urls }: { urls: string[] }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const handleCopy = async () => {
    setState('loading')
    try {
      const images = await Promise.all(
        urls.map(src => new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = src
        }))
      )
      const width = Math.max(...images.map(img => img.naturalWidth))
      const height = images.reduce((sum, img) => sum + img.naturalHeight, 0)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      let y = 0
      images.forEach(img => { ctx.drawImage(img, 0, y); y += img.naturalHeight })
      await new Promise<void>((resolve, reject) => {
        canvas.toBlob(async blob => {
          if (!blob) { reject(new Error('blob null')); return }
          await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
          resolve()
        }, 'image/png')
      })
      setState('done')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2000)
    }
  }

  const label = state === 'loading' ? '합치는 중...' : state === 'done' ? '✓ 복사됨' : state === 'error' ? '실패 (CORS?)' : `이미지 합쳐서 복사 (${urls.length}개)`

  return (
    <button
      type="button"
      className={`${certStyles.templateImageSaveAllBtn} ${state === 'done' ? certStyles.templateImageSaveAllBtnDone : state === 'error' ? certStyles.templateImageSaveAllBtnError : ''}`}
      onClick={handleCopy}
      disabled={state === 'loading'}
    >
      {label}
    </button>
  )
}

function CounselTemplateTab() {
  const [activeTab, setActiveTab] = useState<TemplateSubTab>('첫 안내')
  const [blocks, setBlocks] = useState<TemplateBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const barRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(data => {
      if (!data) return
      // mini-admin만 제외, 나머지(admin/master-admin/staff) 전원 허용
      // 단, display_name에 이사/상무 포함 시에도 허용 (mini-admin이어도)
      const isMiniAdmin = data.role === 'mini-admin'
      const isExec = ['이사', '상무'].some(t => data.displayName?.includes(t))
      setIsAdmin(!isMiniAdmin || isExec)
    })
  }, [])

  useEffect(() => {
    const idx = TEMPLATE_SUB_TABS.indexOf(activeTab)
    const el = tabRefs.current[idx]
    const bar = barRef.current
    if (!el || !bar) return
    const barRect = bar.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    setPill({ left: elRect.left - barRect.left, width: elRect.width })
  }, [activeTab, loading])

  const fetchBlocks = async () => {
    setLoading(true)
    const res = await fetch(`/api/cert/templates?sub_tab=${encodeURIComponent(activeTab)}`)
    if (res.ok) setBlocks(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchBlocks() }, [activeTab])

  const handleCopy = (content: string, id: number) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleDelete = async (block: TemplateBlock) => {
    if (!confirm(`"${block.title}" 템플릿을 삭제할까요?`)) return
    const imagePaths = block.images.map(url => url.split('/cert-templates/')[1]).filter(Boolean)
    await fetch('/api/cert/templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: block.id, imagePaths }),
    })
    setBlocks(prev => prev.filter(b => b.id !== block.id))
  }

  return (
    <div>
      <div className={styles.statsSourceToggleWrap}>
        <div ref={barRef} className={styles.statsSourceBar}>
          {pill && <div className={certStyles.srcPillBase} style={{ left: pill.left, width: pill.width }} />}
          {TEMPLATE_SUB_TABS.map((tab, i) => (
            <button key={tab} ref={el => { tabRefs.current[i] = el }} type="button"
              onClick={() => setActiveTab(tab)}
              className={`${styles.statsSourceBtn} ${activeTab === tab ? certStyles.statsSourceBtnActive : certStyles.statsSourceBtnInactive}`}
            >{tab}</button>
          ))}
        </div>
      </div>
      <div className={certStyles.templateBody}>
        {loading ? (
          <p className={certStyles.templateEmpty}>불러오는 중...</p>
        ) : (
          <>
            {blocks.map(block => (
              <div key={block.id} className={certStyles.templateBlock}>
                <div className={certStyles.templateBlockTitleRow}>
                  <p className={certStyles.templateBlockTitle}>{block.title}</p>
                  {isAdmin && (
                    <div className={certStyles.templateBlockActions}>
                      <TemplateEditModal block={block} onSaved={fetchBlocks} />
                      <button type="button" className={certStyles.templateDeleteBtn} onClick={() => handleDelete(block)}>삭제</button>
                    </div>
                  )}
                </div>
                {block.content && (
                  <div className={certStyles.templateBlockContent}>
                    <pre className={certStyles.templateBlockText}>{block.content}</pre>
                    <button type="button"
                      className={`${certStyles.templateCopyBtn} ${copiedId === block.id ? certStyles.templateCopyBtnDone : ''}`}
                      onClick={() => handleCopy(block.content, block.id)} title="복사"
                    >
                      {copiedId === block.id ? '✓' : (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                          <path d="M2 10V2.5A.5.5 0 0 1 2.5 2H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                      )}
                    </button>
                  </div>
                )}
                {block.images.length > 0 && (
                  <div>
                    <div className={certStyles.templateImageRow}>
                      {block.images.map((url, i) => (
                        <img key={i} src={url} alt="" className={certStyles.templateImage} />
                      ))}
                    </div>
                    <DownloadAllImagesBtn urls={block.images} title={block.title} />
                  </div>
                )}
              </div>
            ))}
            {blocks.length === 0 && (
              <p className={certStyles.templateEmpty}>등록된 템플릿이 없습니다.</p>
            )}
            {isAdmin && <TemplateAddModal subTab={activeTab} onSaved={fetchBlocks} />}
          </>
        )}
      </div>
    </div>
  )
}

function TemplateAddModal({ subTab, onSaved }: { subTab: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<{ path: string; url: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = async (files: FileList) => {
    setUploading(true)
    const fileData = await Promise.all(Array.from(files).map(async f => ({
      name: f.name,
      type: f.type,
      data: Buffer.from(await f.arrayBuffer()).toString('base64'),
    })))
    const res = await fetch('/api/cert/templates/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: fileData }),
    })
    if (res.ok) {
      const uploaded: { path: string; url: string }[] = await res.json()
      setImages(prev => [...prev, ...uploaded])
    } else {
      const err = await res.json().catch(() => ({}))
      alert('이미지 업로드 실패: ' + (err.error ?? res.status))
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleRemoveImage = async (img: { path: string; url: string }) => {
    await fetch('/api/cert/templates/images', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: img.path }),
    })
    setImages(prev => prev.filter(i => i.path !== img.path))
  }

  const handleCancel = async () => {
    // 업로드된 이미지 정리
    for (const img of images) {
      await fetch('/api/cert/templates/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: img.path }),
      })
    }
    setOpen(false); setTitle(''); setContent(''); setImages([])
  }

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    const res = await fetch('/api/cert/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sub_tab: subTab, title, content, images: images.map(i => i.url) }),
    })
    setSaving(false)
    if (!res.ok) { alert('저장 실패'); return }
    setOpen(false)
    setTitle(''); setContent(''); setImages([])
    onSaved()
  }

  if (!open) return (
    <button type="button" className={certStyles.templateAddBtn} onClick={() => setOpen(true)}>
      + 템플릿 추가
    </button>
  )

  return (
    <div className={certStyles.templateForm}>
      <p className={certStyles.templateFormTitle}>새 템플릿 추가</p>
      <input placeholder="제목" value={title} onChange={e => setTitle(e.target.value)} className={`${styles.input} ${styles.inputFull}`} />
      <textarea placeholder="내용 (선택사항)" value={content} onChange={e => setContent(e.target.value)} rows={4} className={certStyles.templateFormTextarea} />
      <div className={certStyles.templateImageUploadRow}>
        {images.map((img, i) => (
          <div key={i} className={certStyles.templateImageThumb}>
            <img src={img.url} alt="" />
            <button type="button" className={certStyles.templateImageRemove} onClick={() => handleRemoveImage(img)}>✕</button>
          </div>
        ))}
        <button type="button" className={certStyles.templateImageUploadBtn} onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? '업로드 중...' : '+ 이미지'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => e.target.files && handleImageUpload(e.target.files)} />
      </div>
      <div className={certStyles.templateFormActions}>
        <button type="button" className={styles.btnSecondary} onClick={handleCancel}>취소</button>
        <button type="button" className={styles.btnPrimary} onClick={handleSave} disabled={saving || !title.trim()}>{saving ? '저장 중...' : '저장'}</button>
      </div>
    </div>
  )
}

function TemplateEditModal({ block, onSaved }: { block: TemplateBlock; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(block.title)
  const [content, setContent] = useState(block.content)
  const [images, setImages] = useState<{ path: string; url: string }[]>(
    block.images.map(url => ({ path: url.split('/cert-templates/')[1] ?? '', url }))
  )
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = async (files: FileList) => {
    setUploading(true)
    const fileData = await Promise.all(Array.from(files).map(async f => ({
      name: f.name,
      type: f.type,
      data: Buffer.from(await f.arrayBuffer()).toString('base64'),
    })))
    const res = await fetch('/api/cert/templates/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: fileData }),
    })
    if (res.ok) {
      const uploaded: { path: string; url: string }[] = await res.json()
      setImages(prev => [...prev, ...uploaded])
    } else {
      const err = await res.json().catch(() => ({}))
      alert('이미지 업로드 실패: ' + (err.error ?? res.status))
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleRemoveImage = async (img: { path: string; url: string }) => {
    await fetch('/api/cert/templates/images', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: img.path }),
    })
    setImages(prev => prev.filter(i => i.path !== img.path))
  }

  const handleSave = async () => {
    setSaving(true)
    const res = await fetch('/api/cert/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: block.id, title, content, images: images.map(i => i.url) }),
    })
    setSaving(false)
    if (!res.ok) { alert('저장 실패'); return }
    setOpen(false)
    onSaved()
  }

  if (!open) return (
    <button type="button" className={certStyles.templateEditBlockBtn} onClick={() => setOpen(true)}>수정</button>
  )

  return (
    <div className={certStyles.templateFormOverlay} onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
      <div className={certStyles.templateFormModal}>
        <p className={certStyles.templateFormTitle}>템플릿 수정</p>
        <input placeholder="제목" value={title} onChange={e => setTitle(e.target.value)} className={`${styles.input} ${styles.inputFull}`} />
        <textarea placeholder="내용" value={content} onChange={e => setContent(e.target.value)} rows={5} className={certStyles.templateFormTextarea} />
        <div className={certStyles.templateImageUploadRow}>
          {images.map((img, i) => (
            <div key={i} className={certStyles.templateImageThumb}>
              <img src={img.url} alt="" />
              <button type="button" className={certStyles.templateImageRemove} onClick={() => handleRemoveImage(img)}>✕</button>
            </div>
          ))}
          <button type="button" className={certStyles.templateImageUploadBtn} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? '업로드 중...' : '+ 이미지'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => e.target.files && handleImageUpload(e.target.files)} />
        </div>
        <div className={certStyles.templateFormActions}>
          <button type="button" className={styles.btnSecondary} onClick={() => setOpen(false)}>취소</button>
          <button type="button" className={styles.btnPrimary} onClick={handleSave} disabled={saving || !title.trim()}>{saving ? '저장 중...' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}

function CertStatsTab() {
  const [data, setData] = useState<CertStatsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<CertStatsSource>('all');
  const [subTab, setSubTab] = useState<CertStatsSubTab>('overview');

  // 소스 토글 슬라이딩 pill
  const srcRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const srcBarRef = useRef<HTMLDivElement>(null);
  const [srcPill, setSrcPill] = useState<{ left: number; width: number } | null>(null);

  // 데이터 fetch
  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      const items: CertStatsItem[] = [];

      // cert 신청 데이터 (학점연계/교육원)
      if (source === 'hakjeom' || source === 'edu' || source === 'all') {
        const sourceParam = source === 'all' ? '' : `&source_tab=${source}`;
        const res = await fetch(`/api/cert?${sourceParam}`);
        const certData = await res.json();
        if (Array.isArray(certData)) {
          certData.forEach((c: CertApplication) => {
            items.push({
              id: c.id,
              status: c.payment_status || 'pending',
              created_at: c.created_at,
              type: 'cert',
            });
          });
        }
      }

      // 민간자격증 데이터
      if (source === 'private-cert' || source === 'all') {
        const res = await fetch('/api/hakjeom/stats?type=private_cert');
        const pcData = await res.json();
        if (Array.isArray(pcData)) {
          pcData.forEach((c: { id: number; status: string; created_at: string }) => {
            items.push({
              id: c.id,
              status: c.status,
              created_at: c.created_at,
              type: 'private-cert',
            });
          });
        }
      }

      items.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setData(items);
      setLoading(false);
    };
    fetchData();
  }, [source]);

  // pill 위치 계산
  useEffect(() => {
    const idx = CERT_STATS_SOURCE_LABELS.findIndex(s => s.id === source);
    const el = srcRefs.current[idx];
    const bar = srcBarRef.current;
    if (!el || !bar) return;
    const barRect = bar.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setSrcPill({ left: elRect.left - barRect.left, width: elRect.width });
  }, [source, loading]);

  // ── 기준 날짜
  const now = certToKST(new Date().toISOString());
  const thisMonthKey = certYm(now);
  const prevM = new Date(now); prevM.setMonth(prevM.getMonth() - 1);
  const prevMonthKey = certYm(prevM);

  // ── 개요 집계
  const total = data.length;
  const thisMonth = data.filter(c => c.created_at.slice(0, 7) === thisMonthKey).length;
  const prevMonth = data.filter(c => c.created_at.slice(0, 7) === prevMonthKey).length;
  const growth = prevMonth > 0 ? Math.round(((thisMonth - prevMonth) / prevMonth) * 100) : null;
  const ago30 = new Date(now); ago30.setDate(ago30.getDate() - 29); ago30.setHours(0, 0, 0, 0);
  const recent30 = data.filter(c => new Date(c.created_at) >= ago30).length;

  // cert 타입별 카운트
  const certItems = data.filter(c => c.type === 'cert');
  const pcertItems = data.filter(c => c.type === 'private-cert');

  // cert 상태 집계
  const certStatusData = ['paid', 'pending', 'failed', 'cancelled'].map(s => ({
    name: CERT_PAYMENT_STATUS_LABELS[s] || s,
    value: certItems.filter(c => c.status === s).length,
    fill: CERT_PAYMENT_STATUS_COLORS[s] || '#94a3b8',
  })).filter(d => d.value > 0);

  // 민간자격증 상태 집계
  const pcertStatusData = (CONSULTATION_STATUS_OPTIONS as string[]).map(s => ({
    name: s,
    value: pcertItems.filter(c => c.status === s).length,
    fill: CERT_CONSULT_STATUS_COLORS[s] || '#94a3b8',
  })).filter(d => d.value > 0);

  // 현재 소스에 맞는 상태 데이터
  const isCertOnly = source === 'hakjeom' || source === 'edu';
  const isPcertOnly = source === 'private-cert';
  const statusData = isCertOnly ? certStatusData : isPcertOnly ? pcertStatusData : [...certStatusData, ...pcertStatusData];

  // 완료 건수 (결제완료 or 등록완료)
  const completed = isCertOnly
    ? certItems.filter(c => c.status === 'paid').length
    : isPcertOnly
    ? pcertItems.filter(c => c.status === '등록완료').length
    : certItems.filter(c => c.status === 'paid').length + pcertItems.filter(c => c.status === '등록완료').length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // 대기 건수
  const waiting = isCertOnly
    ? certItems.filter(c => c.status === 'pending').length
    : isPcertOnly
    ? pcertItems.filter(c => c.status === '상담대기').length
    : certItems.filter(c => c.status === 'pending').length + pcertItems.filter(c => c.status === '상담대기').length;

  // ── 월별 데이터
  const monthlyData = (() => {
    const sixAgo = new Date(now); sixAgo.setDate(1); sixAgo.setMonth(sixAgo.getMonth() - 5);
    const sixAgoYm = certYm(sixAgo);
    let startYm: string;
    if (data.length > 0) {
      const earliest = data.reduce((min, c) => c.created_at < min ? c.created_at : min, data[0].created_at);
      const earliestYm = earliest.slice(0, 7);
      startYm = earliestYm > sixAgoYm ? earliestYm : sixAgoYm;
    } else {
      startYm = thisMonthKey;
    }
    const months: { month: string; 신규: number; 완료: number }[] = [];
    const cur = new Date(startYm + '-01T00:00:00');
    while (certYm(cur) <= thisMonthKey) {
      const key = certYm(cur);
      const list = data.filter(c => c.created_at.slice(0, 7) === key);
      const done = list.filter(c => c.status === 'paid' || c.status === '등록완료').length;
      months.push({ month: key.slice(5) + '월', 신규: list.length, 완료: done });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  })();
  const monthlySub = monthlyData.length >= 6 ? '최근 6개월' : monthlyData.length > 1 ? `최근 ${monthlyData.length}개월` : '이번달';

  // ── 일별 30일
  const dailyData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (29 - i));
    const key = certYmd(d);
    return { date: key.slice(5), count: data.filter(c => c.created_at.slice(0, 10) === key).length };
  });

  // ── 시간대
  const hourData = Array.from({ length: 24 }, (_, h) => ({
    hour: String(h).padStart(2, '0'),
    count: data.filter(c => certToKST(c.created_at).getHours() === h).length,
  }));
  const peakCount = hourData.length > 0 ? Math.max(...hourData.map(d => d.count)) : 0;
  const peaks = hourData.filter(d => d.count === peakCount && peakCount > 0);

  // ── 요일별
  const weekData = WEEKDAY_KO.map((day, i) => ({
    day, count: data.filter(c => certToKST(c.created_at).getDay() === i).length,
  }));
  const maxWeekCount = weekData.length > 0 ? Math.max(...weekData.map(d => d.count)) : 0;

  return (
    <div className={styles.statsContainer}>
      {/* 소스 토글 */}
      <div className={styles.statsSourceToggleWrap}>
        <div ref={srcBarRef} className={styles.statsSourceBar}>
          {srcPill && (
            <div
              className={certStyles.srcPillBase}
              style={{ left: srcPill.left, width: srcPill.width }}
            />
          )}
          {CERT_STATS_SOURCE_LABELS.map((s, i) => (
            <button
              key={s.id}
              ref={el => { srcRefs.current[i] = el; }}
              onClick={() => setSource(s.id)}
              className={`${styles.statsSourceBtn} ${source === s.id ? certStyles.statsSourceBtnActive : certStyles.statsSourceBtnInactive}`}
            >{s.label}</button>
          ))}
        </div>
      </div>

      {/* 서브탭 */}
      <div className={styles.statsSubTabBar}>
        {CERT_STATS_SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`${styles.statsSubTabBtn} ${subTab === t.id ? certStyles.statsSubTabBtnActive : certStyles.statsSubTabBtnInactive}`}
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
                <CertStatsCard label="전체 신청" value={total.toLocaleString()} sub="누적 전체" />
                <CertStatsCard
                  label="이번달 신규" value={thisMonth} sub={`전월 ${prevMonth}건`}
                  badge={growth !== null ? `${growth >= 0 ? '+' : ''}${growth}%` : undefined}
                  badgeColor={growth !== null && growth >= 0 ? '#22c55e' : '#f04452'}
                />
                <CertStatsCard label="최근 30일" value={recent30} sub="오늘 포함 30일" color="#6366f1" />
                <CertStatsCard
                  label="완료" value={completed} sub={`전환율 ${completionRate}%`} color="#22c55e"
                  badge={`${completionRate}%`} badgeColor="#22c55e"
                />
                <CertStatsCard
                  label="대기중" value={waiting} sub="미처리 건수"
                  color={waiting > 20 ? '#f04452' : '#f59e0b'}
                />
              </div>

              <CertStatsPanel title="월별 신규 vs 완료" sub={monthlySub} style={{ marginBottom: 16 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={monthlyData} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<CertStatsTip />} />
                    <Bar dataKey="신규" fill="#93C5FD" radius={[4, 4, 0, 0]} barSize={28} name="신규" />
                    <Bar dataKey="완료" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={28} name="완료" />
                    <Line type="monotone" dataKey="신규" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 3 }} name="신규 추세" />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className={styles.statsLegend}>
                  {([['#93C5FD', '신규 신청'], ['#3B82F6', '완료'], ['#3B82F6', '신규 추세']] as [string, string][]).map(([c, l]) => (
                    <div key={l} className={styles.statsLegendItem}>
                      <div className={styles.statsLegendDot} style={{ background: c }} />{l}
                    </div>
                  ))}
                </div>
              </CertStatsPanel>

              <CertStatsPanel title="일별 신규 신청" sub="최근 30일">
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={dailyData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="certStatsGrad30" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={4} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<CertStatsTip />} />
                    <Area type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} fill="url(#certStatsGrad30)" dot={false} activeDot={{ r: 4, fill: '#3B82F6' }} name="신규" />
                  </AreaChart>
                </ResponsiveContainer>
              </CertStatsPanel>
            </div>
          )}

          {/* ════ 상태 분석 ════ */}
          {subTab === 'status' && (
            <div>
              <div className={styles.statsGrid5}>
                {statusData.map(d => (
                  <CertStatsCard
                    key={d.name} label={d.name} value={d.value}
                    sub={total > 0 ? `전체의 ${Math.round((d.value / total) * 100)}%` : '-'}
                    color={d.fill}
                  />
                ))}
              </div>

              <div className={styles.statsGridStatusDetail}>
                <CertStatsPanel title="상태 분포">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={52} outerRadius={84} paddingAngle={2} dataKey="value">
                        {statusData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip content={<CertStatsTip />} />
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
                </CertStatsPanel>

                <CertStatsPanel title="전환 퍼널" sub="신청 → 완료 흐름">
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
                    <div className={styles.funnelConversionTitle}>완료 전환율</div>
                    <div className={styles.funnelConversionRate}>{completionRate}%</div>
                    <div className={styles.funnelConversionSub}>전체 {total}건 중 {completed}건 완료</div>
                  </div>
                </CertStatsPanel>
              </div>
            </div>
          )}

          {/* ════ 시간 패턴 ════ */}
          {subTab === 'time' && (
            <div>
              <div className={styles.statsGrid3}>
                <CertStatsCard
                  label="피크 시간대"
                  value={peaks.length > 0 ? peaks.map(p => `${p.hour}시`).join(', ') : '-'}
                  sub={peakCount > 0 ? `${peakCount}건 접수` : '데이터 없음'}
                  color="#3b82f6"
                />
                <CertStatsCard
                  label="평일 평균"
                  value={Math.round(weekData.filter((_, i) => i >= 1 && i <= 5).reduce((a, b) => a + b.count, 0) / 5)}
                  sub="월~금 하루 평균"
                  color="#22c55e"
                />
                <CertStatsCard
                  label="주말 평균"
                  value={Math.round((weekData[0].count + weekData[6].count) / 2)}
                  sub="토·일 하루 평균"
                  color="#f59e0b"
                />
              </div>

              <div className={styles.statsGrid2}>
                <CertStatsPanel title="요일별 신청 건수">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={weekData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 13, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<CertStatsTip />} />
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
                </CertStatsPanel>

                <CertStatsPanel title="시간대별 신청 건수" sub="0시~23시 (KST)">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={hourData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={1} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<CertStatsTip />} />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]} barSize={13} name="건수">
                        {hourData.map((d, i) => (
                          <Cell key={i} fill={peaks.some(p => p.hour === d.hour) ? '#3b82f6' : '#dbeafe'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CertStatsPanel>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function CertPage() {
  const searchParams = useSearchParams()
  const urlTab = searchParams.get('tab') as SourceTab | null
  const urlHighlight = searchParams.get('highlight') ? Number(searchParams.get('highlight')) : undefined

  const [allowedCertTabs, setAllowedCertTabs] = useState<string[] | null>(null)
  const [tabsLoaded, setTabsLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(data => {
      if (data) {
        const isFullAccess = data.role === 'admin' || data.role === 'master-admin'
        if (!isFullAccess) {
          const certPerm = data.permissions?.find((p: { section: string; allowed_tabs?: string[] | null }) => p.section === 'cert')
          setAllowedCertTabs(certPerm?.allowed_tabs ?? null)
        }
      }
      setTabsLoaded(true)
    })
  }, [])

  const visibleTabs = allowedCertTabs
    ? SOURCE_TABS.filter(t => allowedCertTabs.includes(t.value))
    : SOURCE_TABS

  const [sourceTab, setSourceTab] = useState<SourceTab>('hakjeom')
  const [statsNode, setStatsNode] = useState<React.ReactNode>(null)

  useEffect(() => {
    if (!tabsLoaded) return
    const allowed = allowedCertTabs
    if (urlTab && SOURCE_TABS.some(t => t.value === urlTab) && (!allowed || allowed.includes(urlTab))) {
      setSourceTab(urlTab)
    } else if (allowed && allowed.length > 0) {
      setSourceTab(allowed[0] as SourceTab)
    }
  }, [tabsLoaded, allowedCertTabs, urlTab])

  const handleTabChange = (tab: SourceTab) => {
    setSourceTab(tab)
  }

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>민간자격증 사업부</h2>
          <p className={styles.pageSubTitle}>
            민간자격증 신청 및 상담 내역을 관리합니다.
          </p>
        </div>
        {statsNode}
      </div>

      {/* 탭 */}
      <div className={styles.tabNav}>
        {visibleTabs.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleTabChange(value)}
            className={sourceTab === value ? styles.tabBtnActive : styles.tabBtn}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      {(sourceTab === 'hakjeom' || sourceTab === 'edu') && <ApplicationTab sourceTab={sourceTab} highlightId={urlTab === sourceTab ? urlHighlight : undefined} />}
      {sourceTab === 'private-cert' && <PrivateCertTab setStatsNode={setStatsNode} highlightId={urlTab === 'private-cert' ? urlHighlight : undefined} />}
      {sourceTab === 'student-mgmt' && <StudentMgmtTab />}
      {sourceTab === 'student-bulk' && <StudentBulkUploadView onBack={() => setSourceTab('student-mgmt')} />}
      {sourceTab === 'counsel-template' && <CounselTemplateTab />}
      {sourceTab === 'stats' && <CertStatsTab />}
    </div>
  )
}
