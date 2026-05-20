import { NextRequest, NextResponse } from 'next/server'
import { requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { parseJoinDate } from '@/lib/leave/seniority'

// 생일 보너스 정책 도입일 (seniority.ts 와 동기화)
const BIRTHDAY_BONUS_CUTOFF = new Date(2026, 4, 19) // 2026-05-19

interface TxItem {
  id: string
  delta: number
  reason: string
  approval_id: string | null
  created_by: number | null
  created_by_name: string | null
  created_at: string
}

// 가상 생일 적립 row 생성 — 입사일 이후 + cutoff 이후 + 오늘 이전 생일마다 1건
function buildBirthdayBonusRows(
  joinedDate: Date | null,
  birthDate: Date | null,
  asOf: Date,
): TxItem[] {
  if (!joinedDate || !birthDate) return []
  const rows: TxItem[] = []
  for (let year = joinedDate.getFullYear(); year <= asOf.getFullYear(); year++) {
    const bd = new Date(year, birthDate.getMonth(), birthDate.getDate())
    if (bd < joinedDate) continue
    if (bd > asOf) continue
    if (bd < BIRTHDAY_BONUS_CUTOFF) continue
    const isoDate = `${bd.getFullYear()}-${String(bd.getMonth() + 1).padStart(2, '0')}-${String(bd.getDate()).padStart(2, '0')}`
    rows.push({
      id: `birthday-${year}`,
      delta: 0.5,
      reason: `${year}년 생일 자동 적립 (+0.5일)`,
      approval_id: null,
      created_by: null,
      created_by_name: '시스템',
      created_at: `${isoDate}T00:00:00+09:00`,
    })
  }
  return rows
}

// GET /api/admin/leave-balances/[userId]/transactions — 변동 이력 조회 (가상 생일 row 포함)
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const { errorResponse } = await requireMasterAdmin()
  if (errorResponse) return errorResponse

  const { userId } = await context.params
  const targetUserId = Number(userId)
  if (!Number.isFinite(targetUserId)) {
    return NextResponse.json({ error: '유효하지 않은 user_id' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('leave_transactions')
    .select('id, delta, reason, approval_id, created_by, created_at')
    .eq('user_id', targetUserId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // created_by 이름 매핑
  const creatorIds = Array.from(
    new Set((data ?? []).map((r) => r.created_by as number | null).filter(Boolean) as number[]),
  )
  const nameMap = new Map<number, string>()
  if (creatorIds.length) {
    const { data: users } = await supabaseAdmin
      .from('app_users')
      .select('id, display_name')
      .in('id', creatorIds)
    for (const u of users ?? []) nameMap.set(u.id as number, (u.display_name as string) ?? '')
  }

  const realItems: TxItem[] = (data ?? []).map((r) => ({
    id: r.id as string,
    delta: Number(r.delta),
    reason: r.reason as string,
    approval_id: (r.approval_id as string | null) ?? null,
    created_by: (r.created_by as number | null) ?? null,
    created_by_name: r.created_by ? nameMap.get(r.created_by as number) ?? null : null,
    created_at: r.created_at as string,
  }))

  // 입사일 + 생년월일 조회 → 생일 가상 row 생성
  const { data: hr } = await supabaseAdmin
    .from('hr_records')
    .select('joined_at, birth_date')
    .eq('user_id', targetUserId)
    .maybeSingle()

  const joined = parseJoinDate(hr?.joined_at as string | undefined)
  const birth = parseJoinDate(hr?.birth_date as string | undefined)
  const virtualBirthdayRows = buildBirthdayBonusRows(joined, birth, new Date())

  // 실제 + 가상 합치고 created_at 내림차순 정렬
  const items = [...realItems, ...virtualBirthdayRows].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )

  return NextResponse.json({ items })
}
