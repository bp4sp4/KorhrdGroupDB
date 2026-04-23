import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface RouteParams {
  params: Promise<{ document_type: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { document_type } = await params

  const { data, error } = await supabaseAdmin
    .from('approval_form_templates')
    .select('*')
    .eq('document_type', document_type)
    .eq('is_active', true)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}
