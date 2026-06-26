import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { requireProfitAccess } from '@/lib/auth/requireProfitAccess'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { fetchUnifiedTransactions } from '@/lib/budget/transactions'

// ─── GET /api/profit/pnl ─────────────────────────────────────────────────
// 예상손익계산서 — 매출 3종(학점은행제/민간자격증/실습서비스)을 각 출처의
// "최신 데이터 월" 기준으로 끌어와 매출액 라인을 구성한다.
//  · 학점은행제: edu_students(등록월 registered_at, KST) + edu_sales overlay
//      - 우리 교육원 = education_center_name '덧셈(올티칭)', 그 외 = 타 교육원
//      - 금액 = edu_sales.total_amount(overlay) ?? edu_students.cost, 환불/삭제예정 제외
//      - 과목수 = cost / unit_price (교강사비 산정용)
//  · 민간자격증: cert_sales(결제일 payment_date, is_hidden=false) + base amount fallback
//  · 실습서비스: practice_sales(결제일 payment_date, is_hidden=false) + base fallback
// 매출원가/판관비 가정값은 profit_settings(division='교육원', 당월) 에서 읽어 함께 반환.

const DIVISION = '교육원'
const OUR_CENTER = '덧셈(올티칭)' // 우리 교육원 기관명
const REFUNDED = new Set(['환불', '당월 환불'])
const INSTRUCTOR_FEE_MEMO = '학점은행제 교수비' // 교강사비(교수비) 전용 통장 memo

// 판매관리비 기본 항목(순서 고정). 4대보험은 기본급(정규직)×12% 자동행이라 제외.
const DEFAULT_SGNA_LABELS = [
  '기본급(정규직)',
  '광고비',
  '맘카페',
  '사업소득',
  '임차료',
  '관리비',
  '지급수수료',
  '소모품비',
  '비품비',
  '통신비',
  '복리후생비',
  '차량유지비',
  '사무용품비',
  '이자비용',
  '도서비',
  '세금과공과',
]

const pad = (n: number) => String(n).padStart(2, '0')

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? '0.0.0.0'
}

// timestamptz → KST 기준 'YYYY-MM'
function kstMonth(iso: string): string {
  const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

// 'YYYY-MM' → 월 시작/다음달 시작 (date 문자열)
function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number)
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  const lastDay = new Date(y, m, 0).getDate()
  return {
    start: `${y}-${pad(m)}-01`,
    end: `${y}-${pad(m)}-${pad(lastDay)}`,
    nextStart: `${nextY}-${pad(nextM)}-01`,
  }
}

// 'YYYY-MM' n개월 전의 1일 (date 문자열) — 최신월 탐색 윈도우 시작
function monthsAgoStart(months: number): string {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const d = new Date(now.getFullYear(), now.getMonth() - months, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
}

// ── 학점은행제: 우리/타 매출 + 우리 과목수 (특정 등록월) ──
async function aggregateEdu(month: string) {
  const { start, nextStart } = monthBounds(month)
  const startISO = `${start}T00:00:00+09:00`
  const endISO = `${nextStart}T00:00:00+09:00`

  const { data: students, error } = await supabaseAdmin
    .from('edu_students')
    .select('id, cost, unit_price, education_center_name, registered_at')
    .gte('registered_at', startISO)
    .lt('registered_at', endISO)
    .not('status', 'eq', '삭제예정')
  if (error) throw new Error(error.message)

  const rows = students ?? []
  const ids = rows.map((s) => s.id)

  // overlay (학생 연결 매출) — total_amount / refund_status / center
  const overlay = new Map<
    string,
    { total_amount: number | null; refund_status: string | null; center: string | null }
  >()
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500)
    const { data, error: e } = await supabaseAdmin
      .from('edu_sales')
      .select('student_id, total_amount, refund_status, education_center_name')
      .in('student_id', chunk)
    if (e) throw new Error(e.message)
    for (const r of data ?? []) {
      overlay.set(String(r.student_id), {
        total_amount: r.total_amount as number | null,
        refund_status: r.refund_status as string | null,
        center: r.education_center_name as string | null,
      })
    }
  }

  let ours = 0
  let others = 0
  let oursSubjects = 0
  for (const s of rows) {
    const ov = overlay.get(String(s.id))
    if (ov?.refund_status && REFUNDED.has(ov.refund_status)) continue
    const amount = Number(ov?.total_amount ?? s.cost ?? 0)
    if (amount <= 0) continue
    const center = (s.education_center_name as string | null) ?? ov?.center ?? null
    const unit = Number(s.unit_price ?? 0)
    if (center === OUR_CENTER) {
      ours += amount
      if (unit > 0) oursSubjects += Math.round(Number(s.cost ?? 0) / unit)
    } else {
      others += amount
    }
  }

  // orphan 매출 (학생 미연결) — 결제월 기준 동일 월 포함
  const { data: orphans, error: oe } = await supabaseAdmin
    .from('edu_sales')
    .select('total_amount, refund_status, education_center_name, payment_date')
    .is('student_id', null)
    .gte('payment_date', start)
    .lt('payment_date', nextStart)
  if (oe) throw new Error(oe.message)
  for (const r of orphans ?? []) {
    if (r.refund_status && REFUNDED.has(String(r.refund_status))) continue
    const amount = Number(r.total_amount ?? 0)
    if (amount <= 0) continue
    if ((r.education_center_name as string | null) === OUR_CENTER) ours += amount
    else others += amount
  }

  return { ours, others, oursSubjects }
}

