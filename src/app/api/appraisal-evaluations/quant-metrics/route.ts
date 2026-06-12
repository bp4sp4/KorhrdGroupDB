import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canEditAppraisal } from '@/lib/auth/appraisalAccess'
import { getEvaluationTargets } from '@/lib/appraisal/evaluationAccess'
import { getMonthlySales } from '@/lib/dashboard/monthlySales'
import { getTodayKstDate, kstDateAt, WORK_START_HOUR } from '@/lib/attendance'
import {
  expandLeaveCredit,
  isVacationDocType,
  leaveCreditsFromTransaction,
} from '@/lib/leave/workCredit'
import {
  attendanceScore,
  quarterRatioScore,
  refundScore,
  relativeRankScore,
  type QuantMetrics,
} from '@/lib/appraisal/quantScore'

export const runtime = 'nodejs'

const pad = (n: number) => String(n).padStart(2, '0')

/** 연도 + 월 목록 → 날짜 범위 */
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

/** 분기 → 월/날짜 범위 */
function quarterRange(year: number, quarter: number) {
  return monthsRange(year, [quarter * 3 - 2, quarter * 3 - 1, quarter * 3])
}

// GET /api/appraisal-evaluations/quant-metrics?userId=&year=&quarter=
// 평가 대상자의 정량평가 자동 산출값 — 인사고과 주기(분기별)에 맞춰 분기 합산.
//   매출      : 전분기 평균 매출 대비 당분기 평균 매출 비율 → 1~5점
//   등록률    : 전분기 평균 등록률 대비 당분기 평균 등록률 비율 → 1~5점
//   배정 DB수 : 분기 담당자 배정 상담 건수 (상대평가 참고용)
//   환불 건수 : 분기 수강등록 중 환불/당월 환불 → 1~5점
//   근태      : 분기 지각(10시 이후 출근)·결근(평일 중 기록·휴가 없음) → 1~5점
// 권한: 본인 / master-admin / 해당 직원의 개인 역량평가 평가자 / 경영실장(평가 현황 열람)
export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  // userId 생략 시 본인 지표 조회
  const userId = parseInt(sp.get('userId') ?? '', 10) || appUser.id

  const now = new Date()
  const year = parseInt(sp.get('year') ?? '', 10) || now.getFullYear()
  const quarterParam = parseInt(sp.get('quarter') ?? '', 10)
  const quarter =
    quarterParam >= 1 && quarterParam <= 4
      ? quarterParam
      : Math.floor(now.getMonth() / 3) + 1

  // 전분기 — 2026-Q3 평가는 특례: 전분기(2분기) 데이터가 6월부터만 존재하므로
  // 비교 기준을 2026년 6월 한 달로 한다. 2026-Q4부터는 직전 분기 전체와 비교.
  const isFirstPeriod = year === 2026 && quarter === 3
  const prevYear = quarter === 1 ? year - 1 : year
  const prevQuarter = quarter === 1 ? 4 : quarter - 1

  const curr = quarterRange(year, quarter)
  const prev = isFirstPeriod
    ? monthsRange(2026, [6])
    : quarterRange(prevYear, prevQuarter)
  const prevLabel = isFirstPeriod
    ? '2026년 6월'
    : `${prevYear}년 ${prevQuarter}분기`

  // 권한 확인
  if (userId !== appUser.id) {
    const [targets, canOverview] = await Promise.all([
      getEvaluationTargets(appUser),
      canEditAppraisal(appUser),
    ])
    const allowed =
      targets.isMaster ||
      canOverview ||
      targets.personalTargets.some((t) => t.userId === userId)
    if (!allowed) {
      return NextResponse.json(
        { error: '해당 직원의 정량 지표 조회 권한이 없습니다.' },
        { status: 403 },
      )
    }
  }

  // 대상자 이름 (매출파일 manager_name / 상담 manager 매칭용)
  const { data: targetUser } = await supabaseAdmin
    .from('app_users')
    .select('id, display_name, department_id')
    .eq('id', userId)
    .maybeSingle()
  if (!targetUser) {
    return NextResponse.json({ error: '대상 사용자를 찾을 수 없습니다.' }, { status: 404 })
  }
  const displayName = targetUser.display_name?.trim() ?? ''

  const consultQuery = (r: ReturnType<typeof quarterRange>) =>
    displayName
      ? supabaseAdmin
          .from('hakjeom_consultations')
          .select('status')
          .eq('manager', displayName)
          .is('deleted_at', null)
          .gte('created_at', r.tsStart)
          .lte('created_at', r.tsEnd)
      : Promise.resolve({ data: [], error: null })

  const [
    salesRes,
    prevSalesRes,
    consultRes,
    prevConsultRes,
    refundRes,
    attendRes,
    leaveRes,
    leaveTxRes,
  ] = await Promise.allSettled([
    // 당분기 / 전분기 매출 (만원) — 월별 합산
    displayName
      ? Promise.all(curr.months.map((m) => getMonthlySales(displayName, year, m)))
      : Promise.resolve([]),
    displayName
      ? Promise.all(
          prev.months.map((m) => getMonthlySales(displayName, prev.year, m)),
        )
      : Promise.resolve([]),
    // 당분기 / 전분기 배정 DB + 등록완료 (학점은행 상담)
    consultQuery(curr),
    consultQuery(prev),
    // 환불 건수 (수강등록)
    displayName
      ? supabaseAdmin
          .from('edu_students')
          .select('id', { count: 'exact', head: true })
          .eq('manager_name', displayName)
          .in('status', ['환불', '당월 환불'])
          .gte('registered_at', curr.tsStart)
          .lte('registered_at', curr.tsEnd)
      : Promise.resolve({ count: 0, error: null }),
    // 근태 (출퇴근 기록)
    supabaseAdmin
      .from('attendance_records')
      .select('date, clock_in_at')
      .eq('user_id', userId)
      .gte('date', curr.start)
      .lte('date', curr.end),
    // 승인 휴가 (결근 제외 처리용)
    supabaseAdmin
      .from('approvals')
      .select('document_type, content')
      .eq('status', 'APPROVED')
      .eq('applicant_id', userId)
      .ilike('document_type', '%휴가%')
      .lte('content->>vacation_start', curr.end)
      .gte('content->>vacation_end', curr.start),
    // 결재 없는 휴가 차감 (관리자 수동 차감 등)
    supabaseAdmin
      .from('leave_transactions')
      .select('delta, reason, created_at')
      .eq('user_id', userId)
      .is('approval_id', null)
      .lte('delta', 0)
      .gte('created_at', `${prev.start}T00:00:00+09:00`)
      .limit(500),
  ])

  const round1 = (n: number) => Math.round(n * 10) / 10

  // ── 매출 — 전분기 평균 대비 당분기 평균 ──────────────────────────────
  const sumSales = (
    res: PromiseSettledResult<{ total: number }[]>,
  ): number =>
    res.status === 'fulfilled'
      ? res.value.reduce((sum, m) => sum + m.total, 0)
      : 0
  const currSalesTotal = sumSales(salesRes)
  const prevSalesTotal = sumSales(prevSalesRes)
  const currSalesAvg = round1(currSalesTotal / curr.months.length)
  const prevSalesAvg =
    prevSalesTotal > 0 ? round1(prevSalesTotal / prev.months.length) : null
  const salesRate =
    prevSalesAvg != null && prevSalesAvg > 0
      ? round1((currSalesAvg / prevSalesAvg) * 100)
      : null

  // ── 등록률 — 전분기 평균 대비 당분기 평균 ────────────────────────────
  const consultStats = (
    res: PromiseSettledResult<{
      data: { status: string | null }[] | null
      error: unknown
    }>,
  ) => {
    const rows =
      res.status === 'fulfilled' && !res.value.error
        ? (res.value.data ?? [])
        : []
    const assigned = rows.length
    const registered = rows.filter((r) => r.status === '등록완료').length
    const rate = assigned > 0 ? round1((registered / assigned) * 100) : null
    return { assigned, registered, rate }
  }
  const currConsult = consultStats(consultRes)
  const prevConsult = consultStats(prevConsultRes)
  const regCompareRate =
    currConsult.rate != null && prevConsult.rate != null && prevConsult.rate > 0
      ? round1((currConsult.rate / prevConsult.rate) * 100)
      : null

  // ── 배정 DB수 상대평가 — 같은 부서 담당자 간 순위 ───────────────────
  let dbRank: number | null = null
  let dbGroupSize = 0
  let dbScore: number | null = null
  if (displayName && targetUser.department_id) {
    const { data: teammates } = await supabaseAdmin
      .from('app_users')
      .select('id, display_name')
      .eq('department_id', targetUser.department_id)
      .neq('role', 'guest')
    const names = Array.from(
      new Set(
        (teammates ?? [])
          .map((u) => u.display_name?.trim())
          .filter((n): n is string => !!n),
      ),
    )
    if (names.length > 1) {
      const { data: teamConsults } = await supabaseAdmin
        .from('hakjeom_consultations')
        .select('manager')
        .in('manager', names)
        .is('deleted_at', null)
        .gte('created_at', curr.tsStart)
        .lte('created_at', curr.tsEnd)
      const countByName = new Map<string, number>()
      for (const row of (teamConsults ?? []) as { manager: string | null }[]) {
        const n = row.manager?.trim()
        if (!n) continue
        countByName.set(n, (countByName.get(n) ?? 0) + 1)
      }
      // 비교 그룹 = 분기 배정 이력이 있는 부서 담당자 + 본인(0건이어도 포함)
      if (!countByName.has(displayName)) countByName.set(displayName, 0)
      const counts = Array.from(countByName.values())
      dbGroupSize = counts.length
      const myCount = countByName.get(displayName) ?? 0
      const minCount = Math.min(...counts)
      dbRank = 1 + counts.filter((c) => c > myCount).length
      dbScore = relativeRankScore(dbRank, dbGroupSize, myCount === minCount)
    }
  }

  // ── 환불 건수 ────────────────────────────────────────────────────────
  const refundCount =
    refundRes.status === 'fulfilled' && !refundRes.value.error
      ? (refundRes.value.count ?? 0)
      : 0

  // ── 근태 — 지각 / 결근 ──────────────────────────────────────────────
  const attendRows =
    attendRes.status === 'fulfilled' && !attendRes.value.error
      ? ((attendRes.value.data ?? []) as {
          date: string
          clock_in_at: string | null
        }[])
      : []
  const recordedDates = new Set<string>()
  let workDays = 0
  let lateCount = 0
  for (const r of attendRows) {
    if (!r.clock_in_at) continue
    recordedDates.add(r.date)
    workDays += 1
    if (new Date(r.clock_in_at) > kstDateAt(r.date, WORK_START_HOUR)) {
      lateCount += 1
    }
  }

  // 승인 휴가일 (결근에서 제외)
  const leaveDates = new Set<string>()
  if (leaveRes.status === 'fulfilled' && !leaveRes.value.error) {
    for (const lv of leaveRes.value.data ?? []) {
      if (!isVacationDocType(lv.document_type)) continue
      const c = (lv.content ?? {}) as {
        vacation_type?: string | null
        vacation_start?: string | null
        vacation_end?: string | null
      }
      for (const cr of expandLeaveCredit(
        c.vacation_type,
        c.vacation_start,
        c.vacation_end,
      )) {
        leaveDates.add(cr.date)
      }
    }
  }
  if (leaveTxRes.status === 'fulfilled' && !leaveTxRes.value.error) {
    for (const tx of leaveTxRes.value.data ?? []) {
      for (const cr of leaveCreditsFromTransaction(tx.reason, tx.created_at)) {
        leaveDates.add(cr.date)
      }
    }
  }

  // 결근 = 분기 내 지난 평일(오늘 제외) 중 출근 기록·휴가 모두 없는 날
  const todayKst = getTodayKstDate()
  let absentCount = 0
  {
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
        absentCount += 1
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
      guard += 1
    }
  }

  const metrics: QuantMetrics = {
    period: `${year}년 ${quarter}분기`,
    prevPeriod: prevLabel,
    sales: {
      prevAvg: prevSalesAvg,
      currAvg: currSalesAvg,
      rate: salesRate,
      score: salesRate != null ? quarterRatioScore(salesRate) : null,
    },
    registration: {
      assigned: currConsult.assigned,
      registered: currConsult.registered,
      rate: currConsult.rate,
      prevRate: prevConsult.rate,
      compareRate: regCompareRate,
      score: regCompareRate != null ? quarterRatioScore(regCompareRate) : null,
    },
    assignedDb: {
      count: currConsult.assigned,
      rank: dbRank,
      groupSize: dbGroupSize,
      score: dbScore,
    },
    refund: {
      count: refundCount,
      score: refundScore(refundCount),
    },
    attendance: {
      workDays,
      lateCount,
      absentCount,
      score: attendanceScore(lateCount, absentCount),
    },
  }

  return NextResponse.json(metrics, {
    headers: {
      'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
