import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { getMonthlySales } from '@/lib/dashboard/monthlySales'

// GET /api/dashboard/my-monthly-sales?year=YYYY&month=MM
// 본인이 담당자(manager_name == display_name)로 등록된 매출파일(cert_sales / edu_sales / practice_sales)
// 중 결제일이 해당 월에 포함되는 합계를 만원 단위로 반환.
//
// 응답: { total: number, weeks: [w1, w2, w3, w4, w5] }  (단위: 만원)
// 주차 분할 기준: 달력 주차(월~일) — 1일이 포함된 주 = 1주차. 6주차는 5주차로 합산.

export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const displayName = appUser.display_name?.trim()
  if (!displayName) {
    return NextResponse.json({ total: 0, weeks: [0, 0, 0, 0, 0] })
  }

  const sp = request.nextUrl.searchParams
  const now = new Date()
  const year = parseInt(sp.get('year') ?? '', 10) || now.getFullYear()
  const month = parseInt(sp.get('month') ?? '', 10) || now.getMonth() + 1

  const result = await getMonthlySales(displayName, year, month)

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
