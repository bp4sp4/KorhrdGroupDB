import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveBudgetAccess } from '@/lib/budget/access'
import { fetchUnifiedTransactions } from '@/lib/budget/transactions'
import { resolveScope } from '@/lib/budget/scopes'

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? '0.0.0.0'
}

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface SavedTx {
  tx_key: string
  department_id: string | null
  team_id: string | null
  content: string | null
  expense_category_id: string | null
  is_budget: boolean
}

// GET: 입금/출금현황 (신한 실시간 + 저장된 분류 머지)
export async function GET(request: NextRequest) {
  const access = await resolveBudgetAccess()
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') || currentYearMonth()
  const deptFilter = searchParams.get('department_id')

  // 사업부 스코프 (통장 기준) — 같은 본부 소속이면 팀과 무관하게 열람
  const scope = await resolveScope(searchParams.get('scope'))
  if (scope) {
    const accessible = access.departments.some((d) => d.id === scope.departmentId)
    if (!accessible) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }
  }

  const accessibleDeptIds = new Set(access.departments.map((d) => d.id))
  const targetDeptIds =
    deptFilter && accessibleDeptIds.has(deptFilter)
      ? [deptFilter]
      : access.departments.map((d) => d.id)

  // 참조 데이터 (드롭다운용)
  const [{ data: teams }, { data: categories }] = await Promise.all([
    supabaseAdmin.from('teams').select('id, name, department_id').eq('is_active', true).order('sort_order'),
    supabaseAdmin.from('expense_categories').select('id, name').order('sort_order'),
  ])

  // 계좌 목록 — 스코프면 그 사업부 통장, 아니면 대상 본부 전체 통장
  const acctToDepts = new Map<string, string[]>()
  if (scope) {
    scope.accountNumbers.forEach((acc) => acctToDepts.set(acc, [scope.departmentId]))
  } else {
    const { data: accounts } = await supabaseAdmin
      .from('bank_accounts')
      .select('account_number, department_id')
      .eq('is_active', true)
      .in('department_id', targetDeptIds)
    ;(accounts ?? []).forEach((a) => {
      const list = acctToDepts.get(a.account_number) ?? []
      if (a.department_id) list.push(a.department_id)
      acctToDepts.set(a.account_number, list)
    })
  }
  const accountNumbers = Array.from(acctToDepts.keys())

  if (accountNumbers.length === 0) {
    return NextResponse.json({
      month,
      seeAll: access.seeAll,
      departments: access.departments,
      teams: teams ?? [],
      categories: categories ?? [],
      transactions: [],
    })
  }

  // 신한 실시간 조회
  let unified
  try {
    unified = await fetchUnifiedTransactions({
      accountNumbers,
      yearMonth: month,
      clientIp: getClientIp(request),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '거래내역 조회 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // 저장된 분류 머지
  const txKeys = unified.map((t) => t.tx_key)
  const savedByKey = new Map<string, SavedTx>()
  for (let i = 0; i < txKeys.length; i += 500) {
    const chunk = txKeys.slice(i, i + 500)
    const { data: saved } = await supabaseAdmin
      .from('bank_transactions')
      .select('tx_key, department_id, team_id, content, expense_category_id, is_budget')
      .in('tx_key', chunk)
    ;(saved ?? []).forEach((s) => savedByKey.set(s.tx_key, s as SavedTx))
  }

  let transactions = unified.map((t) => {
    const saved = savedByKey.get(t.tx_key)
    // 기본 본부 결정 — 체크 시 항상 어느 본부에서든 깎이도록 가능한 한 채움
    const depts = acctToDepts.get(t.account_number) ?? []
    const defaultDept = scope
      ? scope.departmentId
      : depts.length === 1
        ? depts[0]
        : access.ownDepartmentId && depts.includes(access.ownDepartmentId)
          ? access.ownDepartmentId
          : null
    return {
      ...t,
      department_id: saved?.department_id ?? defaultDept,
      team_id: saved?.team_id ?? null,
      content: saved?.content ?? '',
      expense_category_id: saved?.expense_category_id ?? null,
      is_budget: saved?.is_budget ?? false,
    }
  })

  // 스코프(통장 기준) 페이지는 그 통장 거래 전체 노출 — 팀 필터 없음.
  // 전체 보기(경영지원본부)에서만 팀 제한 직원은 본인 팀 + 미분류로 제한.
  if (!scope && access.teamRestricted) {
    transactions = transactions.filter(
      (t) => t.team_id === access.ownTeamId || !t.team_id,
    )
  }

  return NextResponse.json({
    month,
    seeAll: access.seeAll,
    teamRestricted: access.teamRestricted,
    ownTeamId: access.ownTeamId,
    scope,
    departments: access.departments,
    teams: teams ?? [],
    categories: categories ?? [],
    transactions,
  })
}

// PATCH: 거래 분류 저장 (본부/부서/내용/계정과목/예산반영)
export async function PATCH(request: NextRequest) {
  const access = await resolveBudgetAccess()
  if (!access.ok) return access.response

  const body = await request.json()
  const {
    tx_key,
    account_number,
    tx_date,
    tx_type,
    amount,
    summary,
    department_id,
    team_id,
    content,
    expense_category_id,
    is_budget,
  } = body as {
    tx_key?: string
    account_number?: string
    tx_date?: string
    tx_type?: string
    amount?: number
    summary?: string
    department_id?: string | null
    team_id?: string | null
    content?: string | null
    expense_category_id?: string | null
    is_budget?: boolean
  }

  if (!tx_key || !account_number || !tx_date || (tx_type !== 'in' && tx_type !== 'out')) {
    return NextResponse.json({ error: '필수 거래 정보가 누락되었습니다.' }, { status: 400 })
  }

  const accessibleDeptIds = new Set(access.departments.map((d) => d.id))
  // 본부 미접근자가 다른 본부로 지정하는 것 차단
  if (department_id && !accessibleDeptIds.has(department_id)) {
    return NextResponse.json({ error: '해당 본부에 대한 권한이 없습니다.' }, { status: 403 })
  }
  // 일반 직원은 본인 팀으로만 분류 가능
  if (access.teamRestricted && team_id && team_id !== access.ownTeamId) {
    return NextResponse.json({ error: '본인 팀으로만 분류할 수 있습니다.' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('bank_transactions')
    .upsert(
      {
        tx_key,
        account_number: account_number.replace(/[^\d]/g, ''),
        tx_date,
        tx_type,
        amount: Math.round(Number(amount) || 0),
        summary: summary?.toString() ?? null,
        department_id: department_id || null,
        team_id: team_id || null,
        content: content?.toString().trim() || null,
        expense_category_id: expense_category_id || null,
        is_budget: !!is_budget,
        created_by: access.appUserId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tx_key' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
