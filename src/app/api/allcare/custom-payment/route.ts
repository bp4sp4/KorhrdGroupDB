import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { allcareAdmin } from '@/lib/supabase/allcare'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET: 특정 유저의 단과반 결제 요청 목록
export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId가 필요합니다.' }, { status: 400 })

  const { data, error } = await allcareAdmin
    .from('custom_payment_requests')
    .select('id, subject, subject_count, amount, status, memo, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data || [] })
}

// POST: 단과반 결제 요청 생성
export async function POST(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const body = await request.json()
  const { userId, subject, subject_count, amount, memo } = body

  if (!userId || !subject || !amount) {
    return NextResponse.json({ error: '필수 값이 누락되었습니다.' }, { status: 400 })
  }

  const insertData = {
    user_id: userId,
    subject,
    subject_count: subject_count || 1,
    amount: Number(amount),
    memo: memo || null,
    status: 'pending',
  }

  const { data, error } = await allcareAdmin
    .from('custom_payment_requests')
    .insert(insertData)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // hakjeom DB 동기화
  supabaseAdmin
    .from('allcare_custom_payment_requests')
    .insert({ ...insertData, id: data.id, created_at: data.created_at })
    .then(({ error: syncErr }) => {
      if (syncErr) console.error('[hakjeom sync] custom_payment_requests insert error:', syncErr)
    })

  return NextResponse.json({ request: data })
}

// PATCH: 단과반 결제 요청 취소
export async function PATCH(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { requestId } = await request.json()
  if (!requestId) return NextResponse.json({ error: 'requestId가 필요합니다.' }, { status: 400 })

  const { error } = await allcareAdmin
    .from('custom_payment_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // hakjeom DB 동기화
  supabaseAdmin
    .from('allcare_custom_payment_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .then(({ error: syncErr }) => {
      if (syncErr) console.error('[hakjeom sync] custom_payment_requests cancel error:', syncErr)
    })

  return NextResponse.json({ success: true })
}
