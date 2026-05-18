import { NextRequest, NextResponse } from 'next/server'
import { requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// POST /api/admin/app-settings
// body: { key: string, value: unknown }
// master-admin 전용 upsert
export async function POST(request: NextRequest) {
  const { appUser, errorResponse } = await requireMasterAdmin()
  if (errorResponse) return errorResponse

  const body = (await request.json()) as { key?: string; value?: unknown }
  const key = (body.key ?? '').trim()
  if (!key) {
    return NextResponse.json({ error: 'key가 필요합니다.' }, { status: 400 })
  }
  if (!('value' in body)) {
    return NextResponse.json({ error: 'value가 필요합니다.' }, { status: 400 })
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
