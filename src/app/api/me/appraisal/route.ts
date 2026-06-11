import { NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { AppraisalFormData } from '@/lib/appraisal/form'

export const runtime = 'nodejs'

// GET /api/me/appraisal — 내 인사고과 (제출 완료된 개인 역량평가) + 이의제기 내역
export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const { data: evaluations, error } = await supabaseAdmin
    .from('appraisal_evaluations')
    .select('id, form_id, sheet_key, scores, status, submitted_at, updated_at, evaluator_id, period')
    .eq('target_user_id', appUser.id)
    .eq('sheet_key', 'personal')
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = evaluations ?? []
  if (rows.length === 0) {
    return NextResponse.json({ items: [] })
  }

  const formIds = [...new Set(rows.map((r) => r.form_id as string))]
  const evaluatorIds = [...new Set(rows.map((r) => r.evaluator_id as number))]
  const evalIds = rows.map((r) => r.id as string)

  const [formsRes, evaluatorsRes, appealsRes] = await Promise.all([
    supabaseAdmin
      .from('appraisal_forms')
      .select('id, title, form_data')
      .in('id', formIds),
    supabaseAdmin
      .from('app_users')
      .select('id, display_name')
      .in('id', evaluatorIds),
    supabaseAdmin
      .from('appraisal_appeals')
      .select('id, evaluation_id, content, attachments, status, created_at, resolved_at')
      .in('evaluation_id', evalIds)
      .order('created_at', { ascending: false }),
  ])

  const formMap = new Map(
    (formsRes.data ?? []).map((f) => [f.id as string, f]),
  )
  const evaluatorMap = new Map(
    (evaluatorsRes.data ?? []).map((u) => [u.id as number, u.display_name as string | null]),
  )
  const appealsByEval = new Map<string, unknown[]>()
  for (const a of appealsRes.data ?? []) {
    const key = a.evaluation_id as string
    if (!appealsByEval.has(key)) appealsByEval.set(key, [])
    appealsByEval.get(key)!.push(a)
  }

  const items = rows
    .map((r) => {
      const form = formMap.get(r.form_id as string)
      if (!form) return null
      const formData = form.form_data as AppraisalFormData
      return {
        evaluationId: r.id,
        formTitle: form.title,
        sheet: formData.personal,
        scores: r.scores,
        submittedAt: r.submitted_at,
        period: r.period,
        evaluatorName: evaluatorMap.get(r.evaluator_id as number) ?? '평가자',
        appeals: appealsByEval.get(r.id as string) ?? [],
      }
    })
    .filter(Boolean)

  return NextResponse.json({ items })
}
