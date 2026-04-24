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
  onAddItem?: (item: { date: string; amount: string; merchant: string; cardLast4: string }) => void
  /** 매칭된 항목 제거 요청 - 제공되면 X 버튼 노출 */
  onRemoveItem?: (item: { date: string; amount: string }) => void
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

type FilterMode = 'unmatched' | 'matched' | 'all'

export function ExpenseProofPanel({ cardItems, onAddItem, onRemoveItem }: Props) {
  const [account, setAccount] = useState<BankAccount | null>(null)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [filterMode, setFilterMode] = useState<FilterMode>('unmatched')
  const [query, setQuery] = useState('')
  const [defaultCardLast4, setDefaultCardLast4] = useState('')
  const lastFetchKeyRef = useRef<string>('')

  const toStr = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }
  const defaultRange = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: toStr(start), end: toStr(now) }
  }, [])
  const [startDate, setStartDate] = useState(defaultRange.start)
  const [endDate, setEndDate] = useState(defaultRange.end)
  const dateRange = useMemo(() => ({ start: startDate, end: endDate }), [startDate, endDate])

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
  const unmatchedCount = withdrawals.length - matchedCount
  const normalizedBankCode = account ? account.bankCode.replace(/^0+/, '').padStart(3, '0') : ''
  const bankName = account ? BANK_NAMES[normalizedBankCode] ?? BANK_NAMES[account.bankCode] ?? account.bankCode : ''

  const q = query.trim().toLowerCase()
  const visibleList = withdrawals.filter((tx) => {
    const matched = !!findMatchingItem(tx, cardItems)
    if (filterMode === 'matched' && !matched) return false
    if (filterMode === 'unmatched' && matched) return false
    if (!q) return true
    const merchant = (tx.remark1 || tx.remark2 || tx.memo || '').toLowerCase()
    const amount = String(Number(tx.accOut))
    return merchant.includes(q) || amount.includes(q) || tx.trdate.includes(q.replace(/-/g, ''))
  })

  return (
    <aside className={styles.proof_panel}>
      <div className={styles.proof_head}>
        <div className={styles.proof_title}>
          {account ? account.accountName || '법인카드 계좌' : '계좌 불러오는 중...'}
        </div>
        {account && (
          <div className={styles.proof_account}>
            {bankName} {account.accountNumber}
          </div>
        )}
        {accountError && <div className={styles.proof_error}>{accountError}</div>}
      </div>

      <div className={styles.proof_range_picker}>
        <input
          type="date"
          className={styles.proof_date_input}
          value={startDate}
          max={endDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <span className={styles.proof_date_sep}>~</span>
        <input
          type="date"
          className={styles.proof_date_input}
          value={endDate}
          min={startDate}
          max={toStr(new Date())}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      <label className={styles.proof_card_field}>
        <span className={styles.proof_card_label}>카드번호 뒷 4자리</span>
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          className={styles.proof_card_input}
          placeholder="0000"
          value={defaultCardLast4}
          onChange={(e) => setDefaultCardLast4(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
        />
      </label>

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
        <>
          <div className={styles.proof_tabs} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'unmatched'}
              className={`${styles.proof_tab} ${filterMode === 'unmatched' ? styles.proof_tab_active : ''}`}
              onClick={() => setFilterMode('unmatched')}
            >
              미매칭 <span className={styles.proof_tab_count}>{unmatchedCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'matched'}
              className={`${styles.proof_tab} ${filterMode === 'matched' ? styles.proof_tab_active : ''}`}
              onClick={() => setFilterMode('matched')}
            >
              매칭 <span className={styles.proof_tab_count}>{matchedCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'all'}
              className={`${styles.proof_tab} ${filterMode === 'all' ? styles.proof_tab_active : ''}`}
              onClick={() => setFilterMode('all')}
            >
              전체 <span className={styles.proof_tab_count}>{withdrawals.length}</span>
            </button>
          </div>

          <div className={styles.proof_search_wrap}>
            <input
              type="text"
              className={styles.proof_search}
              placeholder="상호 · 금액 · 날짜 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className={styles.proof_search_clear}
                onClick={() => setQuery('')}
                aria-label="검색어 지우기"
              >
                ×
              </button>
            )}
          </div>
        </>
      )}

      <div className={styles.proof_list}>
        {result && withdrawals.length === 0 && (
          <div className={styles.proof_empty}>기간 내 출금 내역이 없습니다.</div>
        )}
        {result && withdrawals.length > 0 && visibleList.length === 0 && (
          <div className={styles.proof_empty}>
            {q ? '검색 결과가 없습니다.' : filterMode === 'unmatched' ? '모든 내역이 매칭되었습니다 🎉' : '해당하는 내역이 없습니다.'}
          </div>
        )}
        {visibleList.map((tx) => {
          const matched = findMatchingItem(tx, cardItems)
          const clickable = !!onAddItem && !matched
          const handleClick = () => {
            if (!clickable || !onAddItem) return
            onAddItem({
              date: fromApiDate(tx.trdate),
              amount: String(Number(tx.accOut)),
              merchant: tx.remark1 || tx.remark2 || tx.memo || '',
              cardLast4: defaultCardLast4,
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
              {matched && onRemoveItem && (
                <button
                  type="button"
                  className={styles.proof_item_remove}
                  aria-label="사용내역에서 제거"
                  title="사용내역에서 제거"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveItem({
                      date: fromApiDate(tx.trdate),
                      amount: String(Number(tx.accOut)),
                    })
                  }}
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
