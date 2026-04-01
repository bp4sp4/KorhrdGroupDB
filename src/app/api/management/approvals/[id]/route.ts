import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { genDocNumber } from '@/lib/management/utils'
import { writeAuditLog } from '@/lib/management/auditLog'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { data, error } = await supabaseAdmin
    .from('approvals')
    .select(`
      *,
      applicant:app_users!approvals_applicant_id_fkey(id, display_name),
      department:departments(id, code, name),
      steps:approval_steps(
        id, step_number, approver_id, status, comment, acted_at,
        approver:app_users!approval_steps_approver_id_fkey(id, display_name)
      )
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: '결재 문서를 찾을 수 없습니다.' }, { status: 404 })

  const sortedSteps = (data.steps ?? []).sort(
    (a: { step_number: number }, b: { step_number: number }) => a.step_number - b.step_number
  )

  return NextResponse.json({ ...data, steps: sortedSteps })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const appUser = await supabaseAdmin
    .from('app_users')
    .select('id, display_name')
    .eq('username', user.email)
    .single()
  const userId = appUser.data?.id ?? user.id
  const userName = appUser.data?.display_name ?? ''

  const body = await request.json()
  const { action, comment } = body // action: 'approve' | 'reject' | 'cancel' | 'submit'

  const { data: approval, error: fetchErr } = await supabaseAdmin
    .from('approvals')
    .select('*, steps:approval_steps(*)')
    .eq('id', id)
    .single()

  if (fetchErr || !approval) {
    return NextResponse.json({ error: '결재 문서를 찾을 수 없습니다.' }, { status: 404 })
  }

  if (action === 'cancel') {
    if (approval.applicant_id !== userId) {
      return NextResponse.json({ error: '본인의 결재만 취소할 수 있습니다.' }, { status: 403 })
    }
    if (!['DRAFT', 'SUBMITTED'].includes(approval.status)) {
      return NextResponse.json({ error: '취소할 수 없는 상태입니다.' }, { status: 400 })
    }
    await supabaseAdmin.from('approvals').update({ status: 'CANCELLED' }).eq('id', id)
    return NextResponse.json({ success: true })
  }

  if (action === 'submit') {
    if (approval.status !== 'DRAFT') {
      return NextResponse.json({ error: '임시저장 상태에서만 상신할 수 있습니다.' }, { status: 400 })
    }
    const docNumber = genDocNumber(approval.category)
    await supabaseAdmin.from('approvals').update({
      status: 'IN_PROGRESS',
      document_number: docNumber,
      current_step: 1,
      submitted_at: new Date().toISOString(),
    }).eq('id', id)
    return NextResponse.json({ success: true })
  }

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: '잘못된 action입니다.' }, { status: 400 })
  }

  // 현재 단계의 결재자인지 확인
  const sortedSteps = ((approval.steps as { step_number: number; approver_id: string; id: string; status: string }[]) ?? [])
    .sort((a, b) => a.step_number - b.step_number)

  const currentStep = sortedSteps.find(
    (s) => s.step_number === approval.current_step && s.status === 'PENDING'
  )

  if (!currentStep || currentStep.approver_id !== userId) {
    return NextResponse.json({ error: '현재 결재 권한이 없습니다.' }, { status: 403 })
  }

  const stepStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'

  // 단계 업데이트
  await supabaseAdmin
    .from('approval_steps')
    .update({ status: stepStatus, comment: comment ?? null, acted_at: new Date().toISOString() })
    .eq('id', currentStep.id)

  if (action === 'reject') {
    await supabaseAdmin
      .from('approvals')
      .update({ status: 'REJECTED', completed_at: new Date().toISOString() })
      .eq('id', id)

    // 신청자에게 반려 알림
    await supabaseAdmin.from('notifications').insert({
      user_id: approval.applicant_id,
      type: 'APPROVAL_REJECTED',
      title: '결재 반려',
      message: `[${approval.document_type}]가 반려되었습니다. 사유: ${comment ?? '없음'}`,
      link: `/approvals?id=${id}`,
    })

    // 감사 로그 기록
    await writeAuditLog({
      userId,
      action: 'REJECT',
      targetType: 'approvals',
      targetId: id,
      changes: { document_type: approval.document_type, comment: comment ?? null, step: approval.current_step },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json({ success: true, status: 'REJECTED' })
  }

  // 승인 처리
  const nextStep = sortedSteps.find((s) => s.step_number === approval.current_step + 1)

  if (nextStep) {
    // 다음 단계로 진행
    await supabaseAdmin
      .from('approvals')
      .update({ current_step: approval.current_step + 1 })
      .eq('id', id)

    // 다음 결재자 알림
    await supabaseAdmin.from('notifications').insert({
      user_id: nextStep.approver_id,
      type: 'APPROVAL_SUBMITTED',
      title: '결재 요청',
      message: `[${approval.document_type}] 결재를 요청합니다. (${approval.current_step + 1}단계)`,
      link: `/approvals?id=${id}`,
    })

    // 신청자에게 중간 승인 알림
    await supabaseAdmin.from('notifications').insert({
      user_id: approval.applicant_id,
      type: 'APPROVAL_APPROVED',
      title: '결재 진행',
      message: `[${approval.document_type}] ${approval.current_step}단계 승인. 다음 결재자에게 전달되었습니다.`,
      link: `/approvals?id=${id}`,
    })

    // 감사 로그 기록
    await writeAuditLog({
      userId,
      action: 'APPROVE',
      targetType: 'approvals',
      targetId: id,
      changes: { document_type: approval.document_type, step: approval.current_step, next_step: approval.current_step + 1 },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
    })

  } else {
    // 최종 승인
    await supabaseAdmin
      .from('approvals')
      .update({ status: 'APPROVED', completed_at: new Date().toISOString() })
      .eq('id', id)

    // 최종 승인 알림
    await supabaseAdmin.from('notifications').insert({
      user_id: approval.applicant_id,
      type: 'APPROVAL_APPROVED',
      title: '결재 승인',
      message: `[${approval.document_type}]가 최종 승인되었습니다.`,
      link: `/approvals?id=${id}`,
    })

    // 감사 로그 기록
    await writeAuditLog({
      userId,
      action: 'APPROVE',
      targetType: 'approvals',
      targetId: id,
      changes: { document_type: approval.document_type, step: approval.current_step, final: true },
      ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
    })

    // 회계 문서 → expenses 자동 반영
    if (approval.category === '회계' && approval.content) {
      const c = approval.content as Record<string, unknown>
      if (c.amount && c.expense_date) {
        await supabaseAdmin.from('expenses').insert({
          approval_id: id,
          expense_date: c.expense_date as string,
          department_id: approval.department_id ?? null,
          detail: c.expense_detail as string ?? approval.document_type,
          amount: Number(c.amount),
          payment_method: (c.payment_method as string) ?? 'CORPORATE_CARD',
          vendor: c.vendor as string ?? null,
          memo: c.memo as string ?? null,
        })
      }
    }
  }

  return NextResponse.json({ success: true, status: nextStep ? 'IN_PROGRESS' : 'APPROVED' })
}
