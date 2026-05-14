// 페이지별 가이드 투어 단계 정의
// targetSelector 는 CSS selector (data-guide 속성 권장)
// 추가 페이지는 여기에 추가하면 됨

import type { ReactNode } from "react";
import styles from "./guideText.module.css";

/** 강조 헬퍼 — content 안에서 <B>, <C>, <W>, <S> 형태로 사용 */
const B = ({ children }: { children: ReactNode }) => (
  <strong className={styles.bold}>{children}</strong>
);
const C = ({ children }: { children: ReactNode }) => (
  <span className={styles.colorPrimary}>{children}</span>
);
const W = ({ children }: { children: ReactNode }) => (
  <span className={styles.colorWarn}>{children}</span>
);
const S = ({ children }: { children: ReactNode }) => (
  <span className={styles.colorSuccess}>{children}</span>
);

export interface GuideStep {
  /** spotlight를 비출 요소 선택자. 없으면 화면 중앙 모달처럼 표시 */
  target?: string;
  title: string;
  content: ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
  /** 단계 진입 시 자동 클릭할 요소 선택자 (예: 첫 행 클릭으로 상세 모달 열기) */
  clickSelector?: string;
  /** 단계 진입 시 발행할 커스텀 윈도우 이벤트 이름 (예: 'guide-demo-open') */
  fireEvent?: string;
  /** 이 이벤트가 발생하면 자동으로 다음 단계로 진행 */
  advanceOn?: string;
  /** target/clickSelector 가 DOM에 나타날 때까지 대기할 ms (기본 600) */
  waitMs?: number;
  /** 이 단계에서 '이전' 버튼 숨김 */
  hidePrev?: boolean;
  /** 이 단계에서 '다음' 버튼 숨김 (advanceOn 으로만 진행) */
  hideNext?: boolean;
}

export interface GuideDef {
  id: string;
  label: string; // 헤더 ? 버튼 메뉴에 표시
  /** 어떤 경로에서 자동 노출할지 (startsWith 비교) */
  matchPath: string;
  steps: GuideStep[];
}

