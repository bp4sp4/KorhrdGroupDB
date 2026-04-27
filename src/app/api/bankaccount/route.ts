import { NextRequest, NextResponse } from 'next/server'
import { requireManagementAccess } from '@/lib/auth/managementAccess'
import { easyFinBankService, CORP_NUM } from '@/lib/popbill'

function callPopbill<T>(fn: (resolve: (v: T) => void, reject: (e: { message: string }) => void) => void): Promise<NextResponse> {
  return new Promise((res) => {
    fn(
      (data) => res(NextResponse.json({ data })),
      (err) => res(NextResponse.json({ error: err.message }, { status: 500 })),
    )
  })
}

export async function GET(request: NextRequest) {
  const access = await requireManagementAccess('bankaccount')
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  if (action === 'list') {
    return callPopbill((ok, err) => easyFinBankService.listBankAccount(CORP_NUM, ok, err))
  }

  if (action === 'mgturl') {
    return callPopbill((ok, err) => easyFinBankService.getBankAccountMgtURL(CORP_NUM, '', ok, err))
  }

  if (action === 'jobstate') {
    const jobID = searchParams.get('jobID') ?? ''
    return callPopbill((ok, err) => easyFinBankService.getJobState(CORP_NUM, jobID, '', ok, err))
  }

  if (action === 'search') {
    const jobID = searchParams.get('jobID') ?? ''
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const perPage = parseInt(searchParams.get('perPage') ?? '20', 10)
    return callPopbill((ok, err) =>
      easyFinBankService.search(CORP_NUM, jobID, '', '', page, perPage, 'D', '', ok, err)
    )
  }

  if (action === 'listActiveJob') {
    return callPopbill((ok, err) => easyFinBankService.listActiveJob(CORP_NUM, '', ok, err))
  }

  return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const access = await requireManagementAccess('bankaccount')
  if (!access.ok) return access.response

  const body = await request.json()
  const { action, bankCode, accountNumber, startDate, endDate } = body

  if (action === 'requestJob') {
    const maskedAccount = accountNumber
      ? `${String(accountNumber).slice(0, 4)}****${String(accountNumber).slice(-4)}`
      : null
    console.log('[requestJob]', { bankCode, accountNumber: maskedAccount, startDate, endDate })
    return callPopbill((ok, err) =>
      easyFinBankService.requestJob(CORP_NUM, bankCode, accountNumber, startDate, endDate, '', ok, err)
    )
  }

  return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
}
