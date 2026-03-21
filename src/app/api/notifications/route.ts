import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'

// GET: 알림 목록 조회 (최근 30개)
export async function GET() {
  const auth = await requireAuth()
  if (auth.errorResponse) return auth.errorResponse

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 읽지 않은 개수도 함께
  const { count } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)

  return NextResponse.json({ notifications: data, unreadCount: count ?? 0 })
}

// PATCH: 알림 읽음 처리
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.errorResponse) return auth.errorResponse

  const { ids, all } = await req.json()

  if (all) {
    // 전체 읽음 처리
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (ids?.length) {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .in('id', ids)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
