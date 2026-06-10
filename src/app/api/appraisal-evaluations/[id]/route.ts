import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canEditAppraisal } from '@/lib/auth/appraisalAccess'

export const runtime = 'nodejs'

interface RouteParams { params: Promise<{ id: string }> }

// PATCH /api/appraisal-evaluations/[id] — 재작성 허용(draft 되돌림). 경영실장 전용.
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || !(await canEditAppraisal(appUser))) {
    return NextResponse.json(
      { error: '경영실장만 처리할 수 있습니다.' },
      { status: 403 },
    )
  }

  const { id } = await params
  const body = (await request.json().catch(() => null)) as {
    status?: string
  } | null
  if (body?.status !== 'draft') {
    return NextResponse.json({ error: 'status는 draft만 허용됩니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('appraisal_evaluations')
    .update({ status: 'draft', submitted_at: null })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: '평가를 찾을 수 없습니다.' }, { status: 404 })
  }
  return NextResponse.json({ id: data.id })
}

// DELETE /api/appraisal-evaluations/[id] — 평가 삭제. 경영실장 전용.
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || !(await canEditAppraisal(appUser))) {
    return NextResponse.json(
      { error: '경영실장만 처리할 수 있습니다.' },
      { status: 403 },
    )
  }

  const { id } = await params
  const { error } = await supabaseAdmin
    .from('appraisal_evaluations')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
