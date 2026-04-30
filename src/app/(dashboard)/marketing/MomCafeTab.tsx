'use client'

import { useState, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { DateRangeCalendar, type DateRange } from '@/components/DateRangeCalendar'
import styles from './MomCafeTab.module.css'

const ITEMS_PER_PAGE = 10

interface MomCafe {
  id: number
  name: string
  contact: string | null
  bank_name: string | null
  account_number: string | null
  account_holder: string | null
  monthly_payment: number
  total_payment: number
  contract_start: string | null
  contract_end: string | null
  expense_note: string | null
  writing_note: string | null
  special_note: string | null
  created_at: string
  updated_at: string
}

interface FormState {
  name: string
  contact: string
  bank_name: string
  account_number: string
  account_holder: string
  monthly_payment: string
  total_payment: string
  contract_start: string
  contract_end: string
  expense_note: string
  writing_note: string
  special_note: string
}

const EXPENSE_OPTIONS = ['현금영수증', '세금계산서'] as const

const EMPTY_FORM: FormState = {
  name: '',
  contact: '',
  bank_name: '',
  account_number: '',
  account_holder: '',
  monthly_payment: '',
  total_payment: '',
  contract_start: '',
  contract_end: '',
  expense_note: '',
  writing_note: '',
  special_note: '',
}

function toForm(c: MomCafe): FormState {
  return {
    name: c.name ?? '',
    contact: c.contact ?? '',
    bank_name: c.bank_name ?? '',
    account_number: c.account_number ?? '',
    account_holder: c.account_holder ?? '',
    monthly_payment: c.monthly_payment != null ? String(c.monthly_payment) : '',
    total_payment: c.total_payment != null ? String(c.total_payment) : '',
    contract_start: c.contract_start ?? '',
    contract_end: c.contract_end ?? '',
    expense_note: c.expense_note ?? '',
    writing_note: c.writing_note ?? '',
    special_note: c.special_note ?? '',
  }
}

function formatAmount(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '-'
  return Number(n).toLocaleString('ko-KR') + '원'
}

function formatContact(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

function formToDateRange(start: string, end: string): DateRange | undefined {
  if (!start && !end) return undefined
  return {
    from: start ? parseISO(start) : undefined,
    to: end ? parseISO(end) : undefined,
  }
}

function getPaginationPages(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const delta = 2
  const rangeStart = Math.max(2, current - delta)
  const rangeEnd = Math.min(total - 1, current + delta)
  const pages: (number | '...')[] = [1]
  if (rangeStart > 2) pages.push('...')
  for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i)
  if (rangeEnd < total - 1) pages.push('...')
  pages.push(total)
  return pages
}

function Highlight({ text, query }: { text: string | null; query: string }) {
  if (!query || !text) return <>{text ?? '-'}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  if (parts.length > 1) {
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase()
            ? <mark key={i} className={styles.highlight}>{part}</mark>
            : part
        )}
      </>
    )
  }
  const textClean = text.replace(/-/g, '')
  const queryClean = query.replace(/-/g, '')
  if (queryClean && textClean.toLowerCase().includes(queryClean.toLowerCase())) {
    const cleanIdx = textClean.toLowerCase().indexOf(queryClean.toLowerCase())
    let origStart = 0, cleanCount = 0
    for (let i = 0; i < text.length && cleanCount < cleanIdx; i++) {
      if (text[i] !== '-') cleanCount++
      origStart = i + 1
    }
    let origEnd = origStart, matched = 0
    for (let i = origStart; i < text.length && matched < queryClean.length; i++) {
      if (text[i] !== '-') matched++
      origEnd = i + 1
    }
    return (
      <>
        {text.slice(0, origStart)}
        <mark className={styles.highlight}>{text.slice(origStart, origEnd)}</mark>
        {text.slice(origEnd)}
      </>
    )
  }
  return <>{text}</>
}

