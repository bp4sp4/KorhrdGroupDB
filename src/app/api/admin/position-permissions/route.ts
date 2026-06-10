import { NextRequest, NextResponse } from 'next/server'
import { requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ALL_PERMISSION_SECTIONS } from '@/lib/auth/permissions'

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

  // 섹션/스코프 검증 — 코드 카탈로그가 단일 기준 (DB CHECK 제약 제거됨)
  if (!ALL_PERMISSION_SECTIONS.includes(section as (typeof ALL_PERMISSION_SECTIONS)[number])) {
    return NextResponse.json({ error: `알 수 없는 권한 섹션: ${section}` }, { status: 400 })
  }
  if (!['none', 'all', 'own'].includes(scope)) {
    return NextResponse.json({ error: `잘못된 scope 값: ${scope}` }, { status: 400 })
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
