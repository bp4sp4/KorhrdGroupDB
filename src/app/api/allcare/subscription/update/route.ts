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

  const { data: subscription, error: fetchError } = await allcareAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'cancel_scheduled', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (fetchError || !subscription) {
    return NextResponse.json({ error: '구독 정보를 찾을 수 없습니다.' }, { status: 404 })
  }

  let updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (status === 'active') {
    updateData = { ...updateData, status: 'active', cancelled_at: null, end_date: null }
  } else if (status === 'cancel_scheduled') {
    updateData = {
      ...updateData,
      status: 'active',
      cancelled_at: new Date().toISOString(),
      end_date: subscription.next_billing_date,
    }
  } else if (status === 'cancelled') {
    updateData = {
      ...updateData,
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      end_date: new Date().toISOString(),
    }
  }

  const { error: updateError } = await allcareAdmin
    .from('subscriptions')
    .update(updateData)
    .eq('id', subscription.id)

  if (updateError) {
    return NextResponse.json({ error: '구독 상태 변경에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
