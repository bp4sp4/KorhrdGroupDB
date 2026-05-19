import { NextRequest, NextResponse } from 'next/server'
import { requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

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
