import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// GET /api/mail/contacts — 메일 작성 화면 주소록 (사내 사용자)
//
// 우선순위:
//  1) mail_credentials.email (다음 스마트워크 회사 이메일 — @korhrdcorp.co.kr 등)
//  2) (백업) app_users.username 이 이메일 형식이면 그것
//
// 활성 사용자, mini-admin 제외.
export async function GET() {
  const { errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  // 사용자 + 다음 스마트워크 이메일 한 번에 가져오기 (left join)
  const { data: users, error: userError } = await supabaseAdmin
    .from("app_users")
    .select("id, display_name, username")
    .eq("is_active", true)
    .not("role", "in", '("mini-admin")')
    .order("display_name", { ascending: true });
  if (userError)
    return NextResponse.json({ error: userError.message }, { status: 500 });

  const userIds = (users ?? []).map((u) => u.id);
  // mail_credentials — 각 사용자별 다음 스마트워크 이메일
  const credEmailByUserId = new Map<number, string>();
  if (userIds.length > 0) {
    const { data: creds, error: credError } = await supabaseAdmin
      .from("mail_credentials")
      .select("user_id, email")
      .in("user_id", userIds);
    if (credError)
      return NextResponse.json({ error: credError.message }, { status: 500 });
    for (const c of creds ?? []) {
      if (typeof c.email === "string" && c.email.includes("@")) {
        credEmailByUserId.set(c.user_id as number, c.email);
      }
    }
  }

  const contacts = (users ?? [])
    .map((u) => {
      // 다음 스마트워크 이메일 우선, 없으면 username (이메일 형식일 때만)
      const daum = credEmailByUserId.get(u.id as number);
      const fallback =
        typeof u.username === "string" && u.username.includes("@")
          ? u.username
          : null;
      const email = daum ?? fallback;
      if (!email) return null;
      return {
        id: u.id,
        name: (u.display_name ?? "").trim() || email,
        email,
      };
    })
    .filter((c): c is { id: number; name: string; email: string } => c !== null);

  return NextResponse.json({ contacts });
}
