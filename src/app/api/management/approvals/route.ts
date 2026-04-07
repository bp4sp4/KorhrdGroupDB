import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'
import { genDocNumber } from '@/lib/management/utils'

export async function GET(request: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const appUser = await supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('username', user.email)
    .single()
  const userId = appUser.data?.id ?? user.id

  const sp = request.nextUrl.searchParams
  const tab = sp.get('tab') ?? 'mine' // mine | pending | completed

  let query = supabaseAdmin
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
    .order('created_at', { ascending: false })

  if (tab === 'mine') {
    query = query.eq('applicant_id', userId)
  } else if (tab === 'pending') {
    // 내가 결재할 것 = 내가 approver인 PENDING step이 있고, 현재 결재 중인 문서
    const { data: stepRows } = await supabaseAdmin
      .from('approval_steps')
      .select('approval_id')
      .eq('approver_id', userId)
      .eq('status', 'PENDING')

    const ids = (stepRows ?? []).map((r) => r.approval_id)
    if (!ids.length) return NextResponse.json([])
    query = query
      .in('id', ids)
      .in('status', ['SUBMITTED', 'IN_PROGRESS'])
  } else if (tab === 'reference') {
    // 내가 참조자인 문서 (진행 중)
    query = query
      .contains('reference_ids', [userId])
      .in('status', ['SUBMITTED', 'IN_PROGRESS', 'APPROVED'])
  } else if (tab === 'completed') {
    const approverIds = await getMyApproverIds(userId)
    if (approverIds.length > 0) {
      query = query.or(`applicant_id.eq.${userId},id.in.(${approverIds.join(',')})`)
    } else {
      query = query.eq('applicant_id', userId)
    }
    query = query.in('status', ['APPROVED', 'REJECTED', 'CANCELLED'])
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

async function getMyApproverIds(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('approval_steps')
    .select('approval_id')
    .eq('approver_id', userId)
  return (data ?? []).map((r) => r.approval_id as string)
}

export async function POST(request: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const appUser = await supabaseAdmin
    .from('app_users')
    .select('id')
    .eq('username', user.email)
    .single()
  const userId = appUser.data?.id ?? user.id

  const body = await request.json()
  const { template_id, document_type, category, title, content, department_id, action, approver_ids, reference_ids } = body

  if (!document_type || !title) {
    return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 })
  }

  const status = action === 'submit' ? 'SUBMITTED' : 'DRAFT'
  const docNumber = action === 'submit' ? genDocNumber(category) : null

  const { data: approval, error } = await supabaseAdmin
    .from('approvals')
    .insert({
      document_number: docNumber,
      template_id: template_id || null,
      document_type,
      category,
      status,
      applicant_id: userId,
      department_id: department_id || null,
      title,
      content: content ?? {},
      reference_ids: reference_ids ?? [],
      current_step: action === 'submit' ? 1 : 0,
      submitted_at: action === 'submit' ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 결재 단계 생성 (상신 시)
  if (action === 'submit' && approver_ids?.length) {
    const steps = approver_ids.map((approverId: string, idx: number) => ({
      approval_id: approval.id,
      step_number: idx + 1,
      approver_id: approverId,
      status: idx === 0 ? 'PENDING' : 'PENDING',
    }))
    await supabaseAdmin.from('approval_steps').insert(steps)

    // 상신 → IN_PROGRESS
    await supabaseAdmin
      .from('approvals')
      .update({ status: 'IN_PROGRESS' })
      .eq('id', approval.id)

    // 알림 생성 - 첫 번째 결재자에게
    await createNotification(
      approver_ids[0],
      'APPROVAL_SUBMITTED',
      '결재 요청',
      `${(appUser.data as { display_name?: string } | null)?.display_name ?? ''}님이 [${document_type}]를 상신했습니다.`,
      `/approvals?id=${approval.id}`
    )
  }

  return NextResponse.json(approval, { status: 201 })
}

// app_users.id → auth UUID 변환 (hakjeom과 동일 패턴)
async function getAuthUidByAppUserId(appUserId: string | number): Promise<string | null> {
  const { data: appUser } = await supabaseAdmin
    .from('app_users')
    .select('username')
    .eq('id', appUserId)
    .single()
  if (!appUser?.username) return null
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  if (error) return null
  return data.users.find(u => u.email === appUser.username)?.id ?? null
}

async function createNotification(
  appUserId: string | number,
  type: string,
  title: string,
  message: string,
  link: string
) {
  const authUid = await getAuthUidByAppUserId(appUserId)
  if (!authUid) return
  await supabaseAdmin.from('notifications').insert({
    user_id: authUid,
    type,
    title,
    message,
    link,
  })
}
