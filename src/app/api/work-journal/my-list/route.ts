import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// timestamptz/date 값을 KST(+9) 기준 날짜(YYYY-MM-DD)로 변환
function bucketDate(v: unknown): string {
  if (!v) return ''
  const s = String(v)
  if (s.length <= 10) return s.slice(0, 10) // 이미 date 타입
  const t = Date.parse(s)
  if (Number.isNaN(t)) return s.slice(0, 10)
  return new Date(t + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

// GET /api/work-journal/my-list?from=YYYY-MM-DD&to=YYYY-MM-DD
//  - 로그인한 본인의 작업일지 목록을 기간으로 조회 (최신순)
//  - 각 일자별 본인 담당 통계(등록건수/등록률/매출)도 함께 계산해서 반환
//  - 목록에서 바로 펼쳐볼 수 있도록 일지 본문(jsonb)까지 포함
export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const sp = request.nextUrl.searchParams
  const from = sp.get('from')
  const to = sp.get('to')

  let query = supabaseAdmin
    .from('work_journals')
    .select(
      'id, date, tasks, morning, afternoon, tomorrow, weekly_goal, issues, practicum, status, submitted_at, updated_at',
    )
    .eq('user_id', appUser.id)
    .order('date', { ascending: false })

  if (from && ISO_DATE_RE.test(from)) query = query.gte('date', from)
  if (to && ISO_DATE_RE.test(to)) query = query.lte('date', to)

  const { data, error } = await query.limit(400)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const journals = (data ?? []) as { date: string }[]
  const managerName = appUser.display_name ?? ''

  // 통계 집계 범위 (필터 우선, 없으면 일지 최소~최대 날짜)
  let rangeFrom = from && ISO_DATE_RE.test(from) ? from : null
  let rangeTo = to && ISO_DATE_RE.test(to) ? to : null
  if (journals.length > 0) {
    const dates = journals.map((j) => j.date).filter(Boolean).sort()
    if (!rangeFrom) rangeFrom = dates[0]
    if (!rangeTo) rangeTo = dates[dates.length - 1]
  }

  // 일자별 통계 맵
  const statMap = new Map<string, { inq: number; reg: number; sales: number }>()
  const ensure = (d: string) => {
    let s = statMap.get(d)
    if (!s) {
      s = { inq: 0, reg: 0, sales: 0 }
      statMap.set(d, s)
    }
    return s
  }

  if (managerName && rangeFrom && rangeTo) {
    const startTs = `${rangeFrom}T00:00:00+09:00`
    const endTs = `${addDaysIso(rangeTo, 1)}T00:00:00+09:00`
    const [inqRes, regRes, salesRes] = await Promise.all([
      supabaseAdmin
        .from('hakjeom_consultations')
        .select('created_at')
        .eq('manager', managerName)
        .gte('created_at', startTs)
        .lt('created_at', endTs),
      supabaseAdmin
        .from('edu_students')
        .select('registered_at')
        .eq('manager_name', managerName)
        .gte('registered_at', startTs)
        .lt('registered_at', endTs),
      supabaseAdmin
        .from('edu_sales')
        .select('payment_date,total_amount')
        .eq('manager_name', managerName)
        .gte('payment_date', rangeFrom)
        .lt('payment_date', addDaysIso(rangeTo, 1)),
    ])

    for (const r of inqRes.data ?? []) {
      const d = bucketDate((r as { created_at: unknown }).created_at)
      if (d) ensure(d).inq++
    }
    for (const r of regRes.data ?? []) {
      const d = bucketDate((r as { registered_at: unknown }).registered_at)
      if (d) ensure(d).reg++
    }
    for (const r of salesRes.data ?? []) {
      const row = r as { payment_date: unknown; total_amount: unknown }
      const d = bucketDate(row.payment_date)
      if (d) ensure(d).sales += Number(row.total_amount ?? 0)
    }
  }

  const rows = (data ?? []).map((j) => {
    const s = statMap.get((j as { date: string }).date) ?? {
      inq: 0,
      reg: 0,
      sales: 0,
    }
    const rate = s.inq > 0 ? (s.reg / s.inq) * 100 : 0
    return {
      ...j,
      inquiries: s.inq,
      registrations: s.reg,
      registrationRate: rate,
      sales: s.sales,
    }
  })

  return NextResponse.json({ userId: appUser.id, journals: rows })
}
