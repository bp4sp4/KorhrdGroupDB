import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { syncApprovalToExpenses } from '@/lib/management/syncApprovalExpenses'

export async function POST(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  if (!appUser || !['admin', 'master-admin'].includes(appUser.role)) {
    return NextResponse.json({ error: '관리자만 실행할 수 있습니다.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 500)
  const approvalId = typeof body.approvalId === 'string' ? body.approvalId : ''

  let query = supabaseAdmin
    .from('approvals')
    .select('id, document_type, category, department_id, content, completed_at')
    .eq('status', 'APPROVED')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(limit)

  if (approvalId) {
    query = query.eq('id', approvalId)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const approvals = data ?? []
  let synced = 0
  let failed = 0
  const results: Array<{ id: string; synced: boolean; count?: number; error?: string }> = []

  for (const approval of approvals) {
    try {
      const count = await syncApprovalToExpenses({
        id: approval.id,
        document_type: approval.document_type,
        category: approval.category,
        department_id: approval.department_id,
        content: approval.content as Record<string, unknown> | null,
      }, approval.completed_at as string)

      results.push({ id: approval.id, synced: true, count })
      synced++
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : '재동기화 실패'
      results.push({ id: approval.id, synced: false, error: message })
      failed++
    }
  }

  return NextResponse.json({
    total: approvals.length,
    synced,
    failed,
    results,
  })
}
