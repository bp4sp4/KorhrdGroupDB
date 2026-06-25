import type { AgencyStatus, ConsultationStatus } from "./_types";

// ─── 상태/카테고리 옵션 ────────────────────────────────────────────────────

export const CONSULTATION_STATUS_OPTIONS: ConsultationStatus[] = [
  "부재중/추후통화",
  "상담대기",
  "상담완료-높음",
  "상담완료-중간",
  "상담완료-낮음",
  "장기가망",
  "수신거부",
  "등록완료",
  "지인등록",
  "지인취소",
  "지인대기",
  "기타",
];

export const AGENCY_STATUS_OPTIONS: AgencyStatus[] = [
  "협약대기",
  "협약중",
  "보류",
  "협약완료",
];

export const COUNSEL_SUB: ConsultationStatus[] = [
  "상담완료-높음",
  "상담완료-중간",
  "상담완료-낮음",
];

export const COUNSEL_SUB_LABEL: Record<string, string> = {
  "상담완료-높음": "높음",
  "상담완료-중간": "중간",
  "상담완료-낮음": "낮음",
};

export const CONSULTATION_STATUS_STYLE: Record<
  ConsultationStatus,
  { background: string; color: string }
> = {
  "부재중/추후통화": { background: "#F3F4F6", color: "#6B7684" },
  상담대기: { background: "#EBF3FE", color: "#3182F6" },
  "상담완료-높음": { background: "#E0F7FA", color: "#0277BD" },
  "상담완료-중간": { background: "#FFFDE7", color: "#F57F17" },
  "상담완료-낮음": { background: "#FCE4EC", color: "#C62828" },
  장기가망: { background: "#F3E8FF", color: "#7C3AED" },
  수신거부: { background: "#FEE2E2", color: "#DC2626" },
  등록완료: { background: "#DCFCE7", color: "#16A34A" },
  지인등록: { background: "#FFF0E6", color: "#EA580C" },
  지인취소: { background: "#FEF0F0", color: "#B91C1C" },
  지인대기: { background: "#FFF7ED", color: "#D97706" },
  기타: { background: "#F0FFF4", color: "#059669" },
};

export const AGENCY_STATUS_STYLE: Record<
  AgencyStatus,
  { background: string; color: string }
> = {
  협약대기: { background: "#EBF3FE", color: "#3182F6" },
  협약중: { background: "#FFF8E6", color: "#D97706" },
  보류: { background: "#F3F4F6", color: "#6B7684" },
  협약완료: { background: "#DCFCE7", color: "#16A34A" },
};

export const CERT_MAJOR_CATEGORIES = [
  "전체과정",
  "실버과정",
  "아동과정",
  "방과후과정",
  "심리과정",
  "커피과정",
  "취·창업과정",
];

export const COUNSEL_CHECK_OPTIONS = [
  "비용",
  "주변반대",
  "시간부족",
  "의지부족",
  "타교육원",
  "연락두절",
  "개인사정",
  "당장 불필요",
];

export const REASON_OPTIONS = ["즉시취업", "이직", "미래준비", "취미"];

export const EDUCATION_OPTIONS = [
  "고졸",
  "2년제 중퇴",
  "2년제 졸업",
  "3년제 중퇴",
  "3년제 졸업",
  "4년제 중퇴",
  "4년제 졸업",
  "대학원 이상",
  "대학교졸업(외국)",
] as const;

export const HAKJEOM_COURSE_OPTIONS = [
  "사회복지사2급 - 신법",
  "사회복지사2급 - 구법",
  "사회복지사 (실습예정)",
  "건강가정사",
  "직접입력",
];

// 상담 시작(응답시간) 기능 적용 시점 — 이 시각 이후 배정된 건만 '상담 시작' 버튼/연락처 가림 노출.
// (이전에 배정된 건은 기존처럼 연락처 바로 노출, 버튼 없음)
export const CONSULT_START_SINCE = "2026-06-25T17:00:00+09:00";

