import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { nmsAdmin } from '@/lib/supabase/nms'
import { requireAuth } from '@/lib/auth/requireAuth'

// 최근 N개월 3사업부 통합 월별 매출 통계
// GET /api/management/sales-stats?months=6
export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const sp = request.nextUrl.searchParams
  const months = Math.min(parseInt(sp.get('months') ?? '6'), 12)

  // 조회 범위: 최근 N개월
  const now = new Date()
  const ranges: { year: number; month: number; label: string }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    ranges.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${d.getMonth() + 1}월`,
    })
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  const rangeStart = `${ranges[0].year}-${pad(ranges[0].month)}-01T00:00:00+09:00`
  const lastRange = ranges[ranges.length - 1]
  const lastDay = new Date(lastRange.year, lastRange.month, 0).getDate()
  const rangeEnd = `${lastRange.year}-${pad(lastRange.month)}-${pad(lastDay)}T23:59:59+09:00`

  // 월 키 계산 헬퍼
  const monthKey = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${d.getMonth() + 1}`
  }

  // 3사업부 동시 조회
  const [nmsRes, certRes, abroadRes] = await Promise.allSettled([
    nmsAdmin
      .from('customers')
      .select('payment_amount, created_at')
      .eq('status', '등록완료')
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd),
    supabaseAdmin
      .from('certificate_applications')
      .select('amount, created_at')
      .eq('payment_status', 'paid')
      .eq('source', 'bridge')
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd)
      .is('deleted_at', null),
    supabaseAdmin
      .from('payments')
      .select('amount, created_at')
      .eq('status', 'completed')
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd),
  ])

  // 월별 집계 초기화
  const monthly: Record<string, { label: string; nms: number; cert: number; abroad: number }> = {}
  for (const r of ranges) {
    const key = `${r.year}-${r.month}`
    monthly[key] = { label: r.label, nms: 0, cert: 0, abroad: 0 }
  }

  // NMS
  if (nmsRes.status === 'fulfilled' && nmsRes.value.data) {
    for (const row of nmsRes.value.data) {
      const k = monthKey(row.created_at)
      if (monthly[k]) monthly[k].nms += row.payment_amount || 0
    }
  }

  // 민간자격증
  if (certRes.status === 'fulfilled' && certRes.value.data) {
    for (const row of certRes.value.data) {
      const k = monthKey(row.created_at)
      if (monthly[k]) monthly[k].cert += row.amount || 0
    }
  }

  // 유학
  if (abroadRes.status === 'fulfilled' && abroadRes.value.data) {
    for (const row of abroadRes.value.data) {
      const k = monthKey(row.created_at)
      if (monthly[k]) monthly[k].abroad += row.amount || 0
    }
  }

  const result = Object.entries(monthly).map(([key, v]) => ({
    key,
    label: v.label,
    nms: v.nms,
    cert: v.cert,
    abroad: v.abroad,
    total: v.nms + v.cert + v.abroad,
  }))

  return NextResponse.json({ months: result })
}
