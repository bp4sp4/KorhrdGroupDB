import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// POST /api/dev/test-notification — admin이 임의 알림을 전체 공지로 발송
// body: { title?, message?, type?, link? }
export async function POST(request: NextRequest) {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const body = await request.json().catch(() => ({}))
  const {
    type = 'task_board',
    title = '🧪 테스트 업무 알림',
    message = `테스트 메시지 (${new Date().toLocaleTimeString('ko-KR')})`,
    link = '/task-board',
  } = body as { type?: string; title?: string; message?: string; link?: string }

  const { error } = await supabaseAdmin.from('notifications').insert({
    type,
    title,
    message,
    link,
    user_id: null,
    actor_id: null, // null이면 누구한테든 팝업이 뜸 (본인 억제 안 됨)
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
