import crypto from 'crypto'

// 신한은행 오픈API (2-legged) 클라이언트
// 가이드: 17.계좌거래내역조회_신한은행 오픈API 연동 가이드(2-legged) v1.5.1

const APP_KEY = process.env.SHINHAN_APP_KEY ?? ''
const APP_SECRET = process.env.SHINHAN_APP_SECRET ?? ''
const SUB_CHANNEL = process.env.SHINHAN_SUB_CHANNEL ?? 'P6'
const IS_PROD = process.env.SHINHAN_ENV === 'prod'

const BASE_URL = IS_PROD
  ? 'https://shbapi.shinhan.com:6443'
  : 'https://dev-shbapi.shinhan.com:6443'

const TOKEN_URL = `${BASE_URL}/v1/oauth/partner/token`
const TX_URL = `${BASE_URL}/v2/firm/search/transactions`

// access_token 캐시 (서버 메모리)
let cachedToken: { token: string; expiresAt: number } | null = null

function hmacSha256Base64(secret: string, data: string): string {
  return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('base64')
}

async function fetchAccessToken(): Promise<string> {
  if (!APP_KEY || !APP_SECRET) {
    throw new Error('SHINHAN_APP_KEY / SHINHAN_APP_SECRET 환경변수가 설정되지 않았습니다.')
  }

  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt - 30_000 > now) {
    return cachedToken.token
  }

  const timestamp = Math.floor(now / 1000)
  const clientHash = hmacSha256Base64(APP_SECRET, `${timestamp}|${APP_KEY}`)

  const body = new URLSearchParams({
    client_id: APP_KEY,
    scope: 'oob',
    grant_type: 'client_credentials',
    client_hash: clientHash,
    timestamp: String(timestamp),
  })

  let res: Response
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
    })
  } catch (e) {
    const cause = (e as { cause?: { code?: string; message?: string } })?.cause
    const detail = cause?.code || cause?.message || (e as Error).message
    console.error('[shinhan token] fetch failed:', e)
    throw new Error(`신한 API 연결 실패 (${detail}). IP 화이트리스트 등록 또는 방화벽/포트 6443을 확인하세요.`)
  }

  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    const msg = json?.dataHeader?.resultMessage || `HTTP ${res.status}`
    console.error('[shinhan token] HTTP error:', res.status, json)
    throw new Error(`접근키 발급 실패: ${msg}`)
  }

  const dh = json?.dataHeader
  if (dh && dh.successCode === '1') {
    throw new Error(`접근키 발급 실패: ${dh.resultMessage ?? dh.resultCode ?? 'unknown'}`)
  }

  const accessToken = json?.dataBody?.access_token
  const expiresIn = Number(json?.dataBody?.expires_in ?? 600)

  if (!accessToken) {
    throw new Error('접근키 발급 응답에 access_token이 없습니다.')
  }

  cachedToken = { token: accessToken, expiresAt: now + expiresIn * 1000 }
  return accessToken
}

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

// 거래내역 조회 (개발/테스트 서버, /v2/firm/search/transactions)
export async function fetchTransactions(params: {
  accountNumber: string
  startDate: string // YYYYMMDD
  endDate: string // YYYYMMDD
  clientIp?: string
}): Promise<ShinhanTransactionResult> {
  const accessToken = await fetchAccessToken()

  const reqKey = crypto.randomUUID().replace(/-/g, '').slice(0, 30)

  const bodyObj = {
    dataHeader: { subChannel: SUB_CHANNEL },
    dataBody: {
      계좌번호: params.accountNumber,
      조회시작일: params.startDate,
      조회종료일: params.endDate,
    },
  }
  const bodyStr = JSON.stringify(bodyObj)
  const hsKey = hmacSha256Base64(APP_SECRET, bodyStr)

  const res = await fetch(TX_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      Accept: 'application/json; charset=UTF-8',
      reqKey,
      apiKey: APP_KEY,
      Authorization: `Bearer ${accessToken}`,
      hsKey,
      clientIp: params.clientIp ?? '0.0.0.0',
    },
    body: bodyStr,
  })

  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    const msg = json?.dataHeader?.resultMessage || `HTTP ${res.status}`
    throw new Error(`거래내역 조회 실패: ${msg}`)
  }

  const dh = json?.dataHeader
  if (dh && dh.successCode === '1') {
    // access token 만료 시 캐시 클리어 후 1회 재시도
    if (String(dh.resultCode) === '89') {
      cachedToken = null
    }
    throw new Error(`거래내역 조회 실패: ${dh.resultMessage ?? dh.resultCode ?? 'unknown'}`)
  }

  return json?.dataBody as ShinhanTransactionResult
}

export const SHINHAN_TEST_ACCOUNT = process.env.SHINHAN_TEST_ACCOUNT ?? '140015029000'
