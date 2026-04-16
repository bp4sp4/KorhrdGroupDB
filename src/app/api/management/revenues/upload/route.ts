import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'

export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const userId = user.id

  const body = await request.json()
  const { rows } = body as { rows: Record<string, unknown>[] }

  if (!rows?.length) {
    return NextResponse.json({ error: '데이터가 없습니다.' }, { status: 400 })
  }

  const batchId = crypto.randomUUID()

  const inserts = rows.map((row) => ({
    revenue_date: row.revenue_date as string,
    department_id: (row.department_id as string) || null,
    revenue_type: (row.revenue_type as string) ?? 'CARD',
    customer_name: row.customer_name as string,
    amount: Number(row.amount),
    product_name: (row.product_name as string) || null,
    manager_id: (row.manager_id as string) || null,
    memo: (row.memo as string) || null,
    source: 'EXCEL_UPLOAD',
    upload_batch_id: batchId,
    created_by: userId,
  }))

  const results = { success: 0, duplicate: 0, error: 0, errors: [] as string[] }

  for (const item of inserts) {
    const { error } = await supabaseAdmin.from('revenues').insert(item)
    if (!error) {
      results.success++
    } else if (error.code === '23505') {
      results.duplicate++
    } else {
      results.error++
      results.errors.push(error.message)
    }
  }

  return NextResponse.json(results)
}
