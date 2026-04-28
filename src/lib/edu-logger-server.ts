import { supabaseAdmin } from './supabase/admin'

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
