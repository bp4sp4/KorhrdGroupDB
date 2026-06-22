// ─────────────────────────────────────────────────────────────────────────────
// 사이드바 메뉴 + 권한관리 단일 소스 (Single Source of Truth)
//
// 여기에 메뉴를 추가하면 사이드바와 어드민 권한관리에 동시에 나타난다.
//  - permissionKey: user_permissions 의 section 키 — 권한관리에서 select 로 제어
//  - fixedNote:     권한 select 없이 고정 배지로 표시 (예: 관리자 전용, 전직원 공통)
//  - 둘 다 없는 항목(탭 링크 등)은 권한관리 목록에서 제외 (탭 제한 UI 에서 관리)
// ─────────────────────────────────────────────────────────────────────────────
import {
  GraduationCap,
  Users,
  UserCog,
  Trash2,
  ClipboardList,
  Copy,
  TrendingUp,
  FileCheck,
  Settings,
  UserCheck,
  Plane,
  Link2,
  Megaphone,
  LayoutGrid,
  FileText,
  CalendarDays,
  Clock,
  Mail,
} from "lucide-react";
import {
  IconHome,
  IconWorkspace,
  IconBoard,
  IconCalendar,
  IconMail,
  IconApproval,
  IconContract,
  IconLeave,
  IconAttendance,
  IconHr,
  IconWorkJournal,
  IconAssignment,
  IconProfit,
  IconAppraisal,
  IconDuplicate,
  IconTrash,
  IconLogs,
} from "./navIcons";

export interface NavSubItem {
  id: string;
  label: string;
  href: string;
  sectionLabel?: string;
  /** user_permissions section 키 — 있으면 권한관리에 행으로 노출 */
  permissionKey?: string;
  /** true 면 관리자(master-admin/admin/부서관리자)에게만 노출 */
  adminOnly?: boolean;
  /** true 면 마스터 어드민(master-admin)에게만 노출 */
  masterAdminOnly?: boolean;
  /** true 면 헤더 탭에서 숨김 (권한관리 레이아웃에는 유지) */
  headerHidden?: boolean;
  /** true 면 인라인 탭이 아니라 "더보기" 드롭다운 안에 고정 노출 */
  inMore?: boolean;
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  activeOn?: string[];
  exactMatch?: boolean;
  groupLabel?: string;
  children?: NavSubItem[];
  badge?: string;
  /** user_permissions section 키 — 있으면 권한관리에 행으로 노출 */
  permissionKey?: string;
  /** 권한 select 대신 고정 배지로 표시 (관리자 전용 등) */
  fixedNote?: string;
}

export interface NavSection {
  sectionKey: string;
  activeOn: string[];
  items: NavItem[];
}