export default function MomCafeTab() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<MomCafe[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [searchText, setSearchText] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<MomCafe | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  const [showDatePicker, setShowDatePicker] = useState(false)
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('mom_cafes')
        .select('*')
        .order('created_at', { ascending: false })
      if (!cancelled) {
        setItems((data ?? []) as MomCafe[])
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    setCurrentPage(1)
    setSelectedIds(new Set())
  }, [searchText])

  const filtered = items.filter((item) => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return (
      item.name.toLowerCase().includes(q) ||
      (item.contact ?? '').replace(/-/g, '').includes(q.replace(/-/g, '')) ||
      (item.bank_name ?? '').toLowerCase().includes(q) ||
      (item.account_number ?? '').toLowerCase().includes(q) ||
      (item.account_holder ?? '').toLowerCase().includes(q) ||
      (item.expense_note ?? '').toLowerCase().includes(q) ||
      (item.writing_note ?? '').toLowerCase().includes(q) ||
      (item.special_note ?? '').toLowerCase().includes(q)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    const pageIds = paginated.map((x) => x.id)
    const allSelected = pageIds.every((id) => selectedIds.has(id))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  function openAdd() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setCalendarRange(undefined)
    setShowDatePicker(false)
    setShowModal(true)
  }

  function openEdit(item: MomCafe) {
    setEditTarget(item)
    const f = toForm(item)
    setForm(f)
    setCalendarRange(formToDateRange(f.contract_start, f.contract_end))
    setShowDatePicker(false)
    setShowModal(true)
  }

  function openEditSelected() {
    if (selectedIds.size !== 1) return
    const target = items.find((x) => x.id === Array.from(selectedIds)[0])
    if (target) openEdit(target)
  }

  function closeModal() {
    if (saving) return
    setShowModal(false)
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setCalendarRange(undefined)
    setShowDatePicker(false)
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleContactChange(raw: string) {
    setField('contact', formatContact(raw))
  }

  function handleDateConfirm(range: DateRange | undefined) {
    const start = range?.from ? format(range.from, 'yyyy-MM-dd') : ''
    const end = range?.to ? format(range.to, 'yyyy-MM-dd') : ''
    setField('contract_start', start)
    setField('contract_end', end)
    setCalendarRange(range)
    setShowDatePicker(false)
  }

  function handleDateReset() {
    setField('contract_start', '')
    setField('contract_end', '')
    setCalendarRange(undefined)
  }

  function buildPayload() {
    const monthly = form.monthly_payment.trim() === '' ? 0 : Number(form.monthly_payment)
    const total = form.total_payment.trim() === '' ? 0 : Number(form.total_payment)
    return {
      name: form.name.trim(),
      contact: form.contact.trim() || null,
      bank_name: form.bank_name.trim() || null,
      account_number: form.account_number.trim() || null,
      account_holder: form.account_holder.trim() || null,
      monthly_payment: Number.isFinite(monthly) ? monthly : 0,
      total_payment: Number.isFinite(total) ? total : 0,
      contract_start: form.contract_start || null,
      contract_end: form.contract_end || null,
      expense_note: form.expense_note.trim() || null,
      writing_note: form.writing_note.trim() || null,
      special_note: form.special_note.trim() || null,
    }
  }

  async function handleSave() {
    if (savingRef.current) return
    if (!form.name.trim()) {
      alert('맘카페 이름을 입력해주세요.')
      return
    }
    savingRef.current = true
    setSaving(true)
    const supabase = createClient()
    const payload = buildPayload()

    try {
      if (editTarget) {
        const { data, error } = await supabase
          .from('mom_cafes')
          .update(payload)
          .eq('id', editTarget.id)
          .select()
          .single()
        if (error) throw error
        if (data) {
          setItems((prev) => prev.map((x) => (x.id === editTarget.id ? (data as MomCafe) : x)))
        }
      } else {
        const { data, error } = await supabase
          .from('mom_cafes')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        if (data) {
          setItems((prev) => [data as MomCafe, ...prev])
        }
      }
      setShowModal(false)
      setEditTarget(null)
      setForm(EMPTY_FORM)
      setCalendarRange(undefined)
      setSelectedIds(new Set())
    } catch (err) {
      const msg = err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.'
      alert(msg)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return
    const names = items.filter((x) => selectedIds.has(x.id)).map((x) => x.name)
    const label = names.length === 1 ? `"${names[0]}"` : `${names.length}건`
    if (!confirm(`${label}을 삭제하시겠습니까?`)) return
    const supabase = createClient()
    const ids = Array.from(selectedIds)
    const { error } = await supabase.from('mom_cafes').delete().in('id', ids)
    if (error) {
      alert(error.message)
      return
    }
    setItems((prev) => prev.filter((x) => !selectedIds.has(x.id)))
    setSelectedIds(new Set())
  }

  if (loading) return <div className={styles.loading}>불러오는 중...</div>

  const dateLabel =
    form.contract_start && form.contract_end
      ? `${form.contract_start} ~ ${form.contract_end}`
      : form.contract_start
        ? `${form.contract_start} ~`
        : '날짜를 선택하세요'

  const pageIds = paginated.map((x) => x.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.sub}>등록된 맘카페 {items.length}건</span>
        <input
          className={styles.search_input}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="검색..."
        />
        {selectedIds.size === 1 && (
          <button className={styles.edit_btn} onClick={openEditSelected}>
            수정
          </button>
        )}
        {selectedIds.size > 0 && (
          <button className={styles.delete_btn} onClick={handleDeleteSelected}>
            삭제
          </button>
        )}
        <button className={styles.add_btn} onClick={openAdd}>
          + 맘카페 추가
        </button>
      </div>

      <div className={styles.table_wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th_check}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={allPageSelected}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>맘카페 이름</th>
              <th>관계자 연락처</th>
              <th>은행명</th>
              <th>입금 계좌</th>
              <th>예금주명</th>
              <th>월 납부액</th>
              <th>총 납부액</th>
              <th>계약 시작</th>
              <th>계약 종료</th>
              <th>비용처리</th>
              <th>글작성</th>
              <th>특이사항</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={13} className={styles.empty}>
                  {searchText ? '검색 결과가 없습니다.' : '등록된 맘카페가 없습니다.'}
                </td>
              </tr>
            ) : (
              paginated.map((item) => (
                <tr
                  key={item.id}
                  className={selectedIds.has(item.id) ? styles.row_selected : ''}
                >
                  <td className={styles.td_check}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                    />
                  </td>
                  <td className={styles.cafe_name}>
                    <Highlight text={item.name} query={searchText} />
                  </td>
                  <td><Highlight text={item.contact} query={searchText} /></td>
                  <td><Highlight text={item.bank_name} query={searchText} /></td>
                  <td><Highlight text={item.account_number} query={searchText} /></td>
                  <td><Highlight text={item.account_holder} query={searchText} /></td>
                  <td className={styles.amount}>{formatAmount(item.monthly_payment)}</td>
                  <td className={styles.amount}>{formatAmount(item.total_payment)}</td>
                  <td>{item.contract_start ?? <span className={styles.muted}>-</span>}</td>
                  <td>{item.contract_end ?? <span className={styles.muted}>-</span>}</td>
                  <td className={styles.note_cell}>
                    <Highlight text={item.expense_note} query={searchText} />
                  </td>
                  <td className={styles.note_cell}>
                    <Highlight text={item.writing_note} query={searchText} />
                  </td>
                  <td className={styles.note_cell}>
                    <Highlight text={item.special_note} query={searchText} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.page_btn}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            ‹
          </button>
          {getPaginationPages(currentPage, totalPages).map((page, idx) =>
            page === '...'
              ? <span key={`ellipsis-${idx}`} className={styles.page_ellipsis}>...</span>
              : (
                <button
                  key={page}
                  className={page === currentPage ? styles.page_btn_active : styles.page_btn}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              )
          )}
          <button
            className={styles.page_btn}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            ›
          </button>
        </div>
      )}

      {showModal && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modal_header}>
              <span className={styles.modal_title}>
                {editTarget ? '맘카페 수정' : '맘카페 추가'}
              </span>
              <button className={styles.modal_close} onClick={closeModal}>
                ✕
              </button>
            </div>
            <div className={styles.modal_body}>
              <div className={`${styles.field} ${styles.field_full}`}>
                <label className={styles.label}>맘카페 이름 *</label>
                <input
                  className={styles.input}
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="예) ○○맘카페"
                  autoFocus
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>관계자 연락처</label>
                <input
                  className={styles.input}
                  value={form.contact}
                  onChange={(e) => handleContactChange(e.target.value)}
                  placeholder="010-0000-0000"
                  inputMode="numeric"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>은행명</label>
                <input
                  className={styles.input}
                  value={form.bank_name}
                  onChange={(e) => setField('bank_name', e.target.value)}
                  placeholder="예) 신한은행"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>입금 계좌</label>
                <input
                  className={styles.input}
                  value={form.account_number}
                  onChange={(e) => setField('account_number', e.target.value)}
                  placeholder="000-000-000000"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>예금주명</label>
                <input
                  className={styles.input}
                  value={form.account_holder}
                  onChange={(e) => setField('account_holder', e.target.value)}
                  placeholder="예금주"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>월 납부액 (원)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={form.monthly_payment}
                  onChange={(e) => setField('monthly_payment', e.target.value)}
                  placeholder="0"
                  min={0}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>총 납부액 (원)</label>
                <input
                  type="number"
                  className={styles.input}
                  value={form.total_payment}
                  onChange={(e) => setField('total_payment', e.target.value)}
                  placeholder="0"
                  min={0}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>비용처리</label>
                <div className={styles.pill_group}>
                  {EXPENSE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`${styles.pill} ${form.expense_note === opt ? styles.pill_active : ''}`}
                      onClick={() => setField('expense_note', form.expense_note === opt ? '' : opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>글작성</label>
                <input
                  className={styles.input}
                  value={form.writing_note}
                  onChange={(e) => setField('writing_note', e.target.value)}
                  placeholder="예) 주1회, 1일1회"
                />
              </div>

              <div className={`${styles.field} ${styles.field_full}`}>
                <label className={styles.label}>계약기간</label>
                <button
                  type="button"
                  className={`${styles.date_trigger} ${showDatePicker ? styles.date_trigger_open : ''}`}
                  onClick={() => setShowDatePicker((v) => !v)}
                >
                  {dateLabel}
                </button>
                {showDatePicker && (
                  <div className={styles.date_picker_wrap}>
                    <DateRangeCalendar
                      value={calendarRange}
                      onChange={setCalendarRange}
                      onConfirm={handleDateConfirm}
                      onReset={handleDateReset}
                      maxRangeMonths={60}
                    />
                  </div>
                )}
              </div>

              <div className={`${styles.field} ${styles.field_full}`}>
                <label className={styles.label}>특이사항</label>
                <textarea
                  className={styles.textarea}
                  value={form.special_note}
                  onChange={(e) => setField('special_note', e.target.value)}
                  placeholder="특이사항을 입력하세요."
                />
              </div>
            </div>
            <div className={styles.modal_footer}>
              <button className={styles.cancel_btn} onClick={closeModal} disabled={saving}>
                취소
              </button>
              <button
                className={styles.confirm_btn}
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
              >
                {saving ? '저장 중...' : editTarget ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
