import { NextResponse } from 'next/server'
import { requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getAnnualGrant, parseJoinDate } from '@/lib/leave/seniority'

interface UsageEntry {
  date: string // YYYY-MM-DD (시작일)
  type_short: string // "연차" | "반차"
  type_full: string // 원문 vacation_type
  delta: number // 차감량 (양수, 절댓값)
}

// transactions.reason 에서 "{type} 사용 (YYYY-MM-DD~YYYY-MM-DD)" 형식 파싱
function parseUsageReason(
  reason: string,
): { date: string | null; type_full: string | null } {
  const m = reason.match(/^(.+?)\s*사용\s*\((\d{4}-\d{2}-\d{2})~/)
  if (!m) return { date: null, type_full: null }
  return { type_full: m[1].trim(), date: m[2] }
}

function shortenType(typeFull: string): string {
  if (typeFull.startsWith('반차')) return '반차'
  return typeFull
}

// GET /api/admin/leave-balances — 모든 사용자 + 발생/사용/잔여/사용일자
export async function GET() {
  const { errorResponse } = await requireMasterAdmin()
  if (errorResponse) return errorResponse

  const today = new Date()

  // 사용자 + 직급/부서
  const { data: users, error } = await supabaseAdmin
    .from('app_users')
    .select('id, username, display_name, role, position_id, department_id')
    .order('display_name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = (users ?? []).map((u) => u.id as number)
  if (userIds.length === 0) {
    return NextResponse.json({ items: [] })
  }

  // 입사일 (hr_records.joined_at)
  const { data: hrRecords } = await supabaseAdmin
    .from('hr_records')
    .select('user_id, joined_at')
    .in('user_id', userIds)
  const joinedMap = new Map<number, string | null>()
  for (const r of hrRecords ?? []) {
    joinedMap.set(r.user_id as number, (r.joined_at as string | null) ?? null)
  }

  // 거래 이력 — 전체 (사용자별 합계 + 사용일자 추출)
  const { data: txs } = await supabaseAdmin
    .from('leave_transactions')
    .select('user_id, delta, reason, approval_id, created_at')
    .in('user_id', userIds)
    .order('created_at', { ascending: true })

  // 사용자별 집계
  const manualGrantMap = new Map<number, number>() // 어드민이 부여한 양수 delta 합계
  const usageMap = new Map<number, number>() // 음수 delta 절댓값 합계
  const usageListMap = new Map<number, UsageEntry[]>()
  for (const t of txs ?? []) {
    const uid = t.user_id as number
    const delta = Number(t.delta)
    if (delta > 0) {
      manualGrantMap.set(uid, (manualGrantMap.get(uid) ?? 0) + delta)
    } else if (delta < 0) {
      const used = Math.abs(delta)
      usageMap.set(uid, (usageMap.get(uid) ?? 0) + used)
      // reason 파싱이 성공하면 사용일자 목록에 추가 (수동 입력 + 결재 자동 차감 모두 포함)
      const { date, type_full } = parseUsageReason((t.reason as string) ?? '')
      if (date && type_full) {
        const list = usageListMap.get(uid) ?? []
        list.push({
          date,
          type_short: shortenType(type_full),
          type_full,
          delta: used,
        })
        usageListMap.set(uid, list)
      }
    }
  }

  // 직급/부서 매핑
  const positionIds = Array.from(
    new Set((users ?? []).map((u) => u.position_id).filter(Boolean) as string[]),
  )
  const departmentIds = Array.from(
    new Set((users ?? []).map((u) => u.department_id).filter(Boolean) as string[]),
  )
  const positionMap = new Map<string, string>()
  const departmentMap = new Map<string, string>()
  if (positionIds.length) {
    const { data: positions } = await supabaseAdmin
      .from('positions')
      .select('id, name')
      .in('id', positionIds)
    for (const p of positions ?? []) positionMap.set(p.id as string, p.name as string)
  }
  if (departmentIds.length) {
    const { data: departments } = await supabaseAdmin
      .from('departments')
      .select('id, name')
      .in('id', departmentIds)
    for (const d of departments ?? []) departmentMap.set(d.id as string, d.name as string)
  }

  const items = (users ?? []).map((u) => {
    const uid = u.id as number
    const joinedAt = joinedMap.get(uid) ?? null
    const joinedDate = parseJoinDate(joinedAt)
    const autoGrant = joinedDate ? getAnnualGrant(joinedDate, today) : 0
    const manualGrant = manualGrantMap.get(uid) ?? 0
    const granted = autoGrant + manualGrant
    const used = usageMap.get(uid) ?? 0
    const balance = granted - used
    // 사용일자는 최신순(내림차순) 정렬
    const usageList = (usageListMap.get(uid) ?? []).slice().sort((a, b) =>
      b.date.localeCompare(a.date),
    )

    return {
      user_id: uid,
      username: (u.username as string) ?? null,
      display_name: (u.display_name as string) ?? null,
      role: (u.role as string) ?? null,
      position_name: u.position_id ? positionMap.get(u.position_id as string) ?? null : null,
      department_name: u.department_id ? departmentMap.get(u.department_id as string) ?? null : null,
      joined_at: joinedAt,
      auto_grant: autoGrant,
      manual_grant: manualGrant,
      granted, // 발생 (자동 + 수동)
      used,
      balance,
      usage_list: usageList,
    }
  })

  return NextResponse.json({ items })
}
