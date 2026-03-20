import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { allcareAdmin } from '@/lib/supabase/allcare'

export async function GET() {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const now = new Date()

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

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
    { data: thisMonthUsersRaw },
    { data: lastMonthUsersRaw },
    { data: thisMonthSubsRaw },
    { data: lastMonthSubsRaw },
  ] = await Promise.all([
    allcareAdmin.from('users').select('created_at').gte('created_at', sixMonthsAgo.toISOString()),
    allcareAdmin.from('subscriptions').select('created_at, status, cancelled_at').gte('created_at', sixMonthsAgo.toISOString()),
    allcareAdmin.from('subscriptions').select('status, cancelled_at'),
    allcareAdmin.from('subscriptions').select('amount').eq('status', 'active').is('cancelled_at', null),
    allcareAdmin.from('payments').select('amount').eq('status', 'completed').like('order_id', 'PKG-%'),
    allcareAdmin.from('payments').select('amount').eq('status', 'completed').like('order_id', 'CUSTOM-%'),
    allcareAdmin.from('users').select('id').gte('created_at', thisMonthStart.toISOString()),
    allcareAdmin.from('users').select('id').gte('created_at', lastMonthStart.toISOString()).lte('created_at', lastMonthEnd.toISOString()),
    allcareAdmin.from('subscriptions').select('id').gte('created_at', thisMonthStart.toISOString()),
    allcareAdmin.from('subscriptions').select('id').gte('created_at', lastMonthStart.toISOString()).lte('created_at', lastMonthEnd.toISOString()),
  ])

  // ── 월별 신규 회원 & 구독 (최근 6개월)
  const monthMap: Record<string, { users: number; subs: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
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
  const totalSubs = active + cancelScheduled + cancelled
  const statusDist = [
    { name: '활성', value: active, fill: '#22c55e', pct: totalSubs ? Math.round(active / totalSubs * 100) : 0 },
    { name: '취소예정', value: cancelScheduled, fill: '#f59e0b', pct: totalSubs ? Math.round(cancelScheduled / totalSubs * 100) : 0 },
    { name: '취소', value: cancelled, fill: '#ef4444', pct: totalSubs ? Math.round(cancelled / totalSubs * 100) : 0 },
  ]

  // ── 매출
  const subRev    = subPayments?.reduce((s, p) => s + (p.amount || 0), 0) ?? 0
  const pkgRev    = pkgPayments?.reduce((s, p) => s + (p.amount || 0), 0) ?? 0
  const customRev = customPayments?.reduce((s, p) => s + (p.amount || 0), 0) ?? 0
  const totalRev  = subRev + pkgRev + customRev
  const revenueDist = [
    { name: '구독', value: subRev, pct: totalRev ? Math.round(subRev / totalRev * 100) : 0 },
    { name: '패키지', value: pkgRev, pct: totalRev ? Math.round(pkgRev / totalRev * 100) : 0 },
    { name: '단과', value: customRev, pct: totalRev ? Math.round(customRev / totalRev * 100) : 0 },
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
  const avgDaily = dailyUsers.length ? Math.round(dailyUsers.reduce((s, d) => s + d.count, 0) / dailyUsers.length * 10) / 10 : 0
  const peak = dailyUsers.reduce((a, b) => b.count > a.count ? b : a, { date: '-', count: 0 })

  // ── 카드 부가 데이터
  const thisMonthUsers = thisMonthUsersRaw?.length ?? 0
  const lastMonthUsers = lastMonthUsersRaw?.length ?? 0
  const userGrowthPct  = lastMonthUsers ? Math.round((thisMonthUsers - lastMonthUsers) / lastMonthUsers * 100) : null
  const thisMonthSubs  = thisMonthSubsRaw?.length ?? 0
  const lastMonthSubs  = lastMonthSubsRaw?.length ?? 0
  const subGrowthPct   = lastMonthSubs ? Math.round((thisMonthSubs - lastMonthSubs) / lastMonthSubs * 100) : null

  return NextResponse.json({
    monthly,
    statusDist,
    totalSubs,
    revenueDist,
    dailyUsers,
    avgDaily,
    peakDay: peak.date,
    peakCount: peak.count,
    thisMonthUsers,
    lastMonthUsers,
    userGrowthPct,
    thisMonthSubs,
    subGrowthPct,
    cancelScheduled,
    totalRev,
  })
}
