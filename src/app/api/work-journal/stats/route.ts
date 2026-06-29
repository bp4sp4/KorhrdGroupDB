import { NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// 직전 영업일(주말 제외, 월요일이면 지난 금요일) — KST 기준
function previousBusinessDay(d: Date): Date {
  const r = new Date(d)
  do {
    r.setDate(r.getDate() - 1)
  } while (r.getDay() === 0 || r.getDay() === 6) // 0=일, 6=토
  return r
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 특정 일자(00:00 ~ +1일 00:00) 범위에서 본인 담당 집계
async function collectDay(date: Date, managerName: string) {
  const startISO = iso(date)
  const next = new Date(date)
  next.setDate(next.getDate() + 1)
  const endISO = iso(next)

  const [inq, reg, sales] = await Promise.all([
    supabaseAdmin
      .from('hakjeom_consultations')
      .select('id', { count: 'exact', head: true })
      .eq('manager', managerName)
      .gte('created_at', `${startISO}T00:00:00+09:00`)
      .lt('created_at', `${endISO}T00:00:00+09:00`),
    supabaseAdmin
      .from('edu_students')
      .select('id', { count: 'exact', head: true })
      .eq('manager_name', managerName)
      .gte('registered_at', `${startISO}T00:00:00+09:00`)
      .lt('registered_at', `${endISO}T00:00:00+09:00`),
    supabaseAdmin
      .from('edu_sales')
      .select('total_amount')
      .eq('manager_name', managerName)
      .gte('payment_date', startISO)
      .lt('payment_date', endISO),
  ])

  const inquiries = inq.count ?? 0
  const registrations = reg.count ?? 0
  const rate = inquiries > 0 ? (registrations / inquiries) * 100 : 0
  const salesSum = (sales.data ?? []).reduce(
    (s, r) => s + Number(r.total_amount ?? 0),
    0,
  )
  return { inquiries, registrations, rate, sales: salesSum }
}

// GET /api/work-journal/stats — 로그인 사용자(담당자) 기준 stats
// - 메인 수치: 당월(문의/등록/등록률/매출) — 매월 1일에 자동 초기화
// - delta: 오늘 vs 직전 영업일(주말 제외, 월=금) 비교
export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const managerName = appUser.display_name?.trim()
  if (!managerName) {
    return NextResponse.json({
      managerName: null,
      totalInquiries: 0,
      registrations: 0,
      registrationRate: 0,
      salesThisMonth: 0,
      delta: {
        inquiries: 0,
        registrations: 0,
        rate: 0,
        sales: 0,
        comparedDate: null,
      },
    })
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // 토/일에 접속해도 평일 흐름이 자연스럽도록 "기준 영업일"은 오늘 또는 직전 영업일
  const baseDay =
    today.getDay() === 0 || today.getDay() === 6
      ? previousBusinessDay(today)
      : today
  const prevDay = previousBusinessDay(baseDay)

  // 이번 달 매출 범위
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  // 실적 순위(담당자 실적) — 분기 등록완료율 기준 (KST)
  const kstNowR = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }),
  )
  const qYear = kstNowR.getFullYear()
  const qMonth = kstNowR.getMonth()
  const quarter = Math.floor(qMonth / 3) + 1
  const qStartMonth = (quarter - 1) * 3
  const qEndMonth = qStartMonth + 2
  const qEndLastDay = new Date(qYear, qEndMonth + 1, 0).getDate()
  const quarterStartISO = `${qYear}-${String(qStartMonth + 1).padStart(2, '0')}-01T00:00:00+09:00`
  const quarterEndISO = `${qYear}-${String(qEndMonth + 1).padStart(2, '0')}-${String(qEndLastDay).padStart(2, '0')}T23:59:59+09:00`

  // 오늘(KST) 연락 예정 범위: 오늘 00:00 ~ 내일 00:00 KST
  const todayStartISO = `${iso(today)}T00:00:00+09:00`
  const todayEnd = new Date(today)
  todayEnd.setDate(todayEnd.getDate() + 1)
  const todayEndISO = `${iso(todayEnd)}T00:00:00+09:00`

  // 당월 범위 ISO (KST)
  const monthStartISO = `${iso(monthStart)}T00:00:00+09:00`
  const monthEndISO = `${iso(monthEnd)}T00:00:00+09:00`

  // 문의/등록도 당월 기준 (매월 1일에 자동 초기화)
  const [
    inqMonth,
    regMonth,
    salesMonth,
    baseStat,
    prevStat,
    todayContactsRes,
    todayCompletedRes,
    pendingNewRes,
    allSalesRes,
  ] = await Promise.all([
    supabaseAdmin
      .from('hakjeom_consultations')
      .select('id', { count: 'exact', head: true })
      .eq('manager', managerName)
      .gte('created_at', monthStartISO)
      .lt('created_at', monthEndISO),
    supabaseAdmin
      .from('edu_students')
      .select('id', { count: 'exact', head: true })
      .eq('manager_name', managerName)
      .gte('registered_at', monthStartISO)
      .lt('registered_at', monthEndISO),
    supabaseAdmin
      .from('edu_sales')
      .select('total_amount')
      .eq('manager_name', managerName)
      .gte('payment_date', iso(monthStart))
      .lt('payment_date', iso(monthEnd)),
    collectDay(baseDay, managerName),
    collectDay(prevDay, managerName),
    // 오늘 본인 담당 연락 예정 (학점은행제 - hakjeom_consultations) — id 목록까지 받음
    supabaseAdmin
      .from('hakjeom_consultations')
      .select('id')
      .eq('manager', managerName)
      .gte('contact_scheduled_at', todayStartISO)
      .lt('contact_scheduled_at', todayEndISO),
    // 오늘 신규 상담완료 (counsel_completed_at 오늘)
    supabaseAdmin
      .from('hakjeom_consultations')
      .select('id', { count: 'exact', head: true })
      .eq('manager', managerName)
      .gte('counsel_completed_at', todayStartISO)
      .lt('counsel_completed_at', todayEndISO),
    // 신규 배정(상담대기) — 분모
    supabaseAdmin
      .from('hakjeom_consultations')
      .select('id', { count: 'exact', head: true })
      .eq('manager', managerName)
      .eq('status', '상담대기')
      .is('deleted_at', null),
    // 실적 순위 — 분기 전체 담당자 매출 (담당자별 합산)
    supabaseAdmin
      .from('edu_sales')
      .select('manager_name, total_amount')
      .not('manager_name', 'is', null)
      .neq('manager_name', '')
      .gte('payment_date', quarterStartISO.slice(0, 10))
      .lte('payment_date', quarterEndISO.slice(0, 10)),
  ])

  const totalInquiries = inqMonth.count ?? 0
  const registrations = regMonth.count ?? 0
  const registrationRate =
    totalInquiries > 0 ? (registrations / totalInquiries) * 100 : 0
  const salesThisMonth = (salesMonth.data ?? []).reduce(
    (s, r) => s + Number(r.total_amount ?? 0),
    0,
  )

  // 오늘 가망관리 처리분 — 오늘 연락예정 건 중 오늘 메모(연락 기록)가 추가된 건수
  // (상담완료 status 는 메모 작성 시 counsel_completed_at 초기화로 어긋나므로 메모 기준 판정)
  const todayScheduledIds = ((todayContactsRes.data ?? []) as { id: number | string }[]).map(
    (r) => String(r.id),
  )
  let todayScheduledDone = 0
  if (todayScheduledIds.length > 0) {
    const { data: memoRows } = await supabaseAdmin
      .from('memo_logs')
      .select('record_id')
      .eq('table_name', 'hakjeom_consultations')
      .in('record_id', todayScheduledIds)
      .gte('created_at', todayStartISO)
      .lt('created_at', todayEndISO)
    todayScheduledDone = new Set((memoRows ?? []).map((m) => m.record_id)).size
  }

  // 실적 순위 — 분기 매출 내림차순 (담당자별 합산)
  const revByMgr: Record<string, number> = {}
  for (const r of allSalesRes.data ?? []) {
    const m = (r as { manager_name?: string | null }).manager_name
    if (!m) continue
    revByMgr[m] =
      (revByMgr[m] ?? 0) +
      Number((r as { total_amount?: number | null }).total_amount ?? 0)
  }
  const ranked = Object.entries(revByMgr)
    .map(([m, rev]) => ({ m, rev }))
    .sort((a, b) => b.rev - a.rev)
  const myIdx = ranked.findIndex((x) => x.m === managerName)
  const rank = myIdx + 1
  const totalManagers = ranked.length
  // 한 단계 위 등수와의 매출 차이(원) — 그만큼 더 하면 추월
  const gapToNext =
    myIdx > 0 ? Math.max(0, ranked[myIdx - 1].rev - ranked[myIdx].rev) : 0
  const nextRank = rank > 1 ? rank - 1 : 0

  return NextResponse.json({
    managerName,
    totalInquiries,
    registrations,
    registrationRate: Math.round(registrationRate * 10) / 10,
    salesThisMonth,
    todayScheduledContacts: todayScheduledIds.length,
    todayCompletedNew: todayCompletedRes.count ?? 0,
    pendingNew: pendingNewRes.count ?? 0,
    todayScheduledDone,
    rank,
    totalManagers,
    nextRank,
    gapToNext,
    delta: {
      // 오늘 - 직전 영업일
      inquiries: baseStat.inquiries - prevStat.inquiries,
      registrations: baseStat.registrations - prevStat.registrations,
      rate: Math.round((baseStat.rate - prevStat.rate) * 10) / 10,
      sales: baseStat.sales - prevStat.sales,
      comparedDate: iso(prevDay),
    },
  })
}
