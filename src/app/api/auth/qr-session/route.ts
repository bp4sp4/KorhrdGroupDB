import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { createQrSession } from '@/lib/qr-sessions'

export async function POST() {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const session = createQrSession()
  return NextResponse.json({
    token: session.token,
    chars: session.chars,
    correctIndex: session.correctIndex,
  })
}
