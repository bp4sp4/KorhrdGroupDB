import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/dashboard/vacation-events?year=YYYY&month=MM
// 결재 완료(APPROVED)된 휴가신청서만 해당 월에 겹치는 범위로 조회하여
// 일자별 이벤트로 expand 해 반환. (결재 진행중 건은 제외)
//
// 응답: Array<{ id, date(YYYY-MM-DD), title, type, status, applicantName, color }>

type VacationType =
  | '연차'
  | '오전반차'
  | '오후반차'
  | '반차'
  | '병가'
  | '경조휴가'
  | '예비군'
  | '기타'

const TYPE_COLOR: Record<string, string> = {
  연차: '#0084FE',
  오전반차: '#00C471',
  오후반차: '#00C471',
  반차: '#00C471',
  병가: '#FF6B6B',
  경조휴가: '#A855F7',
  예비군: '#F59E0B',
  기타: '#6B7684',
}

function colorOf(t: string): string {
  return TYPE_COLOR[t] ?? TYPE_COLOR['기타']
}

interface Approval {
  id: string
  status: string
  content: Record<string, unknown> | null
  applicant?: { id: number; display_name: string } | null
}

function parseDateSafe(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

function* enumerateDates(start: string, end: string): Generator<string> {
  // start ~ end (inclusive), YYYY-MM-DD
  // CRITICAL: Vercel/Node 런타임 timezone 이 UTC 이므로
  //   getFullYear()/getMonth()/getDate() (로컬 시간대 기반) 사용 시 +09:00 오프셋이 적용되어
  //   하루 빨리 표시되는 버그 발생. 정오 UTC 로 Date 를 만들고 getUTC* 로 일관 처리.
  const s = new Date(`${start}T12:00:00Z`)
  const e = new Date(`${end}T12:00:00Z`)
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) {
    yield start
    return
  }
  const cur = new Date(s)
  while (cur <= e) {
    const y = cur.getUTCFullYear()
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0')
    const d = String(cur.getUTCDate()).padStart(2, '0')
    yield `${y}-${m}-${d}`
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
}

export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const sp = request.nextUrl.searchParams
  const now = new Date()
  const year = parseInt(sp.get('year') ?? '', 10) || now.getFullYear()
  const month = parseInt(sp.get('month') ?? '', 10) || now.getMonth() + 1

  const pad = (n: number) => String(n).padStart(2, '0')
  const monthStart = `${year}-${pad(month)}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`

  // 휴가신청서 + 결재 완료(APPROVED) 건만 표시.
  // (SUBMITTED / IN_PROGRESS 등 결재 진행중 건은 승인 전이므로 캘린더에 노출하지 않음)
  // document_type 의 정확한 표기가 환경마다 다를 수 있어 like 검색
  const { data, error } = await supabaseAdmin
    .from('approvals')
    .select(
      `id, status, content, applicant:app_users!approvals_applicant_id_fkey(id, display_name)`,
    )
    .like('document_type', '%휴가신청%')
    .eq('status', 'APPROVED')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const events: {
    id: string
    date: string
    title: string
    type: string
    status: string
    applicantName: string
    color: string
  }[] = []

  for (const row of (data as unknown as Approval[]) ?? []) {
    const c = row.content ?? {}
    const start = parseDateSafe(c.vacation_start)
    const end = parseDateSafe(c.vacation_end) ?? start
    if (!start || !end) continue

    // 월 범위와 겹치는지 검사
    if (end < monthStart || start > monthEnd) continue

    const vType = String(c.vacation_type ?? '연차').trim() as VacationType
    const applicantName = row.applicant?.display_name ?? '미상'
    const color = colorOf(vType)

    for (const day of enumerateDates(start, end)) {
      // 월 밖 일자 skip
      if (day < monthStart || day > monthEnd) continue
      events.push({
        id: `${row.id}_${day}`,
        date: day,
        title: `${applicantName} / ${vType}`,
        type: vType,
        status: row.status,
        applicantName,
        color,
      })
    }
  }

  return NextResponse.json(events, {
    headers: {
      'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
