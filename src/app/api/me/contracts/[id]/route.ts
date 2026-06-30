import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// GET /api/me/contracts/[id] — 본인 계약서 상세 (양식 PDF 경로 포함)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("employment_contracts")
    .select(
      "id, contract_type, status, employee_name, signed_at, pdf_path, employee_user_id, form_data, signature",
    )
    .eq("id", id)
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json(
      { error: "계약서를 찾을 수 없습니다." },
      { status: 404 },
    );
  // 본인만 조회 가능 (관리자는 별도 라우트로)
  if (data.employee_user_id !== appUser.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // 양식 PDF는 public 정적 자산 — contract_type 으로 경로 매핑
  const templatePathMap: Record<string, string> = {
    regular: "/contracts/regular.pdf",
    contract: "/contracts/contract.pdf",
    civil: "/contracts/civil.pdf",
    sales: "/contracts/sales.pdf",
    privacy: "/contracts/privacy.pdf",
    ethics: "/contracts/ethics.pdf",
    nda: "/contracts/nda.pdf",
    pledge: "/contracts/pledge.pdf",
  };

  return NextResponse.json({
    contract: data,
    templateUrl: templatePathMap[data.contract_type] ?? null,
    stampUrl:
      "https://mipzevxfqacbheqojrwa.supabase.co/storage/v1/object/public/contract-stamps/korhrd-group.png",
  });
}
