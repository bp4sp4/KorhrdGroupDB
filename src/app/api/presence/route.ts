import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// last_seen 이 이 시간보다 오래되면 자리비움으로 간주 (탭 닫힘·꺼짐 포함)
const STALE_MS = 4 * 60 * 1000

// POST /api/presence — 내 상태(활동중/자리비움) 하트비트
export async function POST(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as {
    state?: string
  } | null
  const state = body?.state === 'away' ? 'away' : 'active'

  const { error } = await supabaseAdmin.from('user_presence').upsert(
    { user_id: appUser.id, state, last_seen: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// GET /api/presence — 전체 직원 활동 상태
//   기본: { now, users: { [userId]: {state,lastSeen,away} }, byName }
//   ?roster=1: 활동 현황 페이지용 전체 직원 명단(roster) 추가
export async function GET(request: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse
  if (!appUser || appUser.role === 'guest') {
    return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
  }
  const wantRoster = request.nextUrl.searchParams.get('roster') === '1'

  const { data, error } = await supabaseAdmin
    .from('user_presence')
    .select('user_id, state, last_seen')
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // user_id → display_name (이름 기준 조회용)
  const ids = (data ?? []).map((r) => r.user_id as number)
  const nameById = new Map<number, string>()
  if (ids.length > 0) {
    const { data: usersRows } = await supabaseAdmin
      .from('app_users')
      .select('id, display_name')
      .in('id', ids)
    for (const u of usersRows ?? [])
      nameById.set(u.id as number, ((u.display_name as string) ?? '').trim())
  }

  const nowMs = Date.now()
  const users: Record<
    number,
    { state: string; lastSeen: string; away: boolean }
  > = {}
  // 이름 → away (이름이 같은 사람이 여럿이면 한 명이라도 활동중이면 활동중)
  const byName: Record<string, boolean> = {}
  for (const r of data ?? []) {
    const lastSeen = r.last_seen as string
    const stale = nowMs - new Date(lastSeen).getTime() > STALE_MS
    const away = r.state === 'away' || stale
    users[r.user_id as number] = { state: r.state as string, lastSeen, away }
    const name = nameById.get(r.user_id as number)
    if (name) byName[name] = (byName[name] ?? true) && away
  }

  let roster:
    | {
        userId: number
        name: string
        team: string | null
        status: 'active' | 'away' | 'offline'
        lastSeen: string | null
      }[]
    | undefined
  if (wantRoster) {
    const [{ data: usersRows }, { data: teamRows }] = await Promise.all([
      supabaseAdmin
        .from('app_users')
        .select('id, display_name, team_id')
        .eq('is_active', true)
        .neq('role', 'guest')
        .neq('role', 'mini-admin'),
      supabaseAdmin.from('teams').select('id, name'),
    ])
    const teamName = new Map(
      (teamRows ?? []).map((t) => [t.id as string, t.name as string]),
    )
    roster = (usersRows ?? [])
      .map((u) => {
        const p = users[u.id as number]
        const status: 'active' | 'away' | 'offline' = !p
          ? 'offline'
          : p.away
            ? 'away'
            : 'active'
        return {
          userId: u.id as number,
          name: ((u.display_name as string) ?? '').trim(),
          team: u.team_id ? (teamName.get(u.team_id as string) ?? null) : null,
          status,
          lastSeen: p?.lastSeen ?? null,
        }
      })
      .sort((a, b) => {
        const rank = { active: 0, away: 1, offline: 2 } as const
        return (
          rank[a.status] - rank[b.status] || a.name.localeCompare(b.name, 'ko')
        )
      })
  }

  return NextResponse.json(
    { now: new Date(nowMs).toISOString(), users, byName, roster },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
