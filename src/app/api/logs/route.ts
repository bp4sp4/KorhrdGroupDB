import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

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
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '300'), 1000)

    let query = supabaseAdmin
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (resource) query = query.eq('resource', resource)
    if (action) query = query.eq('action', action)
    if (search) query = query.or(`user_email.ilike.%${search}%,detail.ilike.%${search}%,resource_id.ilike.%${search}%`)
    if (from) query = query.gte('created_at', from)
    if (to) query = query.lte('created_at', to + 'T23:59:59')

    const { data, error } = await query

    if (error) {
      console.error('[GET /api/logs] Supabase error:', error)
      return NextResponse.json({ error: '로그를 불러오지 못했습니다.' }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[GET /api/logs] Unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
