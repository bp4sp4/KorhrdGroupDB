import { NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getAnnualGrant, parseJoinDate } from '@/lib/leave/seniority'

// GET /api/leave-balances/me — 본인 휴가 잔여 (자동 발생 + 수동 부여 - 사용)
export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  // 입사일
  const { data: hr } = await supabaseAdmin
    .from('hr_records')
    .select('joined_at')
    .eq('user_id', appUser.id)
    .maybeSingle()

  const joinedDate = parseJoinDate(hr?.joined_at as string | undefined)
  const autoGrant = joinedDate ? getAnnualGrant(joinedDate, new Date()) : 0

  // 이력
  const { data: transactions } = await supabaseAdmin
    .from('leave_transactions')
    .select('id, delta, reason, approval_id, created_at')
    .eq('user_id', appUser.id)
    .order('created_at', { ascending: false })

  let manualGrant = 0
  let used = 0
  for (const t of transactions ?? []) {
    const d = Number(t.delta)
    if (d > 0) manualGrant += d
    else if (d < 0) used += Math.abs(d)
  }

  const balance = autoGrant + manualGrant - used

  return NextResponse.json({
    balance,
    auto_grant: autoGrant,
    manual_grant: manualGrant,
    used,
    joined_at: (hr?.joined_at as string | null) ?? null,
    transactions: (transactions ?? []).slice(0, 20),
  })
}
