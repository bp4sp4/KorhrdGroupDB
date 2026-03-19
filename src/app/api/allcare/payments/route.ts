import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { allcareAdmin } from '@/lib/supabase/allcare'

export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const tab = searchParams.get('tab') || 'payments'
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  if (tab === 'custom') {
    const { data, error, count } = await allcareAdmin
      .from('custom_payment_requests')
      .select('*, users(name, email, phone)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ payments: data || [], total: count || 0, page, pageSize })
  }

  const { data, error, count } = await allcareAdmin
    .from('payments')
    .select('*, users(name, email, phone)', { count: 'exact' })
    .not('order_id', 'like', 'CUSTOM-%')
    .in('status', ['completed', 'cancelled', 'refunded', 'refund_requested'])
    .order('approved_at', { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payments: data || [], total: count || 0, page, pageSize })
}
