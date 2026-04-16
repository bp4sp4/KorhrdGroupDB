import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/management/auditLog'
import { requireManagementAccess } from '@/lib/auth/managementAccess'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireManagementAccess('revenue-upload', { allowOwn: true })
  if (!access.ok) return access.response

  const { id } = await params

  const userId = access.user.id

  const body = await request.json()
  const allowed = ['revenue_date', 'department_id', 'revenue_type', 'customer_name', 'amount', 'product_name', 'manager_id', 'memo']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      updates[key] = body[key] === '' ? null : body[key]
    }
  }
  if ('amount' in updates) updates.amount = Number(updates.amount)

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 })
  }

  // 'own' 스코프: 본인 사업부 데이터만 수정 가능 + 사업부 변경 불가
  if (access.scope === 'own') {
    const ownDept = access.appUser.department_id
    if (!ownDept) {
      return NextResponse.json({ error: '사업부가 지정되지 않아 수정할 수 없습니다.' }, { status: 403 })
    }
    const { data: existing } = await supabaseAdmin
      .from('revenues')
      .select('department_id')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()
    if (!existing) {
      return NextResponse.json({ error: '데이터를 찾을 수 없습니다.' }, { status: 404 })
    }
    if (existing.department_id !== ownDept) {
      return NextResponse.json({ error: '본인 사업부 데이터만 수정할 수 있습니다.' }, { status: 403 })
    }
    if ('department_id' in updates && updates.department_id !== ownDept) {
      return NextResponse.json({ error: '다른 사업부로 변경할 수 없습니다.' }, { status: 403 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('revenues')
    .update(updates)
    .eq('id', id)
    .eq('is_deleted', false)
    .select(`*, department:departments(id, code, name)`)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: '데이터를 찾을 수 없습니다.' }, { status: 404 })

  await writeAuditLog({
    userId,
    action: 'UPDATE',
    targetType: 'revenues',
    targetId: id,
    changes: updates,
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireManagementAccess('revenue-upload', { allowOwn: true })
  if (!access.ok) return access.response

  const { id } = await params

  const userId = access.user.id

  // 'own' 스코프: 본인 사업부 데이터만 삭제 가능
  if (access.scope === 'own') {
    const ownDept = access.appUser.department_id
    if (!ownDept) {
      return NextResponse.json({ error: '사업부가 지정되지 않아 삭제할 수 없습니다.' }, { status: 403 })
    }
    const { data: existing } = await supabaseAdmin
      .from('revenues')
      .select('department_id')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle()
    if (!existing) {
      return NextResponse.json({ error: '데이터를 찾을 수 없습니다.' }, { status: 404 })
    }
    if (existing.department_id !== ownDept) {
      return NextResponse.json({ error: '본인 사업부 데이터만 삭제할 수 있습니다.' }, { status: 403 })
    }
  }

  const { error } = await supabaseAdmin
    .from('revenues')
    .update({ is_deleted: true })
    .eq('id', id)
    .eq('is_deleted', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog({
    userId,
    action: 'DELETE',
    targetType: 'revenues',
    targetId: id,
    changes: { is_deleted: true },
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json({ success: true })
}
