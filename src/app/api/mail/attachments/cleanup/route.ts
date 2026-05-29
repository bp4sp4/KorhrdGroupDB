import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "mail-attachments";

// POST /api/mail/attachments/cleanup  { paths: string[] }
// 발송하지 않고 닫은 첨부 임시파일 삭제. 본인(tmp/{userId}/) 경로만 허용.
export async function POST(req: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const body = (await req.json().catch(() => null)) as {
    paths?: string[];
  } | null;
  const prefix = `tmp/${appUser.id}/`;
  const paths = (body?.paths ?? []).filter(
    (p) => typeof p === "string" && p.startsWith(prefix),
  );
  if (paths.length === 0) return NextResponse.json({ ok: true });

  await supabaseAdmin.storage.from(BUCKET).remove(paths).catch(() => {});
  return NextResponse.json({ ok: true });
}
