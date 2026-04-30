import { requireAuth } from '@/lib/auth/requireAuth'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const [
    { data: staffUsers },
    { data: applications },
    { data: consultations },
    { data: payments },
  ] = await Promise.all([
    supabaseAdmin
      .from('app_users')
      .select('auth_user_id')
      .not('auth_user_id', 'is', null),
    supabaseAdmin
      .from('applications')
      .select('id, user_id, status, created_at, program, name, phone, email')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('consultations')
      .select('id, user_id, name, phone, region, desired_start, message, status, type, program, created_at')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('payments')
      .select('id, user_id, program, amount, payapp_order_id, payapp_tid, status, created_at')
      .order('created_at', { ascending: false }),
  ])

  const staffAuthIds = (staffUsers ?? []).map(u => u.auth_user_id).filter(Boolean) as string[]

  let profilesQuery = supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, target_country, created_at, is_admin, login_provider')
    .order('created_at', { ascending: false })

  if (staffAuthIds.length > 0) {
    profilesQuery = profilesQuery.not('id', 'in', `(${staffAuthIds.join(',')})`)
  }

  const { data: users } = await profilesQuery

  return NextResponse.json({
    users: users ?? [],
    applications: applications ?? [],
    consultations: consultations ?? [],
    payments: payments ?? [],
  })
}
