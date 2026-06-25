import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canViewAppraisalOverview } from '@/lib/auth/appraisalAccess'

export const runtime = 'nodejs'

interface RouteParams { params: Promise<{ id: string }> }

// PUT /api/appraisal-evaluations/[id]/feedback
// 개인 인사고과 평가자 마무리 피드백(총평) 작성/수정.
//   권한: 해당 평가의 평가자(evaluator_id) 또는 본부장/경영실장/master-admin
//   대상: sheet_key='personal' && status='submitted'(확정) 평가만
//   feedback 빈 문자열 → 피드백 삭제(null)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const { id } = await params
  const body = (await request.json().catch(() => null)) as {
    feedback?: unknown
  } | null
  if (body === null || typeof body.feedback !== 'string') {
    return NextResponse.json(
      { error: 'feedback(문자열)이 필요합니다.' },
      { status: 400 },
    )
  }
  const feedback = body.feedback.trim()
  if (feedback.length > 2000) {
    return NextResponse.json(
      { error: '피드백은 2000자 이내로 입력해주세요.' },
      { status: 400 },
    )
  }

  const { data: evalRow, error: fetchErr } = await supabaseAdmin
    .from('appraisal_evaluations')
    .select('id, sheet_key, status, evaluator_id')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!evalRow) {
    return NextResponse.json({ error: '평가를 찾을 수 없습니다.' }, { status: 404 })
  }
  if (evalRow.sheet_key !== 'personal') {
    return NextResponse.json(
      { error: '개인 평가에만 피드백을 작성할 수 있습니다.' },
      { status: 400 },
    )
  }
  if (evalRow.status !== 'submitted') {
    return NextResponse.json(
      { error: '제출(확정)된 평가에만 작성할 수 있습니다.' },
      { status: 400 },
    )
  }

  const isEvaluator = appUser.id === (evalRow.evaluator_id as number)
  if (!isEvaluator && !(await canViewAppraisalOverview(appUser))) {
    return NextResponse.json(
      { error: '피드백 작성 권한이 없습니다.' },
      { status: 403 },
    )
  }

  const cleared = feedback.length === 0
  const { data, error } = await supabaseAdmin
    .from('appraisal_evaluations')
    .update({
      feedback: cleared ? null : feedback,
      feedback_at: cleared ? null : new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, feedback, feedback_at')
    .maybeSingle()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
