import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
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

interface AppUser {
  id: number
  display_name: string | null
  role: string
}

type AuthFullResult =
  | { user: User; appUser: AppUser; errorResponse: null }
  | { user: null; appUser: null; errorResponse: NextResponse }

export async function requireAuthFull(): Promise<AuthFullResult> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      user: null,
      appUser: null,
      errorResponse: NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      ),
    }
  }

  const { data: appUser } = await supabaseAdmin
    .from('app_users')
    .select('id, display_name, role')
    .eq('username', user.email)
    .single()

  if (!appUser) {
    return {
      user: null,
      appUser: null,
      errorResponse: NextResponse.json(
        { error: '사용자 정보를 찾을 수 없습니다.' },
        { status: 401 }
      ),
    }
  }

  return { user, appUser, errorResponse: null }
}
