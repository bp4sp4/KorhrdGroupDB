import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET: 활성 사용자 목록 (담당자 드롭다운용)
export async function GET() {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('id, display_name, username')
    .eq('is_active', true)
    .not('role', 'in', '("mini-admin")')
    .order('display_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    (data ?? []).map(u => ({
      id: u.id,
      name: u.display_name ?? u.username,
    }))
  )
}