export function consultStartEligible(
  managerAssignedAt?: string | null,
): boolean {
  if (!managerAssignedAt) return false;
  return new Date(managerAssignedAt) >= new Date(CONSULT_START_SINCE);
}

export const CURRENT_SITUATION_OPTIONS = [
  "주부",
  "직장인",
  "자영업자",
  "대학생",
  "기타",
];

export const REACTION_POINT_MAP: Record<string, string[]> = {
  가격: ["비싸다", "비교중", "할인에반응"],
  취업: ["취업희망", "취업연계", "노후대비"],
  과정: ["공부부담", "시간부족"],
  신뢰: ["교육원의심", "자격증효력"],
  실습: ["거리부담", "시간부담", "섭외부담"],
  무반응: ["무반응"],
};

// 반응포인트 자동 체크 시 토스트 알림 표시 여부
// 테스트 기간 동안 false로 두면 자동 체크는 그대로 동작하되 토스트만 안 뜸
// 운영 배포 전 true로 복원
export const SHOW_AUTO_REACTION_TOAST = false;

// 메모 텍스트 → 반응포인트 자동 매칭용 키워드 사전
export const REACTION_KEYWORD_MAP: Record<string, string[]> = {
  비싸다: [
    "비싸", "비쌈", "부담", "가격", "비용", "금액", "돈", "여유", "형편",
    "경제", "금전", "생활비", "카드값", "카드한도", "현금", "할부", "할인",
    "지원", "혜택", "이벤트", "저렴", "싼", "추가비용", "발급비", "수강료",
    "등록금", "예산", "월급", "사정", "깎아", "무료", "국가지원", "납부",
    "자부담금",
  ],
  비교중: [
    "비교", "알아보", "다른데", "다른교육원", "다른 데", "다른 교육원",
    "타교육원", "상담", "이런데",
  ],
  취업희망: [
    "취업", "취직", "재취업", "구직", "채용", "면접", "출근", "근무",
    "일자리", "일구하", "회사", "취업준비", "취업목적", "일하려고",
    "일하고싶", "취업생각", "취업하려고", "근무가능", "취직하려고",
  ],
  취업연계: [
    "취업연계", "연계", "연결", "취업지원", "취업상담", "취업처", "기관소개",
    "센터소개", "자리연결", "연계해주", "도움주", "취업도움", "취업알선",
    "연결해주", "연계가능", "취업관리", "취업케어", "연계되는지", "취업까지",
  ],
  노후대비: [
    "노후", "미래", "은퇴", "은퇴준비", "노후준비", "미래준비", "평생직업",
    "오래할일", "안정적", "안정적인", "평생", "나중대비", "중년준비",
    "5060준비", "노후대책", "미래걱정", "오래일할", "안정감", "정년",
    "제2의직업",
  ],
  공부부담: [
    "공부", "시험", "과제", "어렵", "자신없", "컴퓨터", "못하겠",
    "할수있을지", "따라갈", "이해", "걱정", "머리", "학습", "수업",
  ],
  시간부족: [
    "시간", "바쁘", "육아", "직장", "스케줄", "여유없", "틈이없",
    "언제듣", "기간", "오래걸", "오래", "출석", "시간맞추", "시간안",
    "일정", "병행",
  ],
  교육원의심: [
    "의심", "못믿", "사기", "진짜", "실제", "믿을수있", "괜찮은곳",
    "인증", "정식", "등록된", "합법", "문제없", "안전한", "후기", "리뷰",
    "평판", "교육원맞", "사업자", "운영", "확인", "신뢰", "불안", "의심된",
    "걱정된", "광고같", "너무좋", "진짜되", "실제되", "진짜맞", "정식기관",
    "정부기관",
  ],
  자격증효력: [
    "효력", "인정", "인정되", "이력서", "사용가능", "쓸수있", "도움되",
    "국가인정", "활용", "취업가능", "자격인정", "효력있", "의미있",
    "인정받", "실제사용", "취업쓸수있", "어디쓰", "활용가능", "민간자격증",
    "효용", "도움되는지", "실효성",
  ],
  거리부담: [
    "거리", "멀다", "왕복", "이동", "지역", "근처", "가까운곳", "출퇴근",
    "지방", "인근", "집근처", "이동시간", "왔다갔다", "주말", "평일",
  ],
  시간부담: [
    "실습시간", "실습 시간", "실습기간", "실습 기간", "실습일정",
    "실습 일정", "실습출석", "실습 출석", "실습부담", "실습 부담",
    "실습오래", "실습 오래", "실습너무", "실습 너무", "실습이 길",
    "실습이 오래", "실습 못 빼", "실습 못빼", "실습 시간이", "실습일이",
    "실습일 때문",
  ],
  섭외부담: [
    "섭외", "구해야", "알아봐야", "전화돌리", "기관찾", "직접구하",
    "자리없", "안받아준", "못구하", "실습처구하", "기관섭외", "컨택",
    "배정", "연결해주", "매칭",
  ],
  무반응: [
    "그냥", "잠수", "회피", "안받으심", "부재", "미응답", "카톡안봄",
    "계속부재",
  ],
};

