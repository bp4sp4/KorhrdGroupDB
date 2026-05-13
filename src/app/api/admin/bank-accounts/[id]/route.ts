import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const { id } = await params
  const body = await request.json()
  const {
    department_id,
    bank_name,
    bank_code,
    account_number,
    account_holder,
    alias,
    memo,
    is_active,
    sort_order,
  } = body as {
    department_id?: string
    bank_name?: string
    bank_code?: string | null
    account_number?: string
    account_holder?: string | null
    alias?: string | null
    memo?: string | null
    is_active?: boolean
    sort_order?: number
  }

  const updates: Record<string, unknown> = {}
  if (department_id !== undefined) updates.department_id = department_id
  if (bank_name !== undefined) updates.bank_name = bank_name.trim()
  if (bank_code !== undefined) updates.bank_code = bank_code?.toString().trim() || null
  if (account_number !== undefined) updates.account_number = account_number.replace(/[^\d]/g, '')
  if (account_holder !== undefined) updates.account_holder = account_holder?.toString().trim() || null
  if (alias !== undefined) updates.alias = alias?.toString().trim() || null
  if (memo !== undefined) updates.memo = memo?.toString().trim() || null
  if (is_active !== undefined) updates.is_active = is_active
  if (sort_order !== undefined) updates.sort_order = sort_order

  const { data, error } = await supabaseAdmin
    .from('bank_accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('bank_accounts')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
