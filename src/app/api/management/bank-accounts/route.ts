import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET: 결재 양식 작성 등에서 사용할 통장 목록 (활성 항목만)
//      ?department_id= 로 사업부 필터
export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const departmentId = searchParams.get('department_id')

  let q = supabaseAdmin
    .from('bank_accounts')
    .select('id, department_id, bank_name, bank_code, account_number, account_holder, alias, memo, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (departmentId) q = q.eq('department_id', departmentId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
