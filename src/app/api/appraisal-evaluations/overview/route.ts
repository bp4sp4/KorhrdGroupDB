import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canEditAppraisal } from '@/lib/auth/appraisalAccess'
import { defaultPeriod, isValidPeriod } from '@/lib/appraisal/period'

export const runtime = 'nodejs'

// GET /api/appraisal-evaluations/overview?formId= — 전체 평가 현황 (경영실장 전용)
export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || !(await canEditAppraisal(appUser))) {
    return NextResponse.json(
      { error: '평가 현황은 경영실장만 볼 수 있습니다.' },
      { status: 403 },
    )
  }

  const formId = request.nextUrl.searchParams.get('formId')
  if (!formId) {
    return NextResponse.json({ error: 'formId가 필요합니다.' }, { status: 400 })
  }
  const periodParam = request.nextUrl.searchParams.get('period')
  const period = isValidPeriod(periodParam) ? periodParam : defaultPeriod()

  const { data: evaluations, error } = await supabaseAdmin
    .from('appraisal_evaluations')
    .select(
      'id, sheet_key, target_team_id, target_user_id, evaluator_id, scores, status, submitted_at, updated_at, period',
    )
    .eq('form_id', formId)
    .eq('period', period)
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = evaluations ?? []
  const userIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.target_user_id, r.evaluator_id])
        .filter((v): v is number => v != null),
    ),
  ]

  // 팀 이름은 직원 소속 팀 표시에도 쓰이므로 전체 조회
  const [teamsRes, usersRes] = await Promise.all([
    supabaseAdmin.from('teams').select('id, name'),
    userIds.length > 0
      ? supabaseAdmin
          .from('app_users')
          .select('id, display_name, team_id')
          .in('id', userIds)
      : Promise.resolve({
          data: [] as { id: number; display_name: string | null; team_id: string | null }[],
        }),
  ])

  const teamName = new Map((teamsRes.data ?? []).map((t) => [t.id, t.name]))
  const users = new Map((usersRes.data ?? []).map((u) => [u.id, u]))
  const nameOf = (id: number) =>
    users.get(id)?.display_name ?? `사용자 ${id}`

  // 이의제기 — 평가 현황에서 관리자가 확인
  const evalIds = rows.map((r) => r.id as string)
  let appeals: unknown[] = []
  if (evalIds.length > 0) {
    const { data: appealRows } = await supabaseAdmin
      .from('appraisal_appeals')
      .select(
        'id, evaluation_id, user_id, content, attachments, status, created_at, resolved_at',
      )
      .in('evaluation_id', evalIds)
      .order('created_at', { ascending: false })
    appeals = appealRows ?? []
  }

  return NextResponse.json({
    appeals,
    period,
    evaluations: rows.map((r) => {
      // 개인 평가 대상자의 소속 팀 — 종합 등급 산정(팀 점수 매칭)에 사용
      const targetUserTeamId =
        r.sheet_key === 'personal' && r.target_user_id != null
          ? (users.get(r.target_user_id)?.team_id ?? null)
          : null
      return {
        ...r,
        target_name:
          r.sheet_key === 'team'
            ? (teamName.get(r.target_team_id as string) ?? '-')
            : r.target_user_id != null
              ? nameOf(r.target_user_id)
              : '-',
        evaluator_name: nameOf(r.evaluator_id),
        target_user_team_id: targetUserTeamId,
        target_user_team_name: targetUserTeamId
          ? (teamName.get(targetUserTeamId) ?? null)
          : null,
      }
    }),
  })
}
