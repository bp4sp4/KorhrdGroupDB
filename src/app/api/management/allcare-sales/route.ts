import { NextRequest, NextResponse } from 'next/server'
import { requireManagementAccess, isRevenueOwnAllowedForDepartment } from '@/lib/auth/managementAccess'
import { allcareAdmin } from '@/lib/supabase/allcare'

// 올케어 월별 매출 조회 (학점은행제 사업부 포함)
// GET /api/management/allcare-sales?year=2026&month=4
export async function GET(request: NextRequest) {
  const emptyBody = { year: 0, month: 0, totalRevenue: 0, count: 0, byType: {}, payments: [] }
  const access = await requireManagementAccess('revenues', { allowOwn: true, emptyBody })
  if (!access.ok) return access.response

  // 'own' 스코프: 사업본부(BIZ) 소속만 열람 가능
  if (access.scope === 'own') {
    const allowed = await isRevenueOwnAllowedForDepartment(access.appUser.department_id)
    if (!allowed) return NextResponse.json(emptyBody)
  }

  const sp = request.nextUrl.searchParams
  const year = parseInt(sp.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(sp.get('month') ?? String(new Date().getMonth() + 1))

  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const startDate = `${year}-${pad(month)}-01T00:00:00+09:00`
  const endDate = `${year}-${pad(month)}-${pad(lastDay)}T23:59:59+09:00`

  const TEST_USER_ID = '94832325-c5ec-4b21-bc74-00ae0763cbda'

  const { data, error } = await allcareAdmin
    .from('payments')
    .select('id, order_id, amount, good_name, payment_method, approved_at, users(name, email)')
    .eq('status', 'completed')
    .gte('approved_at', startDate)
    .lte('approved_at', endDate)
    .neq('user_id', TEST_USER_ID)
    .order('approved_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []

  const getType = (orderId: string) => {
    if (orderId.startsWith('SUBS-')) return '구독'
    if (orderId.startsWith('PKG-')) return '패키지'
    if (orderId.startsWith('CUSTOM-')) return '단과반'
    return '기타'
  }

  const totalRevenue = rows.reduce((s, p) => s + (p.amount ?? 0), 0)
  const count = rows.length

  const byType: Record<string, { count: number; revenue: number }> = {}
  for (const p of rows) {
    const t = getType(p.order_id)
    if (!byType[t]) byType[t] = { count: 0, revenue: 0 }
    byType[t].count++
    byType[t].revenue += p.amount ?? 0
  }

  const payments = rows.map(p => ({
    id: p.id,
    type: getType(p.order_id),
    order_id: p.order_id,
    good_name: p.good_name,
    amount: p.amount,
    payment_method: p.payment_method,
    approved_at: p.approved_at,
    user_name: (p.users as unknown as { name: string; email: string } | null)?.name ?? null,
    user_email: (p.users as unknown as { name: string; email: string } | null)?.email ?? null,
  }))

  return NextResponse.json({ year, month, totalRevenue, count, byType, payments })
}
