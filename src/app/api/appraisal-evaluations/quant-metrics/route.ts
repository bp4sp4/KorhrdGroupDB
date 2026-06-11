import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canEditAppraisal } from '@/lib/auth/appraisalAccess'
import { getEvaluationTargets } from '@/lib/appraisal/evaluationAccess'
import { getMonthlySales } from '@/lib/dashboard/monthlySales'
import { kstDateAt, WORK_START_HOUR } from '@/lib/attendance'
import {
  achievementScore,
  type QuantMetrics,
} from '@/lib/appraisal/quantScore'

export const runtime = 'nodejs'

// GET /api/appraisal-evaluations/quant-metrics?userId=&year=&quarter=
// 평가 대상자의 정량평가 자동 산출값 — 인사고과 주기(분기별)에 맞춰 분기 합산.
//   매출 달성률 : 대시보드 '이번달 목표 설정'의 분기(3개월) 합산 목표 대비 매출파일 실적 합산
//   등록률      : 분기 배정 DB(학점은행 상담) 대비 등록완료 전환
//   배정 DB수   : 분기 담당자 배정 상담 건수
//   환불 건수   : 분기 수강등록 중 환불/당월 환불
//   근태        : 분기 출퇴근 기록 — 출근일수·지각(10시 이후 출근)
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

  const pad = (n: number) => String(n).padStart(2, '0')
  const months = [quarter * 3 - 2, quarter * 3 - 1, quarter * 3] // 분기 내 3개월
  const monthKeys = months.map((m) => `${year}-${pad(m)}`)
  const lastDay = new Date(year, months[2], 0).getDate()
  const rangeStart = `${year}-${pad(months[0])}-01`
  const rangeEnd = `${year}-${pad(months[2])}-${pad(lastDay)}`
  // timestamptz 컬럼은 KST 경계로 비교
  const tsStart = `${rangeStart}T00:00:00+09:00`
  const tsEnd = `${rangeEnd}T23:59:59+09:00`

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
    .select('id, display_name')
    .eq('id', userId)
    .maybeSingle()
  if (!targetUser) {
    return NextResponse.json({ error: '대상 사용자를 찾을 수 없습니다.' }, { status: 404 })
  }
  const displayName = targetUser.display_name?.trim() ?? ''

  const goalKeys = monthKeys.map(
    (mk) => `dashboard.monthly_goal.${userId}.${mk}`,
  )
  const [goalRes, salesRes, consultRes, refundRes, attendRes] =
    await Promise.allSettled([
      // 분기 목표 = 월별 목표(app_settings) 합산
      supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .in('key', goalKeys),
      // 실제 매출 (만원) — 분기 3개월 합산
      displayName
        ? Promise.all(
            months.map((m) => getMonthlySales(displayName, year, m)),
          )
        : Promise.resolve([]),
      // 배정 DB + 등록완료 (학점은행 상담)
      displayName
        ? supabaseAdmin
            .from('hakjeom_consultations')
            .select('status')
            .eq('manager', displayName)
            .is('deleted_at', null)
            .gte('created_at', tsStart)
            .lte('created_at', tsEnd)
        : Promise.resolve({ data: [], error: null }),
      // 환불 건수 (수강등록)
      displayName
        ? supabaseAdmin
            .from('edu_students')
            .select('id', { count: 'exact', head: true })
            .eq('manager_name', displayName)
            .in('status', ['환불', '당월 환불'])
            .gte('registered_at', tsStart)
            .lte('registered_at', tsEnd)
        : Promise.resolve({ count: 0, error: null }),
      // 근태 (출퇴근 기록)
      supabaseAdmin
        .from('attendance_records')
        .select('date, clock_in_at')
        .eq('user_id', userId)
        .gte('date', rangeStart)
        .lte('date', rangeEnd),
    ])

  // 매출 달성률 — 분기 목표 합산 대비 분기 실적 합산
  const goalRows =
    goalRes.status === 'fulfilled' ? (goalRes.value.data ?? []) : []
  let goalSum = 0
  let goalMonths = 0
  for (const row of goalRows) {
    const v = row.value as { total?: unknown } | null | undefined
    if (typeof v?.total === 'number' && v.total > 0) {
      goalSum += v.total
      goalMonths += 1
    }
  }
  const goalTotal = goalMonths > 0 ? goalSum : null
  const actualTotal =
    salesRes.status === 'fulfilled'
      ? salesRes.value.reduce((sum, m) => sum + m.total, 0)
      : 0
  const rate =
    goalTotal != null
      ? Math.round((actualTotal / goalTotal) * 1000) / 10
      : null

  // 등록률 / 배정 DB수
  const consultRows =
    consultRes.status === 'fulfilled' && !consultRes.value.error
      ? ((consultRes.value.data ?? []) as { status: string | null }[])
      : []
  const assigned = consultRows.length
  const registered = consultRows.filter((r) => r.status === '등록완료').length
  const regRate =
    assigned > 0 ? Math.round((registered / assigned) * 1000) / 10 : null

  // 환불 건수
  const refundCount =
    refundRes.status === 'fulfilled' && !refundRes.value.error
      ? (refundRes.value.count ?? 0)
      : 0

  // 근태 — 출근일수 / 지각(WORK_START_HOUR 이후 출근)
  const attendRows =
    attendRes.status === 'fulfilled' && !attendRes.value.error
      ? ((attendRes.value.data ?? []) as {
          date: string
          clock_in_at: string | null
        }[])
      : []
  let workDays = 0
  let lateCount = 0
  for (const r of attendRows) {
    if (!r.clock_in_at) continue
    workDays += 1
    if (new Date(r.clock_in_at) > kstDateAt(r.date, WORK_START_HOUR)) {
      lateCount += 1
    }
  }

  const metrics: QuantMetrics = {
    period: `${year}년 ${quarter}분기`,
    sales: {
      goalTotal,
      actualTotal,
      rate,
      score: rate != null ? achievementScore(rate) : null,
    },
    registration: { assigned, registered, rate: regRate },
    refundCount,
    attendance: { workDays, lateCount },
  }

  return NextResponse.json(metrics, {
    headers: {
      'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
