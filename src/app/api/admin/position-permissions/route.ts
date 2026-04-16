import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const body = await request.json() as {
    position_id: string
    section: string
    scope: string
    allowed_tabs?: string[] | null
  }

  const { position_id, section, scope, allowed_tabs } = body

  if (!position_id || !section || !scope) {
    return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('position_permissions')
    .upsert(
      { position_id, section, scope, allowed_tabs: allowed_tabs ?? null },
      { onConflict: 'position_id,section' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
