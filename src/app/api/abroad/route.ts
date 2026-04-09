import { requireAuth } from '@/lib/auth/requireAuth'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const [
    { data: users },
    { data: applications },
    { data: consultations },
    { data: payments },
  ] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, target_country, created_at, is_admin')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('applications')
      .select('id, user_id, status, created_at, program, name, phone, email')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('consultations')
      .select('id, user_id, name, phone, region, desired_start, message, status, type, created_at')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('payments')
      .select('id, user_id, program, amount, payapp_order_id, payapp_tid, status, created_at')
      .order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    users: users ?? [],
    applications: applications ?? [],
    consultations: consultations ?? [],
    payments: payments ?? [],
  })
}
