import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit/logAction";

export const runtime = "nodejs";
export const maxDuration = 60;

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

// POST /api/me/contracts/[id]/submit-form
// 폼+미리보기 방식 제출 — form_data/서명 저장 + (서명 시) 클라이언트 생성 PDF 업로드
// body: { form_data: object, signature: string|null, signed: boolean, pdfDataUrl?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as {
    form_data?: Record<string, unknown>;
    signature?: string | null;
    signed?: boolean;
    pdfDataUrl?: string | null;
    consent?: boolean;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { data: contract, error: fetchError } = await supabaseAdmin
    .from("employment_contracts")
    .select("id, status, employee_user_id, locked")
    .eq("id", id)
    .maybeSingle();
  if (fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!contract)
    return NextResponse.json(
      { error: "계약서를 찾을 수 없습니다." },
      { status: 404 },
    );
  if (contract.employee_user_id !== appUser.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  // 무결성: 이미 서명·잠금된 계약서는 재서명/수정 불가 (위변조 방지)
  if (contract.locked) {
    return NextResponse.json(
      { error: "이미 서명 완료되어 잠긴 계약서는 수정할 수 없습니다." },
      { status: 409 },
    );
  }

  const signed = !!body.signed;
  if (signed && !body.signature) {
    return NextResponse.json({ error: "서명이 필요합니다." }, { status: 400 });
  }
  // 서명 의사: 문서마다 동의 체크 필요
  if (signed && !body.consent) {
    return NextResponse.json(
      { error: "서명 전 동의에 체크해 주세요." },
      { status: 400 },
    );
  }

  // 본인확인: 최근(60분) 휴대폰 OTP 인증을 통과해야 서명 가능.
  // 사용자 단위로 확인 — 한 번 인증하면 여러 계약서를 이어서 서명할 수 있다.
  let verifiedPhone: string | null = null;
  if (signed) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: otp } = await supabaseAdmin
      .from("contract_otp")
      .select("phone, verified_at")
      .eq("user_id", appUser.id)
      .not("verified_at", "is", null)
      .gte("verified_at", since)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!otp) {
      return NextResponse.json(
        { error: "휴대폰 본인인증 후 서명할 수 있습니다." },
        { status: 403 },
      );
    }
    verifiedPhone = otp.phone as string;
  }

  const update: Record<string, unknown> = {
    form_data: body.form_data ?? {},
    signature: body.signature ?? null,
    status: signed ? "signed" : "draft",
  };

  let pdfSha256: string | null = null;

  // 서명 완료 시 PDF 업로드 + 무결성 봉인(해시·잠금·서명 증거)
  if (signed && body.pdfDataUrl) {
    const m = body.pdfDataUrl.match(/base64,(.*)$/);
    if (m) {
      const pdfBytes = Buffer.from(m[1], "base64");
      const storagePath = `${appUser.id}/${id}.pdf`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("employment-contracts")
        .upload(storagePath, pdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (uploadError) {
        return NextResponse.json(
          { error: `PDF 저장 실패: ${uploadError.message}` },
          { status: 500 },
        );
      }
      update.pdf_path = storagePath;
      pdfSha256 = createHash("sha256").update(pdfBytes).digest("hex");
    }
  }

  const ua = req.headers.get("user-agent");
  const ip = clientIp(req);
  if (signed) {
    update.signed_at = new Date().toISOString();
    update.locked = true;
    update.pdf_sha256 = pdfSha256;
    update.signed_ip = ip;
    update.signed_user_agent = ua;
    update.verified_phone = verifiedPhone;
    update.phone_verified_at = new Date().toISOString();
    update.consent_agreed_at = new Date().toISOString();
  }

  const { error: updateError } = await supabaseAdmin
    .from("employment_contracts")
    .update(update)
    .eq("id", id);
  if (updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 });

  // 감사 추적(부인방지) — 서명/임시저장 이벤트 기록
  await logAction({
    user_id: String(appUser.id),
    action: signed ? "confirm_draft" : "update",
    resource: "전자계약",
    resource_id: id,
    detail: signed
      ? `${contract_type_label(body.form_data)} 서명 완료`
      : "임시 저장",
    meta: {
      signed,
      pdf_sha256: pdfSha256,
      ip,
      user_agent: ua,
    },
  });

  return NextResponse.json({ ok: true, pdf_sha256: pdfSha256 });
}

function contract_type_label(form: Record<string, unknown> | undefined): string {
  const name = form && typeof form.employeeName === "string" ? form.employeeName : "";
  return name ? `${name} 계약서` : "계약서";
}
