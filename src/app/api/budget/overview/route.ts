import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveBudgetAccess, canEditLimit } from '@/lib/budget/access'
import { monthRange } from '@/lib/budget/transactions'
import { resolveScope } from '@/lib/budget/scopes'
import { logBudget } from '@/lib/budget/log'

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// GET: 사용예산 요약 (한도 / 사용액 / 가용액)
//  · scope 있으면 → 해당 사업부 통장(계좌) 기준 단일 카드
//  · 없으면(경영지원본부 전체 보기) → 본부별 + 팀별 분해
export async function GET(request: NextRequest) {
  const access = await resolveBudgetAccess()
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') || currentYearMonth()

  // 예산현황 조회(체크) 기록
  const scopeParam = searchParams.get('scope')
  await logBudget(
    access.appUserId,
    'view',
    `예산현황 조회 · ${scopeParam ?? '전체'} · ${month}`,
  )

  const { start, end } = monthRange(month)
  const startDate = `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}`
  const endDate = `${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6, 8)}`

  const monthBudget = async (deptIds: string[]) => {
    const { data } = await supabaseAdmin
      .from('department_budgets')
      .select('department_id, limit_amount, memo')
      .eq('year_month', month)
      .in('department_id', deptIds)
    const map = new Map<string, { limit: number; memo: string | null }>()
    ;(data ?? []).forEach((b) =>
      map.set(b.department_id, { limit: Number(b.limit_amount) || 0, memo: b.memo }),
    )
    return map
  }

  // ── 사업부 스코프 (통장 기준) ──
  const scope = await resolveScope(searchParams.get('scope'))
  if (scope) {
    // 접근: 해당 부서 예산 권한(budget-*) 보유 또는 전체권한
    if (!access.seeAll && !access.accessibleScopeKeys.has(scope.key)) {
      return NextResponse.json(
        { month, seeAll: access.seeAll, scope, departments: [] },
        { status: 403 },
      )
    }
    const deptId = scope.departmentId
    const deptCode =
      access.departments.find((d) => d.id === deptId)?.code ?? null

    const { data: txs } = await supabaseAdmin
      .from('bank_transactions')
      .select('amount, tx_type')
      .eq('is_budget', true)
      .gte('tx_date', startDate)
      .lte('tx_date', endDate)
      .in('account_number', scope.accountNumbers)

    let out = 0
    let inAmt = 0
    ;(txs ?? []).forEach((t) => {
      const amt = Number(t.amount) || 0
      if (t.tx_type === 'in') inAmt += amt
      else out += amt
    })

    const limitMap = await monthBudget([deptId])
    const limit = limitMap.get(deptId)?.limit ?? 0

    return NextResponse.json({
      month,
      seeAll: access.seeAll,
      scope,
      departments: [
        {
          department_id: deptId,
          department_code: deptCode,
          department_name: scope.label,
          limit_amount: limit,
          out_amount: out,
          in_amount: inAmt,
          available_amount: limit - out + inAmt,
          can_edit_limit: canEditLimit(access, deptId),
          memo: limitMap.get(deptId)?.memo ?? null,
          teams: [],
        },
      ],
    })
  }

  // ── 전체 보기 (경영지원본부): 본부별 + 팀별 분해 ──
  const deptIds = access.departments.map((d) => d.id)
  if (deptIds.length === 0) {
    return NextResponse.json({ month, seeAll: access.seeAll, scope: null, departments: [] })
  }

  const limitByDept = await monthBudget(deptIds)

  const { data: teamRows } = await supabaseAdmin
    .from('teams')
    .select('id, name, department_id')
    .eq('is_active', true)
    .in('department_id', deptIds)
    .order('sort_order')

  const { data: txs } = await supabaseAdmin
    .from('bank_transactions')
    .select('department_id, team_id, amount, tx_type')
    .eq('is_budget', true)
    .gte('tx_date', startDate)
    .lte('tx_date', endDate)
    .in('department_id', deptIds)

  const outByDept = new Map<string, number>()
  const inByDept = new Map<string, number>()
  const outByTeam = new Map<string, number>()
  const inByTeam = new Map<string, number>()
  ;(txs ?? []).forEach((t) => {
    if (!t.department_id) return
    const amt = Number(t.amount) || 0
    if (t.tx_type === 'in') {
      inByDept.set(t.department_id, (inByDept.get(t.department_id) ?? 0) + amt)
      if (t.team_id) {
        const k = `${t.department_id}|${t.team_id}`
        inByTeam.set(k, (inByTeam.get(k) ?? 0) + amt)
      }
    } else {
      outByDept.set(t.department_id, (outByDept.get(t.department_id) ?? 0) + amt)
      if (t.team_id) {
        const k = `${t.department_id}|${t.team_id}`
        outByTeam.set(k, (outByTeam.get(k) ?? 0) + amt)
      }
    }
  })

  const departments = access.departments.map((d) => {
    const limit = limitByDept.get(d.id)?.limit ?? 0

    let teams = (teamRows ?? []).filter((tm) => tm.department_id === d.id)
    if (access.teamRestricted) teams = teams.filter((tm) => tm.id === access.ownTeamId)

    const teamBreakdown = teams.map((tm) => {
      const k = `${d.id}|${tm.id}`
      return {
        team_id: tm.id,
        team_name: tm.name,
        out_amount: outByTeam.get(k) ?? 0,
        in_amount: inByTeam.get(k) ?? 0,
      }
    })

    const out = outByDept.get(d.id) ?? 0
    const inAmt = inByDept.get(d.id) ?? 0

    return {
      department_id: d.id,
      department_code: d.code,
      department_name: d.name,
      limit_amount: limit,
      out_amount: out,
      in_amount: inAmt,
      available_amount: limit - out + inAmt,
      can_edit_limit: canEditLimit(access, d.id),
      memo: limitByDept.get(d.id)?.memo ?? null,
      teams: teamBreakdown,
    }
  })

  return NextResponse.json({
    month,
    seeAll: access.seeAll,
    teamRestricted: access.teamRestricted,
    ownTeamId: access.ownTeamId,
    scope: null,
    departments,
  })
}
