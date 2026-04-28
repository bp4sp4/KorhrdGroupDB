import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PATCH: role, display_name, is_active 수정
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await requireAdmin()
  if (errorResponse) return errorResponse

  const { id } = await params
  const body = await request.json()
  const { role, display_name, is_active, position_id, department_id, phone } = body as {
    role?: string
    display_name?: string
    is_active?: boolean
    position_id?: string | null
    department_id?: string | null
    phone?: string | null
  }

  const updates: Record<string, unknown> = {}
  if (role !== undefined) updates.role = role
  if (display_name !== undefined) updates.display_name = display_name
  if (is_active !== undefined) updates.is_active = is_active
  if (position_id !== undefined) updates.position_id = position_id
  if (department_id !== undefined) updates.department_id = department_id
  if (phone !== undefined) updates.phone = phone || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '변경할 항목이 없습니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('app_users')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