export const ALL_SECTIONS: NavSection[] = [
  {
    sectionKey: "교육운영",
    activeOn: [
      "/hakjeom",
      "/cert",
      "/practice",
      "/allcare",
      "/abroad",
      "/revenues",
      "/revenue-upload",
      "/approvals",
      "/reports",
      "/bankaccount",
      "/budget",
      "/marketing",
      "/task-board",
      "/duplicate",
      "/trash",
      "/ref-manage",
      "/logs",
      "/assignment",
      "/links",
      "/board",
      "/me",
      "/appraisal",
    ],
    items: [
      {
        id: "education",
        label: "학점은행제 사업부",
        href: "/hakjeom",
        icon: <GraduationCap size={16} />,
        groupLabel: "사업부서",
        activeOn: ["/hakjeom", "/allcare"],
        permissionKey: "hakjeom",
        children: [
          {
            id: "hakjeom-tab-edu-students",
            label: "등록학생 관리",
            href: "/hakjeom?tab=edu-students",
            permissionKey: "edu-students",
          },
          {
            id: "edu-sales-page",
            label: "매출파일",
            href: "/edu-sales",
            permissionKey: "edu-sales",
          },
          {
            id: "hakjeom-tab-stats",
            label: "통계",
            href: "/hakjeom?tab=stats",
            adminOnly: true,
          },
          {
            id: "hakjeom-tab-hakjeom",
            label: "문의 DB",
            href: "/hakjeom?tab=hakjeom",
          },
          {
            id: "hakjeom-tab-bulk",
            label: "일괄등록",
            href: "/hakjeom?tab=bulk",
            adminOnly: true,
          },
          {
            id: "allcare-tab-users",
            label: "올케어",
            href: "/allcare",
            permissionKey: "allcare",
            adminOnly: true,
          },
          {
            id: "education-budget",
            label: "예산현황",
            href: "/budget?scope=hakjeom",
            permissionKey: "budget",
          },
        ],
      },
      {
        id: "cert",
        label: "민간자격증 사업부",
        href: "/cert",
        icon: <GraduationCap size={16} />,
        permissionKey: "cert",
        children: [
          {
            id: "cert-tab-hakjeom",
            label: "학점연계신청",
            href: "/cert?tab=hakjeom",
          },
          {
            id: "cert-tab-student-contact",
            label: "연락예정",
            href: "/cert?tab=student-contact",
          },
          {
            id: "cert-tab-student-mgmt",
            label: "수강생 관리",
            href: "/cert?tab=student-mgmt",
          },
          {
            id: "cert-sales-page",
            label: "매출파일",
            href: "/cert-sales",
            permissionKey: "cert-sales",
          },
          { id: "cert-tab-stats", label: "통계", href: "/cert?tab=stats" },
          {
            id: "cert-budget",
            label: "예산현황",
            href: "/budget?scope=cert",
            permissionKey: "budget",
          },
        ],
      },
      {
        id: "practice",
        label: "실습 사업부",
        href: "/practice-applicants",
        icon: <GraduationCap size={16} />,
        permissionKey: "practice",
        children: [
          {
            id: "practice-applicants-other",
            label: "타과정 실습",
            href: "/practice-applicants/other",
          },
          {
            id: "practice-applicants-social-worker",
            label: "사회복지사 실습",
            href: "/practice-applicants/social-worker",
          },
          {
            id: "practice-applicants-completed",
            label: "실습 완료 건",
            href: "/practice-applicants/completed",
          },
          {
            id: "practice-applicants-refunded",
            label: "실습 환불 건",
            href: "/practice-applicants/refunded",
          },
          {
            id: "practice-sales-page",
            label: "매출파일",
            href: "/practice-sales",
            permissionKey: "practice-sales",
          },
          {
            id: "practice-budget",
            label: "예산현황",
            href: "/budget?scope=practice",
            permissionKey: "budget",
          },
        ],
      },
      {
        id: "abroad",
        label: "유학 사업부",
        href: "/abroad",
        icon: <Plane size={16} />,
        permissionKey: "abroad",
        children: [
          {
            id: "abroad-tab-users",
            label: "회원 목록",
            href: "/abroad?tab=users",
          },
          {
            id: "abroad-tab-consult",
            label: "간편상담",
            href: "/abroad?tab=consult",
          },
          {
            id: "abroad-tab-applications",
            label: "신청서 목록",
            href: "/abroad?tab=applications",
          },
          {
            id: "abroad-tab-payments",
            label: "결제 목록",
            href: "/abroad?tab=payments",
          },
        ],
      },
      {
        id: "management",
        label: "경영지원본부",
        href: "/revenues/nms-sales",
        icon: <TrendingUp size={16} />,
        groupLabel: "지원부서",
        activeOn: [
          "/revenues",
          "/revenue-upload",
          "/bankaccount",
          "/budget",
          "/reports",
          "/admin/attendance",
          "/admin/leave-balances",
          "/admin/approval-forms",
          "/admin/hr-records",
          "/admin/contracts",
        ],
        children: [
          {
            id: "management-nms-sales",
            label: "팀별 매출 관리",
            href: "/revenues/nms-sales",
            permissionKey: "revenues",
          },
          {
            id: "management-revenue-upload",
            label: "매출 데이터 관리",
            href: "/revenue-upload",
            permissionKey: "revenue-upload",
          },
          {
            id: "management-reports",
            label: "손익 리포트",
            href: "/reports",
            permissionKey: "reports",
          },
          {
            id: "management-bankaccount",
            label: "계좌 조회",
            href: "/bankaccount",
            permissionKey: "bankaccount",
            masterAdminOnly: true,
          },
          {
            id: "management-attendance",
            label: "근태 관리",
            href: "/admin/attendance",
            masterAdminOnly: true,
          },
          {
            id: "management-leave-balances",
            label: "휴가 관리",
            href: "/admin/leave-balances",
            masterAdminOnly: true,
          },
          {
            id: "management-budget",
            label: "예산현황",
            href: "/budget",
            permissionKey: "budget",
            masterAdminOnly: true,
          },
          {
            id: "management-approval-forms",
            label: "결재양식 관리",
            href: "/admin/approval-forms",
            masterAdminOnly: true,
            inMore: true,
          },
          {
            id: "management-hr-records",
            label: "인사기록카드 관리",
            href: "/admin/hr-records",
            masterAdminOnly: true,
            inMore: true,
          },
          {
            id: "management-contracts",
            label: "근로계약서 관리",
            href: "/admin/contracts",
            masterAdminOnly: true,
            inMore: true,
          },
          {
            id: "management-approvals",
            label: "전자결재",
            href: "/approvals",
            permissionKey: "approvals",
            headerHidden: true,
          },
        ],
      },
      {
        id: "marketing",
        label: "마케팅개발본부",
        href: "/marketing",
        icon: <Megaphone size={16} />,
        permissionKey: "marketing",
        children: [
          {
            id: "marketing-nms-channel",
            label: "채널별 성과",
            href: "/marketing?tab=nms-channel",
            sectionLabel: "학점은행제",
          },
          {
            id: "marketing-nms-creative",
            label: "소재별 성과",
            href: "/marketing?tab=nms-creative",
          },
          {
            id: "marketing-nms-dashboard",
            label: "대시보드",
            href: "/marketing?tab=nms-dashboard",
          },
          {
            id: "marketing-cert-channel",
            label: "채널별 성과",
            href: "/marketing?tab=cert-channel",
            sectionLabel: "민간자격증",
          },
          {
            id: "marketing-cert-creative",
            label: "소재별 성과",
            href: "/marketing?tab=cert-creative",
          },
          {
            id: "marketing-cert-dashboard",
            label: "대시보드",
            href: "/marketing?tab=cert-dashboard",
          },
          {
            id: "marketing-abroad-channel",
            label: "채널별 성과",
            href: "/marketing?tab=abroad-channel",
            sectionLabel: "유학",
          },
          {
            id: "marketing-abroad-creative",
            label: "소재별 성과",
            href: "/marketing?tab=abroad-creative",
          },
          {
            id: "marketing-abroad-dashboard",
            label: "대시보드",
            href: "/marketing?tab=abroad-dashboard",
          },
          {
            id: "marketing-mom-cafe",
            label: "맘카페 관리",
            href: "/marketing?tab=mom-cafe",
            sectionLabel: "맘카페",
          },
          {
            id: "marketing-budget",
            label: "예산현황",
            href: "/budget?scope=dev",
            permissionKey: "budget",
          },
        ],
      },
      {
        id: "task-board",
        label: "통합 업무보드",
        href: "/task-board",
        icon: <LayoutGrid size={16} />,
        groupLabel: "시스템",
        permissionKey: "task-board",
      },
      {
        id: "calendar",
        label: "개인 캘린더",
        href: "/calendar",
        icon: <CalendarDays size={16} />,
        permissionKey: "calendar",
      },
      {
        id: "me-hr-record",
        label: "인사기록카드",
        href: "/me/hr-record",
        icon: <FileText size={16} />,
        fixedNote: "전직원 공통",
      },
      {
        id: "me-contracts",
        label: "내 근로계약서",
        href: "/me/contracts",
        icon: <FileText size={16} />,
        permissionKey: "me-contracts",
      },
      {
        id: "appraisal",
        label: "인사고과표",
        href: "/appraisal",
        icon: <ClipboardList size={16} />,
        permissionKey: "appraisal",
      },
      {
        id: "mail-settings",
        label: "메일 설정",
        href: "/me/mail-settings",
        icon: <Mail size={16} />,
        fixedNote: "전직원 공통",
      },
      {
        id: "duplicate",
        label: "중복 조회",
        href: "/duplicate",
        icon: <Copy size={16} />,
        permissionKey: "duplicate",
      },
      {
        id: "trash",
        label: "삭제목록",
        href: "/trash",
        icon: <Trash2 size={16} />,
        permissionKey: "trash",
      },
      {
        id: "ref-manage",
        label: "어드민 관리",
        href: "/ref-manage",
        icon: <UserCog size={16} />,
        permissionKey: "ref-manage",
      },
      {
        id: "logs",
        label: "로그 관리",
        href: "/logs",
        icon: <ClipboardList size={16} />,
        permissionKey: "logs",
      },
      {
        id: "assignment",
        label: "배정 현황",
        href: "/assignment",
        icon: <UserCheck size={16} />,
        permissionKey: "assignment",
      },
      {
        id: "links",
        label: "링크모음",
        href: "/links",
        icon: <Link2 size={16} />,
        permissionKey: "links",
      },
    ],
  },
  {
    sectionKey: "어드민",
    activeOn: ["/admin"],
    items: [
      {
        id: "admin-settings",
        label: "시스템 설정",
        href: "/admin",
        icon: <Settings size={16} />,
        groupLabel: "관리자",
        exactMatch: true,
        fixedNote: "마스터 관리자 전용",
      },
      {
        id: "admin-approval-forms",
        label: "결재 양식 관리",
        href: "/admin/approval-forms",
        icon: <FileCheck size={16} />,
        fixedNote: "마스터 관리자 전용",
      },
      {
        id: "admin-attendance",
        label: "근태현황",
        href: "/admin/attendance",
        icon: <Clock size={16} />,
        fixedNote: "마스터 관리자 전용",
      },
      {
        id: "admin-hr-records",
        label: "인사기록카드 승인",
        href: "/admin/hr-records",
        icon: <FileText size={16} />,
        fixedNote: "마스터 관리자 전용",
      },
      {
        id: "admin-leave-balances",
        label: "휴가 잔여 관리",
        href: "/admin/leave-balances",
        icon: <FileText size={16} />,
        fixedNote: "마스터 관리자 전용",
      },
      {
        id: "admin-contracts",
        label: "근로계약서 관리",
        href: "/admin/contracts",
        icon: <FileText size={16} />,
        fixedNote: "마스터 관리자 전용",
      },
    ],
  },
];

