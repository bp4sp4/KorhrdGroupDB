import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import {
  canAccessWorkJournalAdmin,
  getAccessibleUserIds,
} from '@/lib/auth/divisionAdmin'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCalendarWeekIndex } from '@/lib/dashboard/weekOfMonth'

// GET /api/work-journal/admin/detail?user_id=N&date=YYYY-MM-DD
//
// 관리자 화면에서 특정 사용자의 일자별 디테일 (모달) 데이터.
//
// 응답:
// {
//   user: { id, display_name, position_name, department_name },
//   journal: { morning, afternoon, tomorrow, tasks, status, submitted_at, updated_at } | null,
//   stats: { totalInquiries, registrations, registrationRate, salesThisMonth,
//            delta: { inquiries, registrations, rate, sales } },
//   monthlyGoal: { total, weeks } | null,
//   monthlyAchieved: { total, weeks },
//   inquirySources: { company: [{name,count}], direct: [{name,count}] }
// }

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

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
function todayKstRange(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return {
    startIso: new Date(`${y}-${m}-${d}T00:00:00+09:00`).toISOString(),
    endIso: new Date(`${y}-${m}-${d}T23:59:59.999+09:00`).toISOString(),
  }
}

function parseSource(src: string | null): { major: string; minor: string } {
  if (!src) return { major: '', minor: '' }
  const stripped = src.startsWith('바로폼_') ? src.slice(4) : src
  const idx = stripped.indexOf('_')
  if (idx === -1) return { major: stripped, minor: '' }
  return { major: stripped.slice(0, idx), minor: stripped.slice(idx + 1) }
}

const PERSONAL_MARKETING_KEY = '지인소개'

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

