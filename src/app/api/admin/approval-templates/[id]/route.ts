import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id } = await params
  const body = await request.json()
  const { document_type, category, steps, is_active } = body as {
    document_type?: string
    category?: string
    steps?: unknown[]
    is_active?: boolean
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (document_type !== undefined) updates.document_type = document_type
  if (category !== undefined) updates.category = category
  if (steps !== undefined) updates.steps = steps
  if (is_active !== undefined) updates.is_active = is_active

  const { data, error } = await supabaseAdmin
    .from('approval_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('approval_templates')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
