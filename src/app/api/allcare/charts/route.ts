import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { allcareAdmin } from '@/lib/supabase/allcare'

export async function GET() {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const now = new Date()
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)
  sixMonthsAgo.setHours(0, 0, 0, 0)

  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  const [
    { data: recentUsers },
    { data: recentSubs },
    { data: allSubStatus },
    { data: subPayments },
    { data: pkgPayments },
    { data: customPayments },
  ] = await Promise.all([
    allcareAdmin.from('users').select('created_at').gte('created_at', sixMonthsAgo.toISOString()),
    allcareAdmin.from('subscriptions').select('created_at, status, cancelled_at').gte('created_at', sixMonthsAgo.toISOString()),
    allcareAdmin.from('subscriptions').select('status, cancelled_at'),
    allcareAdmin.from('subscriptions').select('amount, created_at').eq('status', 'active').is('cancelled_at', null),
    allcareAdmin.from('payments').select('amount, approved_at').eq('status', 'completed').like('order_id', 'PKG-%'),
    allcareAdmin.from('payments').select('amount, created_at').eq('status', 'completed').like('order_id', 'CUSTOM-%'),
  ])

  // ── 월별 신규 회원 & 구독 (최근 6개월)
  const monthMap: Record<string, { users: number; subs: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap[key] = { users: 0, subs: 0 }
  }

  recentUsers?.forEach(u => {
    const d = new Date(u.created_at)
    const key = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
    if (monthMap[key]) monthMap[key].users++
  })
  recentSubs?.forEach(s => {
    const d = new Date(s.created_at)
    const key = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
    if (monthMap[key]) monthMap[key].subs++
  })

  const monthly = Object.entries(monthMap).map(([month, v]) => ({ month, ...v }))

  // ── 구독 상태 분포
  let active = 0, cancelScheduled = 0, cancelled = 0
  allSubStatus?.forEach(s => {
    if (s.status === 'active' && !s.cancelled_at) active++
    else if (s.status === 'active' && s.cancelled_at) cancelScheduled++
    else cancelled++
  })
  const statusDist = [
    { name: '활성', value: active, fill: '#22c55e' },
    { name: '취소예정', value: cancelScheduled, fill: '#f59e0b' },
    { name: '취소', value: cancelled, fill: '#ef4444' },
  ]

  // ── 매출 분포
  const subRev = subPayments?.reduce((s, p) => s + (p.amount || 0), 0) ?? 0
  const pkgRev = pkgPayments?.reduce((s, p) => s + (p.amount || 0), 0) ?? 0
  const customRev = customPayments?.reduce((s, p) => s + (p.amount || 0), 0) ?? 0
  const revenueDist = [
    { name: '구독', value: subRev },
    { name: '패키지', value: pkgRev },
    { name: '단과', value: customRev },
  ]

  // ── 일별 신규 회원 (최근 30일)
  const dayMap: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
    dayMap[key] = 0
  }
  recentUsers?.forEach(u => {
    const d = new Date(u.created_at)
    if (d >= thirtyDaysAgo) {
      const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
      if (dayMap[key] !== undefined) dayMap[key]++
    }
  })
  const dailyUsers = Object.entries(dayMap).map(([date, count]) => ({ date, count }))

  return NextResponse.json({ monthly, statusDist, revenueDist, dailyUsers })
}
