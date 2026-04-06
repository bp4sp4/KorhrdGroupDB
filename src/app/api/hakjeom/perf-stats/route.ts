import { requireAuthFull } from '@/lib/auth/requireAuth'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/hakjeom/perf-stats
// 담당자 실적 계산용 — 스코프와 무관하게 전체 담당자 데이터 반환
// hakjeom 접근 권한(own/all 무관)이 있으면 조회 가능
export async function GET() {
  try {
    const { appUser, errorResponse } = await requireAuthFull()
    if (errorResponse) return errorResponse

    const isFullAccess = appUser.role === 'master-admin' || appUser.role === 'admin'

    if (!isFullAccess) {
      const { data: perm } = await supabaseAdmin
        .from('user_permissions')
        .select('scope')
        .eq('user_id', appUser.id)
        .eq('section', 'hakjeom')
        .maybeSingle()
      // 권한 없으면 빈 배열 반환
      if (!perm) return NextResponse.json([])
    }

    const { data, error } = await supabaseAdmin
      .from('hakjeom_consultations')
      .select('manager, status, created_at')
      .is('deleted_at', null)
      .not('manager', 'is', null)
      .neq('manager', '')

    if (error) {
      console.error('[perf-stats GET] error:', error)
      return NextResponse.json({ error: '데이터를 불러오지 못했습니다.' }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[perf-stats GET] Unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
