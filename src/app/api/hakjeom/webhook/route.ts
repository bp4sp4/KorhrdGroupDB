import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────────
// 외부 구글시트(당근 폼) → 학점은행제 문의 DB 자동 적재 웹훅
//   - Google Apps Script 가 폼 응답 즉시 이 엔드포인트로 POST 한다.
//   - 사용자 로그인이 아니라 공유 시크릿(HAKJEOM_WEBHOOK_SECRET)으로 인증.
//   - 대분류=당근 / 중분류=폼 → click_source = "당근_폼"
//   - 응답일시 → created_at(화면의 "등록일") 로 보존
//   - 이름+전화번호(숫자) 중복이면 적재하지 않고 skip (멱등 — 재전송돼도 안전)
// ─────────────────────────────────────────────────────────────────────────────

const TABLE = 'hakjeom_consultations'
const CLICK_SOURCE = '당근_폼'

// admin/master-admin 의 Supabase auth UUID 목록 (알림용, best-effort)
async function getAdminUids(): Promise<string[]> {
  const { data: admins } = await supabaseAdmin
    .from('app_users')
    .select('username')
    .in('role', ['admin', 'master-admin'])
  if (!admins?.length) return []
  const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  const emailToId = new Map((data?.users ?? []).map((u) => [u.email, u.id]))
  return admins
    .map((a) => emailToId.get(a.username as string))
    .filter((v): v is string => !!v)
}

export async function POST(request: NextRequest) {
  // 1) 시크릿 검증 — 헤더 우선, 없으면 body 의 secret
  const expected = process.env.HAKJEOM_WEBHOOK_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'HAKJEOM_WEBHOOK_SECRET 미설정' },
      { status: 500 },
    )
  }

  const body = (await request.json().catch(() => null)) as {
    secret?: string
    name?: string
    contact?: string
    education?: string
    respondedAt?: string
  } | null
  if (!body) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const provided = request.headers.get('x-webhook-secret') ?? body.secret ?? ''
  if (provided !== expected) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  // 2) 값 정리
  const name = (body.name ?? '').trim()
  const contact = (body.contact ?? '').trim()
  const education = (body.education ?? '').trim() || null
  if (!name || !contact) {
    return NextResponse.json(
      { error: '이름과 연락처는 필수입니다.' },
      { status: 400 },
    )
  }

  // 응답일시 → created_at (유효하지 않으면 현재시각)
  let createdAt = new Date().toISOString()
  if (body.respondedAt) {
    const t = new Date(body.respondedAt)
    if (!Number.isNaN(t.getTime())) createdAt = t.toISOString()
  }

  // 3) 중복 방지 — 이름 + 전화번호(숫자) 가 모두 일치하는 활성 행이 있으면 skip
  const phoneDigits = contact.replace(/\D/g, '')
  if (phoneDigits) {
    const { data: nameMatches } = await supabaseAdmin
      .from(TABLE)
      .select('id, contact')
      .eq('name', name)
      .is('deleted_at', null)
      .limit(50)
    const dup = (nameMatches ?? []).some(
      (r) => String(r.contact ?? '').replace(/\D/g, '') === phoneDigits,
    )
    if (dup) {
      return NextResponse.json({ ok: true, skipped: 'duplicate' })
    }
  }

  // 4) 적재
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .insert([
      {
        name,
        contact,
        education,
        click_source: CLICK_SOURCE,
        status: '상담대기',
        created_at: createdAt,
      },
    ])
    .select('id, name')
    .single()

  if (error) {
    console.error('[hakjeom webhook] insert 실패:', error)
    return NextResponse.json({ error: '적재 실패' }, { status: 500 })
  }

  // 5) 관리자 인앱 알림 (실패해도 응답에 영향 없음)
  getAdminUids()
    .then((uids) => {
      if (uids.length === 0) return
      return supabaseAdmin.from('notifications').insert(
        uids.map((uid) => ({
          user_id: uid,
          type: 'NEW_CONSULTATION',
          title: '새 학점은행제 상담 신청 (당근 폼)',
          message: `${data.name}님이 당근 폼으로 상담을 신청했습니다.`,
          link: `/hakjeom?highlight=${data.id}`,
          is_read: false,
        })),
      )
    })
    .catch(() => {})

  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
}
