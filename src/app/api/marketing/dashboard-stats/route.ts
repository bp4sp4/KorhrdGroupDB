import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Division = 'nms' | 'cert' | 'abroad'

const DIVISION_TABLE: Record<Division, string | null> = {
  nms: 'hakjeom_consultations',
  cert: 'private_cert_consultations',
  abroad: null,
}

interface ConsultationRow {
  click_source: string | null
  status: string
  created_at: string
}

interface CreativeRow {
  id: number
  channel: string
  name: string
  campaign: string | null
  type: string
  thumbnail_path: string | null
  impressions: number
  clicks: number
  db_count: number
  registrations: number
  ad_cost: number
}

export interface DashboardKpi {
  inquiries: number
  prevInquiries: number
  registrations: number
  prevRegistrations: number
  adCost: number
  prevAdCost: number
}

export interface DashboardChannelSlice {
  channel: string
  inquiries: number
  registrations: number
  adCost: number
}

export interface DashboardDailyPoint {
  date: string // YYYY-MM-DD
  inquiries: number
  registrations: number
}

export interface DashboardCreativeTop {
  id: number
  name: string
  channel: string
  thumbnailUrl: string | null
  registrations: number
  adCost: number
  costPerReg: number | null
}

export interface DashboardResponse {
  range: { start: string; end: string }
  kpi: DashboardKpi
  daily: DashboardDailyPoint[]
  channels: DashboardChannelSlice[]
  topChannels: DashboardChannelSlice[]
  topCreatives: DashboardCreativeTop[]
}

const BUCKET = 'marketing-creatives'

function publicUrl(path: string | null): string | null {
  if (!path) return null
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
  return data?.publicUrl ?? null
}

