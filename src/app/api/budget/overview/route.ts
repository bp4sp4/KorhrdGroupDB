import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveBudgetAccess } from '@/lib/budget/access'
import { monthRange } from '@/lib/budget/transactions'

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// GET: 본부별 예산 요약 (한도 / 사용액 / 가용액)
export async function GET(request: NextRequest) {
  const access = await resolveBudgetAccess()
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') || currentYearMonth()
  const deptIds = access.departments.map((d) => d.id)

  if (deptIds.length === 0) {
    return NextResponse.json({ month, seeAll: access.seeAll, departments: [] })
  }

  // 예산 한도
  const { data: budgets } = await supabaseAdmin
    .from('department_budgets')
    .select('department_id, limit_amount, memo')
    .eq('year_month', month)
    .in('department_id', deptIds)

  const limitByDept = new Map<string, { limit: number; memo: string | null }>()
  ;(budgets ?? []).forEach((b) =>
    limitByDept.set(b.department_id, { limit: Number(b.limit_amount) || 0, memo: b.memo }),
  )

  // 사용액 = 해당 월 출금 중 예산반영(is_budget) 합계
  const { start, end } = monthRange(month)
  const startDate = `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}`
  const endDate = `${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6, 8)}`

  const { data: txs } = await supabaseAdmin
    .from('bank_transactions')
    .select('department_id, amount')
    .eq('tx_type', 'out')
    .eq('is_budget', true)
    .gte('tx_date', startDate)
    .lte('tx_date', endDate)
    .in('department_id', deptIds)

  const usedByDept = new Map<string, number>()
  ;(txs ?? []).forEach((t) => {
    if (!t.department_id) return
    usedByDept.set(t.department_id, (usedByDept.get(t.department_id) ?? 0) + (Number(t.amount) || 0))
  })

  const departments = access.departments.map((d) => {
    const limit = limitByDept.get(d.id)?.limit ?? 0
    const used = usedByDept.get(d.id) ?? 0
    return {
      department_id: d.id,
      department_code: d.code,
      department_name: d.name,
      limit_amount: limit,
      used_amount: used,
      available_amount: limit - used,
      memo: limitByDept.get(d.id)?.memo ?? null,
    }
  })

  return NextResponse.json({ month, seeAll: access.seeAll, departments })
}
