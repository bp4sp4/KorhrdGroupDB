import { NextRequest, NextResponse } from 'next/server'
import { requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

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
  attachment_url?: string | null
  attachment_name?: string | null
}
interface CertItem {
  name?: string | null
  grade?: string | null
  number?: string | null
  issued_at?: string | null
  issuer?: string | null
}

interface PatchBody {
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

// GET /api/admin/hr-records/[id] — 단일 카드 상세 (작성자 이름 포함)
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { errorResponse } = await requireMasterAdmin()
  if (errorResponse) return errorResponse

  const { id } = await context.params

  const { data, error } = await supabaseAdmin
    .from('hr_records')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: '카드를 찾을 수 없습니다.' }, { status: 404 })
  }

  const { data: user } = await supabaseAdmin
    .from('app_users')
    .select('username, display_name')
    .eq('id', data.user_id)
    .maybeSingle()

  return NextResponse.json({
    record: {
      ...data,
      author_name: user?.display_name ?? null,
      author_email: user?.username ?? null,
    },
  })
}

// PATCH /api/admin/hr-records/[id] — master-admin이 카드 내용 수정
// status/submitted_at/reviewed_at 등 워크플로우 필드는 건드리지 않음 (승인/반려 endpoint에서만)
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { errorResponse } = await requireMasterAdmin()
  if (errorResponse) return errorResponse

  const { id } = await context.params
  const body = (await request.json()) as PatchBody

  const allowed: (keyof PatchBody)[] = [
    'profile_image_url',
    'name_ko',
    'name_en',
    'gender',
    'rrn',
    'birth_date',
    'company_name',
    'joined_at',
    'company_address',
    'current_address',
    'phone',
    'work_phone',
    'email',
    'emergency_phone',
    'emergency_relation',
    'bank_name',
    'account_number',
    'account_holder',
    'education',
    'career',
    'certificates',
  ]

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  for (const f of allowed) {
    if (f in body) payload[f] = body[f]
  }

  const { data, error } = await supabaseAdmin
    .from('hr_records')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ record: data })
}
