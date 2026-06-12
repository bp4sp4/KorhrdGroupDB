import { supabaseAdmin } from '@/lib/supabase/admin'

// 전사 분기 매출 합산 (원 단위) — 사업본부 KPI 실적
// 매출파일 3종(cert_sales / edu_sales / practice_sales)의 결제일 기준 합산.
// overlay 의 total_amount 가 null/0 이면 base 테이블 금액으로 fallback
// (getMonthlySales 와 동일한 규칙, 담당자 필터 없이 전체 합산)

const PAGE = 1000

type SalesRow = {
  total_amount: number | null
  [k: string]: unknown
}

function pickNumber(
  base: Record<string, unknown> | Record<string, unknown>[] | null | undefined,
  field: string,
): number {
  const row = Array.isArray(base) ? base[0] : base
  const v = row?.[field]
  return typeof v === 'number' ? v : Number(v) || 0
}

function sumRows(
  rows: SalesRow[] | null,
  fallbackKey: string,
  fallbackField: string,
): number {
  if (!rows) return 0
  let sum = 0
  for (const r of rows) {
    const overlayAmt = Number(r.total_amount) || 0
    const amt =
      overlayAmt > 0
        ? overlayAmt
        : pickNumber(
            r[fallbackKey] as
              | Record<string, unknown>
              | Record<string, unknown>[]
              | null
              | undefined,
            fallbackField,
          )
    if (amt > 0) sum += amt
  }
  return sum
}

/** 페이지네이션 조회 — supabase 1회 1000행 제한 대응 */
async function fetchAll(
  build: (from: number, to: number) => PromiseLike<{
    data: SalesRow[] | null
    error: unknown
  }>,
): Promise<SalesRow[]> {
  const out: SalesRow[] = []
  for (let page = 0; page < 50; page++) {
    const { data, error } = await build(page * PAGE, page * PAGE + PAGE - 1)
    if (error || !data) break
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

/** 분기 전사 매출 합계 (원) */
export async function getQuarterCompanySales(
  year: number,
  quarter: number,
): Promise<number> {
  const pad = (n: number) => String(n).padStart(2, '0')
  const firstMonth = quarter * 3 - 2
  const lastMonth = quarter * 3
  const start = `${year}-${pad(firstMonth)}-01`
  const lastDay = new Date(year, lastMonth, 0).getDate()
  const end = `${year}-${pad(lastMonth)}-${pad(lastDay)}`

  const [certRows, eduRows, pracRows] = await Promise.all([
    fetchAll((from, to) =>
      supabaseAdmin
        .from('cert_sales')
        .select('total_amount, certificate_applications(amount)')
        .gte('payment_date', start)
        .lte('payment_date', end)
        .eq('is_hidden', false)
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabaseAdmin
        .from('edu_sales')
        .select('total_amount, edu_students(cost)')
        .gte('payment_date', start)
        .lte('payment_date', end)
        .range(from, to),
    ),
    fetchAll((from, to) =>
      supabaseAdmin
        .from('practice_sales')
        .select('total_amount, practice_applications(payment_amount)')
        .gte('payment_date', start)
        .lte('payment_date', end)
        .range(from, to),
    ),
  ])

  return (
    sumRows(certRows, 'certificate_applications', 'amount') +
    sumRows(eduRows, 'edu_students', 'cost') +
    sumRows(pracRows, 'practice_applications', 'payment_amount')
  )
}
