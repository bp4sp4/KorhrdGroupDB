import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET: 전체 계정 + 각 계정의 권한 목록 조회
export async function GET() {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { data: users, error } = await supabaseAdmin
    .from('app_users')
    .select('id, display_name, username, role')
    .not('role', 'in', '("master-admin","admin")')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: perms } = await supabaseAdmin
    .from('user_permissions')
    .select('user_id, section, scope, allowed_tabs')

  const permsMap: Record<number, { section: string; scope: string; allowed_tabs?: string[] | null }[]> = {}
  for (const p of perms ?? []) {
    if (!permsMap[p.user_id]) permsMap[p.user_id] = []
    permsMap[p.user_id].push({ section: p.section, scope: p.scope, allowed_tabs: p.allowed_tabs ?? null })
  }

  const result = (users ?? []).map(u => ({
    ...u,
    permissions: permsMap[u.id] ?? [],
  }))

  return NextResponse.json(result)
}

// POST: 특정 유저의 섹션 권한 upsert (scope=null이면 삭제)
export async function POST(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const body = await request.json() as {
    user_id: number
    section: string
    scope?: string | null
    allowed_tabs?: string[] | null
  }
  const { user_id, section, scope, allowed_tabs } = body

  if (!user_id || !section) {
    return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
  }

  // allowed_tabs만 업데이트 (scope 변경 없이)
  if (scope === undefined) {
    const { error } = await supabaseAdmin
      .from('user_permissions')
      .update({ allowed_tabs: allowed_tabs ?? null })
      .eq('user_id', user_id)
      .eq('section', section)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (scope === null) {
    // 권한 삭제
    const { error } = await supabaseAdmin
      .from('user_permissions')
      .delete()
      .eq('user_id', user_id)
      .eq('section', section)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // upsert (scope + allowed_tabs)
    const { error } = await supabaseAdmin
      .from('user_permissions')
      .upsert(
        { user_id, section, scope, allowed_tabs: allowed_tabs ?? null },
        { onConflict: 'user_id,section' }
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
