import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { data, error } = await supabaseAdmin
    .from('departments')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
