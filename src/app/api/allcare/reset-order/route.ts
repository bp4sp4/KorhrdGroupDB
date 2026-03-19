import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { allcareAdmin } from '@/lib/supabase/allcare'

export async function POST() {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  // PKG-, CUSTOM-, SUBS- 가 아닌 ORDER 유형 결제 삭제
  const { error, count } = await allcareAdmin
    .from('payments')
    .delete({ count: 'exact' })
    .not('order_id', 'like', 'PKG-%')
    .not('order_id', 'like', 'CUSTOM-%')
    .not('order_id', 'like', 'SUBS-%')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted: count })
}
