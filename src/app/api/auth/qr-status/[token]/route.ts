import { NextRequest, NextResponse } from 'next/server'
import { getQrSession, deleteQrSession } from '@/lib/qr-sessions'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const session = await getQrSession(token)

  if (!session) {
    return NextResponse.json({ status: 'expired' })
  }

  if (session.status === 'confirmed') {
    const accessToken = session.access_token
    const refreshToken = session.refresh_token
    await deleteQrSession(token)
    return NextResponse.json({
      status: 'confirmed',
      access_token: accessToken,
      refresh_token: refreshToken,
    })
  }

  return NextResponse.json({ status: 'pending' })
}
