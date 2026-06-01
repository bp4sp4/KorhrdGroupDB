import { NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// GET /api/me/contracts — 본인에게 지정된 근로계약서 목록
export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { data, error } = await supabaseAdmin
    .from("employment_contracts")
    .select(
      "id, contract_type, status, employee_name, signed_at, created_at, pdf_path",
    )
    .eq("employee_user_id", appUser.id)
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contracts: data ?? [] });
}