export function matchReactionPoints(text: string): string[] {
  if (!text) return [];
  const lowered = text.toLowerCase();
  const matched: string[] = [];
  for (const [point, keywords] of Object.entries(REACTION_KEYWORD_MAP)) {
    if (keywords.some((kw) => lowered.includes(kw.toLowerCase()))) {
      matched.push(point);
    }
  }
  return matched;
}

// ─── 학력/희망과정 직접입력 라벨 ──────────────────────────────────────────

export const EDUCATION_CUSTOM = "직접입력";
export const HOPE_COURSE_CUSTOM = "직접입력";

// ─── 유입경로 (대분류 + 카드 메타) ─────────────────────────────────────────

// 당근 기본 소재 옵션
export const DANGGEUN_DEFAULT_OPTIONS = ["채팅", "소식", "대표전화", "폼"];

// 개인마케팅(구 "지인소개") 기본 소재 옵션
export const PERSONAL_MARKETING_DEFAULT_OPTIONS = [
  "맘카페",
  "최적블로그",
  "지인소개",
];

// 개인마케팅 카드의 내부 식별자.
// 기존 데이터/백엔드 필터(`click_source LIKE '지인소개%'` 등)와의 호환을 위해
// 내부 value 는 "지인소개"를 그대로 사용하고, UI 라벨만 "개인마케팅"으로 노출한다.
export const PERSONAL_MARKETING_KEY = "지인소개";
export const PERSONAL_MARKETING_LABEL = "개인마케팅";

export const SOURCE_MAJORS = [
  "당근",
  "맘카페",
  "네이버",
  "인스타·페이스북",
  "카카오",
  "구글",
  "토스",
  "지인소개",
  "기타",
];

// 유입경로 카드 표시 라벨 (내부 value → 사용자에게 보여줄 라벨)
export const SOURCE_MAJOR_LABEL: Record<string, string> = {
  지인소개: PERSONAL_MARKETING_LABEL,
};

// 유입경로 카드 메타: 아이콘 타입과 화살표 표시 여부
export type ReferrerCardMeta =
  | { type: "img"; src: string; hasChevron?: boolean }
  | { type: "person"; hasChevron?: boolean }
  | { type: "etc" };

export const REFERRER_CARD_META: Record<string, ReferrerCardMeta> = {
  당근: { type: "img", src: "/referrer/daangn.png", hasChevron: true },
  맘카페: { type: "img", src: "/referrer/navercafe.png", hasChevron: true },
  네이버: { type: "img", src: "/referrer/naver.png" },
  "인스타·페이스북": { type: "img", src: "/referrer/meta.png" },
  카카오: { type: "img", src: "/referrer/kakao.png" },
  구글: { type: "img", src: "/referrer/google.png" },
  토스: { type: "img", src: "/referrer/toss.png" },
  지인소개: { type: "person" },
  기타: { type: "etc" },
};
