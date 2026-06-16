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

export interface NavSubItem {
  id: string;
  label: string;
  href: string;
  sectionLabel?: string;
  /** user_permissions section 키 — 있으면 권한관리에 행으로 노출 */
  permissionKey?: string;
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
            id: "hakjeom-tab-hakjeom",
            label: "문의DB",
            href: "/hakjeom?tab=hakjeom",
          },
          {
            id: "hakjeom-tab-edu-students",
            label: "등록학생관리",
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
            id: "hakjeom-tab-agency",
            label: "기관협약",
            href: "/hakjeom?tab=agency",
          },
          {
            id: "hakjeom-tab-bulk",
            label: "일괄등록",
            href: "/hakjeom?tab=bulk",
          },
          {
            id: "hakjeom-tab-counsel_done",
            label: "연락예정",
            href: "/hakjeom?tab=counsel_done",
          },
          {
            id: "hakjeom-tab-stats",
            label: "통계",
            href: "/hakjeom?tab=stats",
          },
          {
            id: "allcare-tab-users",
            label: "올케어 회원목록",
            href: "/allcare?tab=users",
            permissionKey: "allcare",
          },
          {
            id: "allcare-tab-payments",
            label: "올케어 결제내역",
            href: "/allcare?tab=payments",
          },
          {
            id: "allcare-tab-stats",
            label: "올케어 통계",
            href: "/allcare?tab=stats",
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
            label: "학점연계 신청",
            href: "/cert?tab=hakjeom",
          },
          { id: "cert-tab-edu", label: "교육원", href: "/cert?tab=edu" },
          {
            id: "cert-tab-private-cert",
            label: "민간자격증",
            href: "/cert?tab=private-cert",
          },
          {
            id: "cert-sales-page",
            label: "매출파일",
            href: "/cert-sales",
            permissionKey: "cert-sales",
          },
          {
            id: "cert-tab-student-mgmt",
            label: "학생관리",
            href: "/cert?tab=student-mgmt",
          },
          {
            id: "cert-tab-student-contact",
            label: "연락예정",
            href: "/cert?tab=student-contact",
          },
          {
            id: "cert-tab-student-bulk",
            label: "일괄등록",
            href: "/cert?tab=student-bulk",
          },
          {
            id: "cert-tab-counsel-template",
            label: "상담 템플릿",
            href: "/cert?tab=counsel-template",
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
          "/approvals",
          "/reports",
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
            id: "management-bankaccount",
            label: "계좌조회",
            href: "/bankaccount",
            permissionKey: "bankaccount",
          },
          {
            id: "management-budget",
            label: "예산현황",
            href: "/budget",
            permissionKey: "budget",
          },
          {
            id: "management-approvals",
            label: "전자결재",
            href: "/approvals",
            permissionKey: "approvals",
          },
          {
            id: "management-reports",
            label: "손익 리포트",
            href: "/reports",
            permissionKey: "reports",
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
