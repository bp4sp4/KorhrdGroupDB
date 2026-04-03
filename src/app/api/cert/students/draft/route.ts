import { requireAuth, requireAuthFull } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { logAction } from '@/lib/audit/logAction'

const TABLE = 'cert_students'

// ─── GET: 임시저장 목록 조회 ──────────────────────────────────────────────────

export async function GET() {
  try {
    const { errorResponse } = await requireAuthFull()
    if (errorResponse) return errorResponse

    const [queryResult, memoResult] = await Promise.all([
      supabaseAdmin
        .from(TABLE)
        .select('*')
        .eq('is_draft', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }),
      supabaseAdmin
        .from('memo_logs')
        .select('record_id, content, created_at')
        .eq('table_name', TABLE)
        .order('created_at', { ascending: false }),
    ])

    if (queryResult.error) {
      console.error('[cert/students/draft GET] Supabase error:', queryResult.error)
      return NextResponse.json({ error: 'Failed to fetch draft students' }, { status: 500 })
    }

    const items = queryResult.data || []
    const countMap: Record<string, number> = {}
    const latestMemoMap: Record<string, string> = {}
    const latestMemoAtMap: Record<string, string> = {}
    for (const m of memoResult.data || []) {
      countMap[m.record_id] = (countMap[m.record_id] || 0) + 1
      if (!latestMemoMap[m.record_id]) {
        latestMemoMap[m.record_id] = m.content
        latestMemoAtMap[m.record_id] = m.created_at
      }
    }
    const result = items.map(item => ({
      ...item,
      memo_count: countMap[String(item.id)] || 0,
      latest_memo: latestMemoMap[String(item.id)] ?? null,
      latest_memo_at: latestMemoAtMap[String(item.id)] ?? null,
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('[cert/students/draft GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── PATCH: 임시저장 → 학생관리 확정 ─────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const { ids } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from(TABLE)
      .update({ is_draft: false })
      .in('id', ids)

    if (error) {
      console.error('[cert/students/draft PATCH] Supabase error:', error)
      return NextResponse.json({ error: 'Failed to confirm drafts' }, { status: 500 })
    }

    await logAction({
      user_id: user.id,
      user_email: user.email,
      action: 'confirm_draft',
      resource: '민간자격증 학생관리',
      detail: `임시저장 ${ids.length}건 학생관리로 이동`,
    })

    return NextResponse.json({ count: ids.length })
  } catch (err) {
    console.error('[cert/students/draft PATCH] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
