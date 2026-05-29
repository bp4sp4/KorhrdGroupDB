import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// POST /api/board/[id]/comments  { content } — 댓글 작성
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;
  if (!appUser.id || appUser.role === "guest") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { id } = await params;
  const postId = Number(id);
  if (!postId) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as { content?: string } | null;
  const content = (body?.content ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "내용을 입력하세요." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("board_comments").insert({
    post_id: postId,
    author_id: appUser.id,
    content,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
