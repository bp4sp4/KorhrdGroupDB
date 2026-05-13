import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// 신한 API 자격증명에 등록된 자사 계좌 목록 (현재 하드코딩)
const SHINHAN_REGISTERED_ACCOUNTS: { accountNumber: string; bankCode: string }[] = [
  { accountNumber: '100038221017', bankCode: '088' },
  { accountNumber: '140014910339', bankCode: '088' },
  { accountNumber: '140015029000', bankCode: '088' },
  { accountNumber: '140015307601', bankCode: '088' },
]

// GET: 신한 등록 계좌 목록 + 사업부 연결 상태
export async function GET() {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  // 이미 등록된 통장과 사업부명 조회
  const { data: rows, error } = await supabaseAdmin
    .from('bank_accounts')
    .select('id, account_number, department_id, is_active, departments(name)')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type Row = {
    id: string
    account_number: string
    department_id: string
    is_active: boolean
    departments: { name: string } | { name: string }[] | null
  }
  const byAccount = new Map<string, { id: string; department_id: string; department_name: string; is_active: boolean }>()
  ;(rows ?? []).forEach((r) => {
    const row = r as unknown as Row
    const deptName = Array.isArray(row.departments)
      ? row.departments[0]?.name ?? ''
      : row.departments?.name ?? ''
    byAccount.set(row.account_number, {
      id: row.id,
      department_id: row.department_id,
      department_name: deptName,
      is_active: row.is_active,
    })
  })

  const accounts = SHINHAN_REGISTERED_ACCOUNTS.map((a) => {
    const registered = byAccount.get(a.accountNumber) ?? null
    return {
      bank_name: '신한',
      bank_code: a.bankCode,
      account_number: a.accountNumber,
      registered: registered
        ? {
            id: registered.id,
            department_id: registered.department_id,
            department_name: registered.department_name,
            is_active: registered.is_active,
          }
        : null,
    }
  })

  return NextResponse.json({ accounts })
}
