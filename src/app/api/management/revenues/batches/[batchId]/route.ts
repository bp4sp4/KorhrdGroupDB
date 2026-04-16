import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireManagementAccess } from '@/lib/auth/managementAccess'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const access = await requireManagementAccess('revenue-upload', { allowOwn: true })
  if (!access.ok) return access.response

  const { batchId } = await params

  let query = supabaseAdmin
    .from('revenues')
    .update({ is_deleted: true })
    .eq('upload_batch_id', batchId)
    .eq('is_deleted', false)

  // 'own' 스코프: 본인 사업부 배치만 삭제 가능
  if (access.scope === 'own') {
    const ownDept = access.appUser.department_id
    if (!ownDept) {
      return NextResponse.json({ error: '사업부가 지정되지 않아 삭제할 수 없습니다.' }, { status: 403 })
    }
    query = query.eq('department_id', ownDept)
  }

  const { error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: count ?? 0 })
}
