import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

const ALLOWED_TABLES = [
  'hakjeom_consultations',
  'private_cert_consultations',
  'practice_consultations',
  'practice_applications',
  'employment_applications',
  'agency_agreements',
  'certificate_applications',
]

// GET /api/memo-logs?table=hakjeom_consultations&id=xxx
export async function GET(req: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const table = req.nextUrl.searchParams.get('table')
  const id    = req.nextUrl.searchParams.get('id')

  if (!table || !id || !ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('memo_logs')
    .select('*')
    .eq('table_name', table)
    .eq('record_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/memo-logs
export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { table_name, record_id, content } = await req.json()

  if (!table_name || !record_id || !content?.trim() || !ALLOWED_TABLES.includes(table_name)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('memo_logs')
    .insert({ table_name, record_id, content: content.trim(), author: user?.email ?? null })
    .select()
    .single()

  if (error) {
    console.error('[memo-logs POST]', error)
    return NextResponse.json({ error: error.message, code: error.code, details: error.details }, { status: 500 })
  }

  // 상담완료 우선노출 해제: 메모 작성 시 counsel_completed_at 초기화
  const COUNSEL_COMPLETE_STATUSES = ['상담완료-할것같음', '상담완료-중간', '상담완료-안할것같다']
  if (table_name === 'hakjeom_consultations') {
    const { data: cur } = await supabaseAdmin
      .from('hakjeom_consultations')
      .select('status, counsel_completed_at')
      .eq('id', record_id)
      .maybeSingle()
    if (cur && COUNSEL_COMPLETE_STATUSES.includes(cur.status) && cur.counsel_completed_at) {
      await supabaseAdmin
        .from('hakjeom_consultations')
        .update({ counsel_completed_at: null })
        .eq('id', record_id)
    }
  }

  return NextResponse.json(data)
}

// PATCH /api/memo-logs
export async function PATCH(req: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id, content } = await req.json()
  if (!id || !content?.trim()) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('memo_logs')
    .update({ content: content.trim() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/memo-logs?id=xxx
export async function DELETE(req: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('memo_logs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
