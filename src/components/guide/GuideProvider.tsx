"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  GUIDES,
  getGuideByPath,
  getSeenGuideIds,
  markGuideSeen,
} from "@/lib/guide/steps";
import GuideTour from "./GuideTour";

interface GuideContextValue {
  startCurrent: () => void;
  startById: (id: string) => void;
  available: { id: string; label: string }[];
}

const GuideContext = createContext<GuideContextValue | null>(null);

export function useGuide() {
  const ctx = useContext(GuideContext);
  if (!ctx) {
    return {
      startCurrent: () => {},
      startById: () => {},
      available: [],
    } as GuideContextValue;
  }
  return ctx;
}

export default function GuideProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);

  // 첫 로그인 자동 시작 — 현재 경로의 가이드가 아직 안 본 거면 한 번 띄움
  useEffect(() => {
    if (!pathname) return;
    const g = getGuideByPath(pathname);
    if (!g) return;
    const seen = getSeenGuideIds();
    if (seen.includes(g.id)) return;
    // 약간 지연 후 시작 (DOM 마운트 대기)
    const t = setTimeout(() => setActiveGuideId(g.id), 600);
    return () => clearTimeout(t);
  }, [pathname]);

  const startCurrent = useCallback(() => {
    if (!pathname) return;
    const g = getGuideByPath(pathname);
    if (g) setActiveGuideId(g.id);
  }, [pathname]);

  const startById = useCallback((id: string) => {
    setActiveGuideId(id);
  }, []);

  const close = useCallback(() => {
    if (activeGuideId) markGuideSeen(activeGuideId);
    setActiveGuideId(null);
    // 가이드 종료 시 데모 모달/목록도 자동 정리 (모든 가이드 대상)
    if (typeof window !== "undefined") {
      // hakjeom 가이드
      window.dispatchEvent(new CustomEvent("guide-demo-close"));
      window.dispatchEvent(new CustomEvent("guide-demo-list-off"));
      // 등록학생관리 가이드
      window.dispatchEvent(
        new CustomEvent("guide-edu-action", {
          detail: { type: "demo-list-off" },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("guide-edu-action", {
          detail: { type: "close-add-modal" },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("guide-edu-modal-action", {
          detail: { type: "demo-end" },
        }),
      );
      // 전자결재 가이드
      window.dispatchEvent(
        new CustomEvent("guide-apv-action", {
          detail: { type: "demo-end" },
        }),
      );
    }
  }, [activeGuideId]);

  const activeGuide = activeGuideId
    ? GUIDES.find((g) => g.id === activeGuideId) ?? null
    : null;

  const available = GUIDES.map((g) => ({ id: g.id, label: g.label }));

  return (
    <GuideContext.Provider value={{ startCurrent, startById, available }}>
      {children}
      {activeGuide && (
        <GuideTour
          open={!!activeGuide}
          steps={activeGuide.steps}
          onClose={close}
        />
      )}
    </GuideContext.Provider>
  );
}
