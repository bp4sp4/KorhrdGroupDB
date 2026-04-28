import { createClient } from './supabase/client';

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

    const { data: appUser } = await supabase
      .from('app_users')
      .select('id, display_name')
      .eq('username', user.email)
      .maybeSingle();

    await supabase.from('edu_activity_logs').insert({
      user_id: null,
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

