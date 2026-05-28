import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import {
  canAccessWorkJournalAdmin,
  getAccessibleUserIds,
} from '@/lib/auth/divisionAdmin'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/work-journal/admin/list?date=YYYY-MM-DD
//
// 관리자(master-admin/admin) 또는 부서 관리자(is_division_admin) 가 호출:
//   - 접근 가능한 사용자들(전사 또는 같은 부서) 의 해당 일자 통계 + 업무일지 상태 반환
//   - 헤더 KPI 합계도 같이 (전체문의/등록건수/등록률/매출 + 전일대비)
//
// 응답:
// {
//   scope: 'all' | 'division',
//   header: { totalInquiries, registrations, registrationRate, sales,
//             delta: { inquiries, registrations, rate, sales } },
//   rows: [{
//     user_id, display_name, position_name, department_name,
//     total_inquiries, registrations, registration_rate, sales,
//     journal_status: 'submitted' | 'draft' | 'none',
//     journal_updated_after_submit: boolean
//   }]
// }

function previousBusinessDay(d: Date): Date {
  const r = new Date(d)
  do {
    r.setDate(r.getDate() - 1)
  } while (r.getDay() === 0 || r.getDay() === 6)
  return r
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface UserRow {
  id: number
  display_name: string | null
  position_id: string | null
  department_id: string | null
}

// 한 사용자의 특정 일자 stats — work-journal/stats 의 collectDay 와 동일 로직
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

// 누적 stats (전체 기간)
async function collectCumulative(managerName: string) {
  const [inqAll, regAll] = await Promise.all([
    supabaseAdmin
      .from('hakjeom_consultations')
      .select('id', { count: 'exact', head: true })
      .eq('manager', managerName),
    supabaseAdmin
      .from('edu_students')
      .select('id', { count: 'exact', head: true })
      .eq('manager_name', managerName),
  ])
  const totalInquiries = inqAll.count ?? 0
  const registrations = regAll.count ?? 0
  const registrationRate =
    totalInquiries > 0 ? (registrations / totalInquiries) * 100 : 0
  return { totalInquiries, registrations, registrationRate }
}

// 이번 달 매출
async function collectMonthSales(managerName: string, year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const monthStart = `${year}-${pad(month)}-01`
  const monthEnd = `${year}-${pad(month + 1)}-01`
  const { data } = await supabaseAdmin
    .from('edu_sales')
    .select('total_amount')
    .eq('manager_name', managerName)
    .gte('payment_date', monthStart)
    .lt('payment_date', monthEnd)
  return (data ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0)
}

export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  if (!canAccessWorkJournalAdmin(appUser)) {
    return NextResponse.json(
      { error: '관리자 권한이 필요합니다.' },
      { status: 403 },
    )
  }

  const sp = request.nextUrl.searchParams
  const dateStr = sp.get('date')
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json(
      { error: 'date(YYYY-MM-DD)가 필요합니다.' },
      { status: 400 },
    )
  }
  const [yy, mm, dd] = dateStr.split('-').map(Number)
  const baseDay = new Date(yy, mm - 1, dd)
  const prevDay = previousBusinessDay(baseDay)

  // 접근 가능한 사용자 목록
  const { scope, userIds } = await getAccessibleUserIds(appUser)
  if (userIds.length === 0) {
    return NextResponse.json({
      scope,
      header: {
        totalInquiries: 0,
        registrations: 0,
        registrationRate: 0,
        sales: 0,
        delta: { inquiries: 0, registrations: 0, rate: 0, sales: 0 },
      },
      rows: [],
    })
  }

  // 사용자 + 부서/직급 정보
  const { data: users } = await supabaseAdmin
    .from('app_users')
    .select('id, display_name, position_id, department_id')
    .in('id', userIds)
    .eq('is_active', true)
    .order('display_name', { ascending: true })

  const positionIds = Array.from(
    new Set(((users ?? []) as UserRow[]).map((u) => u.position_id).filter(Boolean) as string[]),
  )
  const departmentIds = Array.from(
    new Set(((users ?? []) as UserRow[]).map((u) => u.department_id).filter(Boolean) as string[]),
  )

  const [positionsRes, departmentsRes] = await Promise.all([
    positionIds.length > 0
      ? supabaseAdmin.from('positions').select('id, name').in('id', positionIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    departmentIds.length > 0
      ? supabaseAdmin.from('departments').select('id, name').in('id', departmentIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])
  const positionMap = new Map<string, string>(
    (positionsRes.data ?? []).map((p) => [p.id as string, p.name as string]),
  )
  const departmentMap = new Map<string, string>(
    (departmentsRes.data ?? []).map((d) => [d.id as string, d.name as string]),
  )

  // 해당 일자 work_journals 일괄 조회 (1쿼리)
  const { data: journals } = await supabaseAdmin
    .from('work_journals')
    .select('user_id, status, submitted_at, updated_at')
    .in('user_id', userIds)
    .eq('date', dateStr)

  const journalMap = new Map<
    number,
    { status: string; submitted_at: string | null; updated_at: string }
  >()
  for (const j of journals ?? []) {
    journalMap.set(j.user_id as number, {
      status: (j.status as string) ?? 'draft',
      submitted_at: (j.submitted_at as string | null) ?? null,
      updated_at: (j.updated_at as string) ?? '',
    })
  }

  // 사용자별 통계 (병렬)
  const rows = await Promise.all(
    ((users ?? []) as UserRow[]).map(async (u) => {
      const name = (u.display_name ?? '').trim()
      const j = journalMap.get(u.id)
      const journalStatus: 'submitted' | 'draft' | 'none' = j
        ? (j.status === 'submitted' ? 'submitted' : 'draft')
        : 'none'
      // 제출 후 다시 수정된 케이스 — updated_at > submitted_at
      const editedAfterSubmit =
        j?.submitted_at != null &&
        j.updated_at !== '' &&
        new Date(j.updated_at).getTime() > new Date(j.submitted_at).getTime() + 1000

      if (!name) {
        return {
          user_id: u.id,
          display_name: u.display_name ?? '',
          position_name: positionMap.get(u.position_id ?? '') ?? null,
          department_name: departmentMap.get(u.department_id ?? '') ?? null,
          total_inquiries: 0,
          registrations: 0,
          registration_rate: 0,
          sales: 0,
          journal_status: journalStatus,
          journal_updated_after_submit: editedAfterSubmit,
        }
      }
      const [cum, monthSales] = await Promise.all([
        collectCumulative(name),
        collectMonthSales(name, baseDay.getFullYear(), baseDay.getMonth() + 1),
      ])
      return {
        user_id: u.id,
        display_name: u.display_name ?? '',
        position_name: positionMap.get(u.position_id ?? '') ?? null,
        department_name: departmentMap.get(u.department_id ?? '') ?? null,
        total_inquiries: cum.totalInquiries,
        registrations: cum.registrations,
        registration_rate: Math.round(cum.registrationRate * 10) / 10,
        sales: monthSales,
        journal_status: journalStatus,
        journal_updated_after_submit: editedAfterSubmit,
      }
    }),
  )

  // 헤더 KPI = 사용자 합계 + 전일대비 (base vs prev 의 합계 차)
  const baseStats = await Promise.all(
    ((users ?? []) as UserRow[]).map((u) =>
      collectDay(baseDay, (u.display_name ?? '').trim()),
    ),
  )
  const prevStats = await Promise.all(
    ((users ?? []) as UserRow[]).map((u) =>
      collectDay(prevDay, (u.display_name ?? '').trim()),
    ),
  )

  const baseSum = baseStats.reduce(
    (acc, s) => ({
      inquiries: acc.inquiries + s.inquiries,
      registrations: acc.registrations + s.registrations,
      sales: acc.sales + s.sales,
    }),
    { inquiries: 0, registrations: 0, sales: 0 },
  )
  const prevSum = prevStats.reduce(
    (acc, s) => ({
      inquiries: acc.inquiries + s.inquiries,
      registrations: acc.registrations + s.registrations,
      sales: acc.sales + s.sales,
    }),
    { inquiries: 0, registrations: 0, sales: 0 },
  )

  const headerTotalInquiries = rows.reduce((s, r) => s + r.total_inquiries, 0)
  const headerRegistrations = rows.reduce((s, r) => s + r.registrations, 0)
  const headerSales = rows.reduce((s, r) => s + r.sales, 0)
  const headerRate =
    headerTotalInquiries > 0
      ? Math.round((headerRegistrations / headerTotalInquiries) * 1000) / 10
      : 0
  const baseRate =
    baseSum.inquiries > 0 ? (baseSum.registrations / baseSum.inquiries) * 100 : 0
  const prevRate =
    prevSum.inquiries > 0 ? (prevSum.registrations / prevSum.inquiries) * 100 : 0

  return NextResponse.json({
    scope,
    header: {
      totalInquiries: headerTotalInquiries,
      registrations: headerRegistrations,
      registrationRate: headerRate,
      sales: headerSales,
      delta: {
        inquiries: baseSum.inquiries - prevSum.inquiries,
        registrations: baseSum.registrations - prevSum.registrations,
        rate: Math.round((baseRate - prevRate) * 10) / 10,
        sales: baseSum.sales - prevSum.sales,
      },
    },
    rows,
  })
}
