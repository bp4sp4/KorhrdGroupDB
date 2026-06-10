import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// 영업 손익관리 — 관리자(master-admin/admin)는 항상 허용,
// 그 외에는 권한관리에서 profit 권한이 명시적으로 부여된 경우만 허용
async function requireProfitAccess() {
  const result = await requireAuthFull()
  if (result.errorResponse) return result
  const { role, id } = result.appUser
  let allowed = role === 'master-admin' || role === 'admin'
  if (!allowed) {
    const { data } = await supabaseAdmin
      .from('user_permissions')
      .select('scope')
      .eq('user_id', id)
      .eq('section', 'profit')
      .maybeSingle()
    allowed = !!data?.scope && data.scope !== 'none'
  }
  if (!allowed) {
    return {
      user: null,
      appUser: null,
      errorResponse: NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 },
      ),
    }
  }
  return result
}

// 'YYYY-MM' → 해당 월 시작/다음 달 시작 날짜
function monthRange(month: string): { start: string; next: string } {
  const [y, m] = month.split('-').map(Number)
  const pad = (n: number) => String(n).padStart(2, '0')
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  return { start: `${y}-${pad(m)}-01`, next: `${nextY}-${pad(nextM)}-01` }
}

function shiftMonth(month: string, diff: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + diff, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const EXPENSE_KEYS = [
  'labor_cost',
  'marketing_cost',
  'fixed_cost',
  'etc_cost',
] as const

type SettingsRow = {
  division: string
  month: string
  goal: number
  labor_cost: number
  marketing_cost: number
  fixed_cost: number
  etc_cost: number
}

const EMPTY_SETTINGS = (division: string, month: string): SettingsRow => ({
  division,
  month,
  goal: 0,
  labor_cost: 0,
  marketing_cost: 0,
  fixed_cost: 0,
  etc_cost: 0,
})

// timestamptz → KST 기준 'YYYY-MM'
function kstMonth(iso: string): string {
  const d = new Date(
    new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Seoul' }),
  )
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const REFUNDED = new Set(['환불', '당월 환불'])

// ─── GET /api/profit?division=교육원&month=YYYY-MM ─────────────────────
// 매출파일 화면과 동일 기준의 사업본부 전체 매출 — 선택월 포함 최근 6개월
//  - 등록학생(edu_students, 삭제예정 제외)의 등록월(registered_at, KST) 기준
//  - 금액 = 매출(edu_sales.total_amount) 우선, 없으면 학생 비용(cost)
//  - 학생 미연결(orphan) 매출은 결제일(payment_date) 기준으로 합산
//  - 환불/당월 환불 건 제외
export async function GET(request: NextRequest) {
  const { errorResponse } = await requireProfitAccess()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const division = searchParams.get('division') || '교육원'
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const month = searchParams.get('month') || defaultMonth

  const months: string[] = []
  for (let i = 5; i >= 0; i--) months.push(shiftMonth(month, -i))

  const { start } = monthRange(months[0])
  const { next: end } = monthRange(month)
  const startISO = `${start}T00:00:00+09:00`
  const endISO = `${end}T00:00:00+09:00`

  // 학생(등록월 기준) + orphan 매출 + 설정 동시 조회
  const [studentsRes, orphanRes, settingsRes] = await Promise.all([
    supabaseAdmin
      .from('edu_students')
      .select('id, cost, registered_at')
      .gte('registered_at', startISO)
      .lt('registered_at', endISO)
      .not('status', 'eq', '삭제예정'),
    supabaseAdmin
      .from('edu_sales')
      .select('total_amount, payment_date, refund_status')
      .is('student_id', null)
      .gte('payment_date', start)
      .lt('payment_date', end),
    supabaseAdmin
      .from('profit_settings')
      .select('division, month, goal, labor_cost, marketing_cost, fixed_cost, etc_cost')
      .eq('division', division)
      .in('month', months),
  ])

  if (studentsRes.error) {
    return NextResponse.json({ error: studentsRes.error.message }, { status: 500 })
  }
  if (orphanRes.error) {
    return NextResponse.json({ error: orphanRes.error.message }, { status: 500 })
  }
  if (settingsRes.error) {
    return NextResponse.json({ error: settingsRes.error.message }, { status: 500 })
  }

  const students = studentsRes.data ?? []

  // 학생 연결 매출 (학생당 1건) — 금액/환불 상태 overlay
  const studentIds = students.map((s) => s.id)
  const salesByStudent = new Map<
    string,
    { total_amount: number | null; refund_status: string | null }
  >()
  // .in() 파라미터 한도 대비 500개씩 분할 조회
  for (let i = 0; i < studentIds.length; i += 500) {
    const chunk = studentIds.slice(i, i + 500)
    const { data, error } = await supabaseAdmin
      .from('edu_sales')
      .select('student_id, total_amount, refund_status')
      .in('student_id', chunk)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    for (const row of data ?? []) {
      salesByStudent.set(String(row.student_id), {
        total_amount: row.total_amount as number | null,
        refund_status: row.refund_status as string | null,
      })
    }
  }

  // 월별 매출 합계
  const salesByMonth = new Map<string, number>(months.map((m) => [m, 0]))
  for (const s of students) {
    if (!s.registered_at) continue
    const sale = salesByStudent.get(String(s.id))
    if (sale?.refund_status && REFUNDED.has(sale.refund_status)) continue
    const m = kstMonth(String(s.registered_at))
    if (!salesByMonth.has(m)) continue
    const amount = Number(sale?.total_amount ?? s.cost ?? 0)
    salesByMonth.set(m, (salesByMonth.get(m) ?? 0) + amount)
  }
  for (const row of orphanRes.data ?? []) {
    if (row.refund_status && REFUNDED.has(String(row.refund_status))) continue
    const m = String(row.payment_date).slice(0, 7)
    if (!salesByMonth.has(m)) continue
    salesByMonth.set(m, (salesByMonth.get(m) ?? 0) + Number(row.total_amount ?? 0))
  }

  const settingsByMonth = new Map<string, SettingsRow>()
  for (const row of settingsRes.data ?? []) {
    settingsByMonth.set(row.month, row as SettingsRow)
  }

  const monthly = months.map((m) => {
    const s = settingsByMonth.get(m) ?? EMPTY_SETTINGS(division, m)
    const expenses = EXPENSE_KEYS.reduce((sum, k) => sum + Number(s[k] ?? 0), 0)
    const sales = salesByMonth.get(m) ?? 0
    return {
      month: m,
      sales,
      expenses,
      profit: sales - expenses,
      goal: Number(s.goal ?? 0),
    }
  })

  return NextResponse.json({
    division,
    month,
    monthly,
    settings: settingsByMonth.get(month) ?? EMPTY_SETTINGS(division, month),
    updatedAt: new Date().toISOString(),
  })
}

// ─── PUT /api/profit ───────────────────────────────────────────────────
// body: { division, month, goal?, labor_cost?, marketing_cost?, fixed_cost?, etc_cost? }
export async function PUT(request: NextRequest) {
  const { errorResponse } = await requireProfitAccess()
  if (errorResponse) return errorResponse

  const body = await request.json()
  const division = String(body.division || '교육원')
  const month = String(body.month || '')
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month는 YYYY-MM 형식이어야 합니다.' }, { status: 400 })
  }

  const fields: Record<string, number> = {}
  for (const key of ['goal', ...EXPENSE_KEYS] as const) {
    if (key in body) {
      const n = Number(body[key])
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: `${key} 값이 올바르지 않습니다.` }, { status: 400 })
      }
      fields[key] = Math.round(n)
    }
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: '저장할 값이 없습니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('profit_settings')
    .upsert(
      { division, month, ...fields, updated_at: new Date().toISOString() },
      { onConflict: 'division,month' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
