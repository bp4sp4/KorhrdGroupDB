import { NextRequest, NextResponse } from 'next/server'
import { nmsAdmin } from '@/lib/supabase/nms'
import { requireAuth } from '@/lib/auth/requireAuth'

// NMS 시스템 customers 테이블에서 팀별 월매출 조회
// customers.team 이 아닌 users.team 기준으로 팀을 판단 (담당자의 소속팀)
// GET /api/management/nms-sales?year=2026&month=4&team=본사
export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const sp = request.nextUrl.searchParams
  const year = parseInt(sp.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(sp.get('month') ?? String(new Date().getMonth() + 1))
  const teamFilter = sp.get('team') ?? '' // 비어있으면 전체 팀

  // Step 1: users 테이블에서 팀별 담당자 이름 목록 조회
  // customers.team 은 부정확하게 저장된 경우가 많으므로 users.team 기준 사용
  let managersByTeam: Map<string, string> // name → team
  if (teamFilter) {
    const { data: users, error: usersErr } = await nmsAdmin
      .from('users')
      .select('name, team')
      .eq('team', teamFilter)
    if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 })
    managersByTeam = new Map(users?.map(u => [u.name, u.team]) ?? [])
  } else {
    // 전체: 팀이 있는 모든 유저
    const { data: users, error: usersErr } = await nmsAdmin
      .from('users')
      .select('name, team')
      .not('team', 'is', null)
      .neq('team', '')
    if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 })
    managersByTeam = new Map(users?.map(u => [u.name, u.team]) ?? [])
  }

  const managerNames = Array.from(managersByTeam.keys())
  if (managerNames.length === 0) {
    return NextResponse.json({ year, month, total: { paymentAmount: 0, commission: 0, totalCount: 0, completedCount: 0 }, byTeam: [] })
  }

  // Step 2: 해당 담당자들의 월 customers 데이터 조회
  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const startDate = `${year}-${pad(month)}-01T00:00:00+09:00`
  const endDate = `${year}-${pad(month)}-${pad(lastDay)}T23:59:59+09:00`

  const { data, error } = await nmsAdmin
    .from('customers')
    .select('manager, payment_amount, commission, status, created_at')
    .in('manager', managerNames)
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 팀별 집계 (team은 users 테이블 기준으로 매핑)
  const teamMap = new Map<string, {
    team: string
    paymentAmount: number
    commission: number
    totalCount: number
    completedCount: number
    managers: Map<string, { paymentAmount: number; commission: number; totalCount: number; completedCount: number }>
  }>()

  for (const row of data ?? []) {
    const team = managersByTeam.get(row.manager) || '미지정'
    const manager = row.manager || '미지정'
    const amount = row.payment_amount || 0
    const commission = row.commission || 0
    const isCompleted = row.status === '등록완료'

    if (!teamMap.has(team)) {
      teamMap.set(team, {
        team,
        paymentAmount: 0,
        commission: 0,
        totalCount: 0,
        completedCount: 0,
        managers: new Map(),
      })
    }

    const teamStat = teamMap.get(team)!
    teamStat.paymentAmount += amount
    teamStat.commission += commission
    teamStat.totalCount += 1
    if (isCompleted) teamStat.completedCount += 1

    // 담당자별 집계
    if (!teamStat.managers.has(manager)) {
      teamStat.managers.set(manager, { paymentAmount: 0, commission: 0, totalCount: 0, completedCount: 0 })
    }
    const mgrStat = teamStat.managers.get(manager)!
    mgrStat.paymentAmount += amount
    mgrStat.commission += commission
    mgrStat.totalCount += 1
    if (isCompleted) mgrStat.completedCount += 1
  }

  // 직렬화: 팀별 → 담당자 배열로 변환, 매출 내림차순 정렬
  const byTeam = Array.from(teamMap.values())
    .sort((a, b) => b.paymentAmount - a.paymentAmount)
    .map(t => ({
      team: t.team,
      paymentAmount: t.paymentAmount,
      commission: t.commission,
      totalCount: t.totalCount,
      completedCount: t.completedCount,
      managers: Array.from(t.managers.entries())
        .map(([manager, s]) => ({ manager, ...s }))
        .sort((a, b) => b.paymentAmount - a.paymentAmount),
    }))

  const grandTotal = {
    paymentAmount: byTeam.reduce((s, t) => s + t.paymentAmount, 0),
    commission: byTeam.reduce((s, t) => s + t.commission, 0),
    totalCount: byTeam.reduce((s, t) => s + t.totalCount, 0),
    completedCount: byTeam.reduce((s, t) => s + t.completedCount, 0),
  }

  return NextResponse.json({ year, month, total: grandTotal, byTeam })
}
