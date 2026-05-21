import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { logAction } from '@/lib/audit/logAction'

// 매출파일 인라인 편집 — audit_logs용 한글 필드 라벨
const FIELD_LABELS: Record<string, string> = {
  cohort: '개강반',
  student_username: '학생ID',
  unit_price: '단가',
  total_amount: '매출',
  payment_method: '결제방법',
  payment_date: '결제일',
  subject_count: '과목수',
  notes: '특이사항',
  process_number: '처리번호',
  issue_date: '발급일자',
  is_published: '발행완료',
  refund_status: '환불',
  refund_date: '환불일',
  education_center_name: '교육원',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  payapp_transfer: '페이앱 계좌이체',
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

// 대리 이상 직급 = 전체 조회 가능
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

// 권한 체크: section 'edu-sales' 권한 확인
async function checkSalesPermission(userId: number): Promise<'all' | 'own' | 'none'> {
  const { data } = await supabaseAdmin
    .from('user_permissions')
    .select('scope')
    .eq('user_id', userId)
    .eq('section', 'edu-sales')
    .maybeSingle()
  if (!data || data.scope === 'none') return 'none'
  return data.scope === 'all' ? 'all' : 'own'
}

// ─── GET /api/edu-sales ───────────────────────────────────────────────
// 등록학생관리(edu_students) 전체를 행으로 노출 + 매출(edu_sales) 데이터 overlay
// scope: 'all' = 전체, 'own' = 본인 담당(manager_name == display_name)
// 쿼리: ?from=YYYY-MM-DD&to=YYYY-MM-DD&cohort=YYYY-MM&q=검색어
export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const cohort = searchParams.get('cohort')
  const q = (searchParams.get('q') ?? '').trim()

  const isFullAccess = appUser.role === 'admin' || appUser.role === 'master-admin'
  const isHigh = isFullAccess || (await isHigherPosition(appUser.position_id))
  // 권한 우선순위: admin/master-admin > position(대리이상) > user_permissions
  let canViewAll = isHigh
  if (!isFullAccess && !isHigh) {
    const scope = await checkSalesPermission(appUser.id)
    if (scope === 'none') {
      return NextResponse.json({ items: [], canViewAll: false })
    }
    canViewAll = scope === 'all'
  }

  let studentsQuery = supabaseAdmin
    .from('edu_students')
    .select(
      'id, name, phone, cost, unit_price, manager_name, education_center_name, class_start, status, course_id, registered_at, created_at, edu_courses(id, name)',
    )
    .order('registered_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (!canViewAll && appUser.display_name) {
    studentsQuery = studentsQuery.eq('manager_name', appUser.display_name)
  }

  // 활성 학생만 (환불/삭제예정 제외)
  studentsQuery = studentsQuery.not('status', 'eq', '삭제예정')

  const { data: students, error: studentsError } = await studentsQuery
  if (studentsError) {
    return NextResponse.json({ error: studentsError.message }, { status: 500 })
  }

  // 학생 ID 모음에 매칭되는 sales 조회 (cohort 필터는 머지 후 적용 — 학생 등록일 기준 cohort도 매칭되도록)
  const studentIds = (students ?? []).map(s => s.id)
  let sales: Record<string, unknown>[] = []
  if (studentIds.length > 0) {
    let salesQuery = supabaseAdmin
      .from('edu_sales')
      .select('*')
      .in('student_id', studentIds)

    if (from) salesQuery = salesQuery.gte('payment_date', from)
    if (to) salesQuery = salesQuery.lte('payment_date', to)

    const { data: salesData, error: salesError } = await salesQuery
    if (salesError) {
      return NextResponse.json({ error: salesError.message }, { status: 500 })
    }
    sales = salesData ?? []
  }


  // student_id → sales row 매핑
  const salesMap = new Map<string, Record<string, unknown>>()
  for (const s of sales) {
    if (s.student_id) salesMap.set(String(s.student_id), s)
  }

  // 학생 + 매출 머지
  interface StudentRow {
    id: string
    name: string
    phone: string | null
    cost: number | null
    unit_price: number | null
    manager_name: string | null
    education_center_name: string | null
    class_start: string | null
    status: string | null
    course_id: number | null
    registered_at: string | null
    created_at: string
    edu_courses?: { id: number; name: string } | { id: number; name: string }[] | null
  }
  interface MergedItem {
    student_id: string | null
    sale_id: string | null
    student_name: string
    phone: string | null
    manager_name: string | null
    education_center_name: string | null
    class_start: string | null
    course_name: string | null
    cohort: string | null
    student_username: string | null
    unit_price: number | null
    total_amount: number | null
    payment_method: 'payapp_transfer' | 'bank_transfer' | 'card' | null
    payment_date: string | null
    subject_count: number | null
    notes: string | null
    process_number: string | null
    issue_date: string | null
    is_published: boolean
    refund_status: '정상' | '당월 환불' | '환불' | '정산' | '보류'
    refund_date: string | null
    created_at: string
  }
  const items: MergedItem[] = (students ?? []).map((s: StudentRow): MergedItem => {
    const sale = salesMap.get(s.id) ?? null
    return {
      // identifier
      student_id: s.id,
      sale_id: sale ? (sale.id as string) : null,
      // 학생 정보 (등록학생관리에서 가져옴)
      student_name: s.name,
      phone: s.phone,
      manager_name: s.manager_name,
      // 학생이 있는 경우 학생 값 우선, 없으면 sale 행의 값(과거 데이터 보호용)
      education_center_name:
        s.education_center_name ??
        ((sale?.education_center_name as string | null | undefined) ?? null),
      class_start: s.class_start,
      course_name: Array.isArray(s.edu_courses)
        ? s.edu_courses[0]?.name ?? null
        : s.edu_courses?.name ?? null,
      // 매출 정보 (edu_sales overlay)
      // cohort 우선순위: 매출.cohort > 학생 등록일에서 추출(예: 5월)
      cohort: (sale?.cohort as string | null | undefined) ?? null,
      student_username: (sale?.student_username as string | null | undefined) ?? null,
      // 단가: 매출 row의 값은 그대로(이미 학점당 단가), 학생 데이터 fallback은 ÷3 (과목당비용 → 학점당단가, 1과목=3학점)
      unit_price:
        (sale?.unit_price as number | null | undefined) ??
        (s.unit_price != null ? Math.round(s.unit_price / 3) : null),
      total_amount: (sale?.total_amount as number | null | undefined) ?? s.cost ?? null,
      payment_method: (sale?.payment_method as 'payapp_transfer' | 'bank_transfer' | 'card' | null | undefined) ?? null,
      payment_date: (sale?.payment_date as string | null | undefined) ?? null,
      subject_count: (sale?.subject_count as number | null | undefined) ?? null,
      notes: (sale?.notes as string | null | undefined) ?? null,
      process_number: (sale?.process_number as string | null | undefined) ?? null,
      issue_date: (sale?.issue_date as string | null | undefined) ?? null,
      is_published: (sale?.is_published as boolean | undefined) ?? false,
      refund_status: ((sale?.refund_status as '정상' | '당월 환불' | '환불' | '정산' | '보류' | undefined) ?? '정상'),
      refund_date: (sale?.refund_date as string | null | undefined) ?? null,
      created_at: (sale?.created_at as string | undefined) ?? s.created_at,
    }
  })

  // cohort 필터 (현재 월 탭)
  let filtered = items
  if (cohort) {
    filtered = filtered.filter((it) => it.cohort === cohort)
  }
  // 검색 (현재 월 안에서만)
  if (q) {
    const lq = q.toLowerCase()
    filtered = filtered.filter(
      (it) =>
        (it.student_name ?? '').toLowerCase().includes(lq) ||
        (it.student_username ?? '').toLowerCase().includes(lq) ||
        (it.phone ?? '').toLowerCase().includes(lq) ||
        (it.manager_name ?? '').toLowerCase().includes(lq) ||
        (it.process_number ?? '').toLowerCase().includes(lq),
    )
  }

  // from/to (결제일 필터)는 sales 있는 행에만 의미가 있음
  const hasDateFilter = !!(from || to)
  const out = hasDateFilter ? filtered.filter((it) => !!it.sale_id) : filtered

  // ─── 학생 없는(과거) 매출 데이터 — student_id IS NULL인 orphan sales ────
  let orphanQuery = supabaseAdmin
    .from('edu_sales')
    .select('*')
    .is('student_id', null)

  if (from) orphanQuery = orphanQuery.gte('payment_date', from)
  if (to) orphanQuery = orphanQuery.lte('payment_date', to)
  // 현재 월 탭에 한해 orphan 매출도 조회
  if (cohort) orphanQuery = orphanQuery.eq('cohort', cohort)
  if (!canViewAll && appUser.display_name) {
    orphanQuery = orphanQuery.eq('manager_name', appUser.display_name)
  }

  const { data: orphanRows } = await orphanQuery
  const orphanItems = (orphanRows ?? []).map((r) => ({
    student_id: null as string | null,
    sale_id: r.id as string,
    student_name: (r.student_name as string) ?? '',
    phone: (r.phone as string | null) ?? null,
    manager_name: (r.manager_name as string | null) ?? null,
    education_center_name: (r.education_center_name as string | null) ?? null,
    class_start: null as string | null,
    course_name: null as string | null,
    cohort: (r.cohort as string | null) ?? null,
    student_username: (r.student_username as string | null) ?? null,
    unit_price: (r.unit_price as number | null) ?? null,
    total_amount: (r.total_amount as number | null) ?? null,
    payment_method: (r.payment_method as 'payapp_transfer' | 'bank_transfer' | 'card' | null) ?? null,
    payment_date: (r.payment_date as string | null) ?? null,
    subject_count: (r.subject_count as number | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    process_number: (r.process_number as string | null) ?? null,
    issue_date: (r.issue_date as string | null) ?? null,
    is_published: (r.is_published as boolean) ?? false,
    refund_status: ((r.refund_status as '정상' | '당월 환불' | '환불' | '정산' | '보류' | undefined) ?? '정상'),
    refund_date: (r.refund_date as string | null) ?? null,
    created_at: (r.created_at as string) ?? new Date().toISOString(),
  }))

  // orphan 매출에도 검색어 필터 적용 (검색 시 cohort 무시)
  const filteredOrphans = q
    ? orphanItems.filter((it) => {
        const lq = q.toLowerCase()
        return (
          (it.student_name ?? '').toLowerCase().includes(lq) ||
          (it.student_username ?? '').toLowerCase().includes(lq) ||
          (it.phone ?? '').toLowerCase().includes(lq) ||
          (it.manager_name ?? '').toLowerCase().includes(lq) ||
          (it.process_number ?? '').toLowerCase().includes(lq)
        )
      })
    : orphanItems

  // 학생 + 매출 머지된 행 + orphan 매출 행 합치기 — 결제일 최신순 (없으면 created_at)
  const combined = [...out, ...filteredOrphans].sort((a, b) => {
    const ta = a.payment_date
      ? new Date(a.payment_date).getTime()
      : a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.payment_date
      ? new Date(b.payment_date).getTime()
      : b.created_at ? new Date(b.created_at).getTime() : 0
    return tb - ta
  })

  // 월별 탭 생성용 cohort 집합 (학생 행 + orphan 모두)
  const allCohortsSet = new Set<string>()
  for (const it of items) if (it.cohort) allCohortsSet.add(it.cohort)
  for (const it of orphanItems) if (it.cohort) allCohortsSet.add(it.cohort)
  const cohorts = Array.from(allCohortsSet)

  return NextResponse.json({ items: combined, canViewAll, cohorts })
}

interface SalesPayload {
  student_id: string
  cohort?: string | null
  student_username?: string | null
  unit_price?: number | null
  total_amount?: number | null
  payment_method?: 'payapp_transfer' | 'bank_transfer' | 'card' | null
  payment_date?: string | null
  subject_count?: number | null
  notes?: string | null
  process_number?: string | null
  issue_date?: string | null
  is_published?: boolean
  refund_status?: '정상' | '당월 환불' | '환불' | '정산' | '보류' | null
  refund_date?: string | null
  // sale 자체에 보관 (학생이 없는 orphan 매출의 교육원)
  education_center_name?: string | null
}

function sanitize(body: Partial<SalesPayload>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const allowed: (keyof SalesPayload)[] = [
    'cohort', 'student_username', 'unit_price', 'total_amount',
    'payment_method', 'payment_date', 'subject_count', 'notes',
    'process_number', 'issue_date', 'is_published',
    'refund_status', 'refund_date',
    'education_center_name',
  ]
  for (const key of allowed) {
    if (key in body) out[key] = body[key]
  }
  // 환불완료 시 refund_date 자동 (오늘 KST) — 명시적으로 빈값이 안 왔을 때만
  if (body.refund_status === '환불' && !('refund_date' in body)) {
    const kst = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }),
    )
    const y = kst.getFullYear()
    const m = String(kst.getMonth() + 1).padStart(2, '0')
    const d = String(kst.getDate()).padStart(2, '0')
    out.refund_date = `${y}-${m}-${d}`
  }
  // 정상 또는 환불대기로 되돌리면 refund_date 비우기
  if (body.refund_status === '정상' || body.refund_status === '당월 환불') {
    out.refund_date = null
  }
  return out
}

