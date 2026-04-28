import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface AdCostPutBody {
  channel: string
  year_month: string  // 'YYYY-MM'
  ad_cost: number
  division?: string   // 'nms' | 'cert' | 'abroad' (default: 'nms')
}

function isValidYearMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value)
}

export async function PUT(request: NextRequest) {
  try {
    const { errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const body: AdCostPutBody = await request.json()
    const { channel, year_month, ad_cost } = body
    const division = body.division ?? 'nms'

    if (!channel || typeof channel !== 'string' || channel.trim() === '') {
      return NextResponse.json({ error: 'channel은 필수입니다.' }, { status: 400 })
    }
    if (!year_month || !isValidYearMonth(year_month)) {
      return NextResponse.json({ error: 'year_month는 YYYY-MM 형식이어야 합니다.' }, { status: 400 })
    }
    if (typeof ad_cost !== 'number' || isNaN(ad_cost) || ad_cost < 0) {
      return NextResponse.json({ error: 'ad_cost는 0 이상의 숫자여야 합니다.' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('marketing_ad_costs')
      .upsert(
        {
          channel: channel.trim(),
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
