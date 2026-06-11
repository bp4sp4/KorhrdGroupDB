import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const MAX_FILES = 10
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

// POST /api/me/appraisal/appeals/upload — 이의제기 첨부파일 업로드
// formData: files
export async function POST(req: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const formData = await req.formData()
  const files = formData.getAll('files') as File[]

  if (!files.length) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `첨부는 최대 ${MAX_FILES}개까지 가능합니다.` },
      { status: 400 },
    )
  }

  const results = []
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `'${file.name}' 파일이 너무 큽니다. (최대 20MB)` },
        { status: 400 },
      )
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const nameParts = file.name.split('.')
    const ext = nameParts.length > 1 ? (nameParts.pop() ?? 'bin') : 'bin'
    const baseName = nameParts.join('_').replace(/[^a-zA-Z0-9_-]/g, '_') || 'file'
    const path = `${appUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${baseName}.${ext}`

    const { error } = await supabaseAdmin.storage
      .from('appraisal-appeals')
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data } = supabaseAdmin.storage
      .from('appraisal-appeals')
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
