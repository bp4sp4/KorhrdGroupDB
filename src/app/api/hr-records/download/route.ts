import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/hr-records/download?path=<storagePath>&filename=<원본 한글 파일명>
// 인사기록카드 첨부파일(경력증명서 등) 강제 다운로드
// 권한: master-admin 또는 본인 파일 (path가 user-{본인id}로 시작)
export async function GET(req: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path')
  const filename =
    (searchParams.get('filename') ?? '').trim() || 'download'

  if (!path) {
    return NextResponse.json(
      { error: 'path 파라미터가 필요합니다.' },
      { status: 400 },
    )
  }

  // 경로 안전성
  if (path.includes('..') || path.startsWith('/')) {
    return NextResponse.json({ error: '잘못된 경로' }, { status: 400 })
  }

  // 권한 — master-admin 또는 본인 파일
  const isMaster = appUser.role === 'master-admin'
  const isOwn = path.startsWith(`user-${appUser.id}/`)
  if (!isMaster && !isOwn) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin.storage
    .from('hr-profile-images')
    .download(path)

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? '파일을 찾을 수 없습니다.' },
      { status: 404 },
    )
  }

  const arrayBuffer = await data.arrayBuffer()
  const encodedName = encodeURIComponent(filename)
  const asciiName = filename
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/"/g, "'")

  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      'Cache-Control': 'private, max-age=0, no-store',
      'Content-Length': String(arrayBuffer.byteLength),
    },
  })
}
