// 신한은행 오픈API 클라이언트
// 신한은 IP 화이트리스트 제한이 있어, Vercel(동적 IP) 환경에서는 고정 IP 프록시 서버를 경유한다.
// 프록시 서버: github.com/<...>/shinhan-proxy (Ubuntu 114.207.245.105 운영)

const PROXY_URL = process.env.SHINHAN_PROXY_URL ?? ''
const PROXY_SECRET = process.env.SHINHAN_PROXY_SECRET ?? ''

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

// 거래내역 조회 — 신한 API를 직접 호출하지 않고 프록시 서버를 경유
export async function fetchTransactions(params: {
  accountNumber: string
  startDate: string // YYYYMMDD
  endDate: string // YYYYMMDD
  clientIp?: string
}): Promise<ShinhanTransactionResult> {
  if (!PROXY_URL || !PROXY_SECRET) {
    throw new Error('SHINHAN_PROXY_URL / SHINHAN_PROXY_SECRET 환경변수가 설정되지 않았습니다.')
  }

  const res = await fetch(`${PROXY_URL.replace(/\/$/, '')}/shinhan/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-proxy-secret': PROXY_SECRET,
    },
    body: JSON.stringify(params),
  })

  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    const msg = json?.error || `HTTP ${res.status}`
    throw new Error(`신한 프록시 호출 실패: ${msg}`)
  }

  return json.data as ShinhanTransactionResult
}

export const SHINHAN_TEST_ACCOUNT = process.env.SHINHAN_TEST_ACCOUNT ?? '140015029000'
