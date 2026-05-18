import { requireAuth } from '@/lib/auth/requireAuth'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/logs/actors
// 로그 페이지의 담당자 필터용 — audit_logs에 등장하는 distinct user_email +
// app_users에서 display_name 매핑해서 함께 반환
export async function GET() {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  // audit_logs에서 distinct user_email
  const { data: logs, error } = await supabaseAdmin
    .from('audit_logs')
    .select('user_email')
    .not('user_email', 'is', null)
    .limit(5000) // 최근 다수의 로그에서 사용자 풀 추출 (DB distinct 미지원으로 클라이언트 dedupe)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const emails = Array.from(
    new Set((logs ?? []).map((l) => l.user_email).filter(Boolean) as string[]),
  )

  // email → display_name 매핑
  const nameMap: Record<string, string> = {}
  if (emails.length > 0) {
    const { data: users } = await supabaseAdmin
      .from('app_users')
      .select('username, display_name')
      .in('username', emails)
    for (const u of users ?? []) {
      if (u.username && u.display_name) nameMap[u.username] = u.display_name
    }
  }

  const actors = emails
    .map((email) => ({ email, displayName: nameMap[email] ?? email }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko'))

  return NextResponse.json({ actors })
}
