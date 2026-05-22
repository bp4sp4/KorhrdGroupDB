// 네이버 웍스 OAuth 2.0 Authorization Code Flow — Step 1
// 사용자를 네이버 웍스 동의 화면으로 redirect 시킴
// 공식: https://developers.worksmobile.com/kr/docs/auth-oauth
import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import crypto from "crypto";

const NW_CLIENT_ID = process.env.NW_CLIENT_ID || "";
// OAuth 용 redirect URL — 배포 환경에 따라 다름. 보통 .env.local 에 절대 URL 로 지정.
// 예: http://localhost:3000/api/auth/naverworks/callback
//     https://hakjeom-bank.vercel.app/api/auth/naverworks/callback
const NW_REDIRECT_URL = process.env.NW_REDIRECT_URL || "";

// OAuth Code Flow 로 메일 API 접근에 필요한 scope
const OAUTH_SCOPE = "mail mail.read user.read";

export async function GET(req: NextRequest) {
  // 1) 사용자 로그인 확인 (우리 앱 로그인 상태여야 함)
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  if (!NW_CLIENT_ID || !NW_REDIRECT_URL) {
    return NextResponse.json(
      {
        error:
          "환경변수 누락: NW_CLIENT_ID 와 NW_REDIRECT_URL 을 .env.local 에 설정하세요.",
      },
      { status: 500 },
    );
  }

  // 2) CSRF 방지용 state 생성 + 쿠키 저장
  const state = crypto.randomBytes(16).toString("hex");

  // 3) 인증 URL 만들기
  const authUrl = new URL(
    "https://auth.worksmobile.com/oauth2/v2.0/authorize",
  );
  authUrl.searchParams.set("client_id", NW_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", NW_REDIRECT_URL);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", OAUTH_SCOPE);
  authUrl.searchParams.set("state", state);
  // (선택) 동의 화면 강제 표시
  // authUrl.searchParams.set("prompt", "consent");

  // ★ 디버깅: 실제로 보내는 값 로그
  console.log("[NW OAuth start] params:", {
    clientIdPrefix: NW_CLIENT_ID
      ? `${NW_CLIENT_ID.slice(0, 12)}...(${NW_CLIENT_ID.length}자)`
      : "MISSING",
    redirectUri: NW_REDIRECT_URL,
    scope: OAUTH_SCOPE,
    fullUrl: authUrl.toString(),
  });

  // 4) redirect (state 쿠키 첨부)
  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("nw_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10분
  });
  // 누가 시작했는지 추적 (app_users.id - BIGINT)
  res.cookies.set("nw_oauth_user", String(appUser.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return res;
}
