import { NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/task-board/me — 현재 사용자의 작성 권한 여부
export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ id: null, role: appUser?.role ?? null, canWrite: false }, { status: 200 })
  }

  if (appUser.role === 'master-admin' || appUser.role === 'admin') {
    return NextResponse.json({ id: appUser.id, role: appUser.role, canWrite: true })
  }

  if (!appUser.position_id) {
    return NextResponse.json({ id: appUser.id, role: appUser.role, canWrite: false })
  }

  const { data } = await supabaseAdmin
    .from('positions')
    .select('sort_order, is_active')
    .eq('id', appUser.position_id)
    .maybeSingle()

  const canWrite = !!(data?.is_active && Number(data.sort_order) >= 3)
  return NextResponse.json({ id: appUser.id, role: appUser.role, canWrite })
}
