import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const { data, error } = await supabaseAdmin
    .from('approval_form_categories')
    .select('*')
    .order('sort_order')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const body = await request.json()
  const { name, parent_id, sort_order } = body as {
    name: string
    parent_id?: string | null
    sort_order?: number
  }

  if (!name || !name.trim()) {
    return NextResponse.json({ error: '카테고리명은 필수입니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('approval_form_categories')
    .insert({
      name: name.trim(),
      parent_id: parent_id ?? null,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
