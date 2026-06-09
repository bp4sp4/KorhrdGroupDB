import { NextRequest, NextResponse } from 'next/server'
import { requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface AnnouncementAttachment {
  name: string
  url: string
  type?: string
  size?: number
}

// PATCH /api/admin/announcements/[id] — 공지 수정 (master-admin 전용)
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { errorResponse } = await requireMasterAdmin()
  if (errorResponse) return errorResponse

  const { id } = await context.params
  const numericId = Number(id)
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: '잘못된 id' }, { status: 400 })
  }

  const body = (await request.json()) as {
    date?: string
    title?: string
    body?: string
    items?: string[]
    attachments?: AnnouncementAttachment[]
  }

  const update: Record<string, unknown> = {}
  if (typeof body.date === 'string' && body.date) update.date = body.date
  if (typeof body.title === 'string') update.title = body.title.trim()
  if (typeof body.body === 'string') update.body = body.body.trim()
  if (Array.isArray(body.items)) {
    update.items = body.items.map((s) => String(s).trim()).filter(Boolean)
  }
  if (Array.isArray(body.attachments)) update.attachments = body.attachments

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: '변경할 항목이 없습니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .update(update)
    .eq('id', numericId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE /api/admin/announcements/[id] — 공지 삭제 (master-admin 전용)
// 첨부파일도 Storage에서 제거
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { errorResponse } = await requireMasterAdmin()
  if (errorResponse) return errorResponse

  const { id } = await context.params
  const numericId = Number(id)
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: '잘못된 id' }, { status: 400 })
  }

  // 첨부파일 URL → Storage path 추출 후 삭제 시도
  const { data: existing } = await supabaseAdmin
    .from('announcements')
    .select('attachments')
    .eq('id', numericId)
    .maybeSingle()

  const atts =
    (existing?.attachments as AnnouncementAttachment[] | null | undefined) ?? []
  if (atts.length > 0) {
    const paths: string[] = []
    for (const a of atts) {
      const marker = '/announcement-attachments/'
      const idx = a.url?.indexOf(marker)
      if (idx != null && idx > -1) {
        paths.push(a.url.slice(idx + marker.length))
      }
    }
    if (paths.length > 0) {
      await supabaseAdmin.storage.from('announcement-attachments').remove(paths)
    }
  }

  const { error } = await supabaseAdmin
    .from('announcements')
    .delete()
    .eq('id', numericId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
