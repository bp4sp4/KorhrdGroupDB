'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styles from './styles.module.css'

const BANK_NAMES: Record<string, string> = {
  '004': 'KB국민', '011': '농협', '020': '우리', '023': 'SC제일', '031': 'DGB대구',
  '032': 'BNK부산', '034': '광주', '035': '제주', '037': '전북', '039': '경남',
  '045': '새마을금고', '048': '신협', '071': '우체국', '081': 'KEB하나',
  '088': '신한', '089': 'K뱅크', '090': '카카오뱅크', '092': '토스뱅크',
}

interface Transaction {
  tid: string
  trdate: string
  trdt: string
  accIn: string
  accOut: string
  balance: string
  remark1: string
  remark2: string
  remark3: string
  memo: string
}

interface SearchResult {
  list: Transaction[]
  total: number
  pageNum: number
  perPage: number
}

interface BankAccount {
  bankCode: string
  accountNumber: string
  accountName: string
  accountType: string
  state: number
  closeRequestYN: boolean
  useRestrictYN: boolean
}

export interface CardItemLike {
  date: string
  amount: string
  merchant?: string
}

interface Props {
  cardItems: CardItemLike[]
  /** 지출내역 항목 클릭 시 호출 - 제공되면 항목을 클릭해서 사용내역에 자동 추가 가능 */
  onAddItem?: (item: { date: string; amount: string; merchant: string }) => void
}

function toApiDate(d: string): string {
  return d.replace(/-/g, '')
}

