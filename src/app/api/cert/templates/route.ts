import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

const TABLE = 'cert_counsel_templates'
const BUCKET = 'cert-templates'

export async function GET(req: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const subTab = req.nextUrl.searchParams.get('sub_tab')
  let query = supabaseAdmin.from(TABLE).select('*').order('order_index').order('created_at')
  if (subTab) query = query.eq('sub_tab', subTab)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { sub_tab, title, content, images, order_index } = await req.json()
  if (!sub_tab || !title?.trim())
    return NextResponse.json({ error: '탭과 제목을 입력해주세요.' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .insert({ sub_tab, title: title.trim(), content: content?.trim() ?? '', images: images ?? [], order_index: order_index ?? 0 })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id, ...fields } = await req.json()
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })

  if (fields.title) fields.title = fields.title.trim()
  if (fields.content) fields.content = fields.content.trim()
  fields.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin.from(TABLE).update(fields).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id, imagePaths } = await req.json()
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })

  // 이미지 스토리지에서 삭제
  if (imagePaths?.length) {
    await supabaseAdmin.storage.from(BUCKET).remove(imagePaths)
  }

  const { error } = await supabaseAdmin.from(TABLE).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
