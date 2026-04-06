import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const formData = await req.formData()
  const files = formData.getAll('files') as File[]

  if (!files.length) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  const results = []
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer())
    const nameParts = file.name.split('.')
    const ext = nameParts.length > 1 ? (nameParts.pop() ?? 'bin') : 'bin'
    const baseName = nameParts.join('_').replace(/[^a-zA-Z0-9_-]/g, '_') || 'file'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${baseName}.${ext}`

    const { error } = await supabaseAdmin.storage
      .from('approval-attachments')
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data } = supabaseAdmin.storage
      .from('approval-attachments')
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
