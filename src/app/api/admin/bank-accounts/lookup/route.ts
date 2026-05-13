import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAuth'
import { fetchTransactions } from '@/lib/shinhan'

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? '0.0.0.0'
}

function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${dd}`
}

// POST: 신한 API로 계좌 소유자/상품명 조회 (1일치 거래내역에서 추출)
export async function POST(request: NextRequest) {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const body = await request.json().catch(() => ({}))
  const accountNumber = String(body?.accountNumber ?? '').replace(/[^\d]/g, '')

  if (!accountNumber) {
    return NextResponse.json({ error: '계좌번호를 입력하세요.' }, { status: 400 })
  }

  const today = new Date()
  const endDate = toYmd(today)
  const startDate = toYmd(new Date(today.getTime() - 24 * 60 * 60 * 1000))

  try {
    const result = await fetchTransactions({
      accountNumber,
      startDate,
      endDate,
      clientIp: getClientIp(request),
    })

    return NextResponse.json({
      account_number: result.계좌번호 || accountNumber,
      account_holder: result.고객명 ?? null,
      product_name: result.상품부기명 ?? null,
      balance: result.계좌잔액 ?? null,
      bank_name: '신한',
      bank_code: '088',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '신한 API 조회 실패'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
