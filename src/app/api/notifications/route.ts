import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'

// GET: 알림 목록 조회 (내 알림 + user_id 없는 전체 공지)
export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth.errorResponse) return auth.errorResponse
    const userId = auth.user!.id

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      console.error('[GET /api/notifications]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const unreadCount = (data ?? []).filter(n => !n.is_read).length

    return NextResponse.json({ notifications: data ?? [], unreadCount })
  } catch (err) {
    console.error('[GET /api/notifications] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: 알림 삭제 (ids 배열 → 개별 삭제 / all: true → 전체 삭제)
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.errorResponse) return auth.errorResponse
    const userId = auth.user!.id

    const { ids, all } = await req.json()

    if (all) {
      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .or(`user_id.eq.${userId},user_id.is.null`)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else if (ids?.length) {
      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .in('id', ids)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/notifications] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: 알림 읽음 처리
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth.errorResponse) return auth.errorResponse
    const userId = auth.user!.id

    const { ids, all } = await req.json()

    if (all) {
      const { error } = await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .or(`user_id.eq.${userId},user_id.is.null`)
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
  } catch (err) {
    console.error('[PATCH /api/notifications] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
