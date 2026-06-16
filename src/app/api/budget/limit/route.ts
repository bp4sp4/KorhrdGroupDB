import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveBudgetAccess } from '@/lib/budget/access'

// POST: 본부별 월 예산 한도 설정 (어드민/경영지원본부 전용)
export async function POST(request: NextRequest) {
  const access = await resolveBudgetAccess()
  if (!access.ok) return access.response

  if (!access.seeAll) {
    return NextResponse.json({ error: '예산 한도 설정 권한이 없습니다.' }, { status: 403 })
  }

  const body = await request.json()
  const { department_id, year_month, limit_amount, memo } = body as {
    department_id?: string
    year_month?: string
    limit_amount?: number
    memo?: string | null
  }

  if (!department_id || !year_month || !/^\d{4}-\d{2}$/.test(year_month)) {
    return NextResponse.json({ error: '본부와 연월(YYYY-MM)은 필수입니다.' }, { status: 400 })
  }

  const amount = Math.max(0, Math.round(Number(limit_amount) || 0))

  const { data, error } = await supabaseAdmin
    .from('department_budgets')
    .upsert(
      {
        department_id,
        year_month,
        limit_amount: amount,
        memo: memo?.toString().trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'department_id,year_month' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
