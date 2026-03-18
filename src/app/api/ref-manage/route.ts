import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// 어드민 권한 확인 헬퍼
async function checkAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: appUser } = await supabaseAdmin
    .from('app_users')
    .select('role')
    .eq('username', user.email)
    .single();

  if (appUser?.role === 'mini-admin') return null;
  return user;
}

// GET: mini-admin 목록 조회
export async function GET() {
  try {
    const user = await checkAdmin();
    if (!user) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('app_users')
      .select('id, username, display_name, ref_code')
      .eq('role', 'mini-admin')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// POST: mini-admin 계정 생성
export async function POST(request: NextRequest) {
  try {
    const user = await checkAdmin();
    if (!user) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, display_name, ref_code } = body;

    if (!email || !password) {
      return NextResponse.json({ error: '이메일과 비밀번호는 필수입니다.' }, { status: 400 });
    }

    // Supabase Auth에 유저 생성
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message ?? '계정 생성 실패' }, { status: 400 });
    }

    // app_users에 mini-admin으로 등록
    const { error: insertError } = await supabaseAdmin
      .from('app_users')
      .insert({
        username: email,
        password_hash: '',
        display_name: display_name || null,
        ref_code: ref_code || null,
        role: 'mini-admin',
      });

    if (insertError) {
      // app_users 실패 시 Auth 유저도 롤백
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: 'app_users 등록 실패: ' + insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// PATCH: ref_code 또는 display_name 수정
export async function PATCH(request: NextRequest) {
  try {
    const user = await checkAdmin();
    if (!user) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ref_code, display_name } = body;

    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    }

    const updateData: Record<string, string> = {};
    if (ref_code !== undefined) updateData.ref_code = ref_code;
    if (display_name !== undefined) updateData.display_name = display_name;

    const { error } = await supabaseAdmin
      .from('app_users')
      .update(updateData)
      .eq('id', id)
      .eq('role', 'mini-admin');

    if (error) {
      return NextResponse.json({ error: '업데이트 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
