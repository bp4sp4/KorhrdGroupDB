import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCalendarWeekIndex } from '@/lib/dashboard/weekOfMonth'

// 담당자(manager_name == display_name) 기준 월 매출 합계 (만원 단위)
// 매출파일 3종(cert_sales / edu_sales / practice_sales)의 결제일 기준 합산.
// overlay 의 total_amount 가 null 이면 base 테이블의 금액으로 fallback:
//   cert_sales.total_amount       → certificate_applications.amount
//   edu_sales.total_amount        → edu_students.cost
//   practice_sales.total_amount   → practice_applications.payment_amount

export interface MonthlySales {
  /** 월 합계 (만원) */
  total: number
  /** 주차별 합계 (만원) — 달력 주차(월~일), 6주차는 5주차로 합산 */
  weeks: number[]
}

export async function getMonthlySales(
  displayName: string,
  year: number,
  month: number,
): Promise<MonthlySales> {
  const pad = (n: number) => String(n).padStart(2, '0')
  const monthStart = `${year}-${pad(month)}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`

  const [certRes, eduRes, pracRes] = await Promise.allSettled([
    supabaseAdmin
      .from('cert_sales')
      .select('total_amount, payment_date, certificate_applications(amount)')
      .eq('manager_name', displayName)
      .gte('payment_date', monthStart)
      .lte('payment_date', monthEnd)
      .eq('is_hidden', false),
    supabaseAdmin
      .from('edu_sales')
      .select('total_amount, payment_date, edu_students(cost)')
      .eq('manager_name', displayName)
      .gte('payment_date', monthStart)
      .lte('payment_date', monthEnd),
    supabaseAdmin
      .from('practice_sales')
      .select(
        'total_amount, payment_date, practice_applications(payment_amount)',
      )
      .eq('manager_name', displayName)
      .gte('payment_date', monthStart)
      .lte('payment_date', monthEnd),
  ])

  const weeks = [0, 0, 0, 0, 0]
  let totalWon = 0

  // base 객체는 단일 객체 또는 배열(supabase 응답 양식 차이) 모두 처리
  const pickNumber = (
    base: Record<string, unknown> | Record<string, unknown>[] | null | undefined,
    field: string,
  ): number => {
    const row = Array.isArray(base) ? base[0] : base
    const v = row?.[field]
    return typeof v === 'number' ? v : Number(v) || 0
  }

  const accumulate = (
    rows:
      | {
          total_amount: number | null
          payment_date: string | null
          [k: string]: unknown
        }[]
      | null,
    fallbackKey: string,
    fallbackField: string,
  ) => {
    if (!rows) return
    for (const r of rows) {
      const overlayAmt = Number(r.total_amount) || 0
      const fallbackAmt =
        overlayAmt > 0
          ? 0
          : pickNumber(
              r[fallbackKey] as
                | Record<string, unknown>
                | Record<string, unknown>[]
                | null
                | undefined,
              fallbackField,
            )
      const amt = overlayAmt > 0 ? overlayAmt : fallbackAmt
      if (amt <= 0 || !r.payment_date) continue
      totalWon += amt
      const day = parseInt(r.payment_date.slice(8, 10), 10)
      if (!day) continue
      const idx = getCalendarWeekIndex(year, month, day)
      weeks[idx] += amt
    }
  }

  if (certRes.status === 'fulfilled' && !certRes.value.error) {
    accumulate(certRes.value.data as never, 'certificate_applications', 'amount')
  }
  if (eduRes.status === 'fulfilled' && !eduRes.value.error) {
    accumulate(eduRes.value.data as never, 'edu_students', 'cost')
  }
  if (pracRes.status === 'fulfilled' && !pracRes.value.error) {
    accumulate(
      pracRes.value.data as never,
      'practice_applications',
      'payment_amount',
    )
  }

  // 원 → 만원 변환
  const toManwon = (won: number) => Math.round(won / 10000)
  return { total: toManwon(totalWon), weeks: weeks.map(toManwon) }
}
