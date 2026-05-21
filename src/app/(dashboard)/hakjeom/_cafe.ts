// ─── 맘카페 데이터 + 정규화/파싱 ───────────────────────────────────────────

// 맘카페 ID → 한글 표준명 매핑
export const CAFE_NAMES: Record<string, string> = {
  cjsam: "순광맘",
  chobomamy: "러브양산맘",
  jinhaemam: "창원진해댁",
  momspanggju: "광주맘스팡",
  cjasm: "충주아사모",
  mygodsend: "화성남양애",
  yul2moms: "율하맘",
  chbabymom: "춘천맘",
  seosanmom: "서산맘",
  redog2oi: "부천소사구",
  ksn82599: "둔산맘",
  magic26: "안평맘스비",
  anjungmom: "평택안포맘",
  tlgmdaka0: "시맘수",
  babylovecafe: "양주베이비러브",
  naese: "중리사랑방",
  andongmom: "안동맘",
  donanmam: "대전도안맘",
};

// 맘카페 표준명 목록 (영문 ID 매핑 외 신규 카페 포함)
export const CAFE_CANONICAL_NAMES: string[] = [
  "순광맘", "러브양산맘", "창원진해댁", "광주맘스팡", "충주아사모",
  "화성남양애", "율하맘", "춘천맘", "서산맘", "부천소사구", "둔산맘",
  "안평맘스비", "평택안포맘", "시맘수", "양주베이비러브", "중리사랑방",
  "안동맘", "대전도안맘", "도담도담대전맘", "나주맘스팡", "전북전주알뜰맘",
  "헬로여주맘", "관저맘", "살통영", "별내맘", "세종맘", "산사모",
  "마포에서아이키우기", "청주맘스캠프", "속초쉬즈홀릭", "계양맘우리끼리",
  "영종국제도시영맘", "강봉원",
];

