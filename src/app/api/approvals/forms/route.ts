import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { data, error } = await supabaseAdmin
    .from('approval_form_templates')
    .select('id, category_id, name, document_type, description, schema, supports_attachments, sort_order, default_approval_template_id, title_placeholder')
    .eq('is_active', true)
    .order('sort_order')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
