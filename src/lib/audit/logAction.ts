import { supabaseAdmin } from '@/lib/supabase/admin'

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'bulk_create'
  | 'bulk_delete'
  | 'restore'
  | 'hard_delete'
  | 'confirm_draft'

interface LogActionParams {
  user_id?: string | null
  user_email?: string | null
  action: AuditAction
  resource: string
  resource_id?: string | null
  detail?: string
  meta?: Record<string, unknown>
}

export async function logAction(params: LogActionParams): Promise<void> {
  try {
    await supabaseAdmin.from('audit_logs').insert([{
      user_id: params.user_id ?? null,
      user_email: params.user_email ?? null,
      action: params.action,
      resource: params.resource,
      resource_id: params.resource_id ?? null,
      detail: params.detail ?? null,
      meta: params.meta ?? null,
    }])
  } catch (err) {
    // 로그 실패가 메인 작업을 중단시키지 않도록
    console.error('[logAction] Failed to write audit log:', err)
  }
}
