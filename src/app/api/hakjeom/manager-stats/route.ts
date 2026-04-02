import { requireAuthFull } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/hakjeom/manager-stats?month=2026-04
// 담당자별 배정 건수 집계
// 기준: 해당 월에 생성된 hakjeom_consultations 중 manager가 설정된 건 (목록 페이지와 동일 기준)
export async function GET(request: NextRequest) {
  try {
    const { appUser, errorResponse } = await requireAuthFull()
    if (errorResponse) return errorResponse

    // 권한 체크: admin/master-admin 또는 assignment 권한 보유자만 접근
    const isAdmin = appUser.role === 'master-admin' || appUser.role === 'admin'
    if (!isAdmin) {
      const { data: perm } = await supabaseAdmin
        .from('user_permissions')
        .select('scope')
        .eq('user_id', appUser.id)
        .eq('section', 'assignment')
        .maybeSingle()
      if (!perm || perm.scope !== 'all') {
        return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
      }
    }

    const { searchParams } = request.nextUrl
    const now = new Date()
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const month = searchParams.get('month') ?? defaultMonth

    const [year, mo] = month.split('-').map(Number)
    // KST(UTC+9) 기준 월 범위를 UTC로 변환
    // KST 1일 00:00 = UTC 전월 마지막날 15:00
    const kstStart = new Date(Date.UTC(year, mo - 1, 1, 0, 0, 0) - 9 * 60 * 60 * 1000)
    const kstEnd = new Date(Date.UTC(year, mo, 1, 0, 0, 0) - 9 * 60 * 60 * 1000 - 1)
    const monthStart = kstStart.toISOString()
    const monthEnd = kstEnd.toISOString()

    // 해당 월 생성된 전체 건수 (담당자 없는 것 포함)
    const { count: totalCount, error: totalErr } = await supabaseAdmin
      .from('hakjeom_consultations')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)

    if (totalErr) {
      console.error('[manager-stats GET] total count error:', totalErr)
      return NextResponse.json({ error: '데이터를 불러오지 못했습니다.' }, { status: 500 })
    }

    // 담당자가 배정된 건만 조회
    const { data: rows, error } = await supabaseAdmin
      .from('hakjeom_consultations')
      .select('manager')
      .is('deleted_at', null)
      .not('manager', 'is', null)
      .neq('manager', '')
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)

    if (error) {
      console.error('[manager-stats GET] error:', error)
      return NextResponse.json({ error: '데이터를 불러오지 못했습니다.' }, { status: 500 })
    }

    // 담당자별 집계
    const counts: Record<string, number> = {}
    for (const row of rows ?? []) {
      if (row.manager) {
        counts[row.manager] = (counts[row.manager] ?? 0) + 1
      }
    }

    const data = Object.entries(counts)
      .map(([manager, count]) => ({ manager, count }))
      .sort((a, b) => b.count - a.count)

    const assigned = data.reduce((s, r) => s + r.count, 0)
    const unassigned = (totalCount ?? 0) - assigned

    return NextResponse.json({ month, data, total: assigned, unassigned, grandTotal: totalCount ?? 0 })
  } catch (err) {
    console.error('[manager-stats GET] Unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