function extractChannel(clickSource: string | null): string {
  if (!clickSource) return '미입력'
  const normalized = clickSource.replace(/^바로폼_/i, '').replace(/^baroform_/i, '')
  const parts = normalized.split('_')
  return parts[0] || '미입력'
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function buildEmptyDaily(start: Date, end: Date): DashboardDailyPoint[] {
  const out: DashboardDailyPoint[] = []
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cur <= last) {
    out.push({ date: formatDate(cur), inquiries: 0, registrations: 0 })
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

function getYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const { searchParams } = new URL(request.url)
    const division = (searchParams.get('division') ?? 'nms') as Division
    const startStr = searchParams.get('start')
    const endStr = searchParams.get('end')

    if (!startStr || !endStr) {
      return NextResponse.json({ error: 'start, end 파라미터가 필요합니다' }, { status: 400 })
    }

    const start = new Date(`${startStr}T00:00:00`)
    const end = new Date(`${endStr}T23:59:59.999`)

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return NextResponse.json({ error: '잘못된 날짜 범위' }, { status: 400 })
    }

    const tableName = DIVISION_TABLE[division]
    if (!tableName) {
      return NextResponse.json({
        range: { start: startStr, end: endStr },
        kpi: { inquiries: 0, prevInquiries: 0, registrations: 0, prevRegistrations: 0, adCost: 0, prevAdCost: 0 },
        daily: buildEmptyDaily(start, end),
        channels: [],
        topChannels: [],
        topCreatives: [],
      } satisfies DashboardResponse)
    }

    // 전월 대비 비교 — 동일 길이로 직전 기간
    const rangeMs = end.getTime() - start.getTime()
    const prevEnd = new Date(start.getTime() - 1)
    const prevStart = new Date(prevEnd.getTime() - rangeMs)

    // 광고비 — 범위 내 모든 month 수집
    const monthsInRange = new Set<string>()
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)
    while (cursor <= endMonth) {
      monthsInRange.add(getYearMonth(cursor))
      cursor.setMonth(cursor.getMonth() + 1)
    }
    const prevMonthsInRange = new Set<string>()
    const pCursor = new Date(prevStart.getFullYear(), prevStart.getMonth(), 1)
    const pEndMonth = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1)
    while (pCursor <= pEndMonth) {
      prevMonthsInRange.add(getYearMonth(pCursor))
      pCursor.setMonth(pCursor.getMonth() + 1)
    }

    const [currRes, prevRes, adCostRes, creativesRes] = await Promise.all([
      supabaseAdmin
        .from(tableName)
        .select('click_source, status, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString()),
      supabaseAdmin
        .from(tableName)
        .select('click_source, status, created_at')
        .gte('created_at', prevStart.toISOString())
        .lte('created_at', prevEnd.toISOString()),
      supabaseAdmin
        .from('marketing_ad_costs')
        .select('channel, ad_cost, year_month, division')
        .in('year_month', [...monthsInRange, ...prevMonthsInRange]),
      supabaseAdmin
        .from('marketing_creatives')
        .select('id, channel, name, campaign, type, thumbnail_path, impressions, clicks, db_count, registrations, ad_cost')
        .eq('division', division),
    ])

    if (currRes.error) {
      console.error('[dashboard-stats] curr error:', currRes.error)
      return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 })
    }
    if (prevRes.error) {
      console.error('[dashboard-stats] prev error:', prevRes.error)
      return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 })
    }
    if (adCostRes.error) {
      console.error('[dashboard-stats] adCost error:', adCostRes.error)
      return NextResponse.json({ error: '광고비 조회 실패' }, { status: 500 })
    }

    const currRows = (currRes.data ?? []) as ConsultationRow[]
    const prevRows = (prevRes.data ?? []) as ConsultationRow[]
    const creatives = (creativesRes.data ?? []) as CreativeRow[]

    // KPI
    let inquiries = 0
    let registrations = 0
    for (const r of currRows) {
      inquiries += 1
      if (r.status === '등록완료') registrations += 1
    }
    let prevInquiries = 0
    let prevRegistrations = 0
    for (const r of prevRows) {
      prevInquiries += 1
      if (r.status === '등록완료') prevRegistrations += 1
    }

    // 광고비 합 (현재 / 직전)
    let adCost = 0
    let prevAdCost = 0
    for (const row of adCostRes.data ?? []) {
      const rowDivision = (row as { division?: string }).division ?? 'nms'
      if (rowDivision !== division) continue
      const ym = row.year_month as string
      const amount = Number(row.ad_cost)
      if (monthsInRange.has(ym)) adCost += amount
      if (prevMonthsInRange.has(ym)) prevAdCost += amount
    }

    // 일별 추이
    const dailyMap = new Map<string, DashboardDailyPoint>()
    for (const p of buildEmptyDaily(start, end)) dailyMap.set(p.date, p)
    for (const r of currRows) {
      const d = formatDate(new Date(r.created_at))
      const p = dailyMap.get(d)
      if (p) {
        p.inquiries += 1
        if (r.status === '등록완료') p.registrations += 1
      }
    }
    const daily = Array.from(dailyMap.values())

    // 채널별 집계
    const channelMap = new Map<string, DashboardChannelSlice>()
    for (const r of currRows) {
      const ch = extractChannel(r.click_source)
      if (ch === '미입력') continue
      const slice = channelMap.get(ch) ?? { channel: ch, inquiries: 0, registrations: 0, adCost: 0 }
      slice.inquiries += 1
      if (r.status === '등록완료') slice.registrations += 1
      channelMap.set(ch, slice)
    }
    // 채널 광고비 매핑 (범위 내 해당 division의 광고비 합)
    for (const row of adCostRes.data ?? []) {
      const rowDivision = (row as { division?: string }).division ?? 'nms'
      if (rowDivision !== division) continue
      const ym = row.year_month as string
      if (!monthsInRange.has(ym)) continue
      const slice = channelMap.get(row.channel)
      if (slice) slice.adCost += Number(row.ad_cost)
    }
    const channels = Array.from(channelMap.values()).sort((a, b) => b.inquiries - a.inquiries)

    // 채널 TOP 3 (등록 수 기준)
    const topChannels = [...channels].sort((a, b) => b.registrations - a.registrations).slice(0, 3)

    // 소재 TOP 3 — 등록 > 0인 소재는 등록당 비용 오름차순으로 우선,
    // 그 외 등록 0인 소재는 등록된 순으로 뒤에 채워 최대 3개 표시
    const mappedCreatives: DashboardCreativeTop[] = creatives.map((c) => ({
      id: c.id,
      name: c.name,
      channel: c.channel,
      thumbnailUrl: publicUrl(c.thumbnail_path),
      registrations: Number(c.registrations),
      adCost: Number(c.ad_cost),
      costPerReg: Number(c.registrations) > 0 ? Math.round(Number(c.ad_cost) / Number(c.registrations)) : null,
    }))
    const ranked = mappedCreatives.filter((c) => c.registrations > 0).sort((a, b) => (a.costPerReg ?? Infinity) - (b.costPerReg ?? Infinity))
    const remaining = mappedCreatives.filter((c) => c.registrations === 0)
    const topCreatives = [...ranked, ...remaining].slice(0, 3)

    const response: DashboardResponse = {
      range: { start: startStr, end: endStr },
      kpi: {
        inquiries,
        prevInquiries,
        registrations,
        prevRegistrations,
        adCost,
        prevAdCost,
      },
      daily,
      channels,
      topChannels,
      topCreatives,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[dashboard-stats] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
