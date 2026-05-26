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
// - 메인 수치: 누적(문의/등록/등록률) + 이번 달(매출)
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

  const [inqAll, regAll, salesMonth, baseStat, prevStat] = await Promise.all([
    supabaseAdmin
      .from('hakjeom_consultations')
      .select('id', { count: 'exact', head: true })
      .eq('manager', managerName),
    supabaseAdmin
      .from('edu_students')
      .select('id', { count: 'exact', head: true })
      .eq('manager_name', managerName),
    supabaseAdmin
      .from('edu_sales')
      .select('total_amount')
      .eq('manager_name', managerName)
      .gte('payment_date', iso(monthStart))
      .lt('payment_date', iso(monthEnd)),
    collectDay(baseDay, managerName),
    collectDay(prevDay, managerName),
  ])

  const totalInquiries = inqAll.count ?? 0
  const registrations = regAll.count ?? 0
  const registrationRate =
    totalInquiries > 0 ? (registrations / totalInquiries) * 100 : 0
  const salesThisMonth = (salesMonth.data ?? []).reduce(
    (s, r) => s + Number(r.total_amount ?? 0),
    0,
  )

  return NextResponse.json({
    managerName,
    totalInquiries,
    registrations,
    registrationRate: Math.round(registrationRate * 10) / 10,
    salesThisMonth,
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
