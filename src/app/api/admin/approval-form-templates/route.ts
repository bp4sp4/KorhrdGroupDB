import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { syncApprovalTemplate } from '@/lib/approvalForms/sync'
import type { FormSchema } from '@/types/approvalForm'

export async function GET(request: Request) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get('category_id')

  let query = supabaseAdmin
    .from('approval_form_templates')
    .select('*')
    .order('sort_order')
    .order('name')

  if (categoryId) query = query.eq('category_id', categoryId)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

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
    name: string
    document_type: string
    description?: string | null
    schema?: FormSchema
    supports_attachments?: boolean
    is_active?: boolean
    sort_order?: number
    default_approval_template_id?: string | null
    title_placeholder?: string | null
  }

  if (!name || !name.trim()) {
    return NextResponse.json({ error: '양식명은 필수입니다.' }, { status: 400 })
  }
  if (!document_type || !document_type.trim()) {
    return NextResponse.json({ error: '문서 유형 코드는 필수입니다.' }, { status: 400 })
  }
  if (!default_approval_template_id) {
    return NextResponse.json(
      { error: '기본 결재선을 선택해야 합니다.' },
      { status: 400 },
    )
  }

  const syncedId = await syncApprovalTemplate({
    document_type: document_type.trim(),
    category_id: category_id ?? null,
    default_approval_template_id,
    is_active: is_active ?? true,
    sort_order: sort_order ?? 0,
  })

  const { data, error } = await supabaseAdmin
    .from('approval_form_templates')
    .insert({
      category_id: category_id ?? null,
      name: name.trim(),
      document_type: document_type.trim(),
      description: description ?? null,
      schema: schema ?? { blocks: [] },
      supports_attachments: supports_attachments ?? false,
      is_active: is_active ?? true,
      sort_order: sort_order ?? 0,
      default_approval_template_id,
      title_placeholder: title_placeholder ?? null,
      synced_template_id: syncedId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
