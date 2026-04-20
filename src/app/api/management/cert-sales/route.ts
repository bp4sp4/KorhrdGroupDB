import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireManagementAccess, isRevenueOwnAllowedForDivision } from '@/lib/auth/managementAccess'

// 민간자격증사업부 - 학점연계신청 결제완료 월 매출 조회
// GET /api/management/cert-sales?year=2026&month=4
export async function GET(request: NextRequest) {
  const emptyBody = { year: 0, month: 0, total: { paymentAmount: 0, count: 0, avgAmount: 0 }, byDay: [] }
  const access = await requireManagementAccess('revenues', { allowOwn: true, emptyBody })
  if (!access.ok) return access.response

  // 'own' 스코프: 사업본부(BIZ) 소속만 열람 가능
  if (access.scope === 'own') {
    const allowed = await isRevenueOwnAllowedForDivision(access.appUser.department_id, 'cert', access.appUser.position_id)
    if (!allowed) return NextResponse.json(emptyBody)
  }

  const sp = request.nextUrl.searchParams
  const year = parseInt(sp.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(sp.get('month') ?? String(new Date().getMonth() + 1))

  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const startDate = `${year}-${pad(month)}-01T00:00:00+09:00`
  const endDate = `${year}-${pad(month)}-${pad(lastDay)}T23:59:59+09:00`

  const { data, error } = await supabaseAdmin
    .from('certificate_applications')
    .select('amount, created_at')
    .eq('payment_status', 'paid')
    .eq('source', 'bridge')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .is('deleted_at', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = data ?? []
  const totalAmount = rows.reduce((s, r) => s + (r.amount || 0), 0)
  const count = rows.length
  const avgAmount = count > 0 ? Math.round(totalAmount / count) : 0

  // 일별 집계
  const dayMap = new Map<number, { count: number; amount: number }>()
  for (const row of rows) {
    const day = new Date(row.created_at).getDate()
    if (!dayMap.has(day)) dayMap.set(day, { count: 0, amount: 0 })
    const s = dayMap.get(day)!
    s.count += 1
    s.amount += row.amount || 0
  }

  const byDay = Array.from(dayMap.entries())
    .map(([day, s]) => ({ day, ...s }))
    .sort((a, b) => a.day - b.day)

  return NextResponse.json(
    {
      year, month,
      total: { paymentAmount: totalAmount, count, avgAmount },
      byDay,
    },
    {
      headers: {
        'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300',
      },
    }
  )
}
