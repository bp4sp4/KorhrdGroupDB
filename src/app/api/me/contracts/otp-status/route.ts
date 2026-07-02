import { NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const WINDOW_MIN = 60;

// GET /api/me/contracts/otp-status
// 로그인 사용자가 최근(60분) 휴대폰 본인인증을 통과했는지 — 세션 단위 확인.
// 한 번 인증하면 대기 계약서들을 이어서 서명할 수 있게 한다.
export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const since = new Date(Date.now() - WINDOW_MIN * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("contract_otp")
    .select("verified_at")
    .eq("user_id", appUser.id)
    .not("verified_at", "is", null)
    .gte("verified_at", since)
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json(
    { verified: !!data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
