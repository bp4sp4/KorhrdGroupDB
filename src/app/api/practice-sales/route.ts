import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { logAction } from '@/lib/audit/logAction'

// 실습 사업부 매출파일 API
// Base: practice_applications (payment_status='paid')
// Overlay: practice_sales (사용자 입력 — 처리번호/발급일자/발행완료/환불/담당자/분류)
// 분류: '실습' = 자동 임포트 / '후납' = 수동 등록

const FIELD_LABELS: Record<string, string> = {
  category: '분류',
  total_amount: '결제금액',
  payment_method: '결제방법',
  payment_date: '결제일',
  process_number: '처리번호',
  issue_date: '발급일자',
  is_published: '발행완료',
  refund_status: '환불',
  refund_date: '환불일',
  manager_name: '담당자',
  cohort: '개강반',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: '계좌이체',
  card: '카드결제',
  payapp_transfer: '페이앱 계좌이체',
}

function formatDetailValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '비움'
  if (key === 'payment_method' && typeof value === 'string') {
    return PAYMENT_METHOD_LABELS[value] ?? value
  }
  if (key === 'is_published') return value ? '완료' : '대기'
  return String(value)
}

function buildSalesDetail(
  studentName: string | null | undefined,
  changes: Record<string, unknown>,
): string {
  const prefix = studentName ? `${studentName} - ` : ''
  const parts = Object.entries(changes)
    .filter(([k]) => k !== 'updated_at' && k !== 'created_by' && k in FIELD_LABELS)
    .map(([k, v]) => `${FIELD_LABELS[k]}: ${formatDetailValue(k, v)}`)
  if (parts.length === 0) return `${prefix}수정`
  return `${prefix}${parts.join(', ')}`
}

const HIGHER_POSITION_KEYWORDS = [
  '대리', '과장', '차장', '부장', '이사', '대표', '원장', '실장', '본부장', '팀장',
]

async function isHigherPosition(positionId: string | null | undefined): Promise<boolean> {
  if (!positionId) return false
  const { data } = await supabaseAdmin
    .from('positions')
    .select('name')
    .eq('id', positionId)
    .maybeSingle()
  const name = String(data?.name ?? '').replace(/\s+/g, '')
  return HIGHER_POSITION_KEYWORDS.some(k => name.includes(k))
}

async function checkSalesPermission(userId: number): Promise<'all' | 'own' | 'none'> {
  const { data } = await supabaseAdmin
    .from('user_permissions')
    .select('scope')
    .eq('user_id', userId)
    .eq('section', 'practice-sales')
    .maybeSingle()
  if (!data || data.scope === 'none') return 'none'
  return data.scope === 'all' ? 'all' : 'own'
}

type PaymentMethod = 'bank_transfer' | 'card' | 'payapp_transfer'
type RefundStatus = '정상' | '당월 환불' | '환불' | '정산' | '보류'
type Category = '실습' | '후납'

interface MergedItem {
  practice_application_id: string | null
  sale_id: string | null
  student_name: string
  phone: string | null
  manager_name: string | null
  category: Category
  total_amount: number | null
  payment_method: PaymentMethod | null
  payment_date: string | null
  cohort: string | null
  process_number: string | null
  issue_date: string | null
  is_published: boolean
  refund_status: RefundStatus
  refund_date: string | null
  created_at: string
}

function normalizePayMethod(raw: string | null | undefined): PaymentMethod | null {
  if (!raw) return null
  const s = raw.toLowerCase()
  if (s.includes('payapp') || s.includes('페이앱')) return 'payapp_transfer'
  if (s.includes('card') || s.includes('카드')) return 'card'
  if (s.includes('bank') || s.includes('transfer') || s.includes('계좌')) return 'bank_transfer'
  return null
}

