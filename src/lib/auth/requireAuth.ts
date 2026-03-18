import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

type AuthResult =
  | { user: User; errorResponse: null }
  | { user: null; errorResponse: NextResponse }

export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      ),
    }
  }

  return { user, errorResponse: null }
}
