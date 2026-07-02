import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit/logAction";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAdmin(role: string | undefined | null) {
  return role === "master-admin" || role === "admin";
}

const TYPE_LABEL: Record<string, string> = {
  regular: "정규직",
  contract: "계약직",
  civil: "정규직(민간)",
  sales: "정규직(영업직)",
  privacy: "개인정보동의서",
  ethics: "보안윤리서약서",
  nda: "비밀유지서약서",
  pledge: "입사서약서",
};

// GET /api/admin/contracts/[id]/download — 저장된 PDF 파일을 바로 내려받기
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;
  if (!isAdmin(appUser.role)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;

  const { data: row, error } = await supabaseAdmin
    .from("employment_contracts")
    .select("contract_type, employee_name, pdf_path")
    .eq("id", id)
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row || !row.pdf_path) {
    return NextResponse.json(
      { error: "저장된 PDF가 없습니다." },
      { status: 404 },
    );
  }

  const { data: file, error: dlErr } = await supabaseAdmin.storage
    .from("employment-contracts")
    .download(row.pdf_path as string);
  if (dlErr || !file) {
    return NextResponse.json(
      { error: "PDF 파일을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const label = TYPE_LABEL[row.contract_type as string] ?? row.contract_type;
  const fileName = `${(row.employee_name as string) || "계약서"}_${label}.pdf`;

  await logAction({
    user_id: String(appUser.id),
    action: "view",
    resource: "전자계약",
    resource_id: id,
    detail: `${row.employee_name ?? ""} ${label} PDF 다운로드`,
  });

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