// ─── GET /api/practice-sales ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const q = (searchParams.get('q') ?? '').trim()

  const isFullAccess = appUser.role === 'admin' || appUser.role === 'master-admin'
  const isHigh = isFullAccess || (await isHigherPosition(appUser.position_id))
  let canViewAll = isHigh
  if (!isFullAccess && !isHigh) {
    const scope = await checkSalesPermission(appUser.id)
    if (scope === 'none') {
      return NextResponse.json({ items: [], canViewAll: false, cohorts: [] })
    }
    canViewAll = scope === 'all'
  }

  // 1) 결제완료 practice_applications
  const { data: apps, error: appsError } = await supabaseAdmin
    .from('practice_applications')
    .select('id, name, contact, payment_amount, payment_method, payment_status, created_at')
    .eq('payment_status', 'paid')
    .order('created_at', { ascending: false })

  if (appsError) return NextResponse.json({ error: appsError.message }, { status: 500 })

  // 2) overlay 조회
  const appIds = (apps ?? []).map((a) => a.id as string)
  let overlays: Record<string, unknown>[] = []
  const hiddenAppIds = new Set<string>()
  if (appIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('practice_sales')
      .select('*')
      .in('practice_application_id', appIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    overlays = data ?? []
    for (const o of overlays) {
      if (o.is_hidden && o.practice_application_id) {
        hiddenAppIds.add(String(o.practice_application_id))
      }
    }
  }
  const overlayMap = new Map<string, Record<string, unknown>>()
  for (const o of overlays) {
    if (o.practice_application_id && !o.is_hidden) {
      overlayMap.set(String(o.practice_application_id), o)
    }
  }

  interface PracticeApp {
    id: string
    name: string
    contact: string | null
    payment_amount: number | null
    payment_method: string | null
    payment_status: string | null
    created_at: string
  }
  const visibleApps = (apps ?? []).filter((a) => !hiddenAppIds.has(a.id as string))
  const items: MergedItem[] = visibleApps.map((a: PracticeApp): MergedItem => {
    const ov = overlayMap.get(a.id) ?? null
    const createdYmd = a.created_at ? a.created_at.slice(0, 10) : null
    return {
      practice_application_id: a.id,
      sale_id: ov ? (ov.id as string) : null,
      student_name: a.name,
      phone: a.contact ?? null,
      manager_name: (ov?.manager_name as string | null | undefined) ?? '한지연',
      category: (ov?.category as Category | undefined) ?? '실습',
      total_amount: (ov?.total_amount as number | null | undefined) ?? a.payment_amount ?? null,
      payment_method:
        (ov?.payment_method as PaymentMethod | null | undefined) ??
        (a.payment_method as PaymentMethod | null) ??
        'card',
      payment_date: (ov?.payment_date as string | null | undefined) ?? createdYmd,
      cohort: (ov?.cohort as string | null | undefined) ?? createdYmd,
      process_number: (ov?.process_number as string | null | undefined) ?? null,
      issue_date: (ov?.issue_date as string | null | undefined) ?? null,
      is_published: (ov?.is_published as boolean | undefined) ?? false,
      refund_status: ((ov?.refund_status as RefundStatus | undefined) ?? '정상'),
      refund_date: (ov?.refund_date as string | null | undefined) ?? null,
      created_at: (ov?.created_at as string | undefined) ?? a.created_at,
    }
  })

  // 3) 후납 orphan
  let orphanQuery = supabaseAdmin
    .from('practice_sales')
    .select('*')
    .is('practice_application_id', null)
    .eq('is_hidden', false)
  if (from) orphanQuery = orphanQuery.gte('payment_date', from)
  if (to) orphanQuery = orphanQuery.lte('payment_date', to)
  if (!canViewAll && appUser.display_name) {
    orphanQuery = orphanQuery.eq('manager_name', appUser.display_name)
  }
  const { data: orphanRows } = await orphanQuery
  const orphanItems: MergedItem[] = (orphanRows ?? []).map((r) => ({
    practice_application_id: null,
    sale_id: r.id as string,
    student_name: (r.student_name as string) ?? '',
    phone: (r.phone as string | null) ?? null,
    manager_name: (r.manager_name as string | null) ?? '한지연',
    category: ((r.category as Category | undefined) ?? '후납'),
    total_amount: (r.total_amount as number | null) ?? null,
    payment_method: (r.payment_method as PaymentMethod | null) ?? null,
    payment_date: (r.payment_date as string | null) ?? null,
    cohort: (r.cohort as string | null) ?? null,
    process_number: (r.process_number as string | null) ?? null,
    issue_date: (r.issue_date as string | null) ?? null,
    is_published: (r.is_published as boolean) ?? false,
    refund_status: ((r.refund_status as RefundStatus | undefined) ?? '정상'),
    refund_date: (r.refund_date as string | null) ?? null,
    created_at: (r.created_at as string) ?? new Date().toISOString(),
  }))

  let visible = canViewAll
    ? [...items, ...orphanItems]
    : [
        ...items.filter((it) => it.manager_name === appUser.display_name),
        ...orphanItems,
      ]

  if (from || to) {
    visible = visible.filter((it) => {
      if (!it.payment_date) return false
      if (from && it.payment_date < from) return false
      if (to && it.payment_date > to) return false
      return true
    })
  }

  if (q) {
    const lq = q.toLowerCase()
    visible = visible.filter(
      (it) =>
        (it.student_name ?? '').toLowerCase().includes(lq) ||
        (it.phone ?? '').toLowerCase().includes(lq) ||
        (it.manager_name ?? '').toLowerCase().includes(lq) ||
        (it.process_number ?? '').toLowerCase().includes(lq),
    )
  }

  visible.sort((a, b) => {
    const ta = a.payment_date ? new Date(a.payment_date).getTime() : 0
    const tb = b.payment_date ? new Date(b.payment_date).getTime() : 0
    return tb - ta
  })

  const cohortsSet = new Set<string>()
  for (const it of visible) if (it.cohort) cohortsSet.add(it.cohort)
  const cohorts = Array.from(cohortsSet)

  // 사용하지 않는 매개변수 방어
  void normalizePayMethod
  return NextResponse.json({ items: visible, canViewAll, cohorts })
}

