import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// 서명 HTML 최대 크기 (base64 이미지 포함 — 약 1MB)
const MAX_SIGNATURE_BYTES = 1_000_000;

// GET /api/mail-credentials/signature — 본인 서명 HTML 조회
export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { data, error } = await supabaseAdmin
    .from("mail_credentials")
    .select("signature_html")
    .eq("user_id", appUser.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    // 자격증명 미등록(data=null)이어도 서명은 빈값으로 응답
    signatureHtml: (data?.signature_html as string | null) ?? null,
    hasCredentials: !!data,
  });
}

// PUT /api/mail-credentials/signature — 서명 HTML 저장/삭제
// body: { signatureHtml: string | null }
export async function PUT(req: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const body = (await req.json().catch(() => null)) as {
    signatureHtml?: string | null;
  } | null;

  const raw = body?.signatureHtml;
  const signature_html =
    typeof raw === "string" && raw.trim().length > 0 ? raw : null;

  if (signature_html && signature_html.length > MAX_SIGNATURE_BYTES) {
    return NextResponse.json(
      { error: "서명이 너무 큽니다. 이미지 크기를 줄여주세요." },
      { status: 400 },
    );
  }

  // 자격증명 행이 있어야 서명 저장 가능 (email/password가 NOT NULL이라 별도 insert 불가)
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("mail_credentials")
    .select("id")
    .eq("user_id", appUser.id)
    .maybeSingle();
  if (selErr)
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  if (!existing) {
    return NextResponse.json(
      {
        error: "메일 자격증명을 먼저 등록해주세요.",
        code: "MAIL_CREDENTIALS_REQUIRED",
      },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin
    .from("mail_credentials")
    .update({ signature_html })
    .eq("user_id", appUser.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, signatureHtml: signature_html });
}