export const MINI_ADMIN_ITEMS: NavItem[] = [
  {
    id: "mini-admin",
    label: "결제확인",
    href: "/paymentstatus",
    icon: <Users size={16} />,
  },
];

// 관리자 전용 도구 — master-admin / admin / division_admin 에게 모든 섹션에서 영구 노출
export const ADMIN_TOOLS_ITEMS: NavItem[] = [
  {
    id: "wj-admin",
    label: "직원 업무일지 현황",
    href: "/work-journal/admin",
    icon: <FileText size={16} />,
    groupLabel: "관리 도구",
    permissionKey: "wj-admin",
  },
  {
    id: "profit",
    label: "영업 손익관리",
    href: "/profit",
    icon: <TrendingUp size={16} />,
    permissionKey: "profit",
  },
  {
    id: "appraisal-admin",
    label: "인사고과표",
    href: "/appraisal",
    icon: <ClipboardList size={16} />,
    permissionKey: "appraisal",
  },
];

// 개인 도구 — 모든 사용자(미니어드민 제외)에게 노출. API가 본인 데이터만 반환하므로 각자 자기 것만 본다.
export const PERSONAL_TOOLS_ITEMS: NavItem[] = [
  {
    id: "me-leave",
    label: "휴가현황",
    href: "/me/leave",
    icon: <FileText size={16} />,
    groupLabel: "내 메뉴",
    permissionKey: "me-leave",
  },
  {
    id: "me-attendance",
    label: "근태현황",
    href: "/me/attendance",
    icon: <Clock size={16} />,
    permissionKey: "me-attendance",
  },
  {
    id: "me-appraisal",
    label: "내 인사고과",
    href: "/me/appraisal",
    icon: <ClipboardList size={16} />,
    permissionKey: "me-appraisal",
  },
];

