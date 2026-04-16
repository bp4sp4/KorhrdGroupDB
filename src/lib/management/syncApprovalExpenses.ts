import { supabaseAdmin } from '@/lib/supabase/admin'

type ApprovalContent = Record<string, unknown>

export type ExpenseInsert = {
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

export type ApprovalExpenseSource = {
  id: string
  document_type: string
  category?: string | null
  department_id?: string | null
  content?: ApprovalContent | null
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

export async function buildApprovalExpenses(
  approval: ApprovalExpenseSource,
  completedAt: string
): Promise<ExpenseInsert[]> {
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

export async function syncApprovalToExpenses(
  approval: ApprovalExpenseSource,
  completedAt: string
) {
  const inserts = await buildApprovalExpenses(approval, completedAt)
  await supabaseAdmin.from('expenses').delete().eq('approval_id', approval.id)
  if (inserts.length === 0) return 0

  const { error } = await supabaseAdmin.from('expenses').insert(inserts)
  if (error) {
    throw new Error(error.message)
  }
  return inserts.length
}
