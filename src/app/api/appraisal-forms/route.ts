import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canEditAppraisal } from '@/lib/auth/appraisalAccess'

export const runtime = 'nodejs'

// GET /api/appraisal-forms — 인사고과표 목록 (전직원 열람)
export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const [{ data, error }, canEdit, teamsRes] = await Promise.all([
    supabaseAdmin
      .from('appraisal_forms')
      .select('id, title, form_data, team_id, created_at, updated_at')
      .order('created_at', { ascending: false }),
    canEditAppraisal(appUser),
    supabaseAdmin
      .from('teams')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({
    forms: data ?? [],
    canEdit,
    teams: teamsRes.data ?? [],
  })
}

// POST /api/appraisal-forms — 새 인사고과표 생성 (경영실장 전용)
export async function POST(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || !(await canEditAppraisal(appUser))) {
    return NextResponse.json(
      { error: '인사고과표는 경영실장만 수정할 수 있습니다.' },
      { status: 403 },
    )
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string
    form_data?: Record<string, unknown>
    team_id?: string | null
  } | null

  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  if (!title || typeof body?.form_data !== 'object' || body.form_data === null) {
    return NextResponse.json({ error: 'title과 form_data가 필요합니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('appraisal_forms')
    .insert({
      title,
      form_data: body.form_data,
      team_id: typeof body.team_id === 'string' && body.team_id ? body.team_id : null,
      created_by: appUser.id,
      updated_by: appUser.id,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ id: data.id }, { status: 201 })
}
