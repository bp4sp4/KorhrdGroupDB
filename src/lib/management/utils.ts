export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`
}

export function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원'
}

export function formatAmountShort(amount: number): string {
  if (amount >= 100_000_000) return `${(amount / 100_000_000).toFixed(1)}억`
  if (amount >= 10_000) return `${Math.floor(amount / 10_000).toLocaleString('ko-KR')}만`
  return amount.toLocaleString('ko-KR')
}

export function getMonthLabel(year: number, month: number): string {
  return `${year}년 ${String(month).padStart(2, '0')}월`
}

export function getThisMonth(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export function getRevenueTypeLabel(type: string): string {
  const map: Record<string, string> = {
    CARD: '카드',
    BANK_TRANSFER: '계좌이체',
    OTHER: '기타',
  }
  return map[type] ?? type
}

export function getPaymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    CORPORATE_CARD: '법인카드',
    BANK_TRANSFER: '계좌이체',
    CASH: '현금',
    OTHER: '기타',
  }
  return map[method] ?? method
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: '임시저장',
    SUBMITTED: '상신',
    IN_PROGRESS: '결재 중',
    APPROVED: '승인완료',
    REJECTED: '반려',
    RESUBMITTED: '재상신',
    CANCELLED: '취소',
  }
  return map[status] ?? status
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    DRAFT: '#8B95A1',
    SUBMITTED: '#3182F6',
    IN_PROGRESS: '#FFB020',
    APPROVED: '#22C55E',
    REJECTED: '#F04452',
    RESUBMITTED: '#3182F6',
    CANCELLED: '#B0B8C1',
  }
  return map[status] ?? '#8B95A1'
}

export function getStatusBg(status: string): string {
  const map: Record<string, string> = {
    DRAFT: '#F2F4F6',
    SUBMITTED: '#EBF3FE',
    IN_PROGRESS: '#FFF8EB',
    APPROVED: '#F0FDF4',
    REJECTED: '#FFF1F2',
    RESUBMITTED: '#EBF3FE',
    CANCELLED: '#F2F4F6',
  }
  return map[status] ?? '#F2F4F6'
}

export function genDocNumber(category: string): string {
  const codeMap: Record<string, string> = {
    '출장': 'BT',
    '인사': 'HR',
    '회계': 'ACC',
  }
  const code = codeMap[category] ?? 'DOC'
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const rand = String(Math.floor(Math.random() * 9000) + 1000)
  return `${code}-${ym}-${rand}`
}

export function getLastMonths(count: number): { year: number; month: number; label: string }[] {
  const result = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: getMonthLabel(d.getFullYear(), d.getMonth() + 1),
    })
  }
  return result
}
