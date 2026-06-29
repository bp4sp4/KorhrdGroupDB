import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canViewAppraisalOverview } from '@/lib/auth/appraisalAccess'
import { getEvaluationTargets } from '@/lib/appraisal/evaluationAccess'
import { getMonthlySales, type SalesSource } from '@/lib/dashboard/monthlySales'
import { getTodayKstDate, kstDateAt, resolveWorkHours } from '@/lib/attendance'
import {
  expandLeaveCredit,
  isVacationDocType,
  leaveCreditsFromTransaction,
} from '@/lib/leave/workCredit'
import {
  attendanceScore,
  minSalesRateScore,
  quarterRatioScore,
  type QuantMetrics,
} from '@/lib/appraisal/quantScore'
import {
  defaultMinSales,
  minSalesKey,
  readTotal,
} from '@/lib/appraisal/salesTarget'

export const runtime = 'nodejs'

const pad = (n: number) => String(n).padStart(2, '0')

function monthsRange(year: number, months: number[]) {
  const lastDay = new Date(year, months[months.length - 1], 0).getDate()
  const start = `${year}-${pad(months[0])}-01`
  const end = `${year}-${pad(months[months.length - 1])}-${pad(lastDay)}`
  return {
    year,
    months,
    start,
    end,
    tsStart: `${start}T00:00:00+09:00`,
    tsEnd: `${end}T23:59:59+09:00`,
  }
}
function quarterRange(year: number, quarter: number) {
  return monthsRange(year, [quarter * 3 - 2, quarter * 3 - 1, quarter * 3])
}

