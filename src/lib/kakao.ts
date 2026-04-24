interface AlimtalkParams {
  /** 수신자 전화번호 (여러 명 가능, - 포함/미포함 무관) */
  receivers: string | string[]
  /** 템플릿 본문 override (미지정 시 ALIGO_TEMPLATE_MESSAGE 사용) */
  message?: string
  /** 제목 override (미지정 시 ALIGO_TEMPLATE_SUBJECT 사용) */
  subject?: string
}

interface AligoResult {
  code: number
  message: string
  info?: unknown
}

/**
 * 알리고 카카오 알림톡 전송
 * - 여러 수신자는 receiver_1, receiver_2 ... 로 전송 (최대 500명)
 * - PROXY_URL 설정 시 고정 IP 프록시 경유, 아니면 알리고 직접 호출
 */
export async function sendAlimtalk({
  receivers,
  message,
  subject,
}: AlimtalkParams): Promise<{ success: boolean; error?: string }> {
  const apikey = process.env.ALIGO_API_KEY
  const userid = process.env.ALIGO_USER_ID
  const senderkey = process.env.ALIGO_SENDER_KEY
  const sender = process.env.ALIGO_SENDER
  const tpl_code = process.env.ALIGO_TEMPLATE_CODE
  const templateMessage = message ?? process.env.ALIGO_TEMPLATE_MESSAGE
  const templateSubject = subject ?? process.env.ALIGO_TEMPLATE_SUBJECT ?? '알림'

  if (!apikey || !userid || !senderkey || !sender || !tpl_code) {
    console.warn('[KAKAO] 알리고 환경 변수 미설정 — 전송 스킵')
    return { success: false, error: 'Aligo env missing' }
  }
  if (!templateMessage) {
    return { success: false, error: 'message empty' }
  }

  const list = (Array.isArray(receivers) ? receivers : [receivers])
    .map((r) => r.replace(/-/g, '').trim())
    .filter((r) => r.length >= 10)

  if (list.length === 0) {
    console.warn('[KAKAO] 수신자 없음 — 전송 스킵')
    return { success: false, error: 'no receivers' }
  }

  const proxyUrl = process.env.PROXY_URL
  const proxySecret = process.env.PROXY_SECRET

  const basePayload: Record<string, string> = {
    apikey, userid, senderkey, tpl_code, sender, failover: 'N',
  }
  list.forEach((phone, i) => {
    basePayload[`receiver_${i + 1}`] = phone
    basePayload[`subject_${i + 1}`] = templateSubject
    basePayload[`message_${i + 1}`] = templateMessage
  })

  try {
    let result: AligoResult
    if (proxyUrl && proxySecret) {
      const res = await fetch(`${proxyUrl}/alimtalk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-proxy-secret': proxySecret },
        body: JSON.stringify(basePayload),
      })
      result = (await res.json()) as AligoResult
    } else {
      const formData = new FormData()
      Object.entries(basePayload).forEach(([k, v]) => formData.append(k, v))
      const res = await fetch('https://kakaoapi.aligo.in/akv10/alimtalk/send/', {
        method: 'POST',
        body: formData,
      })
      result = (await res.json()) as AligoResult
    }

    if (result.code === 0) {
      console.log(`[KAKAO] ✅ 알림톡 전송 성공 (${list.length}명):`, result.message)
      return { success: true }
    }
    console.error('[KAKAO] ❌ 알림톡 전송 실패:', result.code, result.message)
    return { success: false, error: `${result.code}: ${result.message}` }
  } catch (e) {
    console.error('[KAKAO] ❌ 알림톡 전송 오류:', e)
    return { success: false, error: e instanceof Error ? e.message : 'unknown' }
  }
}

/** 콤마 구분 env → 배열 (공백/빈값 제거) */
export function parsePhones(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

interface SmsParams {
  receivers: string | string[]
  message: string
  /** 90byte 초과 시 자동 LMS 전환 (기본 SMS) */
  msg_type?: 'SMS' | 'LMS'
  title?: string
}

/**
 * 알리고 SMS/LMS 전송 (알림톡 템플릿 승인 전 임시 사용)
 * https://smartsms.aligo.in/admin/api/info.html
 */
export async function sendSms({
  receivers,
  message,
  msg_type,
  title,
}: SmsParams): Promise<{ success: boolean; error?: string }> {
  const key = process.env.ALIGO_API_KEY
  const user_id = process.env.ALIGO_USER_ID
  const sender = process.env.ALIGO_SENDER

  if (!key || !user_id || !sender) {
    console.warn('[SMS] 알리고 환경 변수 미설정 — 전송 스킵')
    return { success: false, error: 'Aligo env missing' }
  }

  const list = (Array.isArray(receivers) ? receivers : [receivers])
    .map((r) => r.replace(/-/g, '').trim())
    .filter((r) => r.length >= 10)

  if (list.length === 0) {
    console.warn('[SMS] 수신자 없음 — 전송 스킵')
    return { success: false, error: 'no receivers' }
  }

  // 90byte 이상이면 LMS 자동 전환
  const byteLength = new TextEncoder().encode(message).length
  const type = msg_type ?? (byteLength > 90 ? 'LMS' : 'SMS')

  const senderClean = sender.replace(/-/g, '')
  const proxyUrl = process.env.PROXY_URL
  const proxySecret = process.env.PROXY_SECRET
  console.log('[SMS] 전송 시도:', { sender: senderClean, type, receivers: list, byteLength, viaProxy: !!(proxyUrl && proxySecret) })

  const payload: Record<string, string> = {
    key,
    user_id,
    sender: senderClean,
    receiver: list.join(','),
    msg: message,
    msg_type: type,
  }
  if (title && type === 'LMS') payload.title = title

  try {
    let raw: string
    if (proxyUrl && proxySecret) {
      const res = await fetch(`${proxyUrl}/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-proxy-secret': proxySecret },
        body: JSON.stringify(payload),
      })
      raw = await res.text()
    } else {
      const formData = new FormData()
      Object.entries(payload).forEach(([k, v]) => formData.append(k, v))
      const res = await fetch('https://apis.aligo.in/send/', {
        method: 'POST',
        body: formData,
      })
      raw = await res.text()
    }
    let result: { result_code: number | string; message: string }
    try {
      result = JSON.parse(raw)
    } catch {
      console.error('[SMS] ❌ 알리고 응답 JSON 파싱 실패:', raw)
      return { success: false, error: `invalid response: ${raw.slice(0, 200)}` }
    }
    const code = Number(result.result_code)

    if (code === 1) {
      console.log(`[SMS] ✅ ${type} 전송 성공 (${list.length}명):`, result.message)
      return { success: true }
    }
    console.error('[SMS] ❌ 전송 실패:', code, result.message, raw)
    return { success: false, error: `${code}: ${result.message}` }
  } catch (e) {
    console.error('[SMS] ❌ 전송 오류:', e)
    return { success: false, error: e instanceof Error ? e.message : 'unknown' }
  }
}
