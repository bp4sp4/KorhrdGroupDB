import { NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/leave-balances/me — 본인 휴가 잔여 + 최근 이력
export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const { data: balance } = await supabaseAdmin
    .from('leave_balances')
    .select('balance, updated_at')
    .eq('user_id', appUser.id)
    .maybeSingle()

  const { data: transactions } = await supabaseAdmin
    .from('leave_transactions')
    .select('id, delta, reason, approval_id, created_at')
    .eq('user_id', appUser.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({
    balance: Number(balance?.balance ?? 0),
    updated_at: balance?.updated_at ?? null,
    transactions: transactions ?? [],
  })
}
