import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { allcareAdmin } from '@/lib/supabase/allcare'

export async function GET() {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const [
    { count: totalUsers },
    { count: activeSubscriptions },
    { count: cancelledSubscriptions },
    { data: activeSubAmounts },
    { data: pkgPayments },
    { data: customPayments },
  ] = await Promise.all([
    allcareAdmin.from('users').select('*', { count: 'exact', head: true }),
    allcareAdmin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active').is('cancelled_at', null),
    allcareAdmin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active').not('cancelled_at', 'is', null),
    allcareAdmin.from('subscriptions').select('amount').eq('status', 'active').is('cancelled_at', null),
    allcareAdmin.from('payments').select('amount').eq('status', 'completed').like('order_id', 'PKG-%'),
    allcareAdmin.from('payments').select('amount').eq('status', 'completed').like('order_id', 'CUSTOM-%'),
  ])

  const subscriptionRevenue = activeSubAmounts?.reduce((s, p) => s + (p.amount || 0), 0) ?? 0
  const packageRevenue = pkgPayments?.reduce((s, p) => s + (p.amount || 0), 0) ?? 0
  const customRevenue = customPayments?.reduce((s, p) => s + (p.amount || 0), 0) ?? 0

  return NextResponse.json({
    totalUsers: totalUsers ?? 0,
    activeSubscriptions: activeSubscriptions ?? 0,
    cancelledSubscriptions: cancelledSubscriptions ?? 0,
    totalRevenue: subscriptionRevenue + packageRevenue + customRevenue,
    subscriptionRevenue,
    packageRevenue,
    customRevenue,
  })
}
