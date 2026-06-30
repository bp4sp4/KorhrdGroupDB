import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/practice-applicants/search?q=홍길동
// 상담 직원용 — 학생 이름/연락처/주소로 검색해 출발지(집 주소) 후보 반환
export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 100)
    : 8;

  let query = supabaseAdmin
    .from("practice_applicants")
    .select(
      "id, name, contact, address, birth_date, gender, status, practice_type, desired_date, desired_weekday, desired_semester, recognition_period, training_center, field_institution, own_car, manager, counsel_content",
    )
    .not("address", "is", null)
    .neq("address", "")
    .order("seq_no", { ascending: true, nullsFirst: false })
    .limit(limit);

  // 검색어 있으면 이름/연락처/주소 필터, 없으면 목록(최근순) 그대로
  if (q.length >= 1) {
    const safe = q.replace(/[%_,]/g, (m) => `\\${m}`);
    query = query.or(
      `name.ilike.%${safe}%,contact.ilike.%${safe}%,address.ilike.%${safe}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("[practice-applicants/search] 오류:", error);
    return NextResponse.json({ error: "검색 실패" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
