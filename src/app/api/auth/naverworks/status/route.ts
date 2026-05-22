// 네이버 웍스 연결 상태 체크 (UI 용)
// GET /api/auth/naverworks/status → { connected: boolean, email?: string }
// DELETE /api/auth/naverworks/status → 연결 해제
import { NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { disconnectNaverWorks } from "@/lib/naverWorks/userTokens";

export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { data } = await supabaseAdmin
    .from("naverworks_tokens")
    .select("works_user_email, expires_at, refresh_expires_at, scope")
    .eq("user_id", appUser.id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ connected: false });
  }
  return NextResponse.json({
    connected: true,
    email: data.works_user_email,
    accessExpiresAt: data.expires_at,
    refreshExpiresAt: data.refresh_expires_at,
    scope: data.scope,
  });
}

export async function DELETE() {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  await disconnectNaverWorks(appUser.id);
  return NextResponse.json({ ok: true });
}
