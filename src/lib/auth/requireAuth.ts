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
  position_id?: string | null
  department_id?: string | null
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
    .select('id, display_name, role, position_id, department_id')
    .eq('username', user.email)
    .maybeSingle()

  // master-admin 판정은 DB role 컬럼 기반
  if (appUser?.role === 'master-admin') {
    return {
      user,
      appUser: {
        id: appUser.id,
        display_name: appUser.display_name ?? user.email ?? null,
        role: 'master-admin',
        position_id: appUser.position_id ?? null,
        department_id: appUser.department_id ?? null,
      },
      errorResponse: null,
    }
  }

  // app_users에 없으면 guest 권한으로 fallback (모든 섹션 차단)
  // - 정상 등록된 사용자만 admin/master-admin/일반 권한 부여
  // - auth.users에는 있지만 app_users 미등록 사용자는 로그인은 되지만 데이터 접근 차단
  return {
    user,
    appUser: appUser ?? { id: 0, display_name: null, role: 'guest', position_id: null, department_id: null },
    errorResponse: null,
  }
}

export async function requireAdmin(): Promise<AuthFullResult> {
  const result = await requireAuthFull()
  if (result.errorResponse) return result

  const { role } = result.appUser
  if (role !== 'master-admin' && role !== 'admin') {
    return {
      user: null,
      appUser: null,
      errorResponse: NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 }),
    }
  }

  return result
}