export const SECTION_ITEM_MAP: Record<string, string> = {
  hakjeom: "education",
  "edu-sales": "education",
  cert: "cert",
  "cert-sales": "cert",
  practice: "practice",
  "practice-sales": "practice",
  abroad: "abroad",
  allcare: "education",
  revenues: "management",
  "revenue-upload": "management",
  bankaccount: "management",
  budget: "management",
  approvals: "management",
  reports: "management",
  marketing: "marketing",
  duplicate: "duplicate",
  trash: "trash",
  logs: "logs",
  "ref-manage": "ref-manage",
  assignment: "assignment",
  links: "links",
  "task-board": "task-board",
  "me-leave": "me-leave",
  calendar: "calendar",
  "me-contracts": "me-contracts",
  appraisal: "appraisal",
};

// ─── 권한관리 화면용 레이아웃 (사이드바 구조 그대로) ─────────────────────────

export interface PermissionLayoutEntry {
  /** user_permissions section 키 (fixed 항목은 없음) */
  sectionKey?: string;
  label: string;
  /** 고정 배지 텍스트 (권한 select 미노출) */
  fixedNote?: string;
  /** 상위 메뉴 라벨 (자식 항목인 경우) */
  parentLabel?: string;
}

export interface PermissionLayoutGroup {
  group: string;
  entries: PermissionLayoutEntry[];
}

