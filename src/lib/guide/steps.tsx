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
  /** 작은 코너 툴팁 (폼 위에 띄울 때 화면을 가리지 않도록) */
  compact?: boolean;
  /** 진입 후 N ms 뒤 자동으로 다음 단계로 (시뮬레이션용) */
  autoAdvanceMs?: number;
}

export interface GuideDef {
  id: string;
  /** 가이드 표시명 (메뉴/드롭다운에 노출 가능) */
  label: string;
  /**
   * pathname 기반 자동 시작 매칭 (startsWith).
   * - 있으면 GuideProvider가 해당 경로에서 첫 진입 시 자동 시작.
   * - 없으면 자동 시작 안 함 — 컴포넌트에서 `startById(id)`로 명시 호출.
   */
  matchPath?: string;
  /** 가이드 모음에서 그룹핑할 카테고리 (예: "회계", "인사", "출장") */
  category?: string;
  /** 가이드 모음에서 보일 짧은 설명 */
  description?: string;
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
            가이드 동안 임시로 <C>예시 학생 10명</C>이 목록에 표시됩니다.
            {"\n"}
            <W>※ 실제 데이터 아닙니다.</W>
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
            <B>특이 케이스</B> - 대표전화나 당근채팅으로 연락처·최종학력을 받은
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
            <C>&apos;홍길동(가이드 예시)&apos;</C>
            {"\n"} 가짜 학생으로 상세창을 열어드릴게요.
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
            먼저 <B>최종학력</B>을 선택하세요.{"\n"}선택하면{" "}
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
            <B>과목당 비용</B>을 입력하세요. {"\n"}
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
  // ─── 전자결재 — 회계: 지출품의서 → 지출결의서 흐름 ────────────────────────
  {
    id: "approvals-basics",
    label: "지출품의서 → 지출결의서",
    matchPath: "/approvals",
    category: "회계",
    description: "지출 사전 승인(품의)부터 사후 처리(결의)까지 연동 흐름",
    steps: [
      {
        title: "전자결재 가이드",
        content: (
          <>
            <B>지출품의서 → 지출결의서</B> 흐름을 시뮬레이션으로 보여드릴게요.
            {"\n\n"}
            <C>📝 지출품의서</C> — &quot;<B>이런 곳에 지출할 예정입니다</B>,
            결재해주세요&quot; (<S>사전</S> 승인)
            {"\n"}
            <C>📄 지출결의서</C> — &quot;<B>이미 지출했습니다</B>,
            확인해주세요&quot; (<S>사후</S> 처리)
            {"\n\n"}
            품의서 → 결재 완료 → 결의서 → 품의서 연동 순서로 진행돼요.
            {"\n\n"}
            <W>※ 이 가이드는 시뮬레이션입니다 (DB 저장 X)</W>
          </>
        ),
        fireEvent: "guide-apv-action:demo-start",
      },
      {
        title: "1단계 — 지출품의서 작성",
        content: (
          <>
            <B>지출품의서</B> 양식을 자동으로 열게요. 결의서를 쓰려면 먼저
            품의서가 <S>승인 완료</S>되어야 해요.
          </>
        ),
        fireEvent: "guide-apv-action:open-proposal-form",
        compact: true,
      },
      {
        target: '[data-guide="approvals-body-section"]',
        title: "2단계 — 본문 자동 입력",
        content: (
          <>
            예시 본문이 자동으로 채워져요:
            {"\n"}• 거래처: <C>가이드 예시 식당</C>
            {"\n"}• 사유: <C>5월 팀 회식</C>
            {"\n"}• 금액: <C>180,000원</C>
          </>
        ),
        fireEvent: "guide-apv-action:fill-proposal",
        compact: true,
        waitMs: 800,
      },
      {
        target: '[data-guide="approvals-submit-btn"]',
        title: "3단계 — 품의서 신청",
        content: (
          <>
            <B>[결재요청]</B> 버튼을 누르면 결재 흐름이 시작돼요. 모든 결재자가{" "}
            <S>승인</S>하면 품의서 완료!
          </>
        ),
        compact: true,
      },
      {
        target: '[data-guide="approvals-linked-proposal-table"]',
        title: "4단계 — 지출결의서 작성",
        content: (
          <>
            품의서가 승인됐다고 가정하고, 이제 <B>지출결의서(법인카드)</B>를
            자동으로 열어드렸어요.
            {"\n\n"}
            화면 위에 <C>[연동 품의서]</C> 영역이 보이죠? 여기서 품의서를
            연결해요.
          </>
        ),
        fireEvent: "guide-apv-action:open-resolution-form",
        compact: true,
        waitMs: 800,
      },
      {
        target: '[data-guide="approvals-proposal-modal"]',
        title: "5단계 — 품의서 선택",
        content: (
          <>
            <B>[품의서 선택]</B>을 누르면 본인의 <S>승인 완료 품의서</S> 목록이
            나와요.
            {"\n\n"}
            아래 <C>[가이드 예시] 5월 팀 회식비</C>를 클릭해보세요.
          </>
        ),
        fireEvent: "guide-apv-action:open-proposal-link",
        compact: true,
        waitMs: 600,
        advanceOn: "guide-apv-proposal-linked",
        hideNext: true,
      },
      {
        target: '[data-guide="approvals-linked-proposal-table"]',
        title: "6단계 — 품의서 연동 완료",
        content: (
          <>
            품의서가 결의서에 <S>자동 연동</S>됐어요.
            {"\n"}본문에 <C>거래처·사유·금액·첨부파일</C>이 자동 복사됩니다.
          </>
        ),
        compact: true,
        waitMs: 400,
      },
      {
        target: '[data-guide="approvals-submit-btn"]',
        title: "7단계 — 결의서 신청",
        content: (
          <>
            결재선·참조를 지정하고 <B>[결재요청]</B>을 누르면 결의서 결재가
            시작돼요.
            {"\n"}이걸로 <S>품의서 → 결의서 연동 흐름</S> 완료!
          </>
        ),
        compact: true,
      },
      {
        title: "끝났어요!",
        content: (
          <>
            요약:
            {"\n"}• <C>[품의서] 지출품의서</C> 작성·승인
            {"\n"}• <C>[결의서] 지출결의서</C>에서 <S>품의서 선택</S>으로 연동
            {"\n"}• 본문·첨부 자동 복사 → 결재 신청
            {"\n\n"}
            언제든 좌측 <C>[가이드] 버튼</C>으로 다시 볼 수 있어요.
          </>
        ),
        fireEvent: "guide-apv-action:demo-end",
      },
    ],
  },
  // ─── 학습 플랜 설계 가이드 (학생 상세의 [플랜 설계] 페이지) ────────────────
  {
    id: "plan-basics",
    label: "플랜 설계 사용법",
    steps: [
      {
        title: "학습 플랜 설계(최초 1회)",
        content: (
          <>
            학생의 <B>학력별 목표 학점</B>을 채우는 학습 플랜을 짜는 곳이에요.
            {"\n"}모든 변경은 <S>자동 저장</S>됩니다.
          </>
        ),
      },
      {
        target: '[data-guide="plan-edu-banner"]',
        title: "학력 안내",
        content: (
          <>
            상단 배너에 학생의 <B>최종학력</B>과 <B>희망학위과정</B>에 따른{" "}
            <C>목표 학점</C>이 표시돼요.
            {"\n"}예: 4년제 졸업 + 학사 → 학사학위 84학점
          </>
        ),
        placement: "bottom",
      },
      {
        target: '[data-guide="plan-stats"]',
        title: "진행 현황",
        content: (
          <>
            카테고리별 <B>이수 학점</B>과 <C>목표 대비 진행률</C>을 한눈에 볼 수
            있어요.
            {"\n"}과목을 학기에 배정하면 즉시 업데이트됩니다.
          </>
        ),
        placement: "bottom",
      },
      {
        target: '[data-guide="plan-subject-panel"]',
        title: "과목 목록 (좌측)",
        content: (
          <>
            <B>전공·교양·일반</B> 등 카테고리별 과목 리스트.
            {"\n"}• <B>+ 추가</B> 버튼으로 학생 전용 과목 추가
            {"\n"}• 과목 클릭 → <S>현재 학기에 배정</S>
            {"\n"}• 이미 배정된 과목은 회색, <S>이수 완료(60점 이상)</S>는
            초록색
          </>
        ),
        placement: "right",
      },
      {
        target: '[data-guide="plan-semester-panel"]',
        title: "학기별 수강 계획 (우측)",
        content: (
          <>
            학기 단위로 과목을 배정·점수를 입력하는 곳이에요.
            {"\n"}• <B>+ 수강계획 추가</B> — 새 학기 추가
            {"\n"}• 한 학기 최대 <W>8과목</W> · 한 해 최대 <W>14과목</W>
            {"\n"}• 학기마다 <C>시작/종료일·교육원</C> 설정 가능
          </>
        ),
        placement: "left",
      },
      {
        target: '[data-guide="plan-fullview-btn"]',
        title: "전체보기 · PDF",
        content: (
          <>
            <B>[전체보기]</B>를 누르면 학습플랜 인쇄용 표가 떠요.
            {"\n"}거기서 <S>PDF 다운로드</S>도 가능합니다 (학생에게 전달용).
          </>
        ),
        placement: "bottom",
      },
      {
        target: '[data-guide="plan-save-indicator"]',
        title: "자동 저장",
        content: (
          <>
            변경 시 <S>저장됨</S> / <C>저장 중...</C> 표시로 상태 확인 가능.
            {"\n"}별도 저장 버튼 없이 <B>모든 변경이 자동 반영</B>돼요.
          </>
        ),
        placement: "bottom",
      },
      {
        title: "끝났어요!",
        content: (
          <>
            언제든 헤더의 <C>[가이드] 버튼</C>으로 가이드를 다시 볼 수 있어요.
          </>
        ),
      },
    ],
  },
  // ─── 등록학생관리 가이드 (탭 컴포넌트에서 startById로 호출) ────────────────
  {
    id: "edu-students-basics",
    label: "등록학생관리 사용법",
    // matchPath 없음 → 컴포넌트(EduStudentsTab)에서 직접 startById로 시작
    steps: [
      {
        title: "등록학생관리 가이드",
        content: (
          <>
            등록된 학생을 <B>관리·수정</B>하는 페이지예요.
            {"\n\n"}
            가이드 동안 임시로 <C>예시 학생 3명</C>이 목록에 표시됩니다.
            {"\n"}
            <W>※ 실제 데이터 아닙니다 (가이드 종료 시 자동 제거)</W>
            {"\n\n"}
            특히 <S>학생 추가</S> 시 <C>이름·전화번호</C>만 입력하면 문의DB에서
            정보를 자동으로 채워주는 흐름을 시뮬레이션으로 보여드릴게요.
          </>
        ),
        fireEvent: "guide-edu-action:demo-list-on",
      },
      {
        target: '[data-guide="edu-search"]',
        title: "검색",
        content: (
          <>
            <B>이름</B> 또는 <B>전화번호</B>로 학생을 빠르게 찾을 수 있어요.
          </>
        ),
        placement: "bottom",
      },
      {
        target: '[data-guide="edu-table"]',
        title: "학생 목록",
        content: (
          <>
            등록된 학생이 표로 정리됩니다. <B>이름을 클릭</B>하면 상세 페이지로
            이동해 학기·등록정보 등을 관리할 수 있어요.
          </>
        ),
        placement: "top",
      },
      {
        target: '[data-guide="edu-add-student-btn"]',
        title: "학생 추가 (자동 채움 데모)",
        content: (
          <>
            <B>+ 학생 추가</B> 버튼을 자동으로 눌러 모달을 열게요.
            {"\n"}이름과 전화번호만 입력하면 문의DB에서 정보를 <S>자동 채움</S>
            해주는 흐름을 보여드릴게요.
          </>
        ),
        placement: "left",
        fireEvent: "guide-edu-action:open-add-modal",
        waitMs: 600,
      },
      {
        target: '[data-guide="edu-modal-name"]',
        title: "1단계 — 이름 입력",
        content: (
          <>
            <C>홍길동</C>을 직접 입력해보세요.
            {"\n\n"}
            정확히 입력하면 자동으로 다음 단계로 넘어갑니다.
          </>
        ),
        placement: "right",
        compact: true,
        waitMs: 400,
        advanceOn: "guide-edu-input-name-done",
        hideNext: true,
      },
      {
        target: '[data-guide="edu-modal-phone"]',
        title: "2단계 — 전화번호 입력",
        content: (
          <>
            <C>01012345678</C>을 직접 입력해보세요.
            {"\n\n"}
            정확히 11자리 입력하면 자동으로 다음 단계로 진행됩니다.{"\n"}
            실제로는 이 시점에 시스템이 문의DB에서 <S>같은 이름·번호</S>를
            검색해 정보를 자동으로 채워줍니다.
          </>
        ),
        placement: "right",
        compact: true,
        waitMs: 400,
        advanceOn: "guide-edu-input-phone-done",
        hideNext: true,
      },
      {
        title: "3단계 — 문의DB 자동 매칭",
        content: (
          <>
            방금 입력한 <B>이름·전화번호</B>로 문의DB를 검색해서 핵심 정보를{" "}
            <S>한 번에 채워줘요</S>.
            {"\n\n"}
            매칭되는 필드:
            {"\n"}• <C>최종학력</C>
            {"\n"}• <C>희망자격증과정</C>
            {"\n"}• <C>담당자</C>
            {"\n"}• <C>과목당 비용</C>
            {"\n"}• <C>메모</C>
            {"\n\n"}
            <S>다음</S>을 눌러 각 필드를 확인하세요.
          </>
        ),
        fireEvent: "guide-edu-modal-action:auto-fill",
        compact: true,
        waitMs: 400,
      },
      {
        target: '[data-guide="edu-modal-autofilled"]',
        title: "최종학력",
        content: <><B>4년제졸업</B>으로 자동 매칭됐어요.</>,
        placement: "right",
        compact: true,
      },
      {
        target: '[data-guide="edu-modal-course"]',
        title: "희망자격증과정",
        content: <><B>사회복지사2급(구법)</B>으로 자동 매칭됐어요.</>,
        placement: "right",
        compact: true,
      },
      {
        target: '[data-guide="edu-modal-manager"]',
        title: "담당자",
        content: <><B>이규준</B>으로 자동 매칭됐어요.</>,
        placement: "right",
        compact: true,
      },
      {
        target: '[data-guide="edu-modal-unit-price"]',
        title: "과목당 비용",
        content: <><B>150,000원</B>으로 자동 매칭됐어요.</>,
        placement: "right",
        compact: true,
      },
      {
        target: '[data-guide="edu-modal-notes"]',
        title: "메모",
        content: (
          <>
            문의DB의 메모도 함께 복사돼요.
            {"\n"}
            <C>가이드 예시 — 문의DB에서 자동 채움</C>
          </>
        ),
        placement: "top",
        compact: true,
      },
      {
        title: "4단계 — 마무리",
        content: (
          <>
            핵심 필드가 <S>자동으로 채워진</S> 모습을 확인하세요.
            {"\n\n"}
            <B>희망학위·전공·교육원·기수·비용·목표일</B> 등은 사용자가 직접
            입력하면 됩니다.
            {"\n\n"}
            마지막으로 <S>[저장]</S>을 누르면 등록 완료!
          </>
        ),
        compact: true,
      },
      {
        title: "끝났어요!",
        content: (
          <>
            요약:
            {"\n"}• <C>+ 학생 추가</C> → 이름·전화번호 입력
            {"\n"}• 문의DB에서 <S>자동 채움</S>
            {"\n"}• 나머지 필드 확인 후 저장
            {"\n\n"}
            언제든 필터 영역의 <C>[가이드] 버튼</C>으로 다시 볼 수 있어요.
          </>
        ),
        fireEvent: "guide-edu-action:close-add-modal",
      },
    ],
  },
  // ─── 전자결재 — 인사: 휴가신청서 ─────────────────────────────────────────
  {
    id: "approvals-vacation",
    label: "휴가신청서",
    category: "인사",
    description: "연차·반차·경조사 등 휴가 신청 방법",
    steps: [
      {
        title: "휴가신청서 가이드",
        content: (
          <>
            <B>휴가신청서</B> 양식을 자동으로 열어드릴게요.
            {"\n\n"}
            연차·반차·경조사 등 유형을 선택하고, 기간·사유를 입력해 결재를
            올립니다.
          </>
        ),
        fireEvent: "guide-apv-action:open-form-by-type:휴가신청서",
        waitMs: 600,
      },
      {
        target: '[data-guide="approvals-body-section"]',
        title: "본문 — 예시 자동 채움",
        content: (
          <>
            본문에 <S>예시 데이터가 자동 입력</S>됐어요:
            {"\n"}• 휴가 유형: <C>연차</C>
            {"\n"}• 기간: <C>2026.05.20 ~ 2026.05.22</C>
            {"\n"}• 사유: <C>개인 휴식</C>
            {"\n\n"}
            실제 사용 시에는 <B>본인 휴가 정보</B>로 수정하면 됩니다.
            {"\n"}경조사 휴가는 <C>증빙서류</C>도 첨부하세요.
          </>
        ),
        placement: "right",
        compact: true,
      },
      {
        target: '[data-guide="approvals-submit-btn"]',
        title: "결재 신청",
        content: (
          <>
            결재선이 자동 설정되어 있어요. <B>[결재요청]</B>을 누르면 휴가 결재
            시작!
          </>
        ),
        placement: "left",
        compact: true,
      },
      {
        title: "끝났어요!",
        content: (
          <>
            언제든 좌측 <C>[가이드] 버튼</C>으로 다시 볼 수 있어요.
          </>
        ),
        fireEvent: "guide-apv-action:demo-end",
      },
    ],
  },
  // ─── 전자결재 — 인사: 근태사유서 ─────────────────────────────────────────
  {
    id: "approvals-attendance",
    label: "근태사유서",
    category: "인사",
    description: "지각·조퇴·결근 사유를 보고",
    steps: [
      {
        title: "근태사유서 가이드",
        content: (
          <>
            <B>지각·조퇴·결근</B> 등 근태 이슈 발생 시 사유를 보고하는 양식이에요.
            {"\n\n"}
            양식을 자동으로 열어드릴게요.
          </>
        ),
        fireEvent: "guide-apv-action:open-form-by-type:근태사유서",
        waitMs: 600,
      },
      {
        target: '[data-guide="approvals-body-section"]',
        title: "본문 — 예시 자동 채움",
        content: (
          <>
            본문에 <S>예시 데이터가 자동 입력</S>됐어요:
            {"\n"}• 날짜: <C>2026.05.15</C>
            {"\n"}• 구분: <C>지각</C>
            {"\n"}• 사유: <C>교통 지연으로 인한 지각</C>
            {"\n\n"}
            실제 사용 시에는 <B>해당 근태 정보</B>로 수정하세요.
          </>
        ),
        placement: "right",
        compact: true,
      },
      {
        target: '[data-guide="approvals-submit-btn"]',
        title: "결재 신청",
        content: (
          <>
            작성 완료 후 <B>[결재요청]</B>을 눌러 제출하세요.
          </>
        ),
        placement: "left",
        compact: true,
      },
      {
        title: "끝났어요!",
        content: <>가이드 모음에서 다른 양식 가이드도 확인하세요.</>,
        fireEvent: "guide-apv-action:demo-end",
      },
    ],
  },
  // ─── 전자결재 — 인사: 명함 신청서 ────────────────────────────────────────
  {
    id: "approvals-business-card",
    label: "명함 신청서",
    category: "인사",
    description: "신규 입사·직책 변경 시 명함 발주 신청",
    steps: [
      {
        title: "명함 신청서 가이드",
        content: (
          <>
            <B>신규 입사</B>·<B>직책 변경</B> 시 명함 발주를 요청하는 양식이에요.
            {"\n\n"}
            양식을 자동으로 열어드릴게요.
          </>
        ),
        fireEvent: "guide-apv-action:open-form-by-type:명함 신청서",
        waitMs: 600,
      },
      {
        target: '[data-guide="approvals-body-section"]',
        title: "본문 — 예시 자동 채움",
        content: (
          <>
            본문에 <S>예시 데이터가 자동 입력</S>됐어요:
            {"\n"}• 부서: <C>교육사업부</C> / 직급: <C>대리</C>
            {"\n"}• 이름: <C>홍길동</C>
            {"\n"}• 연락처: <C>010-1234-5678</C>
            {"\n"}• 이메일: <C>hong@korhrd.com</C>
            {"\n\n"}
            실제 사용 시 <B>본인 정보</B>로 수정하세요.
          </>
        ),
        placement: "right",
        compact: true,
      },
      {
        target: '[data-guide="approvals-submit-btn"]',
        title: "결재 신청",
        content: <><B>[결재요청]</B>으로 신청 완료!</>,
        placement: "left",
        compact: true,
      },
      {
        title: "끝났어요!",
        content: <>승인되면 명함 제작이 진행됩니다.</>,
        fireEvent: "guide-apv-action:demo-end",
      },
    ],
  },
  // ─── 전자결재 — 인사: 사원증 신청서 ──────────────────────────────────────
  {
    id: "approvals-employee-id",
    label: "사원증 신청서",
    category: "인사",
    description: "사원증 신규 발급·재발급",
    steps: [
      {
        title: "사원증 신청서 가이드",
        content: (
          <>
            사원증 <B>신규 발급</B>·<B>재발급</B> 요청 양식이에요.
            {"\n\n"}
            양식을 자동으로 열어드릴게요.
          </>
        ),
        fireEvent: "guide-apv-action:open-form-by-type:사원증 신청서",
        waitMs: 600,
      },
      {
        target: '[data-guide="approvals-body-section"]',
        title: "본문 — 예시 자동 채움",
        content: (
          <>
            본문에 <S>예시 데이터가 자동 입력</S>됐어요:
            {"\n"}• 부서: <C>교육사업부</C>
            {"\n"}• 이름: <C>홍길동</C>
            {"\n"}• 영문이름: <C>Hong Gildong</C>
            {"\n\n"}
            <B>재발급</B>일 경우 분실 경위 등을 사유에 추가하세요.
          </>
        ),
        placement: "right",
        compact: true,
      },
      {
        target: '[data-guide="approvals-submit-btn"]',
        title: "결재 신청",
        content: <><B>[결재요청]</B>으로 신청 완료!</>,
        placement: "left",
        compact: true,
      },
      {
        title: "끝났어요!",
        content: <>승인되면 사원증이 발급됩니다.</>,
        fireEvent: "guide-apv-action:demo-end",
      },
    ],
  },
  // ─── 전자결재 — 인사: 인수인계요청서 ─────────────────────────────────────
  {
    id: "approvals-handover",
    label: "인수인계요청서",
    category: "인사",
    description: "퇴사·이동 시 업무 인수인계 정리",
    steps: [
      {
        title: "인수인계요청서 가이드",
        content: (
          <>
            퇴사·이동 시 <B>맡고 있던 업무를 정리해서 인계</B>하는 양식이에요.
            {"\n\n"}
            양식을 자동으로 열어드릴게요.
          </>
        ),
        fireEvent: "guide-apv-action:open-form-by-type:인수인계요청서",
        waitMs: 600,
      },
      {
        target: '[data-guide="approvals-body-section"]',
        title: "본문 — 예시 자동 채움",
        content: (
          <>
            본문에 <S>예시 데이터가 자동 입력</S>됐어요:
            {"\n"}• 인계자: <C>홍길동 (교육사업부 / 사원)</C>
            {"\n"}• 인수자: <C>김인수 (교육사업부 / 대리)</C>
            {"\n"}• 업무: <C>문의DB 관리, 등록학생관리</C>
            {"\n\n"}
            실제 사용 시 <B>실제 업무 내용</B>으로 상세히 수정하세요. 공식
            인수인계의 근거가 됩니다.
          </>
        ),
        placement: "right",
        compact: true,
      },
      {
        target: '[data-guide="approvals-submit-btn"]',
        title: "결재 신청",
        content: <><B>[결재요청]</B>으로 인계 처리 시작!</>,
        placement: "left",
        compact: true,
      },
      {
        title: "끝났어요!",
        content: <>승인 후 인수인계가 공식 처리됩니다.</>,
        fireEvent: "guide-apv-action:demo-end",
      },
    ],
  },
  // ─── 전자결재 — 인사: 퇴사확정일 요청서 ──────────────────────────────────
  {
    id: "approvals-resignation",
    label: "퇴사확정일 요청서",
    category: "인사",
    description: "퇴사 의사 표명 + 퇴사일 확정 요청",
    steps: [
      {
        title: "퇴사확정일 요청서 가이드",
        content: (
          <>
            퇴사 의사를 공식적으로 보고하고 <B>퇴사일 확정</B>을 요청하는
            양식이에요.
            {"\n\n"}
            양식을 자동으로 열어드릴게요.
          </>
        ),
        fireEvent: "guide-apv-action:open-form-by-type:퇴사확정일 요청서",
        waitMs: 600,
      },
      {
        target: '[data-guide="approvals-body-section"]',
        title: "본문 — 예시 자동 채움",
        content: (
          <>
            본문에 <S>예시 데이터가 자동 입력</S>됐어요:
            {"\n"}• 부서: <C>교육사업부</C>
            {"\n"}• 입사일: <C>2025.01.15</C>
            {"\n"}• 인수인계 기간: <C>2026.05.20 ~ 2026.05.25</C>
            {"\n"}• 사유: <C>개인 사정</C>
            {"\n\n"}
            <W>※ 통상 30일 전 제출 권장</W>
          </>
        ),
        placement: "right",
        compact: true,
      },
      {
        target: '[data-guide="approvals-submit-btn"]',
        title: "결재 신청",
        content: <><B>[결재요청]</B>으로 제출하면 인사팀에서 확정 진행!</>,
        placement: "left",
        compact: true,
      },
      {
        title: "끝났어요!",
        content: <>승인 후 퇴사 절차가 시작됩니다.</>,
        fireEvent: "guide-apv-action:demo-end",
      },
    ],
  },
];

export function getGuideByPath(pathname: string): GuideDef | null {
  return (
    GUIDES.find((g) => !!g.matchPath && pathname.startsWith(g.matchPath)) ??
    null
  );
}

export function getGuideById(id: string): GuideDef | null {
  return GUIDES.find((g) => g.id === id) ?? null;
}

/** 카테고리 → 가이드 목록 매핑 (가이드 모음 UI용) */
export function getGuidesGroupedByCategory(
  filter?: (g: GuideDef) => boolean,
): Record<string, GuideDef[]> {
  const groups: Record<string, GuideDef[]> = {};
  for (const g of GUIDES) {
    if (filter && !filter(g)) continue;
    const cat = g.category ?? "기타";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(g);
  }
  return groups;
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
