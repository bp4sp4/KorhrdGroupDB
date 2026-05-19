import { NextRequest, NextResponse } from 'next/server'
import { requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/admin/hr-records?status=submitted&q=
// master-admin 전용 — 인사기록카드 목록 조회 + 작성자 이름 매핑
export async function GET(req: NextRequest) {
  const { errorResponse } = await requireMasterAdmin()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? ''
  const q = (searchParams.get('q') ?? '').trim()

  let query = supabaseAdmin
    .from('hr_records')
    .select('*')
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 작성자 이름/이메일 매핑
  const userIds = Array.from(
    new Set((data ?? []).map((r) => r.user_id as number).filter(Boolean)),
  )
  let userMap: Record<number, { username: string; display_name: string | null }> = {}
  if (userIds.length > 0) {
    const { data: users } = await supabaseAdmin
      .from('app_users')
      .select('id, username, display_name')
      .in('id', userIds)
    for (const u of users ?? []) {
      userMap[u.id as number] = {
        username: (u.username as string) ?? '',
        display_name: (u.display_name as string | null) ?? null,
      }
    }
  }

  let enriched = (data ?? []).map((r) => ({
    ...r,
    author_name: userMap[r.user_id as number]?.display_name ?? null,
    author_email: userMap[r.user_id as number]?.username ?? null,
  }))

  if (q) {
    const lq = q.toLowerCase()
    enriched = enriched.filter(
      (r) =>
        (r.name_ko ?? '').toLowerCase().includes(lq) ||
        (r.name_en ?? '').toLowerCase().includes(lq) ||
        (r.author_name ?? '').toLowerCase().includes(lq) ||
        (r.author_email ?? '').toLowerCase().includes(lq),
    )
  }

  return NextResponse.json({ items: enriched })
}
