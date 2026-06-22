import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getMonthlySales } from '@/lib/dashboard/monthlySales'
import {
  defaultMinSales,
  minSalesKey,
  monthlyGoalKey,
  normalizeWeeks,
  readGoal,
  readTotal,
} from '@/lib/appraisal/salesTarget'

export const runtime = 'nodejs'

const MGMT_DEPT_CODE = 'MGT' // 경영지원본부

interface Scope {
  isMaster: boolean
  isMgmt: boolean
  isHead: boolean
  isLeader: boolean
  canEditMin: boolean // 최소매출 편집 (경영지원본부/ master)
  canEditTarget: boolean // 목표매출 편집 (팀장/본부장/master)
  visibleUserIds: Set<number>
}

/** 뷰어 권한 + 볼 수 있는 직원 집합 산출 */
async function resolveScope(appUser: {
  id: number
  role: string
  department_id?: string | null
}): Promise<Scope> {
  const isMaster = appUser.role === 'master-admin' || appUser.role === 'admin'

  // 경영지원본부 여부 — 본인 부서 코드
  let isMgmt = false
  if (appUser.department_id) {
    const { data: dept } = await supabaseAdmin
      .from('departments')
      .select('code')
      .eq('id', appUser.department_id)
      .maybeSingle()
    isMgmt = dept?.code === MGMT_DEPT_CODE
  }

  // 본부장 — 본인이 head 인 부서
  const { data: headDepts } = await supabaseAdmin
    .from('departments')
    .select('id')
    .eq('head_user_id', appUser.id)
    .eq('is_active', true)
  const headDeptIds = new Set((headDepts ?? []).map((d) => d.id as string))
  const isHead = headDeptIds.size > 0

  // 팀장 — 본인이 leader 인 팀
  const { data: ledTeams } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('leader_user_id', appUser.id)
  const ledTeamIds = new Set((ledTeams ?? []).map((t) => t.id as string))
  const isLeader = ledTeamIds.size > 0

  // 볼 수 있는 직원
  const visibleUserIds = new Set<number>()
  const activeUsers = await supabaseAdmin
    .from('app_users')
    .select('id, team_id, department_id, role')
    .eq('is_active', true)
    .neq('role', 'guest')
    .neq('role', 'mini-admin')
  const users = activeUsers.data ?? []

  if (isMaster || isMgmt) {
    for (const u of users) visibleUserIds.add(u.id as number)
  } else {
    if (isHead) {
      // 본부 소속 팀의 팀원 (팀의 department_id 가 head 부서)
      const { data: deptTeams } = await supabaseAdmin
        .from('teams')
        .select('id')
        .in('department_id', Array.from(headDeptIds))
      const teamIds = new Set((deptTeams ?? []).map((t) => t.id as string))
      for (const u of users) {
        if (u.team_id && teamIds.has(u.team_id as string))
          visibleUserIds.add(u.id as number)
      }
    }
    if (isLeader) {
      for (const u of users) {
        if (u.team_id && ledTeamIds.has(u.team_id as string))
          visibleUserIds.add(u.id as number)
      }
    }
  }

  return {
    isMaster,
    isMgmt,
    isHead,
    isLeader,
    canEditMin: isMaster || isMgmt,
    canEditTarget: isMaster || isHead || isLeader,
    visibleUserIds,
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

// GET /api/sales-targets?year=&month=
export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const now = new Date()
  const year = parseInt(request.nextUrl.searchParams.get('year') ?? '', 10) || now.getFullYear()
  const month =
    parseInt(request.nextUrl.searchParams.get('month') ?? '', 10) ||
    now.getMonth() + 1

  const scope = await resolveScope(appUser)
  if (scope.visibleUserIds.size === 0) {
    return NextResponse.json(
      { error: '매출 목표를 관리할 권한이 없습니다.' },
      { status: 403 },
    )
  }

  const ids = Array.from(scope.visibleUserIds)

  // 직원 정보 + 팀/직책/팀장여부
  const [usersRes, teamsRes, leadersRes] = await Promise.all([
    supabaseAdmin
      .from('app_users')
      .select('id, display_name, team_id, position_id')
      .in('id', ids),
    supabaseAdmin.from('teams').select('id, name, leader_user_id'),
    supabaseAdmin.from('teams').select('leader_user_id'),
  ])
  const teamMap = new Map(
    (teamsRes.data ?? []).map((t) => [t.id as string, t.name as string]),
  )
  const leaderIds = new Set(
    (leadersRes.data ?? [])
      .map((t) => t.leader_user_id as number | null)
      .filter((v): v is number => v != null),
  )
  const positionIds = Array.from(
    new Set(
      (usersRes.data ?? [])
        .map((u) => u.position_id as string | null)
        .filter((v): v is string => !!v),
    ),
  )
  const posMap = new Map<string, string>()
  if (positionIds.length > 0) {
    const { data: pos } = await supabaseAdmin
      .from('positions')
      .select('id, name')
      .in('id', positionIds)
    for (const p of pos ?? []) posMap.set(p.id as string, p.name as string)
  }

  // 저장된 최소매출 / 목표매출
  const settingKeys = ids.flatMap((uid) => [
    minSalesKey(uid, year, month),
    monthlyGoalKey(uid, year, month),
  ])
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('key, value')
    .in('key', settingKeys)
  const settingMap = new Map(
    (settings ?? []).map((s) => [s.key as string, s.value]),
  )

  const rows = await Promise.all(
    (usersRes.data ?? []).map(async (u) => {
      const uid = u.id as number
      const displayName = (u.display_name as string | null)?.trim() ?? ''
      const isLeader = leaderIds.has(uid)
      const minStored = readTotal(settingMap.get(minSalesKey(uid, year, month)))
      const targetGoal = readGoal(
        settingMap.get(monthlyGoalKey(uid, year, month)),
      )
      const actual = displayName
        ? (await getMonthlySales(displayName, year, month)).total
        : 0
      return {
        userId: uid,
        name: displayName,
        teamName: u.team_id ? (teamMap.get(u.team_id as string) ?? null) : null,
        position: u.position_id
          ? (posMap.get(u.position_id as string) ?? null)
          : null,
        isLeader,
        // 최소매출: 저장값 없으면 기본값(팀장 1000 / 사원 600)
        minSales: minStored ?? defaultMinSales(isLeader),
        minSalesDefaulted: minStored == null,
        targetSales: targetGoal?.total ?? null, // 미설정이면 null
        targetWeeks: targetGoal?.weeks ?? null, // 주차별 목표(5)
        actualSales: actual,
      }
    }),
  )
  rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  return NextResponse.json({
    year,
    month,
    canEditMin: scope.canEditMin,
    canEditTarget: scope.canEditTarget,
    rows,
  })
}

// POST /api/sales-targets
// body: { year, month, updates: [{ userId, minSales?, targetSales? }] }
export async function POST(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as {
    year?: number
    month?: number
    updates?: {
      userId?: number
      minSales?: number | null
      // 목표매출 — 주차별({total,weeks}) 또는 합계(number)
      target?: { total?: number; weeks?: unknown } | null
    }[]
  } | null
  const year = body?.year
  const month = body?.month
  if (!year || !month || !Array.isArray(body?.updates)) {
    return NextResponse.json({ error: '요청 값이 올바르지 않습니다.' }, { status: 400 })
  }

  const scope = await resolveScope(appUser)
  const now = new Date().toISOString()
  const upserts: { key: string; value: unknown; updated_at: string; updated_by: number }[] = []

  for (const u of body.updates) {
    const uid = u.userId
    if (typeof uid !== 'number' || !scope.visibleUserIds.has(uid)) continue

    if ('minSales' in u && scope.canEditMin) {
      const v = u.minSales
      if (typeof v === 'number' && v >= 0) {
        upserts.push({
          key: minSalesKey(uid, year, month),
          value: { total: Math.floor(v) },
          updated_at: now,
          updated_by: appUser.id,
        })
      }
    }
    // 목표매출(주차별) — 합계 = 주차 합. 대시보드 월목표와 동일 구조({total,weeks})
    if (u.target && scope.canEditTarget) {
      const weeks = normalizeWeeks(u.target.weeks)
      const weeksSum = weeks.reduce((a, b) => a + b, 0)
      const total =
        typeof u.target.total === 'number' && u.target.total >= 0
          ? Math.floor(u.target.total)
          : weeksSum
      upserts.push({
        key: monthlyGoalKey(uid, year, month),
        value: { total, weeks },
        updated_at: now,
        updated_by: appUser.id,
      })
    }
  }

  if (upserts.length === 0) {
    return NextResponse.json({ error: '저장할 항목이 없습니다.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('app_settings')
    .upsert(upserts, { onConflict: 'key' })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, saved: upserts.length })
}
