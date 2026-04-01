import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { data, error } = await supabaseAdmin
    .from('approval_templates')
    .select('*')
    .order('category')
    .order('document_type')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const body = await request.json()
  const { document_type, category, steps } = body as {
    document_type: string
    category: string
    steps: unknown[]
  }

  if (!document_type || !category || !steps) {
    return NextResponse.json({ error: '문서 유형, 카테고리, 결재 단계는 필수입니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('approval_templates')
    .insert({ document_type, category, steps })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
