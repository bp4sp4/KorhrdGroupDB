"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconSidebarCollapse, IconSidebarExpand } from "./navIcons";
import styles from "./layout.module.css";
import { createClient } from "@/lib/supabase/client";
import {
  SIDEBAR_PERSONAL,
  SIDEBAR_ADMIN,
  SIDEBAR_SYSTEM,
  MINI_ADMIN_ITEMS,
  type GlobalNavItem,
  type NavItem,
} from "./navConfig";

interface SidebarProps {
  userRole?: string | null;
  permissions?: {
    section: string;
    scope: string;
    allowed_tabs?: string[] | null;
  }[];
  isDivisionAdmin?: boolean;
  /** 매출 목표 관리 노출 — 팀장/본부장/경영지원본부/관리자 */
  canManageSalesTargets?: boolean;
  hiddenMenus?: string[];
  isOpen?: boolean;
  onClose?: () => void;
}

const COLLAPSE_KEY = "office-sidebar-collapsed";

export default function Sidebar({
  userRole,
  permissions = [],
  isDivisionAdmin = false,
  canManageSalesTargets = false,
  hiddenMenus = [],
  isOpen,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const [trashCount, setTrashCount] = useState<number>(0);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // 삭제 목록 카운트 (Realtime)
  useEffect(() => {
    if (userRole === "mini-admin") return;

    const fetchCount = () => {
      fetch("/api/trash?countOnly=1")
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .then((data: { count?: number }) =>
          setTrashCount(typeof data?.count === "number" ? data.count : 0),
        )
        .catch(() => {});
    };

    fetchCount();

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

  const isFullAccess = userRole === "master-admin" || userRole === "admin";
  const permScopeOf = (key: string) =>
    permissions.find((p) => p.section === key)?.scope ?? "none";

  // 개인메뉴 게이트
  const visiblePersonal = SIDEBAR_PERSONAL.filter((item) => {
    if (item.hideKey && hiddenMenus.includes(item.hideKey)) return false;
    if (!item.permissionKey) return true;
    if (isFullAccess) return true;
    return permScopeOf(item.permissionKey) !== "none";
  });

  // 관리자메뉴 게이트 — 권한별 개별 노출
  const visibleAdmin = SIDEBAR_ADMIN.filter((item) => {
    // 매출 목표 관리 — 전용 게이트 (팀장/본부장/경영지원본부/관리자)
    if (item.requiresSalesTargetAccess)
      return isFullAccess || canManageSalesTargets;
    if (isFullAccess) return true;
    if (item.requiresDivisionAdmin && !isDivisionAdmin) return false;
    // 영업손익·매출목표 합본 — profit 권한자 또는 매출목표 권한자(팀장/본부장/경영지원본부)
    if (item.orSalesTargetAccess && canManageSalesTargets) return true;
    if (!item.permissionKey) return false;
    return permScopeOf(item.permissionKey) !== "none";
  });

  // 시스템 (master-admin 전용)
  const visibleSystem = SIDEBAR_SYSTEM.filter((item) => {
    if (item.adminOnly) return userRole === "master-admin";
    return true;
  });

  const isActive = (item: GlobalNavItem | NavItem) => {
    const base = item.href.split("?")[0];
    if (item.exactMatch) return pathname === base;
    if (item.activeOn) return item.activeOn.some((p) => pathname.startsWith(p));
    return pathname.startsWith(base);
  };

  const renderItem = (item: GlobalNavItem) => {
    const active = isActive(item);
    const badge = item.id === "trash" && trashCount > 0 ? trashCount : null;
    return (
      <li key={item.id}>
        <Link
          href={item.href}
          onClick={onClose}
          title={collapsed ? item.label : undefined}
          className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
        >
          <span className={styles.navIcon}>{item.icon}</span>
          {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
          {!collapsed && badge !== null && (
            <span className={styles.navBadgeCount}>{badge}</span>
          )}
        </Link>
      </li>
    );
  };

  const isMiniAdmin = userRole === "mini-admin";

  return (
    <aside
      className={`${styles.sidebar}${collapsed ? ` ${styles.sidebarCollapsed}` : ""}${
        isOpen ? ` ${styles.sidebarOpen}` : ""
      }`}
    >
      {/* 로고 + 접기 버튼 */}
      <div className={styles.sidebarHeader}>
        {!collapsed && (
          <Link href="/dashboard" className={styles.sidebarLogo} onClick={onClose}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="한평생 오피스" className={styles.sidebarLogoImg} />
          </Link>
        )}
        <button
          type="button"
          className={styles.sidebarCollapseBtn}
          onClick={toggleCollapsed}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          {collapsed ? <IconSidebarExpand /> : <IconSidebarCollapse />}
        </button>
      </div>

      <nav className={styles.sidebarScroll}>
        {isMiniAdmin ? (
          <ul className={styles.navList}>
            {MINI_ADMIN_ITEMS.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  className={`${styles.navLink} ${isActive(item) ? styles.navLinkActive : ""}`}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <>
            {/* 개인메뉴 */}
            <ul className={styles.navList}>{visiblePersonal.map(renderItem)}</ul>

            {/* 관리자메뉴 (구분선) */}
            {visibleAdmin.length > 0 && (
              <ul className={`${styles.navList} ${styles.navGroupBordered}`}>
                {visibleAdmin.map(renderItem)}
              </ul>
            )}
          </>
        )}
      </nav>

      {/* 하단 고정 — 시스템 설정 */}
      {!isMiniAdmin && visibleSystem.length > 0 && (
        <div className={styles.sidebarFooter}>
          <ul className={styles.navList}>{visibleSystem.map(renderItem)}</ul>
        </div>
      )}
    </aside>
  );
}
