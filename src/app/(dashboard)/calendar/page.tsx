"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Calendar, { type CalendarEvent } from "./Calendar";
import styles from "./page.module.css";

// hakjeom 상담 응답 타입 (최소)
interface ContactScheduledItem {
  id: number;
  name: string;
  manager: string | null;
  contact_scheduled_at: string | null;
}

interface MeInfo {
  displayName: string | null;
  role: string | null;
}

type ViewMode = "mine" | "all";

export default function CalendarPage() {
  const router = useRouter();
  const [scheduledItems, setScheduledItems] = useState<ContactScheduledItem[]>(
    [],
  );
  const [me, setMe] = useState<MeInfo>({ displayName: null, role: null });
  const [viewMode, setViewMode] = useState<ViewMode>("all");

  // 사용자 정보 + 연락예정 항목 병렬 fetch
  useEffect(() => {
    const ac = new AbortController();
    Promise.all([
      fetch("/api/auth/me", { signal: ac.signal })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/hakjeom?has_scheduled=1", { signal: ac.signal })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ]).then(([meRes, hakRes]) => {
      if (meRes) {
        setMe({
          displayName: meRes.displayName ?? null,
          role: meRes.role ?? null,
        });
      }
      const list = (
        Array.isArray(hakRes)
          ? hakRes
          : (hakRes?.data ?? hakRes?.items ?? [])
      ) as ContactScheduledItem[];
      setScheduledItems(list.filter((i) => !!i.contact_scheduled_at) ?? []);
    });
    return () => ac.abort();
  }, []);

  // 본인 카운트 (manager 매핑 매칭)
  const myCount = useMemo(
    () =>
      me.displayName
        ? scheduledItems.filter((i) => i.manager === me.displayName).length
        : 0,
    [scheduledItems, me.displayName],
  );

  // 다른 사람 manager 데이터가 있는지 (API가 본인 외도 줬는지)
  const hasOthersData = useMemo(() => {
    if (!me.displayName) return scheduledItems.length > 0;
    return scheduledItems.some(
      (i) => i.manager && i.manager !== me.displayName,
    );
  }, [scheduledItems, me.displayName]);

  // 토글은 본인 일정 + 다른 사람 일정 둘 다 있을 때만 의미가 있음
  const showToggle = myCount > 0 && hasOthersData;

  // viewMode 에 따라 필터된 항목
  const filteredItems = useMemo(() => {
    if (viewMode === "all") return scheduledItems;
    if (!me.displayName) return scheduledItems;
    return scheduledItems.filter((i) => i.manager === me.displayName);
  }, [scheduledItems, viewMode, me.displayName]);

  // 캘린더 이벤트로 변환
  const events = useMemo<CalendarEvent[]>(() => {
    return filteredItems
      .filter((i) => i.contact_scheduled_at)
      .map((i) => {
        const date = (i.contact_scheduled_at ?? "").slice(0, 10);
        return {
          id: `contact-${i.id}`,
          date,
          title: `연락예정 · ${i.name}`,
          category: "work" as const,
        };
      });
  }, [filteredItems]);

  const allCount = scheduledItems.length;

  return (
    <>
      {showToggle && (
        <div className={styles.viewBar}>
          <div className={styles.viewBarLeft}>
            <span className={styles.viewBarLabel}>연락예정 표시</span>
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewToggleBtn} ${viewMode === "mine" ? styles.viewToggleBtnActive : ""}`}
                onClick={() => setViewMode("mine")}
              >
                내 일정
                <span className={styles.viewToggleCount}>{myCount}</span>
              </button>
              <button
                className={`${styles.viewToggleBtn} ${viewMode === "all" ? styles.viewToggleBtnActive : ""}`}
                onClick={() => setViewMode("all")}
              >
                전체
                <span className={styles.viewToggleCount}>{allCount}</span>
              </button>
            </div>
          </div>
          {viewMode === "all" && (
            <div className={styles.viewBarHint}>
              전체 직원의 연락예정 표시 중
            </div>
          )}
        </div>
      )}
      <Calendar
        events={events}
        today={new Date()}
        onSelectEvent={(id) => {
          const m = id.match(/^contact-(\d+)$/);
          if (m) router.push(`/hakjeom?id=${m[1]}`);
        }}
      />
    </>
  );
}
