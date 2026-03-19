import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { allcareAdmin } from '@/lib/supabase/allcare'

export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const provider = searchParams.get('provider') || 'all'
  const subscription = searchParams.get('subscription') || 'all'
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = 10

  let query = allcareAdmin.from('admin_user_details').select('*')

  if (search) {
    query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%,phone.ilike.%${search}%`)
  }
  if (provider !== 'all') {
    query = query.eq('provider', provider)
  }
  if (subscription === 'active') {
    query = query.eq('subscription_status', 'active').is('cancelled_at', null)
  } else if (subscription === 'cancelled') {
    query = query.not('cancelled_at', 'is', null)
  } else if (subscription === 'none') {
    query = query.is('subscription_status', null)
  }

  query = query.order('registered_at', { ascending: false })

  const { data: users, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let finalUsers = users || []
  if (subscription === 'cancel_scheduled') {
    finalUsers = finalUsers.filter((u: Record<string, unknown>) => u.subscription_status === 'cancel_scheduled')
  }

  const total = finalUsers.length
  const from = (page - 1) * pageSize
  const paginated = finalUsers.slice(from, from + pageSize)

  return NextResponse.json({ users: paginated, total, page, pageSize })
}