/**
 * 사이드바 메뉴 정의에서 권한관리 화면 구조를 생성한다.
 * 그룹 순서: 관리 도구 → 내 메뉴 → 사업부서 → 지원부서 → 시스템 → 관리자
 * (permissionKey/fixedNote 없는 항목 = 탭 링크 → 탭 제한 UI 에서 관리하므로 제외)
 */
export function buildPermissionLayout(): PermissionLayoutGroup[] {
  const groups: PermissionLayoutGroup[] = [];
  const seenKeys = new Set<string>();

  const pushEntry = (
    group: PermissionLayoutGroup,
    entry: PermissionLayoutEntry,
  ) => {
    if (entry.sectionKey) {
      if (seenKeys.has(entry.sectionKey)) return;
      seenKeys.add(entry.sectionKey);
    }
    group.entries.push(entry);
  };

  const walkItems = (items: NavItem[], defaultGroupLabel: string) => {
    let current: PermissionLayoutGroup | null = null;
    for (const item of items) {
      const groupLabel: string =
        item.groupLabel ?? (current ? current.group : defaultGroupLabel);
      if (!current || current.group !== groupLabel) {
        current = groups.find((g) => g.group === groupLabel) ?? null;
        if (!current) {
          current = { group: groupLabel, entries: [] };
          groups.push(current);
        }
      }
      if (item.permissionKey) {
        pushEntry(current, { sectionKey: item.permissionKey, label: item.label });
      } else if (item.fixedNote) {
        pushEntry(current, { label: item.label, fixedNote: item.fixedNote });
      }
      for (const child of item.children ?? []) {
        if (child.permissionKey) {
          pushEntry(current, {
            sectionKey: child.permissionKey,
            label: child.label,
            parentLabel: item.label,
          });
        }
      }
    }
  };

  walkItems(ADMIN_TOOLS_ITEMS, "관리 도구");
  walkItems(PERSONAL_TOOLS_ITEMS, "내 메뉴");
  for (const section of ALL_SECTIONS) {
    walkItems(section.items, section.sectionKey === "어드민" ? "관리자" : "사업부서");
  }
  return groups;
}

// ═══════════════════════════════════════════════════════════════════════════
// 개편: 사이드바 = 전역 개인/관리 메뉴, 헤더 = 사업부 드롭다운 + 탭
// ═══════════════════════════════════════════════════════════════════════════

