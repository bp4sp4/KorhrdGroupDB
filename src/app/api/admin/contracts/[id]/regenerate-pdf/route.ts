import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAdmin(role: string | undefined | null) {
  return role === "master-admin" || role === "admin";
}

// POST /api/admin/contracts/[id]/regenerate-pdf
// 서명 완료된 계약의 저장 PDF 를 관리자가 재생성해 교체한다.
// (서명 당시 페이지분할 버그로 잘린 PDF 복구용 — 상태/서명일시는 유지)
// body: { form_data: object, signature: string|null, signed: boolean, pdfDataUrl?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;
  if (!isAdmin(appUser.role)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as {
    form_data?: Record<string, unknown>;
    signature?: string | null;
    pdfDataUrl?: string | null;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { data: contract, error: fetchError } = await supabaseAdmin
    .from("employment_contracts")
    .select("id, status, employee_user_id, pdf_path")
    .eq("id", id)
    .maybeSingle();
  if (fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!contract)
    return NextResponse.json(
      { error: "계약서를 찾을 수 없습니다." },
      { status: 404 },
    );
  if (contract.status !== "signed") {
    return NextResponse.json(
      { error: "서명 완료된 계약서만 재생성할 수 있습니다." },
      { status: 400 },
    );
  }
  if (!body.pdfDataUrl) {
    return NextResponse.json({ error: "PDF 데이터가 없습니다." }, { status: 400 });
  }
  const m = body.pdfDataUrl.match(/base64,(.*)$/);
  if (!m) {
    return NextResponse.json({ error: "PDF 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const pdfBytes = Buffer.from(m[1], "base64");
  const storagePath =
    contract.pdf_path ?? `${contract.employee_user_id}/${id}.pdf`;
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

  // 상태·서명일시는 유지, 문서 데이터만 최신으로 반영
  const update: Record<string, unknown> = { pdf_path: storagePath };
  if (body.form_data) update.form_data = body.form_data;
  if (body.signature !== undefined) update.signature = body.signature;

  const { error: updateError } = await supabaseAdmin
    .from("employment_contracts")
    .update(update)
    .eq("id", id);
  if (updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