export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  if (!canAccessWorkJournalAdmin(appUser)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const userIdStr = sp.get('user_id')
  const dateStr = sp.get('date')
  const userId = userIdStr ? parseInt(userIdStr, 10) : NaN
  if (!Number.isFinite(userId) || !dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json(
      { error: 'user_id 와 date(YYYY-MM-DD) 가 필요합니다.' },
      { status: 400 },
    )
  }

  // 권한 검증 — 대상 사용자가 접근 가능한 범위에 있어야 함
  const { userIds: accessible } = await getAccessibleUserIds(appUser)
  if (!accessible.includes(userId)) {
    return NextResponse.json(
      { error: '해당 사용자를 조회할 권한이 없습니다.' },
      { status: 403 },
    )
  }

  // 대상 사용자 정보 + 팀 (양식 분기용)
  const { data: targetUser } = await supabaseAdmin
    .from('app_users')
    .select('id, display_name, position_id, department_id, team_id')
    .eq('id', userId)
    .maybeSingle()
  if (!targetUser) {
    return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
  }

  let teamJournalForm: 'default' | 'academic' | 'practicum' = 'default'
  if (targetUser.team_id) {
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('journal_form')
      .eq('id', targetUser.team_id)
      .maybeSingle()
    if (team?.journal_form === 'academic') teamJournalForm = 'academic'
    else if (team?.journal_form === 'practicum') teamJournalForm = 'practicum'
  }

  const [positionRes, departmentRes] = await Promise.all([
    targetUser.position_id
      ? supabaseAdmin
          .from('positions')
          .select('name')
          .eq('id', targetUser.position_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { name: string } | null }),
    targetUser.department_id
      ? supabaseAdmin
          .from('departments')
          .select('name')
          .eq('id', targetUser.department_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { name: string } | null }),
  ])

  const displayName = (targetUser.display_name ?? '').trim()
  const [yy, mm, dd] = dateStr.split('-').map(Number)
  const baseDay = new Date(yy, mm - 1, dd)
  const prevDay = previousBusinessDay(baseDay)
  const monthKey = `${yy}-${String(mm).padStart(2, '0')}`

  // 1) 일지 본문
  const { data: journal } = await supabaseAdmin
    .from('work_journals')
    .select('morning, afternoon, tomorrow, tasks, issues, practicum, status, submitted_at, updated_at')
    .eq('user_id', userId)
    .eq('date', dateStr)
    .maybeSingle()

  // 2) stats — 누적 + 이번달 매출 + 전일대비 + 해당일 신규완료/가망 (display_name 없으면 빈값)
  let stats = {
    totalInquiries: 0,
    registrations: 0,
    registrationRate: 0,
    salesThisMonth: 0,
    completedNew: 0,
    pendingNew: 0,
    scheduledContacts: 0,
    scheduledDone: 0,
    delta: { inquiries: 0, registrations: 0, rate: 0, sales: 0 },
  }
  if (displayName) {
    const monthStart = `${yy}-${String(mm).padStart(2, '0')}-01`
    const monthEnd = `${yy}-${String(mm + 1).padStart(2, '0')}-01`
    const dayStartISO = `${iso(baseDay)}T00:00:00+09:00`
    const dayNext = new Date(baseDay)
    dayNext.setDate(dayNext.getDate() + 1)
    const dayEndISO = `${iso(dayNext)}T00:00:00+09:00`
    // 문의/등록도 당월 기준 (매월 1일에 자동 초기화)
    const [
      inqMonth,
      regMonth,
      monthSalesRes,
      base,
      prev,
      completedRes,
      pendingRes,
      schedRes,
    ] = await Promise.all([
      supabaseAdmin
        .from('hakjeom_consultations')
        .select('id', { count: 'exact', head: true })
        .eq('manager', displayName)
        .gte('created_at', `${monthStart}T00:00:00+09:00`)
        .lt('created_at', `${monthEnd}T00:00:00+09:00`),
      supabaseAdmin
        .from('edu_students')
        .select('id', { count: 'exact', head: true })
        .eq('manager_name', displayName)
        .gte('registered_at', `${monthStart}T00:00:00+09:00`)
        .lt('registered_at', `${monthEnd}T00:00:00+09:00`),
      supabaseAdmin
        .from('edu_sales')
        .select('total_amount')
        .eq('manager_name', displayName)
        .gte('payment_date', monthStart)
        .lt('payment_date', monthEnd),
      collectDay(baseDay, displayName),
      collectDay(prevDay, displayName),
      // 해당일 신규 상담완료 (counsel_completed_at)
      supabaseAdmin
        .from('hakjeom_consultations')
        .select('id', { count: 'exact', head: true })
        .eq('manager', displayName)
        .gte('counsel_completed_at', dayStartISO)
        .lt('counsel_completed_at', dayEndISO),
      // 신규 배정(상담대기) — 분모 (현재 스냅샷)
      supabaseAdmin
        .from('hakjeom_consultations')
        .select('id', { count: 'exact', head: true })
        .eq('manager', displayName)
        .eq('status', '상담대기')
        .is('deleted_at', null),
      // 해당일 연락 예정 (contact_scheduled_at) — 분모. id 목록까지 받아 가망관리 처리분 계산에 사용
      supabaseAdmin
        .from('hakjeom_consultations')
        .select('id')
        .eq('manager', displayName)
        .gte('contact_scheduled_at', dayStartISO)
        .lt('contact_scheduled_at', dayEndISO),
    ])

    // 해당일 가망관리 처리분 — 오늘 연락예정 건 중, 오늘 메모(연락 기록)가 추가된 건수.
    // (상담완료 status 는 메모 작성 시 counsel_completed_at 가 초기화되어 카운트가 어긋나므로 메모 기준으로 판정)
    const schedIds = (schedRes.data ?? []).map((r) => String(r.id))
    let scheduledDoneCount = 0
    if (schedIds.length > 0) {
      const { data: memoRows } = await supabaseAdmin
        .from('memo_logs')
        .select('record_id')
        .eq('table_name', 'hakjeom_consultations')
        .in('record_id', schedIds)
        .gte('created_at', dayStartISO)
        .lt('created_at', dayEndISO)
      scheduledDoneCount = new Set((memoRows ?? []).map((m) => m.record_id)).size
    }
    const totalInquiries = inqMonth.count ?? 0
    const registrations = regMonth.count ?? 0
    const registrationRate =
      totalInquiries > 0 ? (registrations / totalInquiries) * 100 : 0
    const salesThisMonth = (monthSalesRes.data ?? []).reduce(
      (s, r) => s + Number(r.total_amount ?? 0),
      0,
    )
    stats = {
      totalInquiries,
      registrations,
      registrationRate: Math.round(registrationRate * 10) / 10,
      salesThisMonth,
      completedNew: completedRes.count ?? 0,
      pendingNew: pendingRes.count ?? 0,
      scheduledContacts: schedIds.length,
      scheduledDone: scheduledDoneCount,
      delta: {
        inquiries: base.inquiries - prev.inquiries,
        registrations: base.registrations - prev.registrations,
        rate: Math.round((base.rate - prev.rate) * 10) / 10,
        sales: base.sales - prev.sales,
      },
    }
  }

  // 3) 월 목표 + 실 매출 주차별
  let monthlyGoal: { total: number; weeks: number[] } | null = null
  {
    const { data: g } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', `dashboard.monthly_goal.${userId}.${monthKey}`)
      .maybeSingle()
    const v = g?.value as unknown
    if (
      v &&
      typeof v === 'object' &&
      typeof (v as { total?: unknown }).total === 'number' &&
      Array.isArray((v as { weeks?: unknown }).weeks) &&
      (v as { weeks: unknown[] }).weeks.length === 5 &&
      (v as { weeks: unknown[] }).weeks.every((n) => typeof n === 'number')
    ) {
      monthlyGoal = v as { total: number; weeks: number[] }
    }
  }

  // 주차별 실 매출 — display_name 으로 매칭
  const weeks = [0, 0, 0, 0, 0]
  let achievedTotalWon = 0
  if (displayName) {
    const monthStart = `${yy}-${String(mm).padStart(2, '0')}-01`
    const lastDay = new Date(yy, mm, 0).getDate()
    const monthEnd = `${yy}-${String(mm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const pickNumber = (
      base:
        | Record<string, unknown>
        | Record<string, unknown>[]
        | null
        | undefined,
      field: string,
    ): number => {
      const row = Array.isArray(base) ? base[0] : base
      const v = row?.[field]
      return typeof v === 'number' ? v : Number(v) || 0
    }
    const accumulate = (
      rows:
        | {
            total_amount: number | null
            payment_date: string | null
            [k: string]: unknown
          }[]
        | null,
      fk: string,
      ff: string,
    ) => {
      if (!rows) return
      for (const r of rows) {
        const overlay = Number(r.total_amount) || 0
        const fallback =
          overlay > 0
            ? 0
            : pickNumber(
                r[fk] as Record<string, unknown> | Record<string, unknown>[] | null | undefined,
                ff,
              )
        const amt = overlay > 0 ? overlay : fallback
        if (amt <= 0 || !r.payment_date) continue
        achievedTotalWon += amt
        const day = parseInt(r.payment_date.slice(8, 10), 10)
        if (!day) continue
        const idx = getCalendarWeekIndex(yy, mm, day)
        weeks[idx] += amt
      }
    }

    const [certRes, eduRes, pracRes] = await Promise.allSettled([
      supabaseAdmin
        .from('cert_sales')
        .select('total_amount, payment_date, certificate_applications(amount)')
        .eq('manager_name', displayName)
        .gte('payment_date', monthStart)
        .lte('payment_date', monthEnd)
        .eq('is_hidden', false),
      supabaseAdmin
        .from('edu_sales')
        .select('total_amount, payment_date, edu_students(cost)')
        .eq('manager_name', displayName)
        .gte('payment_date', monthStart)
        .lte('payment_date', monthEnd),
      supabaseAdmin
        .from('practice_sales')
        .select('total_amount, payment_date, practice_applications(payment_amount)')
        .eq('manager_name', displayName)
        .gte('payment_date', monthStart)
        .lte('payment_date', monthEnd),
    ])
    if (certRes.status === 'fulfilled' && !certRes.value.error)
      accumulate(certRes.value.data as never, 'certificate_applications', 'amount')
    if (eduRes.status === 'fulfilled' && !eduRes.value.error)
      accumulate(eduRes.value.data as never, 'edu_students', 'cost')
    if (pracRes.status === 'fulfilled' && !pracRes.value.error)
      accumulate(pracRes.value.data as never, 'practice_applications', 'payment_amount')
  }
  const toManwon = (won: number) => Math.round(won / 10000)

  // 4) 오늘 유입경로 (해당 일자 KST)
  //    "오늘"의 기준은 문의 등록일이 아니라 **이 담당자가 오늘 배정받은** 시점.
  //    hakjeom_consultations.manager_assigned_at 컬럼(트리거 자동 채움) 으로 판정.
  const company: Record<string, number> = {}
  const direct: Record<string, number> = {}
  if (displayName) {
    const { startIso, endIso } = todayKstRange(baseDay)
    void KST_OFFSET_MS // tree-shake guard

    const { data: rows } = await supabaseAdmin
      .from('hakjeom_consultations')
      .select('click_source')
      .eq('manager', displayName)
      .gte('manager_assigned_at', startIso)
      .lte('manager_assigned_at', endIso)
      .is('deleted_at', null)

    for (const r of rows ?? []) {
      const { major, minor } = parseSource(r.click_source as string | null)
      if (major === PERSONAL_MARKETING_KEY) {
        const k = minor || '미지정'
        direct[k] = (direct[k] ?? 0) + 1
      } else {
        const k = major || '기타'
        company[k] = (company[k] ?? 0) + 1
      }
    }
  }
  const toSorted = (m: Record<string, number>) =>
    Object.entries(m)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

  // 학사팀이면 이번주 목표도 fetch (app_settings 의 user.{id}.weekly_goal.{Monday})
  let weeklyGoal:
    | { id: string; date: string; text: string; done: boolean }[]
    | null = null
  if (teamJournalForm === 'academic') {
    // 해당 date 가 속한 주의 월요일 계산
    const d = new Date(`${dateStr}T00:00:00`)
    const dow = d.getDay()
    const offset = dow === 0 ? -6 : 1 - dow
    const monday = new Date(d)
    monday.setDate(d.getDate() + offset)
    const my = monday.getFullYear()
    const mm2 = String(monday.getMonth() + 1).padStart(2, '0')
    const md = String(monday.getDate()).padStart(2, '0')
    const weekKey = `user.${userId}.weekly_goal.${my}-${mm2}-${md}`
    const { data: setting } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', weekKey)
      .maybeSingle()
    const v = setting?.value
    if (Array.isArray(v)) {
      weeklyGoal = v
        .map((g) => {
          if (!g || typeof g !== 'object') return null
          const o = g as Record<string, unknown>
          return {
            id: typeof o.id === 'string' ? o.id : String(o.id ?? ''),
            date: typeof o.date === 'string' ? o.date : '',
            text: typeof o.text === 'string' ? o.text : '',
            done: Boolean(o.done),
          }
        })
        .filter(
          (g): g is { id: string; date: string; text: string; done: boolean } =>
            g !== null,
        )
    } else {
      weeklyGoal = []
    }
  }

  // 실습팀이면 그 주(월~금) 연계 수치 합계도 함께 반환
  let practicumWeek:
    | {
        days: { date: string; dow: string; institution: number; eduCenter: number; total: number }[]
        totals: { institution: number; eduCenter: number; total: number }
      }
    | null = null
  if (teamJournalForm === 'practicum') {
    const DOW_KO = ['일', '월', '화', '수', '목', '금', '토']
    const num = (v: unknown) => {
      const n = Math.floor(Number(v))
      return Number.isFinite(n) && n > 0 ? n : 0
    }
    const d = new Date(`${dateStr}T00:00:00`)
    const dow = d.getDay()
    const offset = dow === 0 ? -6 : 1 - dow
    const monday = new Date(d)
    monday.setDate(d.getDate() + offset)
    const fmt = (x: Date) =>
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    const weekDates: string[] = []
    for (let i = 0; i < 5; i++) {
      const x = new Date(monday)
      x.setDate(monday.getDate() + i)
      weekDates.push(fmt(x))
    }
    const { data: weekRows } = await supabaseAdmin
      .from('work_journals')
      .select('date, practicum')
      .eq('user_id', userId)
      .gte('date', weekDates[0])
      .lte('date', weekDates[4])
    const byDate: Record<string, { institution: number; eduCenter: number }> = {}
    for (const row of weekRows ?? []) {
      const p = row.practicum as Record<string, unknown> | null
      byDate[row.date] = { institution: num(p?.institution), eduCenter: num(p?.eduCenter) }
    }
    const days = weekDates.map((dt) => {
      const p = byDate[dt] ?? { institution: 0, eduCenter: 0 }
      return {
        date: dt,
        dow: DOW_KO[new Date(`${dt}T00:00:00`).getDay()],
        institution: p.institution,
        eduCenter: p.eduCenter,
        total: p.institution + p.eduCenter,
      }
    })
    const totals = days.reduce(
      (acc, x) => ({
        institution: acc.institution + x.institution,
        eduCenter: acc.eduCenter + x.eduCenter,
        total: acc.total + x.total,
      }),
      { institution: 0, eduCenter: 0, total: 0 },
    )
    practicumWeek = { days, totals }
  }

  return NextResponse.json({
    user: {
      id: targetUser.id,
      display_name: targetUser.display_name,
      position_name: positionRes.data?.name ?? null,
      department_name: departmentRes.data?.name ?? null,
      team_journal_form: teamJournalForm,
    },
    practicumWeek,
    journal: journal ?? null,
    stats,
    monthlyGoal,
    monthlyAchieved: {
      total: toManwon(achievedTotalWon),
      weeks: weeks.map(toManwon),
    },
    inquirySources: {
      company: toSorted(company),
      direct: toSorted(direct),
    },
    weeklyGoal,
  })
}
