import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  canEditAppraisal,
  canViewAppraisalOverview,
} from '@/lib/auth/appraisalAccess'
import {
  getEvaluationTargets,
  isValidScores,
} from '@/lib/appraisal/evaluationAccess'
import { defaultPeriod, isValidPeriod } from '@/lib/appraisal/period'

export const runtime = 'nodejs'

// GET /api/appraisal-evaluations?formId= — 내가 평가할 수 있는 대상 + 작성 현황
export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  // formId 생략 시 — 분기 내 모든 양식의 평가를 반환 (평가 작성 탭: 팀별 양식 자동 매칭)
  const formId = request.nextUrl.searchParams.get('formId')
  const periodParam = request.nextUrl.searchParams.get('period')
  const period = isValidPeriod(periodParam) ? periodParam : defaultPeriod()

  const [targets, canOverview, canManageOverview] = await Promise.all([
    getEvaluationTargets(appUser),
    canViewAppraisalOverview(appUser),
    canEditAppraisal(appUser),
  ])

  const teamIds = targets.teamTargets.map((t) => t.teamId)
  const userIds = targets.personalTargets.map((t) => t.userId)

  let evalQuery = supabaseAdmin
    .from('appraisal_evaluations')
    .select(
      'id, form_id, sheet_key, target_team_id, target_user_id, evaluator_id, scores, status, submitted_at, updated_at, period',
    )
    .eq('period', period)
  if (formId) evalQuery = evalQuery.eq('form_id', formId)

  const { data: evaluations, error } = await evalQuery.or(
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

  // 이의제기 — 조회된 평가들에 달린 이의제기 (평가자가 확인·재평가)
  const evalIds = (evaluations ?? []).map((ev) => ev.id as string)
  let appeals: unknown[] = []
  if (evalIds.length > 0) {
    const { data: appealRows } = await supabaseAdmin
      .from('appraisal_appeals')
      .select(
        'id, evaluation_id, user_id, content, attachments, status, created_at, resolved_at, block_index, indicator_index, indicator_text',
      )
      .in('evaluation_id', evalIds)
      .order('created_at', { ascending: false })
    appeals = appealRows ?? []
  }

  return NextResponse.json({
    canEvaluate:
      targets.teamTargets.length > 0 || targets.personalTargets.length > 0,
    canOverview,
    canManageOverview,
    isMaster: targets.isMaster,
    teamTargets: targets.teamTargets,
    personalTargets: targets.personalTargets,
    evaluations: evaluations ?? [],
    appeals,
    period,
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
    period?: string
  } | null

  if (!body?.form_id || (body.sheet_key !== 'team' && body.sheet_key !== 'personal')) {
    return NextResponse.json({ error: '요청 값이 올바르지 않습니다.' }, { status: 400 })
  }
  if (!isValidScores(body.scores)) {
    return NextResponse.json({ error: '점수 형식이 올바르지 않습니다.' }, { status: 400 })
  }
  const period = isValidPeriod(body.period) ? body.period : defaultPeriod()

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
    .eq('period', period)
  existingQuery =
    body.sheet_key === 'team'
      ? existingQuery.eq('target_team_id', body.target_team_id)
      : existingQuery.eq('target_user_id', body.target_user_id)
  const { data: existing } = await existingQuery.maybeSingle()

  const submit = body.submit === true
  const now = new Date().toISOString()

  if (existing) {
    // 처리 대기 중인 이의제기가 있으면 제출된 평가도 평가자가 재수정 가능
    const { data: pendingAppealRows } = await supabaseAdmin
      .from('appraisal_appeals')
      .select('id')
      .eq('evaluation_id', existing.id)
      .eq('status', 'pending')
      .limit(100)
    const pendingAppeal = (pendingAppealRows ?? []).length > 0

    // 제출 완료 상태에서만 잠금/평가자 일치 검사.
    // draft(재작성 허용 포함)는 위에서 검증된 권한 있는 평가자라면 누가 썼든
    // 이어서 작성 가능 — 어드민이 대신 작성한 건도 팀장이 재작성할 수 있다.
    if (existing.status === 'submitted') {
      if (!targets.isMaster && !pendingAppeal) {
        return NextResponse.json(
          { error: '제출된 평가는 수정할 수 없습니다. 경영실장에게 재작성을 요청하세요.' },
          { status: 403 },
        )
      }
      if (existing.evaluator_id !== appUser.id && !targets.isMaster) {
        return NextResponse.json(
          { error: '다른 평가자가 이미 작성한 평가입니다.' },
          { status: 403 },
        )
      }
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

    // 재제출 시 처리 대기 중인 이의제기 전체를 처리 완료로 전환
    if (submit && pendingAppeal) {
      await supabaseAdmin
        .from('appraisal_appeals')
        .update({
          status: 'resolved',
          resolved_by: appUser.id,
          resolved_at: now,
          updated_at: now,
        })
        .eq('evaluation_id', existing.id)
        .eq('status', 'pending')
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
      period,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ id: data.id }, { status: 201 })
}
