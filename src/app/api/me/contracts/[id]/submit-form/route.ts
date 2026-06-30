import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  } | null;
  if (!body) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { data: contract, error: fetchError } = await supabaseAdmin
    .from("employment_contracts")
    .select("id, status, employee_user_id")
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
  if (contract.status === "signed") {
    return NextResponse.json(
      { error: "이미 서명 완료된 계약서입니다." },
      { status: 400 },
    );
  }

  const signed = !!body.signed;
  if (signed && !body.signature) {
    return NextResponse.json({ error: "서명이 필요합니다." }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    form_data: body.form_data ?? {},
    signature: body.signature ?? null,
    status: signed ? "signed" : "draft",
  };

  // 서명 완료 시 PDF 업로드
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
    }
  }
  if (signed) update.signed_at = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("employment_contracts")
    .update(update)
    .eq("id", id);
  if (updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