// 매출 환불 상태와 등록학생 상태 동기화
// 환불완료 → 학생 status='환불' (환불목록 자동 편입)
// 환불 해제(정상/환불대기) → 학생이 '환불'이었던 경우에만 '등록'으로 복구
async function syncStudentStatusByRefund(
  studentId: string | null | undefined,
  refundStatus: '정상' | '당월 환불' | '환불' | '정산' | '보류' | null | undefined,
) {
  if (!studentId || refundStatus === undefined) return
  if (refundStatus === '환불') {
    await supabaseAdmin
      .from('edu_students')
      .update({ status: '환불', updated_at: new Date().toISOString() })
      .eq('id', studentId)
      .neq('status', '환불') // 이미 환불이면 갱신 생략
    return
  }
  if (refundStatus === '정상' || refundStatus === '당월 환불') {
    await supabaseAdmin
      .from('edu_students')
      .update({ status: '등록', updated_at: new Date().toISOString() })
      .eq('id', studentId)
      .eq('status', '환불') // 환불 상태였던 학생만 복구 (수동 변경된 다른 상태는 보존)
  }
}

// ─── POST /api/edu-sales ──────────────────────────────────────────────
// sale_id 있으면 해당 매출 row UPDATE (인라인 편집용)
// student_id 있으면 학생에 연결된 매출 UPSERT (학생당 1건)
// student_id 없으면 orphan 매출로 INSERT (과거 데이터 등)
export async function POST(request: NextRequest) {
  const { user, appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const body = (await request.json()) as Partial<SalesPayload> & {
    sale_id?: string
    student_name?: string
    phone?: string | null
    manager_name?: string | null
    // 학생 행 직접 수정용 (edu_students 업데이트)
    education_center_name?: string | null
  }

  // 학생 필드(education_center_name)는 sale이 아닌 edu_students를 업데이트
  // student_id를 직접 받거나, sale_id로부터 조회해서 결정
  if ('education_center_name' in body) {
    let targetStudentId: string | null = body.student_id ?? null
    if (!targetStudentId && body.sale_id) {
      const { data: saleRow } = await supabaseAdmin
        .from('edu_sales')
        .select('student_id')
        .eq('id', body.sale_id)
        .maybeSingle()
      targetStudentId = (saleRow?.student_id as string | null) ?? null
    }
    if (targetStudentId) {
      await supabaseAdmin
        .from('edu_students')
        .update({
          education_center_name: body.education_center_name ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetStudentId)
    }
  }

  // sale_id가 있으면: 기존 row 직접 UPDATE (인라인 편집)
  if (body.sale_id) {
    const cleanBody = sanitize(body)
    const { data, error } = await supabaseAdmin
      .from('edu_sales')
      .update(cleanBody)
      .eq('id', body.sale_id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if ('refund_status' in body) {
      await syncStudentStatusByRefund(
        data?.student_id as string | null,
        body.refund_status,
      )
    }
    // education_center_name만 단독으로 보낸 경우(학생 행만 업데이트)도 로그에 포함
    const changesForLog: Record<string, unknown> = { ...cleanBody }
    if ('education_center_name' in body) {
      changesForLog.education_center_name = body.education_center_name
    }
    await logAction({
      user_id: user.id,
      user_email: user.email ?? null,
      action: 'update',
      resource: '매출파일',
      resource_id: body.sale_id,
      detail: buildSalesDetail(
        (data?.student_name as string | null) ?? null,
        changesForLog,
      ),
    })
    return NextResponse.json(data)
  }

  // student_id가 있으면: 학생 연동 매출 UPSERT
  if (body.student_id) {
    const { data: student, error: stuError } = await supabaseAdmin
      .from('edu_students')
      .select('id, name, phone, manager_name')
      .eq('id', body.student_id)
      .maybeSingle()
    if (stuError) return NextResponse.json({ error: stuError.message }, { status: 500 })
    if (!student) return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 })

    const { data: existing } = await supabaseAdmin
      .from('edu_sales')
      .select('id, created_by')
      .eq('student_id', body.student_id)
      .maybeSingle()

    if (existing) {
      const cleanBody = sanitize(body)
      const { data, error } = await supabaseAdmin
        .from('edu_sales')
        .update(cleanBody)
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if ('refund_status' in body) {
        await syncStudentStatusByRefund(body.student_id, body.refund_status)
      }
      const changesForLog: Record<string, unknown> = { ...cleanBody }
      if ('education_center_name' in body) {
        changesForLog.education_center_name = body.education_center_name
      }
      await logAction({
        user_id: user.id,
        user_email: user.email ?? null,
        action: 'update',
        resource: '매출파일',
        resource_id: existing.id,
        detail: buildSalesDetail(student.name as string | null, changesForLog),
      })
      return NextResponse.json(data)
    } else {
      const insertPayload = {
        ...sanitize(body),
        student_id: body.student_id,
        student_name: student.name,
        phone: student.phone,
        manager_name: student.manager_name,
        created_by: appUser.id,
      }
      const { data, error } = await supabaseAdmin
        .from('edu_sales')
        .insert(insertPayload)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if ('refund_status' in body) {
        await syncStudentStatusByRefund(body.student_id, body.refund_status)
      }
      await logAction({
        user_id: user.id,
        user_email: user.email ?? null,
        action: 'create',
        resource: '매출파일',
        resource_id: (data?.id as string) ?? null,
        detail: `${student.name as string} - 매출 신규 생성`,
      })
      return NextResponse.json(data, { status: 201 })
    }
  }

  // student_id 없으면: orphan 매출 (과거 데이터)
  if (!body.student_name?.trim()) {
    return NextResponse.json(
      { error: 'student_id 또는 student_name이 필요합니다.' },
      { status: 400 },
    )
  }
  const insertPayload = {
    ...sanitize(body),
    student_id: null,
    student_name: body.student_name.trim(),
    phone: body.phone ?? null,
    manager_name: body.manager_name ?? null,
    created_by: appUser.id,
  }
  const { data, error } = await supabaseAdmin
    .from('edu_sales')
    .insert(insertPayload)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAction({
    user_id: user.id,
    user_email: user.email ?? null,
    action: 'create',
    resource: '매출파일',
    resource_id: (data?.id as string) ?? null,
    detail: `${body.student_name?.trim() ?? '이름없음'} - orphan 매출 생성`,
  })
  return NextResponse.json(data, { status: 201 })
}

// ─── DELETE /api/edu-sales?student_id=xxx or ?sale_id=xxx ─────────────
// 학생의 매출 기록 또는 orphan 매출 직접 삭제
export async function DELETE(request: NextRequest) {
  const { user, appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('student_id')
  const saleId = searchParams.get('sale_id')
  if (!studentId && !saleId) {
    return NextResponse.json({ error: 'student_id 또는 sale_id가 필요합니다.' }, { status: 400 })
  }

  const isFullAccess = appUser.role === 'admin' || appUser.role === 'master-admin'
  const canEditAll = isFullAccess || (await isHigherPosition(appUser.position_id))

  const { data: existing } = saleId
    ? await supabaseAdmin
        .from('edu_sales')
        .select('id, created_by, student_name')
        .eq('id', saleId)
        .maybeSingle()
    : await supabaseAdmin
        .from('edu_sales')
        .select('id, created_by, student_name')
        .eq('student_id', studentId!)
        .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: '매출 기록이 없습니다.' }, { status: 404 })
  }
  if (!canEditAll && String(existing.created_by) !== String(appUser.id)) {
    return NextResponse.json({ error: '본인 등록 건만 삭제 가능합니다.' }, { status: 403 })
  }

  const { error } = await supabaseAdmin.from('edu_sales').delete().eq('id', existing.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAction({
    user_id: user.id,
    user_email: user.email ?? null,
    action: 'delete',
    resource: '매출파일',
    resource_id: existing.id as string,
    detail: `${(existing.student_name as string) ?? '이름없음'} - 매출 삭제`,
  })
  return NextResponse.json({ ok: true })
}
