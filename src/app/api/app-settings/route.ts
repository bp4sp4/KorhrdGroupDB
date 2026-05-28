import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// 인증 사용자 누구나 upsert 가능한 화이트리스트 key 패턴 — 본인 user_id 일치 시만 허용.
// (master-admin 전용 키는 /api/admin/app-settings 에서만 갱신)
//
// 1) dashboard.monthly_goal.{user_id}.{YYYY-MM} — 대시보드 이번달 목표
// 2) user.{user_id}.weekly_goal.{YYYY-MM-DD}   — 학사팀 등 이번주 목표
//    (YYYY-MM-DD = 그 주의 월요일. 월요일마다 새 키가 되어 자동 초기화)
const USER_WRITABLE_KEY_PATTERNS: RegExp[] = [
  /^dashboard\.monthly_goal\.(\d+)\.\d{4}-\d{2}$/,
  /^user\.(\d+)\.weekly_goal\.\d{4}-\d{2}-\d{2}$/,
]

function isUserWritableKey(key: string, currentUserId: number | null): boolean {
  if (currentUserId == null) return false
  return USER_WRITABLE_KEY_PATTERNS.some((re) => {
    const m = key.match(re)
    return !!m && parseInt(m[1], 10) === currentUserId
  })
}

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

// POST /api/app-settings
// body: { key: string, value: unknown }
// 인증된 사용자가 USER_WRITABLE_KEY_PATTERNS 에 해당하는 key 만 upsert 가능.
export async function POST(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const body = (await request.json()) as { key?: string; value?: unknown }
  const key = (body.key ?? '').trim()
  if (!key) {
    return NextResponse.json({ error: 'key가 필요합니다.' }, { status: 400 })
  }
  if (!('value' in body)) {
    return NextResponse.json({ error: 'value가 필요합니다.' }, { status: 400 })
  }
  if (!isUserWritableKey(key, appUser?.id ?? null)) {
    return NextResponse.json(
      { error: '해당 key 에 대한 쓰기 권한이 없습니다.' },
      { status: 403 },
    )
  }

  const payload: Record<string, unknown> = {
    key,
    value: body.value,
    updated_at: new Date().toISOString(),
  }
  if (appUser?.id != null) payload.updated_by = appUser.id

  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .upsert(payload, { onConflict: 'key' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
