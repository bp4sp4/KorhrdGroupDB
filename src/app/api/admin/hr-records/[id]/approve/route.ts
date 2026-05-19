import { NextRequest, NextResponse } from 'next/server'
import { requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// POST /api/admin/hr-records/[id]/approve — 승인
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { appUser, errorResponse } = await requireMasterAdmin()
  if (errorResponse) return errorResponse

  const { id } = await context.params

  const { data, error } = await supabaseAdmin
    .from('hr_records')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: appUser.id,
      reject_reason: null,
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
