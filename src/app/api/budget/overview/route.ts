import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveBudgetAccess, canEditLimit } from '@/lib/budget/access'
import { monthRange } from '@/lib/budget/transactions'
import { resolveScope } from '@/lib/budget/scopes'

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// GET: 사업부(본부+선택 팀) 예산 요약 (한도 / 사용액 / 가용액)
export async function GET(request: NextRequest) {
  const access = await resolveBudgetAccess()
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') || currentYearMonth()

  // 사업부 스코프 (사이드바 사용예산 진입) — 본부 + 선택적 팀
  const scope = await resolveScope(searchParams.get('scope'))
  if (scope) {
    const accessible = access.departments.some((d) => d.id === scope.departmentId)
    const teamOk = !access.teamRestricted || !scope.teamId || scope.teamId === access.ownTeamId
    if (!accessible || !teamOk) {
      return NextResponse.json(
        { month, seeAll: access.seeAll, scope, departments: [] },
        { status: 403 },
      )
    }
  }
  const scopeTeamId = scope?.teamId ?? null

  const deptIds = scope ? [scope.departmentId] : access.departments.map((d) => d.id)

  if (deptIds.length === 0) {
    return NextResponse.json({ month, seeAll: access.seeAll, scope, departments: [] })
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

  // 팀 목록 (본부별 분해용)
  const { data: teamRows } = await supabaseAdmin
    .from('teams')
    .select('id, name, department_id')
    .eq('is_active', true)
    .in('department_id', deptIds)
    .order('sort_order')

  // 예산 반영된 거래 — 출금(−), 입금(+), 팀까지 집계
  const { data: txs } = await supabaseAdmin
    .from('bank_transactions')
    .select('department_id, team_id, amount, tx_type')
    .eq('is_budget', true)
    .gte('tx_date', startDate)
    .lte('tx_date', endDate)
    .in('department_id', deptIds)

  const outByDept = new Map<string, number>()
  const inByDept = new Map<string, number>()
  // 팀별 집계 — key: `${dept}|${team}`
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

  const scopedDepts = scope
    ? access.departments.filter((d) => d.id === scope.departmentId)
    : access.departments

  const departments = scopedDepts.map((d) => {
    const limit = limitByDept.get(d.id)?.limit ?? 0

    // 소속 팀 분해 — 스코프 팀이 있으면 그 팀만, 일반 직원은 본인 팀만
    let teams = (teamRows ?? []).filter((tm) => tm.department_id === d.id)
    if (scopeTeamId) teams = teams.filter((tm) => tm.id === scopeTeamId)
    else if (access.teamRestricted) teams = teams.filter((tm) => tm.id === access.ownTeamId)

    const teamBreakdown = teams.map((tm) => {
      const k = `${d.id}|${tm.id}`
      return {
        team_id: tm.id,
        team_name: tm.name,
        out_amount: outByTeam.get(k) ?? 0,
        in_amount: inByTeam.get(k) ?? 0,
      }
    })

    // 팀 스코프면 그 팀 사용액 기준, 아니면 본부 전체
    const out = scopeTeamId
      ? outByTeam.get(`${d.id}|${scopeTeamId}`) ?? 0
      : outByDept.get(d.id) ?? 0
    const inAmt = scopeTeamId
      ? inByTeam.get(`${d.id}|${scopeTeamId}`) ?? 0
      : inByDept.get(d.id) ?? 0

    return {
      department_id: d.id,
      department_code: d.code,
      department_name: d.name,
      limit_amount: limit,
      out_amount: out,
      in_amount: inAmt,
      // 가용 예산 = 한도 − 출금 + 입금
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
    scope,
    departments,
  })
}
