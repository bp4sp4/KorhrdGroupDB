import { NextRequest, NextResponse } from 'next/server'
import { requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// POST /api/admin/announcements/upload — 공지 첨부파일 업로드 (master-admin 전용)
// FormData('files'): File[]
export async function POST(req: NextRequest) {
  const { errorResponse } = await requireMasterAdmin()
  if (errorResponse) return errorResponse

  const formData = await req.formData()
  const files = formData.getAll('files') as File[]

  if (!files.length) {
    return NextResponse.json({ error: '업로드할 파일이 없습니다.' }, { status: 400 })
  }

  const results: {
    name: string
    url: string
    type: string
    size: number
  }[] = []

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer())
    const nameParts = file.name.split('.')
    const ext = nameParts.length > 1 ? (nameParts.pop() ?? 'bin') : 'bin'
    const baseName =
      nameParts.join('_').replace(/[^a-zA-Z0-9_-]/g, '_') || 'file'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${baseName}.${ext}`

    const { error } = await supabaseAdmin.storage
      .from('announcement-attachments')
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data } = supabaseAdmin.storage
      .from('announcement-attachments')
      .getPublicUrl(path)

    results.push({
      name: file.name,
      url: data.publicUrl,
      type: file.type,
      size: file.size,
    })
  }

  return NextResponse.json({ files: results })
}
