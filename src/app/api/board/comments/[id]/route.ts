import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// DELETE /api/board/comments/[id] — 댓글 삭제 (작성자 또는 관리자)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const commentId = Number(id);
  if (!commentId) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const { data: comment } = await supabaseAdmin
    .from("board_comments")
    .select("id, author_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) return NextResponse.json({ error: "댓글이 없습니다." }, { status: 404 });

  const isAdmin = appUser.role === "master-admin" || appUser.role === "admin";
  if (!isAdmin && comment.author_id !== appUser.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("board_comments")
    .delete()
    .eq("id", commentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
