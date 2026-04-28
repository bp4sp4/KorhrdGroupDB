import { NextResponse } from 'next/server'
import { createQrSession } from '@/lib/qr-sessions'

// 인증 불필요 — 자격증명은 이미 클라이언트에서 검증 완료
export async function POST() {
  const session = createQrSession()
  return NextResponse.json({
    token: session.token,
    chars: session.chars,
    correctIndex: session.correctIndex,
  })
}