function fromApiDate(d: string): string {
  if (!d || d.length !== 8) return d
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

function findMatchingItem(tx: Transaction, items: CardItemLike[]): CardItemLike | undefined {
  const txDate = fromApiDate(tx.trdate)
  const txAmount = Number(tx.accOut)
  if (!txAmount) return undefined
  return items.find((it) => {
    if (!it.date || !it.amount) return undefined
    return it.date === txDate && Number(it.amount) === txAmount
  })
}

export function ExpenseProofPanel({ cardItems, onAddItem }: Props) {
  const [account, setAccount] = useState<BankAccount | null>(null)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SearchResult | null>(null)
  const lastFetchKeyRef = useRef<string>('')

  const dateRange = useMemo(() => {
    // 이번 달 1일 ~ 오늘
    const toStr = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${dd}`
    }
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: toStr(start), end: toStr(now) }
  }, [])

  // 계좌 목록 자동 조회 (첫 번째 활성 계좌 선택)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/bankaccount?action=list')
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        const list: BankAccount[] = json.data ?? []
        const active = list.find((a) => a.state === 0 && !a.closeRequestYN && !a.useRestrictYN) ?? list[0]
        if (!cancelled) {
          if (active) setAccount(active)
          else setAccountError('등록된 계좌가 없습니다')
        }
      } catch (e) {
        if (!cancelled) setAccountError(e instanceof Error ? e.message : '계좌 조회 실패')
      }
    })()
    return () => { cancelled = true }
  }, [])

  const fetchTransactions = useCallback(async () => {
    if (!account || !dateRange) return
    setLoading(true)
    setError(null)
    setResult(null)
    setStatus('조회 요청 중...')

    try {
      const reqRes = await fetch('/api/bankaccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'requestJob',
          bankCode: account.bankCode,
          accountNumber: account.accountNumber,
          startDate: toApiDate(dateRange.start),
          endDate: toApiDate(dateRange.end),
        }),
      })
      const reqJson = await reqRes.json()
      if (reqJson.error) throw new Error(reqJson.error)
      const jobID: string = reqJson.data

      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 1500))
        setStatus(`조회 중... (${i + 1}/15)`)
        const searchRes = await fetch(
          `/api/bankaccount?action=search&jobID=${jobID}&page=1&perPage=50`,
        )
        const searchJson = await searchRes.json()
        if (searchJson.error) {
          if (
            searchJson.error.includes('완료되지') ||
            searchJson.error.includes('처리중') ||
            searchJson.error.includes('대기')
          ) {
            continue
          }
          throw new Error(searchJson.error)
        }
        setResult(searchJson.data)
        setStatus('조회 완료')
        return
      }
      throw new Error('조회 시간 초과. 잠시 후 다시 시도해주세요.')
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패')
      setStatus('')
    } finally {
      setLoading(false)
    }
  }, [account, dateRange])

  // 계좌 + 날짜 범위가 준비되면 자동 조회 (같은 조합은 중복 호출 방지)
  useEffect(() => {
    if (!account || !dateRange) return
    const key = `${account.bankCode}|${account.accountNumber}|${dateRange.start}|${dateRange.end}`
    if (lastFetchKeyRef.current === key) return
    lastFetchKeyRef.current = key
    fetchTransactions()
  }, [account, dateRange, fetchTransactions])

  const withdrawals = result?.list.filter((tx) => Number(tx.accOut) > 0) ?? []
  const matchedCount = withdrawals.filter((tx) => findMatchingItem(tx, cardItems)).length
  const bankName = account ? BANK_NAMES[account.bankCode] ?? account.bankCode : ''

  return (
    <aside className={styles.proof_panel}>
      <div className={styles.proof_head}>
        <div className={styles.proof_title}>
          증빙 - {account ? account.accountName || '법인카드 계좌' : '계좌 불러오는 중...'}
        </div>
        {account && (
          <div className={styles.proof_account}>
            {bankName} {account.accountNumber}
          </div>
        )}
        {accountError && <div className={styles.proof_error}>{accountError}</div>}
      </div>

      <div className={styles.proof_range}>
        조회 범위: {dateRange.start} ~ {dateRange.end} (최근 1개월)
      </div>

      <button
        type="button"
        className={styles.proof_btn}
        onClick={() => {
          lastFetchKeyRef.current = ''
          fetchTransactions()
        }}
        disabled={loading || !dateRange || !account}
      >
        {loading ? status || '조회 중...' : '다시 불러오기'}
      </button>

      {error && <div className={styles.proof_error}>{error}</div>}

      {result && (
        <div className={styles.proof_summary}>
          출금 {withdrawals.length}건 · 매칭 <strong>{matchedCount}</strong>건 / 미매칭{' '}
          <strong>{withdrawals.length - matchedCount}</strong>건
        </div>
      )}

      <div className={styles.proof_list}>
        {result && withdrawals.length === 0 && (
          <div className={styles.proof_empty}>기간 내 출금 내역이 없습니다.</div>
        )}
        {withdrawals.map((tx) => {
          const matched = findMatchingItem(tx, cardItems)
          const clickable = !!onAddItem && !matched
          const handleClick = () => {
            if (!clickable || !onAddItem) return
            onAddItem({
              date: fromApiDate(tx.trdate),
              amount: String(Number(tx.accOut)),
              merchant: tx.remark1 || tx.remark2 || tx.memo || '',
            })
          }
          return (
            <div
              key={tx.tid}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={handleClick}
              onKeyDown={(e) => {
                if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  handleClick()
                }
              }}
              className={`${styles.proof_item} ${
                matched ? styles.proof_item_match : styles.proof_item_miss
              } ${clickable ? styles.proof_item_clickable : ''}`}
            >
              <div className={styles.proof_item_top}>
                <span className={styles.proof_item_date}>{fromApiDate(tx.trdate)}</span>
                <span className={styles.proof_item_amount}>
                  {Number(tx.accOut).toLocaleString()}원
                </span>
              </div>
              <div className={styles.proof_item_merchant}>
                {tx.remark1 || tx.remark2 || tx.memo || '-'}
              </div>
              <div className={styles.proof_item_badge}>
                {matched ? '✓ 증빙됨' : clickable ? '+ 클릭하여 추가' : '⚠ 사용내역 없음'}
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
