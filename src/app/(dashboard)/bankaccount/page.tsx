'use client'

import { useCallback, useEffect, useState } from 'react'
import { Landmark, RefreshCw, ExternalLink, Search } from 'lucide-react'
import { DateInput } from '@/components/ui/Calendar/DateInput'
import styles from './page.module.css'

const BANK_CODES: Record<string, string> = {
  '004': 'KB국민',
  '011': '농협',
  '020': '우리',
  '023': 'SC제일',
  '027': 'Citibank',
  '031': 'DGB대구',
  '032': 'BNK부산',
  '034': '광주',
  '035': '제주',
  '037': '전북',
  '039': '경남',
  '045': '새마을금고',
  '048': '신협',
  '050': '저축',
  '054': 'HSBC',
  '055': 'NH농협',
  '056': '평화',
  '057': 'JP모건',
  '060': 'BOA',
  '064': '산림조합',
  '071': '우체국',
  '081': 'KEB하나',
  '088': 'SH신한',
  '089': 'K뱅크',
  '090': '카카오뱅크',
  '092': '토스뱅크',
  '103': 'SBI저축',
  '218': 'KB증권',
  '238': '미래에셋',
  '240': '삼성증권',
  '243': '한국투자',
  '247': 'NH투자',
  '261': '교보증권',
  '262': '하이투자',
  '263': '현대차증권',
  '264': '키움증권',
  '265': '이베스트',
  '266': 'SK증권',
  '267': '대신증권',
  '269': '한화투자',
  '270': '하나증권',
  '271': '토스증권',
  '278': '신한금융투자',
  '279': '동부증권',
  '280': '유진투자',
  '287': '메리츠증권',
  '290': '부국증권',
  '291': '신영증권',
  '292': '케이프투자',
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

function formatDate(d: string) {
  if (!d || d.length !== 8) return d
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

function formatTime(t: string) {
  if (!t || t.length !== 6) return t
  return `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`
}

function formatAmount(n: number) {
  return n?.toLocaleString() ?? '-'
}

export default function BankAccountPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [mgtUrl, setMgtUrl] = useState<string | null>(null)

  const [selectedBankCode, setSelectedBankCode] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10).replace(/-/g, '')
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10).replace(/-/g, ''))
  const [jobID, setJobID] = useState<string | null>(null)
  const [jobLoading, setJobLoading] = useState(false)
  const [jobStatus, setJobStatus] = useState<string>('')
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [memos, setMemos] = useState<Record<string, string>>({})

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/bankaccount?action=list')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setAccounts(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '계좌 목록 조회 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  const openMgtUrl = async () => {
    try {
      const res = await fetch('/api/bankaccount?action=mgturl')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setMgtUrl(json.data)
      window.open(json.data, '_blank')
    } catch (e) {
      setError(e instanceof Error ? e.message : '관리 URL 조회 실패')
    }
  }

  const searchWithRetry = async (id: string): Promise<void> => {
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1500))
      setJobStatus(`조회 중... (${i + 1}/15)`)
      const res = await fetch(`/api/bankaccount?action=search&jobID=${id}&page=1&perPage=20`)
      const json = await res.json()
      if (json.error) {
        if (json.error.includes('완료되지') || json.error.includes('처리중') || json.error.includes('대기')) continue
        throw new Error(json.error)
      }
      setSearchResult(json.data)
      setPage(1)
      return
    }
    throw new Error('조회 시간 초과 - 잠시 후 결과 보기를 눌러주세요')
  }

  const requestJob = async () => {
    if (!selectedBankCode || !selectedAccount) {
      setError('은행과 계좌번호를 선택하세요')
      return
    }
    setJobLoading(true)
    setError(null)
    setJobID(null)
    setSearchResult(null)
    setJobStatus('조회 요청 중...')
    try {
      const res = await fetch('/api/bankaccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'requestJob',
          bankCode: selectedBankCode,
          accountNumber: selectedAccount,
          startDate,
          endDate,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const id: string = json.data
      setJobID(id)
      await searchWithRetry(id)
      setJobStatus('조회 완료')
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 요청 실패')
      setJobStatus('')
    } finally {
      setJobLoading(false)
    }
  }

  const searchTransactions = async (targetPage = 1) => {
    if (!jobID) return
    setJobLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bankaccount?action=search&jobID=${jobID}&page=${targetPage}&perPage=20`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setSearchResult(json.data)
      setPage(targetPage)
    } catch (e) {
      setError(e instanceof Error ? e.message : '거래내역 조회 실패')
    } finally {
      setJobLoading(false)
    }
  }

  const totalPages = searchResult ? Math.ceil(searchResult.total / searchResult.perPage) : 0

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Landmark size={20} />
          <h1>계좌조회 (팝빌)</h1>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={fetchAccounts} disabled={loading}>
            <RefreshCw size={14} />
            새로고침
          </button>
          <button className={styles.btnPrimary} onClick={openMgtUrl}>
            <ExternalLink size={14} />
            계좌 관리
          </button>
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>등록된 계좌 목록</h2>
        {loading ? (
          <p className={styles.loadingText}>불러오는 중...</p>
        ) : accounts.length === 0 ? (
          <p className={styles.emptyText}>등록된 계좌가 없습니다. 우측 상단 "계좌 관리"에서 계좌를 등록하세요.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>은행</th>
                <th>계좌번호</th>
                <th>예금주</th>
                <th>종류</th>
                <th>상태</th>
                <th>사용여부</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr
                  key={`${acc.bankCode}-${acc.accountNumber}`}
                  className={selectedAccount === acc.accountNumber && selectedBankCode === acc.bankCode ? styles.rowSelected : ''}
                  onClick={() => { setSelectedBankCode(acc.bankCode ?? ''); setSelectedAccount(acc.accountNumber ?? '') }}
                >
                  <td>{BANK_CODES[acc.bankCode] ?? BANK_CODES[acc.bankCode.replace(/^0+/, '')] ?? acc.bankCode}</td>
                  <td>{acc.accountNumber}</td>
                  <td>{acc.accountName}</td>
                  <td>{acc.accountType}</td>
                  <td>{acc.state === 1 ? '정상' : acc.state === 2 ? '해지' : '일시정지'}</td>
                  <td>{acc.closeRequestYN ? '해지신청' : acc.useRestrictYN ? '제한' : '사용'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>거래내역 조회</h2>
        <div className={styles.queryForm}>
          <div className={styles.formRow}>
            <label>은행</label>
            <select
              className={styles.select}
              value={selectedBankCode.length === 4 ? selectedBankCode.slice(1) : selectedBankCode}
              onChange={e => setSelectedBankCode(e.target.value)}
            >
              <option value="">은행 선택</option>
              {Object.entries(BANK_CODES).map(([code, name]) => (
                <option key={code} value={code}>{name} ({code})</option>
              ))}
            </select>
          </div>
          <div className={styles.formRow}>
            <label>계좌번호</label>
            <input
              className={styles.input}
              type="text"
              placeholder="-없이 숫자만"
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <label>조회기간</label>
            <div className={styles.dateRange}>
              <DateInput
                value={startDate ? `${startDate.slice(0,4)}-${startDate.slice(4,6)}-${startDate.slice(6,8)}` : ''}
                onChange={v => setStartDate(v.replace(/-/g, ''))}
                placeholder="시작일"
              />
              <span>~</span>
              <DateInput
                value={endDate ? `${endDate.slice(0,4)}-${endDate.slice(4,6)}-${endDate.slice(6,8)}` : ''}
                onChange={v => setEndDate(v.replace(/-/g, ''))}
                placeholder="종료일"
                align="right"
              />
            </div>
          </div>
          <button
            className={styles.btnPrimary}
            onClick={requestJob}
            disabled={jobLoading}
          >
            <Search size={14} />
            조회 요청
          </button>
        </div>

        {jobLoading && jobStatus && (
          <p className={styles.loadingText}>{jobStatus}</p>
        )}

        {jobID && (
          <div className={styles.jobInfo}>
            <span>Job ID: <code>{jobID}</code></span>
            <button
              className={styles.btnSecondary}
              onClick={() => searchTransactions(1)}
              disabled={jobLoading}
            >
              결과 보기
            </button>
          </div>
        )}

        {searchResult && (
          <>
            <p className={styles.resultCount}>
              총 <strong>{searchResult.total.toLocaleString()}</strong>건
            </p>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colSeq}>순번</th>
                  <th>거래일시</th>
                  <th>거래내역</th>
                  <th className={styles.colAmount}>입금액</th>
                  <th className={styles.colAmount}>출금액</th>
                  <th className={styles.colAmount}>잔액</th>
                  <th className={styles.colMemo}>메모</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {searchResult.list.map((tx, idx) => {
                  const accIn = parseInt(tx.accIn)
                  const accOut = parseInt(tx.accOut)
                  const datetime = tx.trdt?.length >= 14
                    ? `${formatDate(tx.trdt.slice(0, 8))} ${formatTime(tx.trdt.slice(8, 14))}`
                    : formatDate(tx.trdate)
                  const seq = (page - 1) * (searchResult.perPage) + idx + 1
                  const memo = memos[tx.tid] ?? tx.memo ?? ''
                  return (
                    <tr key={tx.tid}>
                      <td className={styles.colSeq}>{seq}</td>
                      <td className={styles.datetimeCell}>{datetime}</td>
                      <td>{[tx.remark1, tx.remark2, tx.remark3].filter(Boolean).join(' ')}</td>
                      <td className={styles.colAmount}>
                        {accIn > 0 && <span className={styles.deposit}>{formatAmount(accIn)}</span>}
                      </td>
                      <td className={styles.colAmount}>
                        {accOut > 0 && <span className={styles.withdraw}>{formatAmount(accOut)}</span>}
                      </td>
                      <td className={styles.colAmount}>{formatAmount(parseInt(tx.balance))}</td>
                      <td className={styles.colMemo}>
                        <input
                          className={styles.memoInput}
                          type="text"
                          value={memo}
                          onChange={e => setMemos(prev => ({ ...prev, [tx.tid]: e.target.value }))}
                          placeholder="메모"
                        />
                      </td>
                      <td>
                        <button className={styles.btnSave}>저장</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button disabled={page <= 1} onClick={() => searchTransactions(page - 1)}>이전</button>
                <span>{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => searchTransactions(page + 1)}>다음</button>
              </div>
            )}
          </>
        )}
      </section>

      {mgtUrl && (
        <p className={styles.urlHint}>관리 URL: <a href={mgtUrl} target="_blank" rel="noopener noreferrer">{mgtUrl}</a></p>
      )}
    </div>
  )
}
