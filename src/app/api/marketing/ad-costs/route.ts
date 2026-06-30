import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isValidWeekStart } from '@/lib/marketing/week'

interface AdCostPutBody {
  channel: string
  year_month?: string  // 'YYYY-MM' (월간 모드)
  week_start?: string  // 'YYYY-MM-DD' 월요일 (주간 모드)
  ad_cost: number
  division?: string   // 'nms' | 'cert' | 'abroad' (default: 'nms')
}

function isValidYearMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value)
}

// 채널명 정규화 (channel-stats 라우트와 동일 규칙)
const META_ALIASES = new Set<string>([
  'meta', '메타', 'facebook', '페이스북', 'instagram', '인스타', '인스타그램',
  '인스타·페이스북', '페이스북·인스타', '인스타/페이스북', '페이스북/인스타',
  '인스타,페이스북', '페이스북,인스타',
])
const PERSONAL_MARKETING_ALIASES = new Set<string>(['지인소개', '개인마케팅'])
const ETC_ALIASES = new Set<string>(['주부'])
function normalizeChannel(raw: string): string {
  const k = raw.trim().toLowerCase()
  if (META_ALIASES.has(k)) return 'meta'
  if (PERSONAL_MARKETING_ALIASES.has(k)) return '개인마케팅'
  if (ETC_ALIASES.has(k)) return '기타'
  return raw.trim()
}

export async function PUT(request: NextRequest) {
  try {
    const { errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const body: AdCostPutBody = await request.json()
    const { channel, year_month, week_start, ad_cost } = body
    const division = body.division ?? 'nms'

    if (!channel || typeof channel !== 'string' || channel.trim() === '') {
      return NextResponse.json({ error: 'channel은 필수입니다.' }, { status: 400 })
    }
    if (typeof ad_cost !== 'number' || isNaN(ad_cost) || ad_cost < 0) {
      return NextResponse.json({ error: 'ad_cost는 0 이상의 숫자여야 합니다.' }, { status: 400 })
    }

    // 주간 모드: week_start(월요일) 가 있으면 주간 테이블에 저장
    if (week_start) {
      if (!isValidWeekStart(week_start)) {
        return NextResponse.json({ error: 'week_start는 YYYY-MM-DD(월요일) 형식이어야 합니다.' }, { status: 400 })
      }
      const { error } = await supabaseAdmin
        .from('marketing_ad_costs_weekly')
        .upsert(
          {
            channel: normalizeChannel(channel),
            week_start,
            ad_cost,
            division,
          },
          { onConflict: 'division,channel,week_start' }
        )
      if (error) {
        console.error('[ad-costs PUT] 주간 upsert 오류:', error)
        return NextResponse.json({ error: '광고비 저장 실패' }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    // 월간 모드
    if (!year_month || !isValidYearMonth(year_month)) {
      return NextResponse.json({ error: 'year_month는 YYYY-MM 형식이어야 합니다.' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('marketing_ad_costs')
      .upsert(
        {
          channel: normalizeChannel(channel),
          year_month,
          ad_cost,
          division,
        },
        { onConflict: 'division,channel,year_month' }
      )

    if (error) {
      console.error('[ad-costs PUT] upsert 오류:', error)
      return NextResponse.json({ error: '광고비 저장 실패' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[ad-costs PUT] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
