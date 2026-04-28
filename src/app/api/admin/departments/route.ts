import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const { data, error } = await supabaseAdmin
    .from('departments')
    .select('*')
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const body = await request.json()
  const { name, code } = body as { name: string; code: string }

  if (!name || !code) {
    return NextResponse.json({ error: '코드와 사업부명은 필수입니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('departments')
    .insert({ name, code: code.toUpperCase() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
