import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Task = { id: string; text: string; done: boolean }
type JournalRow = { id: string; category: string; detail: string }
type Tomorrow = { id: string; text: string }

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function sanitizeTasks(input: unknown): Task[] {
  if (!Array.isArray(input)) return []
  return input
    .map((r) => {
      if (!r || typeof r !== 'object') return null
      const o = r as Record<string, unknown>
      return {
        id: String(o.id ?? ''),
        text: typeof o.text === 'string' ? o.text : '',
        done: Boolean(o.done),
      }
    })
    .filter((t): t is Task => t !== null)
}

function sanitizeRows(input: unknown): JournalRow[] {
  if (!Array.isArray(input)) return []
  return input
    .map((r) => {
      if (!r || typeof r !== 'object') return null
      const o = r as Record<string, unknown>
      return {
        id: String(o.id ?? ''),
        category: typeof o.category === 'string' ? o.category : '',
        detail: typeof o.detail === 'string' ? o.detail : '',
      }
    })
    .filter((r): r is JournalRow => r !== null)
}

function sanitizeTomorrow(input: unknown): Tomorrow[] {
  if (!Array.isArray(input)) return []
  return input
    .map((r) => {
      if (!r || typeof r !== 'object') return null
      const o = r as Record<string, unknown>
      return {
        id: String(o.id ?? ''),
        text: typeof o.text === 'string' ? o.text : '',
      }
    })
    .filter((t): t is Tomorrow => t !== null)
}

// GET /api/work-journal?date=YYYY-MM-DD — 본인 해당 날짜 일지 조회
// - 일지 존재: { journal }
// - 일지 없음: { journal: null, carryOverTasks?, carryOverFrom? }
//   (직전 submitted 일지의 tomorrow를 오늘 tasks 초기값 후보로 제공)
export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const date = request.nextUrl.searchParams.get('date')
  if (!date || !ISO_DATE_RE.test(date)) {
    return NextResponse.json({ error: 'date(YYYY-MM-DD)가 필요합니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('work_journals')
    .select('id, date, tasks, morning, afternoon, tomorrow, status, submitted_at, updated_at')
    .eq('user_id', appUser.id)
    .eq('date', date)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // tasks 가 비어있으면(또는 일지 자체가 없으면) 이월 후보를 함께 제공
  const journalTasks = Array.isArray(data?.tasks) ? (data!.tasks as Task[]) : []
  const tasksEmpty = journalTasks.length === 0

  if (data && !tasksEmpty) {
    return NextResponse.json({ journal: data })
  }

  // 직전 submitted 일지의 tomorrow 를 오늘 tasks 후보로
  const { data: prev } = await supabaseAdmin
    .from('work_journals')
    .select('date, tomorrow')
    .eq('user_id', appUser.id)
    .eq('status', 'submitted')
    .lt('date', date)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prevTomorrow = sanitizeTomorrow(prev?.tomorrow)
  const carryOverTasks: Task[] = prevTomorrow
    .filter((t) => t.text.trim() !== '')
    .map((t) => ({
      id: `carry-${t.id}-${Math.random().toString(36).slice(2, 8)}`,
      text: t.text,
      done: false,
    }))

  return NextResponse.json({
    journal: data ?? null,
    carryOverTasks,
    carryOverFrom: prev?.date ?? null,
  })
}

// PUT /api/work-journal — 본인 일지 upsert
// body: { date, tasks, morning, afternoon, tomorrow, status }
export async function PUT(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '잘못된 요청 본문' }, { status: 400 })
  }

  const date = String((body as Record<string, unknown>).date ?? '')
  if (!ISO_DATE_RE.test(date)) {
    return NextResponse.json({ error: 'date(YYYY-MM-DD)가 필요합니다.' }, { status: 400 })
  }

  const status = (body as Record<string, unknown>).status === 'submitted' ? 'submitted' : 'draft'

  const payload = {
    user_id: appUser.id,
    date,
    tasks: sanitizeTasks((body as Record<string, unknown>).tasks),
    morning: sanitizeRows((body as Record<string, unknown>).morning),
    afternoon: sanitizeRows((body as Record<string, unknown>).afternoon),
    tomorrow: sanitizeTomorrow((body as Record<string, unknown>).tomorrow),
    status,
    submitted_at: status === 'submitted' ? new Date().toISOString() : null,
  }

  const { data, error } = await supabaseAdmin
    .from('work_journals')
    .upsert(payload, { onConflict: 'user_id,date' })
    .select('id, date, status, submitted_at, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ journal: data })
}
