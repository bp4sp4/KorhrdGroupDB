import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/work-journal/practicum?date=YYYY-MM-DD
// 실습팀 전용 — 해당 날짜가 속한 주의 월~금 연계 수치를 본인 기준으로 집계해 반환.
// 응답: { days: [{date, dow, institution, eduCenter, total}], totals: {institution, eduCenter, total} }

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DOW_KO = ['일', '월', '화', '수', '목', '금', '토']

type Practicum = { institution: number; eduCenter: number }

function num(v: unknown): number {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n > 0 ? n : 0
}

// 주어진 날짜(YYYY-MM-DD)가 속한 주의 월요일 (UTC 정오 기준으로 안전 계산)
function mondayOf(date: string): Date {
  const d = new Date(`${date}T12:00:00Z`)
  const dow = d.getUTCDay() // 0=일
  const offset = dow === 0 ? -6 : 1 - dow
  d.setUTCDate(d.getUTCDate() + offset)
  return d
}

function fmt(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const date = request.nextUrl.searchParams.get('date')
  if (!date || !ISO_DATE_RE.test(date)) {
    return NextResponse.json({ error: 'date(YYYY-MM-DD)가 필요합니다.' }, { status: 400 })
  }

  const monday = mondayOf(date)
  // 월~금 5일 날짜 목록
  const weekDates: string[] = []
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + i)
    weekDates.push(fmt(d))
  }
  const monStr = weekDates[0]
  const friStr = weekDates[4]

  const { data, error } = await supabaseAdmin
    .from('work_journals')
    .select('date, practicum')
    .eq('user_id', appUser.id)
    .gte('date', monStr)
    .lte('date', friStr)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // date → practicum 매핑
  const byDate: Record<string, Practicum> = {}
  for (const row of data ?? []) {
    const p = row.practicum as Record<string, unknown> | null
    byDate[row.date] = {
      institution: num(p?.institution),
      eduCenter: num(p?.eduCenter),
    }
  }

  const days = weekDates.map((d) => {
    const p = byDate[d] ?? { institution: 0, eduCenter: 0 }
    const dow = DOW_KO[new Date(`${d}T12:00:00Z`).getUTCDay()]
    return {
      date: d,
      dow,
      institution: p.institution,
      eduCenter: p.eduCenter,
      total: p.institution + p.eduCenter,
    }
  })

  const totals = days.reduce(
    (acc, d) => ({
      institution: acc.institution + d.institution,
      eduCenter: acc.eduCenter + d.eduCenter,
      total: acc.total + d.total,
    }),
    { institution: 0, eduCenter: 0, total: 0 },
  )

  return NextResponse.json({ days, totals })
}