// 별칭 → 표준명 매핑 (carb 등록 시 표준화)
export const CAFE_ALIAS_MAP: Record<string, string> = {
  // 순광맘
  "순광맘카페": "순광맘", "순광맘까페": "순광맘", "순천광양": "순광맘",
  // 러브양산맘
  "러브양산맘카페": "러브양산맘", "러브양산맘까페": "러브양산맘", "양산맘": "러브양산맘",
  "러브양산": "러브양산맘", "양산맘카페": "러브양산맘", "양산맘까페": "러브양산맘",
  "양산러브맘": "러브양산맘",
  // 창원진해댁
  "창원진해댁카페": "창원진해댁", "창원진해댁까페": "창원진해댁", "진해댁": "창원진해댁",
  "창원맘": "창원진해댁", "진해댁카페": "창원진해댁", "진해댁사랑방": "창원진해댁",
  "진해댁들사랑방": "창원진해댁",
  // 광주맘스팡
  "광주맘스팡카페": "광주맘스팡", "광주맘스팡까페": "광주맘스팡", "광수맘": "광주맘스팡",
  // 충주아사모
  "충주아사모카페": "충주아사모", "충주아사모까페": "충주아사모", "아사모": "충주아사모",
  "충주맘": "충주아사모", "충주맘카페": "충주아사모", "충주맘까페": "충주아사모",
  "충주아이사랑": "충주아사모", "아이사랑모임": "충주아사모",
  // 화성남양애
  "화성남양애카페": "화성남양애", "화성남양애까페": "화성남양애", "남양애": "화성남양애",
  "화성맘": "화성남양애", "남양맘": "화성남양애", "화성남양": "화성남양애",
  // 율하맘
  "율하맘카페": "율하맘", "율하맘까페": "율하맘", "김해율하맘": "율하맘",
  "장유율하맘": "율하맘", "김해맘": "율하맘", "김해율하맘카페": "율하맘",
  "장유율하맘카페": "율하맘",
  // 춘천맘
  "춘천맘카페": "춘천맘", "춘천맘까페": "춘천맘", "춘천맘모여라": "춘천맘",
  // 서산맘
  "서산맘카페": "서산맘", "서산맘까페": "서산맘", "서산엄마들의모임": "서산맘",
  "서산모임": "서산맘",
  // 부천소사구
  "부천소사구카페": "부천소사구", "부천소사구까페": "부천소사구", "부천맘": "부천소사구",
  "소사맘": "부천소사구", "부천맘까페": "부천소사구", "부천맘카페": "부천소사구",
  "소사맘카페": "부천소사구", "소사맘까페": "부천소사구",
  // 둔산맘
  "둔산맘카페": "둔산맘", "둔산맘까페": "둔산맘", "둔산동맘": "둔산맘",
  "대전둔산맘": "둔산맘",
  // 안평맘스비
  "안평맘스비카페": "안평맘스비", "안평맘스비까페": "안평맘스비", "맘스비": "안평맘스비",
  "안평맘": "안평맘스비", "안평맘맘스비": "안평맘스비",
  // 평택안포맘
  "평택안포맘카페": "평택안포맘", "평택안포맘까페": "평택안포맘", "평택안포": "평택안포맘",
  "안포맘": "평택안포맘",
  // 시맘수
  "시맘수카페": "시맘수", "시맘수까페": "시맘수", "시흥맘": "시맘수",
  "시흥맘들의수다방": "시맘수", "시흥수다방": "시맘수", "시흥맘수다방": "시맘수",
  // 양주베이비러브
  "양주베이비러브카페": "양주베이비러브", "양주베이비러브까페": "양주베이비러브",
  "양주시베이비러브": "양주베이비러브", "양주맘카페": "양주베이비러브",
  "양주맘까페": "양주베이비러브", "베이비러브맘": "양주베이비러브",
  "베이비러브": "양주베이비러브", "양주베럽": "양주베이비러브",
  "베이비럽": "양주베이비러브", "양주베이비럽": "양주베이비러브",
  // 중리사랑방
  "중리사랑방카페": "중리사랑방", "중리사랑방까페": "중리사랑방", "중사방": "중리사랑방",
  "중리맘": "중리사랑방", "중사맘": "중리사랑방",
  // 안동맘
  "안동맘카페": "안동맘", "안동맘까페": "안동맘", "안동맘수다방": "안동맘",
  "안동수다방": "안동맘",
  // 대전도안맘
  "대전도안맘카페": "대전도안맘", "대전도안맘까페": "대전도안맘", "도안맘": "대전도안맘",
  "도안맘카페": "대전도안맘", "도안맘까페": "대전도안맘",
  // 도담도담대전맘
  "도담도담대전맘카페": "도담도담대전맘", "도담도담대전맘까페": "도담도담대전맘",
  "도담대전맘": "도담도담대전맘", "도담도담": "도담도담대전맘",
  "대전도담도담": "도담도담대전맘",
  // 나주맘스팡
  "나주맘스팡카페": "나주맘스팡", "나주맘스팡까페": "나주맘스팡", "나주맘": "나주맘스팡",
  "나주맘카페": "나주맘스팡", "나주맘까페": "나주맘스팡", "나주맘 맘스팡": "나주맘스팡",
  // 전북전주알뜰맘
  "전북전주알뜰맘카페": "전북전주알뜰맘", "전북전주알뜰맘까페": "전북전주알뜰맘",
  "전북&전주알뜰맘": "전북전주알뜰맘", "알뜰맘": "전북전주알뜰맘",
  "전북알뜰맘": "전북전주알뜰맘", "전주알뜰맘": "전북전주알뜰맘",
  // 헬로여주맘
  "헬로여주맘카페": "헬로여주맘", "헬로여주맘까페": "헬로여주맘", "헬주맘": "헬로여주맘",
  "여주맘": "헬로여주맘", "헬주맘카페": "헬로여주맘", "헬주맘까페": "헬로여주맘",
  "여주맘카페": "헬로여주맘", "여주맘까페": "헬로여주맘",
  // 관저맘
  "관저맘카페": "관저맘", "관저맘까페": "관저맘", "관저힐링": "관저맘",
  "구르터": "관저맘", "관저맘힐링": "관저맘", "힐링관저맘": "관저맘",
  "힐링그루터": "관저맘", "힐터맘": "관저맘",
  // 살통영
  "살통영카페": "살통영", "살통영까페": "살통영", "통영맘": "살통영",
  "통영맘카페": "살통영", "통영맘까페": "살통영", "쌀통영": "살통영", "살통맘": "살통영",
  // 별내맘
  "별내맘카페": "별내맘", "별내맘까페": "별내맘", "남양주별내맘": "별내맘",
  // 세종맘
  "세종맘카페": "세종맘", "세종맘까페": "세종맘",
  // 산사모
  "산사모카페": "산사모", "산사모까페": "산사모", "군포맘": "산사모",
  "군포맘카페": "산사모", "군포맘까페": "산사모", "산본맘": "산사모",
  "산본맘카페": "산사모", "산본맘까페": "산사모",
  // 마포에서아이키우기
  "마포에서아이키우기카페": "마포에서아이키우기", "마포에서아이키우기까페": "마포에서아이키우기",
  "마이키": "마포에서아이키우기", "마이키카페": "마포에서아이키우기",
  "마이키까페": "마포에서아이키우기",
  // 청주맘스캠프
  "청주맘": "청주맘스캠프", "청주맘스캠프카페": "청주맘스캠프",
  "청주맘스캠프까페": "청주맘스캠프", "맘스캠프": "청주맘스캠프",
  // 속초쉬즈홀릭
  "속초쉬즈홀릭카페": "속초쉬즈홀릭", "속초쉬즈홀릭까페": "속초쉬즈홀릭",
  "속초맘": "속초쉬즈홀릭", "속초맘카페": "속초쉬즈홀릭", "속초맘까페": "속초쉬즈홀릭",
  "쉬즈홀릭": "속초쉬즈홀릭", "쉬즈홀릭카페": "속초쉬즈홀릭",
  "쉬즈홀릭까페": "속초쉬즈홀릭", "속초홀릭": "속초쉬즈홀릭",
  "속초홀릭카페": "속초쉬즈홀릭", "속초홀릭까페": "속초쉬즈홀릭",
  // 계양맘우리끼리
  "계양맘우리끼리카페": "계양맘우리끼리", "계양맘우리끼리까페": "계양맘우리끼리",
  "우리끼리": "계양맘우리끼리", "계양맘": "계양맘우리끼리",
  "계양구우리끼리": "계양맘우리끼리",
  // 영종국제도시영맘
  "영종국제도시영맘카페": "영종국제도시영맘", "영종국제도시영맘까페": "영종국제도시영맘",
  "영맘": "영종국제도시영맘", "영맘카페": "영종국제도시영맘",
  "영맘까페": "영종국제도시영맘", "영종도맘": "영종국제도시영맘",
  "영종도맘카페": "영종국제도시영맘", "영종도맘까페": "영종국제도시영맘",
  "영종국제도시맘": "영종국제도시영맘",
  // 강봉원
  "강봉원카페": "강봉원", "강봉원까페": "강봉원", "노도강": "강봉원",
  "강봉원맘": "강봉원", "노원맘": "강봉원", "강북맘": "강봉원", "도봉맘": "강봉원",
};

