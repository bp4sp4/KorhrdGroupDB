import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// 허용된 journal_form 값 화이트리스트 — DB 에 임의 문자열이 들어오지 않도록 검증
const ALLOWED_JOURNAL_FORMS = new Set(['default', 'academic', 'practicum'])

export async function GET() {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('id, department_id, code, name, journal_form, sort_order, is_active, leader_user_id, created_at')
    .order('sort_order')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const body = await request.json()
  const { department_id, code, name, journal_form, sort_order, leader_user_id } = body as {
    department_id: string
    code: string
    name: string
    journal_form?: string
    sort_order?: number
    leader_user_id?: number | null
  }

  if (!department_id || !code || !name) {
    return NextResponse.json(
      { error: 'department_id, code, name 은 필수입니다.' },
      { status: 400 },
    )
  }

  const form = journal_form ?? 'default'
  if (!ALLOWED_JOURNAL_FORMS.has(form)) {
    return NextResponse.json(
      { error: `허용되지 않은 journal_form 값입니다. (${[...ALLOWED_JOURNAL_FORMS].join(', ')})` },
      { status: 400 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from('teams')
    .insert({
      department_id,
      code: code.toUpperCase(),
      name,
      journal_form: form,
      sort_order: sort_order ?? 0,
      leader_user_id: typeof leader_user_id === 'number' ? leader_user_id : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
