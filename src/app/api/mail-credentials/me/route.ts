import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { encryptMailPassword } from '@/lib/crypto/mailPassword'
import { testImapConnection } from '@/lib/imapMail'

// GET /api/mail-credentials/me — 본인 자격증명 (비밀번호 제외)
export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const { data, error } = await supabaseAdmin
    .from('mail_credentials')
    .select(
      'email, sender_name, imap_host, imap_port, smtp_host, smtp_port, use_tls, provider, created_at, updated_at',
    )
    .eq('user_id', appUser.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ credentials: data ?? null })
}

// PUT /api/mail-credentials/me — 등록/수정 (IMAP 연결 테스트 후 저장)
// body: { email, password, imap_host?, imap_port?, smtp_host?, smtp_port?, use_tls? }
export async function PUT(req: NextRequest) {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '잘못된 요청 본문' }, { status: 400 })
  }

  const email = String((body as Record<string, unknown>).email ?? '').trim()
  const password = String((body as Record<string, unknown>).password ?? '')
  if (!email || !password) {
    return NextResponse.json(
      { error: '이메일과 비밀번호는 필수입니다.' },
      { status: 400 },
    )
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: '올바른 이메일 형식이 아닙니다.' },
      { status: 400 },
    )
  }

  // 발신자 이름(선택) — 받는 사람 메일함에 표시할 이름. 빈 값이면 null 저장
  const senderNameRaw = String(
    (body as Record<string, unknown>).sender_name ?? '',
  ).trim()
  const sender_name = senderNameRaw.length > 0 ? senderNameRaw : null

  const imap_host = String(
    (body as Record<string, unknown>).imap_host ?? 'imap.daum.net',
  )
  const imap_port = Number((body as Record<string, unknown>).imap_port ?? 993)
  const smtp_host = String(
    (body as Record<string, unknown>).smtp_host ?? 'smtp.daum.net',
  )
  const smtp_port = Number((body as Record<string, unknown>).smtp_port ?? 465)
  const use_tls = Boolean(
    (body as Record<string, unknown>).use_tls ?? true,
  )

  // 1) IMAP 연결 테스트 (실패 시 저장 안 함)
  const test = await testImapConnection({
    email,
    password,
    imap_host,
    imap_port,
    smtp_host,
    smtp_port,
    use_tls,
  })
  if (!test.ok) {
    return NextResponse.json(
      {
        error: `IMAP 연결 실패: ${test.error}`,
        hint: '이메일/앱비밀번호/서버 주소를 다시 확인해주세요. IMAP 활성화 여부도 확인.',
      },
      { status: 400 },
    )
  }

  // 2) 암호화 후 upsert
  let password_encrypted: string
  try {
    password_encrypted = encryptMailPassword(password)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '암호화 실패' },
      { status: 500 },
    )
  }

  const payload = {
    user_id: appUser.id,
    email,
    sender_name,
    password_encrypted,
    imap_host,
    imap_port,
    smtp_host,
    smtp_port,
    use_tls,
    provider: 'daum-smartwork',
  }

  const { data, error } = await supabaseAdmin
    .from('mail_credentials')
    .upsert(payload, { onConflict: 'user_id' })
    .select('email, sender_name, imap_host, imap_port, smtp_host, smtp_port, use_tls, provider, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, credentials: data })
}

// DELETE /api/mail-credentials/me — 자격증명 삭제
export async function DELETE() {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const { error } = await supabaseAdmin
    .from('mail_credentials')
    .delete()
    .eq('user_id', appUser.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
