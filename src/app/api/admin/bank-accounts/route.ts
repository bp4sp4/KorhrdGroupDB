import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET: 통장 목록 (선택적으로 사업부 필터)
export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const departmentId = searchParams.get('department_id')
  const activeOnly = searchParams.get('active_only') === '1'

  let q = supabaseAdmin
    .from('bank_accounts')
    .select('id, department_id, bank_name, bank_code, account_number, account_holder, alias, memo, is_active, sort_order, created_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (departmentId) q = q.eq('department_id', departmentId)
  if (activeOnly) q = q.eq('is_active', true)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST: 신규 통장 등록
export async function POST(request: NextRequest) {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const body = await request.json()
  const {
    department_id,
    bank_name,
    bank_code,
    account_number,
    account_holder,
    alias,
    memo,
    sort_order,
  } = body as {
    department_id?: string
    bank_name?: string
    bank_code?: string
    account_number?: string
    account_holder?: string
    alias?: string
    memo?: string
    sort_order?: number
  }

  if (!department_id || !bank_name?.trim() || !account_number?.trim()) {
    return NextResponse.json(
      { error: '사업부, 은행명, 계좌번호는 필수입니다.' },
      { status: 400 },
    )
  }

  const cleanedAccountNumber = account_number.replace(/[^\d]/g, '')

  const { data, error } = await supabaseAdmin
    .from('bank_accounts')
    .insert({
      department_id,
      bank_name: bank_name.trim(),
      bank_code: bank_code?.trim() || null,
      account_number: cleanedAccountNumber,
      account_holder: account_holder?.trim() || null,
      alias: alias?.trim() || null,
      memo: memo?.trim() || null,
      sort_order: typeof sort_order === 'number' ? sort_order : 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
