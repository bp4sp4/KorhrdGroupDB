import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { logAction } from '@/lib/audit/logAction'

// 민간자격증 사업부 매출파일 API
// Base: certificate_applications (source='bridge', payment_status='paid')
// Overlay: cert_sales (사용자 입력 — 과목수/특이사항/처리번호 등)
// 분류: '학점연계' = 자동 임포트 / '후납' = 수동 등록

const FIELD_LABELS: Record<string, string> = {
  category: '분류',
  unit_price: '단가',
  total_amount: '결제금액',
  payment_method: '결제방법',
  payment_date: '결제일',
  subject_count: '과목수',
  notes: '특이사항',
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

// 대리 이상 직급 = 전체 조회 가능 (edu-sales와 동일)
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
    .eq('section', 'cert-sales')
    .maybeSingle()
  if (!data || data.scope === 'none') return 'none'
  return data.scope === 'all' ? 'all' : 'own'
}

type PaymentMethod = 'bank_transfer' | 'card'
type RefundStatus = '정상' | '당월 환불' | '환불' | '정산' | '보류'
type Category = '학점연계' | '후납'

interface MergedItem {
  cert_application_id: string | null
  sale_id: string | null
  student_name: string
  phone: string | null
  manager_name: string | null
  category: Category
  unit_price: number | null
  subject_count: number | null
  total_amount: number | null
  payment_method: PaymentMethod | null
  payment_date: string | null
  cohort: string | null
  notes: string | null
  process_number: string | null
  issue_date: string | null
  is_published: boolean
  refund_status: RefundStatus
  refund_date: string | null
  created_at: string
}

// 페이앱 pay_method 값 → 우리 정규화 매핑
// payapp/카드 계열 → 'card', 계좌이체 계열 → 'bank_transfer', 그 외 null
function normalizePayMethod(raw: string | null | undefined): PaymentMethod | null {
  if (!raw) return null
  const s = raw.toLowerCase()
  if (s.includes('card') || s.includes('카드')) return 'card'
  if (s.includes('bank') || s.includes('transfer') || s.includes('계좌')) return 'bank_transfer'
  return null
}

