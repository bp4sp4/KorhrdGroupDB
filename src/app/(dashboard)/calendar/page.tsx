"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Calendar, { type CalendarEvent } from "./Calendar";

// hakjeom 상담 응답 타입 (최소)
interface ContactScheduledItem {
  id: number;
  name: string;
  contact_scheduled_at: string | null;
}

export default function CalendarPage() {
  const router = useRouter();
  const [scheduledItems, setScheduledItems] = useState<ContactScheduledItem[]>(
    [],
  );

  // hakjeom_consultations에서 contact_scheduled_at이 있는 항목 fetch
  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/hakjeom?has_scheduled=1", { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res) => {
        const list = (res?.data ?? res?.items ?? []) as ContactScheduledItem[];
        setScheduledItems(
          list.filter((i) => !!i.contact_scheduled_at) ?? [],
        );
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);

  // 연락예정을 캘린더 이벤트로 변환
  const events = useMemo<CalendarEvent[]>(() => {
    return scheduledItems
      .filter((i) => i.contact_scheduled_at)
      .map((i) => {
        const date = (i.contact_scheduled_at ?? "").slice(0, 10); // YYYY-MM-DD
        return {
          id: `contact-${i.id}`,
          date,
          title: `연락예정 · ${i.name}`,
          category: "work" as const,
        };
      });
  }, [scheduledItems]);

  return (
    <Calendar
      events={events}
      today={new Date()}
      onSelectEvent={(id) => {
        // contact-{id} 형태에서 id 추출 → 학점은행제 상세로 이동
        const m = id.match(/^contact-(\d+)$/);
        if (m) router.push(`/hakjeom?id=${m[1]}`);
      }}
    />
  );
}