// 최신 등록월(KST) 탐색 — 데이터가 있는 가장 최근 월
async function latestEduMonth(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('edu_students')
    .select('registered_at')
    .not('status', 'eq', '삭제예정')
    .not('registered_at', 'is', null)
    .order('registered_at', { ascending: false })
    .limit(1)
  const iso = data?.[0]?.registered_at as string | undefined
  return iso ? kstMonth(iso) : null
}

// 가장 최근 월 키 선택
function pickLatest(byMonth: Map<string, { amount: number; subjects: number }>): {
  month: string | null
  amount: number
  subjects: number
} {
  const months = Array.from(byMonth.keys()).sort()
  const latest = months[months.length - 1] ?? null
  const acc = latest ? byMonth.get(latest)! : { amount: 0, subjects: 0 }
  return { month: latest, amount: acc.amount, subjects: acc.subjects }
}

// 지정 월 선택 (없으면 0)
function pickMonth(
  byMonth: Map<string, { amount: number; subjects: number }>,
  month: string,
): { month: string; amount: number; subjects: number } {
  const acc = byMonth.get(month) ?? { amount: 0, subjects: 0 }
  return { month, amount: acc.amount, subjects: acc.subjects }
}

const addMonth = (
  byMonth: Map<string, { amount: number; subjects: number }>,
  ym: string,
  amount: number,
  subjects: number,
) => {
  const a = byMonth.get(ym) ?? { amount: 0, subjects: 0 }
  a.amount += amount
  a.subjects += subjects
  byMonth.set(ym, a)
}

