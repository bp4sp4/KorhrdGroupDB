import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { allcareAdmin } from '@/lib/supabase/allcare'
import { supabaseAdmin } from '@/lib/supabase/admin'

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
    const { data, error, count } = await supabaseAdmin
      .from('allcare_custom_payment_requests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // user_id로 allcare_users 조회 후 병합
    const userIds = [...new Set((data || []).map((r: any) => r.user_id).filter(Boolean))]
    let usersMap: Record<string, any> = {}
    if (userIds.length > 0) {
      const { data: usersData } = await supabaseAdmin
        .from('allcare_users')
        .select('id, name, email, phone')
        .in('id', userIds)
      ;(usersData || []).forEach((u: any) => { usersMap[u.id] = u })
    }

    const payments = (data || []).map((r: any) => ({
      ...r,
      users: usersMap[r.user_id] || null,
    }))

    return NextResponse.json({ payments, total: count || 0, page, pageSize })
  }

  const { data, error, count } = await allcareAdmin
    .from('payments')
    .select('*, users(name, email, phone)', { count: 'exact' })
    .in('status', ['completed', 'cancelled', 'refunded', 'refund_requested'])
    .order('approved_at', { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payments: data || [], total: count || 0, page, pageSize })
}
