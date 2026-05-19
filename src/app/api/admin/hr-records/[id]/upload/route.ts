import { NextRequest, NextResponse } from 'next/server'
import { requireMasterAdmin } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// POST /api/admin/hr-records/[id]/upload — master-admin이 다른 사용자의 카드 첨부 업로드
// FormData('file'): File, FormData('kind'): 'profile' | 'career'
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { errorResponse } = await requireMasterAdmin()
  if (errorResponse) return errorResponse

  const { id } = await context.params

  const { data: record, error: recErr } = await supabaseAdmin
    .from('hr_records')
    .select('user_id')
    .eq('id', id)
    .maybeSingle()
  if (recErr) {
    return NextResponse.json({ error: recErr.message }, { status: 500 })
  }
  if (!record) {
    return NextResponse.json({ error: '카드를 찾을 수 없습니다.' }, { status: 404 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const kind = (formData.get('kind') as string | null) ?? 'profile'
  if (!file) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const nameParts = file.name.split('.')
  const ext = (nameParts.length > 1 ? (nameParts.pop() ?? 'bin') : 'bin').replace(
    /[^a-zA-Z0-9]/g,
    '',
  )
  const safeBase =
    nameParts.join('_').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'file'
  const path = `user-${record.user_id}/${kind}/${Date.now()}-${safeBase}.${ext || 'bin'}`

  const { error } = await supabaseAdmin.storage
    .from('hr-profile-images')
    .upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data } = supabaseAdmin.storage
    .from('hr-profile-images')
    .getPublicUrl(path)

  return NextResponse.json({
    url: data.publicUrl,
    name: file.name,
    size: file.size,
  })
}
