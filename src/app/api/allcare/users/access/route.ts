import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { allcareAdmin } from '@/lib/supabase/allcare'

export async function POST(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { userId, access } = await request.json()

  if (!userId || typeof access !== 'boolean') {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const { error } = await allcareAdmin
    .from('users')
    .update({ practice_matching_access: access })
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ error: '변경에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
