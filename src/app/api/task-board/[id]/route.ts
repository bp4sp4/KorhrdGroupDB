import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface RouteParams { params: Promise<{ id: string }> }

// 작성자 본인 또는 admin/master-admin만 수정/삭제 가능
async function loadAndAuthorize(id: string, appUser: { id: number; role: string }) {
  const { data: row } = await supabaseAdmin
    .from('task_board_items')
    .select('id, created_by')
    .eq('id', id)
    .maybeSingle()
  if (!row) {
    return { ok: false as const, response: NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 }) }
  }
  const isAdmin = appUser.role === 'master-admin' || appUser.role === 'admin'
  const isOwner = row.created_by === appUser.id
  if (!isAdmin && !isOwner) {
    return { ok: false as const, response: NextResponse.json({ error: '작성자만 수정할 수 있습니다.' }, { status: 403 }) }
  }
  return { ok: true as const }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }
  const { id } = await params
  const authz = await loadAndAuthorize(id, appUser)
  if (!authz.ok) return authz.response

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (typeof body.title === 'string') updates.title = body.title.trim()
  if (typeof body.completed === 'boolean') updates.completed = body.completed
  if (body.assignee_name === null || typeof body.assignee_name === 'string') {
    updates.assignee_name = typeof body.assignee_name === 'string'
      ? body.assignee_name.trim() || null
      : null
  }

  const { data, error } = await supabaseAdmin
    .from('task_board_items')
    .update(updates)
    .eq('id', id)
    .select(`
      id, year, month, week_no, weekday, title, completed, sort_order,
      assignee_name, created_by, created_at, updated_at,
      author:app_users!task_board_items_created_by_fkey(id, display_name)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }
  const { id } = await params
  const authz = await loadAndAuthorize(id, appUser)
  if (!authz.ok) return authz.response

  const { error } = await supabaseAdmin.from('task_board_items').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
