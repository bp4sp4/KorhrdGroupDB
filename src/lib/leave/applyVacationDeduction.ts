import { supabaseAdmin } from '@/lib/supabase/admin'
import { differenceInCalendarDays, parse, isValid } from 'date-fns'

// 휴가 종류별 차감 단위 (휴가 신청서 양식과 동기화)
// - 연차: 1.0 × (종료일 - 시작일 + 1)
// - 반차(오전/오후): 0.5 (기간 무관)
// - 경조휴가/예비군/병가: 차감 없음
export function calcVacationDeduction(
  vacationType: string | null | undefined,
  start: string | null | undefined,
  end: string | null | undefined,
): number {
  if (!vacationType) return 0
  if (vacationType === '연차') {
    return calcDays(start ?? '', end ?? '')
  }
  if (vacationType === '반차(오전)' || vacationType === '반차(오후)') {
    return 0.5
  }
  return 0
}

function calcDays(start: string, end: string): number {
  if (!start) return 0
  const s = parse(start, 'yyyy-MM-dd', new Date())
  const e = end ? parse(end, 'yyyy-MM-dd', new Date()) : s
  if (!isValid(s) || !isValid(e)) return 0
  return Math.max(0, differenceInCalendarDays(e, s) + 1)
}

interface VacationContent {
  vacation_type?: string | null
  vacation_start?: string | null
  vacation_end?: string | null
}

interface ApprovalSnapshot {
  id: string
  document_type: string | null
  applicant_id: number | null
  content: Record<string, unknown> | null
}

/**
 * 결재 승인 시 휴가 일수 자동 차감.
 * - document_type 이 '휴가신청서' 가 아니면 무시
 * - 이미 같은 approval_id 로 차감 이력이 있으면 중복 차감 방지 (idempotent)
 * - 차감량이 0이면(경조/예비군/병가) 트랜잭션 기록만 추가하지 않고 skip
 *
 * @returns { deducted: number, balance: number | null } 차감한 일수와 처리 후 잔여
 */
export async function applyVacationDeduction(
  approval: ApprovalSnapshot,
): Promise<{ deducted: number; balance: number | null }> {
  const docType = (approval.document_type ?? '').replace(/\s/g, '')
  if (docType !== '휴가신청서') return { deducted: 0, balance: null }
  if (!approval.applicant_id) return { deducted: 0, balance: null }

  const content = (approval.content ?? {}) as VacationContent
  const deduct = calcVacationDeduction(
    content.vacation_type,
    content.vacation_start,
    content.vacation_end,
  )
  if (deduct <= 0) return { deducted: 0, balance: null }

  // 중복 차감 방지 — 동일 approval_id로 이미 차감 이력이 있으면 skip
  const { data: existing } = await supabaseAdmin
    .from('leave_transactions')
    .select('id')
    .eq('approval_id', approval.id)
    .maybeSingle()
  if (existing) return { deducted: 0, balance: null }

  // 현재 잔여 조회 → 차감 후 upsert
  const { data: current } = await supabaseAdmin
    .from('leave_balances')
    .select('balance')
    .eq('user_id', approval.applicant_id)
    .maybeSingle()

  const before = Number(current?.balance ?? 0)
  const after = before - deduct

  await supabaseAdmin
    .from('leave_balances')
    .upsert(
      {
        user_id: approval.applicant_id,
        balance: after,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  // 이력 기록
  const reason = `${content.vacation_type ?? '휴가'} 사용 (${content.vacation_start ?? '-'}~${content.vacation_end ?? '-'})`
  await supabaseAdmin.from('leave_transactions').insert({
    user_id: approval.applicant_id,
    delta: -deduct,
    reason,
    approval_id: approval.id,
    created_by: null, // 시스템 자동 차감
  })

  return { deducted: deduct, balance: after }
}
