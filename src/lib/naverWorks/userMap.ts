// Naver Works 회사 메일 매핑 헬퍼
// auth 사용자(supabase) → 회사 도메인 이메일로 변환
// 환경변수 NW_WORK_EMAIL_DOMAIN (기본 korhrdcorp.co.kr) 사용
// 매핑 우선순위:
//   1) auth 이메일이 이미 회사 도메인이면 그대로
//   2) NW_USER_MAP_JSON 에 정의된 매핑 (auth_email → work_email)
//   3) display_name 이 영문이면 그걸로 추정
//   4) 실패 → null
import type { User } from "@supabase/supabase-js";

const WORK_DOMAIN = process.env.NW_WORK_EMAIL_DOMAIN || "korhrdcorp.co.kr";

// 형식: { "bp4sp456@gmail.com": "sanghoon@korhrdcorp.co.kr", ... }
function loadUserMap(): Record<string, string> {
  const raw = process.env.NW_USER_MAP_JSON;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

const USER_MAP = loadUserMap();

export function resolveWorkEmail(
  user: User | null,
  displayName: string | null,
): string | null {
  const authEmail = user?.email ?? null;

  // 1) auth 이메일이 이미 회사 도메인이면
  if (authEmail) {
    const re = new RegExp(`@${WORK_DOMAIN.replace(/\./g, "\\.")}$`, "i");
    if (re.test(authEmail)) return authEmail;
  }

  // 2) 명시적 매핑
  if (authEmail && USER_MAP[authEmail]) return USER_MAP[authEmail];

  // 3) display_name 이 영문(스페이스 없음)이면 추정
  if (displayName && /^[a-zA-Z][a-zA-Z0-9._-]+$/.test(displayName)) {
    return `${displayName.toLowerCase()}@${WORK_DOMAIN}`;
  }

  return null;
}
