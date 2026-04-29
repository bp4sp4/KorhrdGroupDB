import { NextRequest, NextResponse } from 'next/server'
import { sendAlimtalk, parsePhones, ALIMTALK_TEMPLATES } from '@/lib/kakao'

// Supabase Database Webhook: hakjeom_consultations INSERT 시 호출
export async function POST(request: NextRequest) {
  // Webhook 시크릿 검증
  const secret = request.headers.get('x-webhook-secret')
  if (secret !== process.env.SUPABASE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Supabase webhook payload: { type, table, record, ... }
  const record = body.record as { name?: string; contact?: string } | undefined
  const name = record?.name ?? '고객'

  const receivers = parsePhones(process.env.ALIGO_NEW_INQUIRY_PHONES)
  if (receivers.length === 0) {
    return NextResponse.json({ message: 'no receivers' })
  }

  await sendAlimtalk({
    receivers,
    tplCode: ALIMTALK_TEMPLATES.NEW_INQUIRY.tplCode,
    message: ALIMTALK_TEMPLATES.NEW_INQUIRY.message,
    vars: { 고객명: name },
  })

  console.log('[NOTIFY] 관리자 알림톡 전송 완료:', name)
  return NextResponse.json({ message: 'ok' })
}
