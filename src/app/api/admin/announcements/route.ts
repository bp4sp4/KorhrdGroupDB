import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull, requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface AnnouncementAttachment {
  name: string
  url: string
  type?: string
  size?: number
}

// GET /api/admin/announcements — 목록 조회 (인증된 사용자 누구나)
export async function GET() {
  const { errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .select('*')
    .order('date', { ascending: false })
    .order('id', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ items: data ?? [] })
}

// POST /api/admin/announcements — 공지 생성 (master-admin 전용)
export async function POST(request: NextRequest) {
  const { appUser, errorResponse } = await requireMasterAdmin()
  if (errorResponse) return errorResponse

  const body = (await request.json()) as {
    date?: string
    title?: string
    body?: string
    items?: string[]
    attachments?: AnnouncementAttachment[]
  }

  const title = (body.title ?? '').trim()
  if (!title) {
    return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 })
  }
  const bodyText = typeof body.body === 'string' ? body.body.trim() : ''

  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const date = body.date || `${y}-${m}-${d}`

  const items = Array.isArray(body.items)
    ? body.items.map((s) => String(s).trim()).filter(Boolean)
    : []
  const attachments = Array.isArray(body.attachments) ? body.attachments : []

  const insertPayload: Record<string, unknown> = {
    date,
    title,
    body: bodyText,
    items,
    attachments,
  }
  // created_by 컬럼이 있을 때만 채움 (스키마 이전 호환)
  if (appUser?.id != null) insertPayload.created_by = appUser.id

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
