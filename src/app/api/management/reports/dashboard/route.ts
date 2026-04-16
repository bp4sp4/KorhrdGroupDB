import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { nmsAdmin } from '@/lib/supabase/nms'
import { allcareAdmin } from '@/lib/supabase/allcare'
import { requireManagementAccess } from '@/lib/auth/managementAccess'
import { getMonthRange } from '@/lib/management/utils'

export async function GET(request: NextRequest) {
  const access = await requireManagementAccess('reports')
  if (!access.ok) return access.response

  const sp = request.nextUrl.searchParams
  const year = parseInt(sp.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(sp.get('month') ?? String(new Date().getMonth() + 1))

  const { start, end } = getMonthRange(year, month)
  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const kstStart = `${year}-${pad(month)}-01T00:00:00+09:00`
  const kstEnd = `${year}-${pad(month)}-${pad(lastDay)}T23:59:59+09:00`

  // 전월
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const { start: prevStart, end: prevEnd } = getMonthRange(prevYear, prevMonth)
  const prevLastDay = new Date(prevYear, prevMonth, 0).getDate()
  const prevKstStart = `${prevYear}-${pad(prevMonth)}-01T00:00:00+09:00`
  const prevKstEnd = `${prevYear}-${pad(prevMonth)}-${pad(prevLastDay)}T23:59:59+09:00`

  const TEST_USER_ID = '94832325-c5ec-4b21-bc74-00ae0763cbda'

  // ── 병렬 쿼리 (당월) ──
  const [nmsRes, certRes, abroadRes, allcareRes, revenuesRes, expensesRes] =
    await Promise.allSettled([
      // NMS
      nmsAdmin.from('customers')
        .select('payment_amount, created_at')
        .eq('status', '등록완료')
        .gte('created_at', kstStart).lte('created_at', kstEnd),
      // 민간자격증
      supabaseAdmin.from('certificate_applications')
        .select('amount, created_at')
        .eq('payment_status', 'paid').eq('source', 'bridge')
        .gte('created_at', kstStart).lte('created_at', kstEnd)
        .is('deleted_at', null),
      // 유학
      supabaseAdmin.from('payments')
        .select('amount, created_at')
        .eq('status', 'completed')
        .gte('created_at', kstStart).lte('created_at', kstEnd),
      // 올케어
      allcareAdmin.from('payments')
        .select('amount, approved_at')
        .eq('status', 'completed')
        .gte('approved_at', kstStart).lte('approved_at', kstEnd)
        .neq('user_id', TEST_USER_ID),
      // 업로드 매출 (카드/계좌)
      supabaseAdmin.from('revenues')
        .select('amount, revenue_type, department:departments(name)')
        .gte('revenue_date', start).lte('revenue_date', end)
        .eq('is_deleted', false),
      // 지출
      supabaseAdmin.from('expenses')
        .select('amount, approval_id, vendor, category:expense_categories(name), department:departments(name)')
        .gte('expense_date', start).lte('expense_date', end)
        .eq('is_deleted', false),
    ])

  // ── 집계 ──
  const sumData = <T>(res: PromiseSettledResult<{ data: T[] | null }>, fn: (d: T[]) => number) =>
    res.status === 'fulfilled' && res.value.data ? fn(res.value.data) : 0

  const nms_sales = sumData(nmsRes, d => d.reduce((s, r: { payment_amount: number }) => s + (r.payment_amount || 0), 0))
  const cert_sales = sumData(certRes, d => d.reduce((s, r: { amount: number }) => s + (r.amount || 0), 0))
  const abroad_sales = sumData(abroadRes, d => d.reduce((s, r: { amount: number }) => s + (r.amount || 0), 0))
  const allcare_sales = sumData(allcareRes, d => d.reduce((s, r: { amount: number }) => s + (r.amount || 0), 0))

  // 업로드 매출 (유형별)
  const revRows = revenuesRes.status === 'fulfilled' ? (revenuesRes.value.data ?? []) : []
  const uploaded_revenue = { card: 0, bank_transfer: 0, other: 0 }
  for (const r of revRows) {
    const amt = (r as { amount: number }).amount ?? 0
    const type = (r as { revenue_type: string }).revenue_type
    if (type === 'CARD') uploaded_revenue.card += amt
    else if (type === 'BANK_TRANSFER') uploaded_revenue.bank_transfer += amt
    else uploaded_revenue.other += amt
  }

  // 지출
  const expRows = expensesRes.status === 'fulfilled' ? (expensesRes.value.data ?? []) : []
  const manual_expenses = expRows.reduce((sum, row) => {
    const expense = row as { amount: number; approval_id?: string | null }
    return expense.approval_id ? sum : sum + (expense.amount || 0)
  }, 0)
  const approved_expenses = expRows.reduce((sum, row) => {
    const expense = row as { amount: number; approval_id?: string | null }
    return expense.approval_id ? sum + (expense.amount || 0) : sum
  }, 0)

  const total_revenue = nms_sales + cert_sales + abroad_sales + allcare_sales +
    uploaded_revenue.bank_transfer + uploaded_revenue.other
  const total_expense = manual_expenses + approved_expenses + uploaded_revenue.card
  const profit = total_revenue - total_expense
  const profit_rate = total_revenue > 0 ? Math.round((profit / total_revenue) * 1000) / 10 : 0

  // 매출 출처별 (카드매출은 지출이므로 제외)
  const revenue_by_source = [
    { source: '학점은행제', amount: nms_sales },
    { source: '민간자격증', amount: cert_sales },
    { source: '유학', amount: abroad_sales },
    { source: '올케어', amount: allcare_sales },
    { source: '계좌 입금', amount: uploaded_revenue.bank_transfer },
  ].filter(s => s.amount > 0)

  // 지출 분류별
  const expByCategory: Record<string, number> = {}
  for (const e of expRows) {
    const catVal = (e as unknown as { category?: { name: string } | null }).category
    const cat = catVal && typeof catVal === 'object' && 'name' in catVal ? catVal.name : '기타'
    expByCategory[cat] = (expByCategory[cat] ?? 0) + ((e as { amount: number }).amount || 0)
  }
  if (uploaded_revenue.card > 0) {
    expByCategory['카드 지출'] = (expByCategory['카드 지출'] ?? 0) + uploaded_revenue.card
  }
  const expense_by_category = Object.entries(expByCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)

  // 사업부별 매출/지출 (revenues/expenses 테이블 기준)
  const revByDept: Record<string, number> = {}
  for (const r of revRows) {
    const deptVal = (r as unknown as { department?: { name: string } | null }).department
    const dept = deptVal && typeof deptVal === 'object' && 'name' in deptVal ? deptVal.name : '미배정'
    revByDept[dept] = (revByDept[dept] ?? 0) + ((r as { amount: number }).amount || 0)
  }
  const revenue_by_dept = Object.entries(revByDept).map(([dept, amount]) => ({ dept, amount }))

  const expByDept: Record<string, number> = {}
  for (const e of expRows) {
    const deptVal = (e as unknown as { department?: { name: string } | null }).department
    const dept = deptVal && typeof deptVal === 'object' && 'name' in deptVal ? deptVal.name : '미배정'
    expByDept[dept] = (expByDept[dept] ?? 0) + ((e as { amount: number }).amount || 0)
  }
  const expense_by_dept = Object.entries(expByDept).map(([dept, amount]) => ({ dept, amount }))

  // ── 전월 데이터 (간단 집계) ──
  const [prevNms, prevCert, prevAbroad, prevAllcare, prevRev, prevExp] = await Promise.allSettled([
    nmsAdmin.from('customers').select('payment_amount')
      .eq('status', '등록완료').gte('created_at', prevKstStart).lte('created_at', prevKstEnd),
    supabaseAdmin.from('certificate_applications').select('amount')
      .eq('payment_status', 'paid').eq('source', 'bridge')
      .gte('created_at', prevKstStart).lte('created_at', prevKstEnd).is('deleted_at', null),
    supabaseAdmin.from('payments').select('amount')
      .eq('status', 'completed').gte('created_at', prevKstStart).lte('created_at', prevKstEnd),
    allcareAdmin.from('payments').select('amount')
      .eq('status', 'completed').gte('approved_at', prevKstStart).lte('approved_at', prevKstEnd)
      .neq('user_id', TEST_USER_ID),
    supabaseAdmin.from('revenues').select('amount')
      .gte('revenue_date', prevStart).lte('revenue_date', prevEnd).eq('is_deleted', false),
    supabaseAdmin.from('expenses').select('amount')
      .gte('expense_date', prevStart).lte('expense_date', prevEnd).eq('is_deleted', false),
  ])

  const prevRevTotal =
    sumData(prevNms, d => d.reduce((s, r: { payment_amount: number }) => s + (r.payment_amount || 0), 0)) +
    sumData(prevCert, d => d.reduce((s, r: { amount: number }) => s + (r.amount || 0), 0)) +
    sumData(prevAbroad, d => d.reduce((s, r: { amount: number }) => s + (r.amount || 0), 0)) +
    sumData(prevAllcare, d => d.reduce((s, r: { amount: number }) => s + (r.amount || 0), 0)) +
    sumData(prevRev, d => d.reduce((s, r: { amount: number }) => s + (r.amount || 0), 0))
  const prevExpTotal = sumData(prevExp, d => d.reduce((s, r: { amount: number }) => s + (r.amount || 0), 0))

  // ── 6개월 추이 ──
  const now = new Date()
  const trendRanges: { year: number; month: number; label: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    trendRanges.push({ year: d.getFullYear(), month: d.getMonth() + 1, label: `${d.getMonth() + 1}월` })
  }

  const trendStart = `${trendRanges[0].year}-${pad(trendRanges[0].month)}-01T00:00:00+09:00`
  const trendLastRange = trendRanges[trendRanges.length - 1]
  const trendLastDay = new Date(trendLastRange.year, trendLastRange.month, 0).getDate()
  const trendEnd = `${trendLastRange.year}-${pad(trendLastRange.month)}-${pad(trendLastDay)}T23:59:59+09:00`
  const trendStartDate = `${trendRanges[0].year}-${pad(trendRanges[0].month)}-01`
  const trendEndDate = `${trendLastRange.year}-${pad(trendLastRange.month)}-${pad(trendLastDay)}`

  const monthKey = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${d.getMonth() + 1}`
  }

  const [tNms, tCert, tAbroad, tAllcare, tRev, tExp] = await Promise.allSettled([
    nmsAdmin.from('customers').select('payment_amount, created_at')
      .eq('status', '등록완료').gte('created_at', trendStart).lte('created_at', trendEnd),
    supabaseAdmin.from('certificate_applications').select('amount, created_at')
      .eq('payment_status', 'paid').eq('source', 'bridge')
      .gte('created_at', trendStart).lte('created_at', trendEnd).is('deleted_at', null),
    supabaseAdmin.from('payments').select('amount, created_at')
      .eq('status', 'completed').gte('created_at', trendStart).lte('created_at', trendEnd),
    allcareAdmin.from('payments').select('amount, approved_at')
      .eq('status', 'completed').gte('approved_at', trendStart).lte('approved_at', trendEnd)
      .neq('user_id', TEST_USER_ID),
    supabaseAdmin.from('revenues').select('amount, revenue_date')
      .gte('revenue_date', trendStartDate).lte('revenue_date', trendEndDate).eq('is_deleted', false),
    supabaseAdmin.from('expenses').select('amount, expense_date')
      .gte('expense_date', trendStartDate).lte('expense_date', trendEndDate).eq('is_deleted', false),
  ])

  const trendMonthly: Record<string, { label: string; revenue: number; expense: number }> = {}
  for (const r of trendRanges) {
    trendMonthly[`${r.year}-${r.month}`] = { label: r.label, revenue: 0, expense: 0 }
  }

  const addTrend = <T>(res: PromiseSettledResult<{ data: T[] | null }>, dateKey: string, amountKey: string, target: 'revenue' | 'expense') => {
    if (res.status !== 'fulfilled' || !res.value.data) return
    for (const row of res.value.data) {
      const k = monthKey((row as Record<string, string>)[dateKey])
      if (trendMonthly[k]) trendMonthly[k][target] += Number((row as Record<string, number>)[amountKey]) || 0
    }
  }

  addTrend(tNms, 'created_at', 'payment_amount', 'revenue')
  addTrend(tCert, 'created_at', 'amount', 'revenue')
  addTrend(tAbroad, 'created_at', 'amount', 'revenue')
  addTrend(tAllcare, 'approved_at', 'amount', 'revenue')
  addTrend(tRev, 'revenue_date', 'amount', 'revenue')
  addTrend(tExp, 'expense_date', 'amount', 'expense')

  const trend = Object.values(trendMonthly).map(t => ({
    label: t.label,
    revenue: t.revenue,
    expense: t.expense,
    profit: t.revenue - t.expense,
  }))

  return NextResponse.json({
    month: `${year}-${pad(month)}`,
    nms_sales,
    cert_sales,
    abroad_sales,
    allcare_sales,
    uploaded_revenue,
    manual_expenses,
    approved_expenses,
    total_revenue,
    total_expense,
    profit,
    profit_rate,
    prev_month: { revenue: prevRevTotal, expense: prevExpTotal, profit: prevRevTotal - prevExpTotal },
    revenue_by_source,
    expense_by_category,
    revenue_by_dept,
    expense_by_dept,
    trend,
  })
}
