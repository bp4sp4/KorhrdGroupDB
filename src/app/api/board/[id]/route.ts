import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "board-attachments";

const BOARD_CATEGORIES = ["공지", "일반", "인사", "행사"];

interface Attachment {
  name: string;
  path: string;
  size: number;
  type: string;
}

// GET /api/board/[id]?view=1 — 상세 (view=1 일 때만 조회수 증가)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const postId = Number(id);
  if (!postId) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const countView = new URL(req.url).searchParams.get("view") === "1";

  const { data: post, error } = await supabaseAdmin
    .from("board_posts")
    .select(
      "id, title, content, category, department, author_id, is_pinned, view_count, attachments, created_at, updated_at, author:app_users(display_name)",
    )
    .eq("id", postId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!post) return NextResponse.json({ error: "게시글이 없습니다." }, { status: 404 });

  // 조회수 +1 (best-effort) — 최초 열람 시(view=1)에만
  const viewCount = (post.view_count ?? 0) + (countView ? 1 : 0);
  if (countView) {
    await supabaseAdmin
      .from("board_posts")
      .update({ view_count: viewCount })
      .eq("id", postId);
  }

  // 댓글
  const { data: comments } = await supabaseAdmin
    .from("board_comments")
    .select("id, content, author_id, created_at, author:app_users(display_name)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  // 첨부 서명 다운로드 URL (1시간)
  const rawAttachments = (post.attachments as Attachment[] | null) ?? [];
  const attachments = await Promise.all(
    rawAttachments.map(async (a) => {
      const { data } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(a.path, 3600, { download: a.name });
      return { ...a, url: data?.signedUrl ?? null };
    }),
  );

  type AuthorRel = { display_name: string | null } | null;
  const author = post.author as unknown as AuthorRel;
  const isAdmin = appUser.role === "master-admin" || appUser.role === "admin";

  return NextResponse.json({
    post: {
      id: post.id,
      title: post.title,
      content: post.content,
      category: post.category ?? "일반",
      department: post.department ?? null,
      author_id: post.author_id,
      author_name: author?.display_name ?? "(탈퇴)",
      is_pinned: post.is_pinned,
      view_count: viewCount,
      created_at: post.created_at,
      updated_at: post.updated_at,
      attachments,
    },
    comments: (
      (comments as unknown as {
        id: number;
        content: string;
        author_id: number | null;
        created_at: string;
        author: AuthorRel;
      }[]) ?? []
    ).map((c) => ({
      id: c.id,
      content: c.content,
      author_id: c.author_id,
      author_name: c.author?.display_name ?? "(탈퇴)",
      created_at: c.created_at,
      can_delete: isAdmin || c.author_id === appUser.id,
    })),
    me: { id: appUser.id, is_admin: isAdmin },
    can_edit: isAdmin || post.author_id === appUser.id,
  });
}

// PATCH /api/board/[id]  { title?, content?, attachments?, is_pinned? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const postId = Number(id);
  if (!postId) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const { data: post } = await supabaseAdmin
    .from("board_posts")
    .select("id, author_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: "게시글이 없습니다." }, { status: 404 });

  const isAdmin = appUser.role === "master-admin" || appUser.role === "admin";
  if (!isAdmin && post.author_id !== appUser.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    title?: string;
    content?: string;
    category?: string;
    department?: string | null;
    attachments?: Attachment[];
    is_pinned?: boolean;
  } | null;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.title === "string") {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: "제목을 입력하세요." }, { status: 400 });
    patch.title = t;
  }
  if (typeof body?.content === "string") patch.content = body.content;
  if (typeof body?.category === "string" && BOARD_CATEGORIES.includes(body.category)) {
    patch.category = body.category;
  }
  if (body?.department !== undefined) {
    patch.department =
      typeof body.department === "string" && body.department.trim()
        ? body.department.trim().slice(0, 60)
        : null;
  }
  if (Array.isArray(body?.attachments)) {
    patch.attachments = body!.attachments
      .filter((a) => a && a.path && a.name)
      .map((a) => ({
        name: String(a.name),
        path: String(a.path),
        size: Number(a.size ?? 0),
        type: String(a.type ?? ""),
      }));
  }
  // 상단고정은 관리자만
  if (typeof body?.is_pinned === "boolean" && isAdmin) {
    patch.is_pinned = body.is_pinned;
  }

  const { error } = await supabaseAdmin
    .from("board_posts")
    .update(patch)
    .eq("id", postId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/board/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { id } = await params;
  const postId = Number(id);
  if (!postId) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const { data: post } = await supabaseAdmin
    .from("board_posts")
    .select("id, author_id, attachments")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: "게시글이 없습니다." }, { status: 404 });

  const isAdmin = appUser.role === "master-admin" || appUser.role === "admin";
  if (!isAdmin && post.author_id !== appUser.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // 첨부 파일 삭제 (best-effort)
  const atts = (post.attachments as Attachment[] | null) ?? [];
  const paths = atts.map((a) => a.path).filter(Boolean);
  if (paths.length) {
    await supabaseAdmin.storage.from(BUCKET).remove(paths).catch(() => {});
  }

  // 댓글은 FK ON DELETE CASCADE 로 함께 삭제
  const { error } = await supabaseAdmin
    .from("board_posts")
    .delete()
    .eq("id", postId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
