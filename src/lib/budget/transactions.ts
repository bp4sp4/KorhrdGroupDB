import { fetchTransactions } from '@/lib/shinhan'

export type TxType = 'in' | 'out'

/** 신한 실시간 거래 + 분류저장(머지 전) 통합 행 */
export interface UnifiedTx {
  tx_key: string
  account_number: string
  tx_date: string // YYYY-MM-DD
  tx_time: string // HH:mm:ss
  tx_type: TxType
  amount: number
  balance: number
  summary: string // 적요 (거래메모 + 거래점명)
}

const onlyDigits = (s: string) => (s || '').replace(/[^\d]/g, '')

function fmtDate(ymd: string): string {
  const d = onlyDigits(ymd)
  if (d.length !== 8) return ymd
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

function fmtTime(t: string): string {
  const d = onlyDigits(t)
  if (d.length !== 6) return ''
  return `${d.slice(0, 2)}:${d.slice(2, 4)}:${d.slice(4, 6)}`
}

/** 'YYYY-MM' → { start:'YYYYMMDD', end:'YYYYMMDD'(말일) } */
export function monthRange(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split('-').map(Number)
  const start = `${y}${String(m).padStart(2, '0')}01`
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${y}${String(m).padStart(2, '0')}${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

/** 거래 1건 → 안정적 tx_key */
export function buildTxKey(args: {
  accountNumber: string
  date: string // YYYYMMDD
  time: string // HHmmss
  type: TxType
  amount: number
}): string {
  return [
    onlyDigits(args.accountNumber),
    onlyDigits(args.date),
    onlyDigits(args.time),
    args.type,
    args.amount,
  ].join('|')
}

/**
 * 여러 계좌의 한 달 거래를 신한에서 실시간 조회 후 통합.
 * 한 계좌 실패는 건너뛴다(전체 실패시 빈 배열).
 */
export async function fetchUnifiedTransactions(args: {
  accountNumbers: string[]
  yearMonth: string
  clientIp: string
}): Promise<UnifiedTx[]> {
  const { start, end } = monthRange(args.yearMonth)
  const accounts = Array.from(new Set(args.accountNumbers.map(onlyDigits).filter(Boolean)))

  const results = await Promise.allSettled(
    accounts.map((accountNumber) =>
      fetchTransactions({ accountNumber, startDate: start, endDate: end, clientIp: args.clientIp })
        .then((r) => ({ accountNumber, result: r })),
    ),
  )

  const out: UnifiedTx[] = []
  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    const { accountNumber, result } = r.value
    for (const tx of result.거래내역 ?? []) {
      const inAmt = Number(onlyDigits(tx.입금금액)) || 0
      const outAmt = Number(onlyDigits(tx.출금금액)) || 0
      const type: TxType = inAmt > 0 ? 'in' : 'out'
      const amount = type === 'in' ? inAmt : outAmt
      if (amount <= 0) continue
      const date = onlyDigits(tx.거래일자)
      const time = onlyDigits(tx.거래시간)
      out.push({
        tx_key: buildTxKey({ accountNumber, date, time, type, amount }),
        account_number: accountNumber,
        tx_date: fmtDate(date),
        tx_time: fmtTime(time),
        tx_type: type,
        amount,
        balance: Number(onlyDigits(tx.잔액)) || 0,
        summary: [tx.거래메모, tx.거래점명].filter(Boolean).join(' ').trim(),
      })
    }
  }

  // 최신순 정렬
  out.sort((a, b) => (a.tx_date + a.tx_time < b.tx_date + b.tx_time ? 1 : -1))
  return out
}
