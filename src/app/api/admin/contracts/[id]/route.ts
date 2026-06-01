import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function isAdmin(role: string | undefined | null) {
  return role === "master-admin" || role === "admin";
}

// GET /api/admin/contracts/[id] — 상세 (서명 PDF signed URL 포함)
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

  const { data, error } = await supabaseAdmin
    .from("employment_contracts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json(
      { error: "계약서를 찾을 수 없습니다." },
      { status: 404 },
    );

  // PDF signed URL (1시간 유효)
  let pdfSignedUrl: string | null = null;
  if (data.pdf_path) {
    const { data: signed } = await supabaseAdmin.storage
      .from("employment-contracts")
      .createSignedUrl(data.pdf_path, 3600);
    pdfSignedUrl = signed?.signedUrl ?? null;
  }

  return NextResponse.json({ contract: data, pdfSignedUrl });
}

// DELETE /api/admin/contracts/[id] — 계약 + Storage 파일 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;
  if (!isAdmin(appUser.role)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;

  // 먼저 pdf_path 조회해서 Storage 파일도 같이 정리
  const { data: row } = await supabaseAdmin
    .from("employment_contracts")
    .select("pdf_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from("employment_contracts")
    .delete()
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  if (row?.pdf_path) {
    await supabaseAdmin.storage
      .from("employment-contracts")
      .remove([row.pdf_path])
      .catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
