import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canEditAppraisal } from '@/lib/auth/appraisalAccess'
import {
  getEvaluationTargets,
  isValidScores,
} from '@/lib/appraisal/evaluationAccess'

export const runtime = 'nodejs'

// GET /api/appraisal-evaluations?formId= — 내가 평가할 수 있는 대상 + 작성 현황
export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const formId = request.nextUrl.searchParams.get('formId')
  if (!formId) {
    return NextResponse.json({ error: 'formId가 필요합니다.' }, { status: 400 })
  }

  const [targets, canOverview] = await Promise.all([
    getEvaluationTargets(appUser),
    canEditAppraisal(appUser),
  ])

  const teamIds = targets.teamTargets.map((t) => t.teamId)
  const userIds = targets.personalTargets.map((t) => t.userId)

  const { data: evaluations, error } = await supabaseAdmin
    .from('appraisal_evaluations')
    .select(
      'id, sheet_key, target_team_id, target_user_id, evaluator_id, scores, status, submitted_at, updated_at',
    )
    .eq('form_id', formId)
    .or(
      [
        teamIds.length > 0
          ? `target_team_id.in.(${teamIds.join(',')})`
          : null,
        userIds.length > 0
          ? `target_user_id.in.(${userIds.join(',')})`
          : null,
      ]
        .filter(Boolean)
        .join(',') || 'id.eq.00000000-0000-0000-0000-000000000000',
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    canEvaluate:
      targets.teamTargets.length > 0 || targets.personalTargets.length > 0,
    canOverview,
    isMaster: targets.isMaster,
    teamTargets: targets.teamTargets,
    personalTargets: targets.personalTargets,
    evaluations: evaluations ?? [],
  })
}

// POST /api/appraisal-evaluations — 평가 저장(임시저장/제출), upsert
export async function POST(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as {
    form_id?: string
    sheet_key?: string
    target_team_id?: string | null
    target_user_id?: number | null
    scores?: unknown
    submit?: boolean
  } | null

  if (!body?.form_id || (body.sheet_key !== 'team' && body.sheet_key !== 'personal')) {
    return NextResponse.json({ error: '요청 값이 올바르지 않습니다.' }, { status: 400 })
  }
  if (!isValidScores(body.scores)) {
    return NextResponse.json({ error: '점수 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  // 평가 대상 권한 확인
  const targets = await getEvaluationTargets(appUser)
  if (body.sheet_key === 'team') {
    if (
      !body.target_team_id ||
      !targets.teamTargets.some((t) => t.teamId === body.target_team_id)
    ) {
      return NextResponse.json(
        { error: '해당 팀의 팀 역량평가 권한이 없습니다.' },
        { status: 403 },
      )
    }
  } else {
    if (
      typeof body.target_user_id !== 'number' ||
      !targets.personalTargets.some((t) => t.userId === body.target_user_id)
    ) {
      return NextResponse.json(
        { error: '해당 직원의 개인 역량평가 권한이 없습니다.' },
        { status: 403 },
      )
    }
  }

  // 기존 평가 확인 (대상 기준 1건)
  let existingQuery = supabaseAdmin
    .from('appraisal_evaluations')
    .select('id, evaluator_id, status')
    .eq('form_id', body.form_id)
    .eq('sheet_key', body.sheet_key)
  existingQuery =
    body.sheet_key === 'team'
      ? existingQuery.eq('target_team_id', body.target_team_id)
      : existingQuery.eq('target_user_id', body.target_user_id)
  const { data: existing } = await existingQuery.maybeSingle()

  const submit = body.submit === true
  const now = new Date().toISOString()

  if (existing) {
    if (existing.evaluator_id !== appUser.id && !targets.isMaster) {
      return NextResponse.json(
        { error: '다른 평가자가 이미 작성한 평가입니다.' },
        { status: 403 },
      )
    }
    if (existing.status === 'submitted' && !targets.isMaster) {
      return NextResponse.json(
        { error: '제출된 평가는 수정할 수 없습니다. 경영실장에게 재작성을 요청하세요.' },
        { status: 403 },
      )
    }
    const { error } = await supabaseAdmin
      .from('appraisal_evaluations')
      .update({
        scores: body.scores,
        evaluator_id: appUser.id,
        status: submit ? 'submitted' : 'draft',
        submitted_at: submit ? now : null,
      })
      .eq('id', existing.id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ id: existing.id })
  }

  const { data, error } = await supabaseAdmin
    .from('appraisal_evaluations')
    .insert({
      form_id: body.form_id,
      sheet_key: body.sheet_key,
      target_team_id: body.sheet_key === 'team' ? body.target_team_id : null,
      target_user_id: body.sheet_key === 'personal' ? body.target_user_id : null,
      evaluator_id: appUser.id,
      scores: body.scores,
      status: submit ? 'submitted' : 'draft',
      submitted_at: submit ? now : null,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ id: data.id }, { status: 201 })
}
