import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "mail-attachments";

// POST /api/mail/attachments/sign  { filename }
// → 클라이언트가 Storage 에 직접 업로드할 서명 URL 발급 (Vercel 요청 한도 우회)
export async function POST(req: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const body = (await req.json().catch(() => null)) as {
    filename?: string;
  } | null;
  const filename = (body?.filename ?? "").trim();
  if (!filename) {
    return NextResponse.json(
      { ok: false, error: "filename 이 필요합니다." },
      { status: 400 },
    );
  }

  // 안전한 path — 파일명 자체는 메타로만 쓰고 path엔 uuid 사용
  const ext = filename.includes(".") ? filename.split(".").pop() : "";
  const safeExt = ext ? `.${ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10)}` : "";
  const path = `tmp/${appUser.id}/${randomUUID()}${safeExt}`;

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "서명 URL 생성 실패" },
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
