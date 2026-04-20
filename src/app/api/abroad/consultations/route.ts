import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// 어드민에서 간편상담 수동 추가
// 모든 필드는 입력하지 않아도 됨 (빈 값 허용)
export async function POST(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const body = await request.json().catch(() => ({}))

  const payload = {
    name: String(body.name ?? '').trim() || '미입력',
    phone: String(body.phone ?? '').trim(),
    region: String(body.region ?? '').trim(),
    desired_start: String(body.desired_start ?? '').trim(),
    message: String(body.message ?? '').trim(),
    program: body.program ? String(body.program).trim() : null,
    privacy_agreed: true,
    status: 'pending',
    type: body.type === 'estimate' ? 'estimate' : 'consult',
  }

  const { data, error } = await supabaseAdmin
    .from('consultations')
    .insert(payload)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ consultation: data })
}

// DELETE /api/abroad/consultations - 일괄 삭제
export async function DELETE(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body.ids) ? body.ids.filter((v: unknown) => typeof v === 'string') : []

  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids 배열이 필요합니다.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('consultations')
    .delete()
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, count: ids.length })
}
