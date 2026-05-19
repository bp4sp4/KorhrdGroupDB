import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// 학력/경력/자격 jsonb 항목 타입 (느슨하게 받음)
interface EducationItem {
  school?: string | null
  start?: string | null
  end?: string | null
  degree?: string | null
  major?: string | null
}
interface CareerItem {
  org?: string | null
  position?: string | null
  work?: string | null
  start?: string | null
  end?: string | null
  months?: number | null
  notes?: string | null
}
interface CertItem {
  name?: string | null
  grade?: string | null
  number?: string | null
  issued_at?: string | null
  issuer?: string | null
}

interface UpsertBody {
  action?: 'save' | 'submit'
  profile_image_url?: string | null
  name_ko?: string | null
  name_en?: string | null
  gender?: 'male' | 'female' | null
  rrn?: string | null
  birth_date?: string | null
  company_name?: string | null
  joined_at?: string | null
  company_address?: string | null
  current_address?: string | null
  phone?: string | null
  work_phone?: string | null
  email?: string | null
  emergency_phone?: string | null
  emergency_relation?: string | null
  bank_name?: string | null
  account_number?: string | null
  account_holder?: string | null
  education?: EducationItem[]
  career?: CareerItem[]
  certificates?: CertItem[]
}

// GET /api/hr-records/me — 내 인사기록카드 조회 + 면제 플래그
export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  // 면제 여부 조회 (가드 우회용)
  const { data: userRow } = await supabaseAdmin
    .from('app_users')
    .select('hr_record_exempt')
    .eq('id', appUser.id)
    .maybeSingle()
  const exempt = Boolean(userRow?.hr_record_exempt)

  const { data, error } = await supabaseAdmin
    .from('hr_records')
    .select('*')
    .eq('user_id', appUser.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ record: data ?? null, exempt })
}

// POST /api/hr-records/me — 저장(draft) 또는 제출(submit)
export async function POST(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const body = (await request.json()) as UpsertBody
  const action = body.action ?? 'save'

  // 기존 행 확인 — 승인된 카드는 수정 불가 (어드민이 다시 status 변경해야 함)
  const { data: existing } = await supabaseAdmin
    .from('hr_records')
    .select('id, status')
    .eq('user_id', appUser.id)
    .maybeSingle()

  if (existing?.status === 'approved') {
    return NextResponse.json(
      { error: '이미 승인된 인사기록카드는 수정할 수 없습니다. 관리자에게 문의하세요.' },
      { status: 403 },
    )
  }

  // payload 정리 — undefined는 제외, null은 허용
  const fields: (keyof UpsertBody)[] = [
    'profile_image_url',
    'name_ko', 'name_en', 'gender', 'rrn', 'birth_date',
    'company_name', 'joined_at', 'company_address', 'current_address',
    'phone', 'work_phone', 'email', 'emergency_phone', 'emergency_relation',
    'bank_name', 'account_number', 'account_holder',
    'education', 'career', 'certificates',
  ]
  const payload: Record<string, unknown> = { user_id: appUser.id }
  for (const f of fields) {
    if (f in body) payload[f] = body[f]
  }

  // 제출 시 상태 변경 + 시간 기록 / 반려된 카드 재제출도 동일하게 'submitted'
  if (action === 'submit') {
    payload.status = 'submitted'
    payload.submitted_at = new Date().toISOString()
    payload.reject_reason = null
  } else {
    // 저장만 — 기존 상태가 rejected이면 그대로 두고, 없으면 draft
    if (!existing) payload.status = 'draft'
  }
  payload.updated_at = new Date().toISOString()

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('hr_records')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ record: data })
  } else {
    const { data, error } = await supabaseAdmin
      .from('hr_records')
      .insert(payload)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ record: data }, { status: 201 })
  }
}
