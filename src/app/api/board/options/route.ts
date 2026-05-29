import { NextResponse } from "next/server";
import { requireAuthFull } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// GET /api/board/options — 작성 모달용 부서 목록 + 내 기본 부서
export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull();
  if (errorResponse) return errorResponse;

  const { data: depts } = await supabaseAdmin
    .from("departments")
    .select("id, name")
    .order("sort_order");

  let myDepartment: string | null = null;
  if (appUser.department_id) {
    const found = (depts ?? []).find((d) => d.id === appUser.department_id);
    myDepartment = found?.name ?? null;
  }

  return NextResponse.json({
    departments: (depts ?? []).map((d) => ({ id: d.id, name: d.name })),
    myDepartment,
  });
}
