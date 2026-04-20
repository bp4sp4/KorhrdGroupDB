import { createClient } from './supabase/client';
import { supabaseAdmin } from './supabase/admin';

/**
 * 교육원 관리자 활동 로그를 edu_activity_logs 테이블에 기록한다.
 * fire-and-forget 방식으로 호출해도 무방하며, 로그 실패가 메인 플로우를 막지 않는다.
 */
export async function logEduActivity(params: {
  action: string;
  target_type?: string;
  target_name?: string;
  detail?: string;
}) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // email(username)로 app_users 조회
    const { data: appUser } = await supabase
      .from('app_users')
      .select('id, display_name')
      .eq('username', user.email)
      .maybeSingle();

    await supabase.from('edu_activity_logs').insert({
      user_id: null, // auth.users FK 제거됨, app_user_id 문자열로 기록
      user_name: appUser?.display_name ?? user.email ?? '알 수 없음',
      action: params.action,
      target_type: params.target_type ?? null,
      target_name: params.target_name ?? null,
      detail: params.detail ?? null,
    });
  } catch {
    // 로그 실패 무시
  }
}

/**
 * 서버 측에서 사용하는 로거.
 * API 라우트에서 호출 시 supabaseAdmin으로 우회.
 */
export async function logEduActivityServer(params: {
  user_name: string;
  action: string;
  target_type?: string;
  target_name?: string;
  detail?: string;
}) {
  try {
    await supabaseAdmin.from('edu_activity_logs').insert({
      user_id: null,
      user_name: params.user_name,
      action: params.action,
      target_type: params.target_type ?? null,
      target_name: params.target_name ?? null,
      detail: params.detail ?? null,
    });
  } catch {
    // 무시
  }
}
