import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { sendSms, parsePhones } from '@/lib/kakao'

/**
 * SMS 테스트 엔드포인트
 * GET /api/test-sms?to=01012345678
 * GET /api/test-sms (to 생략 시 ALIGO_NEW_INQUIRY_PHONES 사용)
 */
export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const to = searchParams.get('to')
  const receivers = to ? [to] : parsePhones(process.env.ALIGO_NEW_INQUIRY_PHONES)

  const envCheck = {
    ALIGO_API_KEY: !!process.env.ALIGO_API_KEY,
    ALIGO_USER_ID: !!process.env.ALIGO_USER_ID,
    ALIGO_SENDER: process.env.ALIGO_SENDER || null,
    ALIGO_NEW_INQUIRY_PHONES: process.env.ALIGO_NEW_INQUIRY_PHONES || null,
    receivers_to_use: receivers,
  }

  if (receivers.length === 0) {
    return NextResponse.json({ ok: false, envCheck, error: '수신자 없음 (to 쿼리 또는 ALIGO_NEW_INQUIRY_PHONES 설정)' }, { status: 400 })
  }

  const result = await sendSms({
    receivers,
    title: '알리고 SMS 테스트',
    message: `[테스트] 학점은행제 알림 SMS 연동 확인 (${new Date().toLocaleString('ko-KR')})`,
  })

  return NextResponse.json({ ok: result.success, envCheck, result })
}
