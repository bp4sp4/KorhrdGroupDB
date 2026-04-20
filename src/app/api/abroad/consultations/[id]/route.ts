import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// PATCH /api/abroad/consultations/[id] - 간편상담 수정
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id } = await params
  const body = await request.json().catch(() => ({}))

  const update: Record<string, unknown> = {}
  if (body.name !== undefined) update.name = String(body.name ?? '').trim() || '미입력'
  if (body.phone !== undefined) update.phone = String(body.phone ?? '').trim()
  if (body.region !== undefined) update.region = String(body.region ?? '').trim()
  if (body.desired_start !== undefined) update.desired_start = String(body.desired_start ?? '').trim()
  if (body.message !== undefined) update.message = String(body.message ?? '').trim()
  if (body.program !== undefined) update.program = body.program ? String(body.program).trim() : null
  if (body.type !== undefined) update.type = body.type === 'estimate' ? 'estimate' : 'consult'
  if (body.status !== undefined) update.status = String(body.status)

  const { data, error } = await supabaseAdmin
    .from('consultations')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ consultation: data })
}

// DELETE /api/abroad/consultations/[id] - 간편상담 삭제
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('consultations')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
