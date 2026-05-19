import { NextResponse } from 'next/server'
import { requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/admin/leave-balances — 모든 사용자 + 잔여 휴가
export async function GET() {
  const { errorResponse } = await requireMasterAdmin()
  if (errorResponse) return errorResponse

  // app_users + leave_balances LEFT JOIN
  const { data: users, error } = await supabaseAdmin
    .from('app_users')
    .select('id, username, display_name, role, position_id, department_id')
    .order('display_name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = (users ?? []).map((u) => u.id as number)
  const { data: balances } = userIds.length
    ? await supabaseAdmin
        .from('leave_balances')
        .select('user_id, balance, updated_at')
        .in('user_id', userIds)
    : { data: [] }

  const balanceMap = new Map<number, { balance: number; updated_at: string }>()
  for (const b of balances ?? []) {
    balanceMap.set(b.user_id as number, {
      balance: Number(b.balance ?? 0),
      updated_at: b.updated_at as string,
    })
  }

  // 직급명/부서명 매핑
  const positionIds = Array.from(
    new Set((users ?? []).map((u) => u.position_id).filter(Boolean) as string[]),
  )
  const departmentIds = Array.from(
    new Set((users ?? []).map((u) => u.department_id).filter(Boolean) as string[]),
  )
  const positionMap = new Map<string, string>()
  const departmentMap = new Map<string, string>()
  if (positionIds.length) {
    const { data: positions } = await supabaseAdmin
      .from('positions')
      .select('id, name')
      .in('id', positionIds)
    for (const p of positions ?? []) positionMap.set(p.id as string, p.name as string)
  }
  if (departmentIds.length) {
    const { data: departments } = await supabaseAdmin
      .from('departments')
      .select('id, name')
      .in('id', departmentIds)
    for (const d of departments ?? []) departmentMap.set(d.id as string, d.name as string)
  }

  const items = (users ?? []).map((u) => {
    const b = balanceMap.get(u.id as number)
    return {
      user_id: u.id as number,
      username: (u.username as string) ?? null,
      display_name: (u.display_name as string) ?? null,
      role: (u.role as string) ?? null,
      position_name: u.position_id ? positionMap.get(u.position_id as string) ?? null : null,
      department_name: u.department_id ? departmentMap.get(u.department_id as string) ?? null : null,
      balance: b?.balance ?? 0,
      updated_at: b?.updated_at ?? null,
    }
  })

  return NextResponse.json({ items })
}
