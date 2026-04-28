import { NextRequest, NextResponse } from 'next/server'
import { requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// 직급 권한 부여는 master-admin 전용
export async function POST(request: NextRequest) {
  const { errorResponse } = await requireMasterAdmin()
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
    console.error('[admin/position-permissions POST]', error)
    return NextResponse.json({ error: '권한 저장 중 오류가 발생했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
