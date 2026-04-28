import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { syncApprovalTemplate, deactivateSyncedTemplate } from '@/lib/approvalForms/sync'
import type { FormSchema } from '@/types/approvalForm'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('approval_form_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const { id } = await params
  const body = await request.json()
  const {
    category_id,
    name,
    document_type,
    description,
    schema,
    supports_attachments,
    is_active,
    sort_order,
    default_approval_template_id,
    title_placeholder,
  } = body as {
    category_id?: string | null
    name?: string
    document_type?: string
    description?: string | null
    schema?: FormSchema
    supports_attachments?: boolean
    is_active?: boolean
    sort_order?: number
    default_approval_template_id?: string | null
    title_placeholder?: string | null
  }

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('approval_form_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: '양식을 찾을 수 없습니다.' }, { status: 404 })
  }

  const effectiveDefaultId = default_approval_template_id !== undefined
    ? default_approval_template_id
    : existing.default_approval_template_id

  if (!effectiveDefaultId) {
    return NextResponse.json(
      { error: '기본 결재선을 선택해야 합니다.' },
      { status: 400 },
    )
  }

  const updates: Record<string, unknown> = {}
  if (category_id !== undefined) updates.category_id = category_id
  if (name !== undefined) updates.name = name.trim()
  if (document_type !== undefined) updates.document_type = document_type.trim()
  if (description !== undefined) updates.description = description
  if (schema !== undefined) updates.schema = schema
  if (supports_attachments !== undefined) updates.supports_attachments = supports_attachments
  if (is_active !== undefined) updates.is_active = is_active
  if (sort_order !== undefined) updates.sort_order = sort_order
  if (default_approval_template_id !== undefined) updates.default_approval_template_id = default_approval_template_id
  if (title_placeholder !== undefined) updates.title_placeholder = title_placeholder

  // 동기화 실행
  const syncedId = await syncApprovalTemplate({
    document_type: (document_type ?? existing.document_type).trim(),
    category_id: category_id !== undefined ? category_id : existing.category_id,
    default_approval_template_id: effectiveDefaultId,
    is_active: is_active !== undefined ? is_active : existing.is_active,
    sort_order: sort_order !== undefined ? sort_order : existing.sort_order,
  })
  updates.synced_template_id = syncedId

  const { data, error } = await supabaseAdmin
    .from('approval_form_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const { id } = await params

  const { data: existing } = await supabaseAdmin
    .from('approval_form_templates')
    .select('synced_template_id')
    .eq('id', id)
    .single()

  if (existing?.synced_template_id) {
    await deactivateSyncedTemplate(existing.synced_template_id)
  }

  const { error } = await supabaseAdmin
    .from('approval_form_templates')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