// ─── GET /api/cert-sales ────────────────────────────────────────────────
// 학점연계 결제완료(certificate_applications) 전체를 행으로 노출 + cert_sales overlay
// + 후납 cert_sales(cert_application_id IS NULL) 별도 노출
// 쿼리: ?from=YYYY-MM-DD&to=YYYY-MM-DD&q=검색어
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

  // 1) 학점연계 결제완료 신청 (cert_application 기반)
  let appsQuery = supabaseAdmin
    .from('certificate_applications')
    .select('id, name, contact, amount, pay_method, paid_at, created_at, certificates')
    .eq('source', 'bridge')
    .eq('payment_status', 'paid')
    .is('deleted_at', null)
    .order('paid_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  const { data: apps, error: appsError } = await appsQuery
  if (appsError) return NextResponse.json({ error: appsError.message }, { status: 500 })

  // 2) cert_sales overlay 조회
  const appIds = (apps ?? []).map((a) => a.id as string)
  let overlays: Record<string, unknown>[] = []
  const hiddenAppIds = new Set<string>()
  if (appIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('cert_sales')
      .select('*')
      .in('cert_application_id', appIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    overlays = data ?? []
    // is_hidden=true overlay가 있으면 해당 base 행은 숨김
    for (const o of overlays) {
      if (o.is_hidden && o.cert_application_id) {
        hiddenAppIds.add(String(o.cert_application_id))
      }
    }
  }
  const overlayMap = new Map<string, Record<string, unknown>>()
  for (const o of overlays) {
    if (o.cert_application_id && !o.is_hidden) {
      overlayMap.set(String(o.cert_application_id), o)
    }
  }

  // 3) 학점연계 기반 행 머지 (숨김된 행 제외)
  interface CertApp {
    id: string
    name: string
    contact: string | null
    amount: number | null
    pay_method: string | null
    paid_at: string | null
    created_at: string
    certificates: string[] | null
  }
  const visibleApps = (apps ?? []).filter((a) => !hiddenAppIds.has(a.id as string))
  const items: MergedItem[] = visibleApps.map((a: CertApp): MergedItem => {
    const ov = overlayMap.get(a.id) ?? null
    const overlayManager = (ov?.manager_name as string | null | undefined) ?? null
    // 결제일 = overlay payment_date 우선, 없으면 paid_at(YYYY-MM-DD)
    const paidYmd = a.paid_at ? a.paid_at.slice(0, 10) : null
    return {
      cert_application_id: a.id,
      sale_id: ov ? (ov.id as string) : null,
      student_name: a.name,
      phone: a.contact ?? null,
      manager_name: overlayManager,
      category: (ov?.category as Category | undefined) ?? '학점연계',
      unit_price: (ov?.unit_price as number | null | undefined) ?? 5000,
      subject_count:
        (ov?.subject_count as number | null | undefined) ??
        (Array.isArray(a.certificates) ? a.certificates.length : null),
      total_amount: (ov?.total_amount as number | null | undefined) ?? a.amount ?? null,
      payment_method:
        (ov?.payment_method as PaymentMethod | null | undefined) ??
        normalizePayMethod(a.pay_method),
      payment_date: (ov?.payment_date as string | null | undefined) ?? paidYmd,
      cohort: (ov?.cohort as string | null | undefined) ?? paidYmd,
      notes: (ov?.notes as string | null | undefined) ?? null,
      process_number: (ov?.process_number as string | null | undefined) ?? null,
      issue_date: (ov?.issue_date as string | null | undefined) ?? null,
      is_published: (ov?.is_published as boolean | undefined) ?? false,
      refund_status: ((ov?.refund_status as RefundStatus | undefined) ?? '정상'),
      refund_date: (ov?.refund_date as string | null | undefined) ?? null,
      created_at: (ov?.created_at as string | undefined) ?? a.created_at,
    }
  })

  // 4) 후납 orphan cert_sales (cert_application_id IS NULL, is_hidden 제외)
  let orphanQuery = supabaseAdmin
    .from('cert_sales')
    .select('*')
    .is('cert_application_id', null)
    .eq('is_hidden', false)

  if (from) orphanQuery = orphanQuery.gte('payment_date', from)
  if (to) orphanQuery = orphanQuery.lte('payment_date', to)
  // own 권한이어도 담당자 미지정 행은 보여야 하므로 manager 필터는 아래 5단계에서 JS로 통합 처리
  const { data: orphanRows } = await orphanQuery
  const orphanItems: MergedItem[] = (orphanRows ?? []).map((r) => ({
    cert_application_id: null,
    sale_id: r.id as string,
    student_name: (r.student_name as string) ?? '',
    phone: (r.phone as string | null) ?? null,
    manager_name: (r.manager_name as string | null) ?? null,
    category: ((r.category as Category | undefined) ?? '후납'),
    unit_price: (r.unit_price as number | null) ?? 5000,
    subject_count: (r.subject_count as number | null) ?? null,
    total_amount: (r.total_amount as number | null) ?? null,
    payment_method: (r.payment_method as PaymentMethod | null) ?? null,
    payment_date: (r.payment_date as string | null) ?? null,
    cohort: (r.cohort as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    process_number: (r.process_number as string | null) ?? null,
    issue_date: (r.issue_date as string | null) ?? null,
    is_published: (r.is_published as boolean) ?? false,
    refund_status: ((r.refund_status as RefundStatus | undefined) ?? '정상'),
    refund_date: (r.refund_date as string | null) ?? null,
    created_at: (r.created_at as string) ?? new Date().toISOString(),
  }))

  // 5) own 권한 — 본인 담당 + 담당자 미지정(null/빈값) 행을 노출
  //    담당자가 없는 행을 숨기면 사원이 결제건을 못 봐서 매출을 중복 등록하는 문제가 있어,
  //    담당자 없는 행은 모두에게 보이도록 한다 (누락 방지).
  let visible: MergedItem[]
  if (canViewAll) {
    visible = [...items, ...orphanItems]
  } else {
    const mineOrUnassigned = (it: MergedItem) =>
      !it.manager_name || it.manager_name === appUser.display_name
    visible = [
      ...items.filter(mineOrUnassigned),
      ...orphanItems.filter(mineOrUnassigned),
    ]
  }

  // 6) 결제일 필터 (학점연계 행은 paid_at 기준, 후납은 payment_date 기준 — 위에서 적용됨)
  if (from || to) {
    visible = visible.filter((it) => {
      if (!it.payment_date) return false
      if (from && it.payment_date < from) return false
      if (to && it.payment_date > to) return false
      return true
    })
  }

  // 7) 검색
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

  // 8) 정렬 — 결제일 최신순
  visible.sort((a, b) => {
    const ta = a.payment_date ? new Date(a.payment_date).getTime() : 0
    const tb = b.payment_date ? new Date(b.payment_date).getTime() : 0
    return tb - ta
  })

  // 9) cohort 집합 (월별 탭 생성용)
  const cohortsSet = new Set<string>()
  for (const it of visible) if (it.cohort) cohortsSet.add(it.cohort)
  const cohorts = Array.from(cohortsSet)

  return NextResponse.json({ items: visible, canViewAll, cohorts })
}

interface SalesPayload {
  category?: Category | null
  unit_price?: number | null
  subject_count?: number | null
  total_amount?: number | null
  payment_method?: PaymentMethod | null
  payment_date?: string | null
  cohort?: string | null
  notes?: string | null
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
    'category', 'unit_price', 'subject_count', 'total_amount',
    'payment_method', 'payment_date', 'cohort', 'notes',
    'process_number', 'issue_date', 'is_published',
    'refund_status', 'refund_date', 'manager_name',
  ]
  for (const key of allowed) {
    if (key in body) out[key] = body[key]
  }
  // 환불완료 시 refund_date 자동 (KST 오늘)
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

// ─── POST /api/cert-sales ───────────────────────────────────────────────
// sale_id가 있으면: cert_sales row UPDATE
// cert_application_id가 있고 sale_id가 없으면: UPSERT (1:1)
// 둘 다 없으면: 후납 orphan INSERT (student_name 필수)
export async function POST(request: NextRequest) {
  const { user, appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const body = (await request.json()) as Partial<SalesPayload> & {
    sale_id?: string
    cert_application_id?: string | null
    student_name?: string
    phone?: string | null
  }

  // 1) sale_id가 있으면: 기존 row UPDATE
  if (body.sale_id) {
    const cleanBody = sanitize(body)
    const { data, error } = await supabaseAdmin
      .from('cert_sales')
      .update(cleanBody)
      .eq('id', body.sale_id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await logAction({
      user_id: user.id,
      user_email: user.email ?? null,
      action: 'update',
      resource: '민간자격증매출파일',
      resource_id: body.sale_id,
      detail: buildSalesDetail(
        (data?.student_name as string | null) ?? null,
        cleanBody,
      ),
    })
    return NextResponse.json(data)
  }

  // 2) cert_application_id가 있으면: UPSERT (학점연계 신청 1건당 매출 1건)
  if (body.cert_application_id) {
    // 학점연계 신청에서 학생 정보 가져오기
    const { data: app, error: appError } = await supabaseAdmin
      .from('certificate_applications')
      .select('id, name, contact')
      .eq('id', body.cert_application_id)
      .maybeSingle()
    if (appError) return NextResponse.json({ error: appError.message }, { status: 500 })
    if (!app) return NextResponse.json({ error: '학점연계 신청을 찾을 수 없습니다.' }, { status: 404 })

    const { data: existing } = await supabaseAdmin
      .from('cert_sales')
      .select('id, created_by')
      .eq('cert_application_id', body.cert_application_id)
      .maybeSingle()

    if (existing) {
      const cleanBody = sanitize(body)
      const { data, error } = await supabaseAdmin
        .from('cert_sales')
        .update(cleanBody)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await logAction({
        user_id: user.id,
        user_email: user.email ?? null,
        action: 'update',
        resource: '민간자격증매출파일',
        resource_id: existing.id as string,
        detail: buildSalesDetail(app.name as string, cleanBody),
      })
      return NextResponse.json(data)
    } else {
      const insertPayload = {
        ...sanitize(body),
        cert_application_id: body.cert_application_id,
        student_name: app.name,
        phone: app.contact,
        category: body.category ?? '학점연계',
        created_by: appUser.id,
      }
      const { data, error } = await supabaseAdmin
        .from('cert_sales')
        .insert(insertPayload)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await logAction({
        user_id: user.id,
        user_email: user.email ?? null,
        action: 'create',
        resource: '민간자격증매출파일',
        resource_id: (data?.id as string) ?? null,
        detail: `${app.name as string} - 매출 신규 생성`,
      })
      return NextResponse.json(data, { status: 201 })
    }
  }

  // 3) 둘 다 없으면: 후납 orphan INSERT (수동 등록)
  if (!body.student_name?.trim()) {
    return NextResponse.json(
      { error: 'sale_id, cert_application_id, 또는 student_name이 필요합니다.' },
      { status: 400 },
    )
  }
  const insertPayload = {
    ...sanitize(body),
    cert_application_id: null,
    student_name: body.student_name.trim(),
    phone: body.phone ?? null,
    category: body.category ?? '후납',
    created_by: appUser.id,
  }
  const { data, error } = await supabaseAdmin
    .from('cert_sales')
    .insert(insertPayload)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAction({
    user_id: user.id,
    user_email: user.email ?? null,
    action: 'create',
    resource: '민간자격증매출파일',
    resource_id: (data?.id as string) ?? null,
    detail: `${body.student_name.trim()} - 후납 매출 생성`,
  })
  return NextResponse.json(data, { status: 201 })
}

// ─── DELETE /api/cert-sales?sale_id=xxx OR ?cert_application_id=xxx ───
// 후납 orphan(cert_application_id 없는 cert_sales): 하드 삭제
// 학점연계 base 행(cert_application_id 있음): cert_sales overlay에 is_hidden=true 설정 (소프트 삭제)
export async function DELETE(request: NextRequest) {
  const { user, appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const saleId = searchParams.get('sale_id')
  const certAppId = searchParams.get('cert_application_id')
  if (!saleId && !certAppId) {
    return NextResponse.json(
      { error: 'sale_id 또는 cert_application_id가 필요합니다.' },
      { status: 400 },
    )
  }

  const isFullAccess = appUser.role === 'admin' || appUser.role === 'master-admin'
  const canEditAll = isFullAccess || (await isHigherPosition(appUser.position_id))

  // sale_id로 지정된 경우 — 기존 cert_sales row 찾기
  if (saleId) {
    const { data: existing } = await supabaseAdmin
      .from('cert_sales')
      .select('id, created_by, student_name, cert_application_id')
      .eq('id', saleId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: '매출 기록이 없습니다.' }, { status: 404 })
    }
    if (!canEditAll && String(existing.created_by) !== String(appUser.id)) {
      return NextResponse.json({ error: '본인 등록 건만 삭제 가능합니다.' }, { status: 403 })
    }

    // cert_application_id가 있으면 소프트 삭제 (is_hidden=true), 없으면 하드 삭제
    if (existing.cert_application_id) {
      const { error } = await supabaseAdmin
        .from('cert_sales')
        .update({ is_hidden: true })
        .eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabaseAdmin
        .from('cert_sales')
        .delete()
        .eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    await logAction({
      user_id: user.id,
      user_email: user.email ?? null,
      action: 'delete',
      resource: '민간자격증매출파일',
      resource_id: existing.id as string,
      detail: `${(existing.student_name as string) ?? '이름없음'} - 매출 ${existing.cert_application_id ? '숨김' : '삭제'}`,
    })
    return NextResponse.json({ ok: true })
  }

  // cert_application_id로 지정된 경우 — overlay 없는 base 행. overlay를 is_hidden=true로 생성
  const { data: app } = await supabaseAdmin
    .from('certificate_applications')
    .select('id, name, contact')
    .eq('id', certAppId!)
    .maybeSingle()
  if (!app) {
    return NextResponse.json({ error: '학점연계 신청을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 기존 overlay가 있으면 update, 없으면 insert
  const { data: existing } = await supabaseAdmin
    .from('cert_sales')
    .select('id')
    .eq('cert_application_id', certAppId!)
    .maybeSingle()

  if (existing) {
    const { error } = await supabaseAdmin
      .from('cert_sales')
      .update({ is_hidden: true })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabaseAdmin
      .from('cert_sales')
      .insert({
        cert_application_id: certAppId!,
        student_name: app.name as string,
        phone: (app.contact as string | null) ?? null,
        is_hidden: true,
        category: '학점연계',
        created_by: appUser.id,
      })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  await logAction({
    user_id: user.id,
    user_email: user.email ?? null,
    action: 'delete',
    resource: '민간자격증매출파일',
    resource_id: certAppId!,
    detail: `${app.name as string} - 매출 숨김`,
  })
  return NextResponse.json({ ok: true })
}
