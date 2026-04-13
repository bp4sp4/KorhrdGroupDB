import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'

// 유학 사업부 - 결제완료(completed) 월 매출 조회
// GET /api/management/abroad-sales?year=2026&month=4
export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const sp = request.nextUrl.searchParams
  const year = parseInt(sp.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(sp.get('month') ?? String(new Date().getMonth() + 1))

  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const startDate = `${year}-${pad(month)}-01T00:00:00+09:00`
  const endDate = `${year}-${pad(month)}-${pad(lastDay)}T23:59:59+09:00`

  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('amount, program, created_at')
    .eq('status', 'completed')
    .gte('created_at', startDate)
    .lte('created_at', endDate)

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

  return NextResponse.json({ year, month, total: { paymentAmount: totalAmount, count, avgAmount }, byDay })
}
