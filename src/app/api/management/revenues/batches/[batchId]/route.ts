import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { batchId } = await params

  const { error, count } = await supabaseAdmin
    .from('revenues')
    .update({ is_deleted: true })
    .eq('upload_batch_id', batchId)
    .eq('is_deleted', false)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: count ?? 0 })
}
