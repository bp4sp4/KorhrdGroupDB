import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PDFDocument } from "pdf-lib";
import { readFileSync } from "fs";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/me/contracts/[id]/submit
// body: { pages: [{ pageNumber: 1, drawingDataUrl: 'data:image/png;base64,...' }, ...] }
//   → 클라이언트에서 각 페이지의 손글씨 캔버스를 PNG dataURL 로 보냄
//   → 서버에서 양식 PDF + 손글씨 이미지 + 직인을 합쳐 최종 PDF 생성 → Storage 저장
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as {
    pages?: { pageNumber: number; drawingDataUrl: string }[];
  } | null;

  if (!body || !Array.isArray(body.pages) || body.pages.length === 0) {
    return NextResponse.json(
      { error: "서명 데이터가 비어있습니다." },
      { status: 400 },
    );
  }

  // 본인 계약서 확인
  const { data: contract, error: fetchError } = await supabaseAdmin
    .from("employment_contracts")
    .select("id, contract_type, status, employee_user_id, employee_name")
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

  // 양식 PDF 로드 (public/contracts)
  const templateFile: Record<string, string> = {
    regular: "regular.pdf",
    contract: "contract.pdf",
    civil: "civil.pdf",
    sales: "sales.pdf",
    privacy: "privacy.pdf",
    ethics: "ethics.pdf",
    nda: "nda.pdf",
    pledge: "pledge.pdf",
  };
  const templateFileName = templateFile[contract.contract_type];
  if (!templateFileName) {
    return NextResponse.json(
      { error: "지원하지 않는 양식입니다." },
      { status: 400 },
    );
  }
  const templatePath = path.join(
    process.cwd(),
    "public",
    "contracts",
    templateFileName,
  );
  let templateBytes: Buffer;
  try {
    templateBytes = readFileSync(templatePath);
  } catch {
    return NextResponse.json(
      {
        error:
          "양식 PDF 파일이 서버에 없습니다. 관리자에게 문의해주세요. (public/contracts/" +
          templateFileName +
          ")",
      },
      { status: 500 },
    );
  }

  // PDF 합성 — 각 페이지에 손글씨 PNG 를 동일 크기로 overlay
  try {
    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();

    for (const drawing of body.pages) {
      const pageIdx = drawing.pageNumber - 1;
      if (pageIdx < 0 || pageIdx >= pages.length) continue;
      if (!drawing.drawingDataUrl.startsWith("data:image/png;base64,")) continue;
      const base64 = drawing.drawingDataUrl.replace(
        /^data:image\/png;base64,/,
        "",
      );
      const pngBytes = Buffer.from(base64, "base64");
      const png = await pdfDoc.embedPng(pngBytes);
      const page = pages[pageIdx];
      const { width, height } = page.getSize();
      page.drawImage(png, { x: 0, y: 0, width, height });
    }

    const finalBytes = await pdfDoc.save();

    // Storage 업로드
    const storagePath = `${appUser.id}/${id}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("employment-contracts")
      .upload(storagePath, finalBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadError) {
      return NextResponse.json(
        { error: `PDF 저장 실패: ${uploadError.message}` },
        { status: 500 },
      );
    }

    // DB 업데이트
    const { error: updateError } = await supabaseAdmin
      .from("employment_contracts")
      .update({
        status: "signed",
        signed_at: new Date().toISOString(),
        pdf_path: storagePath,
      })
      .eq("id", id);
    if (updateError) {
      return NextResponse.json(
        { error: `상태 업데이트 실패: ${updateError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, pdfPath: storagePath });
  } catch (err) {
    return NextResponse.json(
      { error: `PDF 합성 중 오류: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
