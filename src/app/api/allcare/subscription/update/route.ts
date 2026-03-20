import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { allcareAdmin } from '@/lib/supabase/allcare'

export async function POST(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { userId, status } = await request.json()

  if (!userId || !status) {
    return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 })
  }

  if (!['active', 'cancel_scheduled', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: '유효하지 않은 상태입니다.' }, { status: 400 })
  }

  const { data: subscription } = await allcareAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'cancel_scheduled', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const now = new Date().toISOString()

  // 구독 없는 유저에게 어드민이 직접 구독 부여
  if (!subscription) {
    if (status !== 'active') {
      return NextResponse.json({ error: '구독 정보가 없어 해당 상태로 변경할 수 없습니다.' }, { status: 404 })
    }
    const nextBilling = new Date()
    nextBilling.setMonth(nextBilling.getMonth() + 1)
    const { error: insertError } = await allcareAdmin
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan: 'basic',
        status: 'active',
        amount: 0,
        billing_cycle: 'monthly',
        start_date: now,
        next_billing_date: nextBilling.toISOString(),
        cancelled_at: null,
        end_date: null,
        created_at: now,
      })
    if (insertError) {
      return NextResponse.json({ error: '구독 생성에 실패했습니다.', detail: insertError.message, code: insertError.code }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  let updateData: Record<string, unknown> = {}

  if (status === 'active') {
    updateData = { status: 'active', cancelled_at: null, end_date: null }
  } else if (status === 'cancel_scheduled') {
    updateData = {
      status: 'active',
      cancelled_at: now,
      end_date: subscription.next_billing_date,
    }
  } else if (status === 'cancelled') {
    updateData = {
      status: 'cancelled',
      cancelled_at: now,
      end_date: now,
    }
  }

  const { error: updateError } = await allcareAdmin
    .from('subscriptions')
    .update(updateData)
    .eq('id', subscription.id)

  if (updateError) {
    return NextResponse.json({ error: '구독 상태 변경에 실패했습니다.', detail: updateError.message, code: updateError.code }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
