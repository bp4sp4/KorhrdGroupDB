import express from 'express'
import crypto from 'crypto'

const app = express()
app.use(express.json({ limit: '1mb' }))

const PORT = Number(process.env.PORT ?? 8080)
const APP_KEY = process.env.SHINHAN_APP_KEY ?? ''
const APP_SECRET = process.env.SHINHAN_APP_SECRET ?? ''
const SUB_CHANNEL = process.env.SHINHAN_SUB_CHANNEL ?? 'P6'
const PROXY_SECRET = process.env.PROXY_SECRET ?? ''
const IS_PROD = process.env.SHINHAN_ENV === 'prod'

const BASE_URL = IS_PROD
  ? 'https://shbapi.shinhan.com:6443'
  : 'https://dev-shbapi.shinhan.com:6443'

const TOKEN_URL = `${BASE_URL}/v1/oauth/partner/token`
const TX_URL = `${BASE_URL}/v2/firm/search/transactions`

if (!APP_KEY || !APP_SECRET) {
  console.error('[shinhan-proxy] SHINHAN_APP_KEY / SHINHAN_APP_SECRET missing')
  process.exit(1)
}
if (!PROXY_SECRET) {
  console.error('[shinhan-proxy] PROXY_SECRET missing — Vercel과 공유할 인증 토큰을 설정하세요')
  process.exit(1)
}

let cachedToken = null

function hmacBase64(secret, data) {
  return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('base64')
}

async function getAccessToken() {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt - 30_000 > now) return cachedToken.token

  const timestamp = Math.floor(now / 1000)
  const clientHash = hmacBase64(APP_SECRET, `${timestamp}|${APP_KEY}`)

  const body = new URLSearchParams({
    client_id: APP_KEY,
    scope: 'oob',
    grant_type: 'client_credentials',
    client_hash: clientHash,
    timestamp: String(timestamp),
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: body.toString(),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.dataHeader?.successCode === '1') {
    const msg = json?.dataHeader?.resultMessage ?? `HTTP ${res.status}`
    throw new Error(`access_token 발급 실패: ${msg}`)
  }

  const token = json?.dataBody?.access_token
  const expiresIn = Number(json?.dataBody?.expires_in ?? 600)
  if (!token) throw new Error('access_token 없음')

  cachedToken = { token, expiresAt: now + expiresIn * 1000 }
  return token
}

// 인증 미들웨어 (Vercel과 공유한 비밀키로 인증)
app.use((req, res, next) => {
  if (req.path === '/health') return next()
  const auth = req.headers['x-proxy-secret']
  if (auth !== PROXY_SECRET) {
    return res.status(401).json({ error: 'Unauthorized proxy access' })
  }
  next()
})

// 헬스체크
app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() })
})

// 거래내역 조회
app.post('/shinhan/transactions', async (req, res) => {
  const { accountNumber, startDate, endDate, clientIp } = req.body ?? {}
  if (!accountNumber || !startDate || !endDate) {
    return res.status(400).json({ error: '계좌번호/조회기간 누락' })
  }

  try {
    const token = await getAccessToken()
    const reqKey = crypto.randomUUID().replace(/-/g, '').slice(0, 30)

    const bodyObj = {
      dataHeader: { subChannel: SUB_CHANNEL },
      dataBody: { 계좌번호: accountNumber, 조회시작일: startDate, 조회종료일: endDate },
    }
    const bodyStr = JSON.stringify(bodyObj)
    const hsKey = hmacBase64(APP_SECRET, bodyStr)

    const r = await fetch(TX_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        Accept: 'application/json; charset=UTF-8',
        reqKey,
        apiKey: APP_KEY,
        Authorization: `Bearer ${token}`,
        hsKey,
        clientIp: clientIp ?? '0.0.0.0',
      },
      body: bodyStr,
    })

    const json = await r.json().catch(() => ({}))

    if (!r.ok || json?.dataHeader?.successCode === '1') {
      if (String(json?.dataHeader?.resultCode) === '89') cachedToken = null
      const msg = json?.dataHeader?.resultMessage ?? `HTTP ${r.status}`
      return res.status(502).json({ error: `거래내역 조회 실패: ${msg}` })
    }

    res.json({ data: json?.dataBody ?? {} })
  } catch (e) {
    console.error('[shinhan-proxy] error:', e)
    res.status(500).json({ error: e instanceof Error ? e.message : '프록시 내부 오류' })
  }
})

app.listen(PORT, () => {
  console.log(`[shinhan-proxy] listening on :${PORT} (env: ${IS_PROD ? 'prod' : 'dev'})`)
})
