import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return createHash("sha256").update(`contract-otp:${code}`).digest("hex");
}

// POST /api/me/contracts/[id]/otp/verify  { code: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  const code = (body?.code ?? "").replace(/[^0-9]/g, "");
  if (code.length !== 6)
    return NextResponse.json({ error: "인증번호 6자리를 입력하세요." }, { status: 400 });

  const { data: otp } = await supabaseAdmin
    .from("contract_otp")
    .select("id, code_hash, expires_at, attempts, verified_at")
    .eq("contract_id", id)
    .eq("user_id", appUser.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp)
    return NextResponse.json(
      { error: "인증번호를 먼저 요청하세요." },
      { status: 400 },
    );
  if (otp.verified_at)
    return NextResponse.json({ ok: true });
  if (new Date(otp.expires_at as string).getTime() < Date.now())
    return NextResponse.json(
      { error: "인증번호가 만료되었습니다. 다시 요청하세요." },
      { status: 400 },
    );
  if ((otp.attempts as number) >= MAX_ATTEMPTS)
    return NextResponse.json(
      { error: "시도 횟수를 초과했습니다. 다시 요청하세요." },
      { status: 429 },
    );

  if (otp.code_hash !== hashCode(code)) {
    await supabaseAdmin
      .from("contract_otp")
      .update({ attempts: (otp.attempts as number) + 1 })
      .eq("id", otp.id);
    const remain = MAX_ATTEMPTS - ((otp.attempts as number) + 1);
    return NextResponse.json(
      { error: `인증번호가 일치하지 않습니다. (남은 시도 ${Math.max(remain, 0)}회)` },
      { status: 400 },
    );
  }

  await supabaseAdmin
    .from("contract_otp")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", otp.id);

  return NextResponse.json({ ok: true });
}
