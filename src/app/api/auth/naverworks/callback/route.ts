// 네이버 웍스 OAuth 2.0 Authorization Code Flow — Step 2
// 사용자가 동의한 뒤 네이버 웍스가 ?code=... 로 redirect 해줌
// 여기서 code 를 access_token + refresh_token 으로 교환하고 DB 저장
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const NW_CLIENT_ID = process.env.NW_CLIENT_ID || "";
const NW_CLIENT_SECRET = process.env.NW_CLIENT_SECRET || "";
const NW_REDIRECT_URL = process.env.NW_REDIRECT_URL || "";

// 메일 페이지로 돌아갈 URL
const RETURN_PATH = "/mail";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  // 1) state 검증 (CSRF 방지)
  const cookieState = req.cookies.get("nw_oauth_state")?.value;
  const cookieUserId = req.cookies.get("nw_oauth_user")?.value;

  if (error) {
    return redirectToMailWithError(
      req,
      `네이버 웍스 동의 거부 또는 오류: ${error} ${errorDescription || ""}`,
    );
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectToMailWithError(req, "OAuth state 검증 실패");
  }
  if (!cookieUserId) {
    return redirectToMailWithError(req, "사용자 식별 실패 (재로그인 필요)");
  }

  // 2) code → access_token 교환
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: NW_CLIENT_ID,
      client_secret: NW_CLIENT_SECRET,
      redirect_uri: NW_REDIRECT_URL,
    });

    const tokenRes = await fetch(
      "https://auth.worksmobile.com/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
    );

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error("[NW OAuth callback] token exchange failed:", tokenRes.status, errBody);
      return redirectToMailWithError(req, `토큰 교환 실패 (${tokenRes.status})`);
    }

    const data = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
      scope: string;
    };

    console.log("[NW OAuth callback] token issued OK:", {
      scope: data.scope,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      hasRefresh: !!data.refresh_token,
    });

    // 3) (참고용) 네이버 웍스 사용자 정보 조회
    let worksUserEmail: string | null = null;
    let worksUserId: string | null = null;
    try {
      const meRes = await fetch("https://www.worksapis.com/v1.0/users/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (meRes.ok) {
        const meData = (await meRes.json()) as { email?: string; userId?: string };
        worksUserEmail = meData.email || null;
        worksUserId = meData.userId || null;
      }
    } catch {
      // 본 흐름 막지 않음
    }

    // 4) DB 저장 (upsert) — user_id 는 app_users.id
    const appUserId = Number(cookieUserId);
    if (!Number.isFinite(appUserId)) {
      return redirectToMailWithError(req, "잘못된 user id");
    }

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);
    // refresh_token 은 보통 90일 — 명시적 만료 정보 없으면 추정값 저장
    const refreshExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const upsert = await supabaseAdmin
      .from("naverworks_tokens")
      .upsert(
        {
          user_id: appUserId,
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          scope: data.scope,
          token_type: data.token_type,
          expires_at: expiresAt.toISOString(),
          refresh_expires_at: refreshExpiresAt.toISOString(),
          works_user_email: worksUserEmail,
          works_user_id: worksUserId,
        },
        { onConflict: "user_id" },
      );

    if (upsert.error) {
      console.error("[NW OAuth callback] DB upsert error:", upsert.error);
      return redirectToMailWithError(req, "토큰 저장 실패");
    }

    // 5) 성공 — 메일 페이지로 돌아가기 + 쿠키 정리
    const success = NextResponse.redirect(
      new URL(`${RETURN_PATH}?nw_connected=1`, req.nextUrl.origin),
    );
    success.cookies.delete("nw_oauth_state");
    success.cookies.delete("nw_oauth_user");
    return success;
  } catch (err) {
    console.error("[NW OAuth callback] unexpected error:", err);
    return redirectToMailWithError(req, "예기치 못한 오류");
  }
}

function redirectToMailWithError(req: NextRequest, message: string) {
  const url = new URL(`${RETURN_PATH}?nw_error=${encodeURIComponent(message)}`, req.nextUrl.origin);
  const res = NextResponse.redirect(url);
  res.cookies.delete("nw_oauth_state");
  res.cookies.delete("nw_oauth_user");
  return res;
}
