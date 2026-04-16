import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { genDocNumber } from '@/lib/management/utils'
import { writeAuditLog } from '@/lib/management/auditLog'

type ApprovalContent = Record<string, unknown>
type ExpenseInsert = {
  approval_id: string
  expense_date: string
  department_id: string | null
  category_id?: string | null
  detail?: string | null
  amount: number
  payment_method: string
  vendor?: string | null
  memo?: string | null
}

async function getAuthUid(appUserId: string | number): Promise<string | null> {
  const { data: appUser } = await supabaseAdmin
    .from('app_users')
    .select('username')
    .eq('id', appUserId)
    .single()
  if (!appUser?.username) return null
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  if (error) return null
  return data.users.find(u => u.email === appUser.username)?.id ?? null
}

async function notifyUser(appUserId: string | number, type: string, title: string, message: string, link: string) {
  const authUid = await getAuthUid(appUserId)
  if (!authUid) return
  await supabaseAdmin.from('notifications').insert({ user_id: authUid, type, title, message, link })
}

function normalizeDocType(value: string): string {
  return value.replace(/\s/g, '')
}

function isCorporateCardExpenseDoc(docType: string): boolean {
  const normalized = normalizeDocType(docType)
  return normalized.includes('법인카드') && (
    normalized.includes('사용내역') ||
    normalized.includes('지출')
  )
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizeDate(value: unknown, fallback: string): string {
  const raw = asString(value)
  if (!raw) return fallback
  return raw.slice(0, 10)
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

async function getExpenseCategoryIdByName(rawName: unknown): Promise<string | null> {
  const name = asString(rawName)
  if (!name) return null

  const { data } = await supabaseAdmin
    .from('expense_categories')
    .select('id, name')
    .eq('is_active', true)

  const normalized = name.replace(/\s/g, '').toLowerCase()
  const matched = (data ?? []).find((item) =>
    item.name.replace(/\s/g, '').toLowerCase() === normalized
  )
  return matched?.id ?? null
}

async function buildApprovalExpenses(approval: {
  id: string
  document_type: string
  category?: string | null
  department_id?: string | null
  content?: ApprovalContent | null
}, completedAt: string): Promise<ExpenseInsert[]> {
  const content = approval.content ?? {}
  const fallbackDate = completedAt.slice(0, 10)
  const fallbackDept = approval.department_id ?? (asString(content.belong_dept) || null)
  const docType = normalizeDocType(approval.document_type)

  if (docType === '[결의서]지출결의서' || docType === 'expenseResolution') {
    const amount = asNumber(content.amount)
    if (!amount) return []

    return [{
      approval_id: approval.id,
      expense_date: normalizeDate(content.expense_date, fallbackDate),
      department_id: fallbackDept,
      detail: asString(content.detail) || '지출결의서',
      amount,
      payment_method: 'BANK_TRANSFER',
      vendor: asString(content.vendor_name) || null,
      memo: asString(content.special_note) || null,
    }]
  }

  if (isCorporateCardExpenseDoc(approval.document_type) || docType === 'corporateCard') {
    const items = parseJsonArray<{
      date?: string
      dept?: string
      merchant?: string
      detail?: string
      amount?: string | number
    }>(content.card_items)

    return items
      .map((item) => ({
        approval_id: approval.id,
        expense_date: normalizeDate(item.date, fallbackDate),
        department_id: asString(item.dept) || fallbackDept,
        detail: asString(item.detail) || '법인카드 사용',
        amount: asNumber(item.amount),
        payment_method: 'CORPORATE_CARD',
        vendor: asString(item.merchant) || null,
        memo: null,
      }))
      .filter((item) => item.amount > 0)
  }

  if (docType === '출장업무보고서' || docType === 'businessTripReport') {
    const tripCategoryId = await getExpenseCategoryIdByName('출장')
    const items = parseJsonArray<{ name?: string; amount?: string | number; note?: string }>(content.expense_items)

    return items
      .map((item) => ({
        approval_id: approval.id,
        expense_date: normalizeDate(content.trip_end || content.trip_start, fallbackDate),
        department_id: fallbackDept,
        category_id: tripCategoryId,
        detail: asString(item.name) || '출장 경비',
        amount: asNumber(item.amount),
        payment_method: 'OTHER',
        vendor: null,
        memo: asString(item.note) || null,
      }))
      .filter((item) => item.amount > 0)
  }

  if (docType === '[제휴]입금요청서' || docType === '[적립금]지출결의서') {
    const amount = asNumber(content.amount)
    if (!amount) return []

    return [{
      approval_id: approval.id,
      expense_date: normalizeDate(content.expense_date || content.payment_due, fallbackDate),
      department_id: fallbackDept,
      detail: asString(content.summary) || asString(content.partner_name) || approval.document_type,
      amount,
      payment_method: 'BANK_TRANSFER',
      vendor: asString(content.vendor_name) || null,
      memo: asString(content.special_note) || null,
    }]
  }

  if (
    docType === 'expense' ||
    docType === 'genericExpense' ||
    (approval.category === '회계' && content.amount) ||
    (content.expense_date && content.amount)
  ) {
    const amount = asNumber(content.amount)
    if (!amount) return []

    return [{
      approval_id: approval.id,
      expense_date: normalizeDate(content.expense_date || content.payment_due, fallbackDate),
      department_id: fallbackDept,
      category_id: asString(content.expense_category_id) || await getExpenseCategoryIdByName(content.expense_category),
      detail: asString(content.expense_detail) || approval.document_type,
      amount,
      payment_method: asString(content.payment_method) || 'OTHER',
      vendor: asString(content.vendor) || null,
      memo: asString(content.memo) || null,
    }]
  }

  return []
}

async function syncApprovalToExpenses(approval: {
  id: string
  document_type: string
  category?: string | null
  department_id?: string | null
  content?: ApprovalContent | null
}, completedAt: string) {
  const inserts = await buildApprovalExpenses(approval, completedAt)
  if (inserts.length === 0) return

  await supabaseAdmin.from('expenses').delete().eq('approval_id', approval.id)

  const { error } = await supabaseAdmin.from('expenses').insert(inserts)
  if (error) {
    throw new Error(error.message)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const appUser = await supabaseAdmin
    .from('app_users')
    .select('id, display_name')
    .eq('username', user.email)
    .single()
  const userId = appUser.data?.id ?? user.id

  const { data: approval } = await supabaseAdmin
    .from('approvals')
    .select('*')
    .eq('id', id)
    .single()

  if (!approval) return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 })
  if (approval.applicant_id !== userId) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  if (approval.status !== 'DRAFT') return NextResponse.json({ error: '임시저장 상태가 아닙니다.' }, { status: 400 })

  const body = await request.json()
  const { content, title, department_id, approver_ids, action } = body

  await supabaseAdmin.from('approvals').update({
    content: content ?? {},
    title,
    department_id: department_id || null,
  }).eq('id', id)

  if (action === 'submit' && approver_ids?.length) {
    const docNumber = genDocNumber(approval.category)

    await supabaseAdmin.from('approval_steps').delete().eq('approval_id', id)

    const steps = (approver_ids as string[]).map((approverId, idx) => ({
      approval_id: id,
      step_number: idx + 1,
      approver_id: approverId,
      status: 'PENDING',
    }))
    await supabaseAdmin.from('approval_steps').insert(steps)

    await supabaseAdmin.from('approvals').update({
      status: 'IN_PROGRESS',
      document_number: docNumber,
      current_step: 1,
      submitted_at: new Date().toISOString(),
    }).eq('id', id)

    await notifyUser(
      approver_ids[0],
      'APPROVAL_SUBMITTED',
      '결재 요청',
      `${(appUser.data as { display_name?: string } | null)?.display_name ?? ''}님이 [${approval.document_type}]를 상신했습니다.`,
      `/approvals?id=${id}`
    )
  }

  const { data } = await supabaseAdmin.from('approvals').select('*').eq('id', id).single()
  return NextResponse.json(data)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { data, error } = await supabaseAdmin
    .from('approvals')
    .select(`
      *,
      applicant:app_users!approvals_applicant_id_fkey(id, display_name),
      department:departments(id, code, name),
      steps:approval_steps(
        id, step_number, approver_id, status, comment, acted_at,
        approver:app_users!approval_steps_approver_id_fkey(id, display_name)
      )
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: '결재 문서를 찾을 수 없습니다.' }, { status: 404 })

  const sortedSteps = (data.steps ?? []).sort(
    (a: { step_number: number }, b: { step_number: number }) => a.step_number - b.step_number
  )

  return NextResponse.json({ ...data, steps: sortedSteps })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const appUser = await supabaseAdmin
    .from('app_users')
    .select('id, display_name')
    .eq('username', user.email)
    .single()
  const userId = appUser.data?.id ?? user.id

  const body = await request.json()
  const { action, comment } = body // action: 'approve' | 'reject' | 'cancel' | 'submit'

  const { data: approval, error: fetchErr } = await supabaseAdmin
    .from('approvals')
    .select('*, steps:approval_steps(*)')
    .eq('id', id)
    .single()

  if (fetchErr || !approval) {
    return NextResponse.json({ error: '결재 문서를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (action === 'cancel') {
    if (approval.applicant_id !== userId) {
      return NextResponse.json({ error: '본인의 결재만 취소할 수 있습니다.' }, { status: 403 })
    }
    if (!['DRAFT', 'SUBMITTED'].includes(approval.status)) {
      return NextResponse.json({ error: '취소할 수 없는 상태입니다.' }, { status: 400 })
    }
    await supabaseAdmin.from('approvals').update({ status: 'CANCELLED' }).eq('id', id)
    return NextResponse.json({ success: true })
  }

  if (action === 'submit') {
    if (approval.status !== 'DRAFT') {
      return NextResponse.json({ error: '임시저장 상태에서만 상신할 수 있습니다.' }, { status: 400 })
    }
    const docNumber = genDocNumber(approval.category)
    await supabaseAdmin.from('approvals').update({
      status: 'IN_PROGRESS',
      document_number: docNumber,
      current_step: 1,
      submitted_at: new Date().toISOString(),
    }).eq('id', id)
    return NextResponse.json({ success: true })
  }

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: '잘못된 action입니다.' }, { status: 400 })
  }

  // 현재 단계의 결재자인지 확인
  const sortedSteps = ((approval.steps as { step_number: number; approver_id: string; id: string; status: string }[]) ?? [])
    .sort((a, b) => a.step_number - b.step_number)

  const currentStep = sortedSteps.find(
    (s) => s.step_number === approval.current_step && s.status === 'PENDING'
  )

  if (!currentStep || currentStep.approver_id !== userId) {
    return NextResponse.json({ error: '현재 결재 권한이 없습니다.' }, { status: 403 })
  }

  const stepStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'

  // 단계 업데이트
  await supabaseAdmin
    .from('approval_steps')
    .update({ status: stepStatus, comment: comment ?? null, acted_at: new Date().toISOString() })
    .eq('id', currentStep.id)

  if (action === 'reject') {
    await supabaseAdmin
      .from('approvals')
      .update({ status: 'REJECTED', completed_at: new Date().toISOString() })
      .eq('id', id)

    // 신청자에게 반려 알림
    await notifyUser(
      approval.applicant_id,
      'APPROVAL_REJECTED',
      '결재 반려',
      `[${approval.document_type}]가 반려되었습니다. 사유: ${comment ?? '없음'}`,
      `/approvals?id=${id}`
    )

    // 감사 로그 기록
    await writeAuditLog({
      userId,
      action: 'REJECT',
      targetType: 'approvals',
      targetId: id,
      changes: { document_type: approval.document_type, comment: comment ?? null, step: approval.current_step },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json({ success: true, status: 'REJECTED' })
  }

  // 승인 처리
  const nextStep = sortedSteps.find((s) => s.step_number === approval.current_step + 1)

  if (nextStep) {
    // 다음 단계로 진행
    await supabaseAdmin
      .from('approvals')
      .update({ current_step: approval.current_step + 1 })
      .eq('id', id)

    // 다음 결재자 알림
    await notifyUser(
      nextStep.approver_id,
      'APPROVAL_SUBMITTED',
      '결재 요청',
      `[${approval.document_type}] 결재를 요청합니다. (${approval.current_step + 1}단계)`,
      `/approvals?id=${id}`
    )

    // 신청자에게 중간 승인 알림
    await notifyUser(
      approval.applicant_id,
      'APPROVAL_APPROVED',
      '결재 진행',
      `[${approval.document_type}] ${approval.current_step}단계 승인. 다음 결재자에게 전달되었습니다.`,
      `/approvals?id=${id}`
    )

    // 감사 로그 기록
    await writeAuditLog({
      userId,
      action: 'APPROVE',
      targetType: 'approvals',
      targetId: id,
      changes: { document_type: approval.document_type, step: approval.current_step, next_step: approval.current_step + 1 },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
    })

  } else {
    // 최종 승인
    const completedAt = new Date().toISOString()

    try {
      await syncApprovalToExpenses(approval as {
        id: string
        document_type: string
        category?: string | null
        department_id?: string | null
        content?: ApprovalContent | null
      }, completedAt)
    } catch (error) {
      const message = error instanceof Error ? error.message : '전자결재 지출 반영에 실패했습니다.'
      return NextResponse.json({ error: message }, { status: 500 })
    }

    await supabaseAdmin
      .from('approvals')
      .update({ status: 'APPROVED', completed_at: completedAt })
      .eq('id', id)

    // 최종 승인 알림
    await notifyUser(
      approval.applicant_id,
      'APPROVAL_APPROVED',
      '결재 승인',
      `[${approval.document_type}]가 최종 승인되었습니다.`,
      `/approvals?id=${id}`
    )

    // 감사 로그 기록
    await writeAuditLog({
      userId,
      action: 'APPROVE',
      targetType: 'approvals',
      targetId: id,
      changes: { document_type: approval.document_type, step: approval.current_step, final: true },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
    })
  }

  return NextResponse.json({ success: true, status: nextStep ? 'IN_PROGRESS' : 'APPROVED' })
}
