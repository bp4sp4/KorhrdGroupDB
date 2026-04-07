import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('id, display_name, role, department_id')
    .eq('is_active', true)
    .order('display_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
