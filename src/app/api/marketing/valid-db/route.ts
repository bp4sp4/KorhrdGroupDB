import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { isValidWeekStart, getWeekRange } from '@/lib/marketing/week'

interface Row {
  click_source: string | null
  status: string | null
  name: string | null
  contact: string | null
  created_at: string
}

// 유효DB = 활성 행에서 (수신거부 + 잘못된번호류) 제외 + 이름·전화 중복은 1건만
export interface ValidDBItem {
  channel: string
  validDB: number // 유효 문의 수 (제외/중복 정리 후)
  completed: number // 상담완료 (상담완료-높음/중간/낮음 + 등록완료)
  registrations: number // 등록완료
}

type Division = 'nms' | 'cert' | 'abroad'

const DIVISION_TABLE: Record<Division, string | null> = {
  nms: 'hakjeom_consultations',
  cert: 'private_cert_consultations',
  abroad: null,
}

// ─── 채널명 정규화 (channel-stats 와 동일 규칙) ───────────────────────────────
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
  return raw
}

function extractChannel(clickSource: string | null): string {
  if (!clickSource) return '미입력'
  const normalized = clickSource.replace(/^바로폼_/i, '').replace(/^baroform_/i, '')
  const parts = normalized.split('_')
  const raw = parts[0] || '미입력'
  return normalizeChannel(raw)
}

// ─── 유효 판정 ────────────────────────────────────────────────────────────────
// 제외(쓰레기): 수신거부 + 잘못된번호류(기타(잘못된 번호), 기타(신청한적 없음) 등)
function isExcludedStatus(status: string): boolean {
  const s = (status ?? '').trim()
  if (!s) return false
  if (s === '수신거부') return true
  if (s.includes('잘못된 번호') || s.includes('잘못된번호')) return true
  if (s.includes('신청') && (s.includes('없음') || s.includes('없슴'))) return true
  return false
}

// 상담완료: 상담완료-높음/중간/낮음 + 등록완료
function isCompleted(status: string): boolean {
  const s = (status ?? '').trim()
  return s.startsWith('상담완료') || s === '등록완료'
}

function getMonthRange(yearMonth: string): { start: string; end: string } {
  const [year, month] = yearMonth.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const division = (searchParams.get('division') ?? 'nms') as Division

    const tableName = DIVISION_TABLE[division]
    if (!tableName) return NextResponse.json([])

    // 기간 모드: week_start(YYYY-MM-DD, 월요일) 있으면 주간, 없으면 월간
    const weekStartParam = searchParams.get('week_start')
    const isWeek = !!weekStartParam && isValidWeekStart(weekStartParam)
    const { start, end } = isWeek
      ? getWeekRange(weekStartParam as string)
      : getMonthRange(searchParams.get('year_month') ?? currentYearMonth)

    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select('click_source, status, name, contact, created_at')
      .is('deleted_at', null)
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[valid-db GET] 조회 오류:', error)
      return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 })
    }

    // 제외 status 거르고, 이름+전화(정규화) 중복은 최신 1건만 유지하면서 채널별 집계
    const seen = new Set<string>()
    const map = new Map<string, { validDB: number; completed: number; registrations: number }>()

    for (const row of (data ?? []) as Row[]) {
      const status = (row.status ?? '').trim()
      if (isExcludedStatus(status)) continue

      const phone = String(row.contact ?? '').replace(/\D/g, '')
      const name = String(row.name ?? '').trim()
      if (name && phone.length >= 9) {
        const key = `${name}::${phone}`
        if (seen.has(key)) continue // 중복 → 최신 1건만 (created_at desc 정렬)
        seen.add(key)
      }

      const channel = extractChannel(row.click_source)
      if (channel === '미입력') continue

      const e = map.get(channel) ?? { validDB: 0, completed: 0, registrations: 0 }
      e.validDB += 1
      if (isCompleted(status)) e.completed += 1
      if (status === '등록완료') e.registrations += 1
      map.set(channel, e)
    }

    const items: ValidDBItem[] = Array.from(map.entries()).map(([channel, v]) => ({
      channel,
      validDB: v.validDB,
      completed: v.completed,
      registrations: v.registrations,
    }))
    items.sort((a, b) => b.validDB - a.validDB)

    return NextResponse.json(items)
  } catch (err) {
    console.error('[valid-db GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