// ── 민간자격증 — 매출파일과 동일: certificate_applications(학점연계) + cert_sales(overlay) + 후납 orphan ──
// 결제일 = overlay.payment_date ?? paid_at, 금액 = overlay.total_amount ?? base.amount
async function aggregateCert(windowStart: string, targetMonth: string | null) {
  const { data: apps, error } = await supabaseAdmin
    .from('certificate_applications')
    .select('id, amount, paid_at, certificates')
    .eq('source', 'bridge')
    .eq('payment_status', 'paid')
    .is('deleted_at', null)
    .gte('paid_at', windowStart)
  if (error) throw new Error(error.message)
  const ids = (apps ?? []).map((a) => a.id as string)

  const ovMap = new Map<string, Record<string, unknown>>()
  const hidden = new Set<string>()
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await supabaseAdmin
      .from('cert_sales')
      .select('cert_application_id, total_amount, payment_date, is_hidden, refund_status, subject_count')
      .in('cert_application_id', ids.slice(i, i + 500))
    for (const o of data ?? []) {
      const aid = String(o.cert_application_id)
      if (o.is_hidden) hidden.add(aid)
      else ovMap.set(aid, o)
    }
  }

  const byMonth = new Map<string, { amount: number; subjects: number }>()
  for (const a of apps ?? []) {
    const id = String(a.id)
    if (hidden.has(id)) continue
    const ov = ovMap.get(id)
    if (ov?.refund_status && REFUNDED.has(String(ov.refund_status))) continue
    const date =
      (ov?.payment_date as string | null) ?? (a.paid_at ? String(a.paid_at).slice(0, 10) : null)
    if (!date) continue
    const amt = Number(ov?.total_amount ?? a.amount ?? 0)
    if (amt <= 0) continue
    const subj = Number(
      ov?.subject_count ?? (Array.isArray(a.certificates) ? a.certificates.length : 0),
    ) || 0
    addMonth(byMonth, date.slice(0, 7), amt, subj)
  }

  const { data: orphans } = await supabaseAdmin
    .from('cert_sales')
    .select('total_amount, payment_date, refund_status, subject_count')
    .is('cert_application_id', null)
    .eq('is_hidden', false)
    .gte('payment_date', windowStart.slice(0, 10))
  for (const r of orphans ?? []) {
    if (r.refund_status && REFUNDED.has(String(r.refund_status))) continue
    const date = r.payment_date as string | null
    if (!date) continue
    const amt = Number(r.total_amount ?? 0)
    if (amt <= 0) continue
    addMonth(byMonth, String(date).slice(0, 7), amt, Number(r.subject_count ?? 0) || 0)
  }

  return targetMonth ? pickMonth(byMonth, targetMonth) : pickLatest(byMonth)
}

// ── 실습서비스 — 매출파일과 동일: practice_applications + practice_sales(overlay) + 후납 orphan ──
async function aggregatePractice(windowStart: string, targetMonth: string | null) {
  const { data: apps, error } = await supabaseAdmin
    .from('practice_applications')
    .select('id, payment_amount, created_at')
    .eq('payment_status', 'paid')
    .gte('created_at', windowStart)
  if (error) throw new Error(error.message)
  const ids = (apps ?? []).map((a) => a.id as string)

  const ovMap = new Map<string, Record<string, unknown>>()
  const hidden = new Set<string>()
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await supabaseAdmin
      .from('practice_sales')
      .select('practice_application_id, total_amount, payment_date, is_hidden, refund_status')
      .in('practice_application_id', ids.slice(i, i + 500))
    for (const o of data ?? []) {
      const aid = String(o.practice_application_id)
      if (o.is_hidden) hidden.add(aid)
      else ovMap.set(aid, o)
    }
  }

  const byMonth = new Map<string, { amount: number; subjects: number }>()
  for (const a of apps ?? []) {
    const id = String(a.id)
    if (hidden.has(id)) continue
    const ov = ovMap.get(id)
    if (ov?.refund_status && REFUNDED.has(String(ov.refund_status))) continue
    const date =
      (ov?.payment_date as string | null) ?? (a.created_at ? String(a.created_at).slice(0, 10) : null)
    if (!date) continue
    const amt = Number(ov?.total_amount ?? a.payment_amount ?? 0)
    if (amt <= 0) continue
    addMonth(byMonth, date.slice(0, 7), amt, 0)
  }

  const { data: orphans } = await supabaseAdmin
    .from('practice_sales')
    .select('total_amount, payment_date, refund_status')
    .is('practice_application_id', null)
    .eq('is_hidden', false)
    .gte('payment_date', windowStart.slice(0, 10))
  for (const r of orphans ?? []) {
    if (r.refund_status && REFUNDED.has(String(r.refund_status))) continue
    const date = r.payment_date as string | null
    if (!date) continue
    const amt = Number(r.total_amount ?? 0)
    if (amt <= 0) continue
    addMonth(byMonth, String(date).slice(0, 7), amt, 0)
  }

  return targetMonth ? pickMonth(byMonth, targetMonth) : pickLatest(byMonth)
}

