import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "board-attachments";

// POST /api/board/attachments/sign  { filename }
// → 클라이언트가 Storage 에 직접 업로드할 서명 URL 발급
export async function POST(req: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;
  if (!appUser.id || appUser.role === "guest") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { filename?: string } | null;
  const filename = (body?.filename ?? "").trim();
  if (!filename) {
    return NextResponse.json({ error: "filename 이 필요합니다." }, { status: 400 });
  }

  const ext = filename.includes(".") ? filename.split(".").pop() : "";
  const safeExt = ext ? `.${ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10)}` : "";
  const path = `${appUser.id}/${randomUUID()}${safeExt}`;

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "서명 URL 생성 실패" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    bucket: BUCKET,
    path: data.path,
    token: data.token,
  });
}
