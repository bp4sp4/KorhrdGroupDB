import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/app-settings?key=xxx
// 인증된 사용자 누구나 읽기 가능
export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  if (!key) {
    return NextResponse.json({ error: 'key 파라미터가 필요합니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .select('key, value, updated_at')
    .eq('key', key)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ key, value: data?.value ?? null, updated_at: data?.updated_at ?? null })
}
