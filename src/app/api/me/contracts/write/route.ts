import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// POST /api/me/contracts/write
//  - 직원 본인이 로폼 방식으로 작성한 표준 근로계약서를 저장
//  - body: { form_data: object, signature?: string(dataURL), signed?: boolean }
export async function POST(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const body = (await request.json().catch(() => null)) as {
    form_data?: Record<string, unknown>;
    signature?: string | null;
    signed?: boolean;
  } | null;

  if (!body || typeof body.form_data !== "object" || body.form_data === null) {
    return NextResponse.json({ error: "form_data가 필요합니다." }, { status: 400 });
  }

  const formData = body.form_data as Record<string, unknown>;
  const employeeName =
    (typeof formData.employeeName === "string" && formData.employeeName.trim()) ||
    appUser.display_name ||
    "";

  const signed = body.signed === true && !!body.signature;

  const { data, error } = await supabaseAdmin
    .from("employment_contracts")
    .insert({
      contract_type: "regular",
      status: signed ? "signed" : "draft",
      employee_user_id: appUser.id,
      employee_name: employeeName,
      created_by: appUser.id,
      form_data: formData,
      signature: body.signature ?? null,
      signed_at: signed ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
