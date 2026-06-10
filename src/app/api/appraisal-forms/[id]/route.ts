import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canEditAppraisal } from '@/lib/auth/appraisalAccess'

export const runtime = 'nodejs'

interface RouteParams { params: Promise<{ id: string }> }

// PUT /api/appraisal-forms/[id] — 인사고과표 수정 (경영실장 전용)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || !(await canEditAppraisal(appUser))) {
    return NextResponse.json(
      { error: '인사고과표는 경영실장만 수정할 수 있습니다.' },
      { status: 403 },
    )
  }

  const { id } = await params
  const body = (await request.json().catch(() => null)) as {
    title?: string
    form_data?: Record<string, unknown>
  } | null

  const updates: Record<string, unknown> = { updated_by: appUser.id }
  if (typeof body?.title === 'string' && body.title.trim()) {
    updates.title = body.title.trim()
  }
  if (typeof body?.form_data === 'object' && body.form_data !== null) {
    updates.form_data = body.form_data
  }
  if (!('title' in updates) && !('form_data' in updates)) {
    return NextResponse.json({ error: '수정할 내용이 없습니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('appraisal_forms')
    .update(updates)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: '인사고과표를 찾을 수 없습니다.' }, { status: 404 })
  }
  return NextResponse.json({ id: data.id })
}

// DELETE /api/appraisal-forms/[id] — 인사고과표 삭제 (경영실장 전용)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || !(await canEditAppraisal(appUser))) {
    return NextResponse.json(
      { error: '인사고과표는 경영실장만 수정할 수 있습니다.' },
      { status: 403 },
    )
  }

  const { id } = await params
  const { error } = await supabaseAdmin
    .from('appraisal_forms')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
