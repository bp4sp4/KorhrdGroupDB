// 진단용 — Naver Works API 어떤 endpoint 가 되는지 한 번에 테스트
// OAuth 사용자 토큰으로 호출 (JWT 가 아님)
import { NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { nwFetchWithToken, NaverWorksError } from "@/lib/naverWorks/token";
import {
  getUserNaverWorksAccess,
  NaverWorksAuthRequiredError,
} from "@/lib/naverWorks/userTokens";

export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  // OAuth 사용자 토큰 + 이메일 가져오기
  let accessToken: string;
  let userEmail: string;
  try {
    const ctx = await getUserNaverWorksAccess(appUser.id);
    accessToken = ctx.accessToken;
    userEmail = ctx.worksUserEmail || "";
    if (!userEmail) {
      return NextResponse.json(
        { error: "네이버 웍스 이메일 정보 없음 (재연결 필요)" },
        { status: 400 },
      );
    }
  } catch (err) {
    if (err instanceof NaverWorksAuthRequiredError) {
      return NextResponse.json(
        { error: err.message, code: "NW_AUTH_REQUIRED" },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const results: Record<string, { ok: boolean; status?: number; data?: unknown; error?: string }> = {};

  // 2) 다양한 endpoint 테스트 — folderId=0 (받은메일함)
  const enc = encodeURIComponent(userEmail);
  const tests = [
    { name: "mail_mailfolders", path: `/v1.0/users/${enc}/mail/mailfolders` },
    // 받은메일함 (folderId=0) 안의 메일 목록 후보들
    { name: "mail_folder_0", path: `/v1.0/users/${enc}/mail/mailfolders/0` },
    { name: "mail_folder_0_msgs", path: `/v1.0/users/${enc}/mail/mailfolders/0/messages` },
    { name: "mail_folder_0_mails", path: `/v1.0/users/${enc}/mail/mailfolders/0/mails` },
    { name: "mail_query_folder", path: `/v1.0/users/${enc}/mail?folderId=0` },
    { name: "mail_query_messages", path: `/v1.0/users/${enc}/mail/messages?folderId=0` },
    { name: "mail_query_mails", path: `/v1.0/users/${enc}/mail/mails?folderId=0` },
    { name: "mail_unread_count", path: `/v1.0/users/${enc}/mail/unread-count` },
    // 추가 후보들
    { name: "mail_root", path: `/v1.0/users/${enc}/mail` },
    { name: "mail_list", path: `/v1.0/users/${enc}/mail/list?folderId=0` },
    { name: "mail_search", path: `/v1.0/users/${enc}/mail/search?folderId=0` },
    { name: "mail_box_0", path: `/v1.0/users/${enc}/mail/mailbox/0` },
    { name: "mail_msgs_only", path: `/v1.0/users/${enc}/mail/messages` },
    { name: "mail_history", path: `/v1.0/users/${enc}/mail/history?folderId=0` },
  ];

  for (const t of tests) {
    try {
      const data = await nwFetchWithToken(accessToken, t.path, { method: "GET" });
      results[t.name] = { ok: true, data: data };
    } catch (err) {
      if (err instanceof NaverWorksError) {
        results[t.name] = {
          ok: false,
          status: err.status,
          error: `${err.message}`,
        };
      } else {
        results[t.name] = { ok: false, error: (err as Error).message };
      }
    }
  }

  return NextResponse.json({ userEmail, results });
}
