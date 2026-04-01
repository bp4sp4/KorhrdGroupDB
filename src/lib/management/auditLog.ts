import { supabaseAdmin } from '@/lib/supabase/admin'

export async function writeAuditLog({
  userId,
  action,
  targetType,
  targetId,
  changes,
  ipAddress,
}: {
  userId?: string
  action: string
  targetType: string
  targetId?: string
  changes?: object
  ipAddress?: string
}) {
  await supabaseAdmin.from('audit_logs').insert({
    user_id: userId,
    action,
    target_type: targetType,
    target_id: targetId,
    changes,
    ip_address: ipAddress,
  })
}