/** 좌측 전역 사이드바에 표시되는 단일 메뉴 항목 */
export interface GlobalNavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  /** 활성 판정용 경로 (없으면 href 베이스 startsWith) */
  activeOn?: string[];
  exactMatch?: boolean;
  /** user_permissions section 키 — 비관리자는 scope!=='none' 일 때만 노출 */
  permissionKey?: string;
  /** 개인별 숨김 키 (hiddenMenus) */
  hideKey?: string;
  /** master-admin 전용 */
  adminOnly?: boolean;
  /** 관리자/부서관리자만 (wj-admin 등) */
  requiresDivisionAdmin?: boolean;
}

// 개인메뉴 — 모든 사용자 공통 (미니어드민 제외). 권한/숨김 키로 개별 게이트.
export const SIDEBAR_PERSONAL: GlobalNavItem[] = [
  { id: "home", label: "홈", href: "/dashboard", icon: <IconHome />, hideKey: "dashboard" },
  { id: "work-journal", label: "워크스페이스", href: "/work-journal", icon: <IconWorkspace />, exactMatch: true, hideKey: "work-journal" },
  { id: "board", label: "게시판", href: "/board", icon: <IconBoard />, hideKey: "board" },
  { id: "calendar", label: "캘린더", href: "/calendar", icon: <IconCalendar />, permissionKey: "calendar", hideKey: "calendar" },
  { id: "mail", label: "메일", href: "/mail", icon: <IconMail />, hideKey: "mail" },
  { id: "approvals", label: "전자결재", href: "/approvals", icon: <IconApproval />, permissionKey: "approvals" },
  { id: "e-contract", label: "전자계약", href: "/me/contracts", icon: <IconContract />, permissionKey: "me-contracts" },
  { id: "me-leave", label: "휴가", href: "/me/leave", icon: <IconLeave />, permissionKey: "me-leave" },
  { id: "me-attendance", label: "근태", href: "/me/attendance", icon: <IconAttendance />, permissionKey: "me-attendance" },
  { id: "me-hr-record", label: "인사", href: "/me/hr-record", icon: <IconHr />, hideKey: "hr-record" },
  { id: "me-appraisal", label: "내 인사고과", href: "/me/appraisal", icon: <IconAppraisal />, permissionKey: "me-appraisal" },
];

// 관리자메뉴 — 권한별 개별 게이트 (해당 권한 보유자 또는 관리자에게만)
export const SIDEBAR_ADMIN: GlobalNavItem[] = [
  { id: "wj-admin", label: "직원 업무일지 현황", href: "/work-journal/admin", icon: <IconWorkJournal />, permissionKey: "wj-admin", requiresDivisionAdmin: true },
  { id: "assignment", label: "배정 현황", href: "/assignment", icon: <IconAssignment />, permissionKey: "assignment" },
  { id: "profit", label: "영업 손익관리", href: "/profit", icon: <IconProfit />, permissionKey: "profit" },
  { id: "appraisal", label: "인사 고과", href: "/appraisal", icon: <IconAppraisal />, permissionKey: "appraisal" },
  { id: "duplicate", label: "중복 조회", href: "/duplicate", icon: <IconDuplicate />, permissionKey: "duplicate" },
  { id: "trash", label: "삭제 목록", href: "/trash", icon: <IconTrash />, permissionKey: "trash" },
  { id: "logs", label: "로그 관리", href: "/logs", icon: <IconLogs />, permissionKey: "logs" },
];

// 하단 고정 — 시스템 설정 (master-admin 전용)
export const SIDEBAR_SYSTEM: GlobalNavItem[] = [
  { id: "admin", label: "시스템 설정", href: "/admin", icon: <Settings size={16} />, exactMatch: true, adminOnly: true },
];

// ─── 헤더: 사업부 드롭다운 + 탭 ─────────────────────────────────────────────