interface SalesPayload {
  category?: Category | null
  total_amount?: number | null
  payment_method?: PaymentMethod | null
  payment_date?: string | null
  cohort?: string | null
  process_number?: string | null
  issue_date?: string | null
  is_published?: boolean
  refund_status?: RefundStatus | null
  refund_date?: string | null
  manager_name?: string | null
}

function sanitize(body: Partial<SalesPayload>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const allowed: (keyof SalesPayload)[] = [
    'category', 'total_amount',
    'payment_method', 'payment_date', 'cohort',
    'process_number', 'issue_date', 'is_published',
    'refund_status', 'refund_date', 'manager_name',
  ]
  for (const key of allowed) {
    if (key in body) out[key] = body[key]
  }
  if (body.refund_status === '환불' && !('refund_date' in body)) {
    const kst = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }),
    )
    const y = kst.getFullYear()
    const m = String(kst.getMonth() + 1).padStart(2, '0')
    const d = String(kst.getDate()).padStart(2, '0')
    out.refund_date = `${y}-${m}-${d}`
  }
  if (body.refund_status === '정상' || body.refund_status === '당월 환불') {
    out.refund_date = null
  }
  return out
}

// ─── POST /api/practice-sales ───────────────────────────────────────
export async function POST(request: NextRequest) {
  const { user, appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const body = (await request.json()) as Partial<SalesPayload> & {
    sale_id?: string
    practice_application_id?: string | null
    student_name?: string
    phone?: string | null
  }

  if (body.sale_id) {
    const cleanBody = sanitize(body)
    const { data, error } = await supabaseAdmin
      .from('practice_sales')
      .update(cleanBody)
      .eq('id', body.sale_id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAction({
      user_id: user.id,
      user_email: user.email ?? null,
      action: 'update',
      resource: '실습매출파일',
      resource_id: body.sale_id,
      detail: buildSalesDetail(
        (data?.student_name as string | null) ?? null,
        cleanBody,
      ),
    })
    return NextResponse.json(data)
  }

  if (body.practice_application_id) {
    const { data: app, error: appError } = await supabaseAdmin
      .from('practice_applications')
      .select('id, name, contact')
      .eq('id', body.practice_application_id)
      .maybeSingle()
    if (appError) return NextResponse.json({ error: appError.message }, { status: 500 })
    if (!app) return NextResponse.json({ error: '실습 신청을 찾을 수 없습니다.' }, { status: 404 })

    const { data: existing } = await supabaseAdmin
      .from('practice_sales')
      .select('id, created_by')
      .eq('practice_application_id', body.practice_application_id)
      .maybeSingle()

    if (existing) {
      const cleanBody = sanitize(body)
      const { data, error } = await supabaseAdmin
        .from('practice_sales')
        .update(cleanBody)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await logAction({
        user_id: user.id,
        user_email: user.email ?? null,
        action: 'update',
        resource: '실습매출파일',
        resource_id: existing.id as string,
        detail: buildSalesDetail(app.name as string, cleanBody),
      })
      return NextResponse.json(data)
    } else {
      const insertPayload = {
        ...sanitize(body),
        practice_application_id: body.practice_application_id,
        student_name: app.name,
        phone: app.contact,
        category: body.category ?? '실습',
        manager_name: body.manager_name ?? '한지연',
        created_by: appUser.id,
      }
      const { data, error } = await supabaseAdmin
        .from('practice_sales')
        .insert(insertPayload)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await logAction({
        user_id: user.id,
        user_email: user.email ?? null,
        action: 'create',
        resource: '실습매출파일',
        resource_id: (data?.id as string) ?? null,
        detail: `${app.name as string} - 매출 신규 생성`,
      })
      return NextResponse.json(data, { status: 201 })
    }
  }

  if (!body.student_name?.trim()) {
    return NextResponse.json(
      { error: 'sale_id, practice_application_id, 또는 student_name이 필요합니다.' },
      { status: 400 },
    )
  }
  const insertPayload = {
    ...sanitize(body),
    practice_application_id: null,
    student_name: body.student_name.trim(),
    phone: body.phone ?? null,
    category: body.category ?? '후납',
    manager_name: body.manager_name ?? '한지연',
    created_by: appUser.id,
  }
  const { data, error } = await supabaseAdmin
    .from('practice_sales')
    .insert(insertPayload)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAction({
    user_id: user.id,
    user_email: user.email ?? null,
    action: 'create',
    resource: '실습매출파일',
    resource_id: (data?.id as string) ?? null,
    detail: `${body.student_name.trim()} - 후납 매출 생성`,
  })
  return NextResponse.json(data, { status: 201 })
}

// ─── DELETE /api/practice-sales?sale_id=xxx OR ?practice_application_id=xxx ───
export async function DELETE(request: NextRequest) {
  const { user, appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const saleId = searchParams.get('sale_id')
  const appId = searchParams.get('practice_application_id')
  if (!saleId && !appId) {
    return NextResponse.json(
      { error: 'sale_id 또는 practice_application_id가 필요합니다.' },
      { status: 400 },
    )
  }

  const isFullAccess = appUser.role === 'admin' || appUser.role === 'master-admin'
  const canEditAll = isFullAccess || (await isHigherPosition(appUser.position_id))

  if (saleId) {
    const { data: existing } = await supabaseAdmin
      .from('practice_sales')
      .select('id, created_by, student_name, practice_application_id')
      .eq('id', saleId)
      .maybeSingle()
    if (!existing) {
      return NextResponse.json({ error: '매출 기록이 없습니다.' }, { status: 404 })
    }
    if (!canEditAll && String(existing.created_by) !== String(appUser.id)) {
      return NextResponse.json({ error: '본인 등록 건만 삭제 가능합니다.' }, { status: 403 })
    }
    if (existing.practice_application_id) {
      const { error } = await supabaseAdmin
        .from('practice_sales')
        .update({ is_hidden: true })
        .eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabaseAdmin
        .from('practice_sales')
        .delete()
        .eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    await logAction({
      user_id: user.id,
      user_email: user.email ?? null,
      action: 'delete',
      resource: '실습매출파일',
      resource_id: existing.id as string,
      detail: `${(existing.student_name as string) ?? '이름없음'} - 매출 ${existing.practice_application_id ? '숨김' : '삭제'}`,
    })
    return NextResponse.json({ ok: true })
  }

  const { data: app } = await supabaseAdmin
    .from('practice_applications')
    .select('id, name, contact')
    .eq('id', appId!)
    .maybeSingle()
  if (!app) {
    return NextResponse.json({ error: '실습 신청을 찾을 수 없습니다.' }, { status: 404 })
  }

  const { data: existing } = await supabaseAdmin
    .from('practice_sales')
    .select('id')
    .eq('practice_application_id', appId!)
    .maybeSingle()

  if (existing) {
    const { error } = await supabaseAdmin
      .from('practice_sales')
      .update({ is_hidden: true })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabaseAdmin
      .from('practice_sales')
      .insert({
        practice_application_id: appId!,
        student_name: app.name as string,
        phone: (app.contact as string | null) ?? null,
        is_hidden: true,
        category: '실습',
        manager_name: '한지연',
        created_by: appUser.id,
      })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  await logAction({
    user_id: user.id,
    user_email: user.email ?? null,
    action: 'delete',
    resource: '실습매출파일',
    resource_id: appId!,
    detail: `${app.name as string} - 매출 숨김`,
  })
  return NextResponse.json({ ok: true })
}
