import { NextRequest, NextResponse } from 'next/server'
import { requireManagementAccess } from '@/lib/auth/managementAccess'
import { fetchTransactions, SHINHAN_TEST_ACCOUNT } from '@/lib/shinhan'

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? '0.0.0.0'
}

// GET: 등록 계좌 목록 (신한 단일 테스트계좌)
export async function GET(request: NextRequest) {
  const access = await requireManagementAccess('bankaccount')
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'list') {
    return NextResponse.json({
      data: [
        {
          bankCode: '088',
          accountNumber: SHINHAN_TEST_ACCOUNT,
          accountName: '신한은행 테스트계좌',
          accountType: '입출금',
          state: 1,
          closeRequestYN: false,
          useRestrictYN: false,
        },
      ],
    })
  }

  return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
}

// POST: 거래내역 조회
export async function POST(request: NextRequest) {
  const access = await requireManagementAccess('bankaccount')
  if (!access.ok) return access.response

  const body = await request.json()
  const { action, accountNumber, startDate, endDate } = body

  if (action === 'requestJob' || action === 'search') {
    if (!accountNumber || !startDate || !endDate) {
      return NextResponse.json({ error: '계좌번호와 조회기간을 입력하세요.' }, { status: 400 })
    }

    try {
      const result = await fetchTransactions({
        accountNumber,
        startDate,
        endDate,
        clientIp: getClientIp(request),
      })

      const list = (result.거래내역 ?? []).map((tx, idx) => ({
        tid: `${tx.거래일자}-${tx.거래시간}-${idx}`,
        trdate: (tx.거래일자 || '').replace(/-/g, ''),
        trdt: `${(tx.거래일자 || '').replace(/-/g, '')}${tx.거래시간 || ''}`,
        accIn: tx.입금금액 || '0',
        accOut: tx.출금금액 || '0',
        balance: tx.잔액 || '0',
        remark1: tx.거래메모 || '',
        remark2: tx.거래점명 || '',
        remark3: '',
        memo: '',
      }))

      return NextResponse.json({
        data: {
          list,
          total: list.length,
          pageNum: 1,
          perPage: list.length,
          accountInfo: {
            계좌번호: result.계좌번호,
            상품부기명: result.상품부기명,
            계좌잔액: result.계좌잔액,
            고객명: result.고객명,
          },
        },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '거래내역 조회 실패'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
}