export interface NavFilterContext {
  userRole?: string | null;
  permissions: { section: string; scope: string; allowed_tabs?: string[] | null }[];
  revenueOwnDivisions: ("nms" | "cert" | "abroad")[];
  departmentCode: string | null;
  /** 부서 관리자 (is_division_admin) — "관리자" 전용 탭(adminOnly) 노출 대상 */
  isDivisionAdmin?: boolean;
  /** 본부장 (departments.head_user_id) — 예산현황 노출 대상 */
  isDeptHead?: boolean;
}

// 임시 숨김 사업부 (유학 — 미오픈)
const TEMP_HIDDEN_DIVISION_IDS = new Set<string>(["abroad"]);
// 임시 숨김 하위 탭 (마케팅 안 민간자격증·유학 섹션 — 학점은행제·맘카페만)
const TEMP_HIDDEN_CHILD_IDS = new Set<string>([
  "marketing-cert-channel",
  "marketing-cert-creative",
  "marketing-cert-dashboard",
  "marketing-abroad-channel",
  "marketing-abroad-creative",
  "marketing-abroad-dashboard",
]);

/** itemId → 자식 탭 필터에 적용할 sectionKey */
const ITEM_ID_TO_SECTION: Record<string, string> = {
  education: "hakjeom",
  cert: "cert",
  abroad: "abroad",
};

/** 경영지원본부(management) 자식 menu id → section 매핑 */
const MANAGEMENT_CHILD_SECTION: Record<string, string> = {
  "management-nms-sales": "revenues",
  "management-revenue-upload": "revenue-upload",
  "management-bankaccount": "bankaccount",
  "management-budget": "budget",
  "management-approvals": "approvals",
  "management-reports": "reports",
};

/** 권한 시스템에 등록된 탭 ID — 목록에 없는 탭은 새 탭으로 간주해 자동 허용 */
const MANAGED_TAB_IDS: Record<string, Set<string>> = {
  hakjeom: new Set([
    "hakjeom-tab-hakjeom",
    "hakjeom-tab-edu-students",
    "hakjeom-tab-agency",
    "hakjeom-tab-bulk",
    "hakjeom-tab-counsel_done",
    "hakjeom-tab-stats",
    "allcare-tab-users",
    "allcare-tab-payments",
    "allcare-tab-stats",
  ]),
  cert: new Set([
    "cert-tab-hakjeom",
    "cert-tab-edu",
    "cert-tab-private-cert",
    "cert-tab-student-mgmt",
    "cert-tab-student-contact",
    "cert-tab-student-bulk",
    "cert-tab-counsel-template",
    "cert-tab-stats",
  ]),
  abroad: new Set([
    "abroad-tab-users",
    "abroad-tab-consult",
    "abroad-tab-applications",
    "abroad-tab-payments",
  ]),
};

/**
 * 권한에 따라 헤더에 노출할 사업부(드롭다운/탭) 목록을 만든다.
 * 기존 사이드바 아코디언 필터 로직을 그대로 옮긴 것.
 * 반환: children 이 1개 이상 남은 사업부 NavItem 배열
 */
