import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// 서명 업로드 URL 발급 — 파일은 브라우저에서 Supabase 스토리지로 직접 업로드한다.
// (Vercel 서버리스 요청 본문 제한 ~4.5MB 로 큰 파일이 413 나던 문제 우회)
// body: { files: { name: string; type?: string }[] }
export async function POST(req: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const body = (await req.json().catch(() => null)) as {
    files?: { name?: string; type?: string }[]
  } | null
  const files = body?.files ?? []
  if (!files.length) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  const uploads = []
  for (const f of files) {
    const rawName = f.name ?? 'file'
    const nameParts = rawName.split('.')
    const ext = nameParts.length > 1 ? (nameParts.pop() ?? 'bin') : 'bin'
    const baseName =
      nameParts.join('_').replace(/[^a-zA-Z0-9_-]/g, '_') || 'file'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${baseName}.${ext}`

    const { data, error } = await supabaseAdmin.storage
      .from('approval-attachments')
      .createSignedUploadUrl(path)
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? '업로드 URL 발급 실패' },
        { status: 500 },
      )
    }

    const { data: pub } = supabaseAdmin.storage
      .from('approval-attachments')
      .getPublicUrl(path)

    uploads.push({
      name: rawName,
      type: f.type ?? '',
      path,
      token: data.token,
      publicUrl: pub.publicUrl,
    })
  }

  return NextResponse.json({ uploads })
}
