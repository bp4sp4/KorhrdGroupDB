"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import styles from "./layout.module.css";
import { createClient } from "@/lib/supabase/client";
import {
  ALL_SECTIONS,
  ADMIN_TOOLS_ITEMS,
  MINI_ADMIN_ITEMS,
  PERSONAL_TOOLS_ITEMS,
  SECTION_ITEM_MAP,
  type NavItem,
  type NavSubItem,
} from "./navConfig";


interface SidebarProps {
  userRole?: string | null;
  permissions?: {
    section: string;
    scope: string;
    allowed_tabs?: string[] | null;
  }[];
  revenueOwnDivisions?: ("nms" | "cert" | "abroad")[];
  // 사용자가 부서 관리자(is_division_admin) 인 경우 work-journal admin 메뉴 노출
  isDivisionAdmin?: boolean;
  hiddenMenus?: string[];
  isOpen?: boolean;
  onClose?: () => void;
}

// 사이드바 메뉴 id → 개인별 숨김 키
const SIDEBAR_HIDE_KEY: Record<string, string> = {
  calendar: "calendar",
  "me-attendance": "attendance",
  "me-hr-record": "hr-record",
  "mail-settings": "mail-settings",
  board: "board",
  mail: "mail",
};

// 임시 숨김 메뉴 (잠깐 가려두기) — 복구하려면 배열을 비우면 됨.
// 유학 사업부 (마케팅개발본부는 학점은행제 때문에 노출 유지)
// 인사고과표 — 오픈 전까지 숨김 (/appraisal 직접 접근은 가능)
const TEMP_HIDDEN_MENU_IDS = new Set<string>(["abroad", "appraisal"]);

// 임시 숨김 하위 메뉴 — 마케팅개발본부 안의 민간자격증·유학 섹션 (학점은행제·맘카페만 남김)
// management-budget(예산현황): 작업 중이라 사이드바에서 임시 숨김 (페이지/API 는 유효)
const TEMP_HIDDEN_CHILD_IDS = new Set<string>([
  "marketing-cert-channel",
  "marketing-cert-creative",
  "marketing-cert-dashboard",
  "marketing-abroad-channel",
  "marketing-abroad-creative",
  "marketing-abroad-dashboard",
  "management-budget",
]);

