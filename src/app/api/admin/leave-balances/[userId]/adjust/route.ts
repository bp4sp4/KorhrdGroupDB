import { NextRequest, NextResponse } from 'next/server'
import { requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface AdjustBody {
  delta: number // + 부여, - 차감 (0.5 단위)
  reason: string
}

// POST /api/admin/leave-balances/[userId]/adjust — 어드민이 사용자 휴가 부여/차감
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const { appUser, errorResponse } = await requireMasterAdmin()
  if (errorResponse) return errorResponse

  const { userId } = await context.params
  const targetUserId = Number(userId)
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    return NextResponse.json({ error: '유효하지 않은 user_id' }, { status: 400 })
  }

  const body = (await req.json()) as Partial<AdjustBody>
  const delta = Number(body.delta)
  if (!Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: 'delta는 0이 아닌 숫자여야 합니다.' }, { status: 400 })
  }
  // 0.5 단위 검증
  if (Math.round(delta * 2) !== delta * 2) {
    return NextResponse.json({ error: 'delta는 0.5 단위여야 합니다.' }, { status: 400 })
  }
  const reason = (body.reason ?? '').trim()
  if (!reason) {
    return NextResponse.json({ error: '사유(reason)는 필수입니다.' }, { status: 400 })
  }

  // 대상 사용자 존재 확인
  const { data: target } = await supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('id', targetUserId)
    .maybeSingle()
  if (!target) {
    return NextResponse.json({ error: '대상 사용자를 찾을 수 없습니다.' }, { status: 404 })
  }

  // 현재 잔여 조회 → 없으면 0으로 시작
  const { data: existing } = await supabaseAdmin
    .from('leave_balances')
    .select('balance')
    .eq('user_id', targetUserId)
    .maybeSingle()

  const current = Number(existing?.balance ?? 0)
  const next = current + delta

  // upsert
  const { error: upsertErr } = await supabaseAdmin
    .from('leave_balances')
    .upsert(
      { user_id: targetUserId, balance: next, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

  // 이력 기록
  const { error: txErr } = await supabaseAdmin.from('leave_transactions').insert({
    user_id: targetUserId,
    delta,
    reason,
    approval_id: null,
    created_by: appUser.id,
  })
  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })

  return NextResponse.json({ user_id: targetUserId, balance: next })
}
