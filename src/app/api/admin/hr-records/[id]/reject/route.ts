import { NextRequest, NextResponse } from 'next/server'
import { requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// POST /api/admin/hr-records/[id]/reject — 반려 (사유 필수)
// body: { reason: string }
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireMasterAdmin()
  if (errorResponse) return errorResponse

  const { id } = await context.params
  const body = (await req.json()) as { reason?: string }
  const reason = (body.reason ?? '').trim()
  if (!reason) {
    return NextResponse.json({ error: '반려 사유를 입력해주세요.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('hr_records')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: appUser.id,
      reject_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ record: data })
}