export default function Sidebar({
  userRole,
  permissions = [],
  revenueOwnDivisions = [],
  isDivisionAdmin = false,
  hiddenMenus = [],
  isOpen,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [trashCount, setTrashCount] = useState<number>(0);
  const [counselCount, setCounselCount] = useState<number>(0);
  const [certCounselCount, setCertCounselCount] = useState<number>(0);
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  const toggleItem = (id: string) => {
    setOpenItems((prev) => (prev.has(id) ? new Set() : new Set([id])));
  };

  useEffect(() => {
    if (userRole === "mini-admin") return;

    const fetchHakjeomCount = () => {
      fetch("/api/hakjeom/counsel-count")
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .then((data: { count: number }) => setCounselCount(data.count ?? 0))
        .catch(() => {});
    };

    const fetchCertCount = () => {
      fetch("/api/cert/students/counsel-count")
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .then((data: { count: number }) => setCertCounselCount(data.count ?? 0))
        .catch(() => {});
    };

    fetchHakjeomCount();
    fetchCertCount();

    // Realtime 이벤트 디바운스 — 변경이 몰릴 때 접속자 전원이 동시에 재조회하는
    // 폭풍을 막아 서버 호출(Fast Origin Transfer)을 줄인다.
    let hakjeomTimer: ReturnType<typeof setTimeout> | null = null;
    let certTimer: ReturnType<typeof setTimeout> | null = null;

    const supabase = createClient();
    const channel = supabase.channel("sidebar-counsel-count");
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "hakjeom_consultations" },
      () => {
        if (hakjeomTimer) clearTimeout(hakjeomTimer);
        // 30초 트레일링 디바운스 — 상담 수정이 잦은 시간대에도 탭당 분당 최대 2회로 제한
        hakjeomTimer = setTimeout(fetchHakjeomCount, 30000);
      },
    );
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cert_students" },
      () => {
        if (certTimer) clearTimeout(certTimer);
        certTimer = setTimeout(fetchCertCount, 30000);
      },
    );
    channel.subscribe();

    return () => {
      if (hakjeomTimer) clearTimeout(hakjeomTimer);
      if (certTimer) clearTimeout(certTimer);
      supabase.removeChannel(channel);
    };
  }, [userRole]);

  useEffect(() => {
    if (userRole === "mini-admin") return;

    const fetchCount = () => {
      // 개수만 요청 (전체 데이터 X) — Fast Data Transfer 절감
      fetch("/api/trash?countOnly=1")
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .then((data: { count?: number }) =>
          setTrashCount(typeof data?.count === "number" ? data.count : 0),
        )
        .catch(() => {});
    };

    // 초기 1회 조회 후에는 Realtime 변경 이벤트로만 갱신 (5초 폴링 제거)
    fetchCount();

    // 4개 테이블 변경이 몰릴 때 재조회를 1번으로 합침 (Fast Origin Transfer 절감)
    let trashTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleFetch = () => {
      if (trashTimer) clearTimeout(trashTimer);
      trashTimer = setTimeout(fetchCount, 30000);
    };

    const supabase = createClient();
    const tables = [
      "hakjeom_consultations",
      "private_cert_consultations",
      "certificate_applications",
      "agency_agreements",
    ];
    const channel = supabase.channel("sidebar-trash-count");
    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleFetch,
      );
    });
    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (trashTimer) clearTimeout(trashTimer);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [userRole]);

  const activeSection = ALL_SECTIONS.find((sec) =>
    sec.activeOn.some((p) => pathname.startsWith(p)),
  );
  const isFullAccess = userRole === "master-admin" || userRole === "admin";
  const allowedSections = new Set(
    permissions
      .filter((p) => p.scope && p.scope !== "none")
      .map((p) => p.section),
  );
  const revenueScope =
    permissions.find((p) => p.section === "revenues")?.scope ?? "none";

  const rawItems =
    userRole === "mini-admin"
      ? MINI_ADMIN_ITEMS
      : (activeSection?.items ?? ALL_SECTIONS[0].items);

  const baseItems = isFullAccess
    ? rawItems
    : rawItems.filter((item) => {
        // 같은 item.id에 여러 section이 매핑될 수 있음 (예: management = revenues+approvals+reports+...)
        // 그 중 하나라도 허용된 section이 있으면 부모 메뉴를 보여줌
        const matchingSections = Object.entries(SECTION_ITEM_MAP)
          .filter(([, id]) => id === item.id)
          .map(([sec]) => sec);
        if (matchingSections.length === 0) return true;
        return matchingSections.some((sec) => allowedSections.has(sec));
      });

  // section -> 해당 section item 의 children 에 적용할 allowed_tabs (NavSubItem.id 기준)
  // NOTE: education 아이템에는 hakjeom 권한의 allowed_tabs 가 적용됨
  //       (allcare-tab-* 자식들은 권한 매핑상 'allcare' section 이지만, education 자식 풀에서 hakjeom 권한 기준으로 함께 필터)
  const allowedTabsBySection = new Map<string, Set<string> | null>();
  for (const p of permissions) {
    if (p.allowed_tabs && Array.isArray(p.allowed_tabs)) {
      allowedTabsBySection.set(p.section, new Set(p.allowed_tabs));
    } else {
      allowedTabsBySection.set(p.section, null); // null = 전체 허용
    }
  }

  /** itemId(NavItem.id) → 해당 item 의 자식 필터에 적용할 sectionKey */
  const itemIdToSection: Record<string, string> = {
    education: "hakjeom",
    cert: "cert",
    abroad: "abroad",
  };

  /** 경영지원본부(management) 자식 menu id → section 매핑 */
  const managementChildSection: Record<string, string> = {
    "management-nms-sales": "revenues",
    "management-revenue-upload": "revenue-upload",
    "management-bankaccount": "bankaccount",
    "management-budget": "budget",
    "management-approvals": "approvals",
    "management-reports": "reports",
  };

  const currentItems = baseItems
    .map((item) => {
      if (!item.children) return item;

      // (0) 경영지원본부 — 자식별 section 권한에 따라 필터
      if (item.id === "management" && !isFullAccess) {
        const filteredChildren = item.children.filter((child) => {
          const sec = managementChildSection[child.id];
          if (!sec) return true;
          return allowedSections.has(sec);
        });
        return { ...item, children: filteredChildren };
      }

      // (1) 매출 관리 — 기존 own scope 분기 유지
      if (item.id === "nms-sales") {
        if (isFullAccess || revenueScope !== "own") return item;
        const allowedRevenueTabs = new Set(
          revenueOwnDivisions.length > 1
            ? [
                "nms-sales-tab-stats",
                ...revenueOwnDivisions.map(
                  (division) => `nms-sales-tab-${division}`,
                ),
              ]
            : revenueOwnDivisions.map(
                (division) => `nms-sales-tab-${division}`,
              ),
        );
        const filteredChildren = item.children.filter((child) =>
          allowedRevenueTabs.has(child.id),
        );
        return { ...item, children: filteredChildren };
      }

      // (2) 권한 기반 자식 필터 (full access 면 스킵)
      if (isFullAccess) return item;

      const sectionForTabs = itemIdToSection[item.id];
      if (!sectionForTabs) return item;

      const allowed = allowedTabsBySection.get(sectionForTabs);

      // 권한 시스템에 등록된 탭 ID 목록 — 이 목록에 없는 탭은 새로 추가된 탭으로 간주해 자동 허용
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
      const managedSet = MANAGED_TAB_IDS[sectionForTabs];

      // education 그룹의 'edu-sales-page'는 별도 'edu-sales' section의 scope로 결정
      // (hakjeom 권한과 분리 — 권한 관리 UI에서도 별도 항목으로 노출됨)
      const isEducationItem = item.id === "education";
      const eduSalesAllowed = allowedSections.has("edu-sales");
      // cert 그룹의 'cert-sales-page'도 동일 패턴 — 별도 'cert-sales' section 권한으로 분리
      const isCertItem = item.id === "cert";
      const certSalesAllowed = allowedSections.has("cert-sales");
      // practice 그룹의 'practice-sales-page'도 동일 패턴 — 별도 'practice-sales' section 권한으로 분리
      const isPracticeItem = item.id === "practice";
      const practiceSalesAllowed = allowedSections.has("practice-sales");

      const filteredChildren = item.children.filter((child) => {
        if (isEducationItem && child.id === "edu-sales-page") {
          return eduSalesAllowed;
        }
        if (isCertItem && child.id === "cert-sales-page") {
          return certSalesAllowed;
        }
        if (isPracticeItem && child.id === "practice-sales-page") {
          return practiceSalesAllowed;
        }
        // hakjeom allowed_tabs가 null 또는 없음 = 전체 허용
        if (allowed === undefined || allowed === null) return true;
        return allowed.has(child.id) || !managedSet?.has(child.id);
      });
      return { ...item, children: filteredChildren };
    })
    .map((item) => {
      // 임시 숨김 하위 메뉴 제거 (마케팅 안 민간자격증·유학 섹션)
      if (!item.children) return item;
      const kids = item.children.filter(
        (c) => !TEMP_HIDDEN_CHILD_IDS.has(c.id),
      );
      return { ...item, children: kids };
    })
    .filter((item) => {
      // 임시 숨김 메뉴
      if (TEMP_HIDDEN_MENU_IDS.has(item.id)) return false;
      const hideKey = SIDEBAR_HIDE_KEY[item.id];
      if (hideKey && hiddenMenus.includes(hideKey)) return false;
      return !item.children || item.children.length > 0;
    });

  // 현재 경로에 맞는 아이템 자동 펼치기
  useEffect(() => {
    for (const item of currentItems) {
      if (!item.children) continue;
      const isParentActive = item.activeOn
        ? item.activeOn.some((p) => pathname.startsWith(p))
        : pathname.startsWith(item.href.split("?")[0]);
      if (isParentActive) {
        setTimeout(() => {
          setOpenItems((prev) => new Set([...prev, item.id]));
        }, 0);
        break;
      }
    }
  }, [pathname, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // 관리자 도구 노출 여부 — master-admin / admin / division_admin
  const showAdminTools =
    isFullAccess || (!!isDivisionAdmin && userRole !== "mini-admin");

  // permissionKey 가진 항목의 권한 scope 조회 (관리도구/내메뉴 노출 제어)
  const permScopeOf = (key: string) =>
    permissions.find((p) => p.section === key)?.scope ?? "none";
  const visibleAdminTools = ADMIN_TOOLS_ITEMS.filter((item) => {
    if (!item.permissionKey) return true;
    if (isFullAccess) return true;
    return permScopeOf(item.permissionKey) !== "none";
  });
  const visiblePersonalTools = PERSONAL_TOOLS_ITEMS.filter((item) => {
    if (!item.permissionKey) return true;
    if (isFullAccess) return true;
    return permScopeOf(item.permissionKey) !== "none";
  });

  return (
    <aside
      className={`${styles.sidebar}${isOpen ? ` ${styles.sidebarOpen}` : ""}`}
    >
      <nav className={styles.sidebarNav}>
        {showAdminTools && (
          <ul className={`${styles.sidebarList} ${styles.sidebarAdminTools}`}>
            {visibleAdminTools.map((item) => {
              const isActive = pathname.startsWith(item.href.split("?")[0]);
              return (
                <li key={item.id}>
                  {item.groupLabel && (
                    <p className={styles.sidebarMenuLabel}>{item.groupLabel}</p>
                  )}
                  <Link
                    href={item.href}
                    onClick={() => onClose?.()}
                    className={`${styles.sidebarLink} ${isActive ? styles.sidebarLinkActive : ""}`}
                  >
                    <span className={styles.sidebarLinkIcon}>{item.icon}</span>
                    <span className={styles.sidebarLinkLabel}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {userRole !== "mini-admin" && (
          <ul className={`${styles.sidebarList} ${styles.sidebarAdminTools}`}>
            {visiblePersonalTools.map((item) => {
              const isActive = pathname.startsWith(item.href.split("?")[0]);
              return (
                <li key={item.id}>
                  {item.groupLabel && (
                    <p className={styles.sidebarMenuLabel}>{item.groupLabel}</p>
                  )}
                  <Link
                    href={item.href}
                    onClick={() => onClose?.()}
                    className={`${styles.sidebarLink} ${isActive ? styles.sidebarLinkActive : ""}`}
                  >
                    <span className={styles.sidebarLinkIcon}>{item.icon}</span>
                    <span className={styles.sidebarLinkLabel}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <ul className={styles.sidebarList}>
          {currentItems.map((item) => {
            const [basePath, itemQuery = ""] = item.href.split("?");
            const itemTab = new URLSearchParams(itemQuery).get("tab");
            const currentTabParam = searchParams.get("tab");

            // 동일 basePath 안에서 tab 으로 구분되는 형제가 있는지 확인
            const siblingsOnSameBase = currentItems.filter(
              (other) => other.href.split("?")[0] === basePath,
            );
            const siblingTabs = siblingsOnSameBase
              .map((s) =>
                new URLSearchParams(s.href.split("?")[1] ?? "").get("tab"),
              )
              .filter((t): t is string => !!t);

            const pathMatches = item.exactMatch
              ? pathname === basePath
              : item.activeOn
                ? item.activeOn.some((p) => pathname.startsWith(p))
                : pathname.startsWith(basePath);

            let tabMatches = true;
            if (siblingsOnSameBase.length > 1) {
              if (itemTab) {
                tabMatches = currentTabParam === itemTab;
              } else {
                // tab 없는 기본 항목: 현재 tab 이 형제 tab 중 하나이면 비활성
                tabMatches =
                  !currentTabParam || !siblingTabs.includes(currentTabParam);
              }
            }

            const isPathActive = pathMatches && tabMatches;
            const isTrash = item.id === "trash";
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = openItems.has(item.id);

            // 서브 아이템 중 현재 활성 탭 확인
            const currentTab = searchParams.get("tab");
            const activeChildHref = hasChildren
              ? `${basePath}?tab=${currentTab}`
              : null;

            return (
              <li key={item.id}>
                {item.groupLabel && (
                  <p className={styles.sidebarMenuLabel}>{item.groupLabel}</p>
                )}

                {hasChildren ? (
                  <>
                    <button
                      className={`${styles.sidebarParentBtn} ${isPathActive ? styles.sidebarParentBtnActive : ""}`}
                      onClick={() => toggleItem(item.id)}
                    >
                      <span className={styles.sidebarLinkIcon}>
                        {item.icon}
                      </span>
                      <span className={styles.sidebarLinkLabel}>
                        {item.label}
                      </span>
                      <span
                        className={`${styles.sidebarChevron} ${isExpanded ? styles.sidebarChevronOpen : ""}`}
                      >
                        <ChevronRight size={13} />
                      </span>
                    </button>
                    {isExpanded && (
                      <ul className={styles.sidebarSubList}>
                        {item.children!.map((child) => {
                          const childBasePath = child.href.split("?")[0];
                          const childTab = new URLSearchParams(
                            child.href.split("?")[1] ?? "",
                          ).get("tab");
                          const isChildActive =
                            (childBasePath === basePath &&
                              pathname.startsWith(basePath) &&
                              activeChildHref === child.href) ||
                            (childBasePath !== basePath &&
                              pathname.startsWith(childBasePath) &&
                              (childTab === null ||
                                searchParams.get("tab") === childTab));
                          const isCounselDone =
                            child.id === "hakjeom-tab-counsel_done";
                          const isCertCounsel =
                            child.id === "cert-tab-student-contact";
                          return (
                            <li key={child.id}>
                              {child.sectionLabel && (
                                <p className={styles.sidebarSubSectionLabel}>
                                  {child.sectionLabel}
                                </p>
                              )}
                              <Link
                                href={child.href}
                                className={`${styles.sidebarSubLink} ${isChildActive ? styles.sidebarSubLinkActive : ""}`}
                                onClick={onClose}
                              >
                                {child.label}
                                {isCounselDone && counselCount > 0 && (
                                  <span className={styles.sidebarBadge}>
                                    {counselCount}
                                  </span>
                                )}
                                {isCertCounsel && certCounselCount > 0 && (
                                  <span className={styles.sidebarBadge}>
                                    {certCounselCount}
                                  </span>
                                )}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={`${styles.sidebarLink} ${isPathActive ? styles.sidebarLinkActive : ""}`}
                    onClick={onClose}
                  >
                    <span className={styles.sidebarLinkIcon}>{item.icon}</span>
                    <span className={styles.sidebarLinkLabel}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className={styles.sidebarDevBadge}>
                        {item.badge}
                      </span>
                    )}
                    {isTrash && trashCount > 0 && (
                      <span className={styles.sidebarBadge}>{trashCount}</span>
                    )}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
