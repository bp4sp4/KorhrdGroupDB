import { supabaseAdmin } from './supabase/admin'

const SYLLABLES = [
  '가', '나', '다', '라', '마', '바', '사', '아', '자', '차',
  '강', '랑', '망', '방', '상', '앙', '장', '창', '탕', '항',
  '해', '래', '매', '배', '새', '애', '재', '채', '태', '패',
  '고', '노', '도', '로', '모', '보', '소', '오', '조', '초',
  '기', '니', '디', '리', '미', '비', '시', '이', '지', '치',
]

function pickChars(): { chars: string[]; correctChar: string; correctIndex: number } {
  const shuffled = [...SYLLABLES].sort(() => Math.random() - 0.5)
  const chars = shuffled.slice(0, 3)
  const correctIndex = Math.floor(Math.random() * 3)
  return { chars, correctChar: chars[correctIndex], correctIndex }
}

const TABLE = 'qr_login_sessions'

export type QrSessionRow = {
  token: string
  chars: string[]
  correct_char: string
  correct_index: number
  status: 'pending' | 'confirmed'
  access_token: string | null
  refresh_token: string | null
  expires_at: string
}

export async function createQrSession(): Promise<{
  token: string
  chars: string[]
  correctChar: string
  correctIndex: number
}> {
  const token = crypto.randomUUID()
  const { chars, correctChar, correctIndex } = pickChars()

  const { error } = await supabaseAdmin.from(TABLE).insert({
    token,
    chars,
    correct_char: correctChar,
    correct_index: correctIndex,
    status: 'pending',
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })

  if (error) throw new Error(`QR 세션 생성 실패: ${error.message}`)

  return { token, chars, correctChar, correctIndex }
}

export async function getQrSession(token: string): Promise<QrSessionRow | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) return null

  // 만료 확인
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from(TABLE).delete().eq('token', token)
    return null
  }

  return data as QrSessionRow
}

export async function confirmQrSession(
  token: string,
  selectedChar: string,
  tokens: { accessToken: string; refreshToken: string }
): Promise<'ok' | 'wrong' | 'not_found'> {
  const session = await getQrSession(token)
  if (!session) return 'not_found'
  if (session.correct_char !== selectedChar) return 'wrong'

  const { error } = await supabaseAdmin
    .from(TABLE)
    .update({
      status: 'confirmed',
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    })
    .eq('token', token)

  if (error) return 'not_found'
  return 'ok'
}

export async function deleteQrSession(token: string): Promise<void> {
  await supabaseAdmin.from(TABLE).delete().eq('token', token)
}
