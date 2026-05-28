import { NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/dashboard/today-inquiry-sources
// 오늘(KST) 등록된 문의(hakjeom_consultations) 중 **본인이 담당자(manager)인 것** 만 집계:
//   - company: manager=본인 AND major != "지인소개"(개인마케팅) → major 별 카운트
//   - direct : manager=본인 AND major == "지인소개"(개인마케팅) → minor 별 카운트
//
// 담당 배정이 없는 사용자(예: 개발본부) 는 양쪽 모두 0건.
//
// 응답:
// {
//   company: [{ name: string, count: number }, ...],
//   direct : [{ name: string, count: number }, ...]
// }

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

function todayKstRangeUtc(): { startIso: string; endIso: string } {
  const now = new Date()
  const kst = new Date(now.getTime() + KST_OFFSET_MS)
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kst.getUTCDate()).padStart(2, '0')
  // KST 00:00:00 ~ 23:59:59.999 → UTC 변환
  const startIso = new Date(`${y}-${m}-${d}T00:00:00+09:00`).toISOString()
  const endIso = new Date(`${y}-${m}-${d}T23:59:59.999+09:00`).toISOString()
  return { startIso, endIso }
}

// click_source 에서 major / minor 분리
function parseSource(src: string | null): { major: string; minor: string } {
  if (!src) return { major: '', minor: '' }
  const stripped = src.startsWith('바로폼_') ? src.slice(4) : src
  const idx = stripped.indexOf('_')
  if (idx === -1) return { major: stripped, minor: '' }
  return { major: stripped.slice(0, idx), minor: stripped.slice(idx + 1) }
}

const PERSONAL_MARKETING_KEY = '지인소개'

export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const displayName = appUser.display_name?.trim()
  if (!displayName) {
    // 이름이 없으면 매칭 불가 → 빈 응답
    return NextResponse.json({ company: [], direct: [] })
  }

  const { startIso, endIso } = todayKstRangeUtc()

  // 본인이 담당자(manager)인 오늘자 문의만 조회
  const { data, error } = await supabaseAdmin
    .from('hakjeom_consultations')
    .select('click_source')
    .eq('manager', displayName)
    .gte('created_at', startIso)
    .lte('created_at', endIso)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const companyMap = new Map<string, number>()
  const directMap = new Map<string, number>()

  for (const row of data ?? []) {
    const { major, minor } = parseSource(row.click_source as string | null)

    if (major === PERSONAL_MARKETING_KEY) {
      // 직접유입: minor 별 카운트 (minor 비어있으면 "미지정")
      const key = minor || '미지정'
      directMap.set(key, (directMap.get(key) ?? 0) + 1)
    } else {
      // 회사배정: 개인마케팅 외 모든 major
      const key = major || '기타'
      companyMap.set(key, (companyMap.get(key) ?? 0) + 1)
    }
  }

  const toSorted = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

  return NextResponse.json(
    {
      company: toSorted(companyMap),
      direct: toSorted(directMap),
    },
    {
      headers: {
        'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=120',
      },
    },
  )
}
