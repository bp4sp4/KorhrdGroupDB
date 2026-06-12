import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getQuarterCompanySales } from '@/lib/dashboard/quarterSales'

export const runtime = 'nodejs'

// 메인 대시보드 KPI 분기 목표 (원 단위)
//   저장: app_settings key = dashboard.kpi_goal.{YYYY}-Q{n}, value = { target: number }
//   분기가 바뀌면 새 키를 사용하므로 자동으로 분기별 목표가 분리된다.
//   설정 권한: 사업본부장(departments.head_user_id) / master-admin

const keyOf = (year: number, quarter: number) =>
  `dashboard.kpi_goal.${year}-Q${quarter}`

const currentQuarter = (d = new Date()) => Math.floor(d.getMonth() / 3) + 1

async function canSetKpiGoal(appUser: {
  id: number
  role: string
}): Promise<boolean> {
  if (appUser.role === 'master-admin') return true
  const { data } = await supabaseAdmin
    .from('departments')
    .select('id')
    .eq('head_user_id', appUser.id)
    .eq('is_active', true)
    .limit(1)
  return (data ?? []).length > 0
}

// GET /api/dashboard/kpi-goal?year=YYYY&quarter=N → { year, quarter, target, canEdit }
// year/quarter 생략 시 현재 분기 자동 적용
export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser) {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const year = parseInt(sp.get('year') ?? '', 10) || new Date().getFullYear()
  const quarterParam = parseInt(sp.get('quarter') ?? '', 10)
  const quarter =
    quarterParam >= 1 && quarterParam <= 4 ? quarterParam : currentQuarter()

  const [{ data }, canEdit, achieved] = await Promise.all([
    supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', keyOf(year, quarter))
      .maybeSingle(),
    canSetKpiGoal(appUser),
    // 실적 — 분기 전사 매출 합산 (학점은행/수강등록 + 민간자격증 + 실습, 원)
    getQuarterCompanySales(year, quarter),
  ])

  const v = data?.value as { target?: unknown } | null | undefined
  const target = typeof v?.target === 'number' && v.target > 0 ? v.target : null

  return NextResponse.json(
    { year, quarter, target, achieved, canEdit },
    {
      headers: {
        'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300',
      },
    },
  )
}

// POST /api/dashboard/kpi-goal  body: { year: number, quarter: number, target: number(원) }
export async function POST(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || !(await canSetKpiGoal(appUser))) {
    return NextResponse.json(
      { error: 'KPI 목표는 사업본부장만 설정할 수 있습니다.' },
      { status: 403 },
    )
  }

  let body: { year?: unknown; quarter?: unknown; target?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const year =
    typeof body.year === 'number' && body.year >= 2020 && body.year <= 2100
      ? body.year
      : new Date().getFullYear()
  const quarter =
    typeof body.quarter === 'number' && body.quarter >= 1 && body.quarter <= 4
      ? body.quarter
      : currentQuarter()
  const target = typeof body.target === 'number' ? Math.floor(body.target) : NaN
  if (!Number.isFinite(target) || target <= 0) {
    return NextResponse.json(
      { error: '목표 금액을 올바르게 입력해주세요.' },
      { status: 400 },
    )
  }

  const { error } = await supabaseAdmin
    .from('app_settings')
    .upsert(
      {
        key: keyOf(year, quarter),
        value: { target },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, year, quarter, target })
}
