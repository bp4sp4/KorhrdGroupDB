import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendSensSms } from "@/lib/sens";

export const runtime = "nodejs";

const OTP_TTL_SEC = 300; // 5분
const RESEND_COOLDOWN_SEC = 30;

function hashCode(code: string): string {
  return createHash("sha256").update(`contract-otp:${code}`).digest("hex");
}
function maskPhone(p: string): string {
  const d = p.replace(/[^0-9]/g, "");
  return d.length >= 8 ? `${d.slice(0, 3)}****${d.slice(-4)}` : "****";
}

// POST /api/me/contracts/[id]/otp/send  { phone?: string }
// 서명 전 본인 휴대폰으로 6자리 인증번호 발송
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;
  const { id } = await params;

  const { data: contract } = await supabaseAdmin
    .from("employment_contracts")
    .select("id, employee_user_id, locked")
    .eq("id", id)
    .maybeSingle();
  if (!contract)
    return NextResponse.json({ error: "계약서를 찾을 수 없습니다." }, { status: 404 });
  if (contract.employee_user_id !== appUser.id)
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  if (contract.locked)
    return NextResponse.json(
      { error: "이미 서명 완료된 계약서입니다." },
      { status: 409 },
    );

  // 휴대폰: 등록된 번호 우선, 없으면 요청 번호
  const body = (await req.json().catch(() => null)) as { phone?: string } | null;
  const { data: user } = await supabaseAdmin
    .from("app_users")
    .select("phone")
    .eq("id", appUser.id)
    .maybeSingle();
  const rawPhone = (user?.phone as string | null) || body?.phone || "";
  const phone = rawPhone.replace(/-/g, "").trim();
  if (phone.length < 10) {
    return NextResponse.json(
      { error: "등록된 휴대폰 번호가 없습니다. 관리자에게 번호 등록을 요청하세요." },
      { status: 400 },
    );
  }

  // 재발송 쿨다운
  const { data: last } = await supabaseAdmin
    .from("contract_otp")
    .select("created_at")
    .eq("contract_id", id)
    .eq("user_id", appUser.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last?.created_at) {
    const elapsed = (Date.now() - new Date(last.created_at as string).getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SEC) {
      return NextResponse.json(
        { error: `${Math.ceil(RESEND_COOLDOWN_SEC - elapsed)}초 후 다시 요청하세요.` },
        { status: 429 },
      );
    }
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + OTP_TTL_SEC * 1000).toISOString();

  const { error: insErr } = await supabaseAdmin.from("contract_otp").insert({
    contract_id: id,
    user_id: appUser.id,
    phone,
    code_hash: hashCode(code),
    expires_at: expiresAt,
  });
  if (insErr)
    return NextResponse.json({ error: insErr.message }, { status: 500 });

  const sms = await sendSensSms({
    to: phone,
    message: `[한평생그룹] 전자계약 서명 인증번호 [${code}] (5분 내 입력)`,
  });
  if (!sms.success) {
    return NextResponse.json(
      { error: `인증번호 발송 실패: ${sms.error ?? "알 수 없음"}` },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    phoneMasked: maskPhone(phone),
    expiresInSec: OTP_TTL_SEC,
  });
}