// 텍스트에서 카페 별칭 정규화 — 매칭되면 표준명 반환, 없으면 원본 반환
export function normalizeCafeName(raw: string): string {
  if (!raw) return raw;
  const cleaned = raw.trim();
  // 이미 표준명이면 그대로
  if (CAFE_CANONICAL_NAMES.includes(cleaned)) return cleaned;
  // alias map 직접 매칭
  if (CAFE_ALIAS_MAP[cleaned]) return CAFE_ALIAS_MAP[cleaned];
  // 부분 일치 — alias가 raw 안에 포함되는 경우
  for (const [alias, canonical] of Object.entries(CAFE_ALIAS_MAP)) {
    if (cleaned.includes(alias)) return canonical;
  }
  for (const canonical of CAFE_CANONICAL_NAMES) {
    if (cleaned.includes(canonical)) return canonical;
  }
  return cleaned;
}

// click_source 파싱: "대분류_중분류" → { major, minor(한글), needsCheck }
export const KNOWN_CAFE_IDS = new Set(Object.keys(CAFE_NAMES));
export const KNOWN_CAFE_KOREAN = new Set([
  ...Object.values(CAFE_NAMES),
  ...CAFE_CANONICAL_NAMES,
]);

// 외부 유입 라벨(영문/구식 한글) → 표준 대분류로 정규화
export function normalizeSourceMajor(major: string): string {
  if (!major) return major;
  const lower = major.toLowerCase();
  if (["meta", "instagram", "insta", "facebook", "fb", "ig"].includes(lower))
    return "인스타·페이스북";
  if (major === "인스타" || major === "페이스북") return "인스타·페이스북";
  return major;
}

