import { NextRequest, NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// 작성 권한: 대리 이상 (positions.sort_order >= 3) 또는 admin/master-admin
async function canWrite(appUser: {
  role: string;
  position_id?: string | null;
}): Promise<boolean> {
  if (appUser.role === "master-admin" || appUser.role === "admin") return true;
  if (!appUser.position_id) return false;
  const { data } = await supabaseAdmin
    .from("positions")
    .select("sort_order, is_active")
    .eq("id", appUser.position_id)
    .maybeSingle();
  if (!data || !data.is_active) return false;
  return Number(data.sort_order) >= 3;
}

// GET /api/task-board?year=2026&month=5
export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;
  if (!appUser || appUser.role === "guest") {
    return NextResponse.json(
      { error: "접근 권한이 없습니다." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const today = new Date();
  const year = Number(searchParams.get("year") ?? today.getFullYear());
  const month = Number(searchParams.get("month") ?? today.getMonth() + 1);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12
  ) {
    return NextResponse.json({ error: "잘못된 연/월입니다." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("task_board_items")
    .select(
      `
      id, year, month, week_no, weekday, title, completed, sort_order,
      assignee_name, created_by, created_at, updated_at,
      author:app_users!task_board_items_created_by_fkey(id, display_name)
    `,
    )
    .eq("year", year)
    .eq("month", month)
    .order("week_no")
    .order("weekday")
    .order("sort_order")
    .order("created_at");

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

// POST /api/task-board
export async function POST(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;
  if (!appUser || appUser.role === "guest") {
    return NextResponse.json(
      { error: "접근 권한이 없습니다." },
      { status: 403 },
    );
  }
  if (!(await canWrite(appUser))) {
    return NextResponse.json(
      { error: "대리 이상만 작성할 수 있습니다." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { year, month, week_no, weekday, title, assignee_name } = body as {
    year?: number;
    month?: number;
    week_no?: number;
    weekday?: number;
    title?: string;
    assignee_name?: string | null;
  };

  if (
    typeof year !== "number" ||
    typeof month !== "number" ||
    typeof week_no !== "number" ||
    typeof weekday !== "number" ||
    !title?.trim()
  ) {
    return NextResponse.json(
      { error: "필수 항목이 누락되었습니다." },
      { status: 400 },
    );
  }
  if (
    month < 1 ||
    month > 12 ||
    week_no < 1 ||
    week_no > 4 ||
    weekday < 1 ||
    weekday > 5
  ) {
    return NextResponse.json(
      { error: "주차/요일 값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { data: inserted, error } = await supabaseAdmin
    .from("task_board_items")
    .insert({
      year,
      month,
      week_no,
      weekday,
      title: title.trim(),
      assignee_name: assignee_name?.trim() || null,
      created_by: appUser.id,
    })
    .select(
      `
      id, year, month, week_no, weekday, title, completed, sort_order,
      assignee_name, created_by, created_at, updated_at,
      author:app_users!task_board_items_created_by_fkey(id, display_name)
    `,
    )
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // 전체 구성원 공지 (user_id NULL = 전체 공지)
  const weekdayKo = ["", "월", "화", "수", "목", "금"][weekday] ?? "?";
  const authorName = appUser.display_name ?? "관리자";
  await supabaseAdmin.from("notifications").insert({
    type: "task_board",
    title: "통합 업무보드 새 알림",
    message: `[${month}월 ${week_no}주차 ${weekdayKo}] ${title.trim()} (${authorName})`,
    link: "/task-board",
    user_id: null,
    actor_id: appUser.id,
  });

  return NextResponse.json(inserted, { status: 201 });
}
