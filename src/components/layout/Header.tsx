"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./layout.module.css";
import NotificationBell from "./NotificationBell";
import QuickSearch from "./QuickSearch";
import {
  getVisibleDivisions,
  type NavItem,
  type NavSubItem,
} from "./navConfig";

interface HeaderProps {
  userName?: string;
  userRole?: string | null;
  permissions?: {
    section: string;
    scope: string;
    allowed_tabs?: string[] | null;
  }[];
  revenueOwnDivisions?: ("nms" | "cert" | "abroad")[];
  departmentCode?: string | null;
  isDivisionAdmin?: boolean;
  isDeptHead?: boolean;
  hiddenMenus?: string[];
  onMenuToggle?: () => void;
}

function tabOf(href: string): string | null {
  return new URLSearchParams(href.split("?")[1] ?? "").get("tab");
}

export default function Header({
  userName = "관리자",
  userRole,
  permissions = [],
  revenueOwnDivisions = [],
  departmentCode = null,
  isDivisionAdmin = false,
  isDeptHead = false,
  onMenuToggle,
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [divOpen, setDivOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [counselCount, setCounselCount] = useState(0);
  const [certCounselCount, setCertCounselCount] = useState(0);

  const divRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  const isMiniAdmin = userRole === "mini-admin";

  // 연락예정 배지 카운트
  useEffect(() => {
    if (isMiniAdmin) return;
    fetch("/api/hakjeom/counsel-count")
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d: { count: number }) => setCounselCount(d.count ?? 0))
      .catch(() => {});
    fetch("/api/cert/students/counsel-count")
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d: { count: number }) => setCertCounselCount(d.count ?? 0))
      .catch(() => {});
  }, [isMiniAdmin]);

  const divisions: NavItem[] = isMiniAdmin
    ? []
    : getVisibleDivisions({
        userRole,
        permissions,
        revenueOwnDivisions,
        departmentCode,
        isDivisionAdmin,
        isDeptHead,
      });

  const scopeParam = searchParams.get("scope");

  // 예산현황(/budget)은 여러 사업부가 ?scope= 로 공유 → scope 쿼리로 사업부 판정
  // (경영지원본부 activeOn에 /budget이 있어 scope 없이는 항상 경영지원본부로 잡히는 문제 방지)
  const budgetDivision = pathname.startsWith("/budget")
    ? (divisions.find((d) =>
        d.children?.some((c) => {
          const [base, q] = c.href.split("?");
          if (base !== "/budget") return false;
          const childScope = new URLSearchParams(q ?? "").get("scope");
          return (childScope ?? "") === (scopeParam ?? "");
        }),
      ) ?? null)
    : null;

  // 현재 경로에 해당하는 사업부
  // 0차: 예산현황 scope 매칭 → 1차: 사업부 자체 경로(activeOn/href) → 2차: 자식 탭 경로
  const currentDivision =
    budgetDivision ??
    divisions.find(
      (d) =>
        (d.activeOn && d.activeOn.some((p) => pathname.startsWith(p))) ||
        pathname.startsWith(d.href.split("?")[0]),
    ) ??
    divisions.find((d) =>
      d.children?.some((c) => pathname.startsWith(c.href.split("?")[0])),
    ) ??
    null;

  // 사업부 페이지가 아니어도(홈 등) 드롭다운 진입 경로가 필요하므로 첫 사업부를 기본 표시
  const displayDivision = currentDivision ?? divisions[0] ?? null;
  const children = displayDivision?.children ?? [];
  const currentTab = searchParams.get("tab");

  // 인라인 탭 / "더보기" 드롭다운 분리 (inMore 플래그로 명시 — 경영지원본부 전용)
  const inlineChildren = children.filter((c) => !c.inMore);
  const overflowChildren = children.filter((c) => c.inMore);

  const isTabActive = (child: NavSubItem): boolean => {
    const cBase = child.href.split("?")[0];
    if (!pathname.startsWith(cBase)) return false;
    const cTab = tabOf(child.href);
    const sameBaseTabs = children
      .filter((s) => s.href.split("?")[0] === cBase)
      .map((s) => tabOf(s.href))
      .filter((t): t is string => !!t);
    if (cTab) return currentTab === cTab;
    if (sameBaseTabs.length > 0)
      return !currentTab || !sameBaseTabs.includes(currentTab);
    return true;
  };

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (divRef.current && !divRef.current.contains(e.target as Node))
        setDivOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node))
        setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const selectDivision = (div: NavItem) => {
    setDivOpen(false);
    const first = div.children?.[0];
    if (first) router.push(first.href);
    else router.push(div.href);
  };

  const badgeFor = (child: NavSubItem): number | null => {
    if (child.id === "hakjeom-tab-counsel_done" && counselCount > 0)
      return counselCount;
    if (child.id === "cert-tab-student-contact" && certCounselCount > 0)
      return certCounselCount;
    return null;
  };

  return (
    <header className={styles.header}>
      {/* 햄버거 (모바일) */}
      <button
        className={styles.hamburgerBtn}
        onClick={onMenuToggle}
        aria-label="메뉴 열기"
      >
        <Menu size={20} />
      </button>

      {/* 사업부 드롭다운 + 탭 */}
      {!isMiniAdmin && displayDivision && (
        <div className={styles.divisionBar}>
          {/* 드롭다운 */}
          <div className={styles.divisionSelect} ref={divRef}>
            <button
              type="button"
              className={styles.divisionTrigger}
              onClick={() => setDivOpen((v) => !v)}
            >
              <span className={styles.divisionTriggerLabel}>
                {displayDivision.label}
              </span>
              <ChevronDown size={14} className={styles.divisionTriggerIcon} />
            </button>
            {divOpen && divisions.length > 0 && (
              <ul className={styles.divisionMenu}>
                {divisions.map((div) => (
                  <li key={div.id}>
                    <button
                      type="button"
                      className={`${styles.divisionMenuItem} ${
                        div.id === currentDivision?.id
                          ? styles.divisionMenuItemActive
                          : ""
                      }`}
                      onClick={() => selectDivision(div)}
                    >
                      {div.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 인라인 탭 */}
          <div className={`${styles.tabsWrap} ${styles.tabsWrapScroll}`}>
            {inlineChildren.map((child) => {
              const active = isTabActive(child);
              const badge = badgeFor(child);
              return (
                <Link
                  key={child.id}
                  href={child.href}
                  className={`${styles.headerTab} ${active ? styles.headerTabActive : ""}`}
                >
                  {child.label}
                  {badge !== null && (
                    <span className={styles.headerTabBadge}>{badge}</span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* 더보기 (overflow 잘림 방지를 위해 탭 영역 바깥에 위치) */}
          {overflowChildren.length > 0 && (
            <div className={styles.moreWrap} ref={moreRef}>
              <button
                type="button"
                className={`${styles.moreBtn} ${
                  overflowChildren.some((c) => isTabActive(c))
                    ? styles.moreBtnActive
                    : ""
                }`}
                onClick={() => setMoreOpen((v) => !v)}
              >
                더보기
                <ChevronDown size={14} className={styles.moreBtnIcon} />
              </button>
              {moreOpen && (
                <ul className={styles.moreMenu}>
                  {overflowChildren.map((child) => {
                    const badge = badgeFor(child);
                    return (
                      <li key={child.id}>
                        <Link
                          href={child.href}
                          onClick={() => setMoreOpen(false)}
                          className={`${styles.moreMenuItem} ${
                            isTabActive(child) ? styles.moreMenuItemActive : ""
                          }`}
                        >
                          {child.label}
                          {badge !== null && (
                            <span className={styles.headerTabBadge}>{badge}</span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* 사업부 바가 없을 때만 우측 액션을 끝으로 밀어내는 스페이서 */}
      {!(!isMiniAdmin && displayDivision) && (
        <div className={styles.headerNavSpacer} />
      )}

      {/* 우측 액션 */}
      <div className={styles.headerRight}>
        <div className={styles.quickSearchHide}>
          <QuickSearch />
        </div>

        <div className={`${styles.headerDivider} ${styles.quickSearchHide}`} />

        <NotificationBell />

        <div className={styles.headerDivider} />

        <span className={styles.headerUserName}>{userName}</span>

        <div className={styles.headerDivider} />

        <button onClick={handleLogout} className={styles.logoutBtn}>
          <LogOut size={14} />
          로그아웃
        </button>
      </div>
    </header>
  );
}
