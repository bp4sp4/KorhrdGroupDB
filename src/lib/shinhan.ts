// 신한은행 오픈API 클라이언트 (2-legged OAuth, 운영)
// Shinhan API는 IP 화이트리스트 제한이 있어 Vercel 환경에서는
// 고정 IP 프록시 서버(114.207.245.105:8080)를 경유한다.
// 프록시는 credentials를 받아 Shinhan API를 직접 호출한다.

import crypto from 'crypto'

const CLIENT_ID = process.env.SHINHAN_APP_KEY ?? ''
const CLIENT_SECRET = process.env.SHINHAN_APP_SECRET ?? ''
const SUB_CHANNEL = process.env.SHINHAN_SUB_CHANNEL ?? 'P6'

const RAW_PROXY_URL = process.env.SHINHAN_PROXY_URL ?? process.env.PROXY_URL ?? ''
// scheme 누락된 값(예: "1.2.3.4:3001")도 허용 — http:// 자동 부여
const PROXY_URL = RAW_PROXY_URL && !/^https?:\/\//i.test(RAW_PROXY_URL)
  ? `http://${RAW_PROXY_URL}`
  : RAW_PROXY_URL
const PROXY_SECRET = process.env.SHINHAN_PROXY_SECRET ?? process.env.PROXY_SECRET ?? ''

// 운영 서버 — 개발 서버는 dev-shbapi.shinhan.com:6443
const SHINHAN_BASE_URL = 'https://shbapi.shinhan.com:6443'

export interface ShinhanTransaction {
  거래일자: string
  거래시간: string
  출금금액: string
  입금금액: string
  거래메모: string
  잔액: string
  입지구분: string // "1": 입금, "2": 출금
  거래점명: string
}

export interface ShinhanTransactionResult {
  계좌번호: string
  조회시작일: string
  조회종료일: string
  상품부기명?: string
  계좌잔액?: string
  고객명?: string
  거래내역반복횟수?: string
  거래내역: ShinhanTransaction[]
}

// 인메모리 토큰 캐시 (프록시 미사용 시)
let _cachedToken: { value: string; expiresAt: number } | null = null

// HMAC-SHA256 + Base64 헬퍼
function hmacSha256Base64(secret: string, message: string): string {
  return crypto.createHmac('sha256', secret).update(message, 'utf8').digest('base64').replace(/[\r\n]/g, '')
}

// 접근키(access token) 발급
async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (_cachedToken && _cachedToken.expiresAt > now + 60) return _cachedToken.value

  const timestamp = now
  // client_hash: HMAC-SHA256("timestamp|client_id", client_secret) → Base64
  // URL 인코딩은 URLSearchParams.toString()이 자동 처리하므로 중복 인코딩 금지
  const clientHash = hmacSha256Base64(CLIENT_SECRET, `${timestamp}|${CLIENT_ID}`)

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: 'oob',
    grant_type: 'client_credentials',
    timestamp: String(timestamp),
    client_hash: clientHash,
  })

  const res = await fetch(`${SHINHAN_BASE_URL}/v1/oauth/partner/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: body.toString(),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.dataHeader?.successCode === '1') {
    throw new Error(`신한 토큰 발급 실패: ${json.dataHeader?.resultMessage ?? res.status}`)
  }

  const token: string = json.dataBody.access_token
  const expiresIn: number = json.dataBody.expires_in ?? 600
  _cachedToken = { value: token, expiresAt: now + expiresIn }
  return token
}

// 거래내역 직접 호출 (IP 화이트리스트 환경)
async function fetchTransactionsDirect(params: {
  accountNumber: string
  startDate: string
  endDate: string
  clientIp: string
}): Promise<ShinhanTransactionResult> {
  const accessToken = await getAccessToken()

  const reqBody = {
    dataHeader: { subChannel: SUB_CHANNEL },
    dataBody: {
      계좌번호: params.accountNumber,
      조회시작일: params.startDate,
      조회종료일: params.endDate,
    },
  }
  const bodyStr = JSON.stringify(reqBody)
  // hsKey: HMAC-SHA256(body, client_secret) → Base64
  const hsKey = hmacSha256Base64(CLIENT_SECRET, bodyStr)
  const reqKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const res = await fetch(`${SHINHAN_BASE_URL}/v2/firm/search/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      Accept: 'application/json; charset=UTF-8',
      Authorization: `Bearer ${accessToken}`,
      apiKey: CLIENT_ID,
      hsKey,
      reqKey,
      clientIp: params.clientIp,
    },
    body: bodyStr,
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.dataHeader?.successCode === '1') {
    if (json.dataHeader?.resultCode === '89') {
      _cachedToken = null
      throw new Error('접근키가 만료되었습니다. 다시 시도해주세요.')
    }
    throw new Error(`거래내역 조회 실패: ${json.dataHeader?.resultMessage ?? res.status}`)
  }

  return json.dataBody as ShinhanTransactionResult
}

// 거래내역 조회 — 프록시 서버 경유 (Vercel 배포 환경)
// 프록시는 credentials를 받아 신한 API를 직접 호출 후 결과 반환
async function fetchTransactionsViaProxy(params: {
  accountNumber: string
  startDate: string
  endDate: string
  clientIp: string
}): Promise<ShinhanTransactionResult> {
  const res = await fetch(`${PROXY_URL.replace(/\/$/, '')}/shinhan/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-proxy-secret': PROXY_SECRET,
    },
    body: JSON.stringify({
      accountNumber: params.accountNumber,
      startDate: params.startDate,
      endDate: params.endDate,
      clientIp: params.clientIp,
      // 신한 API 인증 정보를 프록시에 전달
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      subChannel: SUB_CHANNEL,
      baseUrl: SHINHAN_BASE_URL,
    }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`신한 프록시 호출 실패: ${json?.error ?? `HTTP ${res.status}`}`)
  }

  return json.data as ShinhanTransactionResult
}

// 공개 진입점 — 프록시 설정 여부에 따라 자동 분기
export async function fetchTransactions(params: {
  accountNumber: string
  startDate: string
  endDate: string
  clientIp?: string
}): Promise<ShinhanTransactionResult> {
  const ip = params.clientIp ?? '0.0.0.0'

  // 프록시 설정 시 — Vercel 등 동적 IP 환경 (Shinhan 자격증명은 프록시 서버에 있음)
  if (PROXY_URL && PROXY_SECRET) {
    return fetchTransactionsViaProxy({ ...params, clientIp: ip })
  }

  // 직접 호출 — 로컬 개발 등 IP 화이트리스트 환경
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('SHINHAN_APP_KEY / SHINHAN_APP_SECRET 환경변수가 설정되지 않았습니다.')
  }
  return fetchTransactionsDirect({ ...params, clientIp: ip })
}

// 신한 API 자격증명에 등록된 자사 계좌 목록 — 쉼표 구분 환경변수 (예: "111,222,333")
// 계좌번호는 코드/저장소에 두지 않는다.
export const SHINHAN_REGISTERED_ACCOUNTS: string[] = (process.env.SHINHAN_ACCOUNTS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