// ── 학점은행제 교강사비 = '학점은행제 교수비' 전용 통장(신한)의 해당 월 출금 합계 ──
async function aggregateInstructorFee(
  month: string,
  clientIp: string,
): Promise<{ amount: number; accounts: string[]; ok: boolean }> {
  const { data: accts } = await supabaseAdmin
    .from('bank_accounts')
    .select('account_number')
    .ilike('memo', `%${INSTRUCTOR_FEE_MEMO}%`)
    .eq('is_active', true)
  const accountNumbers = Array.from(
    new Set(
      (accts ?? [])
        .map((a) => String(a.account_number).replace(/[^\d]/g, ''))
        .filter(Boolean),
    ),
  )
  if (accountNumbers.length === 0) return { amount: 0, accounts: [], ok: true }
  try {
    const txs = await fetchUnifiedTransactions({ accountNumbers, yearMonth: month, clientIp })
    const amount = txs
      .filter((t) => t.tx_type === 'out')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0)
    return { amount, accounts: accountNumbers, ok: true }
  } catch {
    // 신한 실시간 조회 실패 — 손익표는 계속 렌더되도록 0 + ok=false
    return { amount: 0, accounts: accountNumbers, ok: false }
  }
}

export async function GET(request: NextRequest) {
  // 보기 권한 — 마스터어드민/관리자/본부장/경영지원본부 (팀장 제외)
  const { errorResponse } = await requireProfitAccess({ excludeLeader: true })
  if (errorResponse) return errorResponse

  try {
    // ?month=YYYY-MM 지정 시 그 월, 없으면 최신(자동)
    const monthParam = new URL(request.url).searchParams.get('month')
    const targetMonth =
      monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : null

    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const currentMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
    const settingsMonth = targetMonth ?? currentMonth
    const windowStart = targetMonth ? `${targetMonth}-01` : monthsAgoStart(4)

    const eduMonth = targetMonth ?? (await latestEduMonth())
    const feeMonth = eduMonth ?? settingsMonth // 교강사비(교수비) 기준월

    const [edu, cert, practice, instructor] = await Promise.all([
      eduMonth ? aggregateEdu(eduMonth) : Promise.resolve({ ours: 0, others: 0, oursSubjects: 0 }),
      aggregateCert(windowStart, targetMonth),
      aggregatePractice(windowStart, targetMonth),
      aggregateInstructorFee(feeMonth, getClientIp(request)),
    ])
    const certMonth = cert.month
    const pracMonth = practice.month

    // 가정값 + 판관비 — profit_settings (당월 기준, 최근 12개월 함께 조회)
    const { data: rows } = await supabaseAdmin
      .from('profit_settings')
      .select(
        'month, settlement_rate, cert_fee_per_subject, cert_usage_fee, pnl_sgna_items, labor_cost, marketing_cost, fixed_cost, etc_cost',
      )
      .eq('division', DIVISION)
      .lte('month', settingsMonth)
      .order('month', { ascending: false })
      .limit(12)

    const settingRows = rows ?? []
    const setting = settingRows.find((r) => r.month === settingsMonth) ?? null
    // 판관비 행 — 저장된 행이 있으면 사용, 없으면 기본 항목(순서 고정)으로 시드
    const savedItems = Array.isArray(setting?.pnl_sgna_items)
      ? (setting!.pnl_sgna_items as { label?: string; amount?: number; note?: string }[])
      : []
    const sgnaSeedMonth: string | null = null
    // 4대보험은 별도 자동행(기본급×12%)이라 sgnaItems에 포함하지 않는다
    const sgnaItems =
      savedItems.length > 0
        ? savedItems.map((it) => ({
            label: String(it.label ?? ''),
            amount: Number(it.amount) || 0,
            note: String(it.note ?? ''),
          }))
        : DEFAULT_SGNA_LABELS.map((label) => ({ label, amount: 0, note: '' }))

    // 민간자격증 과목 사용료 — 직접입력값 우선, 없으면 과목수 × 과목당단가
    const certFeePerSubject = Number(setting?.cert_fee_per_subject ?? 33000)
    const certUsageFee =
      setting?.cert_usage_fee == null
        ? cert.subjects * certFeePerSubject
        : Number(setting.cert_usage_fee)

    return NextResponse.json({
      division: DIVISION,
      settingsMonth,
      selectedMonth: targetMonth, // null이면 최신(자동)
      months: { edu: eduMonth, cert: certMonth, practice: pracMonth },
      revenue: {
        eduOurs: edu.ours,
        eduOthers: edu.others,
        cert: cert.amount,
        practice: practice.amount,
      },
      counts: {
        eduOursSubjects: edu.oursSubjects,
        certSubjects: cert.subjects,
      },
      // 학점은행제 교강사비 — '학점은행제 교수비' 통장(신한) 출금 실시간 연동
      cogs: {
        eduInstructorFee: instructor.amount,
        eduInstructorMonth: feeMonth,
        eduInstructorAccounts: instructor.accounts,
        eduInstructorOk: instructor.ok,
      },
      assumptions: {
        settlement_rate: Number(setting?.settlement_rate ?? 35),
        cert_fee_per_subject: certFeePerSubject,
      },
      certUsageFee,
      certUsageCustom: setting?.cert_usage_fee != null,
      sgnaItems,
      sgnaSeedMonth,
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// ─── PUT /api/profit/pnl ─────────────────────────────────────────────────
// 예상손익계산서 전용 설정 저장 (당월 profit_settings 행)
//  body: { settlement_rate?, cert_usage_fee? (null 허용), sgna_items?: [{label,amount}] }
export async function PUT(request: NextRequest) {
  // 수정 권한 — 마스터어드민 + 경영지원본부(MGT)
  const auth = await requireAuthFull()
  if (auth.errorResponse) return auth.errorResponse
  let canEdit = auth.appUser.role === 'master-admin'
  if (!canEdit && auth.appUser.department_id) {
    const { data: dept } = await supabaseAdmin
      .from('departments')
      .select('code')
      .eq('id', auth.appUser.department_id)
      .maybeSingle()
    canEdit = dept?.code === 'MGT'
  }
  if (!canEdit) {
    return NextResponse.json(
      { error: '수정 권한이 없습니다.' },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => ({}))
  // 선택 월(body.month)에 저장, 없으면 당월
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const month =
    typeof body.month === 'string' && /^\d{4}-\d{2}$/.test(body.month)
      ? body.month
      : `${now.getFullYear()}-${pad(now.getMonth() + 1)}`

  const fields: Record<string, unknown> = {}

  if ('settlement_rate' in body) {
    const n = Number(body.settlement_rate)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return NextResponse.json({ error: 'settlement_rate 값이 올바르지 않습니다.' }, { status: 400 })
    }
    fields.settlement_rate = Math.round(n * 10) / 10
  }

  if ('cert_usage_fee' in body) {
    if (body.cert_usage_fee === null) {
      fields.cert_usage_fee = null // 기본값(과목수×단가)으로 되돌림
    } else {
      const n = Number(body.cert_usage_fee)
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: 'cert_usage_fee 값이 올바르지 않습니다.' }, { status: 400 })
      }
      fields.cert_usage_fee = Math.round(n)
    }
  }

  if ('sgna_items' in body) {
    if (!Array.isArray(body.sgna_items)) {
      return NextResponse.json({ error: 'sgna_items는 배열이어야 합니다.' }, { status: 400 })
    }
    const items = (body.sgna_items as unknown[]).slice(0, 50).map((raw) => {
      const it = (raw ?? {}) as { label?: unknown; amount?: unknown; note?: unknown }
      const amt = Number(it.amount)
      return {
        label: String(it.label ?? '').slice(0, 40),
        amount: Number.isFinite(amt) && amt >= 0 ? Math.round(amt) : 0,
        note: String(it.note ?? '').slice(0, 80),
      }
    })
    fields.pnl_sgna_items = items
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: '저장할 값이 없습니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('profit_settings')
    .upsert(
      { division: DIVISION, month, ...fields, updated_at: new Date().toISOString() },
      { onConflict: 'division,month' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
