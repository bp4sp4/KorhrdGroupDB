import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET: 현재 로그인한 유저의 role 정보 조회
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // app_users에서 role 조회 (email로 매칭)
    const { data: appUser } = await supabaseAdmin
      .from('app_users')
      .select('id, role, display_name, ref_code')
      .eq('username', user.email)
      .single();

    const isFullAccess = appUser?.role === 'master-admin' || appUser?.role === 'admin'

    let permissions: { section: string; scope: string }[] = []
    if (appUser?.id) {
      if (isFullAccess) {
        permissions = [
          { section: 'hakjeom', scope: 'all' },
          { section: 'cert', scope: 'all' },
          { section: 'practice', scope: 'all' },
          { section: 'assignment', scope: 'all' },
        ]
      } else {
        const { data: perms } = await supabaseAdmin
          .from('user_permissions')
          .select('section, scope, allowed_tabs')
          .eq('user_id', appUser.id)
        permissions = perms ?? []
      }
    }

    return NextResponse.json({
      id: appUser?.id ?? null,
      role: appUser?.role ?? 'admin',
      displayName: appUser?.display_name ?? user.email,
      refCode: appUser?.ref_code ?? null,
      permissions,
    });
  } catch {
    return NextResponse.json({ role: 'admin' });
  }
}