export function parseClickSource(
  source: string | null,
  customCafes: string[] = [],
): { major: string; minor: string; needsCheck: boolean } {
  if (!source) return { major: "", minor: "", needsCheck: false };
  const stripped = source.startsWith("바로폼_") ? source.slice(4) : source;
  const idx = stripped.indexOf("_");
  if (idx === -1)
    return {
      major: normalizeSourceMajor(stripped),
      minor: "",
      needsCheck: false,
    };
  const rawMajor = stripped.slice(0, idx);
  const major = normalizeSourceMajor(rawMajor);
  const rawMinor = stripped.slice(idx + 1);
  const cleanedMinor = rawMinor.replace(/\(확인필요\)/g, "");
  // 1) 영문 ID → 한글, 2) 한글 별칭 → 표준명
  const fromEnglish = CAFE_NAMES[cleanedMinor];
  const resolvedName = fromEnglish ?? normalizeCafeName(cleanedMinor);
  const isUnknownMamcafe =
    major === "맘카페" &&
    cleanedMinor !== "확인필요" &&
    !KNOWN_CAFE_IDS.has(cleanedMinor) &&
    !KNOWN_CAFE_KOREAN.has(resolvedName) &&
    !customCafes.includes(resolvedName);
  const minor = isUnknownMamcafe ? `${resolvedName}(확인필요)` : resolvedName;
  return {
    major,
    minor,
    needsCheck: isUnknownMamcafe || rawMinor === "확인필요",
  };
}

// click_source를 사람이 읽기 쉬운 형태로 변환
// "맘카페_momspanggju" → "맘카페 > 광주맘스팡"
// "맘카페_둔산맘" → "맘카페 > 둔산맘" (이미 한글인 경우 그대로)
export function formatClickSourceDisplay(source: string | null): string {
  if (!source) return "-";
  const stripped = source.startsWith("바로폼_") ? source.slice(4) : source;
  const idx = stripped.indexOf("_");
  if (idx === -1) return normalizeSourceMajor(stripped);
  const major = normalizeSourceMajor(stripped.slice(0, idx));
  const rawMinor = stripped.slice(idx + 1);
  const resolved = CAFE_NAMES[rawMinor] ?? rawMinor;
  return `${major} > ${resolved}`;
}

// 맘카페 한글 이름 목록 (칩 버튼용)
// 영문 ID 매핑된 이름 + 한글 표준명 33개 통합 (중복 제거, 순서 유지)
export const CAFE_NAME_LIST = Array.from(
  new Set([...Object.values(CAFE_NAMES), ...CAFE_CANONICAL_NAMES]),
);
