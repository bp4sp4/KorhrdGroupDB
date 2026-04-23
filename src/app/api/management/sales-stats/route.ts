import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { nmsAdmin } from '@/lib/supabase/nms'
import { allcareAdmin } from '@/lib/supabase/allcare'
import { getRevenueOwnAccessibleDivisions, requireManagementAccess } from '@/lib/auth/managementAccess'

// 최근 N개월 3사업부 통합 월별 매출 통계
// GET /api/management/sales-stats?months=6
export async function GET(request: NextRequest) {
  const access = await requireManagementAccess('revenues', { allowOwn: true, emptyBody: { months: [] } })
  if (!access.ok) return access.response

  const ownDivisions = access.scope === 'own'
    ? await getRevenueOwnAccessibleDivisions(access.appUser.department_id, access.appUser.position_id)
    : null

  if (access.scope === 'own' && (!ownDivisions || ownDivisions.length === 0)) {
    return NextResponse.json({ months: [] })
  }

  const sp = request.nextUrl.searchParams
  const months = Math.min(parseInt(sp.get('months') ?? '6'), 12)

  const yearParam = parseInt(sp.get('year') ?? '')
  const monthParam = parseInt(sp.get('month') ?? '')
  const now = new Date()
  const refYear = Number.isFinite(yearParam) && yearParam > 0 ? yearParam : now.getFullYear()
  const refMonth = Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : now.getMonth() + 1

  const ranges: { year: number; month: number; label: string }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(refYear, refMonth - 1 - i, 1)
    ranges.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${d.getMonth() + 1}월`,
    })
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  const rangeStart = `${ranges[0].year}-${pad(ranges[0].month)}-01T00:00:00+09:00`
  const lastRange = ranges[ranges.length - 1]
  const lastDay = new Date(lastRange.year, lastRange.month, 0).getDate()
  const rangeEnd = `${lastRange.year}-${pad(lastRange.month)}-${pad(lastDay)}T23:59:59+09:00`

  const monthKey = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${d.getMonth() + 1}`
  }

  const [nmsRes, certRes, abroadRes, allcareRes, eduRes] = await Promise.allSettled([
    nmsAdmin
      .from('customers')
      .select('payment_amount, created_at')
      .eq('status', '등록완료')
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd),
    supabaseAdmin
      .from('certificate_applications')
      .select('amount, created_at')
      .eq('payment_status', 'paid')
      .eq('source', 'bridge')
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd)
      .is('deleted_at', null),
    supabaseAdmin
      .from('payments')
      .select('amount, created_at')
      .eq('status', 'completed')
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd),
    allcareAdmin
      .from('payments')
      .select('amount, approved_at, user_id')
      .eq('status', 'completed')
      .gte('approved_at', rangeStart)
      .lte('approved_at', rangeEnd)
      .neq('user_id', '94832325-c5ec-4b21-bc74-00ae0763cbda'),
    supabaseAdmin
      .from('edu_students')
      .select('cost, registered_at, status')
      .gte('registered_at', rangeStart.slice(0, 10))
      .lte('registered_at', rangeEnd)
      .not('status', 'in', '("환불","삭제예정")'),
  ])

  const monthly: Record<string, { label: string; nms: number; cert: number; abroad: number; edu: number }> = {}
  for (const r of ranges) {
    const key = `${r.year}-${r.month}`
    monthly[key] = { label: r.label, nms: 0, cert: 0, abroad: 0, edu: 0 }
  }

  if (nmsRes.status === 'fulfilled' && nmsRes.value.data) {
    for (const row of nmsRes.value.data) {
      const k = monthKey(row.created_at)
      if (monthly[k]) monthly[k].nms += row.payment_amount || 0
    }
  }

  if (certRes.status === 'fulfilled' && certRes.value.data) {
    for (const row of certRes.value.data) {
      const k = monthKey(row.created_at)
      if (monthly[k]) monthly[k].cert += row.amount || 0
    }
  }

  if (abroadRes.status === 'fulfilled' && abroadRes.value.data) {
    for (const row of abroadRes.value.data) {
      const k = monthKey(row.created_at)
      if (monthly[k]) monthly[k].abroad += row.amount || 0
    }
  }

  if (allcareRes.status === 'fulfilled' && allcareRes.value.data) {
    for (const row of allcareRes.value.data) {
      const k = monthKey(row.approved_at)
      if (monthly[k]) monthly[k].nms += row.amount || 0
    }
  }

  if (eduRes.status === 'fulfilled' && eduRes.value.data) {
    for (const row of eduRes.value.data) {
      if (!row.registered_at) continue
      const k = monthKey(row.registered_at)
      if (monthly[k]) monthly[k].edu += Number(row.cost) || 0
    }
  }

  const result = Object.entries(monthly).map(([key, v]) => {
    const nms = !ownDivisions || ownDivisions.includes('nms') ? v.nms : 0
    const cert = !ownDivisions || ownDivisions.includes('cert') ? v.cert : 0
    const abroad = !ownDivisions || ownDivisions.includes('abroad') ? v.abroad : 0
    const edu = !ownDivisions || ownDivisions.includes('nms') ? v.edu : 0

    return {
      key,
      label: v.label,
      nms,
      cert,
      abroad,
      edu,
      total: nms + cert + abroad + edu,
    }
  })

  return NextResponse.json(
    { months: result },
    {
      headers: {
        'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300',
      },
    }
  )
}
