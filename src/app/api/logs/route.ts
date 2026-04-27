import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const PAGE_SIZE = 15

export async function GET(request: NextRequest) {
  try {
    const { user: _user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const { searchParams } = request.nextUrl
    const resource = searchParams.get('resource') ?? ''
    const action = searchParams.get('action') ?? ''
    const search = searchParams.get('search') ?? ''
    const from = searchParams.get('from') ?? ''
    const to = searchParams.get('to') ?? ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const from_idx = (page - 1) * PAGE_SIZE
    const to_idx = from_idx + PAGE_SIZE - 1

    let query = supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from_idx, to_idx)

    if (resource) query = query.eq('resource', resource)
    if (action) query = query.eq('action', action)
    if (search) {
      // PostgREST .or() 인젝션 방어: 특수문자 제거
      const safeSearch = search.replace(/[,()*\\]/g, '').slice(0, 100)
      if (safeSearch) {
        query = query.or(`user_email.ilike.%${safeSearch}%,detail.ilike.%${safeSearch}%,resource_id.ilike.%${safeSearch}%`)
      }
    }
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to + 'T23:59:59')

    const { data, error, count } = await query

    if (error) {
      console.error('[GET /api/logs] Supabase error:', error)
      return NextResponse.json({ error: '로그를 불러오지 못했습니다.' }, { status: 500 })
    }

    // email → display_name 매핑
    const emails = [...new Set((data ?? []).map(r => r.user_email).filter(Boolean))]
    let nameMap: Record<string, string> = {}
    if (emails.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('app_users')
        .select('username, display_name')
        .in('username', emails)
      for (const u of users ?? []) {
        if (u.username && u.display_name) nameMap[u.username] = u.display_name
      }
    }

    const enriched = (data ?? []).map(r => ({
      ...r,
      display_name: r.user_email ? (nameMap[r.user_email] ?? r.user_email) : null,
    }))

    return NextResponse.json({ data: enriched, total: count ?? 0 })
  } catch (err) {
    console.error('[GET /api/logs] Unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
