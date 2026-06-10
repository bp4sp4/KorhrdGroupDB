import { NextRequest, NextResponse } from 'next/server'
import { requireManagementAccess } from '@/lib/auth/managementAccess'
import { fetchTransactions, SHINHAN_REGISTERED_ACCOUNTS } from '@/lib/shinhan'
import { matchFixedCost } from '@/lib/fixed-cost-matcher'

// GET /api/management/reports/fixed-costs?year=YYYY&month=MM
// 신한 거래내역 (전체 계좌) → 고정비 매칭 결과 반환
export async function GET(request: NextRequest) {
  const access = await requireManagementAccess('reports')
  if (!access.ok) return access.response

  const sp = request.nextUrl.searchParams
  const year = parseInt(sp.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(sp.get('month') ?? String(new Date().getMonth() + 1))
  const accountFilter = sp.get('account') // 특정 계좌만 조회

  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const startDate = `${year}${pad(month)}01`
  const endDate = `${year}${pad(month)}${pad(lastDay)}`

  const targetAccounts = accountFilter ? [accountFilter] : SHINHAN_REGISTERED_ACCOUNTS

  type MatchedItem = {
    date: string
    time: string
    amount: number
    remarks: string
    account: string
    fixedCost: { description: string; amount: number; note: string; company: string }
  }
  const matched: MatchedItem[] = []
  let total = 0
  let totalTransactions = 0
  const byAccount: Record<string, { count: number; total: number }> = {}
  const errors: { account: string; error: string }[] = []

  // 모든 계좌 병렬 조회
  const results = await Promise.allSettled(
    targetAccounts.map((acc) =>
      fetchTransactions({ accountNumber: acc, startDate, endDate }).then((data) => ({ account: acc, data }))
    )
  )

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const account = targetAccounts[i]
    if (r.status === 'rejected') {
      errors.push({ account, error: r.reason instanceof Error ? r.reason.message : String(r.reason) })
      continue
    }
    const transactions = r.value.data.거래내역 ?? []
    totalTransactions += transactions.length
    let acctTotal = 0
    let acctCount = 0
    for (const tx of transactions) {
      const trdate = (tx.거래일자 || '').replace(/-/g, '')
      const fc = matchFixedCost({
        trdate,
        accOut: tx.출금금액 || '0',
        remark1: tx.거래메모 || '',
        remark2: tx.거래점명 || '',
      })
      if (!fc) continue
      const amount = parseInt(tx.출금금액 || '0')
      total += amount
      acctTotal += amount
      acctCount += 1
      matched.push({
        date: trdate,
        time: tx.거래시간 || '',
        amount,
        remarks: [tx.거래메모, tx.거래점명].filter(Boolean).join(' '),
        account,
        fixedCost: {
          description: fc.description,
          amount: fc.amount,
          note: fc.note,
          company: fc.company,
        },
      })
    }
    byAccount[account] = { count: acctCount, total: acctTotal }
  }

  // 날짜순 정렬
  matched.sort((a, b) => a.date.localeCompare(b.date))

  // 카테고리별 집계
  const byCategoryMap: Record<string, { count: number; total: number }> = {}
  for (const m of matched) {
    const key = m.fixedCost.description
    if (!byCategoryMap[key]) byCategoryMap[key] = { count: 0, total: 0 }
    byCategoryMap[key].count += 1
    byCategoryMap[key].total += m.amount
  }
  const categories = Object.entries(byCategoryMap)
    .map(([description, v]) => ({ description, count: v.count, total: v.total }))
    .sort((a, b) => b.total - a.total)

  // 계좌별 정리
  const accountSummary = Object.entries(byAccount).map(([account, v]) => ({
    account,
    count: v.count,
    total: v.total,
  }))

  return NextResponse.json({
    month: `${year}-${pad(month)}`,
    total,
    count: matched.length,
    items: matched,
    categories,
    accountSummary,
    totalTransactions,
    errors,
  })
}