export function getVisibleDivisions(ctx: NavFilterContext): NavItem[] {
  const { userRole, permissions, departmentCode, isDivisionAdmin, isDeptHead } = ctx;
  const isFullAccess = userRole === "master-admin" || userRole === "admin";
  // adminOnly 탭 노출 대상 = 마스터 어드민 + 부서 관리자(관리자)
  const canSeeAdminTabs = isFullAccess || !!isDivisionAdmin;
  const allowedSections = new Set(
    permissions.filter((p) => p.scope && p.scope !== "none").map((p) => p.section),
  );

  const allowedTabsBySection = new Map<string, Set<string> | null>();
  // allowed_tabs 로 "명시적으로" 부여된 탭 id 모음 — adminOnly 탭이라도 이 목록에 있으면 노출
  const explicitlyAllowedTabs = new Set<string>();
  for (const p of permissions) {
    if (p.allowed_tabs && Array.isArray(p.allowed_tabs)) {
      allowedTabsBySection.set(p.section, new Set(p.allowed_tabs));
      for (const t of p.allowed_tabs) explicitlyAllowedTabs.add(t);
    } else {
      allowedTabsBySection.set(p.section, null);
    }
  }

  // 사업부 = children 을 가진 항목 (education/cert/practice/abroad/management/marketing)
  const divisions = ALL_SECTIONS[0].items.filter((item) => !!item.children);

  const baseItems = isFullAccess
    ? divisions
    : divisions.filter((item) => {
        const matchingSections = Object.entries(SECTION_ITEM_MAP)
          .filter(([, id]) => id === item.id)
          .map(([sec]) => sec);
        if (matchingSections.length === 0) return true;
        if (item.id === "management") {
          const hasOther = matchingSections.some(
            (sec) => sec !== "budget" && allowedSections.has(sec),
          );
          const budgetGate =
            allowedSections.has("budget") && departmentCode === "MGT";
          return hasOther || budgetGate;
        }
        return matchingSections.some((sec) => allowedSections.has(sec));
      });

  return baseItems
    .map((item) => {
      if (!item.children) return item;

      // (0) 경영지원본부 — 자식별 section 권한 필터
      if (item.id === "management" && !isFullAccess) {
        const filteredChildren = item.children.filter((child) => {
          if (child.id === "management-budget") return departmentCode === "MGT";
          const sec = MANAGEMENT_CHILD_SECTION[child.id];
          if (!sec) return true;
          return allowedSections.has(sec);
        });
        return { ...item, children: filteredChildren };
      }

      if (isFullAccess) return item;

      const sectionForTabs = ITEM_ID_TO_SECTION[item.id];
      if (!sectionForTabs) return item;

      const allowed = allowedTabsBySection.get(sectionForTabs);
      const managedSet = MANAGED_TAB_IDS[sectionForTabs];

      const isEducationItem = item.id === "education";
      const eduSalesAllowed = allowedSections.has("edu-sales");
      const isCertItem = item.id === "cert";
      const certSalesAllowed = allowedSections.has("cert-sales");
      const isPracticeItem = item.id === "practice";
      const practiceSalesAllowed = allowedSections.has("practice-sales");

      const filteredChildren = item.children.filter((child) => {
        if (isEducationItem && child.id === "edu-sales-page") return eduSalesAllowed;
        if (isCertItem && child.id === "cert-sales-page") return certSalesAllowed;
        if (isPracticeItem && child.id === "practice-sales-page")
          return practiceSalesAllowed;
        if (allowed === undefined || allowed === null) return true;
        return allowed.has(child.id) || !managedSet?.has(child.id);
      });
      return { ...item, children: filteredChildren };
    })
    // 예산현황 하위 — 본부장(또는 마스터/관리자)에게만 노출
    .map((item) => {
      if (!item.children || isFullAccess) return item;
      const kids = item.children.filter(
        (c) => c.permissionKey !== "budget" || isDeptHead,
      );
      return { ...item, children: kids };
    })
    // 관리자 전용 탭 — 마스터 어드민/부서 관리자, 또는 allowed_tabs로 명시 부여된 경우만 노출
    .map((item) => {
      if (!item.children || canSeeAdminTabs) return item;
      return {
        ...item,
        children: item.children.filter(
          (c) => !c.adminOnly || explicitlyAllowedTabs.has(c.id),
        ),
      };
    })
    // 마스터 어드민 전용 탭 — master-admin 외에겐 숨김
    .map((item) => {
      if (!item.children || userRole === "master-admin") return item;
      return {
        ...item,
        children: item.children.filter((c) => !c.masterAdminOnly),
      };
    })
    // 헤더에서 숨기는 탭 (권한관리 레이아웃 유지용) — 항상 제거
    .map((item) => {
      if (!item.children) return item;
      return {
        ...item,
        children: item.children.filter((c) => !c.headerHidden),
      };
    })
    // 임시 숨김 하위 탭
    .map((item) => {
      if (!item.children) return item;
      return {
        ...item,
        children: item.children.filter((c) => !TEMP_HIDDEN_CHILD_IDS.has(c.id)),
      };
    })
    .filter((item) => {
      if (TEMP_HIDDEN_DIVISION_IDS.has(item.id)) return false;
      return !!item.children && item.children.length > 0;
    });
}
