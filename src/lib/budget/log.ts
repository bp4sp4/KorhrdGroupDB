import { supabaseAdmin } from '@/lib/supabase/admin'
import { logAction, type AuditAction } from '@/lib/audit/logAction'

const RESOURCE = '예산현황'

/**
 * 예산현황(체크/기록) 활동을 audit_logs 에 남긴다.
 * budget API 는 auth user(email) 대신 appUserId 만 알고 있어 username 을 조회해 매핑한다.
 * (로그 페이지의 담당자 이름은 user_email = app_users.username 기준으로 표시됨)
 */
export async function logBudget(
  appUserId: number,
  action: AuditAction,
  detail: string,
  resourceId?: string | null,
): Promise<void> {
  let email: string | null = null
  try {
    const { data } = await supabaseAdmin
      .from('app_users')
      .select('username')
      .eq('id', appUserId)
      .maybeSingle()
    email = (data?.username as string | null) ?? null
  } catch {
    /* 이메일 조회 실패해도 로그 자체는 남긴다 */
  }
  await logAction({
    user_id: null,
    user_email: email,
    action,
    resource: RESOURCE,
    resource_id: resourceId ?? null,
    detail,
  })
}