// GET /api/appraisal-evaluations/team-quant-metrics?teamId=&year=&quarter=
// 팀역량평가서 "팀 성과관리" 정량 자동 산출 — 팀 = 구성원(app_users.team_id)의 합산(풀링).
//   매출      : 팀 전분기 평균 매출 대비 당분기 평균 매출 비율 → 1~5점
//   등록률    : 팀 전분기 평균 등록률 대비 당분기 평균 등록률 비율 → 1~5점
//   KPI 달성률: 팀 분기 매출 ÷ 메인 대시보드 KPI 목표 → 1~5점
//   기준매출  : 팀 분기 실매출 ÷ 팀 최소매출(구성원 합) → 1~5점
//   근태      : 구성원 지각·결근 합산 → 1~5점
// 권한: master-admin / 해당 팀을 평가하는 본부장 / 평가현황 열람 권한자
export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const teamId = sp.get('teamId') ?? ''
  if (!teamId) {
    return NextResponse.json({ error: 'teamId가 필요합니다.' }, { status: 400 })
  }

  const now = new Date()
  const year = parseInt(sp.get('year') ?? '', 10) || now.getFullYear()
  const quarterParam = parseInt(sp.get('quarter') ?? '', 10)
  const quarter =
    quarterParam >= 1 && quarterParam <= 4
      ? quarterParam
      : Math.floor(now.getMonth() / 3) + 1

  // 권한 확인 — 평가 대상 팀이거나, 마스터/열람권한자
  const [targets, canOverview] = await Promise.all([
    getEvaluationTargets(appUser),
    canViewAppraisalOverview(appUser),
  ])
  const allowed =
    targets.isMaster ||
    canOverview ||
    targets.teamTargets.some((t) => t.teamId === teamId)
  if (!allowed) {
    return NextResponse.json(
      { error: '해당 팀의 정량 지표 조회 권한이 없습니다.' },
      { status: 403 },
    )
  }

  // 2026-Q3 특례: 전분기 데이터 없음 → 전월대비(월평균)
  const isFirstPeriod = year === 2026 && quarter === 3
  const prevYear = quarter === 1 ? year - 1 : year
  const prevQuarter = quarter === 1 ? 4 : quarter - 1
  const curr = quarterRange(year, quarter)
  const prev = isFirstPeriod
    ? monthsRange(2026, [6])
    : quarterRange(prevYear, prevQuarter)
  const prevLabel = isFirstPeriod
    ? '전월 대비(월평균)'
    : `${prevYear}년 ${prevQuarter}분기`

  const monthCompleted = (m: number, y: number) =>
    y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth() + 1)
  const avgMomRatio = (vals: (number | null)[]): number | null => {
    const ratios: number[] = []
    for (let i = 1; i < vals.length; i++) {
      const cur = vals[i]
      const pr = vals[i - 1]
      if (cur == null || pr == null || pr <= 0) continue
      ratios.push((cur / pr) * 100)
    }
    return ratios.length
      ? Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 10) / 10
      : null
  }
  const round1 = (n: number) => Math.round(n * 10) / 10

  // ── 팀 구성원 ────────────────────────────────────────────────────────
  const { data: teamRow } = await supabaseAdmin
    .from('teams')
    .select('id, name')
    .eq('id', teamId)
    .maybeSingle()
  const teamName = (teamRow?.name as string | undefined) ?? '팀'
  // 팀별 매출원 — 영업=수강등록 / 민간=자격증 / 실습=실습 (그 외 팀은 전체)
  const salesSources: SalesSource[] = teamName.includes('민간')
    ? ['cert']
    : teamName.includes('실습')
      ? ['practice']
      : teamName.includes('영업')
        ? ['edu']
        : ['cert', 'edu', 'practice']

  const { data: memberRows } = await supabaseAdmin
    .from('app_users')
    .select('id, display_name, is_active, role, department_id')
    .eq('team_id', teamId)
    .eq('is_active', true)
    .neq('role', 'guest')
  const members = (memberRows ?? []).map((u) => ({
    id: u.id as number,
    name: (u.display_name as string | null)?.trim() ?? '',
    departmentId: (u.department_id as string | null) ?? null,
  }))
  const memberIds = members.map((m) => m.id)
  // 멤버 부서 → 근무시간 프로필 (사업본부는 2026-07-01부터 09:00 출근 기준)
  const memberDeptIds = Array.from(
    new Set(members.map((m) => m.departmentId).filter((v): v is string => !!v)),
  )
  const { data: deptRows } = memberDeptIds.length
    ? await supabaseAdmin
        .from('departments')
        .select('id, code, name')
        .in('id', memberDeptIds)
    : { data: [] as Array<{ id: string; code: string | null; name: string }> }
  const deptRefById = new Map(
    (deptRows ?? []).map((d) => [d.id, { code: d.code, name: d.name }]),
  )
  const deptIdByMember = new Map(members.map((m) => [m.id, m.departmentId]))
  const memberNames = members.map((m) => m.name).filter((n) => n)

  // 팀장(최소매출 기본값 결정용)
  const { data: ledTeams } = await supabaseAdmin
    .from('teams')
    .select('leader_user_id')
    .in('id', [teamId])
  const leaderIdSet = new Set(
    (ledTeams ?? [])
      .map((t) => t.leader_user_id as number | null)
      .filter((v): v is number => v != null),
  )

  // ── 매출 (만원) — 구성원 합산, 월별 ─────────────────────────────────
  const teamMonthSales = async (y: number, monthsList: number[]) => {
    // 각 월별 팀 합계 [총합, 월별합]
    const perMonth = await Promise.all(
      monthsList.map(async (m) => {
        const each = await Promise.all(
          memberNames.map((n) => getMonthlySales(n, y, m, salesSources)),
        )
        return each.reduce((s, r) => s + (r?.total ?? 0), 0)
      }),
    )
    return { perMonth, total: perMonth.reduce((a, b) => a + b, 0) }
  }
  const currSales = await teamMonthSales(year, curr.months)
  const currSalesTotal = currSales.total
  const currSalesAvg = round1(currSalesTotal / curr.months.length)
  let prevSalesAvg: number | null = null
  let salesRate: number | null = null
  if (!isFirstPeriod) {
    const prevSales = await teamMonthSales(prev.year, prev.months)
    prevSalesAvg =
      prevSales.total > 0 ? round1(prevSales.total / prev.months.length) : null
    salesRate =
      prevSalesAvg != null && prevSalesAvg > 0
        ? round1((currSalesAvg / prevSalesAvg) * 100)
        : null
  } else {
    // 전월대비(6→7→8→9) 월평균 비율
    const momMonths = [6, 7, 8, 9]
    const monthTotals = await Promise.all(
      momMonths.map(async (m) =>
        monthCompleted(m, 2026)
          ? (await teamMonthSales(2026, [m])).total
          : null,
      ),
    )
    salesRate = avgMomRatio(monthTotals)
    prevSalesAvg = null
  }

  // ── 등록률 — 구성원 상담 풀링 ──────────────────────────────────────
  const consultStats = async (r: ReturnType<typeof monthsRange>) => {
    if (memberNames.length === 0) return { assigned: 0, registered: 0, rate: null as number | null }
    const { data } = await supabaseAdmin
      .from('hakjeom_consultations')
      .select('status')
      .in('manager', memberNames)
      .is('deleted_at', null)
      .gte('created_at', r.tsStart)
      .lte('created_at', r.tsEnd)
    const rows = (data ?? []) as { status: string | null }[]
    const assigned = rows.length
    const registered = rows.filter((x) => x.status === '등록완료').length
    return {
      assigned,
      registered,
      rate: assigned > 0 ? round1((registered / assigned) * 100) : null,
    }
  }
  const currConsult = await consultStats(curr)
  let regCompareRate: number | null = null
  let regPrevRate: number | null = null
  if (!isFirstPeriod) {
    const prevConsult = await consultStats(prev)
    regPrevRate = prevConsult.rate
    regCompareRate =
      currConsult.rate != null && prevConsult.rate != null && prevConsult.rate > 0
        ? round1((currConsult.rate / prevConsult.rate) * 100)
        : null
  } else {
    const momMonths = [6, 7, 8, 9]
    const monthRates = await Promise.all(
      momMonths.map(async (m) => {
        if (!monthCompleted(m, 2026)) return null
        const s = await consultStats(monthsRange(2026, [m]))
        return s.rate
      }),
    )
    regCompareRate = avgMomRatio(monthRates)
    regPrevRate = null
  }

  // ── 기준(최소) 매출 달성률 — 팀 최소매출(구성원 합) ─────────────────
  let minSalesTotal = 0
  if (memberIds.length > 0) {
    const keys: string[] = []
    for (const m of members) {
      for (const mo of curr.months) keys.push(minSalesKey(m.id, year, mo))
    }
    const { data: minRows } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', keys)
    const byKey = new Map((minRows ?? []).map((r) => [r.key as string, r.value]))
    for (const m of members) {
      const isLeaderMember = leaderIdSet.has(m.id)
      for (const mo of curr.months) {
        const v = readTotal(byKey.get(minSalesKey(m.id, year, mo)))
        minSalesTotal += v ?? defaultMinSales(isLeaderMember)
      }
    }
  }
  const minSalesRateVal =
    minSalesTotal > 0 ? round1((currSalesTotal / minSalesTotal) * 100) : null

  // ── KPI 달성률 — 팀 분기 매출(원) ÷ 대시보드 KPI 목표(원) ───────────
  const kpiKey = `dashboard.kpi_goal.${year}-Q${quarter}`
  const { data: kpiRow } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', kpiKey)
    .maybeSingle()
  const kpiVal = kpiRow?.value as { target?: unknown } | null | undefined
  const kpiTargetWon =
    typeof kpiVal?.target === 'number' && kpiVal.target > 0 ? kpiVal.target : 0
  const teamSalesWon = currSalesTotal * 10000 // 만원 → 원
  const kpiRateVal =
    kpiTargetWon > 0 ? round1((teamSalesWon / kpiTargetWon) * 100) : null

  // ── 근태 — 구성원 지각·결근 합산 ──────────────────────────────────
  let teamLate = 0
  let teamAbsent = 0
  if (memberIds.length > 0) {
    const todayKst = getTodayKstDate()
    const [attendRes, leaveRes, leaveTxRes] = await Promise.all([
      supabaseAdmin
        .from('attendance_records')
        .select('user_id, date, clock_in_at')
        .in('user_id', memberIds)
        .gte('date', curr.start)
        .lte('date', curr.end),
      supabaseAdmin
        .from('approvals')
        .select('applicant_id, document_type, content')
        .in('applicant_id', memberIds)
        .eq('status', 'APPROVED')
        .ilike('document_type', '%휴가%')
        .lte('content->>vacation_start', curr.end)
        .gte('content->>vacation_end', curr.start),
      supabaseAdmin
        .from('leave_transactions')
        .select('user_id, delta, reason, created_at')
        .in('user_id', memberIds)
        .is('approval_id', null)
        .lte('delta', 0)
        .gte('created_at', `${prev.start}T00:00:00+09:00`)
        .limit(2000),
    ])

    type AttRow = { user_id: number; date: string; clock_in_at: string | null }
    const attByUser = new Map<number, AttRow[]>()
    for (const r of (attendRes.data ?? []) as AttRow[]) {
      const arr = attByUser.get(r.user_id) ?? []
      arr.push(r)
      attByUser.set(r.user_id, arr)
    }
    // 구성원별 휴가일
    const leaveByUser = new Map<number, Set<string>>()
    for (const lv of (leaveRes.data ?? []) as {
      applicant_id: number
      document_type: string
      content: {
        vacation_type?: string | null
        vacation_start?: string | null
        vacation_end?: string | null
      } | null
    }[]) {
      if (!isVacationDocType(lv.document_type)) continue
      const c = lv.content ?? {}
      const set = leaveByUser.get(lv.applicant_id) ?? new Set<string>()
      for (const cr of expandLeaveCredit(
        c.vacation_type,
        c.vacation_start,
        c.vacation_end,
      )) {
        set.add(cr.date)
      }
      leaveByUser.set(lv.applicant_id, set)
    }
    for (const tx of (leaveTxRes.data ?? []) as {
      user_id: number
      reason: string | null
      created_at: string
    }[]) {
      const set = leaveByUser.get(tx.user_id) ?? new Set<string>()
      for (const cr of leaveCreditsFromTransaction(tx.reason, tx.created_at)) {
        set.add(cr.date)
      }
      leaveByUser.set(tx.user_id, set)
    }

    for (const mId of memberIds) {
      const rows = attByUser.get(mId) ?? []
      const memberDept = deptRefById.get(deptIdByMember.get(mId) ?? '') ?? null
      const recordedDates = new Set<string>()
      let late = 0
      for (const r of rows) {
        if (!r.clock_in_at) continue
        recordedDates.add(r.date)
        const { startHour } = resolveWorkHours(memberDept, r.date, mId)
        if (new Date(r.clock_in_at) > kstDateAt(r.date, startHour)) late += 1
      }
      const leaveDates = leaveByUser.get(mId) ?? new Set<string>()
      // 결근 = 분기 내 지난 평일 중 출근·휴가 모두 없는 날
      let absent = 0
      const cursor = new Date(`${curr.start}T00:00:00Z`)
      const endDate = new Date(`${curr.end}T00:00:00Z`)
      let guard = 0
      while (cursor.getTime() <= endDate.getTime() && guard < 100) {
        const ymd = `${cursor.getUTCFullYear()}-${pad(cursor.getUTCMonth() + 1)}-${pad(cursor.getUTCDate())}`
        const dow = cursor.getUTCDay()
        if (
          ymd < todayKst &&
          dow !== 0 &&
          dow !== 6 &&
          !recordedDates.has(ymd) &&
          !leaveDates.has(ymd)
        ) {
          absent += 1
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1)
        guard += 1
      }
      teamLate += late
      teamAbsent += absent
    }
  }

  const metrics: QuantMetrics = {
    period: `${teamName} · ${year}년 ${quarter}분기`,
    prevPeriod: prevLabel,
    sales: {
      prevAvg: prevSalesAvg,
      currAvg: currSalesAvg,
      rate: salesRate,
      score: salesRate != null ? quarterRatioScore(salesRate) : null,
    },
    minSalesRate: {
      minTarget: minSalesTotal,
      actual: currSalesTotal,
      rate: minSalesRateVal,
      score: minSalesRateVal != null ? minSalesRateScore(minSalesRateVal) : null,
    },
    kpiRate: {
      target: kpiTargetWon,
      actual: teamSalesWon,
      rate: kpiRateVal,
      score: kpiRateVal != null ? minSalesRateScore(kpiRateVal) : null,
    },
    registration: {
      assigned: currConsult.assigned,
      registered: currConsult.registered,
      rate: currConsult.rate,
      prevRate: regPrevRate,
      compareRate: regCompareRate,
      score: regCompareRate != null ? quarterRatioScore(regCompareRate) : null,
    },
    assignedDb: { count: currConsult.assigned, rank: null, groupSize: 0, score: null },
    refund: { count: 0, score: 5 },
    attendance: {
      workDays: 0,
      lateCount: teamLate,
      absentCount: teamAbsent,
      score: attendanceScore(teamLate, teamAbsent),
    },
  }

  return NextResponse.json(metrics, {
    headers: {
      'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
