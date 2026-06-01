import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type ContractType = "regular" | "contract" | "civil" | "sales";

function isAdmin(role: string | undefined | null) {
  return role === "master-admin" || role === "admin";
}

// GET /api/admin/contracts — 목록
export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;
  if (!isAdmin(appUser.role)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("employment_contracts")
    .select(
      "id, contract_type, status, employee_name, employee_user_id, signed_at, created_at, pdf_path",
    )
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contracts: data ?? [] });
}

// POST /api/admin/contracts — 신규 작성
// body: { contract_type, employee_user_id, employee_name }
//  → 양식 PDF + 직원만 지정. 실제 내용은 직원이 패드에서 PDF 위에 직접 작성.
export async function POST(req: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;
  if (!isAdmin(appUser.role)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    contract_type?: ContractType;
    employee_user_id?: number | null;
    employee_name?: string;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const allowedTypes: ContractType[] = ["regular", "contract", "civil", "sales"];
  if (!body.contract_type || !allowedTypes.includes(body.contract_type)) {
    return NextResponse.json(
      { error: "양식(contract_type)이 올바르지 않습니다." },
      { status: 400 },
    );
  }
  if (!body.employee_name || !body.employee_name.trim()) {
    return NextResponse.json(
      { error: "근로자 이름은 필수입니다." },
      { status: 400 },
    );
  }

  const payload = {
    contract_type: body.contract_type,
    status: "pending_sign" as const,
    employee_user_id: body.employee_user_id ?? null,
    employee_name: body.employee_name.trim(),
    created_by: appUser.id,
  };

  const { data, error } = await supabaseAdmin
    .from("employment_contracts")
    .insert(payload)
    .select("id")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
