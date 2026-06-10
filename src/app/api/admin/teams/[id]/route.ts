import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

const ALLOWED_JOURNAL_FORMS = new Set(['default', 'academic', 'practicum'])

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const { id } = await params
  const body = await request.json()
  const { name, code, journal_form, sort_order, is_active, department_id, leader_user_id } =
    body as {
      name?: string
      code?: string
      journal_form?: string
      sort_order?: number
      is_active?: boolean
      department_id?: string
      leader_user_id?: number | null
    }

  if (journal_form !== undefined && !ALLOWED_JOURNAL_FORMS.has(journal_form)) {
    return NextResponse.json(
      { error: `허용되지 않은 journal_form 값입니다. (${[...ALLOWED_JOURNAL_FORMS].join(', ')})` },
      { status: 400 },
    )
  }

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (code !== undefined) updates.code = code.toUpperCase()
  if (journal_form !== undefined) updates.journal_form = journal_form
  if (sort_order !== undefined) updates.sort_order = sort_order
  if (is_active !== undefined) updates.is_active = is_active
  if (department_id !== undefined) updates.department_id = department_id
  if (leader_user_id !== undefined) {
    updates.leader_user_id =
      typeof leader_user_id === 'number' ? leader_user_id : null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: '변경할 항목이 없습니다.' },
      { status: 400 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from('teams')
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

  // 비활성화 (soft delete)
  const { error } = await supabaseAdmin
    .from('teams')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
