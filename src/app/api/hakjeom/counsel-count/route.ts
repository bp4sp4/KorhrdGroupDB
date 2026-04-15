import { NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/hakjeom/counsel-count
// contact_scheduled_at <= 오늘인 건 수 반환 (사이드바 배지용, 기존 배너와 동일 기준)
export async function GET() {
  try {
    const { appUser, errorResponse } = await requireAuthFull()
    if (errorResponse) return errorResponse

    const isFullAccess = appUser.role === 'master-admin' || appUser.role === 'admin'
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

    let query = supabaseAdmin
      .from('hakjeom_consultations')
      .select('id, manager', { count: 'exact', head: false })
      .is('deleted_at', null)
      .not('contact_scheduled_at', 'is', null)
      .lte('contact_scheduled_at', `${today}T23:59:59+09:00`)

    if (!isFullAccess) {
      const { data: perm } = await supabaseAdmin
        .from('user_permissions')
        .select('scope')
        .eq('user_id', appUser.id)
        .eq('section', 'hakjeom')
        .maybeSingle()
      if (!perm) return NextResponse.json({ count: 0 })
      if (perm.scope === 'own') {
        query = query.eq('manager', appUser.display_name ?? '')
      }
    }

    const { count, error } = await query

    if (error) return NextResponse.json({ count: 0 })
    return NextResponse.json({ count: count ?? 0 })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
