import React from 'react'
import styles from './styles.module.css'
import type { DocBodyProps, FieldDef, BankAccountLite } from '../types'
import { DateInput } from '@/components/ui/Calendar/DateInput'
import { parse, isValid, format } from 'date-fns'
import { ko } from 'date-fns/locale'

export const EXPENSE_RESOLUTION_CARD_FIELDS: FieldDef[] = [
  { key: 'belong_dept',     label: '소속부서',   type: 'text', required: true },
  { key: 'bank_account_id', label: '사용 통장',  type: 'text', required: false },
  { key: 'card_items',      label: '사용내역',   type: 'text', required: true },
  { key: 'special_note',    label: '특이사항',   type: 'textarea' },
]

interface CardItem {
  date: string
  card_last4: string
  user: string
  merchant: string
  detail: string
  amount: string
  category: string
}

const DEFAULT_ROWS = 1
const CATEGORY_OPTIONS = ['운영비', '예산비'] as const

function emptyItem(): CardItem {
  return { date: '', card_last4: '', user: '', merchant: '', detail: '', amount: '', category: '' }
}

function v(content: Record<string, unknown>, key: string): string {
  return String(content[key] ?? '')
}

function parseJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) } catch { return fallback }
}

function numDisplay(str: string): string {
  const n = Number(str)
  return !str || isNaN(n) || n === 0 ? '' : n.toLocaleString()
}

function formatDateKo(str: string): string {
  if (!str) return ''
  const d = parse(str, 'yyyy-MM-dd', new Date())
  return isValid(d) ? format(d, 'yyyy-MM-dd(eee)', { locale: ko }) : str
}

function AccountDisplay({ account }: { account: BankAccountLite | null }) {
  if (!account) return <span className={styles.empty_account}>등록된 통장이 없습니다.</span>
  return (
    <div className={styles.account_display}>
      <span className={styles.account_display_main}>
        {account.bank_name}
        {account.account_holder ? ` · ${account.account_holder}` : ''}
      </span>
      <span className={styles.account_display_sub}>{account.account_number}</span>
      {account.memo && (
        <span className={styles.account_display_memo}>{account.memo}</span>
      )}
    </div>
  )
}

