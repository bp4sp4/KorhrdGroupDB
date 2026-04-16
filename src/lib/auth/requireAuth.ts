import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { User } from '@supabase/supabase-js'

const MASTER_ADMIN_EMAIL = 'bp4sp4@naver.com'

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
  position_id?: string | null
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
    .select('id, display_name, role, position_id')
    .eq('username', user.email)
    .maybeSingle()

  if (user.email === MASTER_ADMIN_EMAIL) {
    return {
      user,
      appUser: {
        id: appUser?.id ?? 0,
        display_name: appUser?.display_name ?? user.email,
        role: 'master-admin',
        position_id: appUser?.position_id ?? null,
      },
      errorResponse: null,
    }
  }

  // app_users에 없으면 admin 권한으로 fallback (항상 전체 열람)
  return {
    user,
    appUser: appUser ?? { id: 0, display_name: null, role: 'admin', position_id: null },
    errorResponse: null,
  }
}
