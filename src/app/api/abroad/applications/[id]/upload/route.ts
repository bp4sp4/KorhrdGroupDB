import { requireAuth } from '@/lib/auth/requireAuth'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const FIELD_MAP: Record<string, string> = {
  passport:           'passport_file_url',
  id_photo:           'id_photo_url',
  guardian_passport:  'guardian_passport_url',
  guardian_photo:     'guardian_photo_url',
  participant_sig:    'participant_sig_url',
  guardian_sig:       'guardian_sig_url',
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id } = await params
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const field = formData.get('field') as string | null

  if (!file || !field) {
    return NextResponse.json({ error: 'file과 field가 필요합니다.' }, { status: 400 })
  }

  const dbColumn = FIELD_MAP[field]
  if (!dbColumn) {
    return NextResponse.json({ error: '유효하지 않은 field입니다.' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const storagePath = `applications/${id}/${field}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabaseAdmin.storage
    .from('application-files')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('applications')
    .update({ [dbColumn]: storagePath })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  const { data } = await supabaseAdmin.storage
    .from('application-files')
    .createSignedUrl(storagePath, 3600)

  return NextResponse.json({ signedUrl: data?.signedUrl ?? null })
}
