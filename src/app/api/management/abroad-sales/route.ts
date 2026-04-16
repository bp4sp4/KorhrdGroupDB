import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireManagementAccess, isRevenueOwnAllowedForDepartment } from '@/lib/auth/managementAccess'

// 유학 사업부 - 결제완료(completed) 월 매출 조회
// GET /api/management/abroad-sales?year=2026&month=4
export async function GET(request: NextRequest) {
  const emptyBody = { year: 0, month: 0, total: { paymentAmount: 0, count: 0, avgAmount: 0 }, byDay: [], rows: [] }
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

  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('id, user_id, amount, program, status, created_at')
    .eq('status', 'completed')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = data ?? []

  // 프로필 정보 조회 (이름, 이메일)
  const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))] as string[]
  const profileMap = new Map<string, { full_name: string | null; email: string | null }>()

  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { full_name: p.full_name, email: p.email })
    }
  }

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

  // 개별 결제 행
  const paymentRows = rows.map(r => {
    const profile = r.user_id ? profileMap.get(r.user_id) : null
    return {
      id: r.id,
      name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      program: r.program,
      amount: r.amount,
      created_at: r.created_at,
    }
  })

  return NextResponse.json({
    year,
    month,
    total: { paymentAmount: totalAmount, count, avgAmount },
    byDay,
    rows: paymentRows,
  })
}
