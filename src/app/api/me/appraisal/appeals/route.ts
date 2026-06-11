import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { APPEAL_WINDOW_DAYS, isAppealWindowOpen } from '@/lib/appraisal/appeal'

export const runtime = 'nodejs'

interface AttachmentInput {
  name?: unknown
  url?: unknown
  type?: unknown
  size?: unknown
}

// POST /api/me/appraisal/appeals — 내 평가에 대한 이의제기 등록
// body: { evaluation_id: string, content: string, attachments?: [{name,url,type,size}] }
export async function POST(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as {
    evaluation_id?: string
    content?: string
    attachments?: AttachmentInput[]
  } | null

  const evaluationId = body?.evaluation_id?.trim()
  const content = body?.content?.trim()
  if (!evaluationId || !content) {
    return NextResponse.json(
      { error: '이의제기 내용을 입력해주세요.' },
      { status: 400 },
    )
  }
  if (content.length > 5000) {
    return NextResponse.json(
      { error: '이의제기 내용은 5000자 이내로 작성해주세요.' },
      { status: 400 },
    )
  }

  // 첨부 검증 — 업로드 API 가 반환한 형태만 허용
  const attachments = (Array.isArray(body?.attachments) ? body.attachments : [])
    .filter(
      (a): a is { name: string; url: string; type?: string; size?: number } =>
        typeof a?.name === 'string' &&
        typeof a?.url === 'string' &&
        a.url.includes('/appraisal-appeals/'),
    )
    .slice(0, 10)
    .map((a) => ({
      name: a.name,
      url: a.url,
      type: typeof a.type === 'string' ? a.type : null,
      size: typeof a.size === 'number' ? a.size : null,
    }))

  // 본인의 제출 완료된 평가인지 확인
  const { data: evaluation } = await supabaseAdmin
    .from('appraisal_evaluations')
    .select('id, target_user_id, sheet_key, status, submitted_at')
    .eq('id', evaluationId)
    .maybeSingle()

  if (!evaluation || evaluation.target_user_id !== appUser.id) {
    return NextResponse.json(
      { error: '본인의 평가에만 이의제기할 수 있습니다.' },
      { status: 403 },
    )
  }
  if (evaluation.status !== 'submitted') {
    return NextResponse.json(
      { error: '제출 완료된 평가에만 이의제기할 수 있습니다.' },
      { status: 400 },
    )
  }
  // 이의제기 기간 — 평가 제출 후 5일 이내
  if (!isAppealWindowOpen(evaluation.submitted_at)) {
    return NextResponse.json(
      {
        error: `이의제기 기간이 지났습니다. (평가 제출 후 ${APPEAL_WINDOW_DAYS}일 이내 가능)`,
      },
      { status: 400 },
    )
  }

  // 처리 대기 중인 이의제기 중복 방지
  const { data: pending } = await supabaseAdmin
    .from('appraisal_appeals')
    .select('id')
    .eq('evaluation_id', evaluationId)
    .eq('status', 'pending')
    .maybeSingle()
  if (pending) {
    return NextResponse.json(
      { error: '이미 처리 대기 중인 이의제기가 있습니다.' },
      { status: 409 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from('appraisal_appeals')
    .insert({
      evaluation_id: evaluationId,
      user_id: appUser.id,
      content,
      attachments,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ id: data.id }, { status: 201 })
}
