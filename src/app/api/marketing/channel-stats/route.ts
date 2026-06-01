import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface ConsultationRow {
  click_source: string | null
  status: string
}

export interface ChannelStatItem {
  channel: string
  inquiries: number
  registrations: number
  adCost: number
  prevInquiries: number
}

type Division = 'nms' | 'cert' | 'abroad'

const DIVISION_TABLE: Record<Division, string | null> = {
  nms: 'hakjeom_consultations',
  cert: 'private_cert_consultations',
  abroad: null, // applications 테이블엔 click_source가 없어 채널별 분석 불가
}

// 채널명 정규화
// · 메타 광고(Facebook/Instagram)는 한 행으로 합쳐서 보이도록 'meta' 로 통합
// · 학점은행제 상세DB의 "개인마케팅" 카드는 내부 DB값이 "지인소개" 라
//   click_source 가 '지인소개_<소재>' 로 저장됨 → 채널 통계에선 UI 라벨에 맞춰 '개인마케팅' 으로 통합
// · '주부' 채널은 광고 성과 분석 대상이 아니므로 '기타' 로 묶음
// (광고비도 같은 표기로 통합되어 매칭됨)
const META_ALIASES = new Set<string>([
  'meta',
  '메타',
  'facebook',
  '페이스북',
  'instagram',
  '인스타',
  '인스타그램',
  '인스타·페이스북',
  '페이스북·인스타',
  '인스타/페이스북',
  '페이스북/인스타',
  '인스타,페이스북',
  '페이스북,인스타',
])
const PERSONAL_MARKETING_ALIASES = new Set<string>(['지인소개', '개인마케팅'])
const ETC_ALIASES = new Set<string>(['주부'])
function normalizeChannel(raw: string): string {
  const k = raw.trim().toLowerCase()
  if (META_ALIASES.has(k)) return 'meta'
  if (PERSONAL_MARKETING_ALIASES.has(k)) return '개인마케팅'
  if (ETC_ALIASES.has(k)) return '기타'
  return raw
}

function extractChannel(clickSource: string | null): string {
  if (!clickSource) return '미입력'
  const normalized = clickSource.replace(/^바로폼_/i, '').replace(/^baroform_/i, '')
  const parts = normalized.split('_')
  const raw = parts[0] || '미입력'
  return normalizeChannel(raw)
}

function getMonthRange(yearMonth: string): { start: string; end: string } {
  const [year, month] = yearMonth.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

function getPrevYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  const prevDate = new Date(year, month - 2, 1)
  return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
}

function aggregateByChannel(rows: ConsultationRow[]) {
  const map = new Map<string, { inquiries: number; registrations: number }>()
  for (const row of rows) {
    const channel = extractChannel(row.click_source)
    const existing = map.get(channel) ?? { inquiries: 0, registrations: 0 }
    existing.inquiries += 1
    if (row.status === '등록완료') existing.registrations += 1
    map.set(channel, existing)
  }
  return map
}

const START_YEAR_MONTH = '2026-03'

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const yearMonth = searchParams.get('year_month') ?? currentYearMonth
    const division = (searchParams.get('division') ?? 'nms') as Division

    const tableName = DIVISION_TABLE[division]
    // 유학(abroad) 처럼 click_source 데이터가 없는 부서는 빈 결과 반환
    if (!tableName) {
      return NextResponse.json([])
    }

    const prevYearMonth = getPrevYearMonth(yearMonth)
    const usePrev = prevYearMonth >= START_YEAR_MONTH

    const { start: currStart, end: currEnd } = getMonthRange(yearMonth)
    const { start: prevStart, end: prevEnd } = getMonthRange(prevYearMonth)

    const [currResult, adCostResult, prevResult] = await Promise.all([
      supabaseAdmin
        .from(tableName)
        .select('click_source, status')
        .is('deleted_at', null)
        .gte('created_at', currStart)
        .lt('created_at', currEnd),
      supabaseAdmin
        .from('marketing_ad_costs')
        .select('channel, ad_cost, year_month, division')
        .in('year_month', [yearMonth, prevYearMonth]),
      usePrev
        ? supabaseAdmin
            .from(tableName)
            .select('click_source, status')
            .is('deleted_at', null)
            .gte('created_at', prevStart)
            .lt('created_at', prevEnd)
        : Promise.resolve({ data: [] as ConsultationRow[], error: null }),
    ])

    if (currResult.error) {
      console.error('[channel-stats GET] 당월 조회 오류:', currResult.error)
      return NextResponse.json({ error: '당월 데이터 조회 실패' }, { status: 500 })
    }
    if (prevResult.error) {
      console.error('[channel-stats GET] 전월 조회 오류:', prevResult.error)
      return NextResponse.json({ error: '전월 데이터 조회 실패' }, { status: 500 })
    }
    if (adCostResult.error) {
      console.error('[channel-stats GET] 광고비 조회 오류:', adCostResult.error)
      return NextResponse.json({ error: '광고비 데이터 조회 실패' }, { status: 500 })
    }

    const currMap = aggregateByChannel((currResult.data ?? []) as ConsultationRow[])
    const prevMap = aggregateByChannel((prevResult.data ?? []) as ConsultationRow[])

    // division별 광고비만 필터 — 채널명도 통합 정규화(메타 계열 → 'meta')해서 합산
    const adCostMap = new Map<string, number>()
    for (const row of adCostResult.data ?? []) {
      const rowDivision = (row as { division?: string }).division ?? 'nms'
      if (row.year_month === yearMonth && rowDivision === division) {
        const key = normalizeChannel(row.channel)
        adCostMap.set(key, (adCostMap.get(key) ?? 0) + Number(row.ad_cost))
      }
    }

    const stats: ChannelStatItem[] = Array.from(currMap.entries())
      .filter(([channel]) => channel !== '미입력')
      .map(([channel, curr]) => {
        const prev = prevMap.get(channel) ?? { inquiries: 0, registrations: 0 }
        return {
          channel,
          inquiries: curr.inquiries,
          registrations: curr.registrations,
          adCost: adCostMap.get(channel) ?? 0,
          prevInquiries: prev.inquiries,
        }
      })

    stats.sort((a, b) => b.inquiries - a.inquiries)
    return NextResponse.json(stats)
  } catch (err) {
    console.error('[channel-stats GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