function AccountList({
  accounts,
  selectedId,
  onSelect,
}: {
  accounts: BankAccountLite[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <select
      className={styles.account_select}
      value={selectedId}
      onChange={(e) => onSelect(e.target.value)}
    >
      <option value="">통장 선택</option>
      {accounts.map((a) => {
        const label = `${a.account_number}${a.memo ? ` (${a.memo})` : ''}`
        return (
          <option key={a.id} value={a.id}>
            {label}
          </option>
        )
      })}
    </select>
  )
}

export function ExpenseResolutionCardBody({ content, onChange, departments = [], bankAccounts = [] }: DocBodyProps) {
  const ro = !onChange

  const belongDeptId = v(content, 'belong_dept')
  const accountId = v(content, 'bank_account_id')

  const deptAccounts = bankAccounts.filter(b => b.department_id === belongDeptId)
  const selectedAccount = bankAccounts.find(b => b.id === accountId) ?? null

  // 사업부 바꿀 때 기존에 선택된 통장이 그 사업부 소속이 아니면 자동 초기화/단일이면 자동 선택
  React.useEffect(() => {
    if (ro) return
    if (!belongDeptId) return
    if (accountId && !deptAccounts.find(a => a.id === accountId)) {
      onChange!('bank_account_id', '')
    } else if (!accountId && deptAccounts.length === 1) {
      onChange!('bank_account_id', deptAccounts[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [belongDeptId, deptAccounts.length])

  const items: CardItem[] = (() => {
    const parsed = parseJson<CardItem[]>(v(content, 'card_items'), [])
    if (!ro && parsed.length < DEFAULT_ROWS) {
      return [...parsed, ...Array(DEFAULT_ROWS - parsed.length).fill(null).map(emptyItem)]
    }
    return parsed
  })()

  function updateItems(next: CardItem[]) {
    onChange!('card_items', JSON.stringify(next))
  }

  function updateItem(idx: number, field: keyof CardItem, value: string) {
    updateItems(items.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const total = items.reduce((sum, item) => {
    const n = Number(item.amount)
    return sum + (isNaN(n) ? 0 : n)
  }, 0)

  const visibleItems = ro
    ? items.filter(item => item.date || item.card_last4 || item.merchant || item.amount)
    : items

  const merchantSuggestions = Array.from(
    new Set(items.map((it) => it.merchant?.trim()).filter((m): m is string => !!m))
  )

  return (
    <>
      {/* ── 사업부 / 사용 통장 ── */}
      <table className={styles.summary_table}>
        <tbody>
          <tr>
            <td className={styles.label_cell}>소속부서</td>
            <td className={styles.value_cell}>
              {ro ? (
                <span>{(departments.find(d => d.id === belongDeptId)?.name ?? belongDeptId) || '-'}</span>
              ) : (
                <select
                  className={styles.select_full}
                  value={belongDeptId}
                  onChange={(e) => onChange!('belong_dept', e.target.value)}
                >
                  <option value="">-</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}
            </td>
            <td className={styles.label_cell}>사용 법인카드 통장</td>
            <td className={styles.value_cell}>
              {ro ? (
                <AccountDisplay account={selectedAccount} />
              ) : !belongDeptId ? (
                <span className={styles.empty_account}>소속부서를 먼저 선택하세요.</span>
              ) : deptAccounts.length === 0 ? (
                <span className={styles.empty_account}>이 사업부에 등록된 통장이 없습니다.</span>
              ) : (
                <AccountList
                  accounts={deptAccounts}
                  selectedId={accountId}
                  onSelect={(id) => onChange!('bank_account_id', id)}
                />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── 카드 사용내역 표 ── */}
      <table className={styles.table_main}>
        <thead>
          <tr>
            <th className={styles.th_date}>결제일</th>
            <th className={styles.th_card}>카드번호 뒷 4자리</th>
            <th className={styles.th_user}>사용자</th>
            <th className={styles.th_merchant}>상호명(거래처명)</th>
            <th className={styles.th_detail}>세부내용</th>
            <th className={styles.th_amount}>금액</th>
            <th className={styles.th_category}>분류</th>
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((item, idx) => (
            <tr key={idx}>
              <td className={styles.td_date}>
                {ro ? (
                  <span>{formatDateKo(item.date)}</span>
                ) : (
                  <DateInput
                    value={item.date}
                    onChange={(val) => updateItem(idx, 'date', val)}
                    align="left"
                    direction="down"
                  />
                )}
              </td>
              <td className={styles.td_card}>
                {ro ? <span>{item.card_last4}</span> : (
                  <input
                    type="text"
                    className={styles.input_center}
                    value={item.card_last4}
                    maxLength={4}
                    placeholder="0000"
                    onChange={(e) => updateItem(idx, 'card_last4', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                )}
              </td>
              <td className={styles.td_user}>
                {ro ? <span>{item.user}</span> : (
                  <input type="text" className={styles.input_full}
                    value={item.user} placeholder=""
                    onChange={(e) => updateItem(idx, 'user', e.target.value)} />
                )}
              </td>
              <td className={styles.td_merchant}>
                {ro ? <span>{item.merchant}</span> : (
                  <input
                    type="text"
                    className={styles.input_full}
                    list="merchant-suggestions-card"
                    autoComplete="off"
                    value={item.merchant}
                    placeholder=""
                    onChange={(e) => updateItem(idx, 'merchant', e.target.value)}
                  />
                )}
              </td>
              <td className={styles.td_detail}>
                {ro ? <span>{item.detail}</span> : (
                  <input type="text" className={styles.input_full}
                    value={item.detail} placeholder=""
                    onChange={(e) => updateItem(idx, 'detail', e.target.value)} />
                )}
              </td>
              <td className={styles.td_amount}>
                {ro ? <span>{numDisplay(item.amount)}</span> : (
                  <input
                    type="text"
                    inputMode="numeric"
                    className={styles.input_num}
                    value={item.amount ? Number(item.amount.replace(/[^\d]/g, '')).toLocaleString() : ''}
                    placeholder=""
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, '')
                      updateItem(idx, 'amount', raw)
                    }}
                  />
                )}
              </td>
              <td className={styles.td_category}>
                {ro ? (
                  <span>{item.category}</span>
                ) : (
                  <select
                    className={styles.select_full}
                    value={item.category}
                    onChange={(e) => updateItem(idx, 'category', e.target.value)}
                  >
                    <option value="">분류</option>
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </td>
            </tr>
          ))}
          <tr className={styles.total_row}>
            <td colSpan={5} className={styles.total_label}>합 계</td>
            <td className={styles.total_amount}>{total.toLocaleString()}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      {!ro && merchantSuggestions.length > 0 && (
        <datalist id="merchant-suggestions-card">
          {merchantSuggestions.map((m) => <option key={m} value={m} />)}
        </datalist>
      )}

      {/* 특이사항 */}
      <div className={styles.special_block}>
        <table className={styles.summary_table}>
          <tbody>
            <tr>
              <td className={styles.label_cell}>특이사항</td>
              <td className={styles.value_cell} colSpan={3}>
                {ro ? (
                  <span className={styles.pre_wrap}>{v(content, 'special_note') || ''}</span>
                ) : (
                  <textarea
                    className={styles.textarea_full}
                    value={v(content, 'special_note')}
                    placeholder=""
                    onChange={(e) => onChange!('special_note', e.target.value)}
                  />
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.notes}>
        <p className={styles.notes_title}>※ 제출 안내</p>
        <p>- 법인카드 사용 영수증은 반드시 전자결재에 첨부파일로 업로드해 주세요. (스캔 또는 사진 가능)</p>
        <p>- 결제한 해당 월의 사용내역은 그 달 안에 제출해 주시기 바랍니다.</p>
      </div>
    </>
  )
}
