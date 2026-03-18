import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET: 미니관리자의 ref_code와 매칭되는 자격증 신청 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { user: _user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    // 로그인한 유저 확인
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // app_users에서 role과 ref_code 조회 (email로 매칭)
    const { data: appUser, error: userError } = await supabaseAdmin
      .from('app_users')
      .select('role, ref_code')
      .eq('username', user.email)
      .single();

    if (userError || !appUser) {
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 403 });
    }

    if (appUser.role !== 'mini-admin') {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (!appUser.ref_code) {
      return NextResponse.json({ error: 'ref_code가 설정되지 않았습니다.' }, { status: 400 });
    }

    // ref_code에 해당하는 자격증 신청 조회
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const paymentStatus = searchParams.get('payment_status');

    let query = supabaseAdmin
      .from('certificate_applications')
      .select('id, name, contact, payment_status, created_at, certificates, amount, ref')
      .eq('ref', appUser.ref_code)
      .order('created_at', { ascending: false });

    if (name) {
      query = query.ilike('name', `%${name}%`);
    }

    if (paymentStatus && paymentStatus !== 'all') {
      query = query.eq('payment_status', paymentStatus);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[mini-admin GET] Supabase error:', error);
      return NextResponse.json({ error: '데이터 조회에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error('[mini-admin GET] Unexpected error:', err);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
