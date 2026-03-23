'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  ResponsiveContainer, ComposedChart, BarChart, AreaChart, PieChart,
  Bar, Line, Area, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import styles from '../hakjeom/page.module.css'
import certStyles from './page.module.css'
import MemoTimeline from '@/components/ui/MemoTimeline'
import { TableSkeleton, StatsCardsSkeleton, ChartsGridSkeleton, FilterBarSkeleton } from '@/components/ui/Skeleton'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled'

// source 탭 구분: 'hakjeom' = 학점연계 신청, 'edu' = 교육원, 'private-cert' = 민간자격증
type SourceTab = 'hakjeom' | 'edu' | 'private-cert' | 'stats'

// 민간자격증 관련 타입
type ConsultationStatus = '상담대기' | '상담중' | '보류' | '등록대기' | '등록완료'

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

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

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
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = app.photo_url.split('/').pop() ?? 'photo'
    a.click()
    URL.revokeObjectURL(objectUrl)
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

function PrivateCertTab({ setStatsNode }: { setStatsNode: (node: React.ReactNode) => void }) {
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
                <button onClick={() => setSelectedIds([])} className={styles.btnSecondary}>선택 해제</button>
              </>
            )}
          </div>
          <div className={styles.actionBar}>
            <span className={styles.actionBarCount}>총 <strong className={styles.actionBarCountBold}>{filtered.length}</strong>건</span>
            <div className={styles.actionBarSpacer} />
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
                    <td className={styles.tdMemo} title={item.memo ?? ''} onClick={e => { e.stopPropagation(); setOpenTab('memo'); setSelectedItem(item); }} style={{ cursor: 'pointer' }}>
                      {item.memo_count ? `메모 ${item.memo_count}개` : (item.memo || '-')}
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

function ApplicationTab({ sourceTab }: { sourceTab: 'hakjeom' | 'edu' }) {
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
  const [sourceTab, setSourceTab] = useState<SourceTab>('hakjeom')
  const [statsNode, setStatsNode] = useState<React.ReactNode>(null)

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
        {SOURCE_TABS.map(({ value, label }) => (
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
      {(sourceTab === 'hakjeom' || sourceTab === 'edu') && <ApplicationTab sourceTab={sourceTab} />}
      {sourceTab === 'private-cert' && <PrivateCertTab setStatsNode={setStatsNode} />}
      {sourceTab === 'stats' && <CertStatsTab />}
    </div>
  )
}