export const GUIDES: GuideDef[] = [
  {
    id: "hakjeom-basics",
    label: "문의 DB 사용법",
    matchPath: "/hakjeom",
    steps: [
      {
        title: "문의 DB 가이드(최초 1회)",
        content: (
          <>
            학점은행제 문의를 등록하고 <B>등록완료</B>까지 진행하는 흐름을
            단계별로 안내해드릴게요.
            {"\n\n"}
            가이드 동안 임시로 <C>예시 학생 10명</C>이 목록에 표시됩니다
            {"\n"}
            <W>(실제 데이터 아님)</W>
          </>
        ),
        fireEvent: "guide-demo-list-on",
      },
      {
        target: '[data-guide="hakjeom-leaderboard"]',
        title: "담당자 실적",
        content: (
          <>
            상단에서 <B>담당자별 등록완료율</B>을 한눈에 볼 수 있어요.
            {"\n"}• <C>이번 달</C> 기준으로 정렬 (큰 숫자 = 상위)
            {"\n"}• 1등은 <S>노란 강조</S>로 표시
            {"\n"}• 카드에는 <B>분기 누적</B>도 같이 보여요
            {"\n"}
            <W>※ 지인소개는 포함되지 않아요</W>
          </>
        ),
        placement: "bottom",
      },
      {
        target: '[data-guide="hakjeom-search"]',
        title: "검색",
        content: (
          <>
            <B>이름·연락처·취득사유·메모</B>로 빠르게 검색할 수 있어요.
          </>
        ),
        placement: "bottom",
      },
      {
        target: '[data-guide="hakjeom-daterange"]',
        title: "기간 선택",
        content: (
          <>
            버튼을 누르면 달력이 펼쳐져요. <B>분기별</B>·<B>사용자 지정</B>으로
            범위를 골라 그 기간의 문의만 볼 수 있습니다.
          </>
        ),
        placement: "bottom",
      },
      {
        target: '[data-guide="hakjeom-new-btn"]',
        title: "새 문의 추가",
        content: (
          <>
            보통 홈페이지로 들어오는 문의는 <S>자동으로 등록</S>돼요.
            {"\n"}
            <B>특이 케이스</B> — 대표전화나 당근채팅으로 연락처·최종학력을 받은
            분들은 통화하고 여기서 직접 추가하고 있어요.
          </>
        ),
        placement: "bottom",
      },
      {
        target: '[data-guide="hakjeom-table"]',
        title: "문의 목록",
        content: (
          <>
            들어온 문의가 표로 정리됩니다. <B>행을 클릭</B>하면 상세 정보가
            펼쳐져요.
          </>
        ),
        placement: "top",
      },
      {
        target: '[data-guide="hakjeom-status-col"]',
        title: "상태 변경",
        content: (
          <>
            표의 <B>[상태]</B> 칸을 클릭하면 진행 단계를 바꿀 수 있어요.
            {"\n"}
            <C>상담대기</C> → <C>상담완료(높음/중간/낮음)</C> → <S>등록완료</S>{" "}
            순으로 진행됩니다.
          </>
        ),
        placement: "bottom",
      },
      {
        title: "상세화면 열기 (예시 학생)",
        content: (
          <>
            실제 데이터를 건드리지 않기 위해{" "}
            <C>&apos;홍길동(가이드 예시)&apos;</C> 가짜 학생으로 상세창을
            열어드릴게요.
          </>
        ),
        fireEvent: "guide-demo-open",
        waitMs: 800,
      },
      {
        target: '[data-guide="detail-education"]',
        title: "등록완료로 바꾸기 ① 최종학력",
        content: (
          <>
            먼저 <B>최종학력</B>을 선택하세요. 선택하면{" "}
            <S>자동으로 다음 단계</S>로 넘어가요.
            {"\n"}
            (예: 4년제 졸업, 2년제 중퇴)
          </>
        ),
        placement: "right",
        waitMs: 800,
        fireEvent: "guide-tab-basic",
        advanceOn: "guide-edu-set",
        hideNext: true,
      },
      {
        target: '[data-guide="detail-hope-course"]',
        title: "등록완료로 바꾸기 ② 희망과정",
        content: (
          <>
            <B>희망과정</B>을 4개 자격증과정 중 하나로 선택하세요.
            {"\n"}• <C>사회복지사2급 - 신법</C>
            {"\n"}• <C>사회복지사2급 - 구법</C>
            {"\n"}• <C>사회복지사 (실습예정)</C>
            {"\n"}• <C>건강가정사</C>
          </>
        ),
        placement: "right",
        fireEvent: "guide-tab-basic",
        advanceOn: "guide-hope-set",
        hidePrev: true,
        hideNext: true,
      },
      {
        target: '[data-guide="detail-status"]',
        title: "등록완료로 바꾸기 ③ 상태 변경",
        content: (
          <>
            <B>취득정보 탭</B>으로 이동했어요. 상태를{" "}
            <S>&apos;등록완료&apos;</S>로 바꿉니다.
            {"\n"}
            <W>(아래 과목당비용이 비어있으면 통과되지 않아요.)</W>
          </>
        ),
        placement: "top",
        fireEvent: "guide-tab-info",
        waitMs: 800,
        advanceOn: "guide-status-set",
        hidePrev: true,
        hideNext: true,
      },
      {
        target: '[data-guide="detail-subject-cost"]',
        title: "등록완료로 바꾸기 ④ 과목당비용",
        content: (
          <>
            <B>과목당 비용</B>을 입력하세요.{" "}
            <W>비어있으면 등록완료로 변경되지 않아요.</W>
            {"\n"}예) <C>150000</C>
          </>
        ),
        placement: "right",
        fireEvent: "guide-tab-info",
        advanceOn: "guide-cost-set",
        hidePrev: true,
        hideNext: true,
      },
      {
        title: "등록완료로 바꾸기 ⑤ 저장",
        content: (
          <>
            <B>저장 버튼</B>을 누르면 상태가 <S>&apos;등록완료&apos;</S>로
            변경됩니다.
            {"\n"}
            <B>등록학생관리</B>는 별도로 직접 추가해주세요.
            {"\n"}(등록학생관리 → 학생 추가 → 이름·번호 입력 시 문의 DB에서{" "}
            <C>자동으로 정보가 채워집니다</C>.)
          </>
        ),
      },
      {
        title: "끝났어요!",
        content: (
          <>
            언제든 <C>기간 선택 옆의 [가이드] 버튼</C>을 눌러 가이드를 다시 볼
            수 있어요.
          </>
        ),
      },
    ],
  },
];

export function getGuideByPath(pathname: string): GuideDef | null {
  return GUIDES.find((g) => pathname.startsWith(g.matchPath)) ?? null;
}

// localStorage seen 관리
const SEEN_KEY = "guideSeenIds";

export function getSeenGuideIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function markGuideSeen(id: string) {
  if (typeof window === "undefined") return;
  try {
    const seen = getSeenGuideIds();
    if (!seen.includes(id)) {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, id]));
    }
  } catch {
    /* ignore */
  }
}

export function resetSeenGuide(id: string) {
  if (typeof window === "undefined") return;
  try {
    const seen = getSeenGuideIds().filter((s) => s !== id);
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* ignore */
  }
}
