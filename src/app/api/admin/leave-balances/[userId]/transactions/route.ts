import { NextRequest, NextResponse } from 'next/server'
import { requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/admin/leave-balances/[userId]/transactions — 변동 이력 조회
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const { errorResponse } = await requireMasterAdmin()
  if (errorResponse) return errorResponse

  const { userId } = await context.params
  const targetUserId = Number(userId)
  if (!Number.isFinite(targetUserId)) {
    return NextResponse.json({ error: '유효하지 않은 user_id' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('leave_transactions')
    .select('id, delta, reason, approval_id, created_by, created_at')
    .eq('user_id', targetUserId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // created_by 이름 매핑
  const creatorIds = Array.from(
    new Set((data ?? []).map((r) => r.created_by as number | null).filter(Boolean) as number[]),
  )
  const nameMap = new Map<number, string>()
  if (creatorIds.length) {
    const { data: users } = await supabaseAdmin
      .from('app_users')
      .select('id, display_name')
      .in('id', creatorIds)
    for (const u of users ?? []) nameMap.set(u.id as number, (u.display_name as string) ?? '')
  }

  const items = (data ?? []).map((r) => ({
    id: r.id as string,
    delta: Number(r.delta),
    reason: r.reason as string,
    approval_id: (r.approval_id as string | null) ?? null,
    created_by: (r.created_by as number | null) ?? null,
    created_by_name: r.created_by ? nameMap.get(r.created_by as number) ?? null : null,
    created_at: r.created_at as string,
  }))

  return NextResponse.json({ items })
}
