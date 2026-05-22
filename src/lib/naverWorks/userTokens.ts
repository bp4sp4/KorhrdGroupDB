// 사용자별 네이버 웍스 OAuth 토큰 관리
// - 토큰 조회
// - 만료 임박 시 refresh_token 으로 자동 갱신
// - DB 업데이트
import { supabaseAdmin } from "@/lib/supabase/admin";

const NW_CLIENT_ID = process.env.NW_CLIENT_ID || "";
const NW_CLIENT_SECRET = process.env.NW_CLIENT_SECRET || "";

export interface NaverWorksUserToken {
  user_id: number;
  access_token: string;
  refresh_token: string;
  scope: string | null;
  token_type: string;
  expires_at: string; // ISO
  refresh_expires_at: string | null;
  works_user_email: string | null;
  works_user_id: string | null;
}

export class NaverWorksAuthRequiredError extends Error {
  code = "NW_AUTH_REQUIRED" as const;
  constructor(message: string = "네이버 웍스 연결이 필요합니다.") {
    super(message);
  }
}

/**
 * 사용자의 유효한 access_token 을 반환.
 * 만료 임박(60초 전)이면 refresh 시도.
 * 토큰이 아예 없으면 NaverWorksAuthRequiredError 던짐 → 호출부에서 401 응답.
 */
export async function getUserAccessToken(appUserId: number): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("naverworks_tokens")
    .select("*")
    .eq("user_id", appUserId)
    .maybeSingle();

  if (error) {
    console.error("[NW userTokens] DB read error:", error);
    throw new Error("토큰 DB 조회 실패");
  }
  if (!data) {
    throw new NaverWorksAuthRequiredError();
  }

  const token = data as NaverWorksUserToken;
  const expiresAtMs = new Date(token.expires_at).getTime();

  // 만료 60초 전이면 refresh
  if (expiresAtMs > Date.now() + 60_000) {
    return token.access_token;
  }

  // refresh_token 만료 체크 (optional)
  if (token.refresh_expires_at) {
    const refreshExpiresMs = new Date(token.refresh_expires_at).getTime();
    if (refreshExpiresMs < Date.now()) {
      // refresh_token 도 만료 — 재인증 필요
      throw new NaverWorksAuthRequiredError(
        "네이버 웍스 인증 만료. 다시 연결해주세요.",
      );
    }
  }

  // refresh 시도
  return refreshAccessToken(token);
}

/**
 * refresh_token 으로 새 access_token 발급 + DB 업데이트
 */
async function refreshAccessToken(token: NaverWorksUserToken): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: token.refresh_token,
    client_id: NW_CLIENT_ID,
    client_secret: NW_CLIENT_SECRET,
  });

  const res = await fetch("https://auth.worksmobile.com/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(
      "[NW userTokens] refresh failed:",
      res.status,
      errBody,
    );
    // refresh 자체 실패 — 재인증 필요
    throw new NaverWorksAuthRequiredError(
      "네이버 웍스 토큰 갱신 실패. 다시 연결해주세요.",
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string; // Refresh Token Rotation 켜져 있으면 새 값
    expires_in: number;
    token_type: string;
    scope?: string;
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Refresh Token Rotation 이 켜져있으면 새 refresh_token 도 받음
  const updatedRefreshToken = data.refresh_token || token.refresh_token;
  const updatedRefreshExpiresAt = data.refresh_token
    ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    : token.refresh_expires_at;

  const { error: upErr } = await supabaseAdmin
    .from("naverworks_tokens")
    .update({
      access_token: data.access_token,
      refresh_token: updatedRefreshToken,
      expires_at: expiresAt.toISOString(),
      refresh_expires_at: updatedRefreshExpiresAt,
      scope: data.scope || token.scope,
      token_type: data.token_type,
    })
    .eq("user_id", token.user_id);

  if (upErr) {
    console.error("[NW userTokens] DB update error:", upErr);
    // 토큰은 발급됐으니 일단 반환은 함
  }

  return data.access_token;
}

/**
 * 토큰 + 사용자 컨텍스트(이메일/UserId) 같이 반환 — 메일 API 호출 시 편리
 */
export async function getUserNaverWorksAccess(appUserId: number): Promise<{
  accessToken: string;
  worksUserEmail: string | null;
  worksUserId: string | null;
}> {
  const accessToken = await getUserAccessToken(appUserId);
  const { data } = await supabaseAdmin
    .from("naverworks_tokens")
    .select("works_user_email, works_user_id")
    .eq("user_id", appUserId)
    .maybeSingle();
  return {
    accessToken,
    worksUserEmail: (data?.works_user_email as string | null) || null,
    worksUserId: (data?.works_user_id as string | null) || null,
  };
}

/**
 * 사용자가 네이버 웍스에 연결되어 있는지 단순 체크 (UI 용)
 */
export async function hasNaverWorksConnection(appUserId: number): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("naverworks_tokens")
    .select("user_id")
    .eq("user_id", appUserId)
    .maybeSingle();
  return !!data;
}

/**
 * 연결 해제 (DB 에서 토큰 삭제)
 */
export async function disconnectNaverWorks(appUserId: number) {
  await supabaseAdmin
    .from("naverworks_tokens")
    .delete()
    .eq("user_id", appUserId);
}
