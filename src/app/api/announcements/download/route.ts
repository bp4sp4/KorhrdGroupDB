import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/announcements/download?path=<storagePath>&filename=<원본 한글 파일명>
// Supabase Storage에서 파일을 받아 강제 다운로드(attachment) 헤더와 함께 반환
// - 한글 파일명 보존 (RFC 5987 filename*)
// - 모든 파일을 application/octet-stream으로 응답해 브라우저가 인라인 해석 안 함
export async function GET(req: NextRequest) {
  const { errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')
  const filename = (searchParams.get('filename') ?? '').trim() || 'download'

  if (!path) {
    return NextResponse.json(
      { error: 'path 파라미터가 필요합니다.' },
      { status: 400 },
    )
  }

  // path 안전성 — 슬래시 경로 탐색 차단(.., 절대경로 등은 storage api가 자체 거부하긴 함)
  if (path.includes('..') || path.startsWith('/')) {
    return NextResponse.json({ error: '잘못된 경로' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.storage
    .from('announcement-attachments')
    .download(path)

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? '파일을 찾을 수 없습니다.' },
      { status: 404 },
    )
  }

  const arrayBuffer = await data.arrayBuffer()
  const encodedName = encodeURIComponent(filename)
  // ASCII fallback (RFC 7230 token-safe). 한글 등은 ?로 대체되지만 modern 브라우저는 filename* 사용
  const asciiName = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'")

  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      'Cache-Control': 'private, max-age=0, no-store',
      'Content-Length': String(arrayBuffer.byteLength),
    },
  })
}
