import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const { data, error } = await supabaseAdmin
    .from('positions')
    .select('*')
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const body = await request.json()
  const { name, sort_order } = body as { name: string; sort_order: number }

  if (!name || sort_order === undefined) {
    return NextResponse.json({ error: '직급명과 순서는 필수입니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('positions')
    .insert({ name, sort_order })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
