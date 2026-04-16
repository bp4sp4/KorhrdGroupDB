import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireManagementAccess } from '@/lib/auth/managementAccess'

export async function GET() {
  const access = await requireManagementAccess('revenue-upload', { allowOwn: true, emptyBody: { batches: [] } })
  if (!access.ok) return access.response

  let query = supabaseAdmin
    .from('revenues')
    .select('upload_batch_id, created_at, amount, revenue_type, department_id')
    .not('upload_batch_id', 'is', null)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  if (access.scope === 'own') {
    const ownDept = access.appUser.department_id
    if (!ownDept) return NextResponse.json({ batches: [] })
    query = query.eq('department_id', ownDept)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const batchMap = new Map<string, {
    batch_id: string
    uploaded_at: string
    count: number
    total_amount: number
    types: Set<string>
  }>()

  for (const row of data ?? []) {
    const bid = row.upload_batch_id as string
    if (!batchMap.has(bid)) {
      batchMap.set(bid, {
        batch_id: bid,
        uploaded_at: row.created_at,
        count: 0,
        total_amount: 0,
        types: new Set(),
      })
    }
    const b = batchMap.get(bid)!
    b.count++
    b.total_amount += row.amount ?? 0
    b.types.add(row.revenue_type ?? 'OTHER')
  }

  const batches = Array.from(batchMap.values())
    .map(b => ({
      batch_id: b.batch_id,
      uploaded_at: b.uploaded_at,
      count: b.count,
      total_amount: b.total_amount,
      revenue_types: Array.from(b.types),
    }))
    .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())

  return NextResponse.json({ batches })
}
