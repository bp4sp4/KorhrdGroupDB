import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// 영업 직원 상담 가능/불가능 — 수동 토글 (담당자 배정 참고용)
//   저장: app_settings key = presence.consult_available.{uid}  value = { available: boolean }
//   기본값(키 없음) = 상담 가능(true)
//   변경 권한: master-admin / 관리자(is_division_admin) / 본인

const keyOf = (uid: number) => `presence.consult_available.${uid}`

async function salesMembers() {
  const { data: teamRows } = await supabaseAdmin.from('teams').select('id, name')
  const salesTeamIds = (teamRows ?? [])
    .filter((t) => ((t.name as string) ?? '').includes('영업'))
    .map((t) => t.id as string)
  if (salesTeamIds.length === 0) return []
  const { data } = await supabaseAdmin
    .from('app_users')
    .select('id, display_name')
    .eq('is_active', true)
    .neq('role', 'guest')
    .in('team_id', salesTeamIds)
  return (data ?? []).map((u) => ({
    id: u.id as number,
    name: ((u.display_name as string) ?? '').trim(),
  }))
}

// GET → { roster: [{ userId, name, available }], canEditAll, myId }
export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const members = await salesMembers()
  const keys = members.map((m) => keyOf(m.id))
  const byKey = new Map<string, unknown>()
  if (keys.length > 0) {
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', keys)
    for (const s of settings ?? []) byKey.set(s.key as string, s.value)
  }

  const roster = members
    .map((m) => {
      const v = byKey.get(keyOf(m.id)) as { available?: unknown } | undefined
      const available = typeof v?.available === 'boolean' ? v.available : true
      return { userId: m.id, name: m.name, available }
    })
    // 이름 고정 정렬 — 상담 가능/불가가 바뀌어도 칩 위치가 움직이지 않게
    // (available 우선 정렬 시 토글할 때마다 순서가 튐)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  return NextResponse.json(
    {
      roster,
      canEditAll: appUser.role === 'master-admin' || !!appUser.is_division_admin,
      myId: appUser.id,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

// POST { userId, available } → 토글 저장
export async function POST(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  let body: { userId?: unknown; available?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }
  const userId =
    typeof body.userId === 'number' ? body.userId : Number(body.userId)
  const available = !!body.available
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: '잘못된 대상입니다.' }, { status: 400 })
  }

  const canEdit =
    appUser.role === 'master-admin' ||
    !!appUser.is_division_admin ||
    appUser.id === userId
  if (!canEdit) {
    return NextResponse.json(
      { error: '상태 변경 권한이 없습니다.' },
      { status: 403 },
    )
  }

  const { error } = await supabaseAdmin.from('app_settings').upsert(
    {
      key: keyOf(userId),
      value: { available },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  )
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, userId, available })
}
