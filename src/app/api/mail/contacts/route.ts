import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// GET /api/mail/contacts — 메일 작성 화면 주소록 (사내 사용자)
// 활성 사용자 + username(이메일) 보유 + mini-admin 제외
export async function GET() {
  const { errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, display_name, username")
    .eq("is_active", true)
    .not("role", "in", '("mini-admin")')
    .order("display_name", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // username 이 이메일 형식인 행만 (도메인이 없는 ID 형 username 은 제외)
  const contacts = (data ?? [])
    .filter((u) => typeof u.username === "string" && u.username.includes("@"))
    .map((u) => ({
      id: u.id,
      name: (u.display_name ?? "").trim() || u.username,
      email: u.username,
    }));

  return NextResponse.json({ contacts });
}
