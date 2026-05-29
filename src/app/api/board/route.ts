import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const PAGE_SIZE = 10;

export const BOARD_CATEGORIES = ["공지", "일반", "인사", "행사"] as const;

interface AttachmentInput {
  name?: string;
  path?: string;
  size?: number;
  type?: string;
}

// GET /api/board?page=1&q=&category=&field=제목|작성자|내용
export async function GET(req: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;
  const isAdmin = appUser.role === "master-admin" || appUser.role === "admin";

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const q = (searchParams.get("q") ?? "").trim();
  const category = (searchParams.get("category") ?? "").trim();
  const field = (searchParams.get("field") ?? "제목").trim();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const searchByAuthor = q && field === "작성자";

  let query = supabaseAdmin
    .from("board_posts")
    .select(
      `id, title, category, department, author_id, is_pinned, view_count, created_at, attachments, author:app_users${
        searchByAuthor ? "!inner" : ""
      }(display_name), comments:board_comments(count)`,
      { count: "exact" },
    )
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (category && (BOARD_CATEGORIES as readonly string[]).includes(category)) {
    query = query.eq("category", category);
  }
  if (q) {
    if (field === "내용") query = query.ilike("content", `%${q}%`);
    else if (field === "작성자")
      query = query.ilike("author.display_name", `%${q}%`);
    else query = query.ilike("title", `%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    id: number;
    title: string;
    category: string;
    department: string | null;
    author_id: number | null;
    is_pinned: boolean;
    view_count: number;
    created_at: string;
    attachments: AttachmentInput[] | null;
    author: { display_name: string | null } | null;
    comments: { count: number }[] | null;
  };

  const items = (data as unknown as Row[]).map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category ?? "일반",
    department: r.department ?? null,
    author_name: r.author?.display_name ?? "(탈퇴)",
    is_pinned: r.is_pinned,
    view_count: r.view_count,
    created_at: r.created_at,
    comment_count: r.comments?.[0]?.count ?? 0,
    attachment_count: Array.isArray(r.attachments) ? r.attachments.length : 0,
  }));

  return NextResponse.json({
    items,
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    me: { is_admin: isAdmin },
  });
}

// POST /api/board  { title, content, category?, attachments?, is_pinned? }
export async function POST(req: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;
  if (!appUser.id || appUser.role === "guest") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    title?: string;
    content?: string;
    category?: string;
    department?: string | null;
    attachments?: AttachmentInput[];
    is_pinned?: boolean;
  } | null;

  const title = (body?.title ?? "").trim();
  const content = (body?.content ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "제목을 입력하세요." }, { status: 400 });
  }

  const category = (BOARD_CATEGORIES as readonly string[]).includes(
    body?.category ?? "",
  )
    ? (body!.category as string)
    : "일반";

  const isAdmin = appUser.role === "master-admin" || appUser.role === "admin";
  const attachments = Array.isArray(body?.attachments)
    ? body!.attachments
        .filter((a) => a && a.path && a.name)
        .map((a) => ({
          name: String(a.name),
          path: String(a.path),
          size: Number(a.size ?? 0),
          type: String(a.type ?? ""),
        }))
    : [];

  const { data, error } = await supabaseAdmin
    .from("board_posts")
    .insert({
      title,
      content,
      category,
      department:
        typeof body?.department === "string" && body.department.trim()
          ? body.department.trim().slice(0, 60)
          : null,
      author_id: appUser.id,
      is_pinned: isAdmin ? !!body?.is_pinned : false,
      attachments,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}
