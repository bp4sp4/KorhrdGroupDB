import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SHINHAN_REGISTERED_ACCOUNTS } from '@/lib/shinhan'

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
  // 계좌번호 → 등록된 사업부 목록 (여러 사업부가 같은 통장을 공유할 수 있음)
  const byAccount = new Map<
    string,
    { id: string; department_id: string; department_name: string; is_active: boolean }[]
  >()
  ;(rows ?? []).forEach((r) => {
    const row = r as unknown as Row
    const deptName = Array.isArray(row.departments)
      ? row.departments[0]?.name ?? ''
      : row.departments?.name ?? ''
    const list = byAccount.get(row.account_number) ?? []
    list.push({
      id: row.id,
      department_id: row.department_id,
      department_name: deptName,
      is_active: row.is_active,
    })
    byAccount.set(row.account_number, list)
  })

  const accounts = SHINHAN_REGISTERED_ACCOUNTS.map((accountNumber) => ({
    bank_name: '신한',
    bank_code: '088',
    account_number: accountNumber,
    registrations: byAccount.get(accountNumber) ?? [],
  }))

  return NextResponse.json({ accounts })
}
