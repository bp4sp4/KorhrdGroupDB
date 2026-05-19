import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/hakjeom/duplicates?name=홍길동&phone=010-1234-5678&exclude_id=123
// 같은 이름 + 같은 전화번호(숫자 정규화)인 다른 행의 개수를 반환
export async function GET(req: NextRequest) {
  const { errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(req.url)
  const name = (searchParams.get('name') ?? '').trim()
  const phone = (searchParams.get('phone') ?? '').trim()
  const excludeIdRaw = searchParams.get('exclude_id')
  const excludeId = excludeIdRaw ? Number(excludeIdRaw) : null

  if (!name || !phone) {
    return NextResponse.json({ count: 0, items: [] })
  }

  // 이름 동일 + 본인 id 제외한 행 조회
  let query = supabaseAdmin
    .from('hakjeom_consultations')
    .select('id, name, contact, created_at')
    .eq('name', name)
  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 클라이언트 정규화(숫자만) 후 비교
  const targetDigits = phone.replace(/\D/g, '')
  if (!targetDigits) {
    return NextResponse.json({ count: 0, items: [] })
  }

  const matched = (data ?? []).filter(
    (r) => (r.contact ?? '').replace(/\D/g, '') === targetDigits,
  )

  return NextResponse.json({
    count: matched.length,
    items: matched.map((r) => ({
      id: r.id as number,
      name: r.name as string,
      contact: (r.contact as string | null) ?? null,
      created_at: (r.created_at as string | null) ?? null,
    })),
  })
}
