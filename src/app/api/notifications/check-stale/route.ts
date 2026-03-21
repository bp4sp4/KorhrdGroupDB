import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'

// GET: 방치된 상담 체크 & 알림 생성 (기본 3일)
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.errorResponse) return auth.errorResponse

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '3', 10)

  const { data, error } = await supabaseAdmin.rpc('check_stale_consultations', {
    stale_days: days,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ created: data })
}
