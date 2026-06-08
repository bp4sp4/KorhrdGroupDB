import { NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getAnnualGrant, parseJoinDate, birthdayBonus } from '@/lib/leave/seniority'

// transactions.reason 에서 "{type} 사용 (YYYY-MM-DD~YYYY-MM-DD)" 파싱
function parseUsageReason(
  reason: string,
): { date: string | null; end: string | null; type_full: string | null } {
  const m = reason.match(/^(.+?)\s*사용\s*\((\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})\)/)
  if (!m) return { date: null, end: null, type_full: null }
  return { type_full: m[1].trim(), date: m[2], end: m[3] }
}

function shortenType(typeFull: string): string {
  if (typeFull.startsWith('반차')) return '반차'
  return typeFull
}

// GET /api/leave-balances/me — 본인 휴가 잔여 (자동 발생 + 수동 부여 - 사용)
export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  // 입사일 + 생년월일
  const { data: hr } = await supabaseAdmin
    .from('hr_records')
    .select('joined_at, birth_date')
    .eq('user_id', appUser.id)
    .maybeSingle()

  const joinedDate = parseJoinDate(hr?.joined_at as string | undefined)
  const birthDate = parseJoinDate(hr?.birth_date as string | undefined)
  const today = new Date()
  const autoGrant = joinedDate ? getAnnualGrant(joinedDate, today) : 0
  const birthdayGrant = birthdayBonus(joinedDate, birthDate, today)

  // 이력
  const { data: transactions } = await supabaseAdmin
    .from('leave_transactions')
    .select('id, delta, reason, approval_id, created_at')
    .eq('user_id', appUser.id)
    .order('created_at', { ascending: false })

  let manualGrant = 0
  let used = 0
  interface UsageEntry {
    date: string
    end: string
    type_short: string
    type_full: string
    delta: number
    reason: string
    created_at: string
  }
  const usageList: UsageEntry[] = []
  for (const t of transactions ?? []) {
    const d = Number(t.delta)
    if (d > 0) {
      manualGrant += d
    } else if (d < 0) {
      used += Math.abs(d)
    }
    // 사용 이력(d <= 0)에서 reason 파싱 → 사용일자 목록 (사유 포함)
    if (d <= 0) {
      const reasonStr = (t.reason as string) ?? ''
      const createdAt = (t.created_at as string) ?? ''
      const { date, end, type_full } = parseUsageReason(reasonStr)
      if (date && type_full) {
        usageList.push({
          date,
          end: end ?? date,
          type_short: shortenType(type_full),
          type_full,
          delta: Math.abs(d),
          reason: reasonStr,
          created_at: createdAt,
        })
      } else if (d < 0) {
        // 파싱되지 않는 수동 차감 (관리자 직접 조정 등) — 처리일 기준 + 사유 원문
        const dateOnly = createdAt.slice(0, 10)
        usageList.push({
          date: dateOnly,
          end: dateOnly,
          type_short: '휴가 사용',
          type_full: '휴가 사용',
          delta: Math.abs(d),
          reason: reasonStr,
          created_at: createdAt,
        })
      }
    }
  }

  // 사용일자는 최신순(내림차순)
  usageList.sort((a, b) => b.date.localeCompare(a.date))

  const balance = autoGrant + birthdayGrant + manualGrant - used

  return NextResponse.json({
    balance,
    auto_grant: autoGrant,
    birthday_grant: birthdayGrant,
    manual_grant: manualGrant,
    used,
    joined_at: (hr?.joined_at as string | null) ?? null,
    birth_date: (hr?.birth_date as string | null) ?? null,
    usage_list: usageList,
  })
}
