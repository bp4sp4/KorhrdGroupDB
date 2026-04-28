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

type QrSession = {
  chars: string[]
  correctChar: string
  correctIndex: number
  status: 'pending' | 'confirmed' | 'expired'
  expiresAt: number
  // 모바일에서 인증 성공 시 보관되는 Supabase 세션 토큰
  accessToken?: string
  refreshToken?: string
}

const store = new Map<string, QrSession>()

function cleanup() {
  const now = Date.now()
  for (const [token, session] of store) {
    if (session.expiresAt < now) store.delete(token)
  }
}

export function createQrSession(): { token: string; chars: string[]; correctChar: string; correctIndex: number } {
  cleanup()
  const token = crypto.randomUUID()
  const { chars, correctChar, correctIndex } = pickChars()
  store.set(token, {
    chars,
    correctChar,
    correctIndex,
    status: 'pending',
    expiresAt: Date.now() + 5 * 60 * 1000,
  })
  return { token, chars, correctChar, correctIndex }
}

export function getQrSession(token: string): QrSession | null {
  const session = store.get(token)
  if (!session) return null
  if (session.expiresAt < Date.now()) {
    store.delete(token)
    return null
  }
  return session
}

export function confirmQrSession(
  token: string,
  selectedChar: string,
  tokens: { accessToken: string; refreshToken: string }
): 'ok' | 'wrong' | 'not_found' {
  const session = store.get(token)
  if (!session || session.expiresAt < Date.now()) return 'not_found'
  if (session.correctChar !== selectedChar) return 'wrong'
  session.status = 'confirmed'
  session.accessToken = tokens.accessToken
  session.refreshToken = tokens.refreshToken
  return 'ok'
}

export function deleteQrSession(token: string) {
  store.delete(token)
}
