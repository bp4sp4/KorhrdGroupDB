import { NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// GET /api/dashboard/registration-ranking
// 당월(KST) 담당자별 등록률 랭킹.
//   - 분모(totalInquiries): hakjeom_consultations (manager=담당자, created_at=당월)
//   - 분자(registrations):  edu_students         (manager_name=담당자, registered_at=당월)
//   - rate = registrations / totalInquiries * 100   (work-journal collectMonth 와 동일 정의)
// 담당 문의가 1건 이상인 담당자만 포함. 이규준은 랭킹에서 제외.
//
// 응답: { year, month, ranking: [{ name, total, registrations, rate }] }  (rate 내림차순)

const EXCLUDED_MANAGERS = new Set(['이규준'])

export async function GET() {
  const { errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  // 현재 KST 연/월
  const nowKst = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }),
  )
  const year = nowKst.getFullYear()
  const month = nowKst.getMonth() + 1 // 1-12
  const pad = (n: number) => String(n).padStart(2, '0')
  const monthStart = `${year}-${pad(month)}-01`
  const monthEnd =
    month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`

  const [inqRes, regRes] = await Promise.all([
    supabaseAdmin
      .from('hakjeom_consultations')
      .select('manager')
      .gte('created_at', `${monthStart}T00:00:00+09:00`)
      .lt('created_at', `${monthEnd}T00:00:00+09:00`)
      .not('manager', 'is', null)
      .is('deleted_at', null)
      .limit(100000),
    supabaseAdmin
      .from('edu_students')
      .select('manager_name')
      .gte('registered_at', `${monthStart}T00:00:00+09:00`)
      .lt('registered_at', `${monthEnd}T00:00:00+09:00`)
      .not('manager_name', 'is', null)
      .limit(100000),
  ])

  if (inqRes.error || regRes.error) {
    return NextResponse.json(
      { error: inqRes.error?.message ?? regRes.error?.message },
      { status: 500 },
    )
  }

  const totals = new Map<string, number>()
  for (const r of inqRes.data ?? []) {
    const name = String((r as { manager: string | null }).manager ?? '').trim()
    if (!name || EXCLUDED_MANAGERS.has(name)) continue
    totals.set(name, (totals.get(name) ?? 0) + 1)
  }

  const regs = new Map<string, number>()
  for (const r of regRes.data ?? []) {
    const name = String(
      (r as { manager_name: string | null }).manager_name ?? '',
    ).trim()
    if (!name || EXCLUDED_MANAGERS.has(name)) continue
    regs.set(name, (regs.get(name) ?? 0) + 1)
  }

  const ranking = Array.from(totals.entries())
    .map(([name, total]) => {
      const registrations = regs.get(name) ?? 0
      const rate = total > 0 ? (registrations / total) * 100 : 0
      return { name, total, registrations, rate }
    })
    .sort(
      (a, b) =>
        b.rate - a.rate ||
        b.registrations - a.registrations ||
        a.name.localeCompare(b.name, 'ko'),
    )

  return NextResponse.json(
    { year, month, ranking },
    {
      headers: {
        'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=120',
      },
    },
  )
}
