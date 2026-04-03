import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

const BUCKET = 'cert-templates'

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { files } = await req.json() as {
    files: { name: string; type: string; data: string }[]
  }

  if (!files?.length) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

  const uploaded: { path: string; url: string }[] = []

  for (const file of files) {
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const buffer = Buffer.from(file.data, 'base64')

    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    uploaded.push({ path, url: data.publicUrl })
  }

  return NextResponse.json(uploaded)
}

export async function DELETE(req: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { path } = await req.json()
  if (!path) return NextResponse.json({ error: 'path가 필요합니다.' }, { status: 400 })

  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
