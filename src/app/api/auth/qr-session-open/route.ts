import { NextResponse } from 'next/server'
import { createQrSession } from '@/lib/qr-sessions'

export async function POST() {
  try {
    const session = await createQrSession()
    return NextResponse.json({
      token: session.token,
      chars: session.chars,
      correctIndex: session.correctIndex,
    })
  } catch (e) {
    console.error('[qr-session-open]', e)
    return NextResponse.json({ error: 'QR 세션 생성에 실패했습니다.' }, { status: 500 })
  }
}
