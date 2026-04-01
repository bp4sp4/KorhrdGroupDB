import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { getMonthRange } from '@/lib/management/utils'

export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const sp = request.nextUrl.searchParams
  const year = parseInt(sp.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(sp.get('month') ?? String(new Date().getMonth() + 1))
  const deptId = sp.get('department_id')

  const { start, end } = getMonthRange(year, month)

  // 전월 범위
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const { start: prevStart, end: prevEnd } = getMonthRange(prevYear, prevMonth)

  // 매출 조회
  let revQuery = supabaseAdmin
    .from('revenues')
    .select('amount, revenue_type, department:departments(name)')
    .gte('revenue_date', start)
    .lte('revenue_date', end)
    .eq('is_deleted', false)

  if (deptId) revQuery = revQuery.eq('department_id', deptId)

  const { data: revenues } = await revQuery

  // 지출 조회
  let expQuery = supabaseAdmin
    .from('expenses')
    .select('amount, category:expense_categories(name), department:departments(name)')
    .gte('expense_date', start)
    .lte('expense_date', end)
    .eq('is_deleted', false)

  if (deptId) expQuery = expQuery.eq('department_id', deptId)

  const { data: expenses } = await expQuery

  // 전월 매출
  const { data: prevRevenues } = await supabaseAdmin
    .from('revenues')
    .select('amount')
    .gte('revenue_date', prevStart)
    .lte('revenue_date', prevEnd)
    .eq('is_deleted', false)

  // 집계
  const total_revenue = (revenues ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
  const total_expense = (expenses ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
  const profit = total_revenue - total_expense
  const profit_rate = total_revenue > 0 ? Math.round((profit / total_revenue) * 1000) / 10 : 0
  const prev_month_revenue = (prevRevenues ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)

  // 매출 구분별
  const revenueByType: Record<string, number> = {}
  ;(revenues ?? []).forEach((r) => {
    const t = r.revenue_type ?? 'OTHER'
    revenueByType[t] = (revenueByType[t] ?? 0) + r.amount
  })
  const revenue_by_type = Object.entries(revenueByType).map(([type, amount]) => ({ type, amount }))

  // 지출 분류별
  const expByCategory: Record<string, number> = {}
  ;(expenses ?? []).forEach((e) => {
    const catVal = e.category
    const cat = catVal && !Array.isArray(catVal) && typeof catVal === 'object' && 'name' in catVal
      ? (catVal as { name: string }).name
      : '기타'
    expByCategory[cat] = (expByCategory[cat] ?? 0) + e.amount
  })
  const expense_by_category = Object.entries(expByCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  // 사업부별 매출
  const revByDept: Record<string, number> = {}
  ;(revenues ?? []).forEach((r) => {
    const deptVal = r.department
    const dept = deptVal && !Array.isArray(deptVal) && typeof deptVal === 'object' && 'name' in deptVal
      ? (deptVal as { name: string }).name
      : '미배정'
    revByDept[dept] = (revByDept[dept] ?? 0) + r.amount
  })
  const revenue_by_dept = Object.entries(revByDept).map(([dept, amount]) => ({ dept, amount }))

  // 사업부별 지출
  const expByDept: Record<string, number> = {}
  ;(expenses ?? []).forEach((e) => {
    const deptVal = e.department
    const dept = deptVal && !Array.isArray(deptVal) && typeof deptVal === 'object' && 'name' in deptVal
      ? (deptVal as { name: string }).name
      : '미배정'
    expByDept[dept] = (expByDept[dept] ?? 0) + e.amount
  })
  const expense_by_dept = Object.entries(expByDept).map(([dept, amount]) => ({ dept, amount }))

  return NextResponse.json({
    month: `${year}-${String(month).padStart(2, '0')}`,
    total_revenue,
    total_expense,
    profit,
    profit_rate,
    prev_month_revenue,
    revenue_by_type,
    expense_by_category,
    revenue_by_dept,
    expense_by_dept,
  })
}
